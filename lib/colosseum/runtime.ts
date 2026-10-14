import type { Contender } from "./characters"

/**
 * configured   – a model id is assigned, nothing has been verified.
 * available    – the provider catalog lists the model.
 * loading      – a live readiness check is in flight (client-side transient state).
 * ready        – a live probe succeeded recently.
 * running      – a trial is executing (client-side transient state).
 * failed       – the provider rejected a real request; the reason is kept.
 * unavailable  – no runtime can field this contender.
 */
export type RuntimeState = "configured" | "available" | "loading" | "ready" | "running" | "failed" | "unavailable"

export type RuntimeProviderId = "vercel-ai-gateway" | "none"

export type RuntimeErrorKind = "billing" | "auth" | "rate-limit" | "timeout" | "model-not-found" | "network" | "unknown"

export interface RuntimeStatus {
  state: RuntimeState
  provider: RuntimeProviderId
  detail: string
  checkedAt?: number
  latencyMs?: number
  errorKind?: RuntimeErrorKind
}

export interface GenerateRequest {
  modelId: string
  system: string
  prompt: string
  maxOutputTokens: number
  timeoutMs: number
  abortSignal?: AbortSignal
}

export interface GenerateResult {
  text: string
  usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number }
}

/** A runtime turns a model id and prompt into text. Gateway, authenticated providers, local models and external agents all implement this. */
export interface RuntimeProvider {
  id: RuntimeProviderId | string
  label: string
  generate(request: GenerateRequest): Promise<GenerateResult>
}

export interface ProbeRecord {
  ok: boolean
  at: number
  latencyMs?: number
  errorKind?: RuntimeErrorKind
  detail?: string
}

export const RUNTIME_ERROR_MESSAGES: Record<RuntimeErrorKind, string> = {
  billing:
    "The Vercel AI Gateway refused this model because the account is on the free tier or needs billing verification. Top up AI Gateway credits in the Vercel dashboard, then re-verify.",
  auth: "The Vercel AI Gateway rejected the credentials. Check AI Gateway access for this deployment.",
  "rate-limit": "The provider is rate limiting this model right now. Wait a moment and retry.",
  timeout: "The model did not answer inside the time limit, so the request was cancelled.",
  "model-not-found": "The Gateway does not recognise this model id, so it cannot be fielded.",
  network: "The runtime could not be reached.",
  unknown: "The runtime returned an unexpected error.",
}

export function classifyRuntimeError(error: unknown): { kind: RuntimeErrorKind; message: string } {
  const raw = error instanceof Error ? error.message : typeof error === "string" ? error : ""
  const lower = raw.toLowerCase()
  const statusCode =
    typeof error === "object" && error !== null && "statusCode" in error
      ? Number((error as { statusCode?: unknown }).statusCode)
      : undefined
  const name = error instanceof Error ? error.name : ""

  let kind: RuntimeErrorKind = "unknown"
  if (name === "AbortError" || name === "TimeoutError" || lower.includes("timed out") || lower.includes("aborted")) {
    kind = "timeout"
  } else if (
    statusCode === 402 ||
    lower.includes("credit card") ||
    lower.includes("billing") ||
    lower.includes("customer_verification") ||
    lower.includes("free tier") ||
    lower.includes("paid credits") ||
    lower.includes("top-up") ||
    lower.includes("insufficient")
  ) {
    kind = "billing"
  } else if (statusCode === 401 || statusCode === 403 || lower.includes("unauthorized") || lower.includes("api key")) {
    kind = "auth"
  } else if (statusCode === 429 || lower.includes("rate limit")) {
    kind = "rate-limit"
  } else if (statusCode === 404 || lower.includes("model not found")) {
    kind = "model-not-found"
  } else if (lower.includes("fetch failed") || lower.includes("econnrefused") || lower.includes("network")) {
    kind = "network"
  }

  return { kind, message: RUNTIME_ERROR_MESSAGES[kind] }
}

/** Errors that mean the runtime itself cannot serve requests, as opposed to a one-off failure. */
export function isRuntimeBlocking(kind: RuntimeErrorKind) {
  return kind === "billing" || kind === "auth" || kind === "model-not-found"
}

export interface ReadinessInputs {
  /** Model ids the provider catalog lists, or null when the catalog could not be read. */
  catalog: ReadonlySet<string> | null
  probe: ProbeRecord | null
  now: number
  probeTtlMs: number
}

export function resolveRuntimeStatus(contender: Pick<Contender, "modelId" | "unavailableReason">, inputs: ReadinessInputs): RuntimeStatus {
  if (!contender.modelId) {
    return {
      state: "unavailable",
      provider: "none",
      detail: contender.unavailableReason ?? "No runtime is connected for this contender.",
    }
  }

  const { catalog, probe, now, probeTtlMs } = inputs
  if (catalog && !catalog.has(contender.modelId)) {
    return {
      state: "unavailable",
      provider: "vercel-ai-gateway",
      detail: `${contender.modelId} is not listed in the Gateway catalog.`,
      errorKind: "model-not-found",
    }
  }

  if (probe && now - probe.at <= probeTtlMs) {
    if (probe.ok) {
      return {
        state: "ready",
        provider: "vercel-ai-gateway",
        detail: "A live probe succeeded.",
        checkedAt: probe.at,
        latencyMs: probe.latencyMs,
      }
    }
    return {
      state: "failed",
      provider: "vercel-ai-gateway",
      detail: probe.detail ?? RUNTIME_ERROR_MESSAGES[probe.errorKind ?? "unknown"],
      checkedAt: probe.at,
      errorKind: probe.errorKind,
    }
  }

  if (catalog) {
    return {
      state: "available",
      provider: "vercel-ai-gateway",
      detail: "Listed in the Gateway catalog. Not yet verified with a live request.",
    }
  }

  return {
    state: "configured",
    provider: "vercel-ai-gateway",
    detail: "A model id is assigned, but the Gateway catalog could not be read.",
  }
}

/** Whether the Arena may send a paid request for this status. Unverified models may be tried; known-broken ones may not. */
export function canAttemptTrial(status: RuntimeStatus | undefined) {
  if (!status) return true
  return status.state === "configured" || status.state === "available" || status.state === "ready"
}

export const RUNTIME_STATE_LABELS: Record<RuntimeState, string> = {
  configured: "Configured",
  available: "Available",
  loading: "Checking",
  ready: "Ready",
  running: "Running",
  failed: "Failed",
  unavailable: "Unavailable",
}
