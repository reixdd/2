"use client"

import { useState } from "react"
import { FlaskConical, Sparkles, Swords, Zap } from "lucide-react"
import { cn } from "@/lib/utils"
import { CONTENDERS } from "@/lib/colosseum/characters"
import { CHALLENGES } from "@/lib/colosseum/challenges"
import { SKILLS, getSkill } from "@/lib/colosseum/skills"
import { appendEvidence } from "@/lib/colosseum/evidence"
import { requestTrial, type ClientRun } from "@/lib/colosseum/trial-client"

const MAX_MUTATIONS = 3
const fighters = CONTENDERS.filter((c) => c.status === "operational")
const trials = CHALLENGES.filter((c) => c.available)
const skills = SKILLS.filter((s) => s.available)

type Variant = { key: string; skillId: string | null; label: string }

export function OperatorMutationLab() {
  const [contenderId, setContenderId] = useState(fighters[0]?.id ?? "")
  const [challengeId, setChallengeId] = useState(trials[0]?.id ?? "")
  const [picked, setPicked] = useState<string[]>([])
  const [variants, setVariants] = useState<Variant[]>([])
  const [runs, setRuns] = useState<Record<string, ClientRun>>({})
  const [running, setRunning] = useState(false)

  const contender = fighters.find((c) => c.id === contenderId)
  const challenge = trials.find((c) => c.id === challengeId)
  const baseline = runs.base

  function toggle(id: string) {
    if (running) return
    setPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < MAX_MUTATIONS ? [...prev, id] : prev))
  }

  async function run() {
    if (!contender || !challenge || running) return
    const list: Variant[] = [
      { key: "base", skillId: null, label: "Baseline" },
      ...picked.map((id) => ({ key: id, skillId: id, label: getSkill(id)?.name ?? id })),
    ]
    setVariants(list)
    setRuns({})
    setRunning(true)
    for (const v of list) {
      setRuns((prev) => ({ ...prev, [v.key]: { state: "running" } }))
      const result = await requestTrial({ contenderId: contender.id, challengeId: challenge.id, skillId: v.skillId })
      setRuns((prev) => ({ ...prev, [v.key]: result }))
      if (result.state === "complete") {
        appendEvidence({
          id: `${Date.now()}-${contender.id}-${v.key}`,
          timestamp: Date.now(),
          challengeId: challenge.id,
          challengeName: challenge.name,
          discipline: challenge.discipline,
          contenderId: contender.id,
          contenderName: contender.name,
          skillId: v.skillId,
          skillName: v.skillId ? v.label : null,
          correct: Boolean(result.correct),
          latencyMs: result.latencyMs ?? 0,
          extracted: result.extracted ?? null,
          response: result.text ?? "",
          modelId: result.outcome?.provenance?.modelId,
          runtime: result.outcome?.provenance?.runtime,
          challengeVersion: result.outcome?.provenance?.challengeVersion,
          totalTokens: result.outcome?.usage?.totalTokens,
        })
      }
    }
    setRunning(false)
  }

  return (
    <main className="mx-auto max-w-5xl px-4 pb-24 sm:px-6">
      <header className="mutation-hero pt-10 pb-8">
        <span className="clip-tag inline-flex items-center gap-2 bg-secondary px-3 py-1 font-mono text-xs font-bold tracking-widest text-secondary-foreground uppercase">
          <FlaskConical className="h-3 w-3" aria-hidden /> Mutation Lab · Forge Deck
        </span>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-5">
          <div>
            <h1 className="font-display text-4xl text-primary sm:text-5xl">Mutate. Measure.</h1>
            <p className="mt-3 max-w-xl text-muted-foreground">Build a new combat form, then send it into the arena.</p>
          </div>
          <div className="mutation-signal flex items-center gap-2 font-mono text-[10px] tracking-[0.2em] text-accent uppercase"><Sparkles className="h-4 w-4" aria-hidden /> Live sensory feed</div>
        </div>
      </header>

      <section className="mutation-console clip-panel grid gap-5 p-5 sm:grid-cols-2 sm:p-7"> 
        <div className="mutation-fighter-card sm:col-span-2">
          {contender?.portrait && <img src={contender.portrait} alt={`${contender.name} portrait`} className="mutation-fighter-portrait" />}
          <div className="relative z-10">
            <p className="font-mono text-[10px] tracking-[0.24em] text-accent uppercase">Selected combatant</p>
            <h2 className="font-display mt-1 text-3xl text-foreground">{contender?.name}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{contender?.archetype} · {contender?.family}</p>
          </div>
          <Swords className="absolute right-5 top-5 h-6 w-6 text-primary/70" aria-hidden />
        </div>
        <label className="block text-sm font-semibold">
          Fighter
          <select
            value={contenderId}
            onChange={(e) => setContenderId(e.target.value)}
            disabled={running}
            className="mt-2 w-full rounded-xl border bg-background p-3 font-normal"
          >
            {fighters.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-semibold">
          Trial
          <select
            value={challengeId}
            onChange={(e) => setChallengeId(e.target.value)}
            disabled={running}
            className="mt-2 w-full rounded-xl border bg-background p-3 font-normal"
          >
            {trials.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <div className="sm:col-span-2">
          <div className="flex items-end justify-between">
            <h2 className="font-display text-xl">Mutations</h2>
            <span className="font-mono text-xs text-muted-foreground">
              {picked.length} / {MAX_MUTATIONS}
            </span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {skills.map((s) => {
              const on = picked.includes(s.id)
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => toggle(s.id)}
                  aria-pressed={on}
                  title={s.summary}
                  className={cn(
                    "tactile rounded-full border px-4 py-2 text-sm",
                    on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:border-primary",
                  )}
                >
                  {s.name}
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          <button
            type="button"
            onClick={() => void run()}
            disabled={running || !contender || !challenge}
            className="tactile flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-primary-foreground disabled:opacity-40"
          >
            <Zap className="h-4 w-4" aria-hidden /> {running ? "Running…" : "Deploy mutation"}
          </button>
          <span className="text-xs text-muted-foreground">
            {picked.length + 1} live request{picked.length === 0 ? "" : "s"}
          </span>
        </div>
      </section>

      {variants.length > 0 && (
        <section className="mt-8 grid gap-4 sm:grid-cols-2" aria-live="polite">
          {variants.map((v) => {
            const r = runs[v.key]
            const delta =
              r?.state === "complete" && baseline?.state === "complete" && v.key !== "base"
                ? Number(Boolean(r.correct)) - Number(Boolean(baseline.correct))
                : null
            return (
              <article key={v.key} className="clip-panel-sm bg-card p-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-display text-lg">{v.label}</h3>
                  {r?.state === "complete" && (
                    <span
                      className={cn(
                        "rounded-full px-3 py-1 font-mono text-[10px] font-bold uppercase",
                        r.correct ? "bg-emerald-500/15 text-emerald-700" : "bg-destructive/10 text-destructive",
                      )}
                    >
                      {r.correct ? "Correct" : "Missed"}
                    </span>
                  )}
                </div>
                <p className="mt-1 font-mono text-xs text-muted-foreground">
                  {r?.state === "complete"
                    ? `${((r.latencyMs ?? 0) / 1000).toFixed(1)}s · answer ${r.extracted ?? "none"}`
                    : (r?.state ?? "queued")}
                  {delta !== null && delta !== 0 && (
                    <span className={cn("ml-2 font-bold", delta > 0 ? "text-emerald-700" : "text-destructive")}>
                      {delta > 0 ? "Helped" : "Hurt"}
                    </span>
                  )}
                  {delta === 0 && <span className="ml-2">No change</span>}
                </p>
                {r?.error && <p className="mt-2 text-sm text-destructive">{r.error}</p>}
              </article>
            )
          })}
        </section>
      )}
    </main>
  )
}
