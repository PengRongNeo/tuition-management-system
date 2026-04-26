# Tuition Management System

A web-based management system for tuition centres. The app is split into **frontend** (Vue.js) and **backend** (Node.js + Express + Firebase Admin) so that **Firebase credentials stay on the server** and are never exposed to the browser.

## Project structure

- **`frontend/`** – Vue 3 + Vite app. Talks only to your backend API (no Firebase SDK in the client).
- **`backend/`** – Express server using Firebase Admin SDK for Firestore and Auth. Holds all Firebase config and API keys.

## Features

- Admin login (email/password via backend; Firebase API key not exposed)
- Classes, teachers, students CRUD
- Enrolments, lessons, attendance
- Dashboard with revenue and chart
- Public lesson submission (teachers submit without logging in)

## Prerequisites

- Node.js (v16+)
- A Firebase project with Firestore and Authentication (Email/Password) enabled

## Setup

### 1. Backend

```bash
cd backend
npm install
```

Create a `.env` file (see `backend/.env.example`):

- **Option A – Service account file**  
  Download a service account JSON from [Firebase Console](https://console.firebase.google.com/) → Project Settings → Service Accounts → Generate new private key. Save as `backend/serviceAccountKey.json` and set:
  ```env
  GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json
  ```

- **Option B – Env vars**  
  Set `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, and `FIREBASE_PRIVATE_KEY` (private key as a single line with `\n` for newlines).

Then set:

- `FIREBASE_WEB_API_KEY` – From Firebase Console → Project Settings → General → Web API Key (used for admin login).
- `PORT` – e.g. `4000`.
- `FRONTEND_ORIGIN` – e.g. `http://localhost:3000` (for CORS).

Start the backend:

```bash
npm run dev
```

Runs at `http://localhost:4000` by default.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Runs at `http://localhost:3000` and proxies `/api` to the backend.

### 3. Production

- Build frontend: `cd frontend && npm run build`.
- Serve the built files (e.g. from the same host as the API or a static host).
- Set `VITE_API_BASE_URL` when building if the API is on a different origin
  (e.g. `https://tms-api.vercel.app`). The older `VITE_API_URL` is still
  accepted as a fallback.

## Deploying to Vercel (two separate projects)

This repo is configured for two Vercel projects sharing the same GitHub repo —
one for the frontend and one for the backend.

### Backend project

1. Vercel → **Add New Project** → import this repo.
2. **Root Directory**: `backend`.
3. **Framework Preset**: *Other*. No build command — the included
   `backend/vercel.json` and `backend/api/index.js` take care of routing every
   request to the Express app.
4. **Environment Variables** (Production + Preview):
   - `FIREBASE_PROJECT_ID`
   - `FIREBASE_CLIENT_EMAIL`
   - `FIREBASE_PRIVATE_KEY` — paste the whole key including the
     `-----BEGIN/END PRIVATE KEY-----` lines; Vercel preserves newlines.
   - `FIREBASE_WEB_API_KEY`
   - `FRONTEND_ORIGIN` — comma-separated list, e.g.
     `https://tms.vercel.app,http://localhost:3000`.
   - `FORM_SUBMIT_SECRET` *(optional)* — Google Form shared secret.
5. Deploy. Sanity-check `https://<backend>.vercel.app/api/health` — you should see `"ok": true` and `build.publicLessonMissed: true` (if that flag is missing, the deployment is an old build; redeploy from current `main`).

### Frontend project

1. Vercel → **Add New Project** → import the same repo.
2. **Root Directory**: `frontend`.
3. **Framework Preset**: *Vite*. `frontend/vercel.json` enforces the build
   command, output directory (`dist`), and SPA fallback for Vue Router.
4. **Environment Variables**:
   - `VITE_API_BASE_URL` = `https://<backend>.vercel.app`
   - `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`,
     `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`,
     `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`.
5. Deploy. After the first successful deploy, copy the frontend URL back into
   the backend's `FRONTEND_ORIGIN` env var so CORS lets it through, then
   redeploy the backend.

### Notes

- If a public form shows **"Cannot POST /api/public/…"**: the request reached Express but that route is not in the **deployed** server bundle. **Redeploy the backend** project (root `backend/`) with the current code, then confirm `GET /api/health` includes `publicLessonMissed: true` on the URL you set in the frontend’s `VITE_API_BASE_URL`.

- `backend/serviceAccountKey.json` is ignored during Vercel deploys
  (`backend/.vercelignore`). On Vercel you must use the env-var form of the
  Firebase credentials (Option B).
- Local development is unchanged: run the backend with `npm run dev` (it
  still calls `app.listen` when invoked directly) and the frontend with
  `npm run dev` (Vite proxies `/api` to `http://localhost:4000`).
- The Google Form → pending students flow, student/class/lesson APIs,
  attendance editing, Fees This Month popup, and WhatsApp `wa.me` deep links
  all continue to work unchanged — none of them hit endpoints unique to a
  long-running server.

## Security

- Firebase **API key** and **service account** (or private key) are only in the backend env/files.
- The frontend only has the backend base URL (or uses the dev proxy). No Firebase config in the client.
- Admin routes require a valid Firebase ID token (obtained via backend login and sent as `Authorization: Bearer <token>`).
