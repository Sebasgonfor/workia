"use client";

import { useCallback, useEffect, useState } from "react";
import { Cpu, Eye, Type, Loader2, RotateCcw, Zap, AlertTriangle, Check } from "lucide-react";
import { toast } from "sonner";
import type { ProviderId, ProviderInfo } from "@/lib/ai/catalog";

interface ProviderWithKey extends ProviderInfo {
  hasKey: boolean;
}

interface Selection {
  textProvider: ProviderId;
  textModel: string;
  visionProvider: ProviderId;
  visionModel: string;
}

interface ModelOption {
  id: string;
  label: string;
}

type ModelState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; models: ModelOption[] }
  | { status: "error"; message: string };

/** Un selector (texto o visión): proveedor + modelo. */
function Row({
  kind,
  providers,
  provider,
  model,
  modelState,
  onProviderChange,
  onModelChange,
}: {
  kind: "text" | "vision";
  providers: ProviderWithKey[];
  provider: ProviderId;
  model: string;
  modelState: ModelState;
  onProviderChange: (p: ProviderId) => void;
  onModelChange: (m: string) => void;
}) {
  const isVision = kind === "vision";
  const Icon = isVision ? Eye : Type;
  const info = providers.find((p) => p.id === provider);

  // Para visión solo tiene sentido ofrecer proveedores multimodales.
  const usable = providers.filter((p) => (isVision ? p.supportsVision : true));

  const selectClass =
    "w-full text-sm rounded-lg bg-secondary/60 border border-border px-3 py-2.5 " +
    "outline-none focus:border-primary/60 transition-colors disabled:opacity-50";

  return (
    <div className="p-3.5 rounded-xl bg-card border border-border">
      <div className="flex items-center gap-2 mb-3">
        <div
          className={`w-7 h-7 rounded-lg flex items-center justify-center ${
            isVision ? "bg-violet-500/10" : "bg-primary/10"
          }`}
        >
          <Icon className={`w-3.5 h-3.5 ${isVision ? "text-violet-500" : "text-primary"}`} />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium leading-tight">
            {isVision ? "Imágenes y audio" : "Texto"}
          </p>
          <p className="text-[10px] text-muted-foreground leading-tight">
            {isVision
              ? "Escanear, digitalizar, transcribir, enriquecer"
              : "Quizzes, flashcards, socrático, Feynman"}
          </p>
        </div>
      </div>

      <label className="block text-[10px] text-muted-foreground mb-1">Proveedor</label>
      <select
        aria-label={isVision ? "Proveedor para imágenes y audio" : "Proveedor para texto"}
        value={provider}
        onChange={(e) => onProviderChange(e.target.value as ProviderId)}
        className={`${selectClass} mb-2.5`}
      >
        {usable.map((p) => (
          <option key={p.id} value={p.id} disabled={!p.hasKey}>
            {p.label}
            {p.hasKey ? "" : " — sin API key"}
          </option>
        ))}
      </select>

      <label className="block text-[10px] text-muted-foreground mb-1">Modelo</label>

      {modelState.status === "loading" && (
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-secondary/40 border border-border">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Consultando modelos disponibles…</span>
        </div>
      )}

      {modelState.status === "error" && (
        <>
          <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 mb-2">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
            <span className="text-[11px] text-amber-600 dark:text-amber-400 break-words">
              {modelState.message}
            </span>
          </div>
          <input
            aria-label="Nombre del modelo"
            value={model}
            onChange={(e) => onModelChange(e.target.value.trim())}
            placeholder="Escribe el nombre del modelo"
            className={selectClass}
          />
        </>
      )}

      {modelState.status === "ready" && (
        <select
          aria-label={isVision ? "Modelo para imágenes y audio" : "Modelo para texto"}
          value={model}
          onChange={(e) => onModelChange(e.target.value)}
          className={selectClass}
        >
          {!modelState.models.some((m) => m.id === model) && (
            <option value={model}>{model || "— elige un modelo —"}</option>
          )}
          {modelState.models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.id}
            </option>
          ))}
        </select>
      )}

      {info && (
        <p className="text-[10px] text-muted-foreground/70 mt-2">{info.note}</p>
      )}
    </div>
  );
}

