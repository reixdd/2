import { Lock } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Challenge } from "@/lib/colosseum/challenges"

const PIPS: Record<Challenge["difficulty"], number> = {
  Novice: 1,
  Adept: 2,
  Master: 3,
}

export function ChallengeCard({
  challenge,
  selected,
  onSelect,
}: {
  challenge: Challenge
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={challenge.available ? onSelect : undefined}
      disabled={!challenge.available}
      aria-pressed={selected}
      className={cn(
        "tactile clip-panel-sm relative flex w-[260px] shrink-0 snap-start flex-col gap-2 border-l-4 bg-card p-4 text-left sm:w-[300px]",
        challenge.available ? "cursor-pointer" : "cursor-not-allowed opacity-50 saturate-50",
        selected ? "border-l-primary fighter-glow" : "border-l-border",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] font-semibold tracking-[0.2em] text-primary uppercase">
          {challenge.discipline}
        </span>
        <span className="flex items-center gap-0.5" aria-label={`Difficulty: ${challenge.difficulty}`}>
          {Array.from({ length: 3 }).map((_, i) => (
            <span
              key={i}
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                i < PIPS[challenge.difficulty] ? "bg-accent" : "bg-muted",
              )}
            />
          ))}
        </span>
      </div>
      <h3 className="font-display text-base leading-snug text-foreground">{challenge.name}</h3>
      <p className="text-sm leading-relaxed text-muted-foreground">{challenge.description}</p>
      <div className="mt-1 flex items-center justify-between text-xs">
        <span className={challenge.available ? "text-primary" : "flex items-center gap-1 text-muted-foreground"}>
          {challenge.available ? (
            challenge.verification
          ) : (
            <>
              <Lock className="h-3 w-3" aria-hidden /> Locked
            </>
          )}
        </span>
        <span className="shrink-0 pl-2 font-mono text-muted-foreground">{challenge.estimatedRuntime}</span>
      </div>
    </button>
  )
}
