'use client'

/** Browser-local COLOSSEUM forge. Build comparisons are configurations, not model evaluations. */
import { useSyncExternalStore } from 'react'
import { MAX_SLOTS, contenderById, fingerprint, skillById } from '@/lib/data'
import {
  createBuild, normalizeBuilds, planMutation, placeSkill, reviseBuild,
  sanitizeSkills, validContenderId,
  type Build, type Dropped,
} from '@/lib/builds'

export type { Build } from '@/lib/builds'
export type Draft = { contenderId: string; skillIds: string[] }
export type PracticeAttempt = {
  id: string; challengeId: string; challengeVersion: number;
  answer: string; correct: boolean; at: string
}
export type State = {
  draft: Draft
  builds: Build[]
  activeBuildId: string | null
  practice: PracticeAttempt[]
  storage: { ok: boolean; error: string | null }
}
export const STORAGE_KEY = 'colosseum:v1'
const DEFAULT_ID = 'capybara-sage'
const empty = (): State => ({
  draft: { contenderId: DEFAULT_ID, skillIds: [] }, builds: [], activeBuildId: null,
  practice: [], storage: { ok: true, error: null },
})

const isPractice = (value: unknown): value is PracticeAttempt => {
  if (!value || typeof value !== 'object') return false
  const p = value as Partial<PracticeAttempt>
  return typeof p.id === 'string' && typeof p.challengeId === 'string' &&
    typeof p.answer === 'string' && typeof p.challengeVersion === 'number' &&
    typeof p.correct === 'boolean' && typeof p.at === 'string'
}

/** Backward-compatible with Claude's first localStorage schema; never trust imported fingerprints. */
export function parseState(raw: string | null): State {
  if (!raw) return empty()
  try {
    const r: unknown = JSON.parse(raw)
    if (!r || typeof r !== 'object') return empty()
    const item = r as Partial<State>
    const contenderId = validContenderId(item.draft?.contenderId)
    const draft = {
      contenderId,
      skillIds: sanitizeSkills(Array.isArray(item.draft?.skillIds) ? item.draft!.skillIds : [], contenderId).skillIds,
    }
    const builds = normalizeBuilds(item.builds)
    const activeBuildId = typeof item.activeBuildId === 'string' && builds.some(b => b.id === item.activeBuildId)
      ? item.activeBuildId : null
    return {
      draft, builds, activeBuildId,
      practice: Array.isArray(item.practice) ? item.practice.filter(isPractice).slice(0, 200) : [],
      storage: { ok: true, error: null },
    }
  } catch { return empty() }
}

