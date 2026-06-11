# Balance Studio

A full-stack expense splitting app — track shared bills, simplify debts, and settle up with friends. Built as a Splitwise-style clone with a modern UI and AI-powered features.

![CI](https://github.com/mananghonia/localrepo/actions/workflows/ci.yml/badge.svg)

---

## Features

- **Auth** — Email + OTP signup, login, Google SSO, JWT refresh, forgot/reset password
- **Friends** — Send invites, accept/reject, view per-friend balance breakdown
- **Expenses** — Add expenses, split evenly or custom amounts, delete
- **Debt simplification** — Greedy algorithm minimises the number of payments needed to settle a group
- **Settle up** — Record settlements between friends, balances update instantly
- **Activity feed** — Full history of expenses and settlements with relative timestamps
- **Notifications** — In-app notification tray + email alerts for new expenses and settlements
- **Receipt scanner** — Photo a receipt and Claude Vision auto-fills the expense name and total
- **AI assistant** — Chat with an AI that knows your balances and recent expenses
- **Analytics** — Spending breakdown charts

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite 7, React Router |
| Backend | Django 5.2, Django REST Framework |
| Database | MongoDB Atlas via MongoEngine |
| Auth | JWT (SimpleJWT), Google OAuth 2.0 |
| AI | Anthropic Claude (Haiku) — receipt scan + chat |
| Email | SMTP via Gmail / Resend |
| WebSockets | Django Channels + Redis |
| Deployment | Railway (backend) · Vercel (frontend) |
| CI | GitHub Actions |

---

## Local Setup

### Prerequisites
- Python 3.11+
- Node 20+
- MongoDB (local or Atlas URI)

### Backend

```bash
cd backend
python -m venv venv
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

pip install -r requirements.txt
cp .env.example .env   # fill in your values
python manage.py runserver
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env.local   # fill in your values
npm run dev
```

App runs at `http://localhost:5173`, API at `http://localhost:8000`.

---

## Environment Variables

### Backend (`.env`)

| Variable | Description |
|---|---|
| `SECRET_KEY` | Django secret key |
| `DEBUG` | `True` for local dev |
| `MONGODB_URI` | MongoDB connection string |
| `MONGODB_DB_NAME` | Database name (default: `splitwise`) |
| `GOOGLE_CLIENT_ID` | Google OAuth web client ID |
| `ANTHROPIC_API_KEY` | Anthropic API key for receipt scanner + AI chat |
| `EMAIL_HOST_USER` | Gmail address for sending emails |
| `EMAIL_HOST_PASSWORD` | Gmail app password |
| `FRONTEND_BASE_URL` | Frontend URL for reset-password links |
| `REDIS_URL` | Redis URL (required for WebSockets in production) |

### Frontend (`.env.local`)

| Variable | Description |
|---|---|
| `VITE_API_BASE_URL` | Backend URL (e.g. `https://your-app.railway.app`) |
| `VITE_GOOGLE_CLIENT_ID` | Same Google client ID as backend |

---

## Running Tests

```bash
# Backend — 41 tests
cd backend
python -m pytest

# Frontend — 56 tests
cd frontend
npm run test:run
```

Tests cover: debt simplification algorithm, API validation, service utilities, utility functions, and React components. CI runs both suites on every push via GitHub Actions.

---

## Project Structure

```
├── backend/
│   ├── ai/              # AI chat endpoint (Claude)
│   ├── expenses/        # Expense CRUD, debt simplification, receipt scan
│   ├── realtime/        # WebSocket consumers (Django Channels)
│   ├── users/           # Auth, friends, notifications, settlements
│   └── backend/         # Django settings, URLs, ASGI config
└── frontend/
    ├── src/
    │   ├── components/  # Shared UI components
    │   ├── pages/       # Route-level page components
    │   ├── services/    # API client modules
    │   └── utils/       # Pure utility functions (tested)
    └── src/__tests__/   # Vitest + React Testing Library tests
```

---

## Deployment

- **Backend** deployed on [Railway](https://railway.app) — connects to MongoDB Atlas, Redis (Upstash), and serves the Django ASGI app via Uvicorn.
- **Frontend** deployed on [Vercel](https://vercel.com) — static build served with SPA rewrites.
