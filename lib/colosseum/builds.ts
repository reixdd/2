import { getContender, type Contender } from "./characters"
import { getSkill, type Skill } from "./skills"
import {localModel} from "./models"

export const BUILD_LIMITS = {
  maxNameLength: 48,
  maxSoulLength: 1_200,
  maxSkills: 4,
  maxBuilds: 24,
  maxRevisions: 20,
} as const

/** The part of a build that changes behaviour. Everything else on a build is bookkeeping. */
export interface BuildConfig {
  contenderId: string
  /** The exact Gateway model the build was configured against. Compared with the roster to detect drift. */
  modelId: string | null
  runtime: string
  soul: string
  skillIds: string[]
  /** No executable tools are connected yet, so any entry here fails validation. */
  toolIds: string[]
  /** No knowledge sources are connected yet, so any entry here fails validation. */
  knowledgeSources: string[]
  /** Socket positions are presentation metadata; instruction identity ignores their order. */
  equipmentSlots?: (string | null)[]
}

export interface BuildRevision {
  version: number
  savedAt: number
  config: BuildConfig
}

export interface AgentBuild {
  id: string
  name: string
  config: BuildConfig
  /** Increments each time a saved edit changes the configuration. */
  version: number
  parentId: string | null
  parentVersion: number | null
  createdAt: number
  updatedAt: number
  /** Earlier saved configurations of this same build, newest first. */
  revisions: BuildRevision[]
}

export type IssueSeverity = "error" | "warning"

export interface ValidationIssue {
  severity: IssueSeverity
  field: "name" | "contender" | "soul" | "skills" | "tools" | "knowledge" | "model"
  message: string
}

export interface BuildValidation {
  issues: ValidationIssue[]
  /** True when there are no errors. Warnings do not block a build. */
  valid: boolean
}

export const DEFAULT_RUNTIME = "vercel-ai-gateway"

export function newId(prefix: string, random: () => number = Math.random, now: () => number = Date.now) {
  return `${prefix}-${now().toString(36)}-${Math.floor(random() * 36 ** 5)
    .toString(36)
    .padStart(5, "0")}`
}

export function configForContender(contender: Contender): BuildConfig {
  return {
    contenderId: contender.id,
    modelId: localModel(contender.id)?.modelId ?? contender.modelId,
    runtime: localModel(contender.id) ? "browser-wasm" : DEFAULT_RUNTIME,
    soul: "",
    skillIds: [],
    toolIds: [],
    knowledgeSources: [],
  }
}

export function createBuild(
  contenderId: string,
  name: string,
  deps: { now?: () => number; random?: () => number } = {},
): AgentBuild {
  const contender = getContender(contenderId)
  if (!contender) throw new Error(`Unknown contender: ${contenderId}`)
  const now = (deps.now ?? Date.now)()
  return {
    id: newId("build", deps.random, deps.now),
    name: name.trim() || `${contender.name} build`,
    config: configForContender(contender),
    version: 1,
    parentId: null,
    parentVersion: null,
    createdAt: now,
    updatedAt: now,
    revisions: [],
  }
}

/** A clone is a new build whose parent is the source at its current version. It starts a fresh revision history. */
export function cloneBuild(source: AgentBuild, deps: { now?: () => number; random?: () => number } = {}): AgentBuild {
  const now = (deps.now ?? Date.now)()
  return {
    id: newId("build", deps.random, deps.now),
    name: `${source.name} (copy)`.slice(0, BUILD_LIMITS.maxNameLength),
    config: cloneConfig(source.config),
    version: 1,
    parentId: source.id,
    parentVersion: source.version,
    createdAt: now,
    updatedAt: now,
    revisions: [],
  }
}

export function cloneConfig(config: BuildConfig): BuildConfig {
  return {
    ...config,
    skillIds: [...config.skillIds],
    toolIds: [...config.toolIds],
    knowledgeSources: [...config.knowledgeSources],
    ...(config.equipmentSlots ? {equipmentSlots:[...config.equipmentSlots]} : {}),
  }
}

/** Order-insensitive for skills, because equipping order does not change which instructions are applied. */
export function configFingerprint(config: BuildConfig) {
  return JSON.stringify({
    c: config.contenderId,
    m: config.modelId,
    r: config.runtime,
    s: config.soul.trim(),
    k: [...config.skillIds].sort(),
    t: [...config.toolIds].sort(),
    n: [...config.knowledgeSources].sort(),
  })
}

