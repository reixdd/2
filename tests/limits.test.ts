import { describe, expect, it } from "vitest"
import { LIMITS, RequestLimiter, planBattle } from "@/lib/colosseum/limits"

function makeLimiter(overrides: Partial<ConstructorParameters<typeof RequestLimiter>[0]> = {}) {
  let clock = 1_000_000
  const limiter = new RequestLimiter({
    maxConcurrentGlobal: 3,
    maxConcurrentPerClient: 2,
    maxRequestsPerWindow: 4,
    maxTokensPerWindow: 100,
    windowMs: 60_000,
    now: () => clock,
    ...overrides,
  })
  return { limiter, advance: (ms: number) => (clock += ms) }
}

describe("RequestLimiter", () => {
  it("caps concurrent requests per visitor and frees the slot on release", () => {
    const { limiter } = makeLimiter()
    const a = limiter.acquire("a")
    const b = limiter.acquire("a")
    expect(a.ok && b.ok).toBe(true)
    const blocked = limiter.acquire("a")
    expect(blocked.ok).toBe(false)
    if (!blocked.ok) expect(blocked.reason).toBe("concurrency")
    if (a.ok) a.release()
    expect(limiter.acquire("a").ok).toBe(true)
  })

  it("caps concurrency across all visitors", () => {
    const { limiter } = makeLimiter()
    expect(limiter.acquire("a").ok).toBe(true)
    expect(limiter.acquire("b").ok).toBe(true)
    expect(limiter.acquire("c").ok).toBe(true)
    const blocked = limiter.acquire("d")
    expect(blocked.ok).toBe(false)
  })

  it("release is idempotent", () => {
    const { limiter } = makeLimiter()
    const lease = limiter.acquire("a")
    if (!lease.ok) throw new Error("expected lease")
    lease.release()
    lease.release()
    expect(limiter.snapshot("a").globalInflight).toBe(0)
  })

  it("enforces the rolling request quota and reports when to retry", () => {
    const { limiter, advance } = makeLimiter({ maxRequestsPerWindow: 2 })
    for (let i = 0; i < 2; i++) {
      const lease = limiter.acquire("a")
      if (lease.ok) lease.release()
    }
    const blocked = limiter.acquire("a")
    expect(blocked.ok).toBe(false)
    if (!blocked.ok) {
      expect(blocked.reason).toBe("rate")
      expect(blocked.retryAfterSec).toBeGreaterThan(0)
    }
    advance(61_000)
    expect(limiter.acquire("a").ok).toBe(true)
  })

  it("stops serving a visitor who spent their token budget", () => {
    const { limiter } = makeLimiter()
    limiter.recordTokens("a", 150)
    const blocked = limiter.acquire("a")
    expect(blocked.ok).toBe(false)
    if (!blocked.ok) expect(blocked.reason).toBe("budget")
    expect(limiter.acquire("b").ok).toBe(true)
  })
})

describe("planBattle", () => {
  it("lets a single fighter run without a paid-battle confirmation", () => {
    expect(planBattle(1)).toEqual({ requests: 1, needsConfirmation: false })
  })

  it("requires confirmation once a battle sends more than one paid request", () => {
    expect(planBattle(LIMITS.freeBattleFighters + 1).needsConfirmation).toBe(true)
    expect(planBattle(7)).toEqual({ requests: 7, needsConfirmation: true })
  })
})
