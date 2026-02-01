# Deploying the Backend

Your backend is a Node.js Express app that uses Firebase Admin. You can deploy it to **Railway** or **Render** (both have free tiers and work well with Node). Use **one** of the options below.

---

## Before you deploy

You will set **environment variables** on the host instead of using `backend/.env`. Do **not** upload `serviceAccountKey.json` to the host; use the env vars below.

### Required env vars

| Variable | Where to get it |
|----------|-----------------|
| `FIREBASE_PROJECT_ID` | From `serviceAccountKey.json` → `project_id` |
| `FIREBASE_CLIENT_EMAIL` | From `serviceAccountKey.json` → `client_email` |
| `FIREBASE_PRIVATE_KEY` | From `serviceAccountKey.json` → `private_key`. **Important:** paste the whole key as one line, with real newlines replaced by `\n` (e.g. `"-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----\n"`). |
| `FIREBASE_WEB_API_KEY` | Firebase Console → Project Settings → General → Web API Key (for login) |
| `FRONTEND_ORIGIN` | URL of your frontend (e.g. `https://your-app.vercel.app` or `http://localhost:3000` for local dev) |
| `FORM_SUBMIT_SECRET` | Same secret you use in the Google Form Apps Script (optional; only if you use the form) |

The host will set `PORT` for you; you usually don’t need to set it.

---

## Option 1: Railway

1. **Sign up:** [railway.app](https://railway.app) (GitHub login is fine).

2. **New project:**  
   **New Project** → **Deploy from GitHub repo** → choose `tuition-management-system` and allow access.

3. **Configure the service:**
   - After the repo is connected, click the new **service**.
   - **Settings** → **Root Directory**: set to `backend` (so Railway builds and runs from the `backend` folder).
   - **Settings** → **Build Command**: leave default or set to `npm install`.
   - **Settings** → **Start Command**: `npm start` (default).
   - **Settings** → **Watch Paths**: leave default so pushes to the repo trigger deploys.

4. **Environment variables:**  
   In the service, open **Variables** and add:

   - `FIREBASE_PROJECT_ID` = your project id  
   - `FIREBASE_CLIENT_EMAIL` = your client email  
   - `FIREBASE_PRIVATE_KEY` = full private key with `\n` for newlines (keep the quotes)  
   - `FIREBASE_WEB_API_KEY` = your web API key  
   - `FRONTEND_ORIGIN` = your frontend URL (e.g. `https://your-app.vercel.app`)  
   - `FORM_SUBMIT_SECRET` = same value as in your Google Form script (if you use it)

5. **Deploy:**  
   Railway will build and deploy. When it’s done, open **Settings** → **Networking** → **Generate Domain** to get a URL like `https://your-service.up.railway.app`.

6. **Use this URL:**
   - In your **frontend** (e.g. `frontend/.env` or build env): set the API base URL to this Railway URL (e.g. `VITE_API_URL=https://your-service.up.railway.app` if your frontend uses that).
   - In **Google Form Apps Script**: set `BACKEND_BASE_URL = 'https://your-service.up.railway.app'`.

---

## Option 2: Render

1. **Sign up:** [render.com](https://render.com) (GitHub login is fine).

2. **New Web Service:**  
   **Dashboard** → **New** → **Web Service** → connect the `tuition-management-system` repo.

3. **Configure:**
   - **Name:** e.g. `tuition-management-backend`
   - **Region:** choose one
   - **Branch:** `main` (or your default)
   - **Root Directory:** `backend`
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** Free (or paid if you prefer)

4. **Environment variables:**  
   In the same screen, **Environment** → **Add Environment Variable**, and add the same variables as in the Railway section above:

   - `FIREBASE_PROJECT_ID`  
   - `FIREBASE_CLIENT_EMAIL`  
   - `FIREBASE_PRIVATE_KEY`  
   - `FIREBASE_WEB_API_KEY`  
   - `FRONTEND_ORIGIN`  
   - `FORM_SUBMIT_SECRET` (optional)

5. **Create Web Service:**  
   Render will build and deploy. The URL will be like `https://tuition-management-backend.onrender.com`.

6. **Use this URL:**
   - In your **frontend**: set the API base URL to this Render URL.
   - In **Google Form Apps Script**: set `BACKEND_BASE_URL = 'https://tuition-management-backend.onrender.com'`.

**Note:** On the free tier, the service may spin down after inactivity; the first request after that can be slow (cold start).

---

## After deployment

1. **Test the API:**  
   Open `https://your-backend-url/api/public/teachers` in a browser (or use curl). You should get JSON (e.g. a list of teachers or `[]`), not an HTML error page.

2. **Frontend:**  
   Point your frontend’s API base URL to the deployed backend URL. If the frontend is also deployed (e.g. Vercel/Netlify), set `FRONTEND_ORIGIN` on the backend to that frontend URL so CORS works.

3. **Google Form:**  
   In Apps Script, set `BACKEND_BASE_URL` to your deployed backend URL (no trailing slash). Form submissions will then create students in Firebase.

---

## Private key format (FIREBASE_PRIVATE_KEY)

Your `serviceAccountKey.json` has a `private_key` field with multiple lines. For env vars you must turn it into **one string** with newlines as `\n`:

- **Wrong:** pasting the key with real line breaks (often breaks parsing).
- **Right:** one line, with `\n` where the line breaks were, and wrapped in double quotes.

Example format (value only):

```text
"-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBg...(many chars)...\n-----END PRIVATE KEY-----\n"
```

Railway and Render both accept this in the variable value. If you get “invalid private key” from Firebase, fix the newlines and quotes.

---

## Troubleshooting

- **“Missing Firebase Admin config”**  
  Ensure `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, and `FIREBASE_PRIVATE_KEY` are all set and that the private key uses `\n` and is in quotes.

- **CORS errors in the browser**  
  Set `FRONTEND_ORIGIN` on the backend to the exact origin of your frontend (scheme + host + port if needed), e.g. `https://your-app.vercel.app`.

- **Google Form still fails**  
  Use the **deployed** backend URL in Apps Script, not `localhost`. Double-check `FORM_SUBMIT_SECRET` matches between backend and script.
