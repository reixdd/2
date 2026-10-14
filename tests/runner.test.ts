import { describe, expect, it, vi } from "vitest"
import { CHALLENGES, getChallenge } from "@/lib/colosseum/challenges"
import { CONTENDERS } from "@/lib/colosseum/characters"
import { LIMITS } from "@/lib/colosseum/limits"
import { runTrial } from "@/lib/colosseum/runner"
import type { GenerateRequest, RuntimeProvider } from "@/lib/colosseum/runtime"

function fakeProvider(reply: string | Error): RuntimeProvider & { calls: GenerateRequest[] } {
  const calls: GenerateRequest[] = []
  return {
    id: "fake",
    label: "Fake",
    calls,
    async generate(request) {
      calls.push(request)
      if (reply instanceof Error) throw reply
      return { text: reply, usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 } }
    },
  }
}

const operational = CONTENDERS.find((c) => c.modelId)!
const sigil = CHALLENGES.find((c) => c.id === "the-first-sigil")!

describe("runTrial", () => {
  it("sends exactly the contender's own model id, with output and time caps", async () => {
    const provider = fakeProvider("Reasoning...\nANSWER: 297")
    const outcome = await runTrial(operational.id, sigil.id, null, { provider })
    expect(outcome.status).toBe("complete")
    expect(provider.calls).toHaveLength(1)
    expect(provider.calls[0].modelId).toBe(operational.modelId)
    expect(provider.calls[0].maxOutputTokens).toBe(LIMITS.maxOutputTokens)
    expect(provider.calls[0].timeoutMs).toBe(LIMITS.requestTimeoutMs)
  })

  it("records provenance and token usage with a real result", async () => {
    const outcome = await runTrial(operational.id, sigil.id, null, { provider: fakeProvider("ANSWER: 297") })
    expect(outcome.correct).toBe(true)
    expect(outcome.usage?.totalTokens).toBe(15)
    expect(outcome.provenance).toMatchObject({
      modelId: operational.modelId,
      runtime: "fake",
      challengeId: sigil.id,
      challengeVersion: 1,
      skillId: null,
    })
  })

  it("scores a wrong answer as incorrect rather than failed", async () => {
    const outcome = await runTrial(operational.id, sigil.id, null, { provider: fakeProvider("ANSWER: 12") })
    expect(outcome.status).toBe("complete")
    expect(outcome.correct).toBe(false)
  })

  it("reports billing refusal as unavailable with a clear reason and never retries another model", async () => {
    const provider = fakeProvider(Object.assign(new Error("requires a valid credit card"), { statusCode: 403 }))
    const outcome = await runTrial(operational.id, sigil.id, null, { provider })
    expect(outcome.status).toBe("unavailable")
    expect(outcome.errorKind).toBe("billing")
    expect(outcome.error).toMatch(/billing/i)
    expect(provider.calls).toHaveLength(1)
  })

  it("reports a timeout as a retryable error, not as unavailable", async () => {
    const provider = fakeProvider(Object.assign(new Error("timed out"), { name: "TimeoutError" }))
    const outcome = await runTrial(operational.id, sigil.id, null, { provider })
    expect(outcome.status).toBe("error")
    expect(outcome.errorKind).toBe("timeout")
  })

  it("never calls a provider for a contender with no model", async () => {
    const offline = CONTENDERS.find((c) => !c.modelId)
    if (!offline) return
    const provider = fakeProvider("ANSWER: 1")
    const outcome = await runTrial(offline.id, sigil.id, null, { provider })
    expect(outcome.status).toBe("unavailable")
    expect(provider.calls).toHaveLength(0)
  })

  it("never calls a provider for an unprovisioned challenge or unknown ids", async () => {
    const locked = CHALLENGES.find((c) => !c.available)!
    const provider = fakeProvider("ANSWER: 1")
    expect((await runTrial(operational.id, locked.id, null, { provider })).status).toBe("error")
    expect((await runTrial("nobody", sigil.id, null, { provider })).status).toBe("error")
    expect((await runTrial(operational.id, sigil.id, "no-such-skill", { provider })).status).toBe("error")
    expect(provider.calls).toHaveLength(0)
  })

  it("passes its abort signal through to the provider", async () => {
    const controller = new AbortController()
    const provider = fakeProvider("ANSWER: 297")
    const spy = vi.spyOn(provider, "generate")
    await runTrial(operational.id, sigil.id, null, { provider, abortSignal: controller.signal })
    expect(spy.mock.calls[0][0].abortSignal).toBe(controller.signal)
  })
})

describe("challenge checkers", () => {
  it("accepts only the verified answers", () => {
    expect(getChallenge("the-first-sigil")!.task!.check("ANSWER: 297").correct).toBe(true)
    expect(getChallenge("the-first-sigil")!.task!.check("ANSWER: 296").correct).toBe(false)
    // Only valid arrangement: Scholar, Challenger, Sage, Oracle, Mind. The earlier key ("Challenger") was wrong.
    expect(getChallenge("labyrinth-of-sequences")!.task!.check("ANSWER: sage.").correct).toBe(true)
    expect(getChallenge("labyrinth-of-sequences")!.task!.check("ANSWER: Challenger").correct).toBe(false)
    expect(getChallenge("labyrinth-of-sequences")!.task!.check("ANSWER: Oracle").correct).toBe(false)
    expect(getChallenge("labyrinth-of-sequences")!.task!.check("no final line").extracted).toBeNull()
  })
})
