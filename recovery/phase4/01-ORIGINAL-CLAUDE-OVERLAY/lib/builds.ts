/**
 * Pure build logic for COLOSSEUM. No React, no browser APIs.
 * Everything that decides what a build IS (configuration, fingerprint, diff,
 * mutation eligibility, lineage) lives here so it can be unit-tested without
 * a browser. The store and the pages only call into these functions.
 */
import { CONTENDERS, MAX_SLOTS, contenderById, fingerprint, skillById, type Contender, type Skill } from '@/lib/data'

export type BuildOrigin = 'forged' | 'mutation' | 'clone' | 'import'

export type BuildRevision = {
  revision: number
  fingerprint: string
  skillIds: string[]
  at: string
  note: string
}

export type Build = {
  id: string
  name: string
  contenderId: string
  skillIds: string[]
  parentId: string | null
  /** Generation number: root builds are 1, a mutation is parent.revision + 1. In-place saves also bump it. */
  revision: number
  fingerprint: string
  createdAt: string
  updatedAt?: string
  origin?: BuildOrigin
  clonedFromId?: string | null
  /** Earlier states of this same build (in-place saves). Newest last. */
  history?: BuildRevision[]
}

export type Config = { contenderId: string; skillIds: string[] }

/* ------------------------------------------------------------------ */
/* Configuration identity and diff                                     */
/* ------------------------------------------------------------------ */

export const configFingerprint = (c: Config) => fingerprint(c.contenderId, c.skillIds)

/** Order of slots does not change what a build sends, so identity ignores order. */
export function sameConfig(a: Config, b: Config): boolean {
  if (a.contenderId !== b.contenderId) return false
  const x = [...new Set(a.skillIds)].sort()
  const y = [...new Set(b.skillIds)].sort()
  return x.length === y.length && x.every((v, i) => v === y[i])
}

export type ConfigDiff = {
  added: string[]
  removed: string[]
  kept: string[]
  contenderChanged: boolean
  unchanged: boolean
}

export function diffConfigs(before: Config, after: Config): ConfigDiff {
  const b = new Set(before.skillIds)
  const a = new Set(after.skillIds)
  const added = [...a].filter((id) => !b.has(id))
  const removed = [...b].filter((id) => !a.has(id))
  const kept = [...a].filter((id) => b.has(id))
  const contenderChanged = before.contenderId !== after.contenderId
  return { added, removed, kept, contenderChanged, unchanged: !contenderChanged && added.length === 0 && removed.length === 0 }
}

/* ------------------------------------------------------------------ */
/* Compatibility                                                       */
/* ------------------------------------------------------------------ */

export type SkillState = 'equipped' | 'available' | 'incompatible' | 'external' | 'unavailable' | 'experimental'

export type Compat = { ok: boolean; state: SkillState; reason: string | null }

/** A skill is "external" when its blocker is an integration this runtime does not have. */
export function isExternalRequirement(skill: Skill): boolean {
  return !skill.available && /^requires/i.test(skill.unavailableReason ?? '')
}

export function familyCompatible(skill: Skill, contender: Contender | undefined): boolean {
  if (!contender) return false
  const list = skill.compatibleFamilies.trim().toLowerCase()
  if (list === 'all' || list === '') return true
  return list
    .split(/[,;|]/)
    .map((s) => s.trim())
    .includes(contender.family.toLowerCase())
}

export function skillCompat(skillId: string, contenderId: string, equipped: string[] = []): Compat {
  const skill = skillById(skillId)
  const contender = contenderById(contenderId)
  if (!skill) return { ok: false, state: 'unavailable', reason: 'Unknown skill.' }
  if (!contender) return { ok: false, state: 'incompatible', reason: 'Unknown champion.' }
  if (contender.locked) return { ok: false, state: 'incompatible', reason: `${contender.name} has no runtime attached yet.` }
  if (!skill.available) {
    const external = isExternalRequirement(skill)
    return {
      ok: false,
      state: external ? 'external' : 'unavailable',
      reason: skill.unavailableReason ?? 'Not available in this runtime.',
    }
  }
  if (!familyCompatible(skill, contender)) {
    return { ok: false, state: 'incompatible', reason: `${skill.name} is not compatible with the ${contender.family} family.` }
  }
  if (equipped.includes(skillId)) return { ok: true, state: 'equipped', reason: null }
  if ((skill as Skill & { experimental?: boolean }).experimental) return { ok: true, state: 'experimental', reason: null }
  return { ok: true, state: 'available', reason: null }
}

export type Dropped = { id: string; reason: string }

