"use client"

import { useEffect, useMemo, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import {listBuilds} from "@/lib/colosseum/build-store"
import type {AgentBuild} from "@/lib/colosseum/builds"
import { ShieldCheck } from "lucide-react"
import { cn } from "@/lib/utils"
import { CONTENDERS } from "@/lib/colosseum/characters"
import { getChallenge } from "@/lib/colosseum/challenges"
import { loadLastChampion, saveLastChampion } from "@/lib/colosseum/local-state"
import { FREE_MODE_MESSAGE, NOT_YET_TESTED_LABEL, RECORDED_TRIAL_LABEL } from "@/lib/colosseum/mode-shared"
import { PUBLIC_DATA } from "@/lib/colosseum/public-trials-data"
import {
  VERIFICATION_LABELS,
  findComparable,
  formatShareText,
  getRecordedTrials,
  type ValidTrial,
} from "@/lib/colosseum/public-trials"
import { useRuntime } from "@/lib/colosseum/use-runtime"
import { ChampionCarousel } from "./champion-carousel"
import { ContenderPortrait } from "./contender-portrait"
import { LiveArena } from "./live-arena"
import { ReplayPlayer, type ReplayMeta } from "./replay-player"
import { TutorialTrial } from "./tutorial-trial"

const RECORDED_COUNTS = Object.fromEntries(
  CONTENDERS.map((c) => [c.id, getRecordedTrials(PUBLIC_DATA.valid, { contenderId: c.id }).length]),
)

export function ArenaView() {
  const [championId, setChampionId] = useState(CONTENDERS[0].id)
  const [lastBuild,setLastBuild]=useState<AgentBuild|null>(null)
  const [trialId, setTrialId] = useState<string | null>(null)
  const { mode } = useRuntime()

  useEffect(() => {
    const remembered = loadLastChampion()
    if (remembered) setChampionId(remembered)
    void listBuilds().then(items=>setLastBuild(items[0]??null)).catch(()=>{})
  }, [])

  const champion = CONTENDERS.find((c) => c.id === championId) ?? CONTENDERS[0]
  const trials = useMemo(
    () => getRecordedTrials(PUBLIC_DATA.valid, { contenderId: champion.id }),
    [champion.id],
  )
  const selectedTrial = trials.find((t) => t.trial.id === trialId) ?? trials[0] ?? null

  function chooseChampion(id: string) {
    setChampionId(id)
    setTrialId(null)
    saveLastChampion(id)
  }

  return <div className="world-hub">
    <section className="summoning-ground" aria-label="Champion summoning">
      <div className="hub-title"><p className="eyebrow">THE CELESTIAL PROVING GROUNDS</p><h1>Build your champion.<br/><em>Prove its intelligence.</em></h1></div>
      <div className="champion-presence" key={champion.id}>
        <div className="summoning-platform" aria-hidden="true"/>
        {champion.portrait && <Image src={champion.portrait} alt={`${champion.name}, unofficial ${champion.family} champion`} fill priority sizes="(max-width: 700px) 90vw, 580px" className="champion-art" style={{objectPosition:champion.portraitPosition??"50% 40%"}}/>}
      </div>
      <div className="champion-identity" aria-live="polite"><p className="eyebrow">{champion.family} · {champion.archetype}</p><h2>{champion.name}</h2><p className="evidence-marker">{!champion.modelId ? "OFFLINE · no model runner configured" : trials.length ? `${trials.length} recorded trials · replay available` : "NOT YET TESTED · no replayable model evidence"}</p></div>
      <ChampionCarousel contenders={CONTENDERS} selectedId={champion.id} recordedCounts={RECORDED_COUNTS} onSelect={chooseChampion}/>
      <div className="hub-actions"><a className="action primary tactile" href="#trial-heading">Enter trial <span aria-hidden>↗</span></a><Link className="action tactile" href="/workshop">Forge champion <span aria-hidden>⚒</span></Link></div>
      <p className="hub-note">Free exploration. Recorded trials and your own tutorials. No public AI requests.</p>
      {lastBuild&&<Link className="resume-link" href={`/workshop?build=${encodeURIComponent(lastBuild.id)}`}>Continue {lastBuild.name} · saved v{lastBuild.version} →</Link>}
      <Link className="island-teaser tactile" href="/solana"><span aria-hidden>✧</span><div><small>A NEW ISLAND AWAITS</small><strong>Solana Proving Grounds</strong></div><span aria-hidden>↗</span></Link>
    </section>
    <section aria-labelledby="trial-heading" className="evidence-console">
      <div className="section-heading"><div><p className="eyebrow">SUMMON → SELECT → INSPECT</p><h2 id="trial-heading">{selectedTrial ? `${champion.name} · recorded trials` : "Your first trial awaits"}</h2></div><span className="evidence-marker">{selectedTrial ? "RECORDED EVIDENCE" : "TUTORIAL · NOT AN AI RUN"}</span></div>
      {selectedTrial ? <div className="surface"><RecordedTrialPanel trials={trials} selected={selectedTrial} onSelect={setTrialId} comparable={findComparable(PUBLIC_DATA.valid,selectedTrial)}/></div> : <NotYetTested name={champion.name}/>}
    </section>
    <TutorialTrial/>
    {mode.live && <section className="mt-12" aria-label="Operator live mode"><LiveArena/></section>}
  </div>
}

function NotYetTested({ name }: { name: string }) {
  return (
    <div className="flex flex-col items-start gap-2">
      <span className="clip-tag bg-muted px-3 py-1 font-mono text-[10px] font-bold tracking-[0.18em] text-muted-foreground uppercase">
        {NOT_YET_TESTED_LABEL}
      </span>
      <p className="max-w-xl text-sm text-muted-foreground">
        There are no verified recordings for {name} yet, so nothing is claimed about how it performs. Try the tutorial
        below to see how a trial is graded.
      </p>
    </div>
  )
}

function RecordedTrialPanel({
  trials,
  selected,
  onSelect,
  comparable,
}: {
  trials: ValidTrial[]
  selected: ValidTrial
  onSelect: (id: string) => void
  comparable: ValidTrial[]
}) {
  const { trial } = selected
  const meta: ReplayMeta[] = [
    { label: "Evidence", value: VERIFICATION_LABELS[selected.level] },
    { label: "Challenge", value: `${getChallenge(trial.challengeId)?.name ?? trial.challengeId} v${selected.challengeVersion}` },
    ...(trial.modelId ? [{ label: "Model", value: trial.modelId }] : []),
    ...(trial.latencyMs !== undefined ? [{ label: "Latency", value: `${(trial.latencyMs / 1000).toFixed(1)}s` }] : []),
    ...(trial.totalTokens !== undefined ? [{ label: "Tokens", value: String(trial.totalTokens) }] : []),
  ]

  return (
    <div className="flex flex-col gap-4">
      {trials.length > 1 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Recorded trials">
          {trials.map((t) => (
            <button
              key={t.trial.id}
              type="button"
              aria-pressed={t.trial.id === trial.id}
              onClick={() => onSelect(t.trial.id)}
              className={cn(
                "tactile rounded-full border px-3 py-1 font-mono text-[11px] font-semibold",
                t.trial.id === trial.id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:text-primary",
              )}
            >
              {getChallenge(t.trial.challengeId)?.name ?? t.trial.challengeId}
            </button>
          ))}
        </div>
      )}
      <ReplayPlayer
        banner={RECORDED_TRIAL_LABEL}
        challengeId={trial.challengeId}
        response={trial.response}
        meta={meta}
        shareText={formatShareText(selected)}
      />
      {comparable.length > 0 && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5 text-accent" aria-hidden />
          {comparable.length} other recorded {comparable.length === 1 ? "trial answers" : "trials answer"} this same
          challenge at the same version.
        </p>
      )}
    </div>
  )
}
