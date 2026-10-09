import { getContender } from "./characters"
import { getChallenge } from "./challenges"
import { getSkill } from "./skills"
import { LIMITS } from "./limits"
import { classifyRuntimeError, isRuntimeBlocking, type RuntimeErrorKind, type RuntimeProvider } from "./runtime"

export interface TrialOutcome {
  status: "complete" | "error" | "unavailable"
  text?: string
  latencyMs?: number
  extracted?: string | null
  correct?: boolean
  error?: string
  errorKind?: RuntimeErrorKind
  usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number }
  /** Provenance recorded with every real result. */
  provenance?: {
    modelId: string
    runtime: string
    challengeId: string
    challengeVersion: number
    skillId: string | null
    maxOutputTokens: number
  }
}

export const BASE_SYSTEM_PROMPT =
  "You are a contender summoned into the COLOSSEUM arena to face a timed trial. Reason briefly and precisely, then comply exactly with the requested final answer format. Do not refuse, and do not add commentary beyond what is requested."

export interface RunnerDeps {
  provider: RuntimeProvider
  now?: () => number
  abortSignal?: AbortSignal
}

/**
 * Runs one contender against one challenge with one real model call.
 *
 * The model that answers is always `contender.modelId`. If that runtime fails the outcome
 * is an error or "unavailable"; the runner never substitutes a different model under the
 * original character's identity.
 */
export async function runTrial(
  contenderId: string,
  challengeId: string,
  skillId: string | null | undefined,
  deps: RunnerDeps,
): Promise<TrialOutcome> {
  const now = deps.now ?? Date.now
  const contender = getContender(contenderId)
  const challenge = getChallenge(challengeId)

  if (!contender) return { status: "error", error: "Unknown contender." }
  if (!challenge || !challenge.task) return { status: "error", error: "This trial is not yet provisioned." }
  if (!contender.modelId) {
    return {
      status: "unavailable",
      error: contender.unavailableReason ?? "No runner is currently provisioned for this contender.",
    }
  }

  let system = BASE_SYSTEM_PROMPT
  if (skillId) {
    const skill = getSkill(skillId)
    if (!skill) return { status: "error", error: "Unknown skill." }
    if (!skill.available || !skill.instructionPrompt) {
      return { status: "unavailable", error: skill.unavailableReason ?? "This skill cannot be equipped yet." }
    }
    system = `${BASE_SYSTEM_PROMPT}\n\n${skill.instructionPrompt}`
  }

  const start = now()
  try {
    const { text, usage } = await deps.provider.generate({
      modelId: contender.modelId,
      system,
      prompt: `${challenge.task.prompt}\n\n${challenge.task.instructions}`,
      maxOutputTokens: LIMITS.maxOutputTokens,
      timeoutMs: LIMITS.requestTimeoutMs,
      abortSignal: deps.abortSignal,
    })
    const latencyMs = now() - start
    const { extracted, correct } = challenge.task.check(text)
    return {
      status: "complete",
      text,
      latencyMs,
      extracted,
      correct,
      usage,
      provenance: {
        modelId: contender.modelId,
        runtime: deps.provider.id,
        challengeId: challenge.id,
        challengeVersion: challenge.version ?? 1,
        skillId: skillId ?? null,
        maxOutputTokens: LIMITS.maxOutputTokens,
      },
    }
  } catch (error) {
    const { kind, message } = classifyRuntimeError(error)
    return {
      status: isRuntimeBlocking(kind) ? "unavailable" : "error",
      error: message,
      errorKind: kind,
      latencyMs: now() - start,
    }
  }
}
