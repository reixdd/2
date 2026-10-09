import type React from "react"
import { cn } from "@/lib/utils"

export type TrialStatus = "operational" | "unavailable" | "running" | "correct" | "incorrect" | "error"

const STYLES: Record<TrialStatus, string> = {
  operational: "border-[var(--colosseum-emerald)]/40 bg-[var(--colosseum-emerald)]/10 text-[var(--colosseum-emerald)]",
  unavailable: "border-border bg-muted text-muted-foreground",
  running: "animate-pulse border-primary/40 bg-primary/10 text-primary",
  correct: "border-[var(--colosseum-emerald)]/40 bg-[var(--colosseum-emerald)]/10 text-[var(--colosseum-emerald)]",
  incorrect: "border-destructive/40 bg-destructive/10 text-destructive",
  error: "border-primary/40 bg-primary/10 text-primary",
}

export function StatusBadge({ status, children }: { status: TrialStatus; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "clip-tag inline-flex items-center gap-1.5 whitespace-nowrap border px-2.5 py-1 font-mono text-[10px] font-semibold tracking-[0.15em] uppercase",
        STYLES[status],
      )}
    >
      {children}
    </span>
  )
}
