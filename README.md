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
- Set `VITE_API_URL` when building if the API is on a different origin (e.g. `https://api.yoursite.com`).

## Security

- Firebase **API key** and **service account** (or private key) are only in the backend env/files.
- The frontend only has the backend base URL (or uses the dev proxy). No Firebase config in the client.
- Admin routes require a valid Firebase ID token (obtained via backend login and sent as `Authorization: Bearer <token>`).
