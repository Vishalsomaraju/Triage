import { useState, useEffect } from "react";
import { User, signOut } from "firebase/auth";
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  doc, 
  deleteDoc,
  setDoc
} from "firebase/firestore";
import { auth, db, OperationType, handleFirestoreError } from "../firebase";
import { Task, EffortEstimate } from "../types";
import TaskItem from "./TaskItem";
import TaskModal from "./TaskModal";
import { formatFriendlyDate } from "../utils";
import { 
  ClipboardList, 
  Plus, 
  LogOut, 
  ChevronDown, 
  ChevronUp, 
  CheckCircle2,
  ListTodo,
  Sparkles,
  Mail,
  AlertCircle,
  Clock,
  Calendar
} from "lucide-react";

interface PrioritizationResult {
  taskId: string;
  riskLevel: "High" | "Medium" | "Low";
  why: string[];
  nextAction: string;
}

interface DashboardProps {
  user: User;
}

export default function Dashboard({ user }: DashboardProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | undefined>(undefined);
  
  // Section collapse state
  const [isCompletedExpanded, setIsCompletedExpanded] = useState(false);

  // AI Prioritization states
  const [prioritizing, setPrioritizing] = useState(false);
  const [prioritizationResults, setPrioritizationResults] = useState<PrioritizationResult[]>([]);
  const [prioritizeError, setPrioritizeError] = useState<string | null>(null);

  // Scheduled job email trigger states
  const [triggeringCron, setTriggeringCron] = useState(false);
  const [cronSuccessMessage, setCronSuccessMessage] = useState<string | null>(null);
  const [cronErrorMessage, setCronErrorMessage] = useState<string | null>(null);

  // Synchronize user profile (email and uid) into Firestore users collection
  useEffect(() => {
    if (user && user.uid && user.email) {
      const userRef = doc(db, "users", user.uid);
      setDoc(userRef, {
        email: user.email,
        uid: user.uid,
        updatedAt: new Date().toISOString()
      }).catch((err) => {
        console.error("Failed to sync user details to Firestore:", err);
        handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`);
      });
    }
  }, [user]);

  // Firestore real-time synchronization
  useEffect(() => {
    setLoading(true);
    const q = query(
      collection(db, "tasks"),
      where("userId", "==", user.uid)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fetchedTasks: Task[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          fetchedTasks.push({
            id: docSnap.id,
            title: data.title || "",
            deadline: data.deadline || "",
            effort: data.effort || "30 min",
            notes: data.notes || "",
            completed: !!data.completed,
            createdAt: data.createdAt || "",
            userId: data.userId || ""
          });
        });
        setTasks(fetchedTasks);
        setLoading(false);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, "tasks");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user.uid]);

  // Split and sort tasks
  // Incomplete tasks sorted by deadline ascending (soonest deadline first)
  const pendingTasks = tasks
    .filter((task) => !task.completed)
    .sort((a, b) => {
      if (!a.deadline) return 1;
      if (!b.deadline) return -1;
      return a.deadline.localeCompare(b.deadline);
    });

  // Completed tasks sorted by newest creation first or deadline
  const completedTasks = tasks
    .filter((task) => task.completed)
    .sort((a, b) => {
      // Sort completed by createdAt descending (most recently created/reopened first)
      return b.createdAt.localeCompare(a.createdAt);
    });

  // Handle Sign Out
  const handleSignOut = () => {
    signOut(auth).catch((err) => console.error("Sign out error:", err));
  };

  // Handle AI Prioritization of Tasks
  const handlePrioritizeTasks = async () => {
    if (pendingTasks.length === 0) return;
    
    setPrioritizing(true);
    setPrioritizeError(null);
    
    try {
      const now = new Date();
      const payloadTasks = pendingTasks.map((task) => {
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

      const response = await fetch("/api/prioritize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ tasks: payloadTasks })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error ${response.status}`);
      }

      const data = await response.json();
      setPrioritizationResults(data.results || []);
    } catch (err: any) {
      console.error("Failed to prioritize tasks:", err);
      setPrioritizeError(err.message || "An unexpected error occurred.");
    } finally {
      setPrioritizing(false);
    }
  };

  const handleTriggerCronNow = async () => {
    setTriggeringCron(true);
    setCronSuccessMessage(null);
    setCronErrorMessage(null);
    try {
      const response = await fetch("/api/cron/trigger-now", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: user.email,
          tasks: pendingTasks.map(t => ({
            id: t.id,
            title: t.title,
            deadline: t.deadline,
            effort: t.effort,
            notes: t.notes || ""
          }))
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error ${response.status}`);
      }

      const data = await response.json();
      if (data.success) {
        setCronSuccessMessage(data.message);
        if (data.results) {
          setPrioritizationResults(data.results);
        }
      } else {
        setCronErrorMessage(data.error || "Failed to trigger daily prioritization job.");
      }
    } catch (err: any) {
      console.error("Failed to trigger on-demand schedule:", err);
      setCronErrorMessage(err.message || "An unexpected error occurred while executing the daily schedule.");
    } finally {
      setTriggeringCron(false);
    }
  };

  // Filter out prioritization results if corresponding tasks are no longer pending
  const activePrioritizationResults = prioritizationResults.filter(result => 
    pendingTasks.some(t => t.id === result.taskId)
  );

  // Sort results by High, Medium, Low, and then by soonest deadline within same risk level
  const sortedPrioritizationResults = [...activePrioritizationResults].sort((a, b) => {
    const riskPriority: Record<string, number> = { High: 3, Medium: 2, Low: 1 };
    const pA = riskPriority[a.riskLevel] || 0;
    const pB = riskPriority[b.riskLevel] || 0;
    if (pA !== pB) {
      return pB - pA;
    }

    const taskA = tasks.find((t) => t.id === a.taskId);
    const taskB = tasks.find((t) => t.id === b.taskId);
    const deadlineA = taskA?.deadline || "";
    const deadlineB = taskB?.deadline || "";
    
    if (!deadlineA) return 1;
    if (!deadlineB) return -1;
    return deadlineA.localeCompare(deadlineB);
  });

  // Open modal for creating a task
  const handleOpenNewTaskModal = () => {
    setEditingTask(undefined);
    setIsModalOpen(true);
  };

  // Open modal for editing a task
  const handleOpenEditTaskModal = (task: Task) => {
    setEditingTask(task);
    setIsModalOpen(true);
  };

  // Create or Update task in Firestore
  const handleSaveTask = async (taskData: {
    title: string;
    deadline: string;
    effort: EffortEstimate;
    notes: string;
  }) => {
    if (editingTask) {
      // Edit existing task
      const path = `tasks/${editingTask.id}`;
      try {
        const taskRef = doc(db, "tasks", editingTask.id);
        await updateDoc(taskRef, {
          title: taskData.title,
          deadline: taskData.deadline,
          effort: taskData.effort,
          notes: taskData.notes
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, path);
      }
    } else {
      // Create new task
      try {
        await addDoc(collection(db, "tasks"), {
          title: taskData.title,
          deadline: taskData.deadline,
          effort: taskData.effort,
          notes: taskData.notes,
          completed: false,
          createdAt: new Date().toISOString(),
          userId: user.uid
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, "tasks");
      }
    }
  };

  // Toggle complete state in Firestore
  const handleToggleComplete = async (task: Task) => {
    const path = `tasks/${task.id}`;
    try {
      const taskRef = doc(db, "tasks", task.id);
      await updateDoc(taskRef, {
        completed: !task.completed
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  };

  // Delete task permanently from Firestore
  const handleDeleteTask = async (id: string) => {
    const path = `tasks/${id}`;
    try {
      const taskRef = doc(db, "tasks", id);
      await deleteDoc(taskRef);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  };

  return (
    <div id="dashboard-container" className="min-h-screen bg-brand-bg pb-16">
      {/* Navigation Header */}
      <nav id="navbar" className="sticky top-0 z-40 bg-brand-white border-b border-brand-border/80 shadow-xs">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ClipboardList className="text-brand-accent w-5 h-5" />
            <span className="font-bold tracking-tight text-brand-dark text-lg">Triage</span>
          </div>

          <div className="flex items-center gap-4">
            {/* User Profile */}
            <div className="flex items-center gap-2">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || "User"}
                  referrerPolicy="no-referrer"
                  className="w-8 h-8 rounded-full border border-brand-border shadow-xs"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-brand-accent/10 flex items-center justify-center text-xs font-semibold text-brand-accent border border-brand-border">
                  {user.displayName ? user.displayName[0].toUpperCase() : "U"}
                </div>
              )}
              <span className="hidden sm:inline text-xs font-medium text-brand-dark">
                {user.displayName || user.email}
              </span>
            </div>

            {/* Logout button */}
            <button
              id="logout-btn"
              onClick={handleSignOut}
              className="p-2 text-brand-muted hover:text-brand-dark rounded-full hover:bg-brand-bg transition-colors"
              title="Sign Out"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content Dashboard */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 pt-8 space-y-8">
        
        {/* Banner with Title and Action */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-brand-dark">Prioritization Dashboard</h1>
            <p className="text-xs text-brand-muted mt-0.5">Triage tasks based on deadline and effort estimate.</p>
          </div>
          <button
            id="new-task-btn"
            onClick={handleOpenNewTaskModal}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-md bg-brand-accent text-brand-white hover:bg-brand-accent-hover font-medium text-sm shadow-sm transition-all active:scale-[0.98] cursor-pointer"
          >
            <Plus size={16} />
            <span>New Task</span>
          </button>
        </div>

        {/* Task Lists Section */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-2">
            <svg
              className="animate-spin h-5 w-5 text-brand-accent"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            <span className="text-xs text-brand-muted font-medium">Loading tasks...</span>
          </div>
        ) : (
          <div className="space-y-6">
            
            {/* AI Prioritization Panel */}
            <div className="bg-brand-white border border-brand-border/60 rounded-xl p-5 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-brand-dark flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-brand-accent animate-pulse" />
                    AI Prioritization Engine
                  </h3>
                  <p className="text-xs text-brand-muted mt-0.5">
                    Analyze pending tasks with Gemini to evaluate completion risk and get next action steps.
                  </p>
                </div>
                <button
                  id="prioritize-tasks-btn"
                  onClick={handlePrioritizeTasks}
                  disabled={prioritizing || pendingTasks.length === 0}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md bg-brand-accent text-brand-white hover:bg-brand-accent-hover font-medium text-xs shadow-xs transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
                >
                  {prioritizing ? (
                    <>
                      <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span>Analyzing...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles size={14} />
                      <span>Prioritize Tasks</span>
                    </>
                  )}
                </button>
              </div>

              {prioritizeError && (
                <div className="p-4 bg-rose-50 border border-rose-100 text-rose-800 text-xs rounded-lg flex items-start gap-3 shadow-xs">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
                  <div className="space-y-1 flex-1">
                    <p className="font-semibold text-rose-900">Analysis Issue</p>
                    <p className="leading-relaxed text-rose-700">{prioritizeError}</p>
                    <button
                      onClick={handlePrioritizeTasks}
                      className="mt-2 inline-flex items-center gap-1 px-2 py-1 rounded bg-rose-600 hover:bg-rose-700 text-white font-semibold text-[10px] transition-colors cursor-pointer"
                    >
                      Retry Analysis
                    </button>
                  </div>
                </div>
              )}

              {/* Daily Alert Testing Section */}
              <div className="border-t border-brand-border/40 pt-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-brand-dark flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-brand-accent" />
                    Daily Email Notification (8:00 AM IST Schedule)
                  </h4>
                  <p className="text-[11px] text-brand-muted max-w-xl">
                    Triggers the prioritize engine daily. If any pending tasks are classified as <strong className="text-rose-600">High Risk</strong>, an alert email is automatically dispatched to you containing the task details and next action steps.
                  </p>
                </div>
                <button
                  id="trigger-email-now-btn"
                  onClick={handleTriggerCronNow}
                  disabled={triggeringCron || pendingTasks.length === 0}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md bg-brand-white hover:bg-brand-bg text-brand-dark border border-brand-border/80 hover:border-brand-border font-medium text-xs shadow-xs transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none cursor-pointer self-start md:self-auto shrink-0"
                >
                  {triggeringCron ? (
                    <>
                      <svg className="animate-spin h-3.5 w-3.5 text-brand-dark" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span>Triggering Daily Job...</span>
                    </>
                  ) : (
                    <>
                      <Mail size={14} />
                      <span>Preview Today's Alert</span>
                    </>
                  )}
                </button>
              </div>

              {cronSuccessMessage && (
                <div className="p-3 bg-emerald-50 border border-emerald-100 text-emerald-800 text-xs rounded-md flex items-start gap-2">
                  <span className="font-semibold text-emerald-600 mt-0.5">✓</span>
                  <span>{cronSuccessMessage}</span>
                </div>
              )}

              {cronErrorMessage && (
                <div className="p-3 bg-rose-50 border border-rose-100 text-rose-700 text-xs rounded-md flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
                  <span>{cronErrorMessage}</span>
                </div>
              )}

              {sortedPrioritizationResults.length > 0 && (
                <div className="space-y-4 pt-4 border-t border-brand-border/40">
                  <h4 className="text-xs font-semibold text-brand-muted uppercase tracking-wider">
                    Risk-Sorted Analysis ({sortedPrioritizationResults.length})
                  </h4>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {sortedPrioritizationResults.map((result) => {
                      const task = tasks.find((t) => t.id === result.taskId);
                      if (!task) return null;
                      
                      const badgeColors = {
                        High: "bg-rose-50 border border-rose-200 text-rose-700",
                        Medium: "bg-amber-50 border border-amber-200 text-amber-800",
                        Low: "bg-emerald-50 border border-emerald-200 text-emerald-700"
                      };

                      return (
                        <div
                          key={result.taskId}
                          className="bg-brand-white border border-brand-border rounded-lg p-4 flex flex-col justify-between hover:shadow-xs transition-shadow"
                        >
                          <div>
                            <div className="flex items-start justify-between gap-2">
                              <h5 className="font-semibold text-sm text-brand-dark line-clamp-2">
                                {task.title}
                              </h5>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider shrink-0 ${badgeColors[result.riskLevel]}`}>
                                {result.riskLevel}
                              </span>
                            </div>

                            {/* Task metadata badges aligning with TaskItem style */}
                            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 mt-2 text-[11px] text-brand-muted">
                              <span className="inline-flex items-center gap-1 font-medium px-2 py-0.5 rounded-full bg-brand-accent/10 text-brand-accent">
                                <Clock size={10} />
                                {task.effort}
                              </span>
                              <span className="inline-flex items-center gap-1 opacity-85">
                                <Calendar size={11} className="text-brand-accent" />
                                <span>Due: {formatFriendlyDate(task.deadline)}</span>
                              </span>
                            </div>

                            <ul className="list-disc pl-4 space-y-1 mt-3.5 text-xs text-brand-muted">
                              {result.why.map((bullet, idx) => (
                                <li key={idx} className="leading-relaxed">
                                  {bullet}
                                </li>
                              ))}
                            </ul>
                          </div>

                          <div className="mt-4 p-3 bg-brand-accent/5 border-l-2 border-brand-accent rounded-r-md">
                            <span className="text-[9px] font-bold uppercase tracking-wider text-brand-accent block mb-1">
                              Suggested Next Step
                            </span>
                            <p className="text-xs text-brand-dark font-medium italic leading-relaxed">
                              "{result.nextAction}"
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* 1. Pending Tasks Section */}
            <div id="pending-tasks-section" className="space-y-3">
              <div className="flex items-center justify-between border-b border-brand-border/60 pb-2">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-brand-muted flex items-center gap-2">
                  <ListTodo size={14} className="text-brand-accent" />
                  Pending Tasks ({pendingTasks.length})
                </h2>
              </div>

              {pendingTasks.length === 0 ? (
                <div className="text-center py-10 px-4 bg-brand-white rounded-lg border border-brand-border/60">
                  <CheckCircle2 className="mx-auto w-8 h-8 text-brand-accent/50 mb-3" />
                  <p className="text-sm font-medium text-brand-dark">All caught up!</p>
                  <p className="text-xs text-brand-muted mt-1 max-w-xs mx-auto">
                    No pending tasks found. Create a new task to organize your time.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingTasks.map((task) => (
                    <TaskItem
                      key={task.id}
                      task={task}
                      onToggleComplete={handleToggleComplete}
                      onEdit={handleOpenEditTaskModal}
                      onDelete={handleDeleteTask}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* 2. Completed Tasks Section (Collapsible, Collapsed by Default) */}
            <div id="completed-tasks-section" className="space-y-3 pt-4">
              <button
                id="toggle-completed-btn"
                onClick={() => setIsCompletedExpanded(!isCompletedExpanded)}
                className="w-full flex items-center justify-between border-b border-brand-border/60 pb-2 text-left group focus:outline-none"
              >
                <h2 className="text-sm font-semibold uppercase tracking-wider text-brand-muted flex items-center gap-2 group-hover:text-brand-dark transition-colors">
                  <CheckCircle2 size={14} className="text-brand-accent/70" />
                  Completed ({completedTasks.length})
                </h2>
                <div className="text-brand-muted group-hover:text-brand-dark transition-colors">
                  {isCompletedExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>
              </button>

              {isCompletedExpanded && (
                <div className="space-y-3 animate-fadeIn">
                  {completedTasks.length === 0 ? (
                    <div className="text-center py-8 text-xs text-brand-muted bg-brand-white/40 rounded-lg border border-dashed border-brand-border">
                      No tasks completed yet. Finish a task to see it here!
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {completedTasks.map((task) => (
                        <TaskItem
                          key={task.id}
                          task={task}
                          onToggleComplete={handleToggleComplete}
                          onEdit={handleOpenEditTaskModal}
                          onDelete={handleDeleteTask}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

          </div>
        )}
      </main>

      {/* Unified Task creation/editing Modal */}
      <TaskModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveTask}
        task={editingTask}
      />
    </div>
  );
}