export function configsEqual(a: BuildConfig, b: BuildConfig) {
  return configFingerprint(a) === configFingerprint(b)
}

/**
 * Saves an edit. A changed configuration bumps the version and keeps the previous one as a revision;
 * a rename alone does not create a new version.
 */
export function saveBuildEdit(
  build: AgentBuild,
  next: { name: string; config: BuildConfig },
  deps: { now?: () => number } = {},
): AgentBuild {
  const now = (deps.now ?? Date.now)()
  const name = next.name.trim().slice(0, BUILD_LIMITS.maxNameLength) || build.name
  if (configsEqual(build.config, next.config)) {
    return { ...build, name, updatedAt: now }
  }
  const revisions: BuildRevision[] = [
    { version: build.version, savedAt: build.updatedAt, config: cloneConfig(build.config) },
    ...build.revisions,
  ].slice(0, BUILD_LIMITS.maxRevisions)
  return {
    ...build,
    name,
    config: cloneConfig(next.config),
    version: build.version + 1,
    updatedAt: now,
    revisions,
  }
}

export function isSkillCompatible(skill: Skill, contender: Contender | undefined) {
  if (!contender) return false
  return skill.compatibleFamilies === "all" || skill.compatibleFamilies.includes(contender.family)
}

export type EquipResult = { ok: true; config: BuildConfig } | { ok: false; reason: string }

export function equipSkill(config: BuildConfig, skillId: string): EquipResult {
  const skill = getSkill(skillId)
  if (!skill) return { ok: false, reason: "That skill does not exist." }
  if (config.skillIds.includes(skillId)) return { ok: true, config }
  if (!skill.available || !skill.instructionPrompt) {
    return { ok: false, reason: skill.unavailableReason ?? "This skill is not wired into the runtime yet." }
  }
  if (!isSkillCompatible(skill, getContender(config.contenderId))) {
    return { ok: false, reason: `${skill.name} is not compatible with this model family.` }
  }
  if (config.skillIds.length >= BUILD_LIMITS.maxSkills) {
    return { ok: false, reason: `A build can carry at most ${BUILD_LIMITS.maxSkills} skills.` }
  }
  return { ok: true, config: { ...config, skillIds: [...config.skillIds, skillId], equipmentSlots:undefined } }
}

export function unequipSkill(config: BuildConfig, skillId: string): BuildConfig {
  return { ...config, skillIds: config.skillIds.filter((id) => id !== skillId), ...(config.equipmentSlots?{equipmentSlots:config.equipmentSlots.map(id=>id===skillId?null:id)}:{}) }
}

/**
 * Changing the vessel changes the model, so skills that are not compatible with the new one are dropped.
 * Returns which skills were removed so the UI can say so.
 */
export function changeContender(config: BuildConfig, contenderId: string): { config: BuildConfig; dropped: string[] } {
  const contender = getContender(contenderId)
  if (!contender) return { config, dropped: [] }
  const kept: string[] = []
  const dropped: string[] = []
  for (const id of config.skillIds) {
    const skill = getSkill(id)
    if (skill && isSkillCompatible(skill, contender)) kept.push(id)
    else dropped.push(id)
  }
  return {
    config: { ...config, contenderId, modelId: localModel(contender.id)?.modelId ?? contender.modelId, runtime:localModel(contender.id)?"browser-wasm":DEFAULT_RUNTIME, skillIds: kept },
    dropped,
  }
}

