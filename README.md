# Triage

**An AI-powered task prioritization assistant that doesn't wait to be asked.**

Most to-do apps tell you *what's* due. Triage tells you *what's actually dangerous to ignore, why, and what to do about it right now* — and it checks in on you automatically, every day, without you opening the app.

Built for the BlockseBlock "Last-Minute Life Saver" challenge.

## What it actually does

- **Risk triage, not just sorting.** Every task is classified High / Medium / Low risk using a deterministic rule (deadline proximity × effort estimate), so a 3-hour-away task that takes real effort is correctly flagged above a tomorrow-due task that takes 20 minutes.
- **Explainable, not a black box.** Every classification shows its "why" — the literal deadline gap, the effort estimate, whether you gave it notes — traceable back to real input, never invented.
- **Concrete next actions, not vague nagging.** Instead of "finish the assignment," Gemini breaks it into one specific first step, grounded in whatever notes you gave it — and honestly says "break this down" instead of fabricating fake specifics when you didn't give it any.
- **Acts on its own.** A scheduled Cloud Function re-runs prioritization for every user every morning and emails an alert for anything newly High-risk — no button click required. This is the core of "beyond passive reminders": the system decides something needs your attention, on its own schedule, and tells you.

## How it's built

| Layer | Technology |
|---|---|
| Build environment | Google AI Studio |
| Frontend | React |
| Backend | Node.js / Express |
| AI reasoning | Gemini API (structured JSON: risk level, why, next action) |
| Auth | Firebase Authentication (Google Sign-In) |
| Database | Firestore |
| Scheduled jobs | Firebase Cloud Functions + Cloud Scheduler |
| Email delivery | Nodemailer over Gmail SMTP |
| Deployment | Google Cloud Run |

## Run locally

**Prerequisites:** Node.js

1. Install dependencies:
   ```
   npm install
   ```
2. Set the following in `.env.local`:
   - `GEMINI_API_KEY` — your Gemini API key
   - `GMAIL_APP_PASSWORD` — a Gmail App Password for the account used to send alert emails (requires 2-Step Verification enabled on that Google account)
3. Run the app:
   ```
   npm run dev
   ```

## Live app

View the deployed app: *[add your Cloud Run URL here]*

Edit/iterate in AI Studio: https://ai.studio/apps/e7696e93-2db9-4dba-baf8-00033c7bc5b1
