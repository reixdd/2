"use client"

import { useId, useState } from "react"
import { Check, Lightbulb, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { CHALLENGES, type Challenge } from "@/lib/colosseum/challenges"
import { getWorkedExample } from "@/lib/colosseum/tutorial"
import { TUTORIAL_LABEL } from "@/lib/colosseum/mode-shared"
import { ReplayPlayer } from "./replay-player"

const PLAYABLE = CHALLENGES.filter((c): c is Challenge & { task: NonNullable<Challenge["task"]> } =>
  Boolean(c.available && c.task),
)

export function TutorialTrial() {
  const [challengeId, setChallengeId] = useState(PLAYABLE[0].id)
  const [answer, setAnswer] = useState("")
  const [verdict, setVerdict] = useState<null | boolean>(null)
  const [showHint, setShowHint] = useState(false)
  const [showExample, setShowExample] = useState(false)
  const inputId = useId()

  const challenge = PLAYABLE.find((c) => c.id === challengeId) ?? PLAYABLE[0]
  const example = getWorkedExample(challenge.id)

  function choose(id: string) {
    setChallengeId(id)
    setAnswer("")
    setVerdict(null)
    setShowHint(false)
    setShowExample(false)
  }

  function grade(event: React.FormEvent) {
    event.preventDefault()
    if (!answer.trim()) return
    setVerdict(challenge.task.check(`ANSWER: ${answer.trim()}`).correct)
  }

  return (
    <section aria-labelledby="tutorial-heading" className="px-4 sm:px-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3 border-b-2 border-primary/30 pb-2">
        <h2 id="tutorial-heading" className="font-display text-glow-flame text-xl tracking-wide sm:text-2xl">
          Try the Trial Yourself
        </h2>
        <span className="clip-tag bg-secondary px-3 py-1 font-mono text-[10px] font-bold tracking-[0.18em] text-primary uppercase">
          {TUTORIAL_LABEL}
        </span>
      </div>

      <div className="clip-panel grid gap-5 border border-border bg-card p-4 sm:p-5 lg:grid-cols-[1.4fr_1fr]">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Choose a tutorial trial">
            {PLAYABLE.map((c) => (
              <button
                key={c.id}
                type="button"
                aria-pressed={c.id === challenge.id}
                onClick={() => choose(c.id)}
                className={cn(
                  "tactile rounded-full border px-3 py-1 font-mono text-[11px] font-semibold",
                  c.id === challenge.id
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:text-primary",
                )}
              >
                {c.name}
              </button>
            ))}
          </div>
          <p className="text-sm leading-relaxed text-foreground">{challenge.task.prompt}</p>
          <p className="text-xs leading-relaxed text-muted-foreground">{challenge.task.instructions}</p>
        </div>

        <form onSubmit={grade} className="flex flex-col gap-3">
          <label htmlFor={inputId} className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
            Your answer
          </label>
          <input
            id={inputId}
            value={answer}
            onChange={(e) => {
              setAnswer(e.target.value)
              setVerdict(null)
            }}
            autoComplete="off"
            className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={!answer.trim()}
              className="tactile rounded-full bg-primary px-4 py-1.5 font-mono text-xs font-bold tracking-wider text-primary-foreground uppercase disabled:opacity-40"
            >
              Grade it
            </button>
            <button
              type="button"
              onClick={() => setShowHint((v) => !v)}
              aria-expanded={showHint}
              className="tactile flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 font-mono text-xs text-muted-foreground hover:text-primary"
            >
              <Lightbulb className="h-3.5 w-3.5" aria-hidden /> Hint
            </button>
            {example && (
              <button
                type="button"
                onClick={() => setShowExample((v) => !v)}
                aria-expanded={showExample}
                className="tactile rounded-full border border-border bg-card px-3 py-1.5 font-mono text-xs text-muted-foreground hover:text-primary"
              >
                {showExample ? "Hide worked example" : "Watch worked example"}
              </button>
            )}
          </div>
          {showHint && example && <p className="text-xs leading-relaxed text-muted-foreground">{example.hint}</p>}
          <div role="status" aria-live="polite" className="min-h-6 text-sm font-semibold">
            {verdict === true && (
              <span className="flex items-center gap-1.5 text-accent">
                <Check className="h-4 w-4" aria-hidden /> Correct. The checker accepts {challenge.task.expectedDisplay}.
              </span>
            )}
            {verdict === false && (
              <span className="flex items-center gap-1.5 text-destructive">
                <X className="h-4 w-4" aria-hidden /> Not quite. Try again or take the hint.
              </span>
            )}
          </div>
        </form>
      </div>

      {showExample && example && (
        <div className="mt-4">
          <ReplayPlayer
            banner="Worked example — written by the Colosseum authors, not produced by a model"
            challengeId={challenge.id}
            response={example.response}
            meta={[]}
          />
        </div>
      )}
    </section>
  )
}
