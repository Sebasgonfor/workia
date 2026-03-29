"use client";

import { useSubjects } from "@/lib/hooks";
import { useMasteryData } from "@/lib/hooks/useMasteryData";
import { AppShell } from "@/components/app-shell";
import { Trophy, BarChart3, Brain, GraduationCap, HelpCircle, Layers, Loader2 } from "lucide-react";

const masteryColor = (v: number) =>
  v >= 70 ? "text-emerald-400" : v >= 40 ? "text-amber-400" : "text-red-400";

const masteryBg = (v: number) =>
  v >= 70 ? "bg-emerald-400" : v >= 40 ? "bg-amber-400" : "bg-red-400";

const masteryGradient = (v: number) =>
  v >= 70 ? "from-emerald-500/20 to-emerald-500/5" : v >= 40 ? "from-amber-500/20 to-amber-500/5" : "from-red-500/20 to-red-500/5";

function CircularGauge({ value, size = 120, strokeWidth = 8, className = "" }: { value: number; size?: number; strokeWidth?: number; className?: string }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div className={`relative inline-flex items-center justify-center ${className}`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="rgba(255,255,255,0.1)" strokeWidth={strokeWidth} fill="none" />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          stroke={value >= 70 ? "#10b981" : value >= 40 ? "#f59e0b" : "#ef4444"}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-1000"
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className={`text-2xl font-bold ${masteryColor(value)}`}>{value}</span>
        <span className="text-xs text-zinc-500">de 100</span>
      </div>
    </div>
  );
}

function MiniBar({ value, color, label, icon: Icon }: { value: number; color: string; label: string; icon: typeof Brain }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
      <div className="flex-1">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-zinc-500">{label}</span>
          <span className="text-xs text-zinc-400">{value}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-white/5">
          <div
            className={`h-full rounded-full transition-all duration-700 ${masteryBg(value)}`}
            style={{ width: `${value}%` }}
          />
        </div>
      </div>
    </div>
  );
}

export default function DominioPage() {
  const { subjects, loading: subjectsLoading } = useSubjects();
  const { mastery, loading: masteryLoading } = useMasteryData(subjects);

  const loading = subjectsLoading || masteryLoading;
  const overallMastery = mastery.length > 0
    ? Math.round(mastery.reduce((sum, m) => sum + m.overallMastery, 0) / mastery.length)
    : 0;
  const totalItems = mastery.reduce((sum, m) => sum + m.totalStudyItems, 0);

  return (
    <AppShell>
      <div className="max-w-lg mx-auto px-4 pt-6 pb-24 space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-xl font-bold text-white flex items-center justify-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-400" />
            Tu Dominio
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Mide tu comprension real con datos de todos tus estudios
          </p>
        </div>

        {loading ? (
          <div className="flex flex-col items-center py-16 gap-3">
            <Loader2 className="w-8 h-8 text-zinc-400 animate-spin" />
            <p className="text-sm text-zinc-500">Calculando dominio...</p>
          </div>
        ) : mastery.length === 0 ? (
          <div className="flex flex-col items-center py-16 gap-3">
            <div className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center">
              <BarChart3 className="w-7 h-7 text-zinc-600" />
            </div>
            <p className="text-white font-medium">Sin datos aun</p>
            <p className="text-sm text-zinc-500 text-center max-w-xs">
              Usa flashcards, quizzes, modo Feynman o el tutor socratico para empezar a medir tu dominio.
            </p>
          </div>
        ) : (
          <>
            {/* Overall gauge */}
            <div className={`bg-gradient-to-b ${masteryGradient(overallMastery)} rounded-2xl p-6 flex flex-col items-center border border-white/10`}>
              <CircularGauge value={overallMastery} size={140} strokeWidth={10} />
              <p className="text-white font-medium mt-3">Dominio General</p>
              <p className="text-xs text-zinc-500 mt-1">{totalItems} items de estudio totales</p>
            </div>

            {/* Subject cards */}
            <div className="space-y-3">
              {mastery.map((m) => (
                <div key={m.subjectId} className="bg-white/5 border border-white/10 rounded-xl p-4">
                  <div className="flex items-center gap-3 mb-4">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
                      style={{ backgroundColor: m.subjectColor + "20" }}
                    >
                      {m.subjectEmoji}
                    </div>
                    <div className="flex-1">
                      <h3 className="text-white font-medium">{m.subjectName}</h3>
                      <p className="text-xs text-zinc-500">{m.totalStudyItems} items de estudio</p>
                    </div>
                    <CircularGauge value={m.overallMastery} size={52} strokeWidth={4} />
                  </div>

                  <div className="space-y-2.5">
                    <MiniBar value={m.flashcardMastery} color={m.subjectColor} label="Flashcards" icon={Layers} />
                    <MiniBar value={m.quizMastery} color={m.subjectColor} label="Quizzes" icon={HelpCircle} />
                    <MiniBar value={m.feynmanMastery} color={m.subjectColor} label="Feynman" icon={Brain} />
                    <MiniBar value={m.socraticMastery} color={m.subjectColor} label="Socratico" icon={GraduationCap} />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
