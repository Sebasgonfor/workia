"use client";

import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Brain,
  CalendarDays,
  Camera,
  Check,
  FileText,
  GraduationCap,
  KeyRound,
  Layers,
  LineChart,
  MessageCircle,
  MonitorSmartphone,
  Moon,
  ScanLine,
  Sparkles,
  Sun,
  Target,
} from "lucide-react";
import { Sheet } from "@/components/ui/sheet";
import { useTheme } from "@/lib/theme-context";
import { useLandingAnimations } from "@/components/landing/use-landing-animations";
import { FeatureCarousel } from "@/components/landing/feature-carousel";
import { WorkiaMark } from "@/components/workia-mark";
import { CanvaIcon, FileKindIcon, MATERIAL_FORMATS } from "@/components/file-kind-icon";
import { AutoHeight } from "@/components/ui/auto-height";
import { AuthPanel, AuthMode, GoogleIcon } from "@/components/auth/auth-panel";

const STEPS = [
  {
    icon: Camera,
    title: "Escanea tu cuaderno",
    desc: "Toma una foto a tus apuntes, sube un PDF o graba la clase. Workia detecta los bordes, corrige la perspectiva y extrae el texto.",
  },
  {
    icon: Sparkles,
    title: "La IA los enriquece",
    desc: "Tus notas se organizan por materia y clase, con definiciones, ejemplos, fórmulas y conexiones entre conceptos.",
  },
  {
    icon: Target,
    title: "Estudia activamente",
    desc: "Repasa con flashcards, ponte a prueba con quizzes y simulacros, y mide cuánto dominas cada tema antes del parcial.",
  },
];

const FEATURES = [
  {
    icon: ScanLine,
    tone: "wk-c-violet",
    title: "Escanear y digitalizar",
    desc: "Convierte hojas de cuaderno en PDFs limpios y texto que puedes buscar.",
  },
  {
    icon: Sparkles,
    tone: "wk-c-indigo",
    title: "Tablero dinámico",
    desc: "Apuntes enriquecidos con IA, fórmulas en KaTeX, mapas mentales y diagramas.",
  },
  {
    icon: Layers,
    tone: "wk-c-emerald",
    title: "Flashcards inteligentes",
    desc: "Generadas desde tus notas y con repaso espaciado para que no se te olvide nada.",
  },
  {
    icon: FileText,
    tone: "wk-c-amber",
    title: "Quizzes y simulacros",
    desc: "Preguntas con dificultad progresiva y exámenes completos con calificación automática.",
  },
  {
    icon: Brain,
    tone: "wk-c-rose",
    title: "Modo Feynman y tutor socrático",
    desc: "Explica un tema con tus palabras y la IA te dice qué acertaste, qué faltó y qué está mal.",
  },
  {
    icon: MessageCircle,
    tone: "wk-c-sky",
    title: "Chat con tus apuntes",
    desc: "Pregúntale lo que quieras al contenido de cada clase y resuelve tareas paso a paso.",
  },
  {
    icon: CalendarDays,
    tone: "wk-c-stone",
    title: "Tareas, horario y recordatorios",
    desc: "Las tareas se extraen al escanear y te avisamos antes de cada entrega.",
  },
  {
    icon: LineChart,
    tone: "wk-c-violet",
    title: "Métricas de dominio",
    desc: "Mira tu progreso por materia, tu mapa de conocimiento y los huecos a reforzar.",
  },
];

const FAQS = [
  {
    q: "¿Qué es Workia?",
    a: "Es un asistente académico con inteligencia artificial. Digitaliza tus apuntes, los organiza por materia y clase, y los convierte en herramientas de estudio activo: flashcards, quizzes, simulacros de parcial y sesiones guiadas con la IA.",
  },
  {
    q: "¿En qué dispositivos funciona?",
    a: "En cualquier navegador del celular o del computador. Además puedes instalarla como app desde el navegador (“Agregar a pantalla de inicio”) para abrirla como cualquier otra aplicación.",
  },
  {
    q: "Me registré con Google, ¿cómo entro desde otro dispositivo sin poner mi cuenta de Google?",
    a: "Entra una vez con Google, ve a Perfil → “Acceso con correo” y crea una contraseña. Desde ese momento puedes entrar en cualquier dispositivo con tu correo y esa contraseña, y sigues viendo exactamente los mismos apuntes, materias y tareas.",
  },
  {
    q: "¿Puedo registrarme solo con correo?",
    a: "Sí. Toca “Crear cuenta”, escribe tu nombre, correo y una contraseña. Te enviaremos un correo para verificar tu cuenta.",
  },
  {
    q: "¿Mis apuntes son privados?",
    a: "Sí. Todo queda asociado a tu cuenta y solo tú puedes verlo cuando inicias sesión.",
  },
];

