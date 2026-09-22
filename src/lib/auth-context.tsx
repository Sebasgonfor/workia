"use client";

import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import {
  User,
  EmailAuthProvider,
  createUserWithEmailAndPassword,
  linkWithCredential,
  onAuthStateChanged,
  reauthenticateWithPopup,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  updatePassword,
  updateProfile,
} from "firebase/auth";
import { FirebaseError } from "firebase/app";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { auth, db, googleProvider } from "@/lib/firebase";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  /** True when the account can sign in with email + password. */
  hasPassword: boolean;
  /** True when the account is linked to a Google identity. */
  hasGoogle: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (name: string, email: string, password: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  /** Adds a password to the current account (linking it to its email), or
   *  changes it if the account already has one. */
  setAccountPassword: (password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  hasPassword: false,
  hasGoogle: false,
  signInWithGoogle: async () => {},
  signInWithEmail: async () => {},
  signUpWithEmail: async () => {},
  resetPassword: async () => {},
  setAccountPassword: async () => {},
  signOut: async () => {},
});

async function ensureUserDoc(user: User) {
  const userRef = doc(db, "users", user.uid);
  const userSnap = await getDoc(userRef);
  if (userSnap.exists()) return;
  await setDoc(userRef, {
    displayName: user.displayName,
    email: user.email,
    photoURL: user.photoURL,
    subjects: [],
    settings: {
      timezone: "America/Bogota",
      notifyAt: "20:00",
    },
    createdAt: serverTimestamp(),
  });
}

/** Maps Firebase Auth error codes to messages a student can act on. */
export function authErrorMessage(error: unknown): string {
  const code = error instanceof FirebaseError ? error.code : "";
  switch (code) {
    case "auth/invalid-email":
      return "El correo no es válido.";
    case "auth/missing-password":
      return "Escribe tu contraseña.";
    case "auth/weak-password":
      return "La contraseña debe tener al menos 6 caracteres.";
    case "auth/email-already-in-use":
      return "Ya existe una cuenta con este correo. Si la creaste con Google, entra con Google y crea tu contraseña en Perfil.";
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Correo o contraseña incorrectos. Si te registraste con Google, entra con Google y crea una contraseña desde Perfil.";
    case "auth/too-many-requests":
      return "Demasiados intentos. Espera unos minutos e inténtalo de nuevo.";
    case "auth/network-request-failed":
      return "Sin conexión. Revisa tu internet.";
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return "Se cerró la ventana de Google antes de terminar.";
    case "auth/popup-blocked":
      return "El navegador bloqueó la ventana de Google. Permite las ventanas emergentes.";
    case "auth/credential-already-in-use":
    case "auth/provider-already-linked":
      return "Esta cuenta ya tiene una contraseña vinculada.";
    case "auth/requires-recent-login":
      return "Por seguridad, vuelve a iniciar sesión e inténtalo de nuevo.";
    case "auth/user-mismatch":
      return "Elegiste una cuenta de Google distinta a la de tu sesión.";
    case "auth/operation-not-allowed":
      return "El acceso con correo no está habilitado todavía.";
    default:
      return "Algo salió mal. Inténtalo de nuevo.";
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  // linkWithCredential/updateProfile mutate the same User object, so bump a
  // counter to re-render consumers after them.
  const [, setRevision] = useState(0);
  const refresh = () => setRevision((r) => r + 1);
  // During email sign-up the profile name is set right after the account is
  // created; skip the listener's sync so it doesn't write a nameless doc.
  const signingUpRef = useRef(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);

      // Sync user to Firestore in the background (don't block auth state)
      if (user && !signingUpRef.current) {
        ensureUserDoc(user).catch((error) => {
          console.error("Error syncing user to Firestore:", error);
        });
      }
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Error signing in:", error);
      throw error;
    }
  };

  const signInWithEmail = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email.trim(), password);
  };

  const signUpWithEmail = async (name: string, email: string, password: string) => {
    signingUpRef.current = true;
    try {
      const { user } = await createUserWithEmailAndPassword(auth, email.trim(), password);
      if (name.trim()) await updateProfile(user, { displayName: name.trim() });
      await ensureUserDoc(user);
      refresh();
      // A verified email keeps the password if the same Gmail later signs in
      // with Google (otherwise Firebase lets Google take over the account).
      sendEmailVerification(user).catch((error) => {
        console.error("Error sending verification email:", error);
      });
    } finally {
      signingUpRef.current = false;
    }
  };

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email.trim());
  };

  const setAccountPassword = async (password: string) => {
    const current = auth.currentUser;
    if (!current?.email) throw new Error("No hay una sesión con correo.");

    const apply = async () => {
      if (current.providerData.some((p) => p.providerId === "password")) {
        await updatePassword(current, password);
      } else {
        await linkWithCredential(current, EmailAuthProvider.credential(current.email!, password));
      }
    };

    try {
      await apply();
    } catch (error) {
      // Linking/changing a password needs a fresh login. Google users can
      // re-confirm with the popup and we retry once.
      const canReauthWithGoogle = current.providerData.some((p) => p.providerId === "google.com");
      if (
        error instanceof FirebaseError &&
        error.code === "auth/requires-recent-login" &&
        canReauthWithGoogle
      ) {
        await reauthenticateWithPopup(current, googleProvider);
        await apply();
      } else {
        throw error;
      }
    }
    await current.reload();
    refresh();
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  const providers = user?.providerData.map((p) => p.providerId) ?? [];

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        hasPassword: providers.includes("password"),
        hasGoogle: providers.includes("google.com"),
        signInWithGoogle,
        signInWithEmail,
        signUpWithEmail,
        resetPassword,
        setAccountPassword,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
