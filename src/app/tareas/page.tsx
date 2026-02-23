"use client";

import { AppShell } from "@/components/app-shell";
import { CheckSquare } from "lucide-react";

export default function TareasPage() {
  return (
    <AppShell>
      <div className="px-5 pt-6 page-enter">
        <h1 className="text-2xl font-bold mb-6">Tareas</h1>
        <div className="text-center py-16">
          <div className="w-16 h-16 rounded-2xl bg-card flex items-center justify-center mx-auto mb-4">
            <CheckSquare className="w-8 h-8 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground mb-1">Próximamente</p>
          <p className="text-sm text-muted-foreground/60">
            El dashboard de tareas se implementará en la siguiente sesión.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
