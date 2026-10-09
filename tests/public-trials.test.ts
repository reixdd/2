import { describe, expect, it } from "vitest"
import type { EvidenceEntry } from "@/lib/colosseum/evidence"
import {
  findComparable,
  formatShareText,
  loadPublicTrials,
  prepareArchiveExport,
  recordedChallengeIds,
  toEvidenceEntry,
  validatePublicTrial,
  validateTrials,
} from "@/lib/colosseum/public-trials"
import dataset from "@/data/public-trials.json"

const RIGHT = "Sum of the arithmetic series.\nANSWER: 297"
const WRONG = "I think it is 300.\nANSWER: 300"

function record(overrides: Record<string, unknown> = {}) {
  return {
    id: "t1",
    contenderId: "crystal-mind",
    challengeId: "the-first-sigil",
    challengeVersion: 1,
    modelId: "google/gemma-4-31b-it",
    runtime: "ai-gateway",
    response: RIGHT,
    extracted: "297",
    correct: true,
    latencyMs: 4200,
    recordedAt: 1_700_000_000_000,
    claimedLevel: "provenance",
    source: "owner-curated",
    ...overrides,
  }
}

function entry(overrides: Partial<EvidenceEntry> = {}): EvidenceEntry {
  return {
    id: "e1",
    timestamp: 1_700_000_000_000,
    challengeId: "the-first-sigil",
    challengeName: "The First Sigil",
    discipline: "Mathematics",
    contenderId: "crystal-mind",
    contenderName: "Crystal",
    correct: true,
    latencyMs: 4200,
    extracted: "297",
    response: RIGHT,
    modelId: "google/gemma-4-31b-it",
    runtime: "ai-gateway",
    challengeVersion: 1,
    ...overrides,
  }
}

describe("validatePublicTrial", () => {
  it("accepts a consistent record with full provenance", () => {
    const result = validatePublicTrial(record())
    expect(result.ok && result.value.level).toBe("provenance")
  })

  it("re-grades deterministically and accepts incorrect answers that are honestly labelled", () => {
    const result = validatePublicTrial(record({ response: WRONG, extracted: "300", correct: false }))
    expect(result.ok).toBe(true)
  })

  it("rejects a verdict that the checker does not reproduce", () => {
    const result = validatePublicTrial(record({ response: WRONG, extracted: "300", correct: true }))
    expect(result.ok).toBe(false)
  })

  it("rejects a claimed answer that the response does not contain", () => {
    expect(validatePublicTrial(record({ extracted: "298" })).ok).toBe(false)
  })

  it("rejects a model that does not match the champion", () => {
    const result = validatePublicTrial(record({ modelId: "openai/gpt-4.1" }))
    expect(!result.ok && result.reasons.join(" ")).toContain("does not match")
  })

  it("rejects a stale challenge version", () => {
    expect(validatePublicTrial(record({ challengeVersion: 2 })).ok).toBe(false)
  })

  it("rejects unknown champions, unknown challenges and challenges without a checker", () => {
    expect(validatePublicTrial(record({ contenderId: "nobody" })).ok).toBe(false)
    expect(validatePublicTrial(record({ challengeId: "nothing" })).ok).toBe(false)
    expect(validatePublicTrial(record({ challengeId: "the-tool-forge" })).ok).toBe(false)
  })

  it("does not promote a correct answer to provenance", () => {
    const result = validatePublicTrial(record({ modelId: undefined, runtime: undefined, claimedLevel: "provenance" }))
    expect(result.ok).toBe(false)
    const graded = validatePublicTrial(record({ modelId: undefined, runtime: undefined, claimedLevel: "graded" }))
    expect(graded.ok && graded.value.level).toBe("graded")
  })

  it("never treats a recording as independently authenticated", () => {
    const result = validatePublicTrial(record({ claimedLevel: "authenticated" }))
    expect(!result.ok && result.reasons.join(" ")).toContain("authentication")
  })

  it("rejects missing response text", () => {
    expect(validatePublicTrial(record({ response: "" })).ok).toBe(false)
    expect(validatePublicTrial(null).ok).toBe(false)
  })
})

