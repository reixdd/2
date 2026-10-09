import { getContender } from "./characters"
import { getChallenge } from "./challenges"
import { LIMITS, type RequestLimiter } from "./limits"
import { FREE_MODE_MESSAGE } from "./mode-shared"
import type { LiveAuthorization } from "./mode"
import { canAttemptTrial, isRuntimeBlocking, resolveRuntimeStatus, type ProbeRecord, type RuntimeProvider } from "./runtime"
import { runTrial, type TrialOutcome } from "./runner"

const ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/

export interface TrialHandlerDeps {
  /** Required on purpose: a handler cannot be constructed without deciding who may spend. */
  authorize: (request: Request) => LiveAuthorization
  provider: RuntimeProvider
  limiter: RequestLimiter
  getProbe: (modelId: string) => ProbeRecord | null
  recordProbe: (modelId: string, record: ProbeRecord) => void
  now?: () => number
}

export interface HandlerResponse {
  status: number
  body: unknown
  headers?: Record<string, string>
}

export function clientIdFromRequest(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
  return forwarded || request.headers.get("x-real-ip") || "anonymous"
}

/** Browsers always send Origin or Sec-Fetch-Site on same-origin fetches. Anything else is a script hitting the paid endpoint directly. */
export function isSameOriginRequest(request: Request) {
  const fetchSite = request.headers.get("sec-fetch-site")
  if (fetchSite) return fetchSite === "same-origin"
  const origin = request.headers.get("origin")
  if (!origin) return false
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host")
  try {
    return new URL(origin).host === host
  } catch {
    return false
  }
}

async function readBoundedJson(request: Request): Promise<unknown | null> {
  const text = await request.text().catch(() => null)
  if (text === null || text.length === 0 || new TextEncoder().encode(text).length > LIMITS.maxBodyBytes) return null
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

/** The single public refusal. It never reveals whether live mode is configured or which credential check failed. */
export function liveInferenceRefusal(): HandlerResponse {
  return { status: 403, body: { status: "disabled", mode: "free", error: FREE_MODE_MESSAGE } }
}

export async function handleTrialRequest(request: Request, deps: TrialHandlerDeps): Promise<HandlerResponse> {
  // Authorization comes first: nothing below this line may run, parse, or spend for an unauthorized caller.
  if (!deps.authorize(request).allowed) return liveInferenceRefusal()
  if (!isSameOriginRequest(request)) {
    return { status: 403, body: { status: "error", error: "Trials can only be started from the Colosseum site." } }
  }

  const body = (await readBoundedJson(request)) as Record<string, unknown> | null
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { status: 400, body: { status: "error", error: "Request body must be a small JSON object." } }
  }

  const { contenderId, challengeId } = body
  const skillId = body.skillId === undefined || body.skillId === null ? null : body.skillId
  if (typeof contenderId !== "string" || !ID_PATTERN.test(contenderId)) {
    return { status: 400, body: { status: "error", error: "contenderId is missing or malformed." } }
  }
  if (typeof challengeId !== "string" || !ID_PATTERN.test(challengeId)) {
    return { status: 400, body: { status: "error", error: "challengeId is missing or malformed." } }
  }
  if (skillId !== null && (typeof skillId !== "string" || !ID_PATTERN.test(skillId))) {
    return { status: 400, body: { status: "error", error: "skillId is malformed." } }
  }

  const contender = getContender(contenderId)
  if (!contender) return { status: 404, body: { status: "error", error: "Unknown contender." } }
  const challenge = getChallenge(challengeId)
  if (!challenge) return { status: 404, body: { status: "error", error: "Unknown challenge." } }
  if (!challenge.available || !challenge.task) {
    return {
      status: 409,
      body: { status: "unavailable", error: challenge.unavailableReason ?? "This trial is not yet provisioned." },
    }
  }
  if (!contender.modelId) {
    return {
      status: 409,
      body: { status: "unavailable", error: contender.unavailableReason ?? "No runtime is connected for this contender." },
    }
  }

  // A model the provider already refused is not retried until its probe expires; this stops repeated paid failures.
  const now = (deps.now ?? Date.now)()
  const readiness = resolveRuntimeStatus(contender, {
    catalog: null,
    probe: deps.getProbe(contender.modelId),
    now,
    probeTtlMs: LIMITS.probeTtlMs,
  })
  if (!canAttemptTrial(readiness)) {
    return { status: 409, body: { status: "unavailable", error: readiness.detail, errorKind: readiness.errorKind } }
  }

  const clientId = clientIdFromRequest(request)
  const lease = deps.limiter.acquire(clientId)
  if (!lease.ok) {
    return {
      status: 429,
      body: { status: "error", error: lease.message, limit: lease.reason },
      headers: { "Retry-After": String(lease.retryAfterSec) },
    }
  }

  let outcome: TrialOutcome
  try {
    outcome = await runTrial(contenderId, challengeId, skillId as string | null, {
      provider: deps.provider,
      now: deps.now,
      abortSignal: request.signal,
    })
  } finally {
    lease.release()
  }

  if (outcome.usage?.totalTokens) deps.limiter.recordTokens(clientId, outcome.usage.totalTokens)

  if (outcome.status === "complete") {
    deps.recordProbe(contender.modelId, { ok: true, at: now, latencyMs: outcome.latencyMs })
  } else if (outcome.errorKind && isRuntimeBlocking(outcome.errorKind)) {
    deps.recordProbe(contender.modelId, { ok: false, at: now, errorKind: outcome.errorKind, detail: outcome.error })
  }

  const status = outcome.status === "complete" ? 200 : outcome.status === "unavailable" ? 503 : 502
  return { status, body: outcome }
}
