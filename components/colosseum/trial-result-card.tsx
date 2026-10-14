"use client"

import { useState } from "react"
import { ContenderPortrait } from "./contender-portrait"
import type { Contender } from "@/lib/colosseum/characters"
import type { Challenge } from "@/lib/colosseum/challenges"
import { cn } from "@/lib/utils"

export type RunState = "queued" | "running" | "complete" | "unavailable" | "error" | "cancelled"

export interface ContenderRun {
  state: RunState
  text?: string
  latencyMs?: number
  correct?: boolean
  extracted?: string | null
  error?: string
}

function stampFor(run: ContenderRun) {
  if (run.state === "queued") return { label: "QUEUED", className: "border-muted-foreground text-muted-foreground" }
  if (run.state === "cancelled") return { label: "STOPPED", className: "border-muted-foreground text-muted-foreground" }
  if (run.state === "running") return { label: "LIVE", className: "border-primary text-primary" }
  if (run.state === "unavailable") return { label: "N/A", className: "border-muted-foreground text-muted-foreground" }
  if (run.state === "error") return { label: "ERROR", className: "border-primary text-primary" }
  return run.correct
    ? { label: "CLEARED", className: "border-[var(--colosseum-emerald)] text-[var(--colosseum-emerald)]" }
    : { label: "FAILED", className: "border-destructive text-destructive" }
}

export function TrialResultCard({
  contender,
  run,
  challenge,
  skillName,
}: {
  contender: Contender
  run: ContenderRun
  challenge: Challenge
  skillName?: string | null
}) {
  const [expanded, setExpanded] = useState(false)
  const stamp = stampFor(run)

  return (
    <div className="clip-panel-sm relative flex flex-col gap-3 border-l-4 border-l-border bg-card/70 p-4 sm:flex-row sm:items-start">
      <div className="flex items-start gap-4 sm:flex-1">
        <ContenderPortrait contender={contender} size="sm" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-base">{contender.name}</h3>
            {typeof run.latencyMs === "number" && (
              <span className="font-mono text-xs text-muted-foreground">{(run.latencyMs / 1000).toFixed(2)}s</span>
            )}
            {skillName && (
              <span className="clip-tag bg-secondary px-2 py-0.5 font-mono text-[9px] font-semibold tracking-[0.15em] text-secondary-foreground uppercase">
                {skillName}
              </span>
            )}
          </div>

          {run.state === "running" && (
            <p className="mt-2 text-sm text-muted-foreground">Awaiting a live response from {contender.modelId}…</p>
          )}

          {run.state === "queued" && <p className="mt-2 text-sm text-muted-foreground">Waiting for a free arena slot.</p>}

          {run.state === "cancelled" && (
            <p className="mt-2 text-sm text-muted-foreground">Stopped before a result was produced. Nothing was recorded.</p>
          )}

          {run.state === "unavailable" && <p className="mt-2 text-sm text-muted-foreground">{run.error}</p>}

          {run.state === "error" && <p className="mt-2 text-sm text-destructive">{run.error}</p>}

          {run.state === "complete" && (
            <div className="mt-2 space-y-2">
              <p className="text-sm text-balance">
                <span className="text-muted-foreground">Answer: </span>
                <span className="font-mono">{run.extracted ?? "none found"}</span>
                <span className="text-muted-foreground"> · Expected: </span>
                <span className="font-mono">{challenge.task?.expectedDisplay}</span>
              </p>
              <button
                type="button"
                onClick={() => setExpanded((e) => !e)}
                className="font-mono text-xs tracking-wide text-primary uppercase hover:underline"
              >
                {expanded ? "Hide reasoning" : "Show reasoning"}
              </button>
              {expanded && (
                <pre className="scrollbar-thin max-h-64 overflow-auto rounded-sm border border-border bg-background/60 p-3 text-xs whitespace-pre-wrap text-muted-foreground">
                  {run.text}
                </pre>
              )}
            </div>
          )}
        </div>
      </div>

      <div
        className={cn(
          "stamp self-center border-2 px-3 py-1 font-display text-sm tracking-[0.2em] sm:self-start",
          stamp.className,
        )}
      >
        {stamp.label}
      </div>
    </div>
  )
}