/** Clean a skill list for a contender: dedupe, drop incompatible/unknown, cap at MAX_SLOTS. Reports what it dropped. */
export function sanitizeSkills(skillIds: string[], contenderId: string): { skillIds: string[]; dropped: Dropped[] } {
  const out: string[] = []
  const dropped: Dropped[] = []
  for (const id of skillIds) {
    if (out.includes(id)) {
      dropped.push({ id, reason: 'Duplicate skill.' })
      continue
    }
    const c = skillCompat(id, contenderId)
    if (!c.ok) {
      dropped.push({ id, reason: c.reason ?? 'Incompatible.' })
      continue
    }
    if (out.length >= MAX_SLOTS) {
      dropped.push({ id, reason: `Only ${MAX_SLOTS} slots.` })
      continue
    }
    out.push(id)
  }
  return { skillIds: out, dropped }
}

export type PlaceResult =
  | { ok: true; skillIds: string[]; replaced: string | null; moved: boolean }
  | { ok: false; reason: string }

/**
 * Put a skill into a slot (or the first free slot when index is omitted).
 * - Already equipped: it moves to the target slot.
 * - Target slot occupied and loadout full: the occupant is replaced (and reported).
 * - Target slot occupied and room elsewhere: the skill is inserted and others shift.
 */
export function placeSkill(current: string[], skillId: string, contenderId: string, index?: number): PlaceResult {
  const compat = skillCompat(skillId, contenderId)
  if (!compat.ok) return { ok: false, reason: compat.reason ?? 'That skill cannot be equipped.' }
  const moved = current.includes(skillId)
  const rest = current.filter((id) => id !== skillId)
  if (index === undefined) {
    if (moved) return { ok: false, reason: 'Already equipped.' }
    if (rest.length >= MAX_SLOTS) return { ok: false, reason: `All ${MAX_SLOTS} slots are full. Remove one first.` }
    return { ok: true, skillIds: [...rest, skillId], replaced: null, moved: false }
  }
  const at = Math.max(0, Math.min(index, MAX_SLOTS - 1))
  if (rest.length < MAX_SLOTS) {
    const next = [...rest]
    next.splice(Math.min(at, next.length), 0, skillId)
    return { ok: true, skillIds: next, replaced: null, moved }
  }
  const replaced = rest[at] ?? null
  const next = [...rest]
  next[at] = skillId
  return { ok: true, skillIds: next, replaced, moved }
}

/* ------------------------------------------------------------------ */
/* Build construction                                                  */
/* ------------------------------------------------------------------ */

export type Uid = () => string

export function createBuild(
  input: { name: string; contenderId: string; skillIds: string[]; parentId?: string | null; parentRevision?: number; origin?: BuildOrigin; clonedFromId?: string | null },
  uid: Uid,
  now: () => string = () => new Date().toISOString(),
): Build {
  const at = now()
  return {
    id: uid(),
    name: input.name.trim().slice(0, 60) || 'Unnamed champion',
    contenderId: input.contenderId,
    skillIds: [...input.skillIds],
    parentId: input.parentId ?? null,
    revision: input.parentId ? (input.parentRevision ?? 1) + 1 : 1,
    fingerprint: fingerprint(input.contenderId, input.skillIds),
    createdAt: at,
    updatedAt: at,
    origin: input.origin ?? 'forged',
    clonedFromId: input.clonedFromId ?? null,
    history: [],
  }
}

/** Save a new revision onto the SAME build id. The previous state is pushed to history with a note on what changed. */
export function reviseBuild(build: Build, config: Config, now: () => string = () => new Date().toISOString()): Build {
  const at = now()
  const diff = diffConfigs(build, config)
  const names = (ids: string[]) => ids.map((id) => skillById(id)?.name ?? id).join(', ')
  const parts = [
    diff.contenderChanged ? `champion ${build.contenderId} → ${config.contenderId}` : '',
    diff.added.length ? `+ ${names(diff.added)}` : '',
    diff.removed.length ? `− ${names(diff.removed)}` : '',
  ].filter(Boolean)
  const prev: BuildRevision = {
    revision: build.revision,
    fingerprint: build.fingerprint,
    skillIds: [...build.skillIds],
    at: build.updatedAt ?? build.createdAt,
    note: parts.length ? `replaced by rev ${build.revision + 1}: ${parts.join('; ')}` : `replaced by rev ${build.revision + 1}`,
  }
  return {
    ...build,
    contenderId: config.contenderId,
    skillIds: [...config.skillIds],
    fingerprint: fingerprint(config.contenderId, config.skillIds),
    revision: build.revision + 1,
    updatedAt: at,
    history: [...(build.history ?? []), prev].slice(-50),
  }
}

