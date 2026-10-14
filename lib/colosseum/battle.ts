/**
 * Reconstructed companion logic for the recovered components/battle-stage.tsx.
 *
 * This is NEW source authored from the surviving component's import contract and
 * the previous Claude test transcript; it is NOT claimed as Claude's lost original.
 * The caller must adapt genuine trial data into BattleRecord. This module NEVER
 * generates a model response, an evaluation result, or a public ranking.
 */

export type BattleMode = 'recorded' | 'local-ai' | 'practice'
export type BattlePhase = 'idle' | 'summoning' | 'preparing' | 'attempting' | 'revealing' | 'result' | 'inspecting'
export type BattleOutcome = 'correct' | 'incorrect' | 'unchecked'

export type BattleRecord = {
  mode: BattleMode
  contenderId: string
  challengeTitle: string
  prompt: string
  answer: string
  checker: string
  correct?: boolean | null
  model?: string
  recordedAt?: string
  evidenceHref?: string
  /** Set ONLY by an explicit, confirmed visitor-initiated local model execution. */
  startedByVisitor?: boolean
}

export const MODE_LABEL: Record<BattleMode, string> = {
  recorded: 'RECORDED REPLAY',
  'local-ai': 'LOCAL AI EXECUTION',
  practice: 'DETERMINISTIC PRACTICE',
}

export const MODE_EXPLAINER: Record<BattleMode, string> = {
  recorded: 'Playback of a previously captured result. No AI is running during playback.',
  'local-ai': 'Presentation of an explicitly initiated on-device AI result.',
  practice: 'A deterministic player exercise; this is not a model evaluation.',
}

export type Validation = { ok: true } | { ok: false; reason: string }
const invalid = (reason: string): Validation => ({ ok: false, reason })
const validText = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0

/** Reject unsafe href schemes in untrusted captured records (anchors render evidenceHref). */
export function isSafeEvidenceHref(href: string): boolean {
  if (!validText(href) || /[\u0000-\u001f]/.test(href)) return false
  if (href.startsWith('/') && !href.startsWith('//') && !href.startsWith('/\\')) return true
  try { const url = new URL(href); return url.protocol === 'https:' } catch { return false }
}

/** Shape/provenance checks. A truthful label alone is NOT independent source attestation. */
export function validateBattleRecord(record: BattleRecord): Validation {
  if (!record || typeof record !== 'object') return invalid('Missing record.')
  if (record.mode !== 'recorded' && record.mode !== 'local-ai' && record.mode !== 'practice') return invalid('Unknown battle mode.')
  if (!validText(record.contenderId) || !validText(record.challengeTitle) || !validText(record.prompt)) return invalid('Missing contender or challenge information.')
  if (typeof record.answer !== 'string') return invalid('Missing captured answer.')
  if (!validText(record.checker)) return invalid('Missing checker provenance.')
  if (record.correct !== undefined && record.correct !== null && typeof record.correct !== 'boolean') return invalid('Invalid checker result.')
  if (record.evidenceHref && !isSafeEvidenceHref(record.evidenceHref)) return invalid('Unsafe evidence link.')

  if (record.mode === 'practice') {
    if (record.model || record.recordedAt || record.evidenceHref || record.startedByVisitor) return invalid('Practice trial contains model or recording provenance.')
    return { ok: true }
  }
  if (!validText(record.model)) return invalid('Model identity is required for AI results.')
  if (record.mode === 'recorded') {
    if (record.startedByVisitor) return invalid('A visitor-started result must not be relabelled as a prior recording.')
    if (!validText(record.recordedAt) || !Number.isFinite(Date.parse(record.recordedAt))) return invalid('Recorded result is missing a valid timestamp.')
    if (!validText(record.evidenceHref)) return invalid('Recorded result is missing its evidence link.')
    return { ok: true }
  }
  if (!record.startedByVisitor) return invalid('Local AI results must originate from an explicit visitor action.')
  if (record.recordedAt && !Number.isFinite(Date.parse(record.recordedAt))) return invalid('Invalid local AI timestamp.')
  return { ok: true }
}

export function outcomeOf(record: BattleRecord): BattleOutcome {
  return record.correct === true ? 'correct' : record.correct === false ? 'incorrect' : 'unchecked'
}

export type BattleBeat = { phase: BattlePhase; ms: number; caption: string }

/** Durations are theatrical playback timing, never measured model generation time. */
export function battleBeats(_record: BattleRecord, reduced = false): BattleBeat[] {
  return [
    { phase: 'idle', ms: 0, caption: 'Ready to inspect a captured challenge.' },
    { phase: 'summoning', ms: reduced ? 0 : 900, caption: 'Summoning the champion…' },
    { phase: 'preparing', ms: reduced ? 0 : 800, caption: 'Preparing the challenge…' },
    { phase: 'attempting', ms: reduced ? 0 : 700, caption: 'Presenting the captured attempt…' },
    { phase: 'revealing', ms: reduced ? 0 : 0, caption: 'Revealing the actual answer…' },
    { phase: 'result', ms: reduced ? 0 : 1200, caption: 'Showing the checker result.' },
    { phase: 'inspecting', ms: 0, caption: 'Inspect the underlying evidence.' },
  ]
}

export function revealDuration(answer: string, reduced = false): number {
  if (reduced) return 0
  return Math.min(2500, Math.max(250, Array.from(answer).length * 17))
}

export function revealedText(answer: string, elapsedMs: number, totalMs: number): string {
  // Reduced-motion playback has totalMs=0: always show the full real answer.
  if (!Number.isFinite(totalMs) || totalMs <= 0) return answer
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) return ''
  if (elapsedMs >= totalMs) return answer
  const chars = Array.from(answer)
  const n = Math.min(chars.length, Math.max(0, Math.floor(chars.length * elapsedMs / totalMs)))
  return chars.slice(0, n).join('')
}
