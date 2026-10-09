export type Discipline =
  | "Mathematics"
  | "Structured Reasoning"
  | "Research"
  | "Chart Reading"
  | "Memory & Retrieval"
  | "Planning & Tool Use"

export interface ChallengeTask {
  prompt: string
  instructions: string
  check: (raw: string) => { extracted: string | null; correct: boolean }
  expectedDisplay: string
}

export interface Challenge {
  id: string
  /** Bumped whenever the prompt or checker changes, so old evidence stays interpretable. */
  version?: number
  name: string
  discipline: Discipline
  difficulty: "Novice" | "Adept" | "Master"
  description: string
  estimatedRuntime: string
  verification: "Deterministic" | "Not yet provisioned"
  available: boolean
  unavailableReason?: string
  task?: ChallengeTask
}

function numericCheck(expected: number, tolerance = 0.001) {
  return (raw: string) => {
    const match = raw.match(/ANSWER:\s*(-?\d+(?:\.\d+)?)/i)
    const extracted = match ? match[1] : null
    const correct = extracted !== null && Math.abs(Number.parseFloat(extracted) - expected) <= tolerance
    return { extracted, correct }
  }
}

function textCheck(expected: string) {
  return (raw: string) => {
    const match = raw.match(/ANSWER:\s*([^\n]+)/i)
    const extracted = match ? match[1].trim() : null
    const correct = extracted !== null && extracted.toLowerCase().replace(/[.\s]+$/, "") === expected.toLowerCase()
    return { extracted, correct }
  }
}

export const CHALLENGES: Challenge[] = [
  {
    id: "the-first-sigil",
    name: "The First Sigil",
    discipline: "Mathematics",
    difficulty: "Novice",
    description: "A trial of exact arithmetic. A single hidden number must be found through careful computation.",
    estimatedRuntime: "~5-15s per contender",
    verification: "Deterministic",
    available: true,
    task: {
      prompt:
        "A merchant in the Colosseum bazaar sells crystal shards. On day one she sells 17 shards. Each following day she sells 4 more shards than the day before. How many shards does she sell in total over 9 days?",
      instructions:
        "Show brief reasoning, then end your response with a final line in the exact format: ANSWER: <number>",
      check: numericCheck(17 * 9 + 4 * (0 + 1 + 2 + 3 + 4 + 5 + 6 + 7 + 8)),
      expectedDisplay: String(17 * 9 + 4 * (0 + 1 + 2 + 3 + 4 + 5 + 6 + 7 + 8)),
    },
  },
  {
    id: "labyrinth-of-sequences",
    version: 2,
    name: "Labyrinth of Sequences",
    discipline: "Structured Reasoning",
    difficulty: "Adept",
    description: "A multistep logic puzzle requiring consistent constraint tracking across several clues.",
    estimatedRuntime: "~10-25s per contender",
    verification: "Deterministic",
    available: true,
    task: {
      prompt:
        "Five contenders — Sage, Oracle, Scholar, Mind, and Challenger — stand in a line at the Colosseum gate, numbered 1 to 5 from left to right. Oracle stands immediately to the left of Mind. Scholar is at one of the ends. Challenger is not at either end. Sage stands two positions to the right of Scholar. Who stands in position 3?",
      instructions:
        "Show brief reasoning, then end your response with a final line in the exact format: ANSWER: <name>",
      check: textCheck("Sage"),
      expectedDisplay: "Sage",
    },
  },
  {
    id: "the-archive-trial",
    name: "The Archive Trial",
    discipline: "Research",
    difficulty: "Adept",
    description: "Evidence retrieval and source comparison against a verifiable reference corpus.",
    estimatedRuntime: "Not yet provisioned",
    verification: "Not yet provisioned",
    available: false,
    unavailableReason: "Requires a retrievable, independently verifiable source corpus that is not yet connected.",
  },
  {
    id: "the-oracles-eye",
    name: "The Oracle's Eye",
    discipline: "Chart Reading",
    difficulty: "Adept",
    description: "Visual chart comprehension and quantitative image analysis.",
    estimatedRuntime: "Not yet provisioned",
    verification: "Not yet provisioned",
    available: false,
    unavailableReason: "Requires a vision-capable runner and a verified chart dataset that are not yet provisioned.",
  },
  {
    id: "the-memory-vault",
    name: "The Memory Vault",
    discipline: "Memory & Retrieval",
    difficulty: "Master",
    description: "Tests accurate recovery of relevant information from a long controlled context.",
    estimatedRuntime: "Not yet provisioned",
    verification: "Not yet provisioned",
    available: false,
    unavailableReason: "Long-context evaluation harness is still being engineered.",
  },
  {
    id: "the-tool-forge",
    name: "The Tool Forge",
    discipline: "Planning & Tool Use",
    difficulty: "Master",
    description: "Sandboxed multistep tasks requiring a sequence of permissioned tool actions.",
    estimatedRuntime: "Not yet provisioned",
    verification: "Not yet provisioned",
    available: false,
    unavailableReason: "No sandboxed, auditable tool environment is connected yet.",
  },
]

export function getChallenge(id: string) {
  return CHALLENGES.find((c) => c.id === id)
}
