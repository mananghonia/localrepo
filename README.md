# Splitwise-style Expense Manager

This project aims to deliver a Splitwise-like experience with invitations, shared expense tracking, secure authentication, and payment integrations. The backend is built with Django REST Framework, MongoDB (via MongoEngine), JWT auth, and Google sign-in support. A React/Vite frontend lives in `frontend/` with ready-made login, signup, Google SSO, dashboard widgets, and the latest balances UI refresh.

## Current Capabilities

- **Authentication & onboarding** – email OTP verification, username/email login, JWT rotation, and Google SSO all wired through DRF + MongoEngine auth classes.
- **Groups, expenses, and payments** – dedicated Django apps (`groups/`, `expenses/`, `payments/`) feed the React dashboards with per-group ledgers and participation data.
- **Friend ledger + settlements** – the Friends page now exposes a detailed breakdown modal that lets users settle an individual group or trigger the new "Settle everything" action to clear all open balances in one tap. Behind the scenes, the ledger service keeps both sides of every friendship in sync (no more stale balances reappearing after a settlement).
- **Email notifications** – signup OTPs, settlement receipts, and new-expense alerts are sent via `splitwise676@gmail.com`, so anyone added to a bill immediately receives the amount they owe.
- **Responsive UI polish** – gradient modal shell, compact close control, and accessibility-minded focus states to keep the experience sharp on both desktop and mobile.

## Getting Started

```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env  # create your secrets file
python manage.py migrate  # Django's built-in tables (sessions/admin)
python manage.py runserver
```

### Environment Variables

Set these (e.g., in `.env` or your shell):

- `SECRET_KEY` – Django secret
- `MONGODB_URI` – defaults to `mongodb://localhost:27017/splitwise`
- `MONGODB_DB_NAME` – defaults to `splitwise`
- `GOOGLE_CLIENT_ID` – Web client ID from Google Cloud console
- `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`, `EMAIL_USE_TLS` – SMTP settings used to deliver signup OTP emails (Gmail app passwords work well for local testing)
- `DEFAULT_FROM_EMAIL` – Friendly from-name shown in verification emails
- `SIGNUP_OTP_EXPIRATION_MINUTES` – Lifetime for each OTP (default `10`)

### MongoDB hookup

1. **Local MongoDB**
	- Install MongoDB Community Server (or run it via Docker).
	- Start the Windows service (`MongoDB`) or run `mongod --dbpath <path>`.
	- Keep the default `MONGODB_URI=mongodb://localhost:27017/splitwise`.

2. **MongoDB Atlas / remote cluster**
	- Create a database user + network rule.
	- Set `MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>/splitwise?retryWrites=true&w=majority`.
	- Optionally change `MONGODB_DB_NAME` to match the database you provisioned.

3. **Verify connectivity**
	```bash
	cd backend
	venv\Scripts\activate
	python manage.py shell -c "from users.models import User; print('users collection ->', User.objects.count())"
	```
	If the number prints without errors, Django successfully connected through MongoEngine.

## Frontend (React + Vite)

```bash
cd frontend
npm install
cp .env.example .env.local  # set VITE_* vars
npm run dev
```

- `VITE_API_BASE_URL` – defaults to `http://localhost:8000`
- `VITE_GOOGLE_CLIENT_ID` – same web client ID used by the backend

The frontend consumes `/api/users/*` endpoints, manages JWTs via `AuthContext`, and protects the dashboard route via React Router.

### Friend balances spotlight

- Open the **Friends** page and select a friend to launch the redesigned breakdown modal.
- Each group entry still supports one-off settlement via `POST /api/users/friends/<id>/settlements/`.
- The new primary action calls `POST /api/users/friends/<id>/settlements/all/`, marks every pending group as settled, and surfaces delivery status inside the modal.
- The hero totals, confirmation copy, and success/error states refresh automatically thanks to the `friendsApi` helpers.

### Email notifications

- Configure SMTP credentials (see **Environment Variables**) for `splitwise676@gmail.com` or your own sender.
- Every participant added to an expense receives an email showing the amount they owe and a link back to Balance Studio.
- Settlement flows still email both parties and now reuse the same sender for consistency.
- Logs in `backend/expenses/views.py` capture SMTP failures so you can monitor delivery during development.

## Auth API

| Endpoint | Method | Description |
| --- | --- | --- |
| `/api/users/request-otp/` | `POST` | Send a one-time code to an email before signup |
| `/api/users/signup/` | `POST` | Email/username/password signup + OTP verification (returns JWT pair) |
| `/api/users/login/` | `POST` | Login with email *or username* + password |
| `/api/users/google/` | `POST` | Google ID-token login for existing accounts (no auto-signup) |

All endpoints return `{ refresh, access, user }`. Default DRF permissions require JWT unless `AllowAny` is set.

### Email OTP verification flow

1. **Request a code** – call `/api/users/request-otp/` with `{ email, name }`. The server sends a six-digit code using your configured SMTP provider.
2. **Complete signup** – POST `/api/users/signup/` with `name`, `username`, `email`, `password`, and the `otp_code` you received. Each code is single-use and expires after `SIGNUP_OTP_EXPIRATION_MINUTES`.
3. **Log in later** – `/api/users/login/` now accepts the same password with either the email address or username, or you can use Google sign-in *after* the email has been registered.

## Roadmap

- Export/shareable statements for each friend ledger (PDF + CSV).
- Scheduled reminders + richer notification center on top of the existing email hooks.
- Hardening: production-ready deployment docs, HTTPS by default, Redis-based rate limiting, and background jobs for large settlement emails.

