# Splitwise-style Expense Manager

This project aims to deliver a Splitwise-like experience with invitations, shared expense tracking, secure authentication, and payment integrations. The backend is built with Django REST Framework, MongoDB (via MongoEngine), JWT auth, and Google sign-in support. A React/Vite frontend lives in `frontend/` with ready-made login, signup, Google SSO, and a dashboard shell.

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

## Next

- Build group, expense, and payment flows.
- Add invitation + notification system.
- Harden security (rate limits, HTTPS, secret rotation).

