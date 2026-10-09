"use client"

import { useRef, useState } from "react"
import Link from "next/link"
import { Swords, Hammer, ArrowRight, Square, ShieldCheck } from "lucide-react"
import { cn } from "@/lib/utils"
import { CONTENDERS } from "@/lib/colosseum/characters"
import { CHALLENGES } from "@/lib/colosseum/challenges"
import { appendEvidence } from "@/lib/colosseum/evidence"
import { LIMITS, planBattle } from "@/lib/colosseum/limits"
import { canAttemptTrial } from "@/lib/colosseum/runtime"
import { requestTrial, runPool } from "@/lib/colosseum/trial-client"
import { useRuntime } from "@/lib/colosseum/use-runtime"
import { ChallengeCard } from "./challenge-card"
import { FighterCard } from "./fighter-card"
import { RuntimeBadge } from "./runtime-badge"
import { TrialResultCard, type ContenderRun } from "./trial-result-card"

export function LiveArena() {
  const [challengeId, setChallengeId] = useState<string>(CHALLENGES.find((c) => c.available)?.id ?? CHALLENGES[0].id)
  const [selected, setSelected] = useState<string[]>(() =>
    CONTENDERS.filter((c) => c.status === "operational")
      .slice(0, LIMITS.freeBattleFighters)
      .map((c) => c.id),
  )
  const [running, setRunning] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [battleIds, setBattleIds] = useState<string[]>([])
  const [runs, setRuns] = useState<Record<string, ContenderRun>>({})
  const abortRef = useRef<AbortController | null>(null)
  const { statuses, limits, verify, refresh } = useRuntime()

  const challenge = CHALLENGES.find((c) => c.id === challengeId) ?? CHALLENGES[0]
  const plan = planBattle(selected.length)

  function toggleContender(id: string) {
    if (running) return
    setConfirming(false)
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  function requestBattle() {
    if (!challenge.available || selected.length === 0 || running) return
    if (plan.needsConfirmation && !confirming) {
      setConfirming(true)
      return
    }
    void beginTrial()
  }

  function stopBattle() {
    abortRef.current?.abort()
  }

  async function beginTrial() {
    setConfirming(false)
    const ids = [...selected]
    const controller = new AbortController()
    abortRef.current = controller
    setRunning(true)
    setBattleIds(ids)
    setRuns(Object.fromEntries(ids.map((id) => [id, { state: "queued" } satisfies ContenderRun])))

    const setRun = (id: string, run: ContenderRun) => setRuns((prev) => ({ ...prev, [id]: run }))

    await runPool(
      ids,
      LIMITS.clientConcurrency,
      async (id) => {
        const contender = CONTENDERS.find((c) => c.id === id)
        if (!contender) return
        if (!canAttemptTrial(statuses[id])) {
          setRun(id, { state: "unavailable", error: statuses[id]?.detail ?? "This runtime is not available." })
          return
        }
        setRun(id, { state: "running" })
        const run = await requestTrial({ contenderId: id, challengeId: challenge.id }, controller.signal)
        setRun(id, run)

        if (run.state === "complete" && run.outcome) {
          appendEvidence({
            id: `${Date.now()}-${id}`,
            timestamp: Date.now(),
            challengeId: challenge.id,
            challengeName: challenge.name,
            discipline: challenge.discipline,
            contenderId: id,
            contenderName: contender.name,
            correct: Boolean(run.correct),
            latencyMs: run.latencyMs ?? 0,
            extracted: run.extracted ?? null,
            response: run.text ?? "",
            modelId: run.outcome.provenance?.modelId,
            runtime: run.outcome.provenance?.runtime,
            challengeVersion: run.outcome.provenance?.challengeVersion,
            totalTokens: run.outcome.usage?.totalTokens,
          })
        }
      },
      controller.signal,
      (id) => setRun(id, { state: "cancelled" }),
    )

    setRunning(false)
    abortRef.current = null
    void refresh()
  }

  const verifiable = CONTENDERS.filter((c) => c.status === "operational")
  const problems = selected
    .map((id) => ({ id, status: statuses[id] }))
    .filter((entry) => entry.status && !canAttemptTrial(entry.status) && entry.status.state !== "loading")

  return (
    <div className="mx-auto max-w-7xl pb-24">
      <section className="mb-6 px-4 sm:px-6">
        <span className="clip-tag inline-flex items-center gap-1.5 bg-accent px-3 py-1 font-mono text-[10px] font-bold tracking-[0.2em] text-accent-foreground uppercase">
          ● Operator live mode — real model requests
        </span>
      </section>

      <section className="mb-8 px-4 sm:px-6">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3 border-b-2 border-primary/30 pb-2">
          <h2 className="font-display text-glow-flame text-xl tracking-wide sm:text-2xl">Lock Your Roster</h2>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] text-muted-foreground sm:text-xs">{selected.length} selected</span>
            <button
              type="button"
              disabled={running}
              onClick={() => setSelected(CONTENDERS.filter((c) => c.status === "operational").map((c) => c.id))}
              className="tactile rounded-full border border-border bg-card px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-primary disabled:opacity-40"
            >
              All
            </button>
            <button
              type="button"
              disabled={running}
              onClick={() => setSelected([])}
              className="tactile rounded-full border border-border bg-card px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-primary disabled:opacity-40"
            >
              Clear
            </button>
            <Link
              href="/workshop"
              className="tactile flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-secondary-foreground"
            >
              <Hammer className="h-3 w-3" aria-hidden /> Workshop <ArrowRight className="h-3 w-3" aria-hidden />
            </Link>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          {CONTENDERS.map((c, i) => (
            <FighterCard
              key={c.id}
              contender={c}
              selected={selected.includes(c.id)}
              disabled={running}
              run={runs[c.id]}
              runtime={statuses[c.id]}
              onToggle={() => toggleContender(c.id)}
              style={{ animationDelay: `${i * 50}ms` }}
            />
          ))}
        </div>
      </section>

      <div className="mb-10 flex flex-col items-center gap-3 px-4 sm:px-6">
        {confirming ? (
          <div role="alert" className="clip-panel max-w-md border border-primary/60 bg-card/80 p-4 text-center">
            <p className="text-sm leading-relaxed">
              This battle sends <strong>{plan.requests} live, billed model requests</strong>. Continue?
            </p>
            <div className="mt-3 flex justify-center gap-2">
              <button
                type="button"
                onClick={() => void beginTrial()}
                className="tactile clip-tag bg-primary px-5 py-2 font-display text-sm tracking-wider text-primary-foreground uppercase"
              >
                Confirm &amp; fight
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="rounded-sm border border-border px-4 py-2 font-mono text-xs uppercase text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={requestBattle}
              disabled={running || selected.length === 0 || !challenge.available}
              className={cn(
                "tactile clip-tag flex items-center gap-3 bg-primary px-10 py-4 font-display text-lg tracking-[0.15em] text-primary-foreground uppercase disabled:cursor-not-allowed disabled:opacity-40",
                running && "pulse-ring",
              )}
            >
              <Swords className="h-5 w-5" aria-hidden />
              {running ? "Battle in Progress" : "Enter the Arena"}
            </button>
            {running && (
              <button
                type="button"
                onClick={stopBattle}
                className="flex items-center gap-2 rounded-sm border border-destructive px-4 py-4 font-mono text-xs font-semibold uppercase tracking-wider text-destructive hover:bg-destructive/10"
              >
                <Square className="h-3.5 w-3.5" aria-hidden /> Stop
              </button>
            )}
          </div>
        )}
        {!running && !confirming && selected.length > 0 && challenge.available && (
          <p className="text-xs text-muted-foreground">
            {plan.requests} live request{plan.requests === 1 ? "" : "s"} per battle
            {plan.needsConfirmation ? " — confirmation required" : ""}.
          </p>
        )}
        {problems.length > 0 && (
          <p className="max-w-md text-center text-xs text-muted-foreground">
            Offline: {problems.map((p) => CONTENDERS.find((c) => c.id === p.id)?.name).join(", ")} will be skipped.
          </p>
        )}
        {!challenge.available && <p className="text-xs text-muted-foreground">{challenge.unavailableReason}</p>}
      </div>

      {Object.keys(runs).length > 0 && (
        <section className="mb-10 px-4 sm:px-6">
          <h2 className="font-display text-glow-flame mb-4 border-b-2 border-accent/30 pb-2 text-xl tracking-wide sm:text-2xl">
            Battle Report
          </h2>
          <div className="space-y-3">
            {battleIds.map((id) => {
              const contender = CONTENDERS.find((c) => c.id === id)
              const run = runs[id]
              if (!contender || !run) return null
              return <TrialResultCard key={id} contender={contender} run={run} challenge={challenge} />
            })}
          </div>
        </section>
      )}

      <section className="mb-10 px-4 sm:px-6">
        <div className="mb-4 flex items-end justify-between gap-4 border-b-2 border-primary/30 pb-2">
          <h2 className="font-display text-glow-flame text-xl tracking-wide sm:text-2xl">Choose a Trial</h2>
          <span className="font-mono text-[10px] text-muted-foreground sm:text-xs">
            {CHALLENGES.filter((c) => c.available).length} / {CHALLENGES.length} unlocked
          </span>
        </div>
        <div className="scrollbar-thin flex snap-x gap-4 overflow-x-auto pb-3">
          {CHALLENGES.map((c) => (
            <ChallengeCard key={c.id} challenge={c} selected={c.id === challengeId} onSelect={() => setChallengeId(c.id)} />
          ))}
        </div>
      </section>

      <section className="mb-10 px-4 sm:px-6" aria-labelledby="runtime-heading">
        <details className="clip-panel group bg-card/70 p-5">
          <summary className="flex cursor-pointer list-none items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-secondary" aria-hidden />
            <h3 id="runtime-heading" className="font-display text-base tracking-wide">
              Runtime &amp; Cost
            </h3>
            <span className="ml-auto font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              {limits?.maxRequestsPerWindow ?? LIMITS.maxRequestsPerWindow} calls /{" "}
              {limits?.windowMinutes ?? Math.round(LIMITS.windowMs / 60_000)}m
            </span>
          </summary>
          <p className="mb-4 mt-3 text-sm leading-relaxed text-muted-foreground">
            Live, billed calls via the AI Gateway. Capped at {limits?.maxOutputTokens ?? LIMITS.maxOutputTokens} output
            tokens and {Math.round((limits?.requestTimeoutMs ?? LIMITS.requestTimeoutMs) / 1000)}s each. Verify sends
            one tiny request.
          </p>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {verifiable.map((c) => {
              const status = statuses[c.id]
              return (
                <li key={c.id} className="flex items-start justify-between gap-3 rounded-xl border border-border/60 bg-secondary/60 p-2.5">
                  <div className="min-w-0">
                    <p className="truncate font-display text-sm">{c.name}</p>
                    {status && <RuntimeBadge state={status.state} className="mt-1" />}
                    {status && <p className="mt-1.5 text-xs leading-snug text-muted-foreground">{status.detail}</p>}
                  </div>
                  <button
                    type="button"
                    onClick={() => void verify(c.id)}
                    disabled={running || status?.state === "loading"}
                    className="shrink-0 rounded-sm border border-border px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:border-primary hover:text-primary disabled:opacity-40"
                  >
                    {status?.state === "ready" ? "Re-verify" : "Verify"}
                  </button>
                </li>
              )
            })}
          </ul>
        </details>
      </section>
    </div>
  )
}
