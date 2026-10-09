import { existsSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { CONTENDERS } from "@/lib/colosseum/characters"
import { CHALLENGES } from "@/lib/colosseum/challenges"
import { SKILLS } from "@/lib/colosseum/skills"

describe("roster integrity", () => {
  it("gives every contender a unique id and a portrait file that exists", () => {
    expect(new Set(CONTENDERS.map((c) => c.id)).size).toBe(CONTENDERS.length)
    for (const c of CONTENDERS) {
      if (c.portrait) expect(existsSync(join(process.cwd(), "public", c.portrait)), c.portrait).toBe(true)
    }
  })

  it("only lists a model id for contenders marked operational", () => {
    for (const c of CONTENDERS) {
      if (c.status === "operational") expect(c.modelId, c.id).toBeTruthy()
      else expect(c.unavailableReason, c.id).toBeTruthy()
    }
  })

  it("gives every provisioned challenge a task and every locked one a reason", () => {
    for (const c of CHALLENGES) {
      if (c.available) expect(c.task, c.id).toBeDefined()
      else expect(c.unavailableReason, c.id).toBeTruthy()
    }
  })

  it("gives every available skill instruction text", () => {
    for (const s of SKILLS) {
      if (s.available) expect(s.instructionPrompt, s.id).toBeTruthy()
    }
  })
})
