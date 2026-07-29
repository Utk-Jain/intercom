# Minimal Customer Communication Platform 

A pragmatic, production-ready, minimal customer communication platform.

---

## Tech Stack

* **Frontend**: React, Vite, TailwindCSS, React Router, Native fetch, Native WebSockets.
* **Backend**: Python 3.12, FastAPI, Async SQLAlchemy, SQLite, JWT Authentication, Native FastAPI WebSockets.
* **AI Engine**: Groq API (`llama-3.3-70b-versatile` / `llama3-70b-8192`) for automated conversation summaries.
* **Email Channel**: Gmail IMAP (live 15s background polling for incoming emails) & Gmail SMTP (threaded outbound email replies).
* **Embeddable Widget**: Vanilla JS & CSS widget with live typing indicators, read receipts, online status, and in-input KB auto-suggestions.

---

## Key Features

### 1. Authentication & Team Management
* **Roles**: `Admin` and `Agent`.
* **Signup & Workspace Creation**: Admin registers and creates a workspace; receives JWT token.
* **Invites**: Admin generates invitation tokens (`/team`). Agents sign up via invite link (`/signup?token=...`).
* **Permissions**: Admins invite agents and assign conversations; Agents reply, snooze, and resolve conversations.

### 2. Live Chat Widget with Instant KB Search
* **Embeddable**: `<script src="http://localhost:8000/static/widget.js"></script>`.
* **Single Unified Input**: No separate search tab. As visitors type their question directly into the main chat input box, a **"Suggested Articles"** card pops up dynamically above the input.
* **Interactive Suggestions**: Clicking a suggested article automatically injects the help response into the chat thread.
* **Real-time UX**: Live typing indicators, read receipts (`✓✓`), deduplicated messages, and online status badge.

### 3. Live Email Support (Gmail IMAP & SMTP)
* **Inbound**: Background worker polls Gmail IMAP (`imap.gmail.com`) every 15 seconds for unread customer emails and creates email threads in the Unified Inbox.
* **Outbound**: Agent responses sent from the dashboard use Gmail SMTP (`smtp.gmail.com`) with `In-Reply-To` and `References` headers for native email threading.

### 4. Unified Inbox
* Aggregates both **Chat** and **Email** conversations.
* **Color-Coded Channel Badges**: Vivid `CHAT` (purple) and `EMAIL` (amber) tags on each inbox item for instant visual identification.
* **Filtering & Actions**: Filter by channel (**All / Chat / Email**) and status (**Open / Snoozed / Resolved**). Assign conversations to team members.

### 5. AI Conversation Summarizer (Groq)
* Displays an automated AI summary banner at top of conversation threads.
* 3-bullet breakdown generated via Groq API:
  1. Customer Issue
  2. Attempted Fixes
  3. Current Status

---

## Quickstart & Local Setup

### 1. Backend Setup
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 2. Environment Variables (`backend/.env`)
```env
DATABASE_URL=sqlite+aiosqlite:///./intercom.db
JWT_SECRET=super-secret-key
GROQ_API_KEY=your_groq_api_key
SUPPORT_EMAIL=jainutk619@gmail.com
GMAIL_APP_PASSWORD=your_gmail_app_password
```

### 3. Reset Database & Seed Default KB Articles
To clear all table entries and seed default Knowledge Base articles:
```bash
python seed.py
```

### 4. Run Servers
```bash
# Terminal 1: Backend
uvicorn app:app --reload --port 8000

# Terminal 2: Frontend
cd frontend
npm run dev
```

---

## Testing Verification Flows

1. **Dashboard & Auth Flow**:
   - Open `http://localhost:5173/signup` -> Register an Admin account & workspace.
   - Go to **Team** -> Generate an invitation link -> Sign up an Agent account in a private browser.

2. **Live Chat Widget & KB Auto-Suggestions Flow**:
   - Open `http://localhost:5173/demo`.
   - Type `"payment"` or `"password"` in the chat input.
   - Observe the **Suggested Articles** popup card appearing above the input box.
   - Click a suggested article to auto-inject the solution into the chat window.

3. **Live Email Flow**:
   - Send an email from your Gmail/Outlook to `jainutk619@gmail.com`.
   - Open the Dashboard (`http://localhost:5173/dashboard`) -> Filter by **Email**.
   - Within 15 seconds, the incoming email will appear in the inbox.
   - Type a response and click **Reply** to verify outbound email delivery.
