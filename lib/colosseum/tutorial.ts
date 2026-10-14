import { getChallenge } from "./challenges"

export interface WorkedExample {
  /** Written by the Colosseum authors. It is not the output of any model and is never attributed to one. */
  response: string
  hint: string
}

const EXAMPLES: Record<string, WorkedExample> = {
  "the-first-sigil": {
    hint: "The daily sales form an arithmetic sequence. Add them up, or use the sum formula.",
    response: [
      "Daily sales form an arithmetic sequence with first term 17, common difference 4 and 9 terms.",
      "Sum = 9 / 2 x (2 x 17 + 8 x 4) = 4.5 x 66 = 297.",
      "ANSWER: 297",
    ].join("\n"),
  },
  "labyrinth-of-sequences": {
    hint: "Scholar is at an end, and Sage is two places to Scholar's right. Which end leaves room for that?",
    response: [
      "Scholar is at an end. If Scholar were at 5, Sage would need position 7, so Scholar is at 1 and Sage is at 3.",
      "Positions 2, 4 and 5 remain. Oracle sits immediately left of Mind, so they take 4 and 5, leaving Challenger at 2 (not an end).",
      "Order: Scholar, Challenger, Sage, Oracle, Mind. Position 3 is Sage.",
      "ANSWER: Sage",
    ].join("\n"),
  },
}

export function getWorkedExample(challengeId: string): WorkedExample | null {
  const challenge = getChallenge(challengeId)
  return challenge?.available && challenge.task ? (EXAMPLES[challengeId] ?? null) : null
}
