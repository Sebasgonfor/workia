import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

/**
 * Solo para rutas de servidor que necesitan verificar identidad (ID tokens)
 * o leer/escribir datos que no deben pasar por las reglas del cliente
 * (p.ej. secretos). El resto de la app sigue usando el SDK cliente de
 * `firebase.ts` contra Firestore con sus reglas normales.
 *
 * Requiere credenciales de una service account en tres env vars separadas
 * (evita tener que versionar o inyectar un JSON completo):
 *   FIREBASE_ADMIN_PROJECT_ID
 *   FIREBASE_ADMIN_CLIENT_EMAIL
 *   FIREBASE_ADMIN_PRIVATE_KEY   (con \n literales, se reemplazan abajo)
 */
function buildAdminApp(): App {
  if (getApps().length > 0) return getApps()[0];

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Falta configurar Firebase Admin. Añade en .env.local:\n" +
        "  · FIREBASE_ADMIN_PROJECT_ID\n" +
        "  · FIREBASE_ADMIN_CLIENT_EMAIL\n" +
        "  · FIREBASE_ADMIN_PRIVATE_KEY\n\n" +
        "Se generan en console.firebase.google.com → Configuración del " +
        "proyecto → Cuentas de servicio → Generar nueva clave privada."
    );
  }

  return initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
}

let app: App | null = null;
function getAdminApp(): App {
  if (!app) app = buildAdminApp();
  return app;
}

/** Verifica el ID token del header `Authorization: Bearer <token>` y devuelve el uid. */
export async function requireUserId(req: Request): Promise<string> {
  const authHeader = req.headers.get("authorization") || "";
  const match = authHeader.match(/^Bearer (.+)$/);
  if (!match) throw new AuthError("Falta el token de autenticación");

  try {
    const decoded = await getAuth(getAdminApp()).verifyIdToken(match[1]);
    return decoded.uid;
  } catch {
    throw new AuthError("Token de autenticación inválido o expirado");
  }
}

export class AuthError extends Error {}

/** Como `requireUserId`, pero devuelve `undefined` en vez de lanzar. Para
 * rutas donde la identidad es opcional (p.ej. mostrar el estado de BYOK). */
export async function optionalUserId(req: Request): Promise<string | undefined> {
  try {
    return await requireUserId(req);
  } catch {
    return undefined;
  }
}

export function adminDb() {
  return getFirestore(getAdminApp());
}
