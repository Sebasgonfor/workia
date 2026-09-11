# SPEC 08: BYOK de Gemini + Tutor de Voz en Tiempo Real

## Goal
Permitir que cada usuario conecte su propia API key de Gemini (BYOK) y,
apoyándose en ella, ofrecer un tutor conversacional por voz en tiempo real
usando la Gemini Live API. El costo de uso recae en la cuota del usuario,
no en la del servidor.

---

## Parte A — BYOK (API key de Gemini por usuario)

### Almacenamiento: Firestore, cifrado
Colección: `users/{userId}/secrets/gemini`
```typescript
interface UserGeminiSecret {
  ciphertext: string;   // AES-256-GCM
  iv: string;            // base64
  authTag: string;       // base64
  createdAt: string;     // ISO
  lastValidatedAt: string;
}
```
- Cifrado/descifrado con `crypto` nativo de Node, clave de 32 bytes en
  `SECRETS_ENCRYPTION_KEY` (env var nueva, no versionada).
- La key en claro **nunca** se persiste en el cliente ni en logs.

### API Route: `src/app/api/ai/user-key/route.ts`
- `GET` → `{ hasKey: boolean, lastValidatedAt?: string }` (nunca la key).
- `POST` → body `{ apiKey: string }`.
  1. Valida formato básico (`AIza...`, longitud razonable).
  2. Hace un ping real: `ai.models.generateContent` con prompt mínimo.
  3. Si responde OK: cifra y guarda (`set`, no `update`, sobreescribe).
  4. Si falla: `400` con el motivo (`"key inválida o sin cuota"`).
- `DELETE` → borra el doc.

### Helper server-only: `src/lib/ai/user-key.ts`
```typescript
export async function getUserGeminiKey(userId: string): Promise<string | null>;
export async function saveUserGeminiKey(userId: string, apiKey: string): Promise<void>;
export async function deleteUserGeminiKey(userId: string): Promise<void>;
```
Usa Firebase Admin SDK (server-side) — revisar si ya existe inicialización
admin en el repo; si no, añadir `src/lib/firebase-admin.ts` mínimo.

### Cambios en `src/lib/ai/index.ts`
- `buildProvider("gemini", model, userApiKey?)`: si `userApiKey` viene,
  se usa esa key (sin cachear en el `Map` global compartido — cachear por
  `userId` o no cachear proveedores con key de usuario).
- `resolveProvider` y toda la cadena pública (`generateText`, `streamText`,
  `generateJSON`) reciben un `opts.userId` opcional; las rutas API que ya
  conocen al usuario autenticado lo pasan.
- Si no hay key de usuario, cae al `GOOGLE_AI_API_KEY` de servidor
  (comportamiento actual, sin romper nada).

### Cambios en `src/app/api/ai/config/route.ts`
- `GET` añade `byok: { hasKey: boolean }` a la respuesta.
- Selección (`AiSelection`) gana un flag opcional `useOwnKey?: boolean`
  guardado también en la cookie existente `workia_ai_models` (no hace
  falta colección nueva para esto, es solo una preferencia de UI).

### UI: `src/components/ai-model-picker.tsx` (o nueva sección en Perfil)
- Nuevo bloque "Tu propia API key de Gemini":
  - Input tipo password + botón "Guardar" (llama `POST /api/ai/user-key`).
  - Si `hasKey`: muestra estado "✓ Conectada" + botón "Quitar".
  - Link a `https://aistudio.google.com/apikey` (reusar `keyUrl` de
    `catalog.ts`).
  - Toggle "Usar mi key en vez de la del servidor".
- Actualizar la nota de Gemini en `catalog.ts` para mencionar BYOK.

---

## Parte B — Tutor de voz en tiempo real (Gemini Live API)

### Requisito
Solo disponible si el usuario tiene su propia key guardada (Parte A) — el
agente de voz consume cuota de audio, que es cara; no se ofrece contra la
key compartida del servidor.

### Emisión de ephemeral token: `src/app/api/ai/live-token/route.ts`
- `POST`, sin body.
- Lee `userId` de la sesión autenticada.
- Obtiene la key del usuario vía `getUserGeminiKey`. Si no existe → `403`
  con mensaje "agrega tu API key en Perfil".
- Genera un ephemeral token con `ai.authTokens.create(...)` (vida corta,
  ~30 min, uso único) usando la key real del usuario.
- Devuelve `{ token: string, expiresAt: string }`. La key real nunca sale
  del servidor.

### Wrapper: `src/lib/ai/live/gemini-live.ts`
Aísla el SDK `@google/genai` Live API del resto del código, igual que
`providers/gemini.ts` hace con la API normal.
```typescript
export interface LiveSession {
  sendAudioChunk(chunk: ArrayBuffer): void;
  sendText(text: string): void;
  onAudio(cb: (chunk: ArrayBuffer) => void): void;
  onTranscript(cb: (text: string, isFinal: boolean) => void): void;
  onTurnComplete(cb: () => void): void;
  close(): void;
}

export function connectLiveSession(opts: {
  ephemeralToken: string;
  model: string; // default: "gemini-2.5-flash-native-audio-preview" (o el vigente)
  systemInstruction?: string;
}): Promise<LiveSession>;
```
- Conexión WebSocket directa **desde el cliente** hacia Gemini (el token
  efímero ya limita el riesgo de exponerlo en el navegador).
- Formato de audio: PCM 16-bit, 16kHz mono para input; el output que
  regresa Gemini se reproduce tal cual llega (24kHz típico, confirmar con
  doc vigente del SDK al implementar).

### Componente: `src/components/voice-agent.tsx`
- Estados: `idle | connecting | listening | thinking | speaking | error`.
- Captura de mic: `getUserMedia` + `AudioWorkletNode` (procesa a PCM16
  en el hilo de audio, evita bloquear el main thread).
- Reproducción: cola de buffers en `AudioContext`, para no cortar el
  audio si llegan chunks fragmentados.
- Barge-in: si el usuario habla mientras el agente responde, cortar la
  reproducción y avisar al Live session (si el SDK lo soporta vía evento
  de interrupción).
- Botón de mic grande, transcripción en vivo (subtítulos) usando
  `onTranscript`, indicador de conexión.
- Si `byok.hasKey === false`: mostrar CTA "Conecta tu API key de Gemini en
  Perfil para usar el tutor de voz" en vez del botón de mic.

### Página: `src/app/voz/page.tsx`
- Ruta nueva, entrada en `bottom-nav.tsx` / `sidebar-nav.tsx` bajo un tab
  "Voz" (o accesible como modal desde `materias/[id]/[classId]`, a
  decidir según UX final).
- Contexto opcional: si se abre desde una clase/materia, pasa el nombre
  como `systemInstruction` ("Eres un tutor de [materia]...").

### Manejo de errores
- Reusar el patrón de `AiProviderError` (o una variante) para mapear
  errores de conexión Live/WS a mensajes legibles vía `toast`.
- Reconexión automática si el ephemeral token expira a mitad de sesión
  (pedir uno nuevo, reconectar sin perder el estado de UI).

---

## Fuera de alcance de este spec
- Multi-idioma / selección de voz del agente (usar el default de Gemini).
- Historial persistente de conversaciones de voz (podría ir a Firestore
  después, reusando el patrón de `useChatConversations`).
- BYOK para otros proveedores (`groq`, `mistral`, etc.) — este spec cubre
  solo Gemini, que es el único con Live API relevante aquí.