describe("validateTrials", () => {
  it("rejects duplicate ids and keeps the first record", () => {
    const { valid, rejected } = validateTrials([record(), record({ extracted: "297" })])
    expect(valid).toHaveLength(1)
    expect(rejected[0].reasons).toContain("Duplicate record id.")
  })
})

describe("shipped dataset", () => {
  it("loads without error and contains no fabricated replayable trials", () => {
    const loaded = loadPublicTrials(dataset)
    expect(loaded.valid).toEqual([])
    expect(loaded.rejected).toEqual([])
  })

  it("keeps the earlier Scholar and Challenger results as non-replayable attestations", () => {
    const { attestations } = loadPublicTrials(dataset)
    expect(attestations.map((a) => a.contenderId).sort()).toEqual(["ancient-scholar", "unpredictable-challenger"])
    expect(attestations.every((a) => a.replayable === false)).toBe(true)
  })

  it("survives a malformed dataset", () => {
    expect(loadPublicTrials({ nope: true }).valid).toEqual([])
    expect(loadPublicTrials(null).valid).toEqual([])
  })
})

describe("lookup and comparison", () => {
  const { valid } = validateTrials([
    record({ id: "a" }),
    record({ id: "b", contenderId: "polymath-engine", modelId: "openai/gpt-4.1" }),
    record({
      id: "c",
      challengeId: "labyrinth-of-sequences",
      challengeVersion: 2,
      response: "ANSWER: Sage",
      extracted: "Sage",
    }),
    record({
      id: "d",
      challengeId: "labyrinth-of-sequences",
      challengeVersion: 1,
      response: "ANSWER: Challenger",
      extracted: "Challenger",
    }),
  ])

  it("rejects recordings graded against the superseded Labyrinth answer key", () => {
    expect(valid.map((t) => t.trial.id)).not.toContain("d")
  })

  it("lists replayable challenges per champion", () => {
    expect(recordedChallengeIds(valid, "crystal-mind")).toEqual(["the-first-sigil", "labyrinth-of-sequences"])
    expect(recordedChallengeIds(valid, "amber-emissary")).toEqual([])
  })

  it("compares only recordings of the same challenge version", () => {
    expect(findComparable(valid, valid[0]).map((t) => t.trial.id)).toEqual(["b"])
  })

  it("converts back to an evidence entry and formats a share text that says it is recorded", () => {
    expect(toEvidenceEntry(valid[0]).response).toBe(RIGHT)
    const text = formatShareText(valid[0])
    expect(text).toContain("Recorded trial, not a live run")
  })
})

describe("prepareArchiveExport", () => {
  it("separates publishable candidates from rejected entries and keeps the originals", () => {
    const good = entry()
    const legacy = entry({ id: "old", modelId: undefined, runtime: undefined, challengeVersion: undefined })
    const lying = entry({ id: "bad", response: WRONG, extracted: "300", correct: true })
    const result = prepareArchiveExport([good, legacy, lying], new Date("2025-01-01T00:00:00Z"))

    expect(result.original).toHaveLength(3)
    expect(result.candidates.trials.map((t) => t.id)).toEqual(["local-e1", "local-old"])
    expect(result.candidates.levels).toEqual({ "local-e1": "provenance", "local-old": "graded" })
    expect(result.rejected.map((r) => r.id)).toEqual(["local-bad"])
    expect(result.metadata.challenges[0]).toMatchObject({ id: "the-first-sigil", version: 1 })
    expect(result.exportedAt).toBe("2025-01-01T00:00:00.000Z")
  })

  it("exports cleanly when the Archive is empty", () => {
    const result = prepareArchiveExport([])
    expect(result.candidates.trials).toEqual([])
    expect(result.rejected).toEqual([])
  })
})
