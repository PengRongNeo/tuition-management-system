import { initializeApp, getApps, getApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

// Web SDK config is read from Vite env vars (must be prefixed with VITE_).
// Copy .env.example to .env.local in frontend/ and fill these in from your
// Firebase console → Project settings → "Your apps" → Web app.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
}

const missing = Object.entries(firebaseConfig)
  .filter(([, v]) => !v)
  .map(([k]) => k)

if (missing.length > 0) {
  // eslint-disable-next-line no-console
  console.warn(
    `[firebase] Missing Firebase web config: ${missing.join(
      ', '
    )}. Set VITE_FIREBASE_* vars in frontend/.env.local and restart \`npm run dev\`.`
  )
}

export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig)
export const auth = getAuth(firebaseApp)
export const db = getFirestore(firebaseApp)