/* ------------------------------------------------------------------ */
/* Mutation planning                                                   */
/* ------------------------------------------------------------------ */

export type MutationBase = { id: string | null; name: string; contenderId: string; skillIds: string[]; revision: number }

export type MutationPlan =
  | {
      ok: true
      diff: ConfigDiff
      beforeFingerprint: string
      afterFingerprint: string
      /** When the base is an unsaved draft it must be saved first so the mutation has a real parent. */
      needsBaseSave: boolean
      childRevision: number
    }
  | { ok: false; code: 'unchanged' | 'invalid-skill' | 'duplicate' | 'too-many' | 'locked-contender' | 'unknown-contender' | 'empty-name'; reason: string }

/**
 * Decide whether a mutation can be sealed, and say why not if it cannot.
 * The UI shows `reason` verbatim next to the disabled SEAL MUTATION button.
 */
export function planMutation(base: MutationBase, variantSkillIds: string[], name: string): MutationPlan {
  const contender = contenderById(base.contenderId)
  if (!contender) return { ok: false, code: 'unknown-contender', reason: 'This build points at a champion that is not in the roster.' }
  if (contender.locked) return { ok: false, code: 'locked-contender', reason: `${contender.name} has no runtime attached yet, so it cannot be mutated.` }
  if (new Set(variantSkillIds).size !== variantSkillIds.length) {
    return { ok: false, code: 'duplicate', reason: 'The same skill is equipped twice. Remove the duplicate.' }
  }
  if (variantSkillIds.length > MAX_SLOTS) {
    return { ok: false, code: 'too-many', reason: `A build holds at most ${MAX_SLOTS} skills.` }
  }
  for (const id of variantSkillIds) {
    const c = skillCompat(id, base.contenderId)
    if (!c.ok) return { ok: false, code: 'invalid-skill', reason: `${skillById(id)?.name ?? id}: ${c.reason}` }
  }
  const diff = diffConfigs(base, { contenderId: base.contenderId, skillIds: variantSkillIds })
  if (diff.unchanged) {
    return { ok: false, code: 'unchanged', reason: 'Nothing has changed yet. Add or remove a skill to create a mutation.' }
  }
  if (!name.trim()) return { ok: false, code: 'empty-name', reason: 'Give the mutant a name.' }
  return {
    ok: true,
    diff,
    beforeFingerprint: fingerprint(base.contenderId, base.skillIds),
    afterFingerprint: fingerprint(base.contenderId, variantSkillIds),
    needsBaseSave: base.id === null,
    childRevision: base.revision + 1,
  }
}

/** Default mutant name that does not repeat "· mutant · mutant". */
export function mutantName(baseName: string, existing: Build[]): string {
  const stem = baseName.replace(/\s·\smutant(\s\d+)?$/i, '')
  const taken = new Set(existing.map((b) => b.name))
  let candidate = `${stem} · mutant`
  for (let n = 2; taken.has(candidate); n++) candidate = `${stem} · mutant ${n}`
  return candidate
}

export type MutationEvidence =
  | { status: 'configured-not-evaluated'; label: 'CONFIGURED — NOT EVALUATED'; detail: string }
  | { status: 'compared'; label: 'COMPARABLE EVIDENCE EXISTS'; detail: string; before: unknown[]; after: unknown[] }

/**
 * Only claim a comparison if public trial records exist for BOTH fingerprints.
 * Trial records may carry `buildFingerprint`. With today's empty public trial set this always
 * returns configured-not-evaluated, and that is the honest answer.
 */
export function mutationEvidence(beforeFp: string, afterFp: string, trials: unknown[]): MutationEvidence {
  const rows = trials.filter((t): t is { buildFingerprint?: string } => typeof t === 'object' && t !== null)
  const before = rows.filter((t) => t.buildFingerprint === beforeFp)
  const after = rows.filter((t) => t.buildFingerprint === afterFp)
  if (before.length > 0 && after.length > 0) {
    return { status: 'compared', label: 'COMPARABLE EVIDENCE EXISTS', detail: `${before.length} record(s) for the original, ${after.length} for the mutant.`, before, after }
  }
  return {
    status: 'configured-not-evaluated',
    label: 'CONFIGURED — NOT EVALUATED',
    detail: 'No replayable trial exists for both configurations, so no improvement or regression is claimed.',
  }
}

/* ------------------------------------------------------------------ */
/* Lineage                                                             */
/* ------------------------------------------------------------------ */

export const childrenOf = (builds: Build[], id: string) => builds.filter((b) => b.parentId === id)

