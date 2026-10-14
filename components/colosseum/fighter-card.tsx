"use client"

import Image from "next/image"
import { Check, Lock, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Contender } from "@/lib/colosseum/characters"
import type { RuntimeStatus } from "@/lib/colosseum/runtime"
import { RuntimeBadge } from "./runtime-badge"
import type { ContenderRun } from "./trial-result-card"

export function FighterCard({
  contender,
  selected,
  disabled,
  run,
  runtime,
  onToggle,
  style,
}: {
  contender: Contender
  selected: boolean
  disabled?: boolean
  run?: ContenderRun
  runtime?: RuntimeStatus
  onToggle: () => void
  style?: React.CSSProperties
}) {
  const isOperational = contender.status === "operational"
  const isDisabled = disabled || !isOperational

  const stamp =
    run?.state === "complete"
      ? run.correct
        ? { label: "CLEARED", color: "text-[var(--colosseum-emerald)] border-[var(--colosseum-emerald)]" }
        : { label: "FAILED", color: "text-destructive border-destructive" }
      : run?.state === "error"
        ? { label: "ERROR", color: "text-primary border-primary" }
        : run?.state === "unavailable"
          ? { label: "N/A", color: "text-muted-foreground border-muted-foreground" }
          : null

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={isDisabled}
      aria-pressed={selected}
      style={style}
      className={cn(
        "rise-in tactile group relative flex aspect-[3/4] w-full flex-col overflow-hidden text-left",
        "clip-panel bg-card",
        !isOperational
          ? "cursor-not-allowed saturate-[0.65]"
          : isDisabled
            ? "cursor-not-allowed opacity-50 saturate-50"
            : "cursor-pointer",
        selected && "fighter-glow",
      )}
    >
      {contender.portrait ? (
        <Image
          src={contender.portrait || "/placeholder.svg"}
          alt={contender.name}
          fill
          sizes="(min-width: 1024px) 16vw, 45vw"
          className={cn(
            "object-cover transition-transform duration-300",
            !isDisabled && "group-hover:scale-[1.06]",
          )}
          style={{ objectPosition: contender.portraitPosition ?? "50% 12%" }}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-muted/60">
          <Lock className="h-8 w-8 text-muted-foreground" aria-hidden />
        </div>
      )}

      {/* vignette so the nameplate reads over any art */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-white/95 via-white/5 to-transparent" />

      {run?.state === "running" && (
        <div className="scanning pointer-events-none absolute inset-0 overflow-hidden" />
      )}

      {/* selection check */}
      <div
        className={cn(
          "absolute right-0 top-0 flex h-7 w-7 items-center justify-center bg-primary clip-tag transition-opacity",
          selected ? "opacity-100" : "opacity-0",
        )}
      >
        <Check className="h-4 w-4 text-primary-foreground" aria-hidden />
      </div>

      {run?.state === "running" && (
        <div className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-white/90 px-2 py-1 shadow-sm">
          <Loader2 className="h-3 w-3 animate-spin text-primary" aria-hidden />
          <span className="font-mono text-[9px] tracking-wider text-primary uppercase">Fighting</span>
        </div>
      )}

      {runtime && !run && isOperational && <RuntimeBadge state={runtime.state} className="absolute left-2 top-2" />}

      {stamp && (
        <div
          className={cn(
            "stamp pointer-events-none absolute left-1/2 top-[38%] -translate-x-1/2 border-2 bg-white/90 px-3 py-1 font-display text-xs tracking-[0.2em]",
            stamp.color,
          )}
        >
          {stamp.label}
        </div>
      )}

      {!isOperational && !run && (
        <div className="pointer-events-none absolute left-2 top-2 flex items-center gap-1 rounded-full bg-white/90 px-2 py-1 shadow-sm">
          <Lock className="h-3 w-3 text-muted-foreground" aria-hidden />
          <span className="font-mono text-[9px] tracking-wider text-muted-foreground uppercase">Locked</span>
        </div>
      )}

      {/* nameplate */}
      <div className="relative mt-auto flex flex-col gap-0.5 px-3 pb-3 pt-6">
        <span
          className="font-mono text-[9px] font-semibold tracking-[0.2em] uppercase"
          style={{ color: `color-mix(in oklch, ${contender.accent} 45%, oklch(0.26 0.045 245))` }}
        >
          {contender.family}
        </span>
        <span className="font-display text-sm leading-tight text-balance text-foreground sm:text-base">
          {contender.name}
        </span>
        <div className="grid grid-rows-[0fr] transition-[grid-template-rows] duration-300 group-hover:grid-rows-[1fr] group-focus-visible:grid-rows-[1fr]">
          <div className="overflow-hidden">
            <p className="pt-1 font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
              {contender.archetype}
            </p>
            <div className="flex flex-wrap gap-1 pt-1.5">
              {contender.specialties.slice(0, 2).map((s) => (
                <span
                  key={s}
                  className="rounded-full bg-white/80 px-2 py-0.5 font-mono text-[9px] font-semibold text-primary"
                >
                  {s}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </button>
  )
}
