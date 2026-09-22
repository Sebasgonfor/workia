"use client";

import { FormEvent, useState } from "react";
import { Eye, EyeOff, Loader2, Mail } from "lucide-react";
import { toast } from "sonner";
import { authErrorMessage, useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

export type AuthMode = "login" | "signup" | "reset";

export function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

const inputClass =
  "w-full h-11 px-3.5 rounded-xl bg-background border border-border text-[16px] outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground/60";

/** Sign-in / sign-up / password-reset form: Google or email + password. */
export function AuthPanel({
  mode,
  onModeChange,
}: {
  mode: AuthMode;
  onModeChange: (mode: AuthMode) => void;
}) {
  const { signInWithGoogle, signInWithEmail, signUpWithEmail, resetPassword } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState<"google" | "email" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);

  const switchMode = (next: AuthMode) => {
    setError(null);
    setResetSent(false);
    onModeChange(next);
  };

  const handleGoogle = async () => {
    setError(null);
    setBusy("google");
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy("email");
    try {
      if (mode === "login") {
        await signInWithEmail(email, password);
      } else if (mode === "signup") {
        await signUpWithEmail(name, email, password);
        toast.success("Cuenta creada. Te enviamos un correo para verificarla.");
      } else {
        await resetPassword(email);
        setResetSent(true);
      }
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  if (mode === "reset") {
    return (
      <form onSubmit={handleSubmit} className="space-y-4 pt-2">
        <p className="text-sm text-muted-foreground">
          Escribe el correo de tu cuenta y te enviaremos un enlace para crear una contraseña nueva.
        </p>
        <input
          type="email"
          required
          autoComplete="email"
          placeholder="tu@correo.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
        />
        {resetSent && (
          <p className="text-sm rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-3.5 py-2.5">
            Si existe una cuenta con ese correo, te llegará el enlace en unos minutos. Revisa también spam.
          </p>
        )}
        {error && <p className="text-sm text-destructive animate-in fade-in duration-200">{error}</p>}
        <button
          type="submit"
          disabled={busy !== null}
          className="w-full h-11 rounded-xl bg-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-60 active:scale-[0.98] transition-transform"
        >
          {busy === "email" && <Loader2 className="w-4 h-4 animate-spin" />}
          Enviar enlace
        </button>
        <button
          type="button"
          onClick={() => switchMode("login")}
          className="w-full text-sm text-muted-foreground hover:text-foreground"
        >
          Volver a iniciar sesión
        </button>
      </form>
    );
  }

  const isSignup = mode === "signup";

  return (
    <div className="space-y-4 pt-2">
      {/* Login / Signup tabs */}
      <div className="relative grid grid-cols-2 p-1 rounded-xl bg-secondary text-sm font-medium">
        {/* Active tab background slides between the two options. */}
        <span
          aria-hidden
          className={cn(
            "absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] rounded-lg bg-card shadow-sm transition-transform duration-300 ease-[cubic-bezier(.2,.8,.2,1)]",
            isSignup && "translate-x-full"
          )}
        />
        {(["login", "signup"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => switchMode(m)}
            className={cn(
              "relative h-9 rounded-lg transition-colors duration-300",
              mode === m ? "text-foreground" : "text-muted-foreground"
            )}
          >
            {m === "login" ? "Iniciar sesión" : "Crear cuenta"}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={handleGoogle}
        disabled={busy !== null}
        className="w-full h-11 rounded-xl bg-white text-black border border-black/10 font-semibold text-sm flex items-center justify-center gap-3 disabled:opacity-60 active:scale-[0.98] transition-transform hover:shadow-md"
      >
        {busy === "google" ? <Loader2 className="w-4 h-4 animate-spin" /> : <GoogleIcon className="w-5 h-5" />}
        Continuar con Google
      </button>

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <div className="h-px flex-1 bg-border" />
        o con tu correo
        <div className="h-px flex-1 bg-border" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        {isSignup && (
          <input
            key="name"
            type="text"
            autoComplete="name"
            placeholder="Tu nombre"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={cn(inputClass, "animate-in fade-in slide-in-from-top-2 duration-300")}
          />
        )}
        <input
          type="email"
          required
          autoComplete="email"
          placeholder="tu@correo.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
        />
        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            required
            minLength={6}
            autoComplete={isSignup ? "new-password" : "current-password"}
            placeholder={isSignup ? "Contraseña (mín. 6 caracteres)" : "Contraseña"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={cn(inputClass, "pr-11")}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
            className="absolute right-1 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center text-muted-foreground"
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>

        {!isSignup && (
          <div className="flex justify-end animate-in fade-in duration-300">
            <button
              type="button"
              onClick={() => switchMode("reset")}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              ¿Olvidaste tu contraseña?
            </button>
          </div>
        )}

        {error && <p className="text-sm text-destructive animate-in fade-in duration-200">{error}</p>}

        <button
          type="submit"
          disabled={busy !== null}
          className="w-full h-11 rounded-xl bg-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-60 active:scale-[0.98] transition-transform"
        >
          {busy === "email" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
          {isSignup ? "Crear cuenta con correo" : "Entrar con correo"}
        </button>
      </form>

      <p className="text-center text-xs text-muted-foreground leading-relaxed">
        ¿Entraste antes con Google? Crea una contraseña en <span className="font-medium text-foreground">Perfil</span> y
        podrás entrar con tu correo desde cualquier dispositivo.
      </p>
    </div>
  );
}
