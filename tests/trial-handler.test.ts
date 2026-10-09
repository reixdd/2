import { describe, expect, it } from "vitest"
import { CHALLENGES } from "@/lib/colosseum/challenges"
import { CONTENDERS } from "@/lib/colosseum/characters"
import { RequestLimiter, LIMITS } from "@/lib/colosseum/limits"
import { handleTrialRequest } from "@/lib/colosseum/trial-handler"
import { authorizeLiveInference, type LiveAuthorization } from "@/lib/colosseum/mode"
import type { ProbeRecord, RuntimeProvider } from "@/lib/colosseum/runtime"

const contender = CONTENDERS.find((c) => c.modelId)!
const challenge = CHALLENGES.find((c) => c.available)!

function setup(reply: string | Error = "ANSWER: 297") {
  const probes = new Map<string, ProbeRecord>()
  let calls = 0
  const provider: RuntimeProvider = {
    id: "fake",
    label: "Fake",
    async generate() {
      calls += 1
      if (reply instanceof Error) throw reply
      return { text: reply, usage: { totalTokens: 20 } }
    },
  }
  const limiter = new RequestLimiter({
    maxConcurrentGlobal: 4,
    maxConcurrentPerClient: 2,
    maxRequestsPerWindow: 3,
    maxTokensPerWindow: 1000,
    windowMs: 60_000,
  })
  return {
    deps: {
      authorize: (): LiveAuthorization => ({ allowed: true }),
      provider,
      limiter,
      getProbe: (id: string) => probes.get(id) ?? null,
      recordProbe: (id: string, record: ProbeRecord) => void probes.set(id, record),
    },
    probes,
    callCount: () => calls,
  }
}

function post(body: unknown, headers: Record<string, string> = { "sec-fetch-site": "same-origin" }) {
  return new Request("http://localhost/api/trial", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  })
}

const valid = { contenderId: contender.id, challengeId: challenge.id }

describe("handleTrialRequest", () => {
  it("runs a valid same-origin trial", async () => {
    const { deps, callCount } = setup()
    const result = await handleTrialRequest(post(valid), deps)
    expect(result.status).toBe(200)
    expect((result.body as { correct: boolean }).correct).toBe(true)
    expect(callCount()).toBe(1)
  })

  it("rejects cross-site and header-less callers before any model call", async () => {
    const { deps, callCount } = setup()
    expect((await handleTrialRequest(post(valid, { "sec-fetch-site": "cross-site" }), deps)).status).toBe(403)
    expect((await handleTrialRequest(post(valid, {}), deps)).status).toBe(403)
    expect(callCount()).toBe(0)
  })

  it("accepts a matching Origin header when Sec-Fetch-Site is absent", async () => {
    const { deps } = setup()
    const result = await handleTrialRequest(post(valid, { origin: "http://localhost", host: "localhost" }), deps)
    expect(result.status).toBe(200)
  })

  it("rejects malformed, oversized and unknown input with no model call", async () => {
    const { deps, callCount } = setup()
    expect((await handleTrialRequest(post("not json"), deps)).status).toBe(400)
    expect((await handleTrialRequest(post([1, 2]), deps)).status).toBe(400)
    expect((await handleTrialRequest(post({ contenderId: 5, challengeId: challenge.id }), deps)).status).toBe(400)
    expect((await handleTrialRequest(post({ contenderId: "../etc", challengeId: challenge.id }), deps)).status).toBe(400)
    expect((await handleTrialRequest(post({ ...valid, skillId: { x: 1 } }), deps)).status).toBe(400)
    expect((await handleTrialRequest(post({ ...valid, pad: "x".repeat(LIMITS.maxBodyBytes + 10) }), deps)).status).toBe(400)
    expect((await handleTrialRequest(post({ contenderId: "nobody", challengeId: challenge.id }), deps)).status).toBe(404)
    expect((await handleTrialRequest(post({ contenderId: contender.id, challengeId: "nothing" }), deps)).status).toBe(404)
    expect(callCount()).toBe(0)
  })

  it("answers 409 for unprovisioned challenges", async () => {
    const { deps, callCount } = setup()
    const locked = CHALLENGES.find((c) => !c.available)!
    const result = await handleTrialRequest(post({ contenderId: contender.id, challengeId: locked.id }), deps)
    expect(result.status).toBe(409)
    expect(callCount()).toBe(0)
  })

  it("enforces the quota with a 429 and Retry-After", async () => {
    const { deps } = setup()
    for (let i = 0; i < 3; i++) await handleTrialRequest(post(valid), deps)
    const blocked = await handleTrialRequest(post(valid), deps)
    expect(blocked.status).toBe(429)
    expect(Number(blocked.headers?.["Retry-After"])).toBeGreaterThan(0)
  })

  it("remembers a billing refusal and stops sending paid requests", async () => {
    const { deps, callCount, probes } = setup(Object.assign(new Error("requires a valid credit card"), { statusCode: 403 }))
    const first = await handleTrialRequest(post(valid), deps)
    expect(first.status).toBe(503)
    expect(probes.get(contender.modelId!)?.ok).toBe(false)
    const second = await handleTrialRequest(post(valid), deps)
    expect(second.status).toBe(409)
    expect(callCount()).toBe(1)
  })

  it("marks the model ready after a real successful trial", async () => {
    const { deps, probes } = setup()
    await handleTrialRequest(post(valid), deps)
    expect(probes.get(contender.modelId!)?.ok).toBe(true)
  })

  it("refuses by default in free mode, before parsing, quota or any model call", async () => {
    const { deps, callCount } = setup()
    const freeDeps = { ...deps, authorize: (request: Request) => authorizeLiveInference(request, {}) }
    const result = await handleTrialRequest(post(valid), freeDeps)
    expect(result.status).toBe(403)
    expect(JSON.stringify(result.body)).toContain("free public mode")
    expect(await handleTrialRequest(post("not json"), freeDeps)).toMatchObject({ status: 403 })
    expect(callCount()).toBe(0)
    expect(deps.limiter.snapshot("anonymous").requestsInWindow).toBe(0)
  })

  it("refuses an unauthenticated caller even when live inference is switched on", async () => {
    const { deps, callCount } = setup()
    const env = { COLOSSEUM_LIVE_INFERENCE: "enabled", COLOSSEUM_ADMIN_TOKEN: "a-sufficiently-long-admin-token-0123456789" }
    const liveDeps = { ...deps, authorize: (request: Request) => authorizeLiveInference(request, env) }
    expect((await handleTrialRequest(post(valid), liveDeps)).status).toBe(403)
    expect(callCount()).toBe(0)
    const authorized = await handleTrialRequest(
      post(valid, { "sec-fetch-site": "same-origin", "x-colosseum-admin": env.COLOSSEUM_ADMIN_TOKEN }),
      liveDeps,
    )
    expect(authorized.status).toBe(200)
    expect(callCount()).toBe(1)
  })

  it("charges token usage against the visitor's budget", async () => {
    const { deps } = setup()
    await handleTrialRequest(post(valid, { "sec-fetch-site": "same-origin", "x-forwarded-for": "9.9.9.9" }), deps)
    expect(deps.limiter.snapshot("9.9.9.9").tokensInWindow).toBe(20)
  })
})
