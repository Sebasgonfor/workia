"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Eye, EyeOff, KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { authErrorMessage, useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

const inputClass =
  "w-full h-11 px-3.5 rounded-xl bg-background border border-border text-[16px] outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground/60";

/** Perfil card to add a password to a Google account (so it can sign in with
 *  email on other devices) or to change an existing one. */
export function PasswordAccess() {
  const { user, hasPassword, hasGoogle, setAccountPassword } = useAuth();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // Arriving from the "Crea tu contraseña" nudge (?crear-contrasena=1): open
  // the form and bring the card into view.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!params.has("crear-contrasena")) return;
    setOpen(true);
    requestAnimationFrame(() =>
      cardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
    );
    params.delete("crear-contrasena");
    const query = params.toString();
    window.history.replaceState(null, "", window.location.pathname + (query ? `?${query}` : ""));
  }, []);

  if (!user?.email) return null;

  const reset = () => {
    setOpen(false);
    setPassword("");
    setConfirm("");
    setError(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setSaving(true);
    const wasLinked = hasPassword;
    try {
      await setAccountPassword(password);
      toast.success(
        wasLinked
          ? "Contraseña actualizada"
          : "Contraseña creada. Ya puedes entrar con tu correo desde cualquier dispositivo."
      );
      reset();
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      ref={cardRef}
      id="acceso-correo"
      className={cn(
        "p-4 rounded-xl bg-card border mb-2.5 scroll-mt-24 transition-colors",
        open && !hasPassword ? "border-primary/50 ring-2 ring-primary/15" : "border-border"
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "w-9 h-9 rounded-lg flex items-center justify-center shrink-0",
            hasPassword ? "bg-emerald-500/10" : "bg-primary/10"
          )}
        >
          {hasPassword ? (
            <ShieldCheck className="w-[18px] h-[18px] text-emerald-500" />
          ) : (
            <KeyRound className="w-[18px] h-[18px] text-primary" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm">Acceso con correo</p>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            {hasPassword ? (
              <>
                Activo. Puedes entrar en cualquier dispositivo con{" "}
                <span className="text-foreground">{user.email}</span> y tu contraseña.
              </>
            ) : (
              <>
                Crea una contraseña para entrar con{" "}
                <span className="text-foreground">{user.email}</span> desde otro dispositivo sin
                usar tu cuenta de Google. Tus datos siguen siendo los mismos.
              </>
            )}
          </p>
        </div>
      </div>

      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className={cn(
            "w-full h-10 mt-3 rounded-xl text-sm font-medium active:scale-[0.98] transition-transform",
            hasPassword ? "bg-secondary text-foreground" : "bg-primary text-primary-foreground"
          )}
        >
          {hasPassword ? "Cambiar contraseña" : "Crear contraseña"}
        </button>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-2.5 mt-3">
          <div className="relative">
            <input
              type={show ? "text" : "password"}
              autoComplete="new-password"
              placeholder="Nueva contraseña (mín. 6 caracteres)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={cn(inputClass, "pr-11")}
              autoFocus
            />
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}
              className="absolute right-1 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center text-muted-foreground"
            >
              {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <input
            type={show ? "text" : "password"}
            autoComplete="new-password"
            placeholder="Confirmar contraseña"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className={inputClass}
          />
          {hasGoogle && (
            <p className="text-[11px] text-muted-foreground">
              Si Google te pide confirmar tu cuenta, elige la misma con la que iniciaste sesión.
            </p>
          )}
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={reset}
              className="flex-1 h-10 rounded-xl bg-secondary text-sm font-medium"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 h-10 rounded-xl bg-primary text-primary-foreground text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Guardar
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
