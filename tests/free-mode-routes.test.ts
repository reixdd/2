import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const generateText = vi.fn()
const gatewayFn = vi.fn()

vi.mock("ai", () => ({
  generateText: (...args: unknown[]) => generateText(...args),
  gateway: Object.assign((id: string) => id, { getAvailableModels: (...args: unknown[]) => gatewayFn(...args) }),
}))

const SAME_ORIGIN = { "sec-fetch-site": "same-origin", "content-type": "application/json" }

function post(url: string, body: unknown, headers: Record<string, string> = SAME_ORIGIN) {
  return new Request(url, { method: "POST", headers, body: JSON.stringify(body) })
}

const trialBody = { contenderId: "crystal-mind", challengeId: "the-first-sigil" }

describe("free mode at the route level (mocked AI Gateway)", () => {
  beforeEach(() => {
    vi.resetModules()
    generateText.mockReset()
    gatewayFn.mockReset()
    generateText.mockResolvedValue({ text: "ANSWER: 297", usage: { totalTokens: 10 } })
    gatewayFn.mockResolvedValue({ models: [] })
    delete process.env.COLOSSEUM_LIVE_INFERENCE
    delete process.env.COLOSSEUM_ADMIN_TOKEN
  })
  afterEach(() => {
    delete process.env.COLOSSEUM_LIVE_INFERENCE
    delete process.env.COLOSSEUM_ADMIN_TOKEN
  })

  it("POST /api/trial never reaches the gateway by default", async () => {
    const { POST } = await import("@/app/api/trial/route")
    const response = await POST(post("http://localhost/api/trial", trialBody))
    expect(response.status).toBe(403)
    expect(generateText).not.toHaveBeenCalled()
  })

  it("POST /api/trial ignores a guessed admin header when live inference is off", async () => {
    const { POST } = await import("@/app/api/trial/route")
    const response = await POST(post("http://localhost/api/trial", trialBody, { ...SAME_ORIGIN, "x-colosseum-admin": "guess" }))
    expect(response.status).toBe(403)
    expect(generateText).not.toHaveBeenCalled()
  })

  it("POST /api/runtime verification never probes the model by default", async () => {
    const { POST } = await import("@/app/api/runtime/route")
    const response = await POST(post("http://localhost/api/runtime", { contenderId: "crystal-mind" }))
    expect(response.status).toBe(403)
    expect(generateText).not.toHaveBeenCalled()
  })

  it("GET /api/runtime is free: no generation and no gateway catalog request", async () => {
    const { GET } = await import("@/app/api/runtime/route")
    const response = await GET(new Request("http://localhost/api/runtime", { headers: { "sec-fetch-site": "same-origin" } }))
    expect(response.status).toBe(200)
    expect((await response.json()).mode).toEqual({ live: false })
    expect(generateText).not.toHaveBeenCalled()
    expect(gatewayFn).not.toHaveBeenCalled()
  })

  it("the gateway provider itself refuses in free mode even if a route forgot to authorize", async () => {
    const { gatewayProvider } = await import("@/lib/colosseum/runtime-server")
    await expect(
      gatewayProvider.generate({ modelId: "google/gemma-4-31b-it", prompt: "hi", maxOutputTokens: 5, timeoutMs: 1000 } as never),
    ).rejects.toThrow()
    expect(generateText).not.toHaveBeenCalled()
  })

  it("with live inference enabled and the right token, the same route does call the (mocked) gateway", async () => {
    process.env.COLOSSEUM_LIVE_INFERENCE = "enabled"
    process.env.COLOSSEUM_ADMIN_TOKEN = "a-sufficiently-long-admin-token-0123456789"
    const { POST } = await import("@/app/api/trial/route")
    const response = await POST(
      post("http://localhost/api/trial", trialBody, { ...SAME_ORIGIN, "x-colosseum-admin": process.env.COLOSSEUM_ADMIN_TOKEN }),
    )
    expect(response.status).toBe(200)
    expect(generateText).toHaveBeenCalledTimes(1)
  })
})