export type StorageIO = { get: () => string | null; set: (value: string) => void }
export type ActionResult = { ok: true; build: Build; persisted: boolean } | { ok: false; reason: string }
export type SkillActionResult = ReturnType<typeof placeSkill>
const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`

/** Injectable storage and IDs make all state transitions testable without a browser. */
export function createColosseumStore(io: StorageIO, makeId = uid) {
  let state = empty()
  let hydrated = false
  const listeners = new Set<() => void>()
  const emit = () => listeners.forEach(listener => listener())
  const hydrate = () => {
    if (!hydrated) {
      hydrated = true
      try { state = parseState(io.get()) }
      catch (error) {
        state = { ...empty(), storage: { ok: false, error: String(error) } }
      }
    }
  }
  const persist = (next: State) => {
    hydrate()
    state = next
    let persisted = true
    try {
      io.set(JSON.stringify({ draft: next.draft, builds: next.builds, activeBuildId: next.activeBuildId, practice: next.practice }))
      state = { ...next, storage: { ok: true, error: null } }
    } catch (error) {
      persisted = false
      state = { ...next, storage: { ok: false, error: String(error) } }
    }
    emit()
    return persisted
  }
  const getSnapshot = () => { hydrate(); return state }
  const subscribe = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn) } }
  const active = () => state.builds.find(b => b.id === state.activeBuildId) ?? null
  const actions = {
    setDraftContender(contenderId: string): { ok: boolean; reason: string; dropped: Dropped[] } {
      hydrate()
      const contender = contenderById(contenderId)
      if (!contender || contender.locked) return { ok: false, reason: 'That champion is not available.', dropped: [] }
      const { skillIds, dropped } = sanitizeSkills(state.draft.skillIds, contenderId)
      persist({ ...state, draft: { contenderId, skillIds }, activeBuildId: state.draft.contenderId === contenderId ? state.activeBuildId : null })
      return { ok: true, reason: '', dropped }
    },
    setDraftSkills(skillIds: string[]) {
      hydrate()
      const result = sanitizeSkills(skillIds, state.draft.contenderId)
      persist({ ...state, draft: { ...state.draft, skillIds: result.skillIds } })
      return result
    },
    equip(skillId: string, index?: number): SkillActionResult {
      hydrate()
      const result = placeSkill(state.draft.skillIds, skillId, state.draft.contenderId, index)
      if (result.ok) persist({ ...state, draft: { ...state.draft, skillIds: result.skillIds } })
      return result
    },
    unequip(skillId: string) {
      hydrate()
      persist({ ...state, draft: { ...state.draft, skillIds: state.draft.skillIds.filter(id => id !== skillId) } })
    },
    forge(name: string): ActionResult {
      hydrate()
      if (!name.trim()) return { ok: false, reason: 'Give your new champion a name.' }
      const build = createBuild({ ...state.draft, name }, makeId)
      const persisted = persist({ ...state, builds: [build, ...state.builds], activeBuildId: build.id })
      return { ok: true, build, persisted }
    },
    saveRevision(): ActionResult {
      hydrate()
      const build = active()
      if (!build) return { ok: false, reason: 'Load or forge a build first.' }
      if (fingerprint(build.contenderId, build.skillIds) === fingerprint(state.draft.contenderId, state.draft.skillIds)) {
        return { ok: false, reason: 'No changes to save.' }
      }
      const updated = reviseBuild(build, state.draft)
      const persisted = persist({ ...state, builds: state.builds.map(b => b.id === build.id ? updated : b) })
      return { ok: true, build: updated, persisted }
    },
    loadBuild(id: string) {
      hydrate()
      const build = state.builds.find(b => b.id === id)
      if (!build || !contenderById(build.contenderId) || contenderById(build.contenderId)?.locked) return false
      persist({ ...state, draft: { contenderId: build.contenderId, skillIds: sanitizeSkills(build.skillIds, build.contenderId).skillIds }, activeBuildId: id })
      return true
    },
    loadBuildIntoDraft(build: Build) { return actions.loadBuild(build.id) },
    cloneBuild(id: string): ActionResult {
      hydrate()
      const base = state.builds.find(b => b.id === id)
      if (!base) return { ok: false, reason: 'Build not found.' }
      const build = createBuild({ name: `${base.name} · clone`, contenderId: base.contenderId, skillIds: base.skillIds, origin: 'clone', clonedFromId: id }, makeId)
      const persisted = persist({ ...state, builds: [build, ...state.builds], activeBuildId: build.id, draft: { contenderId: build.contenderId, skillIds: build.skillIds } })
      return { ok: true, build, persisted }
    },
    renameBuild(id: string, name: string) {
      hydrate()
      if (!name.trim() || !state.builds.some(b => b.id === id)) return false
      persist({ ...state, builds: state.builds.map(b => b.id === id ? { ...b, name: name.trim().slice(0, 60) } : b) })
      return true
    },
    deleteBuild(id: string) {
      hydrate()
      if (!state.builds.some(b => b.id === id)) return false
      // Leave descendants' parent IDs intact; lineageRoots treats them as orphan roots.
      persist({ ...state, builds: state.builds.filter(b => b.id !== id), activeBuildId: state.activeBuildId === id ? null : state.activeBuildId })
      return true
    },
    sealMutation({ baseBuildId, variantSkillIds, name }: { baseBuildId: string | null; variantSkillIds: string[]; name: string }):
      | { ok: true; child: Build; parent: Build; persisted: boolean }
      | { ok: false; reason: string } {
      hydrate()
      let base = baseBuildId ? state.builds.find(b => b.id === baseBuildId) : null
      if (baseBuildId && !base) return { ok: false, reason: 'Base build was deleted.' }
      const config = base ?? { id: null, name: contenderById(state.draft.contenderId)?.name ?? 'Champion', ...state.draft, revision: 1 }
      const plan = planMutation({ id: config.id, name: config.name, contenderId: config.contenderId, skillIds: config.skillIds, revision: config.revision }, variantSkillIds, name)
      if (!plan.ok) return { ok: false, reason: plan.reason }
      let builds = [...state.builds]
      if (!base) {
        base = createBuild({ ...state.draft, name: `${config.name} · base` }, makeId)
        builds = [base, ...builds]
      }
      const child = createBuild({ contenderId: base.contenderId, skillIds: variantSkillIds, name, parentId: base.id, parentRevision: base.revision, origin: 'mutation' }, makeId)
      const persisted = persist({ ...state, builds: [child, ...builds], draft: { contenderId: child.contenderId, skillIds: child.skillIds }, activeBuildId: child.id })
      return { ok: true, child, parent: base, persisted }
    },
    // Legacy callers create a named build from the current draft.
    saveBuild(name: string, parentId: string | null = null) {
      hydrate()
      const parent = parentId ? state.builds.find(b => b.id === parentId) : null
      const build = createBuild({ ...state.draft, name, parentId: parent?.id, parentRevision: parent?.revision, origin: parent ? 'mutation' : 'forged' }, makeId)
      persist({ ...state, builds: [build, ...state.builds], activeBuildId: build.id })
      return build
    },
    importBuild(raw: unknown): ActionResult {
      hydrate()
      if (!raw || typeof raw !== 'object') return { ok: false, reason: 'Not a colosseum-build v1 file.' }
      const file = raw as { format?: unknown; version?: unknown; build?: unknown }
      if (file.format !== 'colosseum-build' || file.version !== 1 || !file.build || typeof file.build !== 'object') return { ok: false, reason: 'Not a colosseum-build v1 file.' }
      const b = file.build as Partial<Build>
      if (typeof b.name !== 'string' || !b.name.trim()) return { ok: false, reason: 'Build name missing.' }
      if (typeof b.contenderId !== 'string' || !contenderById(b.contenderId) || contenderById(b.contenderId)?.locked) return { ok: false, reason: 'Unknown or locked champion.' }
      if (!Array.isArray(b.skillIds) || b.skillIds.length > MAX_SLOTS || b.skillIds.some(id => typeof id !== 'string')) return { ok: false, reason: 'Invalid skill list.' }
      const { skillIds, dropped } = sanitizeSkills(b.skillIds, b.contenderId)
      if (dropped.length) return { ok: false, reason: `Invalid skills: ${dropped.map(d => d.reason).join(', ')}` }
      const build = createBuild({ name: b.name, contenderId: b.contenderId, skillIds, origin: 'import' }, makeId)
      const persisted = persist({ ...state, builds: [build, ...state.builds], activeBuildId: build.id, draft: { contenderId: build.contenderId, skillIds: build.skillIds } })
      return { ok: true, build, persisted }
    },
    recordPractice(attempt: Omit<PracticeAttempt, 'id' | 'at'>) {
      hydrate()
      persist({ ...state, practice: [{ ...attempt, id: makeId(), at: new Date().toISOString() }, ...state.practice].slice(0, 200) })
    },
  }
  return { getSnapshot, subscribe, actions, __reload() { hydrated = false; state = empty(); emit() } }
}

const browserIO: StorageIO = {
  get: () => typeof window === 'undefined' ? null : window.localStorage.getItem(STORAGE_KEY),
  set: raw => { if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, raw) },
}
const browserStore = createColosseumStore(browserIO)
export const actions = browserStore.actions
const getServerSnapshot = empty()
export function useStore() {
  return useSyncExternalStore(browserStore.subscribe, browserStore.getSnapshot, () => getServerSnapshot)
}
export function exportBuild(build: Build) {
  return { format: 'colosseum-build', version: 1, build: {
    name: build.name, contenderId: build.contenderId, skillIds: build.skillIds,
    revision: build.revision, fingerprint: build.fingerprint,
  } }
}
export function exportLineage(builds: Build[]) {
  return { format: 'colosseum-lineage', version: 1, exportedAt: new Date().toISOString(), builds }
}
export function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