export default function Home() {
  const { user, loading } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();
  const [authMode, setAuthMode] = useState<AuthMode | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  useLandingAnimations(rootRef, !loading && !user);

  useEffect(() => {
    if (user && !loading) {
      router.replace("/inicio");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (user) return null;

  const openAuth = (mode: AuthMode) => setAuthMode(mode);

  return (
    <div ref={rootRef} className="wk-landing">
      {/* ── Nav ───────────────────────────────────────────── */}
      <header data-anim="nav" className="wkl-nav pt-safe-bar">
        <div className="wkl-container flex items-center justify-between h-14">
          <a href="#" className="flex items-center gap-2 font-semibold text-[17px]">
            <WorkiaMark className="w-7 h-7" />
            Workia
          </a>
          <nav className="hidden md:flex items-center gap-7 text-sm wkl-muted">
            <a href="#como-funciona" className="hover:text-[var(--wk-ink)]">Cómo funciona</a>
            <a href="#funciones" className="hover:text-[var(--wk-ink)]">Funciones</a>
            <a href="#dispositivos" className="hover:text-[var(--wk-ink)]">Multi-dispositivo</a>
            <a href="#preguntas" className="hover:text-[var(--wk-ink)]">Preguntas</a>
          </nav>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              aria-label={theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
              title={theme === "dark" ? "Modo claro" : "Modo oscuro"}
              className="wkl-btn-ghost wkl-btn-icon"
            >
              {theme === "dark" ? <Sun className="w-[18px] h-[18px]" /> : <Moon className="w-[18px] h-[18px]" />}
            </button>
            <button onClick={() => openAuth("login")} className="wkl-btn-ghost">
              Entrar
            </button>
            <button onClick={() => openAuth("signup")} className="wkl-btn-primary hidden sm:inline-flex">
              Crear cuenta
            </button>
          </div>
        </div>
      </header>

      {/* ── Hero ──────────────────────────────────────────── */}
      <section className="wkl-hero">
        <div className="wkl-container grid gap-12 md:grid-cols-[1.1fr_1fr] md:items-center">
          <div>
            <span data-anim="hero-item" className="wkl-eyebrow">
              <GraduationCap className="w-3.5 h-3.5" />
              Tu asistente académico con IA
            </span>
            <h1 data-anim="hero-title" className="wkl-h1">
              Tus apuntes, convertidos en <em>dominio real</em>.
            </h1>
            <p data-anim="hero-item" className="wkl-lead">
              Toma una foto a tu cuaderno y Workia lo digitaliza, lo enriquece con inteligencia
              artificial y lo transforma en flashcards, quizzes y simulacros de parcial. Todo tu
              semestre, organizado en un solo lugar.
            </p>
            <div data-anim="hero-item" className="flex flex-col sm:flex-row gap-3 mt-8">
              <button onClick={() => openAuth("signup")} className="wkl-btn-primary wkl-btn-lg">
                Empezar ahora
                <ArrowRight className="w-4 h-4" />
              </button>
              <button onClick={() => openAuth("login")} className="wkl-btn-outline wkl-btn-lg">
                Ya tengo cuenta
              </button>
            </div>
            <ul data-anim="hero-item" className="flex flex-wrap gap-x-5 gap-y-2 mt-6 text-[13px] wkl-muted">
              {["Celular y computador", "Se instala como app", "Entra con Google o correo"].map((t) => (
                <li key={t} className="flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-[var(--wk-emerald)]" />
                  {t}
                </li>
              ))}
            </ul>
          </div>

          {/* Product preview */}
          <div data-anim="preview" className="wkl-preview" aria-hidden>
            <div className="wkl-card wkl-card-note">
              <div className="flex items-center justify-between mb-3">
                <span className="wkl-chip wk-c-violet">Cálculo II · Clase 12</span>
                <ScanLine className="w-4 h-4 wkl-muted" />
              </div>
              <p className="wkl-serif text-[22px] leading-tight mb-2">Integración por partes</p>
              <p className="wkl-mono text-[13px] mb-3">∫ u dv = uv − ∫ v du</p>
              <div className="space-y-1.5">
                <div className="wkl-line w-[92%]" />
                <div className="wkl-line w-[78%]" />
                <div className="wkl-line w-[85%]" />
              </div>
              <div className="wkl-ai-note">
                <Sparkles className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>Tip IA: elige como <b>u</b> la función que se simplifica al derivar (regla LIATE).</span>
              </div>
            </div>

            <div className="wkl-card wkl-card-flash">
              <span className="wkl-chip wk-c-emerald">Flashcard</span>
              <p className="text-[14px] font-medium mt-3">¿Cuándo conviene integrar por partes?</p>
              <div className="flex gap-1.5 mt-3">
                {["Otra vez", "Difícil", "Bien", "Fácil"].map((l, i) => (
                  <span key={l} className={`wkl-pill ${i === 2 ? "wkl-pill-on" : ""}`}>{l}</span>
                ))}
              </div>
            </div>

            <div className="wkl-card wkl-card-mastery">
              <div className="flex items-center justify-between">
                <span className="text-[12px] wkl-muted">Dominio · Cálculo II</span>
                <span data-anim="pct" className="text-[13px] font-semibold">78%</span>
              </div>
              <div className="wkl-bar mt-2">
                <div data-anim="bar" style={{ width: "78%" }} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Cómo funciona ─────────────────────────────────── */}
      <section id="como-funciona" className="wkl-section">
        <div className="wkl-container">
          <p data-anim="reveal" className="wkl-kicker">Cómo funciona</p>
          <h2 data-anim="reveal" className="wkl-h2">De la hoja de cuaderno al examen, en tres pasos.</h2>
          <div data-anim="stagger" className="grid gap-4 md:grid-cols-3 mt-10">
            {STEPS.map((step, i) => (
              <div key={step.title} className="wkl-step">
                <div className="flex items-center justify-between mb-5">
                  <span className="wkl-step-icon">
                    <step.icon className="w-5 h-5" />
                  </span>
                  <span className="wkl-mono text-[12px] wkl-muted">0{i + 1}</span>
                </div>
                <h3 className="font-semibold text-[17px] mb-2">{step.title}</h3>
                <p className="text-[14px] leading-relaxed wkl-muted">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Funciones ─────────────────────────────────────── */}
      <section id="funciones" className="wkl-section wkl-section-sunk">
        <div className="wkl-container">
          <p data-anim="reveal" className="wkl-kicker">Funciones</p>
          <h2 data-anim="reveal" className="wkl-h2">No es otra app de notas. Es un sistema de estudio activo.</h2>
          <p data-anim="reveal" className="wkl-lead max-w-2xl">
            Leer y subrayar da la sensación de aprender. Workia te hace recordar, explicar y
            practicar, que es lo que realmente fija el conocimiento.
          </p>
          <div data-anim="reveal" className="mt-10">
            <FeatureCarousel features={FEATURES} />
          </div>
          <div
            data-anim="reveal"
            className="mt-10 rounded-2xl border border-[var(--wk-line)] bg-[var(--wk-bg-elev)] p-5"
          >
            <div className="max-w-2xl">
              <h3 className="font-semibold text-[var(--wk-ink)]">Sube el material de tu clase</h3>
              <p className="mt-1 text-sm text-[var(--wk-ink-3)]">
                ¿Clase virtual o con guía? Suma la transcripción, la guía o las diapositivas y la IA
                reconstruye la clase completa.
              </p>
            </div>
            <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {MATERIAL_FORMATS.map((f) => (
                <li key={f.kind} className="flex items-center gap-2 rounded-xl border border-[var(--wk-line)] px-3 py-2">
                  <FileKindIcon kind={f.kind} />
                  <div className="min-w-0">
                    <p className="text-xs font-medium leading-tight text-[var(--wk-ink)]">{f.ext}</p>
                    <p className="truncate text-[11px] leading-tight text-[var(--wk-ink-3)]">{f.app}</p>
                  </div>
                </li>
              ))}
              <li className="col-span-2 flex items-center gap-2 rounded-xl border border-[var(--wk-line)] px-3 py-2 sm:col-span-1">
                <CanvaIcon />
                <div className="min-w-0">
                  <p className="text-xs font-medium leading-tight text-[var(--wk-ink)]">Canva</p>
                  <p className="text-[11px] leading-tight text-[var(--wk-ink-3)]">Exporta a PDF o PPTX</p>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* ── Multi-dispositivo ─────────────────────────────── */}
      <section id="dispositivos" className="wkl-section">
        <div className="wkl-container grid gap-10 md:grid-cols-2 md:items-center">
          <div>
            <p data-anim="reveal" className="wkl-kicker">Tu cuenta, en cualquier lugar</p>
            <h2 data-anim="reveal" className="wkl-h2">Entra desde cualquier dispositivo, sin tener que usar tu Google en él.</h2>
            <p data-anim="reveal" className="wkl-lead">
              ¿En el computador de la biblioteca o en el celular de alguien más? Si te registraste
              con Google, crea una contraseña en tu perfil y quedará vinculada a la misma cuenta.
              Luego entra solo con tu correo y esa contraseña.
            </p>
          </div>
          <ol data-anim="stagger" className="space-y-3">
            {[
              { icon: GoogleIcon, title: "Entra con Google", desc: "En tu dispositivo de siempre, como lo haces hoy." },
              { icon: KeyRound, title: "Crea tu contraseña", desc: "Ve a Perfil → Acceso con correo y elige una contraseña." },
              { icon: MonitorSmartphone, title: "Úsala donde quieras", desc: "En otro dispositivo, toca Entrar y usa tu correo y contraseña." },
            ].map((s, i) => (
              <li key={s.title} className="wkl-link-step">
                <span className="wkl-link-num">{i + 1}</span>
                <div className="flex-1">
                  <p className="font-semibold text-[15px]">{s.title}</p>
                  <p className="text-[13.5px] wkl-muted">{s.desc}</p>
                </div>
                <s.icon className="w-5 h-5 wkl-muted shrink-0" />
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── Preguntas ─────────────────────────────────────── */}
      <section id="preguntas" className="wkl-section wkl-section-sunk">
        <div className="wkl-container max-w-3xl">
          <p data-anim="reveal" className="wkl-kicker">Preguntas frecuentes</p>
          <h2 data-anim="reveal" className="wkl-h2">Lo que suelen preguntar.</h2>
          <div data-anim="stagger" className="mt-8 space-y-2">
            {FAQS.map((f) => (
              <details key={f.q} className="wkl-faq">
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA final ─────────────────────────────────────── */}
      <section className="wkl-section">
        <div className="wkl-container">
          <div data-anim="cta" className="wkl-cta">
            <h2 className="wkl-h2 !mb-3">
              Empieza este semestre con <em>otra</em> forma de estudiar.
            </h2>
            <p className="opacity-80 max-w-xl mx-auto">
              Crea tu cuenta en segundos con Google o con tu correo.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center mt-7">
              <button onClick={() => openAuth("signup")} className="wkl-btn-invert wkl-btn-lg">
                Crear mi cuenta
                <ArrowRight className="w-4 h-4" />
              </button>
              <button onClick={() => openAuth("login")} className="wkl-btn-invert-ghost wkl-btn-lg">
                Iniciar sesión
              </button>
            </div>
          </div>
        </div>
      </section>

      <footer className="wkl-container py-8 pb-safe flex flex-col sm:flex-row items-center justify-between gap-2 text-[13px] wkl-muted">
        <span className="flex items-center gap-2">
          <WorkiaMark className="w-4 h-4" /> Workia — Tu asistente académico inteligente
        </span>
        <span>© {new Date().getFullYear()} Workia</span>
      </footer>

      <Sheet
        open={authMode !== null}
        onClose={() => setAuthMode(null)}
        title={
          authMode === "signup"
            ? "Crea tu cuenta"
            : authMode === "reset"
              ? "Recuperar contraseña"
              : "Hola de nuevo"
        }
        centerTitle
      >
        {authMode && (
          <AutoHeight>
            <AuthPanel mode={authMode} onModeChange={setAuthMode} />
          </AutoHeight>
        )}
      </Sheet>
    </div>
  );
}
