import { getChallenge } from "./challenges"
import { getContender } from "./characters"
import type { EvidenceEntry } from "./evidence"

/**
 * Evidence levels are different claims and are never inferred from correctness alone.
 *
 *  - "graded"     The stored response, re-graded by the current deterministic checker, reproduces the claimed
 *                 answer and verdict. Says nothing about who produced the response.
 *  - "provenance" Graded, AND the record names the model, runtime, challenge version, timing and capture time,
 *                 and those match the roster and challenge definitions. Still self-reported by whoever saved it.
 *  - "authenticated" Independently authenticated execution. Nothing in this project can verify that yet, so a
 *                 record claiming it is rejected rather than trusted.
 */
export type VerificationLevel = "graded" | "provenance" | "authenticated"

const LEVEL_RANK: Record<VerificationLevel, number> = { graded: 0, provenance: 1, authenticated: 2 }

export const VERIFICATION_LABELS: Record<VerificationLevel, string> = {
  graded: "Deterministically graded",
  provenance: "Provenance recorded",
  authenticated: "Independently authenticated",
}

export interface PublicTrial {
  id: string
  contenderId: string
  challengeId: string
  challengeVersion?: number
  modelId?: string
  runtime?: string
  /** Full original response text. Never summarised or rewritten. */
  response: string
  extracted: string | null
  correct: boolean
  latencyMs?: number
  totalTokens?: number
  recordedAt?: number
  /** What the curator says this record proves. Validation can lower it, never raise it. */
  claimedLevel: VerificationLevel
  source: "local-archive" | "owner-curated"
}

/** A result reported by an earlier session whose complete response was not preserved. Not replayable. */
export interface HistoricalAttestation {
  id: string
  contenderId: string
  note: string
  replayable: false
}

export interface PublicTrialDataset {
  schemaVersion: 1
  trials: PublicTrial[]
  historicalAttestations: HistoricalAttestation[]
}

export interface ValidTrial {
  trial: PublicTrial
  level: VerificationLevel
  challengeVersion: number
}

export type TrialValidation = { ok: true; value: ValidTrial } | { ok: false; reasons: string[] }

export interface RejectedTrial {
  id: string
  reasons: string[]
  record: unknown
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value)
}

export function validatePublicTrial(input: unknown): TrialValidation {
  if (!isObject(input)) return { ok: false, reasons: ["Record is not an object."] }
  const reasons: string[] = []
  if (input.status !== undefined && input.status !== "complete") reasons.push("Failed or interrupted trials are preserved as failure records, not scored model outputs.")

  const id = input.id
  if (typeof id !== "string" || id.trim() === "") reasons.push("Missing record id.")
  const response = input.response
  if (typeof response !== "string" || response.trim() === "") reasons.push("Missing original response text.")
  const claimedLevel = input.claimedLevel
  if (claimedLevel !== "graded" && claimedLevel !== "provenance" && claimedLevel !== "authenticated") {
    reasons.push("Missing or unknown claimed verification level.")
  }
  if (typeof input.correct !== "boolean") reasons.push("Missing claimed verdict.")
  if (input.extracted !== null && typeof input.extracted !== "string") reasons.push("Missing claimed extracted answer.")

  const contender = typeof input.contenderId === "string" ? getContender(input.contenderId) : undefined
  if (!contender) reasons.push("Unknown contender.")
  const challenge = typeof input.challengeId === "string" ? getChallenge(input.challengeId) : undefined
  if (!challenge) reasons.push("Unknown challenge.")
  else if (!challenge.available || !challenge.task) reasons.push("Challenge has no deterministic checker, so it cannot be re-graded.")

  if (reasons.length > 0 || !contender || !challenge?.task || typeof response !== "string") return { ok: false, reasons }

  const currentVersion = challenge.version ?? 1
  if (input.challengeVersion !== undefined && input.challengeVersion !== currentVersion) {
    reasons.push(
      `Challenge version ${String(input.challengeVersion)} does not match the current checker (version ${currentVersion}).`,
    )
  }
  if (input.modelId !== undefined) {
    if (!contender.modelId) reasons.push(`${contender.name} has no model attached, so a model identity cannot be confirmed.`)
    else if (input.modelId !== contender.modelId) {
      reasons.push(`Model ${String(input.modelId)} does not match ${contender.name}'s registered model ${contender.modelId}.`)
    }
  }

  const regraded = challenge.task.check(response)
  if (regraded.extracted !== input.extracted) {
    reasons.push(`Re-grading extracted ${JSON.stringify(regraded.extracted)}, but the record claims ${JSON.stringify(input.extracted)}.`)
  }
  if (regraded.correct !== input.correct) {
    reasons.push(`Re-grading says ${regraded.correct ? "correct" : "incorrect"}, but the record claims ${input.correct ? "correct" : "incorrect"}.`)
  }

  if (claimedLevel === "authenticated") {
    reasons.push("Independent authentication is claimed but cannot be verified; no authenticator is configured.")
  }

  const provenanceComplete =
    typeof input.modelId === "string" &&
    typeof input.runtime === "string" &&
    input.runtime !== "" &&
    input.challengeVersion === currentVersion &&
    isFiniteNumber(input.latencyMs) &&
    input.latencyMs >= 0 &&
    isFiniteNumber(input.recordedAt)
  const level: VerificationLevel = provenanceComplete ? "provenance" : "graded"
  if (reasons.length === 0 && LEVEL_RANK[claimedLevel as VerificationLevel] > LEVEL_RANK[level]) {
    reasons.push(
      `Claims "${claimedLevel as string}" but the record only supports "${level}": model, runtime, challenge version, latency and capture time are all required for provenance.`,
    )
  }

  if (reasons.length > 0) return { ok: false, reasons }

  return {
    ok: true,
    value: {
      level,
      challengeVersion: currentVersion,
      trial: {
        id: id as string,
        contenderId: contender.id,
        challengeId: challenge.id,
        challengeVersion: input.challengeVersion as number | undefined,
        modelId: input.modelId as string | undefined,
        runtime: input.runtime as string | undefined,
        response,
        extracted: input.extracted as string | null,
        correct: input.correct as boolean,
        latencyMs: isFiniteNumber(input.latencyMs) ? input.latencyMs : undefined,
        totalTokens: isFiniteNumber(input.totalTokens) ? input.totalTokens : undefined,
        recordedAt: isFiniteNumber(input.recordedAt) ? input.recordedAt : undefined,
        claimedLevel: claimedLevel as VerificationLevel,
        source: input.source === "owner-curated" ? "owner-curated" : "local-archive",
      },
    },
  }
}

