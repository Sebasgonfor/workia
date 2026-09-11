# Plan de implementación: BYOK de Gemini + Tutor de Voz

> Spec de referencia: [`specs/08-voice-agent-byok.md`](./specs/08-voice-agent-byok.md)
> Este doc trackea el avance paso a paso para no perder el hilo entre sesiones.

## Estado: 🚧 En progreso — Fases 1-3 hechas (BYOK base lista), sigue Fase 4 (voz)

---

## Fase 1 — BYOK: guardar la key del usuario ✅

- [x] Confirmar si ya existe inicialización de Firebase Admin en el repo;
      si no, crear `src/lib/firebase-admin.ts`. → No existía, se creó.
      Verifica identidad vía ID token (`Authorization: Bearer`), no había
      ningún patrón de auth server-side en el repo (todo corría por
      Firestore rules + SDK cliente); es nuevo para este spec.
- [x] Añadir `SECRETS_ENCRYPTION_KEY` a `.env.local` (documentado en README,
      cómo generarla: `openssl rand -hex 32`).
- [x] Crear `src/lib/ai/user-key.ts` con `getUserGeminiKey`,
      `saveUserGeminiKey`, `deleteUserGeminiKey` (AES-256-GCM).
- [x] Crear `src/app/api/ai/user-key/route.ts` (`GET` / `POST` / `DELETE`),
      con validación real contra Gemini antes de guardar.
- [ ] Probar manualmente: guardar key válida, guardar key inválida (debe
      rechazar con 400), borrar, GET refleja estado correcto.
      **Pendiente**: requiere credenciales reales de Firebase Admin
      (service account) que no existen en este entorno — no se puede
      probar end-to-end sin ellas. El typecheck (`tsc --noEmit`) pasa limpio.

## Fase 2 — BYOK: usar la key del usuario en las llamadas existentes ✅ (patrón listo, falta rollout)

- [x] Extender `buildProvider` en `src/lib/ai/index.ts` para aceptar
      `userApiKey` — nunca se cachea en el `Map` global (comentario en el
      código explica por qué: sería fuga de credenciales entre usuarios).
- [x] Propagar `opts.userId` por `generateText` / `generateJSON` /
      `streamText` → `resolveProvider` (ahora async).
- [x] `useOwnKey` añadido a `AiSelection`/`catalog.ts` — BYOK es opt-in
      por usuario, no automático solo por tener key guardada.
- [x] `describeConfig()` y `/api/ai/health` actualizados a async.
- [x] `GET /api/ai/config` añade `byok: { hasKey }` a la respuesta, vía
      `optionalUserId` (no rompe si no hay sesión).
- [x] `POST /api/ai/config` ya no exige `GOOGLE_AI_API_KEY` de servidor
      cuando `useOwnKey: true` y el proveedor es gemini.
- [x] Creado `src/lib/ai/client-auth-header.ts` — helper de cliente para
      mandar `Authorization: Bearer <idToken>` en los fetch.
- [x] **Un caso de referencia end-to-end**: `api/ai/quiz/generate` +
      su call site en `materias/[id]/[classId]/page.tsx` ya pasan
      `userId`/`authHeader()`. Sirve de plantilla para el resto.
- [ ] **Pendiente — rollout al resto de rutas**: el mismo patrón (2 líneas:
      `optionalUserId(req)` en la ruta + `authHeader()` en el fetch del
      cliente) falta aplicarlo a las demás rutas que llaman a
      `generateText`/`generateJSON`/`streamText`: flashcards/generate,
      transcribe, digitalize (+ detect), scan, task-solver, notes-chat,
      feynman, socratic, study-kit, gaps/detect, quiz/progressive,
      connections, diagrams, mind-map, knowledge-graph. No se tocaron
      todas en este paso para no mezclar un cambio mecánico grande con el
      resto del trabajo — es la primera tarea a retomar si se sigue esta
      fase.
- [x] Verificado con `tsc --noEmit` (limpio) que sin key de usuario nada
      se rompe — el flujo cae al comportamiento de siempre.

## Fase 3 — BYOK: UI ✅

- [x] Bloque "Tu propia API key de Gemini" — se agregó dentro de
      `ai-model-picker.tsx` (que ya vive en Perfil) como `GeminiByokPanel`,
      en vez de crear un componente/sección separada.
- [x] Input + guardar + estado "✓ Key conectada" + botón quitar.
- [x] Toggle "usar mi key en vez de la del servidor", persistido en la
      cookie `workia_ai_models` existente (`useOwnKey`), junto con el
      resto de la selección (mismo botón "Guardar" de siempre).
