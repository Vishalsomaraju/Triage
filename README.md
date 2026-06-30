# 📋 Triage: AI-Powered Task Prioritization & Alerting

**Triage** is a highly polished, responsive task prioritization and intelligence dashboard. It syncs with Cloud Firestore in real time, uses Google Gemini (with multi-tier fallback architecture) to run deep timeline/effort risk assessments, and features an integrated cron scheduler and nodemailer digest engine to preview and alert users to high-risk tasks.

---

## ✨ Features

- **🔐 Robust User Authentication**: Secure login, registration, and session persistence powered by **Firebase Authentication** and state-synchronized Firestore user profiles.
- **⚡ Real-Time Task Syncing**: Create, edit, toggle, and manage tasks. Tasks support title inputs, effort estimation weights, deadlines, and supplementary rich notes.
- **🧠 Intelligent Gemini Triage**: Prioritizes all active tasks, assesses deadline and effort risks, assigns logical risk categories (**High**, **Medium**, **Low**), provides concise bulleted reasoning (**Why**), and outlines a concrete **Next Action**.
- **🔄 Multi-Tier Fallback Resilience**: Implements intelligent model-fallback cascading (`gemini-3.5-flash` ➡️ `gemini-2.5-flash`) to ensure high availability and robust triage services even under regional quota strains.
- **✉️ Automated Email Digests**: A complete alerting engine using `node-cron` and `nodemailer`. Users can click **Preview Today's Alert** in the UI to instantly preview or dispatch high-risk email digests, complete with detailed explanations and next steps.
- **🎨 Beautiful Responsive Layout**: Full desktop-first precision with adaptive mobile-first support. Styled with **Tailwind CSS**, featuring custom animated states via **Motion/React**, and custom load indicators for uninterrupted user feedback.

---

## 🛠️ Technology Stack

| Layer | Technologies Used |
| :--- | :--- |
| **Frontend UI** | React 19, Tailwind CSS v4, Motion (by Framer), Lucide React Icons |
| **Database & Auth** | Cloud Firestore, Firebase Auth, Firebase Admin SDK |
| **Backend Service** | Node.js, Express, TSX, Esbuild (CJS server bundling) |
| **Intelligence Engine** | `@google/genai` TypeScript SDK (Gemini AI Models) |
| **Alerting & Scheduling** | `node-cron` (Daily Scheduler), `nodemailer` (SMTP Email Dispatcher) |

---

## 🚀 Getting Started

### Prerequisites

- Node.js (v18 or higher recommended)
- A Firebase Project (with Firestore & Auth enabled)
- A Google Gemini API Key

### Installation

1. **Clone the repository and navigate to the project directory:**
   ```bash
   cd triage
   ```

2. **Install all required dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   Create a `.env` file in the root directory (using `.env.example` as a template) and supply your credentials:
   ```env
   # .env
   GEMINI_API_KEY=your_gemini_api_key_here
   
   # Firebase Web Configuration (Client Side)
   VITE_FIREBASE_API_KEY=your_client_api_key
   VITE_FIREBASE_AUTH_DOMAIN=your_project_auth_domain
   VITE_FIREBASE_PROJECT_ID=your_project_id
   VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
   VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
   VITE_FIREBASE_APP_ID=your_app_id
   
   # Optional SMTP Settings for Alerts (Defaults to Ethereal/Mock SMTP if unprovided)
   SMTP_HOST=smtp.example.com
   SMTP_PORT=587
   SMTP_USER=alerts@example.com
   SMTP_PASS=your_smtp_password
   SMTP_FROM="Triage Alerts <alerts@example.com>"
   ```

---

## 💻 Running the Application

### Development Mode

To run both the backend Express server and the Vite development server simultaneously:
```bash
npm run dev
```
The server will boot up and bind to `http://localhost:3000`.

### Production Build & Launch

To bundle the application for production, we compile the frontend assets via Vite and use `esbuild` to bundle the backend `server.ts` into a self-contained CommonJS (`dist/server.cjs`) asset to bypass Node's strict ESM runtime file path limitations:

1. **Build the assets:**
   ```bash
   npm run build
   ```

2. **Start the production server:**
   ```bash
   npm run start
   ```

---

## 🧬 Architectural Deep-Dive

### 1. Unified Risk Prioritization Pipeline
When a user requests triage, their active tasks are parsed. The system calculates the remaining hours left until each deadline (supporting negative hour formatting for overdue tasks) and maps human-readable efforts to structural weights. This structured dataset is piped to the Gemini SDK:
- **Rule Formulation**: Prompt engineering guarantees that tasks are assessed strictly against their available time relative to the effort required.
- **Graceful Failures**: If the call fails, a descriptive error banner appears on the dashboard with an interactive **Retry Analysis** button.

### 2. Multi-Tier Model Fallbacks
To provide an elite enterprise-grade SLA, the server's AI client leverages cascading models:
```typescript
try {
  // Primary Tier: Gemini 3.5 Flash (cutting-edge reasoning)
  response = await callGeminiWithModel("gemini-3.5-flash", payload);
} catch (error) {
  // Secondary Fallback Tier: Gemini 2.5 Flash
  response = await callGeminiWithModel("gemini-2.5-flash", payload);
}
```

### 3. Integrated Alerting Engine & Cron
A background cron schedule (set to run automatically every day at a standard interval) queries Firestore to gather pending items across all registered user accounts. If any high-risk tasks are found, the system drafts a stylized email notifying the user.

---

## 🎨 Design System & Usability Choices

- **Cosmic Slate Palette**: Styled with smooth slate grays, balanced typography pairing ("Inter" + "JetBrains Mono" for code and status variables), and custom brand-focused colors.
- **Interactive Feedback**: Full layout animations on modal transitions, adding/removing tasks, and real-time processing spinners on the "Prioritize Tasks" action button to eliminate guess-work.
- **Perfect Spacing & Alignment**: Custom alignment across all task list views (pending, completed, and risk-sorted priority list) ensures effort levels, due-dates, and checkmark buttons align exactly across rows.