export interface ValidatedSet {
  valid: ValidTrial[]
  rejected: RejectedTrial[]
}

/** Validates a batch. The first occurrence of an id wins; later duplicates are rejected, never merged. */
export function validateTrials(records: unknown[]): ValidatedSet {
  const valid: ValidTrial[] = []
  const rejected: RejectedTrial[] = []
  const seen = new Set<string>()
  records.forEach((record, index) => {
    const id = isObject(record) && typeof record.id === "string" && record.id ? record.id : `record-${index}`
    if (seen.has(id)) {
      rejected.push({ id, reasons: ["Duplicate record id."], record })
      return
    }
    seen.add(id)
    const result = validatePublicTrial(record)
    if (result.ok) valid.push(result.value)
    else rejected.push({ id, reasons: result.reasons, record })
  })
  return { valid, rejected }
}

/** Loads the shipped dataset. A malformed dataset yields no trials rather than breaking the site. */
export function loadPublicTrials(dataset: unknown): ValidatedSet & { attestations: HistoricalAttestation[] } {
  if (!isObject(dataset) || dataset.schemaVersion !== 1 || !Array.isArray(dataset.trials)) {
    return { valid: [], rejected: [], attestations: [] }
  }
  const attestations = Array.isArray(dataset.historicalAttestations)
    ? (dataset.historicalAttestations as unknown[]).filter(
        (a): a is HistoricalAttestation =>
          isObject(a) && typeof a.id === "string" && typeof a.contenderId === "string" && typeof a.note === "string",
      )
    : []
  return { ...validateTrials(dataset.trials), attestations }
}

export function getRecordedTrials(
  trials: ValidTrial[],
  filter: { contenderId?: string; challengeId?: string } = {},
): ValidTrial[] {
  return trials.filter(
    (t) =>
      (!filter.contenderId || t.trial.contenderId === filter.contenderId) &&
      (!filter.challengeId || t.trial.challengeId === filter.challengeId),
  )
}

/** Challenges that have at least one replayable recording for this champion. */
export function recordedChallengeIds(trials: ValidTrial[], contenderId: string): string[] {
  return [...new Set(getRecordedTrials(trials, { contenderId }).map((t) => t.trial.challengeId))]
}

/** Recordings are comparable only when they answer the same challenge at the same version. */
export function findComparable(trials: ValidTrial[], subject: ValidTrial): ValidTrial[] {
  return trials.filter(
    (t) =>
      t.trial.id !== subject.trial.id &&
      t.trial.challengeId === subject.trial.challengeId &&
      t.challengeVersion === subject.challengeVersion,
  )
}

