# Plan de implementación: BYOK de Gemini + Tutor de Voz

> Spec de referencia: [`specs/08-voice-agent-byok.md`](./specs/08-voice-agent-byok.md)
> Este doc trackea el avance paso a paso para no perder el hilo entre sesiones.

## Estado: 🚧 Implementación completa (Fases 1-8), sin probar con credenciales reales

Todo el código de este spec está escrito y pasa `tsc --noEmit` limpio,
pero **nada se probó en ejecución real** — este entorno no tenía
credenciales de Firebase Admin, Firestore, ni una key de Gemini con
acceso a Live API. Ver "Antes de dar esto por terminado" al final del
documento antes de considerarlo listo para producción.

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

## Fase 5 — Voz: wrapper del SDK ✅ (implementado, no probado)

- [x] Crear `src/lib/ai/live/gemini-live.ts` con `connectLiveSession`
      (conexión WS vía `ai.live.connect`, `sendRealtimeInput` para audio,
      `sendClientContent` para texto, callbacks de audio/transcript/turno/
      interrupción).
- [ ] Confirmar en la doc vigente del SDK: nombre del modelo Live actual
      (usé `gemini-2.5-flash-native-audio-preview-09-2025`, **verificar
      que sigue existiendo** — Google retira modelos Live seguido), sample
      rate exacto de input/output (usé 16kHz in / 24kHz out, estándar de
      Gemini Live pero no verificado contra una sesión real), formato de
      mensajes de interrupción (mapeado desde `serverContent.interrupted`,
      sin confirmar contra tráfico real).
      **Pendiente de validar con credenciales reales.**

## Fase 6 — Voz: componente de UI ✅ (implementado, no probado)

- [x] `src/components/voice-agent.tsx`: captura de mic vía
      `AudioWorkletNode` (worklet en `public/audio/pcm-recorder-worklet.js`,
      convierte Float32→PCM16 en el hilo de audio), cola de reproducción
      con `AudioContext` (scheduling por `currentTime`, sin cortes entre
      chunks), máquina de estados
      (idle/connecting/listening/speaking/error).
- [x] Manejo de barge-in: al recibir `onInterrupted`, vacía el playhead de
      reproducción y vuelve a "listening".
- [x] CTA de "conecta tu key" cuando el usuario no tiene BYOK — antes de
      mostrar el botón de mic.
- [ ] Reconexión automática si expira el ephemeral token a mitad de
      sesión — **no implementado**. Hoy si el token expira, la sesión
      simplemente falla (`onError`) y el usuario tiene que tocar de nuevo
      el botón (que sí pide un token nuevo). Es una mejora de UX, no un
      bloqueante funcional, pendiente si se nota molesto en uso real.
- [ ] **Nada de esto se probó en un navegador real** (sin key de Gemini
      con Live API ni micrófono en este entorno) — solo compila
      (`tsc --noEmit` limpio). Antes de dar por buena la Fase 6 hay que
      probarlo manualmente: permiso de mic, latencia real, calidad de
      audio, y sobre todo si `audioWorklet.addModule` carga bien el
      archivo estático servido desde `public/`.

## Fase 7 — Voz: integración en la app ✅ (parcial)

- [x] Crear `src/app/voz/page.tsx`.
- [x] Entrada de navegación: tab "Voz" en `bottom-nav.tsx` (dentro de
      "más") y "Tutor de voz" en `sidebar.tsx` (desktop). Se optó por
      pestaña propia en vez de modal por clase/materia — más simple de
      cablear y consistente con cómo viven Quiz/Dominio/Parcial hoy.
- [ ] Contexto de materia como `systemInstruction` al abrir desde
      `materias/[id]/[classId]` — **no implementado**. Hoy `VozPage` usa
      un `systemInstruction` genérico de "tutor universitario". Pendiente
      si se quiere version contextual (pasar `?subject=` por query param
      y ajustar el prompt, o abrir como modal con esa clase precargada).

## Fase 8 — Pulido ✅ (lo que se podía cerrar sin credenciales reales)

- [x] Mapeo de errores de conexión Live/WS a mensajes legibles (toast) —
      ya cubierto en `voice-agent.tsx` (`onError` → `setErrorMsg` + toast)
      y en las rutas (`live-token`, `user-key` devuelven mensajes claros).
- [ ] Revisar costos reales con uso de prueba — **no se pudo hacer sin
      credenciales**. Cuando pruebes con tu cuenta real: confirma en
      aistudio.google.com que el consumo aparece bajo TU key (BYOK) y no
      bajo `GOOGLE_AI_API_KEY` del servidor.
- [x] Actualizar `README.md` con instrucciones de BYOK + tutor de voz
      (sección "Cómo trabaja la IA" + roadmap).

---

## Decisiones tomadas durante la implementación
1. Tutor de voz en su propia pestaña (`/voz`), no modal por materia —
   más simple, consistente con Quiz/Dominio/Parcial.
2. **BYOK-only** para voz, sin fallback a la key del servidor — así lo
   pide el spec, se mantuvo tal cual (403 explícito si no hay key propia).
3. Bloque de BYOK dentro de `AiModelPicker` (que ya vive en Perfil), no un
   componente/sección aparte — menos que mantener, mismo lugar donde el
   usuario ya configura IA.

## ⚠️ Antes de dar esto por terminado (requiere credenciales reales)

Nada de lo implementado se ejecutó de verdad en este entorno. Antes de
mergear/desplegar a producción, con credenciales reales:

1. **Config de servidor**: crear la service account de Firebase Admin,
   poner `FIREBASE_ADMIN_*` y `SECRETS_ENCRYPTION_KEY` en `.env.local` (o
   el entorno de despliegue).
2. **BYOK end-to-end**: guardar una key real desde Perfil, confirmar que
   rechaza keys inválidas, generar un quiz y verificar en
   aistudio.google.com que el consumo aparece bajo esa key.
3. **Voz end-to-end**: con esa misma key, abrir `/voz`, dar permiso de
   mic, confirmar que conecta, que se escucha al tutor, que el barge-in
   corta la reproducción, y que el modelo (`DEFAULT_LIVE_MODEL` en
   `gemini-live.ts`) sigue existiendo — si Google lo retiró, ajustar ahí.
4. **Rollout pendiente de Fase 2**: aplicar `optionalUserId` +
   `authHeader()` al resto de rutas de IA (ver lista en Fase 2) para que
   BYOK no quede limitado solo a generar quiz.
5. Firestore rules: añadir una regla explícita que **bloquee** el acceso
   de cliente a `users/{userId}/secrets/**` (hoy nadie la lee/escribe
   desde el cliente, pero conviene que las reglas lo digan explícitamente
   en vez de depender de que ningún código cliente la toque).