- [x] Actualizar nota de Gemini en `src/lib/ai/catalog.ts`.
- [ ] Probar flujo completo end-to-end desde la UI. **Pendiente**: no se
      pudo levantar `npm run dev` con Firebase/Firestore reales en este
      entorno (sin credenciales) — verificado solo con `tsc --noEmit`
      (limpio). Falta que lo pruebes tú con tus credenciales reales:
      1. Entra a Perfil, pega una key de aistudio.google.com/apikey.
      2. Debe validar contra Gemini antes de guardar (prueba también con
         una key inválida — debe rechazar con mensaje claro).
      3. Activa el toggle "usar mi key" y guarda.
      4. Genera un quiz (único flujo con BYOK conectado hasta ahora, ver
         pendiente de Fase 2) y confirma que corre con tu key, no la del
         servidor (puedes verificarlo revisando el uso en
         aistudio.google.com con tu cuenta).

**Checkpoint:** con Fases 1-3 hechas (con los pendientes anotados arriba:
rollout a más rutas + prueba manual con credenciales reales), BYOK de
Gemini tiene la base funcionando. Es un punto natural para pausar/entregar
antes de meterse con voz.

---

## Fase 4 — Voz: ephemeral tokens ✅ (implementado, no probado end-to-end)

- [x] Crear `src/app/api/ai/live-token/route.ts`: valida que el usuario
      tenga key propia (403 si no), genera ephemeral token vía
      `ai.authTokens.create({ config: { uses, expireTime,
      newSessionExpireTime } })` — nota: va anidado en `config`, no en el
      top-level (así lo exige el tipo `CreateAuthTokenParameters` del SDK
      `@google/genai@2.18.0`). Requiere `httpOptions: { apiVersion:
      "v1alpha" }` en el cliente que crea el token — es donde vive esta
      feature en el SDK actual (marcada `@experimental`).
- [ ] Probar que el token generado sirve para abrir una sesión Live desde
      un script/cliente de prueba simple. **Pendiente**: no se pudo probar
      sin una key real de Gemini con acceso a Live API — verificado solo
      por tipos (`tsc --noEmit` limpio) y lectura de la definición del SDK.
      Riesgo real a validar cuando haya credenciales: que el modelo/token
      efectivamente abra una sesión Live (la API es `@experimental`, puede
      tener comportamiento distinto al documentado en el `.d.ts`).

## Fase 5 — Voz: wrapper del SDK

- [ ] Crear `src/lib/ai/live/gemini-live.ts` con `connectLiveSession`
      (conexión WS, envío de audio, recepción de audio/transcript/turno).
- [ ] Confirmar en la doc vigente del SDK: nombre del modelo Live actual,
      sample rate exacto de input/output, formato de mensajes de
      interrupción (barge-in).

## Fase 6 — Voz: componente de UI

- [ ] `src/components/voice-agent.tsx`: captura de mic vía
      `AudioWorkletNode`, cola de reproducción con `AudioContext`,
      máquina de estados (idle/connecting/listening/thinking/speaking/error).
- [ ] Manejo de barge-in.
- [ ] CTA de "conecta tu key" cuando `byok.hasKey === false`.
- [ ] Reconexión automática si expira el ephemeral token a mitad de sesión.

## Fase 7 — Voz: integración en la app

- [ ] Crear `src/app/voz/page.tsx`.
- [ ] Decidir y agregar entrada de navegación (`bottom-nav.tsx` /
      `sidebar-nav.tsx`) o acceso como modal desde una clase/materia.
- [ ] Pasar contexto de materia como `systemInstruction` cuando se abre
      desde `materias/[id]/[classId]`.

## Fase 8 — Pulido

- [ ] Mapeo de errores de conexión Live/WS a mensajes legibles (toast).
- [ ] Revisar costos reales con uso de prueba (confirmar que corre contra
      la key del usuario, no la del servidor).
- [ ] Actualizar `README.md` con instrucciones de BYOK + tutor de voz.

---

## Decisiones abiertas (a resolver antes o durante la implementación)
1. ¿El tutor de voz vive en su propia pestaña de nav, o como modal dentro
   de cada materia/clase? (afecta Fase 7)
2. ¿Se permite fallback a la key del servidor para voz en algún caso (ej.
   trial limitado), o es estrictamente BYOK-only como dice el spec?
3. ¿Dónde en Perfil va el bloque de BYOK? (revisar layout actual de
   `perfil/page.tsx` antes de la Fase 3)
