import { describe, expect, it } from "vitest"
import { authorizeLiveInference, getPublicMode, isLiveInferenceEnabled } from "@/lib/colosseum/mode"
import { ADMIN_HEADER } from "@/lib/colosseum/mode-shared"

const TOKEN = "a-sufficiently-long-admin-token-0123456789"
const ON = { COLOSSEUM_LIVE_INFERENCE: "enabled", COLOSSEUM_ADMIN_TOKEN: TOKEN }

function request(token?: string) {
  return new Request("https://colosseum.test/api/trial", {
    method: "POST",
    headers: token === undefined ? {} : { [ADMIN_HEADER]: token },
  })
}

describe("free public mode", () => {
  it("denies everything when the environment is empty", () => {
    expect(authorizeLiveInference(request(TOKEN), {})).toEqual({ allowed: false, code: "live-disabled" })
    expect(getPublicMode({})).toEqual({ live: false })
  })

  it("only treats the exact value 'enabled' as on", () => {
    for (const value of ["true", "1", "ENABLED", "yes", ""]) {
      expect(isLiveInferenceEnabled({ COLOSSEUM_LIVE_INFERENCE: value })).toBe(false)
    }
    expect(isLiveInferenceEnabled(ON)).toBe(true)
  })

  it("refuses when live inference is on but no usable token is configured", () => {
    const missing = { COLOSSEUM_LIVE_INFERENCE: "enabled" }
    const short = { ...missing, COLOSSEUM_ADMIN_TOKEN: "short" }
    expect(authorizeLiveInference(request("short"), missing)).toEqual({ allowed: false, code: "not-configured" })
    expect(authorizeLiveInference(request("short"), short)).toEqual({ allowed: false, code: "not-configured" })
    expect(getPublicMode(short)).toEqual({ live: false })
  })

  it("refuses requests without or with the wrong credential", () => {
    expect(authorizeLiveInference(request(), ON)).toEqual({ allowed: false, code: "missing-credential" })
    expect(authorizeLiveInference(request("wrong"), ON)).toEqual({ allowed: false, code: "invalid-credential" })
    expect(authorizeLiveInference(request(`${TOKEN}x`), ON)).toEqual({ allowed: false, code: "invalid-credential" })
  })

  it("allows only the matching credential while live inference is enabled", () => {
    expect(authorizeLiveInference(request(TOKEN), ON)).toEqual({ allowed: true })
    expect(authorizeLiveInference(request(TOKEN), { ...ON, COLOSSEUM_LIVE_INFERENCE: "disabled" })).toEqual({
      allowed: false,
      code: "live-disabled",
    })
  })

  it("never exposes the credential through the public mode", () => {
    expect(JSON.stringify(getPublicMode(ON))).not.toContain(TOKEN)
  })
})