export function validateBuild(build: Pick<AgentBuild, "name" | "config">): BuildValidation {
  const issues: ValidationIssue[] = []
  const { config } = build

  if (!build.name.trim()) issues.push({ severity: "error", field: "name", message: "Give the build a name." })
  if (build.name.length > BUILD_LIMITS.maxNameLength) {
    issues.push({ severity: "error", field: "name", message: `Name must be ${BUILD_LIMITS.maxNameLength} characters or fewer.` })
  }

  const contender = getContender(config.contenderId)
  if (!contender) {
    issues.push({ severity: "error", field: "contender", message: "The chosen character no longer exists." })
  } else {
    if (!localModel(contender.id) && (contender.status !== "operational" || !contender.modelId)) {
      issues.push({
        severity: "warning",
        field: "contender",
        message: contender.unavailableReason ?? `${contender.name} has no runtime connected.`,
      })
    } else if (config.modelId !== (localModel(contender.id)?.modelId ?? contender.modelId)) {
      issues.push({
        severity: "warning",
        field: "model",
        message: `This build was saved against ${config.modelId ?? "no model"}, but ${contender.name} now runs ${contender.modelId}. Results may differ from earlier versions.`,
      })
    }
  }

  if (config.soul.length > BUILD_LIMITS.maxSoulLength) {
    issues.push({
      severity: "error",
      field: "soul",
      message: `Instructions must be ${BUILD_LIMITS.maxSoulLength} characters or fewer (currently ${config.soul.length}).`,
    })
  }

  if (config.skillIds.length > BUILD_LIMITS.maxSkills) {
    issues.push({ severity: "error", field: "skills", message: `At most ${BUILD_LIMITS.maxSkills} skills can be equipped.` })
  }
  const seen = new Set<string>()
  for (const id of config.skillIds) {
    const skill = getSkill(id)
    if (seen.has(id)) {
      issues.push({ severity: "error", field: "skills", message: `${skill?.name ?? id} is equipped twice.` })
      continue
    }
    seen.add(id)
    if (!skill) issues.push({ severity: "error", field: "skills", message: `Unknown skill "${id}".` })
    else if (!skill.available || !skill.instructionPrompt) {
      issues.push({ severity: "error", field: "skills", message: `${skill.name}: ${skill.unavailableReason ?? "not available."}` })
    } else if (!isSkillCompatible(skill, contender)) {
      issues.push({ severity: "error", field: "skills", message: `${skill.name} is not compatible with this model family.` })
    }
  }

  if (config.toolIds.length > 0) {
    issues.push({
      severity: "error",
      field: "tools",
      message: "No executable tools are connected to this runtime yet, so a build cannot equip any.",
    })
  }
  if (config.knowledgeSources.length > 0) {
    issues.push({
      severity: "error",
      field: "knowledge",
      message: "No knowledge or retrieval sources are connected yet, so a build cannot reference any.",
    })
  }

  if (config.skillIds.length === 0 && config.soul.trim() === "") {
    issues.push({
      severity: "warning",
      field: "skills",
      message: "This build adds nothing to the bare model, so a comparison against it would measure noise.",
    })
  }

  return { issues, valid: !issues.some((i) => i.severity === "error") }
}

/** One instruction block, built the same way on the client preview and on the server that sends it. */
export function composeInstructions(config: Pick<BuildConfig, "soul" | "skillIds">): string {
  const parts: string[] = []
  const soul = config.soul.trim()
  if (soul) parts.push(soul)
  for (const id of [...config.skillIds].sort()) {
    const skill = getSkill(id)
    if (skill?.instructionPrompt) parts.push(skill.instructionPrompt)
  }
  return parts.join("\n\n")
}

export function describeConfigDiff(from: BuildConfig, to: BuildConfig): string[] {
  const changes: string[] = []
  if (from.contenderId !== to.contenderId || from.modelId !== to.modelId) changes.push("Different model")
  if (from.soul.trim() !== to.soul.trim()) changes.push("Instructions changed")
  const added = to.skillIds.filter((id) => !from.skillIds.includes(id))
  const removed = from.skillIds.filter((id) => !to.skillIds.includes(id))
  for (const id of added) changes.push(`+ ${getSkill(id)?.name ?? id}`)
  for (const id of removed) changes.push(`- ${getSkill(id)?.name ?? id}`)
  if (from.runtime !== to.runtime) changes.push("Runtime changed")
  if (JSON.stringify(from.toolIds) !== JSON.stringify(to.toolIds)) changes.push("Tool configuration changed")
  if (JSON.stringify(from.knowledgeSources) !== JSON.stringify(to.knowledgeSources)) changes.push("Knowledge sources changed")
  return changes
}

export interface BuildReadiness {
  ready: boolean
  reason: string
}

/** Readiness combines a valid configuration with whatever the runtime layer currently reports for the model. */
export function resolveBuildReadiness(
  validation: BuildValidation,
  runtime: { state: string; detail: string } | undefined,
  attemptable: boolean,
): BuildReadiness {
  if (!validation.valid) {
    const first = validation.issues.find((i) => i.severity === "error")
    return { ready: false, reason: first?.message ?? "The configuration is invalid." }
  }
  if (!runtime) return { ready: false, reason: "Checking the runtime for this model..." }
  if (!attemptable) return { ready: false, reason: runtime.detail }
  return { ready: true, reason: runtime.detail }
}
