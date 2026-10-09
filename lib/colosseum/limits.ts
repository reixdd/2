export const LIMITS = {
  /** Hard cap on tokens a single model response may produce. */
  maxOutputTokens: 700,
  /** Wall-clock budget for one model call before it is aborted. */
  requestTimeoutMs: 45_000,
  /** Model calls in flight across every visitor on this server instance. */
  maxConcurrentGlobal: 4,
  /** Model calls in flight for a single visitor. */
  maxConcurrentPerClient: 2,
  /** Model calls one visitor may start inside the rolling window. */
  maxRequestsPerWindow: 24,
  /** Output + input tokens one visitor may spend inside the rolling window. */
  maxTokensPerWindow: 60_000,
  windowMs: 10 * 60_000,
  /** Largest request body the trial endpoint will read. */
  maxBodyBytes: 4_096,
  /** How long a live readiness probe stays trusted. */
  probeTtlMs: 10 * 60_000,
  /** Fighters that can be sent into one Arena battle without an explicit paid-battle confirmation. */
  freeBattleFighters: 1,
  /** Client-side parallelism for an Arena battle. */
  clientConcurrency: 2,
} as const

export type LimitReason = "rate" | "concurrency" | "budget"

export type AcquireResult =
  | { ok: true; release: () => void }
  | { ok: false; reason: LimitReason; retryAfterSec: number; message: string }

export interface LimiterOptions {
  maxConcurrentGlobal: number
  maxConcurrentPerClient: number
  maxRequestsPerWindow: number
  maxTokensPerWindow: number
  windowMs: number
  now?: () => number
}

const MAX_TRACKED_CLIENTS = 5_000

/**
 * In-memory limiter. It protects one server instance; a multi-instance deployment needs a shared
 * store (for example Upstash Redis) for the same guarantees. That limitation is documented in the README.
 */
export class RequestLimiter {
  private readonly hits = new Map<string, number[]>()
  private readonly spend = new Map<string, { at: number; tokens: number }[]>()
  private readonly inflight = new Map<string, number>()
  private globalInflight = 0
  private readonly now: () => number

  constructor(private readonly options: LimiterOptions) {
    this.now = options.now ?? Date.now
  }

  acquire(clientId: string): AcquireResult {
    const now = this.now()
    this.prune(clientId, now)

    if (this.globalInflight >= this.options.maxConcurrentGlobal) {
      return {
        ok: false,
        reason: "concurrency",
        retryAfterSec: 5,
        message: "The arena is at capacity. Wait a few seconds and try again.",
      }
    }
    if ((this.inflight.get(clientId) ?? 0) >= this.options.maxConcurrentPerClient) {
      return {
        ok: false,
        reason: "concurrency",
        retryAfterSec: 5,
        message: `Only ${this.options.maxConcurrentPerClient} model requests may run at once per visitor.`,
      }
    }

    const hits = this.hits.get(clientId) ?? []
    if (hits.length >= this.options.maxRequestsPerWindow) {
      const retryAfterSec = Math.max(1, Math.ceil((hits[0] + this.options.windowMs - now) / 1000))
      return {
        ok: false,
        reason: "rate",
        retryAfterSec,
        message: `Request quota reached (${this.options.maxRequestsPerWindow} per ${Math.round(this.options.windowMs / 60_000)} minutes).`,
      }
    }

    const spent = (this.spend.get(clientId) ?? []).reduce((sum, entry) => sum + entry.tokens, 0)
    if (spent >= this.options.maxTokensPerWindow) {
      return {
        ok: false,
        reason: "budget",
        retryAfterSec: 60,
        message: "Token budget for this window is exhausted.",
      }
    }

    hits.push(now)
    this.hits.set(clientId, hits)
    this.inflight.set(clientId, (this.inflight.get(clientId) ?? 0) + 1)
    this.globalInflight += 1

    let released = false
    return {
      ok: true,
      release: () => {
        if (released) return
        released = true
        this.globalInflight = Math.max(0, this.globalInflight - 1)
        const next = (this.inflight.get(clientId) ?? 1) - 1
        if (next <= 0) this.inflight.delete(clientId)
        else this.inflight.set(clientId, next)
      },
    }
  }

  recordTokens(clientId: string, tokens: number) {
    if (!Number.isFinite(tokens) || tokens <= 0) return
    const entries = this.spend.get(clientId) ?? []
    entries.push({ at: this.now(), tokens })
    this.spend.set(clientId, entries)
  }

  snapshot(clientId: string) {
    const now = this.now()
    this.prune(clientId, now)
    return {
      requestsInWindow: this.hits.get(clientId)?.length ?? 0,
      tokensInWindow: (this.spend.get(clientId) ?? []).reduce((sum, entry) => sum + entry.tokens, 0),
      inflight: this.inflight.get(clientId) ?? 0,
      globalInflight: this.globalInflight,
    }
  }

  private prune(clientId: string, now: number) {
    const cutoff = now - this.options.windowMs
    const hits = this.hits.get(clientId)
    if (hits) {
      const fresh = hits.filter((t) => t > cutoff)
      if (fresh.length) this.hits.set(clientId, fresh)
      else this.hits.delete(clientId)
    }
    const spend = this.spend.get(clientId)
    if (spend) {
      const fresh = spend.filter((entry) => entry.at > cutoff)
      if (fresh.length) this.spend.set(clientId, fresh)
      else this.spend.delete(clientId)
    }
    if (this.hits.size > MAX_TRACKED_CLIENTS) {
      const oldest = this.hits.keys().next().value
      if (oldest !== undefined) this.hits.delete(oldest)
    }
  }
}

export function createDefaultLimiter() {
  return new RequestLimiter({
    maxConcurrentGlobal: LIMITS.maxConcurrentGlobal,
    maxConcurrentPerClient: LIMITS.maxConcurrentPerClient,
    maxRequestsPerWindow: LIMITS.maxRequestsPerWindow,
    maxTokensPerWindow: LIMITS.maxTokensPerWindow,
    windowMs: LIMITS.windowMs,
  })
}

/** Number of paid model requests an Arena battle will send, and whether it needs explicit confirmation. */
export function planBattle(fighterCount: number) {
  return {
    requests: fighterCount,
    needsConfirmation: fighterCount > LIMITS.freeBattleFighters,
  }
}
