import { FREE_MODE_MESSAGE } from "./mode-shared"
import type { TrialOutcome } from "./runner"

export interface TrialRequest {
  contenderId: string
  challengeId: string
  skillId?: string | null
}

export type ClientRunState = "running" | "complete" | "unavailable" | "error" | "cancelled" | "queued"

export interface ClientRun {
  state: ClientRunState
  text?: string
  latencyMs?: number
  correct?: boolean
  extracted?: string | null
  error?: string
  outcome?: TrialOutcome
}

export function toClientRun(outcome: Partial<TrialOutcome> & { status?: string }): ClientRun {
  const state: ClientRunState =
    outcome.status === "complete" ? "complete" : outcome.status === "unavailable" ? "unavailable" : "error"
  return {
    state,
    text: outcome.text,
    latencyMs: outcome.latencyMs,
    correct: outcome.correct,
    extracted: outcome.extracted,
    error: outcome.error,
    outcome: outcome as TrialOutcome,
  }
}

/** Sends one real trial request. Never throws: network failures and cancellation become run states. */
export async function requestTrial(
  request: TrialRequest,
  signal?: AbortSignal,
  fetchImpl: typeof fetch = fetch,
): Promise<ClientRun> {
  if (signal?.aborted) return { state: "cancelled", error: "Cancelled before it started." }
  try {
    const response = await fetchImpl("/api/trial", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
      signal,
    })
    const body = (await response.json().catch(() => null)) as Partial<TrialOutcome> | null
    if (!body) return { state: "error", error: `The runner returned an unreadable response (HTTP ${response.status}).` }
    if (response.status === 403 && (body as { status?: string }).status === "disabled") {
      return { state: "unavailable", error: body.error ?? FREE_MODE_MESSAGE }
    }
    if (response.status === 429) {
      const wait = response.headers.get("Retry-After")
      return {
        state: "error",
        error: `${body.error ?? "Rate limit reached."}${wait ? ` Try again in about ${wait}s.` : ""}`,
      }
    }
    return toClientRun(body)
  } catch (error) {
    if (signal?.aborted || (error instanceof DOMException && error.name === "AbortError")) {
      return { state: "cancelled", error: "Cancelled." }
    }
    return { state: "error", error: "Network error reaching the runner." }
  }
}

/**
 * Runs `worker` over `items` with at most `concurrency` in flight. Items that never started when the
 * signal aborts are reported through `onSkipped` instead of being sent.
 */
export async function runPool<T>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<void>,
  signal?: AbortSignal,
  onSkipped?: (item: T, index: number) => void,
) {
  let next = 0
  const lanes = Array.from({ length: Math.max(1, Math.min(concurrency, items.length)) }, async () => {
    while (next < items.length) {
      const index = next++
      if (signal?.aborted) {
        onSkipped?.(items[index], index)
        continue
      }
      await worker(items[index], index)
    }
  })
  await Promise.all(lanes)
}
