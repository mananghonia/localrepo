## Splitwise-style Frontend

This Vite + React app powers the client experience for the shared-expense platform. It ships production-ready auth flows (email/password + Google SSO), JWT storage, and a preview dashboard UI that mirrors the future budgeting surface.

### Features

- **Auth journeys** – bespoke onboarding shell with signup, login, Google sign-in, and an OTP step for verifying email ownership.
- **Flexible login** – accepts either the verified email or the username alongside the password.
- **Auth context** – central store for tokens + user profile with persistence in `localStorage`.
- **API client** – typed helpers for `/api/users/signup|login|google` endpoints exposed by the Django backend.
- **Protected routing** – dashboard route is locked until JWTs exist; redirect logic keeps users in the right flow.
- **Intentional design** – gradient background, glassmorphism cards, and animated metrics tailored to the product story.

### Getting Started

```bash
cd frontend
npm install
cp .env.example .env.local  # update values
npm run dev
```

Set these environment variables (Vite reads any `VITE_*` names):

| Key | Purpose |
| --- | --- |
| `VITE_API_BASE_URL` | Defaults to `http://localhost:8000`. Point to your Django server. |
| `VITE_GOOGLE_CLIENT_ID` | OAuth client ID from Google Cloud console for web flows. |

### Available Scripts

- `npm run dev` – start Vite dev server with hot reload.
- `npm run build` – generate a production build (runs automatically in CI/CD).
- `npm run preview` – preview the production bundle locally.

### Folder Guide

- `src/context/AuthContext.jsx` – manages JWT + user, exposes `signup`, `login`, `googleLogin`, `logout` helpers.
- `src/services/authApi.js` – minimal fetch wrapper for `/api/users/{request-otp,signup,login,google}` endpoints exposed by the Django backend.
- `src/pages/*` – login, signup, and dashboard views.
- `src/components/*` – layout shell, inputs, Google button, and route guard.

Hook this UI up to the backend by ensuring Django runs on `localhost:8000`, enabling CORS, and providing matching Google OAuth credentials. Once payments and groups APIs land, extend the dashboard widgets to consume real data.
