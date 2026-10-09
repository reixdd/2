"use client"

import { useEffect, useState } from "react"
import { Check, Copy, Pause, Play, RotateCcw, SkipForward, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { getChallenge } from "@/lib/colosseum/challenges"
import { useReducedMotion } from "@/hooks/use-reduced-motion"

export interface ReplayMeta {
  label: string
  value: string
}

const TICK_MS = 28
const CHARS_PER_TICK = 3

/**
 * Plays back a stored response. Reveal speed is cosmetic and says nothing about how long a model took;
 * the verdict is recomputed here from the response text by the same deterministic checker.
 */
export function ReplayPlayer({
  banner,
  challengeId,
  response,
  meta,
  shareText,
}: {
  banner: string
  challengeId: string
  response: string
  meta: ReplayMeta[]
  shareText?: string
}) {
  const reducedMotion = useReducedMotion()
  const challenge = getChallenge(challengeId)
  const grade = challenge?.task?.check(response) ?? { extracted: null, correct: false }
  const [shown, setShown] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [copied, setCopied] = useState(false)

  const finished = reducedMotion || shown >= response.length
  const visible = reducedMotion ? response : response.slice(0, shown)

  useEffect(() => {
    setShown(0)
    setPlaying(true)
  }, [response, challengeId])

  useEffect(() => {
    if (!playing || reducedMotion || shown >= response.length) return
    const timer = window.setTimeout(() => setShown((n) => Math.min(response.length, n + CHARS_PER_TICK)), TICK_MS)
    return () => window.clearTimeout(timer)
  }, [playing, reducedMotion, shown, response.length])

  async function copyShare() {
    if (!shareText) return
    try {
      await navigator.clipboard.writeText(shareText)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setCopied(false)
    }
  }

  return (
    <article className="clip-panel overflow-hidden border border-border bg-card" aria-label="Trial replay">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-secondary px-4 py-2">
        <span className="font-mono text-[10px] font-bold tracking-[0.18em] text-primary uppercase">{banner}</span>
        <div className="flex items-center gap-1.5">
          {!reducedMotion && (
            <>
              <IconButton
                label={playing && !finished ? "Pause playback" : "Play playback"}
                onClick={() => {
                  if (finished) setShown(0)
                  setPlaying((p) => (finished ? true : !p))
                }}
              >
                {playing && !finished ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              </IconButton>
              <IconButton label="Restart playback" onClick={() => (setShown(0), setPlaying(true))}>
                <RotateCcw className="h-3.5 w-3.5" />
              </IconButton>
              <IconButton label="Skip to the end" onClick={() => setShown(response.length)} disabled={finished}>
                <SkipForward className="h-3.5 w-3.5" />
              </IconButton>
            </>
          )}
          {shareText && (
            <IconButton label={copied ? "Copied" : "Copy summary"} onClick={copyShare}>
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            </IconButton>
          )}
        </div>
      </header>

      <div className="grid gap-4 p-4 lg:grid-cols-[1fr_16rem]">
        <div>
          <p className="mb-1 font-mono text-[10px] tracking-[0.2em] text-muted-foreground uppercase">Response</p>
          <pre
            className="max-h-72 min-h-28 overflow-auto rounded-md border border-border bg-background p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap text-foreground"
            aria-live="off"
          >
            {visible}
            {!finished && <span className="ml-0.5 inline-block h-3 w-1.5 animate-pulse bg-primary align-middle" />}
          </pre>
        </div>

        <aside className="flex flex-col gap-3">
          <div
            role="status"
            className={cn(
              "flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold",
              !finished && "border-border text-muted-foreground",
              finished && grade.correct && "border-accent/50 bg-accent/10 text-accent",
              finished && !grade.correct && "border-destructive/50 bg-destructive/10 text-destructive",
            )}
          >
            {!finished ? (
              "Replaying…"
            ) : grade.correct ? (
              <>
                <Check className="h-4 w-4" aria-hidden /> Correct
              </>
            ) : (
              <>
                <X className="h-4 w-4" aria-hidden /> Incorrect
              </>
            )}
          </div>
          {finished && (
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
              <dt className="text-muted-foreground">Extracted</dt>
              <dd className="font-mono break-words text-foreground">{grade.extracted ?? "none found"}</dd>
              {challenge?.task && (
                <>
                  <dt className="text-muted-foreground">Expected</dt>
                  <dd className="font-mono text-foreground">{challenge.task.expectedDisplay}</dd>
                </>
              )}
              {meta.map((m) => (
                <MetaRow key={m.label} {...m} />
              ))}
            </dl>
          )}
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Playback speed is cosmetic. The verdict is re-computed in your browser from the stored text.
          </p>
        </aside>
      </div>
    </article>
  )
}

function MetaRow({ label, value }: ReplayMeta) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-mono break-words text-foreground">{value}</dd>
    </>
  )
}

function IconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="tactile flex h-7 w-7 items-center justify-center rounded-full border border-border bg-card text-muted-foreground hover:text-primary disabled:opacity-40"
    >
      {children}
    </button>
  )
}
