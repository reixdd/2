import { describe, expect, it } from "vitest"
import { CONTENDERS } from "@/lib/colosseum/characters"
import {
  canAttemptTrial,
  classifyRuntimeError,
  isRuntimeBlocking,
  resolveRuntimeStatus,
  type RuntimeStatus,
} from "@/lib/colosseum/runtime"

const contender = { modelId: "provider/model-a", unavailableReason: undefined }
const base = { now: 10_000, probeTtlMs: 5_000 }

describe("classifyRuntimeError", () => {
  it("recognises billing verification from the Gateway", () => {
    const error = Object.assign(new Error("AI Gateway requires a valid credit card on file"), { statusCode: 403 })
    expect(classifyRuntimeError(error).kind).toBe("billing")
  })

  it("treats a free-tier 403 as billing, not as bad credentials", () => {
    const error = Object.assign(
      new Error("Free tier users do not have access to this model. Upgrade to paid credits at https://vercel.com/d?to=top-up for unrestricted access."),
      { statusCode: 403 },
    )
    expect(classifyRuntimeError(error).kind).toBe("billing")
  })

  it("recognises 402, auth, rate limit, missing model, timeout and network failures", () => {
    expect(classifyRuntimeError(Object.assign(new Error("x"), { statusCode: 402 })).kind).toBe("billing")
    expect(classifyRuntimeError(Object.assign(new Error("denied"), { statusCode: 401 })).kind).toBe("auth")
    expect(classifyRuntimeError(Object.assign(new Error("slow down"), { statusCode: 429 })).kind).toBe("rate-limit")
    expect(classifyRuntimeError(Object.assign(new Error("gone"), { statusCode: 404 })).kind).toBe("model-not-found")
    expect(classifyRuntimeError(Object.assign(new Error("The operation timed out"), { name: "TimeoutError" })).kind).toBe("timeout")
    expect(classifyRuntimeError(new Error("fetch failed")).kind).toBe("network")
    expect(classifyRuntimeError("???").kind).toBe("unknown")
  })

  it("never leaks the raw upstream message", () => {
    const result = classifyRuntimeError(new Error("secret-token-abc123 leaked in provider text"))
    expect(result.message).not.toContain("secret-token")
  })

  it("only treats account-level failures as blocking", () => {
    expect(isRuntimeBlocking("billing")).toBe(true)
    expect(isRuntimeBlocking("auth")).toBe(true)
    expect(isRuntimeBlocking("model-not-found")).toBe(true)
    expect(isRuntimeBlocking("timeout")).toBe(false)
    expect(isRuntimeBlocking("rate-limit")).toBe(false)
  })
})

describe("resolveRuntimeStatus", () => {
  it("marks a contender without a model as unavailable", () => {
    const status = resolveRuntimeStatus({ modelId: null, unavailableReason: "No weights." }, { ...base, catalog: null, probe: null })
    expect(status.state).toBe("unavailable")
    expect(status.detail).toBe("No weights.")
  })

  it("is only configured when the catalog is unknown and nothing was probed", () => {
    expect(resolveRuntimeStatus(contender, { ...base, catalog: null, probe: null }).state).toBe("configured")
  })

  it("is available when listed in the catalog but never verified", () => {
    const status = resolveRuntimeStatus(contender, { ...base, catalog: new Set(["provider/model-a"]), probe: null })
    expect(status.state).toBe("available")
  })

  it("is unavailable when the catalog does not list the model", () => {
    const status = resolveRuntimeStatus(contender, { ...base, catalog: new Set(["other/model"]), probe: null })
    expect(status.state).toBe("unavailable")
    expect(status.errorKind).toBe("model-not-found")
  })

  it("is ready only after a fresh successful probe", () => {
    const catalog = new Set(["provider/model-a"])
    const fresh = resolveRuntimeStatus(contender, { ...base, catalog, probe: { ok: true, at: 9_000, latencyMs: 400 } })
    expect(fresh.state).toBe("ready")
    const stale = resolveRuntimeStatus(contender, { ...base, catalog, probe: { ok: true, at: 1_000 } })
    expect(stale.state).toBe("available")
  })

  it("is failed when the latest probe was refused, with the reason preserved", () => {
    const status = resolveRuntimeStatus(contender, {
      ...base,
      catalog: new Set(["provider/model-a"]),
      probe: { ok: false, at: 9_500, errorKind: "billing", detail: "Needs billing." },
    })
    expect(status.state).toBe("failed")
    expect(status.errorKind).toBe("billing")
    expect(status.detail).toBe("Needs billing.")
  })

  it("never reports the real contender roster as ready without a probe", () => {
    for (const c of CONTENDERS) {
      const status = resolveRuntimeStatus(c, { ...base, catalog: new Set(CONTENDERS.map((x) => x.modelId ?? "")), probe: null })
      expect(status.state).not.toBe("ready")
    }
  })
})

describe("canAttemptTrial", () => {
  const make = (state: RuntimeStatus["state"]): RuntimeStatus => ({ state, provider: "vercel-ai-gateway", detail: "" })

  it("allows unverified and verified models, blocks known-broken ones", () => {
    expect(canAttemptTrial(make("configured"))).toBe(true)
    expect(canAttemptTrial(make("available"))).toBe(true)
    expect(canAttemptTrial(make("ready"))).toBe(true)
    expect(canAttemptTrial(make("failed"))).toBe(false)
    expect(canAttemptTrial(make("unavailable"))).toBe(false)
    expect(canAttemptTrial(undefined)).toBe(true)
  })
})
