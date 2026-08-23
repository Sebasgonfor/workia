import { initializeApp, getApps } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Sin config, Firebase revienta con "auth/invalid-api-key", que no dice qué hacer.
const missing = Object.entries(firebaseConfig)
  .filter(([, value]) => !value)
  .map(([key]) => `NEXT_PUBLIC_FIREBASE_${key.replace(/[A-Z]/g, (c) => `_${c}`).toUpperCase()}`);

if (missing.length > 0) {
  throw new Error(
    `Falta configurar Firebase. Añade estas variables en .env.local y reinicia el servidor:\n` +
      missing.map((v) => `  · ${v}`).join("\n") +
      `\n\nLas encuentras en console.firebase.google.com → tu proyecto → ` +
      `Configuración del proyecto (⚙️) → Tus apps → Configuración del SDK.`
  );
}

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

// Request Google Calendar access in addition to the default profile/email scopes
googleProvider.addScope("https://www.googleapis.com/auth/calendar.events");
// Prompt account selection so a fresh token is always returned
googleProvider.setCustomParameters({ prompt: "consent", access_type: "online" });
