import { describe, expect, it } from "vitest"
import { requestTrial, runPool } from "@/lib/colosseum/trial-client"

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers })

describe("requestTrial", () => {
  const request = { contenderId: "a", challengeId: "b" }

  it("maps a complete outcome", async () => {
    const run = await requestTrial(request, undefined, (async () =>
      json({ status: "complete", text: "ANSWER: 297", extracted: "297", correct: true, latencyMs: 900 })) as typeof fetch)
    expect(run.state).toBe("complete")
    expect(run.correct).toBe(true)
  })

  it("shows quota errors with the retry hint", async () => {
    const run = await requestTrial(request, undefined, (async () =>
      json({ status: "error", error: "Quota reached." }, 429, { "Retry-After": "42" })) as typeof fetch)
    expect(run.state).toBe("error")
    expect(run.error).toContain("Quota reached.")
    expect(run.error).toContain("42s")
  })

  it("turns network failure into an error state instead of throwing", async () => {
    const run = await requestTrial(request, undefined, (async () => {
      throw new TypeError("fetch failed")
    }) as typeof fetch)
    expect(run.state).toBe("error")
  })

  it("does not send anything once cancelled", async () => {
    const controller = new AbortController()
    controller.abort()
    let sent = false
    const run = await requestTrial(request, controller.signal, (async () => {
      sent = true
      return json({})
    }) as typeof fetch)
    expect(run.state).toBe("cancelled")
    expect(sent).toBe(false)
  })

  it("reports an in-flight abort as cancelled", async () => {
    const controller = new AbortController()
    const run = await requestTrial(request, controller.signal, ((_url: string, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")))
        controller.abort()
      })) as unknown as typeof fetch)
    expect(run.state).toBe("cancelled")
  })
})

describe("runPool", () => {
  it("never exceeds the concurrency limit", async () => {
    let active = 0
    let peak = 0
    await runPool([1, 2, 3, 4, 5, 6], 2, async () => {
      active += 1
      peak = Math.max(peak, active)
      await new Promise((resolve) => setTimeout(resolve, 5))
      active -= 1
    })
    expect(peak).toBe(2)
  })

  it("skips queued items after cancellation and reports them", async () => {
    const controller = new AbortController()
    const started: number[] = []
    const skipped: number[] = []
    await runPool(
      [1, 2, 3, 4],
      1,
      async (item) => {
        started.push(item)
        if (item === 2) controller.abort()
      },
      controller.signal,
      (item) => skipped.push(item),
    )
    expect(started).toEqual([1, 2])
    expect(skipped).toEqual([3, 4])
  })
})