export function AiModelPicker() {
  const [providers, setProviders] = useState<ProviderWithKey[]>([]);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [textModels, setTextModels] = useState<ModelState>({ status: "idle" });
  const [visionModels, setVisionModels] = useState<ModelState>({ status: "idle" });

  // Carga inicial: catálogo + selección activa
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/ai/config");
        if (!res.ok) throw new Error("No se pudo leer la configuración");
        const data = await res.json();
        if (cancelled) return;
        setProviders(data.providers);
        setSelection(data.active);
      } catch {
        if (!cancelled) toast.error("No se pudo cargar la configuración de IA");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Pide al proveedor su lista de modelos real
  const loadModels = useCallback(
    async (provider: ProviderId, target: "text" | "vision") => {
      const set = target === "text" ? setTextModels : setVisionModels;
      set({ status: "loading" });
      try {
        const res = await fetch(`/api/ai/models?provider=${encodeURIComponent(provider)}`);
        const data = await res.json();
        if (!res.ok || data.error) {
          set({ status: "error", message: data.error || "No se pudo consultar el proveedor" });
          return;
        }
        set({ status: "ready", models: data.models });
      } catch {
        set({ status: "error", message: "Sin conexión con el proveedor" });
      }
    },
    []
  );

  useEffect(() => {
    if (selection) loadModels(selection.textProvider, "text");
    // Solo al cambiar de proveedor, no en cada tecleo del modelo
  }, [selection?.textProvider, loadModels]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (selection) loadModels(selection.visionProvider, "vision");
  }, [selection?.visionProvider, loadModels]); // eslint-disable-line react-hooks/exhaustive-deps

  const update = (patch: Partial<Selection>) => {
    setSelection((prev) => (prev ? { ...prev, ...patch } : prev));
    setDirty(true);
  };

  const handleSave = async () => {
    if (!selection) return;
    setSaving(true);
    try {
      const res = await fetch("/api/ai/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(selection),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo guardar");
      setDirty(false);
      toast.success("Modelos actualizados");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/ai/config", { method: "DELETE" });
      const data = await res.json();
      setSelection(data.defaults);
      setDirty(false);
      toast.success("Restaurado a la configuración del servidor");
    } catch {
      toast.error("No se pudo restaurar");
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const res = await fetch("/api/ai/health?ping=1");
      const data = await res.json();
      if (data.ping?.ok) {
        toast.success(`Responde: ${data.config.text.model}`);
      } else {
        toast.error(data.ping?.error || "El modelo no respondió");
      }
    } catch {
      toast.error("No se pudo probar la conexión");
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-4 rounded-xl bg-card border border-border mb-2.5 flex items-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Cargando configuración de IA…</span>
      </div>
    );
  }

  if (!selection) return null;

  const noKeys = providers.every((p) => !p.hasKey);

  return (
    <div className="mb-2.5">
      <div className="flex items-center gap-2 mb-2.5 px-0.5">
        <Cpu className="w-4 h-4 text-primary" />
        <h2 className="text-sm font-semibold">Modelos de IA</h2>
      </div>

      {noKeys && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 mb-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-[11px] text-amber-600 dark:text-amber-400">
            No hay ninguna API key configurada en el servidor. Añádela en{" "}
            <code className="font-mono">.env.local</code> y reinicia.
          </p>
        </div>
      )}

      <div className="space-y-2.5">
        <Row
          kind="text"
          providers={providers}
          provider={selection.textProvider}
          model={selection.textModel}
          modelState={textModels}
          onProviderChange={(p) => update({ textProvider: p, textModel: "" })}
          onModelChange={(m) => update({ textModel: m })}
        />
        <Row
          kind="vision"
          providers={providers}
          provider={selection.visionProvider}
          model={selection.visionModel}
          modelState={visionModels}
          onProviderChange={(p) => update({ visionProvider: p, visionModel: "" })}
          onModelChange={(m) => update({ visionModel: m })}
        />
      </div>

      <div className="flex gap-2 mt-2.5">
        <button
          onClick={handleSave}
          disabled={saving || !dirty || !selection.textModel || !selection.visionModel}
          className="flex-1 flex items-center justify-center gap-2 p-3 rounded-xl bg-primary text-primary-foreground font-medium text-sm disabled:opacity-40 active:scale-[0.98] transition-transform"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          {dirty ? "Guardar" : "Guardado"}
        </button>

        <button
          onClick={handleTest}
          disabled={testing}
          className="flex items-center justify-center gap-2 px-4 p-3 rounded-xl bg-card border border-border text-sm font-medium disabled:opacity-40 active:scale-[0.98] transition-transform"
        >
          {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
          Probar
        </button>

        <button
          onClick={handleReset}
          disabled={saving}
          aria-label="Restaurar configuración del servidor"
          className="flex items-center justify-center px-3.5 p-3 rounded-xl bg-card border border-border text-muted-foreground disabled:opacity-40 active:scale-[0.98] transition-transform"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