export function toEvidenceEntry(valid: ValidTrial): EvidenceEntry {
  const { trial } = valid
  const challenge = getChallenge(trial.challengeId)
  const contender = getContender(trial.contenderId)
  return {
    id: trial.id,
    timestamp: trial.recordedAt ?? 0,
    challengeId: trial.challengeId,
    challengeName: challenge?.name ?? trial.challengeId,
    discipline: challenge?.discipline ?? "",
    contenderId: trial.contenderId,
    contenderName: contender?.name ?? trial.contenderId,
    correct: trial.correct,
    latencyMs: trial.latencyMs ?? 0,
    extracted: trial.extracted,
    response: trial.response,
    modelId: trial.modelId,
    runtime: trial.runtime,
    challengeVersion: valid.challengeVersion,
    totalTokens: trial.totalTokens,
  }
}

/** Turns a locally saved Archive entry into a publication candidate. The claim is what the entry can actually support. */
export function evidenceToCandidate(entry: EvidenceEntry): unknown {
  const provenanceComplete =
    typeof entry.modelId === "string" &&
    typeof entry.runtime === "string" &&
    entry.challengeVersion !== undefined &&
    Number.isFinite(entry.latencyMs) &&
    Number.isFinite(entry.timestamp) &&
    entry.timestamp > 0
  return {
    id: `local-${entry.id}`,
    status: entry.status,
    contenderId: entry.contenderId,
    challengeId: entry.challengeId,
    challengeVersion: entry.challengeVersion,
    modelId: entry.modelId,
    runtime: entry.runtime,
    response: entry.response,
    extracted: entry.extracted,
    correct: entry.correct,
    latencyMs: entry.latencyMs,
    totalTokens: entry.totalTokens,
    recordedAt: entry.timestamp,
    claimedLevel: provenanceComplete ? "provenance" : "graded",
    source: "local-archive",
  }
}

export interface ArchiveExport {
  format: "colosseum-archive-export"
  schemaVersion: 1
  exportedAt: string
  /** Everything stored in the visitor's browser, untouched. */
  original: EvidenceEntry[]
  /** Records that passed validation; paste `trials` into data/public-trials.json to publish them. */
  candidates: { trials: PublicTrial[]; levels: Record<string, VerificationLevel> }
  rejected: RejectedTrial[]
  metadata: {
    challenges: { id: string; name: string; version: number; verification: string }[]
    models: { contenderId: string; modelId: string | null }[]
  }
}

export function prepareArchiveExport(entries: EvidenceEntry[], now: Date = new Date()): ArchiveExport {
  const { valid, rejected } = validateTrials(entries.map(evidenceToCandidate))
  const usedIds = new Set(valid.map((v) => v.trial.id))
  const metadataChallengeIds = new Set(entries.map((e) => e.challengeId))
  const metadataContenderIds = new Set(entries.map((e) => e.contenderId))
  return {
    format: "colosseum-archive-export",
    schemaVersion: 1,
    exportedAt: now.toISOString(),
    original: entries,
    candidates: {
      trials: valid.map((v) => ({ ...v.trial, source: "owner-curated" as const })).filter((t) => usedIds.has(t.id)),
      levels: Object.fromEntries(valid.map((v) => [v.trial.id, v.level])),
    },
    rejected,
    metadata: {
      challenges: [...metadataChallengeIds].flatMap((id) => {
        const challenge = getChallenge(id)
        return challenge ? [{ id, name: challenge.name, version: challenge.version ?? 1, verification: challenge.verification }] : []
      }),
      models: [...metadataContenderIds].flatMap((id) => {
        const contender = getContender(id)
        return contender ? [{ contenderId: id, modelId: contender.modelId }] : []
      }),
    },
  }
}

export function formatShareText(valid: ValidTrial): string {
  const { trial } = valid
  const contender = getContender(trial.contenderId)
  const challenge = getChallenge(trial.challengeId)
  const timing = trial.latencyMs !== undefined ? ` in ${(trial.latencyMs / 1000).toFixed(1)}s` : ""
  return [
    `${contender?.name ?? trial.contenderId} on ${challenge?.name ?? trial.challengeId}: ${trial.correct ? "correct" : "incorrect"}${timing}.`,
    `Evidence: ${VERIFICATION_LABELS[valid.level]}. Recorded trial, not a live run.`,
    "COLOSSEUM — Intelligence Must Be Proven.",
  ].join("\n")
}
