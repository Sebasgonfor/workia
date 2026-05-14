# 📚 Workia

> Tu asistente académico inteligente. Escanea tu cuaderno, enriquece tus apuntes con IA, y domina tus materias con flashcards, quizzes y simulacros de parcial.

[![Next.js](https://img.shields.io/badge/Next.js-14.2-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-18.3-61DAFB?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind](https://img.shields.io/badge/Tailwind-3.4-38B2AC?logo=tailwindcss)](https://tailwindcss.com/)
[![Firebase](https://img.shields.io/badge/Firebase-11-FFCA28?logo=firebase)](https://firebase.google.com/)
[![Gemini](https://img.shields.io/badge/Gemini-2.0_Flash-4285F4?logo=google)](https://ai.google.dev/)

---

## ✨ Qué es Workia

Workia es una **PWA mobile-first** (con soporte desktop) que convierte cualquier apunte escaneado en un sistema completo de estudio. Toma una foto a tu cuaderno y la IA hace el resto: extrae el contenido, lo enriquece, genera flashcards, te pone a prueba con quizzes adaptativos, y mide tu dominio real con técnicas pedagógicas como **Feynman** y **diálogo Socrático**.

No es otra app de notas. Es un sistema de **estudio activo** integrado de extremo a extremo.

---

## 🚀 Funcionalidades

### 📸 Captura y digitalización
- **Escanear cuaderno** — Detección automática de bordes, corrección de perspectiva, OCR.
- **Digitalizar** — Genera PDFs limpios de apuntes manuscritos.
- **Importar documentos** — PDF, imágenes, audio (transcripción automática).

### 🧠 Inteligencia sobre tus apuntes
- **Tablero dinámico** — Enriquece automáticamente con definiciones, ejemplos, fórmulas (KaTeX) y conexiones entre conceptos.
- **Mind maps** — Mapas mentales generados desde tus notas.
- **Diagramas** — Mermaid charts auto-generados.
- **Chat sobre tus notas** — Pregúntale lo que sea al contenido de cada clase.

### 🎯 Estudio activo
- **Flashcards con SM-2/FSRS** — Repaso espaciado científicamente probado.
- **Quizzes generados con IA** — Auto-generados desde tus apuntes, con dificultad progresiva.
- **Modo Feynman** — La IA esconde tus apuntes, te pide explicar el concepto, y compara tu explicación contra el original. Detecta lo correcto, lo que faltó, lo errado.
- **Tutor Socrático** — Conversación guiada por preguntas para construir comprensión.
- **Kit de estudio one-click** — Resumen + flashcards + quiz + conceptos clave en una sola pasada.

### 📊 Métricas de dominio
- **Dashboard de Dominio** — Mastery por materia agregando datos de flashcards (ease factor), quizzes, sesiones Feynman y Socrático.
- **Knowledge Graph** — Visualización canvas force-directed de cómo conectan tus conceptos entre materias.
- **Gap Detection** — La IA detecta huecos en tu conocimiento antes de un examen.

### 📝 Preparación de parciales
- **Guía de estudio PDF** — Exportable con `jspdf`.
- **Simulacro de parcial** — Examen completo con scoring automático.

### 📅 Organización académica
- **Tareas** — Extraídas automáticamente al escanear.
- **Calendario** — Vista semanal con slots de horario.
- **Horario** — Sincronización con Google Calendar.
- **Notificaciones inteligentes** — Avisos antes de cada entrega.
- **Análisis de notas** — Carga tus calificaciones, la IA analiza tendencias.

---

## 🏗️ Stack

| Capa | Tecnología |
|------|------------|
| Framework | Next.js 14 (App Router) + React 18 |
| Lenguaje | TypeScript 5.7 |
| Estilos | Tailwind CSS + `tailwindcss-animate` + `class-variance-authority` |
| Auth & DB | Firebase Auth (Google) + Firestore |
| IA | Google Gemini 2.0 Flash (`@google/generative-ai`) |
| Markdown / Math | `react-markdown` + `remark-math` + `rehype-katex` |
| Iconos | `lucide-react` |
| PWA | `next-pwa` |
| PDF | `jspdf` |
| Imágenes | `sharp` + Cloudinary |
| Toasts | `sonner` |

---

## 📁 Estructura

```
src/
├── app/
│   ├── api/                    # Routes Gemini, upload, scan, transcribe
│   │   ├── digitalize/         # Detección bordes + OCR
│   │   ├── dynamic-board/      # Enriquecimiento IA del tablero
│   │   ├── exam-guide/         # Guía y simulacro de parcial
│   │   ├── feynman/            # Extract + evaluate de Feynman
│   │   ├── flashcards/         # Generador de flashcards
│   │   ├── gaps/               # Detección de huecos
│   │   ├── knowledge-graph/    # Extract de grafo de conocimiento
│   │   ├── mind-map/           # Generador mind maps
│   │   ├── quiz/               # Quiz generator + progressive
│   │   ├── socratic/           # Tutor socrático
│   │   └── study-kit/          # Kit one-click
│   ├── inicio/                 # Dashboard
│   ├── materias/[id]/[classId] # Vista de clase (tablero dinámico)
│   ├── tareas/                 # Tareas
│   ├── notas/                  # Notas / calificaciones
│   ├── flashcards/             # Repaso espaciado
│   ├── quiz/                   # Quizzes
│   ├── dominio/                # Mastery dashboard
│   ├── parcial/                # Prep examen
│   ├── calendario/             # Calendar semanal
│   ├── horario/                # Schedule
│   ├── digitalizar/            # Notebook → PDF
│   └── escanear/               # Captura cámara
├── components/
│   ├── study/                  # Feynman, Socrático, Kit, Gap detector
│   ├── analytics/              # Knowledge graph
│   └── ui/                     # Sheet, markdown-math, mermaid-chart
└── lib/
    ├── hooks/                  # 20+ hooks Firestore (useSubjects, useFlashcards, ...)
    ├── services/               # Gemini, content-cleaner
    └── firebase.ts             # Init + Google provider con scope Calendar
```

---

## ⚡ Setup

### Requisitos
- Node.js 20+
- Cuenta Firebase (Auth + Firestore)
- API key de Google Gemini
- (Opcional) Cuenta Cloudinary para uploads

### Instalación

```bash
git clone <repo>
cd workia
npm install
```

### Variables de entorno

Crea `.env.local` en la raíz:

```bash
# Firebase
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# Gemini
GOOGLE_AI_API_KEY=

# Cloudinary (opcional)
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

### Comandos

```bash
npm run dev      # Dev server en http://localhost:3000
npm run build    # Build producción
npm run start    # Producción
npm run lint     # ESLint
```

---

## 🎨 Diseño

- **Mobile-first**: contenedor 512px (`max-w-lg`) con bottom-nav de 5+5 tabs.
- **Responsive** (en progreso — ver `PLAN.md`): sidebar lateral en `md+`, modales tipo dialog centrado, grids expandidos.
- **Theming**: dark/light con anti-FOUC script en `<head>`. Persiste en `localStorage`.
- **PWA**: instalable, manifest configurado, status bar translúcido en iOS.
- **Accesibilidad**: `touch-target` mínimo, `pb-safe` para áreas seguras de iOS.

---

## 🤖 Cómo trabaja la IA

Toda la inteligencia corre vía **Gemini 2.0 Flash** desde routes en `src/app/api/`. Patrones clave:

1. **JSON estructurado** — `getFlashJsonModel()` fuerza `responseMimeType: application/json` para outputs parseables.
2. **Context-aware** — Las llamadas reciben el contenido de la clase + nombre de materia + documentos de referencia.
3. **Pipelines compuestos** — El Kit de Estudio hace una sola llamada que genera resumen + flashcards + quiz + conceptos.
4. **Validación + filtros** — `content-cleaner.ts` sanitiza outputs antes de persistir.

---

## 🗺️ Roadmap

Specs detalladas en `specs/`:

- ✅ `01` Restructure
- ✅ `02` Feynman Mode
- ✅ `03` Socratic Tutor
- ✅ `04` Mastery Dashboard
- ✅ `05` Study Kit pipeline
- ✅ `06` Knowledge Graph
- ✅ `07` Gap Detection
- 🚧 Desktop/Tablet responsive (ver `PLAN.md`)

---

## 📄 Licencia

Proyecto personal. Todos los derechos reservados.

---

<p align="center">
  Hecho con ☕ para estudiantes que quieren <strong>dominar</strong>, no solo aprobar.
</p>
