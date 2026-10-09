import { cn } from "@/lib/utils"
import { RUNTIME_STATE_LABELS, type RuntimeState } from "@/lib/colosseum/runtime"

const TONES: Record<RuntimeState, string> = {
  configured: "border-muted-foreground/60 text-muted-foreground",
  available: "border-primary/50 text-primary",
  loading: "border-primary text-primary",
  ready: "border-[var(--colosseum-emerald)] text-[var(--colosseum-emerald)]",
  running: "border-primary text-primary",
  failed: "border-destructive text-destructive",
  unavailable: "border-muted-foreground/60 text-muted-foreground",
}

export function RuntimeBadge({ state, className }: { state: RuntimeState; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border bg-white/90 px-2 shadow-sm py-0.5 font-mono text-[9px] font-semibold tracking-[0.15em] uppercase",
        TONES[state],
        className,
      )}
    >
      <span
        aria-hidden
        className={cn("h-1.5 w-1.5 rounded-full bg-current", (state === "loading" || state === "running") && "animate-pulse")}
      />
      {RUNTIME_STATE_LABELS[state]}
    </span>
  )
}
