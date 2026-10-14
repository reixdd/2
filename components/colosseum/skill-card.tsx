"use client"

import { Lock, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Skill } from "@/lib/colosseum/skills"

export function SkillCard({
  skill,
  selected,
  onSelect,
  compact,
}: {
  skill: Skill
  selected?: boolean
  onSelect?: () => void
  compact?: boolean
}) {
  const interactive = Boolean(onSelect)

  return (
    <button
      type="button"
      onClick={interactive && skill.available ? onSelect : undefined}
      disabled={interactive && !skill.available}
      aria-pressed={interactive ? selected : undefined}
      className={cn(
        "tactile clip-panel-sm group relative flex w-full flex-col gap-2 border-l-4 bg-card/70 p-4 text-left",
        compact && "p-3.5",
        selected ? "border-l-primary fighter-glow" : "border-l-border",
        interactive && !skill.available && "cursor-not-allowed opacity-50 saturate-50",
        interactive && skill.available && "cursor-pointer",
        !interactive && "cursor-default",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] font-semibold tracking-[0.2em] text-primary uppercase">
          {skill.wing}
        </span>
        {skill.available ? (
          <Sparkles className="h-3.5 w-3.5 text-[var(--colosseum-emerald)]" aria-hidden />
        ) : (
          <Lock className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
        )}
      </div>
      <h3 className="font-display text-base leading-snug text-foreground">{skill.name}</h3>
      <p className="text-sm leading-relaxed text-muted-foreground">
        {skill.available ? skill.summary : skill.unavailableReason}
      </p>
      {!compact && <p className="text-xs leading-relaxed text-muted-foreground/80">{skill.description}</p>}
      <div className="mt-1 flex items-center justify-between gap-2 text-xs">
        <span className="truncate font-mono text-[10px] text-muted-foreground/70">{skill.source}</span>
        <span
          className={cn(
            "shrink-0 font-mono text-[10px] font-semibold tracking-wider uppercase",
            skill.available ? "text-[var(--colosseum-emerald)]" : "text-muted-foreground",
          )}
        >
          {skill.available ? "Live" : "Locked"}
        </span>
      </div>
    </button>
  )
}
