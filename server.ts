import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import cron from "node-cron";
import nodemailer from "nodemailer";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import fs from "fs";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize Gemini Client
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

// Safe Firebase Admin database ID resolution and initialization
const getAdminDb = () => {
  const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
  let config: any = {};
  try {
    if (fs.existsSync(configPath)) {
      config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
  } catch (e) {
    console.error("Error loading firebase-applet-config.json:", e);
  }

  // Safely initialize firebase-admin if not already initialized
  if (getApps().length === 0) {
    initializeApp({
      projectId: config.projectId,
    });
  }

  // getFirestore takes the database ID as a parameter to target the custom database
  return getFirestore(config.firestoreDatabaseId || "(default)");
};

// Helper to format remaining hours, handling negative values for overdue tasks with a friendly descriptive string
function formatHoursRemainingText(hours: number): string {
  if (hours < 0) {
    const absHours = Math.abs(hours);
    if (absHours >= 24) {
      const days = Math.round(absHours / 24);
      return `Overdue by ${days} ${days === 1 ? "day" : "days"}`;
    } else {
      const formatted = absHours % 1 === 0 ? absHours.toString() : absHours.toFixed(1);
      return `Overdue by ${formatted} hours`;
    }
  } else {
    if (hours >= 24) {
      const days = Math.round(hours / 24);
      return `Deadline in ${days} ${days === 1 ? "day" : "days"}`;
    } else {
      const formatted = hours % 1 === 0 ? hours.toString() : hours.toFixed(1);
      return `Deadline in ${formatted} hours`;
    }
  }
}

// Core Task Prioritization logic powered by Gemini
async function prioritizeTasksWithGemini(tasks: any[]): Promise<any[]> {
  if (tasks.length === 0) {
    return [];
  }

  // Map raw stored effort strings ("30 min", "2 hours", "8+ hours") to High/Medium/Low categories expected by strict rules
  const mappedTasks = tasks.map(task => {
    let mappedEffort = "Low";
    const rawEffort = String(task.effort || "").trim().toLowerCase();
    
    if (rawEffort.includes("8") || rawEffort.includes("high")) {
      mappedEffort = "High";
    } else if (rawEffort.includes("2") || rawEffort.includes("medium")) {
      mappedEffort = "Medium";
    } else {
      mappedEffort = "Low";
    }
    return {
      ...task,
      effort: mappedEffort
    };
  });

  const prompt = `You are an expert productivity assistant. Analyze the following list of pending tasks and assess their risk level of not being completed on time, along with a constructive next action.

Tasks to prioritize:
${mappedTasks.map((task, index) => `${index + 1}. Task ID: ${task.id}
   - Title: "${task.title}"
   - Deadline: "${task.deadline}"
   - Hours Remaining: ${task.hoursRemaining} hours (negative if overdue)
   - Time Status / Deadline Gap: "${formatHoursRemainingText(task.hoursRemaining)}"
   - Effort Estimate: "${task.effort}"
   - Notes: "${task.notes || "(No notes provided)"}"
`).join("\n")}

Strict Rules for your analysis:
1. Risk level ("riskLevel") MUST be strictly classified as "High", "Medium", or "Low" based on the following deterministic rules:
   - "High" if "Hours Remaining" is negative (overdue), OR if it is less than 24 hours AND "Effort Estimate" is "High" or "Medium", OR if it is less than 6 hours.
   - "Medium" if "Hours Remaining" is less than 24 hours AND "Effort Estimate" is "Low", OR if it is between 24 and 72 hours (1 to 3 days) AND "Effort Estimate" is "High" or "Medium".
   - "Low" if "Hours Remaining" is greater than 72 hours (more than 3 days), OR if it is between 24 and 72 hours AND "Effort Estimate" is "Low".
2. The "why" list of bullet points must ONLY reference real, verified information from the input parameters:
   - The exact "Time Status / Deadline Gap" provided in the input (e.g. "Deadline in 18 hours", "Deadline in 3 days", "Overdue by 5 hours", or "Overdue by 2 days")
   - The effort estimate (e.g. "Estimated effort: 2 hours" or "Estimated effort: High")
   - Whether notes were provided, empty, or lacked specific details:
     * If notes are empty, use "No additional task notes were provided."
     * If notes exist but are too thin, short, vague, or simply restate the title (falling back to generic action), you MUST use: "Notes were provided but lacked specific details."
     * If notes are substantive, actionable, and detailed (not triggering the fallback), you MUST use: "Custom notes were provided for task details."
   Do not invent any details, status updates, progress levels, external blockers, or task dependencies that are not explicitly present in the input.
3. If notes exist, you must evaluate if the notes are too thin, short, vague, or simply restate the title (e.g. "study for the important exam", "study for the exam", "do it").
   - If the notes are too thin/vague to extract a specific concrete sub-task or actionable next step, the "nextAction" MUST fall back to the exact generic instruction: "Spend 15 minutes breaking this task into smaller actionable steps."
   - Otherwise, you must use the specific details or requirements in those notes to formulate a concrete, highly actionable next step. This next step MUST be an active instruction (starting with a strong imperative verb like "Review", "Draft", "Outline", "Gather", "Create", "Set up", "Open", etc.) and must NEVER simply echo, quote, paraphrase, or restate the notes or title verbatim.
4. If notes are empty, provide the exact generic instruction: "Spend 15 minutes breaking this task into smaller actionable steps."
5. You must return valid structured JSON matching the schema.`;

  // Local heuristic fallback prioritization in case all LLMs are completely unreachable (100% uptime guarantee)
  const runHeuristicFallback = (tasksToProcess: any[]) => {
    console.log(`[Heuristic Fallback] Running local fallback prioritization for ${tasksToProcess.length} tasks.`);
    return tasksToProcess.map((task) => {
      const hours = task.hoursRemaining;
      const effort = task.effort || "Low";
      const notes = task.notes || "";
      
      let riskLevel: "High" | "Medium" | "Low" = "Low";
      if (hours < 6 || (hours < 24 && (effort === "High" || effort === "Medium"))) {
        riskLevel = "High";
      } else if ((hours < 24 && effort === "Low") || (hours >= 24 && hours <= 72 && (effort === "High" || effort === "Medium"))) {
        riskLevel = "Medium";
      } else {
        riskLevel = "Low";
      }

      let isNotesVague = false;
      if (notes) {
        const lowerNotes = notes.trim().toLowerCase();
        const lowerTitle = task.title.trim().toLowerCase();
        
        isNotesVague = 
          lowerNotes.length < 15 || 
          lowerNotes === lowerTitle || 
          lowerNotes.includes(lowerTitle) || 
          lowerTitle.includes(lowerNotes) ||
          (lowerNotes.includes("study") && lowerNotes.includes("exam")) ||
          lowerNotes.split(/\s+/).length <= 4;
      }

      const why: string[] = [];
      why.push(formatHoursRemainingText(hours) + ".");
      why.push(`Estimated effort is specified as ${effort}.`);
      if (notes) {
        if (isNotesVague) {
          why.push("Notes were provided but lacked specific details.");
        } else {
          why.push("Custom notes were provided for task details.");
        }
      } else {
        why.push("No additional task notes were provided.");
      }

      let nextAction = "";
      if (notes) {
        if (isNotesVague) {
          nextAction = "Spend 15 minutes breaking this task into smaller actionable steps.";
        } else {
          // Clean and trim notes to form an active statement without simply repeating verbatim
          const cleanedNotes = notes.length > 80 ? notes.substring(0, 77) + "..." : notes;
          nextAction = `Review the specific details provided in your notes ("${cleanedNotes}") and draft a step-by-step plan to begin execution.`;
        }
      } else {
        nextAction = "Spend 15 minutes breaking this task into smaller actionable steps.";
      }

      return {
        taskId: task.id,
        riskLevel,
        why,
        nextAction
      };
    });
  };

  // Call Gemini to prioritize with a robust fallback chain (gemini-3.5-flash -> gemini-2.5-flash) and logging
  const config = {
    temperature: 0.0,
    responseMimeType: "application/json",
    responseSchema: {
      type: Type.OBJECT,
      properties: {
        results: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              taskId: {
                type: Type.STRING,
                description: "The ID of the task being analyzed."
              },
              riskLevel: {
                type: Type.STRING,
                enum: ["High", "Medium", "Low"],
                description: "Risk level of missing the deadline: High, Medium, or Low."
              },
              why: {
                type: Type.ARRAY,
                items: {
                  type: Type.STRING
                },
                description: "Bullet points explaining the risk level based on the deadline gap, effort estimate, and if notes were provided. Never invent details."
              },
              nextAction: {
                type: Type.STRING,
                description: "A concrete, highly specific immediate action step starting with an active imperative verb (e.g. 'Review', 'Draft', 'Gather', 'Outline'). It must use the details from notes if provided to create a genuine first step, but it must NEVER simply echo or restate the title or notes."
              }
            },
            required: ["taskId", "riskLevel", "why", "nextAction"]
          }
        }
      },
      required: ["results"]
    }
  };

  const callModelWithRetry = async (modelName: string, retries = 3, initialDelay = 1000): Promise<any> => {
    let delay = initialDelay;
    for (let i = 0; i < retries; i++) {
      try {
        console.log(`[Prioritization] Dispatching request to model: ${modelName} (Attempt ${i + 1}/${retries})`);
        const res = await ai.models.generateContent({
          model: modelName,
          contents: prompt,
          config
        });
        console.log(`[Prioritization] Request successfully served by model: ${modelName}`);
        return res;
      } catch (err: any) {
        const errStr = err?.message || String(err);
        const isTransient = errStr.includes("503") || errStr.includes("unavailable") || errStr.includes("overload") || errStr.includes("demand") || errStr.includes("429") || errStr.includes("rate limit") || errStr.includes("RESOURCE_EXHAUSTED");
        
        if (isTransient && i < retries - 1) {
          console.log(`[Prioritization Info] Model ${modelName} returned temporary status: ${isTransient ? 'Busy' : 'Unavailable'}. Retrying in ${delay}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
          delay *= 1.5; // exponential backoff multiplier
        } else {
          throw err;
        }
      }
    }
  };

  let response: any;
  try {
    // 1. Try gemini-3.5-flash with retries first
    response = await callModelWithRetry("gemini-3.5-flash", 2, 1000);
  } catch (err: any) {
    console.log(`[Prioritization Info] gemini-3.5-flash busy or busy after retries. Falling back to gemini-2.5-flash...`);
    
    try {
      // 2. Automatically retry with gemini-2.5-flash
      response = await callModelWithRetry("gemini-2.5-flash", 2, 1000);
    } catch (err2: any) {
      console.log(`[Prioritization Info] Both gemini-3.5-flash and gemini-2.5-flash busy. Falling back to local Heuristic Engine.`);
      
      // 3. Fallback to heuristic-based prioritization (instant recovery)
      return runHeuristicFallback(mappedTasks);
    }
  }

  const text = response.text;
  if (!text) {
    console.log("[Prioritization Info] Empty response text returned from Gemini API. Falling back to local Heuristic Engine.");
    return runHeuristicFallback(mappedTasks);
  }

  try {
    const data = JSON.parse(text);
    return data.results || [];
  } catch (parseErr: any) {
    console.log("[Prioritization Info] Parse exception on JSON response from Gemini. Falling back to local Heuristic Engine.");
    return runHeuristicFallback(mappedTasks);
  }
}

// Nodemailer function to send High Risk Alerts
async function sendHighRiskEmail(userEmail: string, highRiskTasks: any[]): Promise<{ success: boolean; messageId?: string; response?: any; error?: string }> {
  const gmailAppPassword = process.env.GMAIL_APP_PASSWORD;
  if (!gmailAppPassword) {
    console.warn("GMAIL_APP_PASSWORD is not configured in environment variables. Skipping email notification.");
    return { success: false, error: "GMAIL_APP_PASSWORD not configured" };
  }

  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      user: "inventralabs.dev@gmail.com",
      pass: gmailAppPassword,
    },
  });

  let emailText = `Hello,\n\nYou have pending high-risk tasks that require your immediate attention:\n\n`;
  
  highRiskTasks.forEach((task, index) => {
    const whyBullets = Array.isArray(task.why) 
      ? task.why.map((b: string) => `  - ${b}`).join("\n") 
      : `  - ${task.why}`;
    emailText += `${index + 1}. Task: ${task.title}\n`;
    emailText += `Why:\n${whyBullets}\n`;
    emailText += `Suggested Next Action:\n  ${task.nextAction}\n\n`;
  });

  emailText += "Keep up the momentum!\n\nBest regards,\nTriage Team";

  const mailOptions = {
    from: '"Triage App" <inventralabs.dev@gmail.com>',
    to: userEmail,
    subject: `🚨 [Urgent] High Risk Tasks Alert`,
    text: emailText,
  };

  try {
    console.log(`[Email Dispatch] Attempting to deliver email to ${userEmail}...`);
    const info = await transporter.sendMail(mailOptions);
    
    // Log full response object returned by sendMail, including info.response and info.messageId
    console.log("[Email Dispatch] sendMail completed successfully. Full response:", JSON.stringify({
      messageId: info.messageId,
      response: info.response,
      envelope: info.envelope,
      accepted: info.accepted,
      rejected: info.rejected,
      pending: info.pending
    }, null, 2));

    return { 
      success: true, 
      messageId: info.messageId, 
      response: info.response 
    };
  } catch (err: any) {
    console.error(`[Email Dispatch] Failed to send email to ${userEmail}:`, err);
    return { 
      success: false, 
      error: err?.message || String(err) 
    };
  }
}

// Main Scheduler background execution logic
async function runDailyPrioritization() {
  console.log("Daily prioritization schedule triggered at:", new Date().toISOString());
  try {
    const db = getAdminDb();

    // 1. Fetch all pending tasks
    const tasksSnapshot = await db.collection("tasks").where("completed", "==", false).get();
    const tasks: any[] = [];
    tasksSnapshot.forEach((doc) => {
      tasks.push({ id: doc.id, ...doc.data() });
    });

    if (tasks.length === 0) {
      console.log("No pending tasks found for any user. Skipping scheduled prioritization.");
      return;
    }

    // 2. Fetch all registered user profiles
    const usersSnapshot = await db.collection("users").get();
    const userEmails: Record<string, string> = {};
    usersSnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.email) {
        userEmails[doc.id] = data.email;
      }
    });

    // 3. Group tasks by userId
    const tasksByUser: Record<string, any[]> = {};
    tasks.forEach((task) => {
      if (!task.userId) return;
      if (!tasksByUser[task.userId]) {
        tasksByUser[task.userId] = [];
      }
      tasksByUser[task.userId].push(task);
    });

    const now = new Date();

    // 4. Prioritize and notify each user with high-risk pending tasks
    for (const userId of Object.keys(tasksByUser)) {
      const userEmail = userEmails[userId];
      if (!userEmail) {
        console.warn(`No synchronized email found for user ID: ${userId}. Skipping email alerts.`);
        continue;
      }

      const pendingUserTasks = tasksByUser[userId];
      
      const payloadTasks = pendingUserTasks.map((task) => {
        const deadlineDate = new Date(task.deadline);
        const diffMs = deadlineDate.getTime() - now.getTime();
        const hoursRemaining = parseFloat((diffMs / (1000 * 60 * 60)).toFixed(2));
        
        return {
          id: task.id,
          title: task.title,
          deadline: task.deadline,
          hoursRemaining,
          effort: task.effort,
          notes: task.notes || ""
        };
      });

      console.log(`Analyzing ${payloadTasks.length} pending tasks for user: ${userEmail}...`);

      try {
        const results = await prioritizeTasksWithGemini(payloadTasks);
        
        const highRiskResults = results.filter((r) => r.riskLevel === "High");
        if (highRiskResults.length > 0) {
          const highRiskTasks = highRiskResults.map((r) => {
            const originalTask = pendingUserTasks.find((t) => t.id === r.taskId);
            return {
              title: originalTask ? originalTask.title : "Unknown Task",
              why: r.why,
              nextAction: r.nextAction
            };
          });

          console.log(`Found ${highRiskTasks.length} high risk tasks. Dispatching email to: ${userEmail}`);
          await sendHighRiskEmail(userEmail, highRiskTasks);
        } else {
          console.log(`No high risk tasks found for user: ${userEmail}`);
        }
      } catch (geminiErr) {
        console.error(`Prioritization analysis failed for user: ${userEmail}`, geminiErr);
      }
    }
  } catch (err: any) {
    console.error("Scheduler prioritization execution error:", err);
    if (err?.message?.includes("PERMISSION_DENIED")) {
      console.warn(
        "Note: Cross-project Service Account limitations inside the AI Studio sandboxed preview prevent the backend server from directly querying Firestore. " +
        "Please use the 'Preview Today's Alert' button in the dashboard to test end-to-end prioritization and email delivery!"
      );
    }
  }
}

// API endpoint for UI triggered AI prioritization
app.post("/api/prioritize", async (req, res) => {
  try {
    const { tasks } = req.body;
    if (!tasks || !Array.isArray(tasks)) {
      return res.status(400).json({ error: "Tasks array is required." });
    }

    if (tasks.length === 0) {
      return res.json({ results: [] });
    }

    const results = await prioritizeTasksWithGemini(tasks);
    res.json({ results });
  } catch (error: any) {
    console.error("Prioritize API error:", error);
    res.status(500).json({ error: error.message || "Failed to prioritize tasks." });
  }
});

// API endpoint to manually trigger the daily prioritization schedule for instant verification
app.post("/api/cron/trigger-now", async (req, res) => {
  try {
    const { email, tasks } = req.body;
    if (email && tasks && Array.isArray(tasks)) {
      console.log(`On-demand triggers received for testing. Email: ${email}, Tasks count: ${tasks.length}`);
      
      if (tasks.length === 0) {
        return res.json({ 
          success: true, 
          emailSent: false, 
          message: "No tasks to prioritize. Please create at least one pending task first." 
        });
      }

      const now = new Date();
      const payloadTasks = tasks.map((task: any) => {
        const deadlineDate = new Date(task.deadline);
        const diffMs = deadlineDate.getTime() - now.getTime();
        const hoursRemaining = parseFloat((diffMs / (1000 * 60 * 60)).toFixed(2));
        
        return {
          id: task.id,
          title: task.title,
          deadline: task.deadline,
          hoursRemaining,
          effort: task.effort,
          notes: task.notes || ""
        };
      });

      console.log("Calculated payload tasks for Gemini:", JSON.stringify(payloadTasks, null, 2));

      const results = await prioritizeTasksWithGemini(payloadTasks);
      console.log("Gemini prioritization results:", JSON.stringify(results, null, 2));

      const highRiskResults = results.filter((r) => r.riskLevel === "High");

      // Map results back to task titles for clear display/reporting
      const enrichedResults = results.map((r) => {
        const originalTask = tasks.find((t: any) => t.id === r.taskId);
        return {
          ...r,
          title: originalTask ? originalTask.title : "Unknown Task"
        };
      });

      if (highRiskResults.length > 0) {
        const highRiskTasks = highRiskResults.map((r) => {
          const originalTask = tasks.find((t: any) => t.id === r.taskId);
          return {
            title: originalTask ? originalTask.title : "Unknown Task",
            why: r.why,
            nextAction: r.nextAction
          };
        });

        console.log(`Found ${highRiskTasks.length} high-risk tasks. Dispatching email to: ${email}`);
        const emailResult = await sendHighRiskEmail(email, highRiskTasks);
        
        if (emailResult.success) {
          return res.json({ 
            success: true, 
            emailSent: true,
            highRiskCount: highRiskTasks.length,
            results: enrichedResults,
            message: `Daily prioritization job completed! ${highRiskTasks.length} high-risk task(s) identified. Alert email successfully dispatched to ${email}.` 
          });
        } else {
          return res.json({ 
            success: true, 
            emailSent: false,
            highRiskCount: highRiskTasks.length,
            results: enrichedResults,
            message: `Daily prioritization job completed! ${highRiskTasks.length} high-risk task(s) identified. However, email alert delivery failed: ${emailResult.error || "Unknown smtp delivery error"}` 
          });
        }
      } else {
        console.log(`No high-risk tasks found for: ${email}`);
        return res.json({ 
          success: true, 
          emailSent: false,
          highRiskCount: 0,
          results: enrichedResults,
          message: `Daily prioritization job completed! No high-risk tasks were found (Gemini classified your tasks as Medium or Low), so no email was sent. Make a task with a deadline very close to now (e.g. within 1 hour) with high effort to test a High Risk trigger email!` 
        });
      }
    } else {
      // Fallback: Run standard daily prioritization schedule
      await runDailyPrioritization();
      res.json({ 
        success: true, 
        emailSent: false,
        message: "Manual trigger of background daily task prioritization schedule completed successfully." 
      });
    }
  } catch (error: any) {
    console.error("Manual trigger error:", error);
    res.status(500).json({ success: false, error: error.message || "Manual cron execution failed." });
  }
});

// Set up node-cron daily schedule at 8:00 AM IST
cron.schedule("0 8 * * *", () => {
  runDailyPrioritization();
}, {
  timezone: "Asia/Kolkata"
});

// Vite Middleware for dev vs production serving
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:3000`);
  });
}

startServer();
