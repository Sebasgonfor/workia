# Plan de implementación: BYOK de Gemini + Tutor de Voz

> Spec de referencia: [`specs/08-voice-agent-byok.md`](./specs/08-voice-agent-byok.md)
> Este doc trackea el avance paso a paso para no perder el hilo entre sesiones.

## Estado: 🔲 No iniciado

---

## Fase 1 — BYOK: guardar la key del usuario

- [ ] Confirmar si ya existe inicialización de Firebase Admin en el repo;
      si no, crear `src/lib/firebase-admin.ts`.
- [ ] Añadir `SECRETS_ENCRYPTION_KEY` a `.env.local` (documentar en README
      qué es y cómo generarla: `openssl rand -hex 32`).
- [ ] Crear `src/lib/ai/user-key.ts` con `getUserGeminiKey`,
      `saveUserGeminiKey`, `deleteUserGeminiKey` (AES-256-GCM).
- [ ] Crear `src/app/api/ai/user-key/route.ts` (`GET` / `POST` / `DELETE`),
      con validación real contra Gemini antes de guardar.
- [ ] Probar manualmente: guardar key válida, guardar key inválida (debe
      rechazar con 400), borrar, GET refleja estado correcto.

## Fase 2 — BYOK: usar la key del usuario en las llamadas existentes

- [ ] Extender `buildProvider` en `src/lib/ai/index.ts` para aceptar
      `userApiKey` y no cachear proveedores por-usuario en el `Map` global.
- [ ] Propagar `opts.userId` por `generateText` / `generateJSON` /
      `streamText` → `resolveProvider`.
- [ ] Actualizar las rutas API que ya conocen al usuario autenticado
      (quiz/generate, flashcards/generate, transcribe, etc.) para pasar
      `userId`.
- [ ] `GET /api/ai/config` añade `byok: { hasKey }` a la respuesta.
- [ ] Verificar que sin key de usuario todo sigue funcionando igual que
      hoy (fallback a `GOOGLE_AI_API_KEY` del servidor, sin regresiones).

## Fase 3 — BYOK: UI

- [ ] Bloque "Tu propia API key de Gemini" en `ai-model-picker.tsx` (o
      sección nueva en `perfil/page.tsx`, definir cuál según layout actual
      de Perfil).
- [ ] Input + guardar + estado "✓ Conectada" + botón quitar.
- [ ] Toggle "usar mi key" persistido en la cookie `workia_ai_models`
      existente (`useOwnKey`).
- [ ] Actualizar nota de Gemini en `src/lib/ai/catalog.ts`.
- [ ] Probar flujo completo end-to-end desde la UI.

**Checkpoint:** con Fases 1-3 cerradas, BYOK de Gemini funciona para todo
el uso de texto/visión existente. Es un punto natural para pausar/entregar
antes de meterse con voz.

---

## Fase 4 — Voz: ephemeral tokens

- [ ] Crear `src/app/api/ai/live-token/route.ts`: valida que el usuario
      tenga key propia (403 si no), genera ephemeral token vía
      `ai.authTokens.create`, lo devuelve con expiración.
- [ ] Probar que el token generado sirve para abrir una sesión Live desde
      un script/cliente de prueba simple.

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