export function isOrphan(builds: Build[], b: Build): boolean {
  return !!b.parentId && !builds.some((x) => x.id === b.parentId)
}

/** Roots are builds with no parent, or whose parent was deleted. */
export function lineageRoots(builds: Build[]): Build[] {
  return builds.filter((b) => !b.parentId || isOrphan(builds, b))
}

/** Ancestor chain from the build up to its root (cycle-safe). First element is the build itself. */
export function ancestry(builds: Build[], id: string): Build[] {
  const chain: Build[] = []
  const seen = new Set<string>()
  let cur = builds.find((b) => b.id === id)
  while (cur && !seen.has(cur.id)) {
    chain.push(cur)
    seen.add(cur.id)
    cur = cur.parentId ? builds.find((b) => b.id === cur!.parentId) : undefined
  }
  return chain
}

/** Every build id reachable from roots. A build in a parent cycle is unreachable and gets reported. */
export function unreachableBuilds(builds: Build[]): Build[] {
  const seen = new Set<string>()
  const walk = (b: Build) => {
    if (seen.has(b.id)) return
    seen.add(b.id)
    childrenOf(builds, b.id).forEach(walk)
  }
  lineageRoots(builds).forEach(walk)
  return builds.filter((b) => !seen.has(b.id))
}

/* ------------------------------------------------------------------ */
/* Saved / unsaved state                                               */
/* ------------------------------------------------------------------ */

export type SaveState =
  | { kind: 'draft'; label: string }
  | { kind: 'saved'; label: string; build: Build }
  | { kind: 'modified'; label: string; build: Build; diff: ConfigDiff }

export function saveState(draft: Config, active: Build | null | undefined): SaveState {
  if (!active) return { kind: 'draft', label: 'Draft — not saved as a build' }
  if (sameConfig(draft, active)) return { kind: 'saved', label: `Saved · “${active.name}” rev ${active.revision}`, build: active }
  return {
    kind: 'modified',
    label: `Unsaved changes to “${active.name}”`,
    build: active,
    diff: diffConfigs(active, draft),
  }
}

/* ------------------------------------------------------------------ */
/* Persistence normalization                                           */
/* ------------------------------------------------------------------ */

const isStr = (v: unknown): v is string => typeof v === 'string' && v.length > 0

/** Accept anything that was ever written to storage and return a valid Build or null. */
export function normalizeBuild(raw: unknown): Build | null {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as Partial<Build>
  if (!isStr(r.id) || !isStr(r.contenderId)) return null
  const skillIds = Array.isArray(r.skillIds) ? [...new Set(r.skillIds.filter(isStr))].slice(0, MAX_SLOTS) : []
  const createdAt = isStr(r.createdAt) ? r.createdAt : new Date(0).toISOString()
  const history = Array.isArray(r.history)
    ? r.history
        .filter((h): h is BuildRevision => !!h && typeof h === 'object' && typeof (h as BuildRevision).revision === 'number' && Array.isArray((h as BuildRevision).skillIds))
        .map((h) => ({ revision: h.revision, fingerprint: String(h.fingerprint ?? ''), skillIds: h.skillIds.filter(isStr), at: String(h.at ?? ''), note: String(h.note ?? '') }))
    : []
  return {
    id: r.id,
    name: isStr(r.name) ? r.name.slice(0, 60) : 'Unnamed champion',
    contenderId: r.contenderId,
    skillIds,
    parentId: isStr(r.parentId) ? r.parentId : null,
    revision: typeof r.revision === 'number' && r.revision >= 1 ? Math.floor(r.revision) : 1,
    // Always recomputed: a stored fingerprint that disagrees with the configuration is never trusted.
    fingerprint: fingerprint(r.contenderId, skillIds),
    createdAt,
    updatedAt: isStr(r.updatedAt) ? r.updatedAt : createdAt,
    origin: r.origin === 'mutation' || r.origin === 'clone' || r.origin === 'import' || r.origin === 'forged' ? r.origin : undefined,
    clonedFromId: isStr(r.clonedFromId) ? r.clonedFromId : null,
    history,
  }
}

export function normalizeBuilds(raw: unknown): Build[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const out: Build[] = []
  for (const item of raw) {
    const b = normalizeBuild(item)
    if (b && !seen.has(b.id)) {
      seen.add(b.id)
      out.push(b)
    }
  }
  return out
}

/** Roster id → still valid (and not locked)? Used to repair a draft pointing at a removed champion. */
export function validContenderId(id: unknown): string {
  const c = typeof id === 'string' ? CONTENDERS.find((x) => x.id === id) : undefined
  return c && !c.locked ? c.id : 'capybara-sage'
}
