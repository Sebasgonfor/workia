import crypto from "crypto";
import { adminDb } from "@/lib/firebase-admin";

/**
 * BYOK de Gemini: cada usuario puede guardar su propia API key, cifrada
 * en reposo, para que sus llamadas (texto, visión, voz) corran contra su
 * propia cuota en vez de la del servidor.
 *
 * Server-only: este módulo usa `firebase-admin` y una clave de cifrado
 * de servidor. No importarlo desde código de cliente.
 */

const ALGO = "aes-256-gcm";
const COLLECTION = (userId: string) => `users/${userId}/secrets`;
const DOC_ID = "gemini";

interface StoredSecret {
  ciphertext: string;
  iv: string;
  authTag: string;
  createdAt: string;
  lastValidatedAt: string;
}

function encryptionKey(): Buffer {
  const raw = process.env.SECRETS_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "Falta SECRETS_ENCRYPTION_KEY en el entorno. Genera una con " +
        "`openssl rand -hex 32` y añádela a .env.local."
    );
  }
  const key = Buffer.from(raw, "hex");
  if (key.length !== 32) {
    throw new Error("SECRETS_ENCRYPTION_KEY debe ser un hex de 32 bytes (64 caracteres)");
  }
  return key;
}

function encrypt(plaintext: string): Omit<StoredSecret, "createdAt" | "lastValidatedAt"> {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
  };
}

function decrypt(secret: StoredSecret): string {
  const decipher = crypto.createDecipheriv(
    ALGO,
    encryptionKey(),
    Buffer.from(secret.iv, "base64")
  );
  decipher.setAuthTag(Buffer.from(secret.authTag, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(secret.ciphertext, "base64")),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}

/** Devuelve la key en claro, o `null` si el usuario no tiene una guardada. */
export async function getUserGeminiKey(userId: string): Promise<string | null> {
  const doc = await adminDb().collection(COLLECTION(userId)).doc(DOC_ID).get();
  if (!doc.exists) return null;
  try {
    return decrypt(doc.data() as StoredSecret);
  } catch {
    // Clave de cifrado rotada o dato corrupto: mejor tratarlo como "no hay key"
    // que reventar la llamada de IA del usuario.
    return null;
  }
}

/** Cifra y guarda (sobreescribe) la key del usuario. */
export async function saveUserGeminiKey(userId: string, apiKey: string): Promise<void> {
  const now = new Date().toISOString();
  const secret: StoredSecret = {
    ...encrypt(apiKey),
    createdAt: now,
    lastValidatedAt: now,
  };
  await adminDb().collection(COLLECTION(userId)).doc(DOC_ID).set(secret);
}

export async function deleteUserGeminiKey(userId: string): Promise<void> {
  await adminDb().collection(COLLECTION(userId)).doc(DOC_ID).delete();
}

export interface UserKeyStatus {
  hasKey: boolean;
  lastValidatedAt?: string;
}

export async function getUserKeyStatus(userId: string): Promise<UserKeyStatus> {
  const doc = await adminDb().collection(COLLECTION(userId)).doc(DOC_ID).get();
  if (!doc.exists) return { hasKey: false };
  const data = doc.data() as StoredSecret;
  return { hasKey: true, lastValidatedAt: data.lastValidatedAt };
}
