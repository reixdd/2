'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Eye, Play, RotateCcw, ScrollText } from 'lucide-react'
import type { Contender } from '@/lib/data'
import {
  MODE_EXPLAINER, MODE_LABEL, battleBeats, outcomeOf, revealDuration, revealedText, validateBattleRecord,
  type BattlePhase, type BattleRecord,
} from '@/lib/battle'
import { ContenderArt } from '@/components/contender-art'

const usePrefersReducedMotion = () => {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const q = window.matchMedia('(prefers-reduced-motion: reduce)')
    const on = () => setReduced(q.matches)
    on()
    q.addEventListener('change', on)
    return () => q.removeEventListener('change', on)
  }, [])
  return reduced
}

/**
 * A miniature stage that PRESENTS one existing result. It never computes a score:
 * the outcome is `record.correct` from the deterministic checker, shown verbatim.
 * Invalid or mislabelled records are refused (see lib/battle.ts), never rendered as a battle.
 */
export function BattleStage({ record, contender }: { record: BattleRecord; contender: Contender }) {
  const check = validateBattleRecord(record)
  const reduced = usePrefersReducedMotion()
  const [phase, setPhase] = useState<BattlePhase>('idle')
  const [elapsed, setElapsed] = useState(0)
  const timers = useRef<number[]>([])
  const raf = useRef<number | null>(null)

  const stop = useCallback(() => {
    timers.current.forEach(window.clearTimeout)
    timers.current = []
    if (raf.current !== null) cancelAnimationFrame(raf.current)
    raf.current = null
  }, [])
  useEffect(() => stop, [stop])
  // A different record is a different battle: never carry one battle's phase into another.
  // Keyed by content, so a parent re-creating an identical object does not restart the show.
  const recordKey = JSON.stringify(record)
  useEffect(() => { stop(); setPhase('idle'); setElapsed(0) }, [recordKey, stop])

  const total = revealDuration(record.answer, reduced)
  const settle = useCallback(() => { stop(); setElapsed(total); setPhase('inspecting') }, [stop, total])

  const play = useCallback(() => {
    if (!check.ok) return
    stop()
    setElapsed(0)
    if (reduced) { setPhase('inspecting'); setElapsed(total); return }
    const beats = battleBeats(record, false)
    let at = 0
    const at_ = (ms: number, fn: () => void) => { timers.current.push(window.setTimeout(fn, ms)) }
    const ms = (p: BattlePhase) => beats.find(b => b.phase === p)!.ms
    setPhase('summoning')
    at += ms('summoning'); at_(at, () => setPhase('preparing'))
    at += ms('preparing'); at_(at, () => setPhase('attempting'))
    at += ms('attempting')
    at_(at, () => {
      setPhase('revealing')
      const t0 = performance.now()
      const tick = (now: number) => {
        const e = Math.min(total, now - t0)
        setElapsed(e)
        if (e < total) raf.current = requestAnimationFrame(tick)
        else raf.current = null
      }
      raf.current = requestAnimationFrame(tick)
    })
    at += total; at_(at, () => setPhase('result'))
    at += ms('result'); at_(at, () => setPhase('inspecting'))
  }, [check.ok, record, reduced, stop, total])

  if (!check.ok) {
    return (
      <section className="bs bs-refused" role="alert" aria-label="Battle cannot be shown">
        <p className="bs-badge" data-mode="refused">NOT SHOWN</p>
        <p>This record cannot be presented as a battle: {check.reason}</p>
      </section>
    )
  }

  const outcome = outcomeOf(record)
  const beats = battleBeats(record, reduced)
  const caption = beats.find(b => b.phase === phase)?.caption ?? ''
  const showResult = phase === 'result' || phase === 'inspecting'
  const typed = phase === 'idle' || phase === 'summoning' || phase === 'preparing' || phase === 'attempting' ? '' : revealedText(record.answer, elapsed, total)
  const running = phase !== 'idle' && phase !== 'inspecting'

  return (
    <section className="bs" data-phase={phase} data-outcome={showResult ? outcome : 'pending'} data-mode={record.mode} aria-label={`${MODE_LABEL[record.mode]}: ${record.challengeTitle}`}>
      <header className="bs-head">
        <p className="bs-badge" data-mode={record.mode}>{MODE_LABEL[record.mode]}</p>
        <p className="bs-explain">{MODE_EXPLAINER[record.mode]}</p>
      </header>

      <div className="bs-arena">
        <div className="bs-rune" aria-hidden="true" />
        <figure className="bs-hero">
          <div className="bs-hero-art"><ContenderArt contender={contender} eager /></div>
          <figcaption>{contender.name}</figcaption>
        </figure>

        <div className="bs-center">
          <div className="bs-scroll" aria-hidden="true">
            <p className="bs-scroll-title"><ScrollText className="size-4" aria-hidden="true" /> {record.challengeTitle}</p>
            <pre className="bs-ink">{typed}{phase === 'revealing' && <span className="bs-caret">▍</span>}</pre>
          </div>
          {/* Screen readers get the complete verbatim answer at once; the typing is decoration. */}
          <p className="sr-only">{record.answer}</p>
          <p className="bs-verdict" aria-hidden={!showResult}>
            {showResult && (outcome === 'correct' ? 'Checker: correct' : outcome === 'incorrect' ? 'Checker: incorrect' : 'Not checked')}
          </p>
        </div>

        <figure className="bs-crystal">
          <svg viewBox="0 0 120 150" role="img" aria-label={`Challenge crystal: ${record.challengeTitle}`}>
            <polygon points="60,6 108,50 90,134 30,134 12,50" className="bs-crystal-body" />
            <polyline points="60,6 60,134 12,50 108,50 30,134 90,134" className="bs-crystal-facets" />
          </svg>
          <figcaption>The challenge<span className="sr-only"> (not a contender)</span></figcaption>
        </figure>
      </div>

      <p className="bs-caption" role="status" aria-live="polite">{caption}</p>

      <div className="bs-controls">
        {phase === 'idle' && <button type="button" className="rune-btn rune-btn-gold" onClick={play}><Play className="size-4" aria-hidden="true" /> Play battle</button>}
        {running && <button type="button" className="rune-btn rune-btn-ghost" onClick={settle}>Skip to result</button>}
        {phase === 'inspecting' && <button type="button" className="rune-btn rune-btn-ghost" onClick={play}><RotateCcw className="size-4" aria-hidden="true" /> Replay</button>}
      </div>

      <details className="bs-evidence" open={phase === 'inspecting'}>
        <summary><Eye className="size-4" aria-hidden="true" /> Evidence</summary>
        <dl>
          <dt>Challenge</dt><dd>{record.prompt}</dd>
          <dt>{record.mode === 'practice' ? 'Your answer' : 'Answer (verbatim)'}</dt><dd><pre>{record.answer}</pre></dd>
          <dt>Checker</dt><dd>{record.checker} → {outcome === 'unchecked' ? 'not checked' : outcome}</dd>
          {record.model && <><dt>Model</dt><dd>{record.model}</dd></>}
          {record.recordedAt && <><dt>Recorded</dt><dd><time dateTime={record.recordedAt}>{record.recordedAt}</time></dd></>}
          {record.evidenceHref && <><dt>Source</dt><dd><a href={record.evidenceHref}>Open the evidence record</a></dd></>}
        </dl>
      </details>
    </section>
  )
}
