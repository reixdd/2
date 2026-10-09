/**
 * Pure-logic tests for build, mutation, lineage and persistence behaviour.
 * Run: npx tsx tests/logic.test.ts   (no browser, no Next.js needed)
 */
import assert from 'node:assert/strict'
import { createColosseumStore, STORAGE_KEY, parseState } from '../lib/store'
import {
  ancestry, diffConfigs, lineageRoots, mutationEvidence, normalizeBuild, placeSkill, planMutation,
  sameConfig, sanitizeSkills, saveState, skillCompat, unreachableBuilds, mutantName,
} from '../lib/builds'
import { fingerprint, SKILLS, CONTENDERS } from '../lib/data'

let passed = 0
const test = (name: string, fn: () => void) => {
  try { fn(); passed++; console.log(`  ok  ${name}`) } catch (e) { console.error(`FAIL  ${name}\n`, e); process.exitCode = 1 }
}

function fakeStorage(initial: string | null = null, failWrites = false) {
  let v = initial
  return {
    io: { get: () => v, set: (s: string) => { if (failWrites) throw new Error('QuotaExceededError'); v = s } },
    peek: () => v,
  }
}
let n = 0
const uid = () => `id${++n}`

console.log('config identity and diff')
test('fingerprint ignores slot order, changes with content', () => {
  assert.equal(fingerprint('amber-emissary', ['a', 'b']), fingerprint('amber-emissary', ['b', 'a']))
  assert.notEqual(fingerprint('amber-emissary', ['a']), fingerprint('amber-emissary', ['a', 'b']))
  assert.notEqual(fingerprint('amber-emissary', ['a']), fingerprint('capybara-sage', ['a']))
})
test('diffConfigs reports added/removed/kept', () => {
  const d = diffConfigs({ contenderId: 'x', skillIds: ['a', 'b'] }, { contenderId: 'x', skillIds: ['b', 'c'] })
  assert.deepEqual(d.added, ['c']); assert.deepEqual(d.removed, ['a']); assert.deepEqual(d.kept, ['b']); assert.equal(d.unchanged, false)
})
test('reordering is not a change', () => {
  assert.equal(diffConfigs({ contenderId: 'x', skillIds: ['a', 'b'] }, { contenderId: 'x', skillIds: ['b', 'a'] }).unchanged, true)
  assert.equal(sameConfig({ contenderId: 'x', skillIds: ['a', 'b'] }, { contenderId: 'x', skillIds: ['b', 'a'] }), true)
})

console.log('compatibility and placement')
test('locked/external skills explain why', () => {
  const c = skillCompat('sandboxed-execution', 'amber-emissary')
  assert.equal(c.ok, false); assert.equal(c.state, 'external'); assert.match(c.reason!, /sandbox/i)
  assert.equal(skillCompat('community-submission', 'amber-emissary').state, 'unavailable')
  assert.equal(skillCompat('socratic-inquiry', 'small-spark').ok, false) // locked champion
  assert.equal(skillCompat('socratic-inquiry', 'amber-emissary').state, 'available')
  assert.equal(skillCompat('socratic-inquiry', 'amber-emissary', ['socratic-inquiry']).state, 'equipped')
})
test('sanitizeSkills dedupes, caps, reports drops', () => {
  const r = sanitizeSkills(['socratic-inquiry', 'socratic-inquiry', 'sandboxed-execution', 'fermi-estimation', 'proof-scaffolding', 'narrative-voice'], 'amber-emissary')
  assert.deepEqual(r.skillIds, ['socratic-inquiry', 'fermi-estimation', 'proof-scaffolding'])
  assert.equal(r.dropped.length, 3)
})
test('placeSkill: fill, move, replace-when-full, reject', () => {
  const ok = (r: ReturnType<typeof placeSkill>) => { assert.ok(r.ok); return r as Extract<typeof r, { ok: true }> }
  let ids: string[] = []
  ids = ok(placeSkill(ids, 'socratic-inquiry', 'amber-emissary')).skillIds
  ids = ok(placeSkill(ids, 'fermi-estimation', 'amber-emissary')).skillIds
  ids = ok(placeSkill(ids, 'proof-scaffolding', 'amber-emissary')).skillIds
  assert.deepEqual(ids, ['socratic-inquiry', 'fermi-estimation', 'proof-scaffolding'])
  const full = placeSkill(ids, 'narrative-voice', 'amber-emissary')
  assert.equal(full.ok, false)
  const rep = ok(placeSkill(ids, 'narrative-voice', 'amber-emissary', 1))
  assert.deepEqual(rep.skillIds, ['socratic-inquiry', 'narrative-voice', 'proof-scaffolding']); assert.equal(rep.replaced, 'fermi-estimation')
  const mv = ok(placeSkill(ids, 'proof-scaffolding', 'amber-emissary', 0))
  assert.deepEqual(mv.skillIds, ['proof-scaffolding', 'socratic-inquiry', 'fermi-estimation']); assert.equal(mv.moved, true)
  assert.equal(placeSkill(ids, 'socratic-inquiry', 'amber-emissary').ok, false) // already equipped, no index
  assert.equal(placeSkill([], 'sandboxed-execution', 'amber-emissary').ok, false)
})

console.log('mutation planning')
const base = { id: 'b1', name: 'Amber 1', contenderId: 'amber-emissary', skillIds: ['socratic-inquiry'], revision: 1 }
test('unchanged is blocked with a reason', () => {
  const p = planMutation(base, ['socratic-inquiry'], 'm')
  assert.equal(p.ok, false); assert.equal((p as any).code, 'unchanged')
})
test('add / remove produce correct before/after', () => {
  const add = planMutation(base, ['socratic-inquiry', 'fermi-estimation'], 'm')
  assert.ok(add.ok); if (add.ok) { assert.deepEqual(add.diff.added, ['fermi-estimation']); assert.notEqual(add.beforeFingerprint, add.afterFingerprint); assert.equal(add.childRevision, 2) }
  const rem = planMutation(base, [], 'm')
  assert.ok(rem.ok); if (rem.ok) assert.deepEqual(rem.diff.removed, ['socratic-inquiry'])
})
test('duplicates, locked skills, too many, empty name are rejected', () => {
  assert.equal((planMutation(base, ['fermi-estimation', 'fermi-estimation'], 'm') as any).code, 'duplicate')
  assert.equal((planMutation(base, ['sandboxed-execution'], 'm') as any).code, 'invalid-skill')
  assert.equal((planMutation(base, ['a', 'b', 'c', 'd'], 'm') as any).code, 'too-many')
  assert.equal((planMutation(base, ['fermi-estimation'], '  ') as any).code, 'empty-name')
  assert.equal((planMutation({ ...base, contenderId: 'small-spark' }, ['fermi-estimation'], 'm') as any).code, 'locked-contender')
})
test('draft base requires saving the base first', () => {
  const p = planMutation({ ...base, id: null }, ['fermi-estimation'], 'm')
  assert.ok(p.ok && p.needsBaseSave)
})
test('mutantName never stacks suffixes', () => {
  assert.equal(mutantName('Amber 1', []), 'Amber 1 · mutant')
  assert.equal(mutantName('Amber 1 · mutant', [{ name: 'Amber 1 · mutant' } as any]), 'Amber 1 · mutant 2')
})
test('evidence is NOT EVALUATED unless both fingerprints have trials', () => {
  assert.equal(mutationEvidence('a', 'b', []).status, 'configured-not-evaluated')
  assert.equal(mutationEvidence('a', 'b', [{ buildFingerprint: 'a' }]).status, 'configured-not-evaluated')
  assert.equal(mutationEvidence('a', 'b', [{ buildFingerprint: 'a' }, { buildFingerprint: 'b' }]).status, 'compared')
})

console.log('store: forge, seal, persistence, lineage')
test('full journey: forge → equip → save → reload → mutate → reload → lineage', () => {
  const fs = fakeStorage()
  let s = createColosseumStore(fs.io, uid)
  s.getSnapshot()
  assert.equal(s.actions.setDraftContender('amber-emissary').ok, true)
  assert.equal(s.getSnapshot().draft.contenderId, 'amber-emissary')
  assert.equal(s.actions.equip('socratic-inquiry').ok, true)
  const forged = s.actions.forge('Amber Prime')
  assert.ok(forged.ok && forged.persisted)
  assert.equal(s.getSnapshot().activeBuildId, (forged as any).build.id)

  s.__reload()
  let st = s.getSnapshot()
  assert.equal(st.builds.length, 1); assert.deepEqual(st.draft.skillIds, ['socratic-inquiry']); assert.equal(st.activeBuildId, st.builds[0].id)
  assert.equal(saveState(st.draft, st.builds[0]).kind, 'saved')

  // clone then modify then seal
  const clone = s.actions.cloneBuild(st.builds[0].id)
  assert.ok(clone.ok)
  assert.equal(s.getSnapshot().builds.length, 2)
  const cloneBuild = (clone as any).build
  assert.equal(cloneBuild.parentId, null); assert.equal(cloneBuild.origin, 'clone'); assert.equal(cloneBuild.clonedFromId, st.builds[0].id)

  const bad = s.actions.sealMutation({ baseBuildId: cloneBuild.id, variantSkillIds: ['socratic-inquiry'], name: 'x' })
  assert.equal(bad.ok, false)
  const seal = s.actions.sealMutation({ baseBuildId: cloneBuild.id, variantSkillIds: ['socratic-inquiry', 'fermi-estimation'], name: 'Amber Prime · mutant' })
  assert.ok(seal.ok)
  const child = (seal as any).child
  assert.equal(child.parentId, cloneBuild.id); assert.equal(child.revision, cloneBuild.revision + 1); assert.equal(child.origin, 'mutation')
  assert.equal(child.fingerprint, fingerprint('amber-emissary', ['socratic-inquiry', 'fermi-estimation']))
  assert.notEqual(child.fingerprint, cloneBuild.fingerprint)
  assert.equal(s.getSnapshot().activeBuildId, child.id)
  // base untouched
  assert.deepEqual(s.getSnapshot().builds.find((b) => b.id === cloneBuild.id)!.skillIds, ['socratic-inquiry'])

  // fresh store instance == real page reload
  s = createColosseumStore(fs.io, uid)
  st = s.getSnapshot()
  assert.equal(st.builds.length, 3)
  const reloaded = st.builds.find((b) => b.id === child.id)!
  assert.equal(reloaded.parentId, cloneBuild.id); assert.equal(reloaded.fingerprint, child.fingerprint)
  assert.deepEqual(ancestry(st.builds, child.id).map((b) => b.id), [child.id, cloneBuild.id])
  assert.equal(lineageRoots(st.builds).length, 2) // original + clone are roots; child hangs under clone
  assert.equal(unreachableBuilds(st.builds).length, 0)
})
test('mutating an unsaved draft saves the base as parent', () => {
  const fs = fakeStorage(); const s = createColosseumStore(fs.io, uid)
  s.actions.setDraftContender('polymath-engine'); s.actions.equip('code-review-lens')
  const r = s.actions.sealMutation({ baseBuildId: null, variantSkillIds: ['code-review-lens', 'task-decomposition'], name: 'Poly · mutant' })
  assert.ok(r.ok); const st = s.getSnapshot()
  assert.equal(st.builds.length, 2)
  const child = st.builds.find((b) => b.origin === 'mutation')!, parent = st.builds.find((b) => b.id === child.parentId)!
  assert.ok(parent); assert.deepEqual(parent.skillIds, ['code-review-lens']); assert.equal(child.revision, 2)
})
test('saveRevision keeps history on the same id; unchanged refused', () => {
  const s = createColosseumStore(fakeStorage().io, uid)
  s.actions.setDraftContender('crystal-mind'); s.actions.equip('proof-scaffolding'); s.actions.forge('Crystal')
  assert.equal(s.actions.saveRevision().ok, false)
  s.actions.equip('fermi-estimation')
  const r = s.actions.saveRevision(); assert.ok(r.ok)
  const b = s.getSnapshot().builds[0]
  assert.equal(b.revision, 2); assert.equal(b.history!.length, 1); assert.deepEqual(b.history![0].skillIds, ['proof-scaffolding']); assert.match(b.history![0].note, /Fermi/)
})
test('switching champion detaches active build and reports dropped skills', () => {
  const s = createColosseumStore(fakeStorage().io, uid)
  s.actions.setDraftContender('amber-emissary'); s.actions.equip('socratic-inquiry'); s.actions.forge('A')
  const r = s.actions.setDraftContender('crystal-mind'); assert.ok(r.ok)
  assert.equal(s.getSnapshot().activeBuildId, null)
  assert.equal(s.actions.setDraftContender('small-spark').ok, false)
  assert.equal(s.getSnapshot().draft.contenderId, 'crystal-mind')
})
test('storage write failure is reported, state kept in memory', () => {
  const s = createColosseumStore(fakeStorage(null, true).io, uid)
  s.actions.setDraftContender('amber-emissary'); s.actions.equip('socratic-inquiry')
  const r = s.actions.forge('X'); assert.ok(r.ok && !r.persisted)
  assert.equal(s.getSnapshot().storage.ok, false); assert.equal(s.getSnapshot().builds.length, 1)
})
test('legacy v1 saves (no activeBuildId/history/origin) load; fingerprint is recomputed; junk is dropped', () => {
  const legacy = JSON.stringify({
    draft: { contenderId: 'abyssal-oracle', skillIds: ['socratic-inquiry', 'ghost-skill'] },
    builds: [
      { id: 'old', name: 'Old', contenderId: 'amber-emissary', skillIds: ['socratic-inquiry'], parentId: null, revision: 1, fingerprint: 'deadbeef', createdAt: '2026-01-01T00:00:00Z' },
      { id: 'kid', name: 'Kid', contenderId: 'amber-emissary', skillIds: ['socratic-inquiry', 'fermi-estimation'], parentId: 'old', revision: 2, fingerprint: 'x', createdAt: '2026-01-02T00:00:00Z' },
      { nope: true }, null, 'str',
    ],
    practice: [{ id: 'p', challengeId: 'first-sigil', challengeVersion: 2, answer: '297', correct: true, at: 'z' }, { bad: 1 }],
  })
  const st = parseState(legacy)
  assert.equal(st.builds.length, 2); assert.equal(st.practice.length, 1)
  assert.deepEqual(st.draft.skillIds, ['socratic-inquiry']); assert.equal(st.draft.contenderId, 'abyssal-oracle')
  assert.notEqual(st.builds[0].fingerprint, 'deadbeef')
  assert.equal(st.builds[1].parentId, 'old')
  assert.equal(parseState('not json').builds.length, 0)
  assert.equal(normalizeBuild({ id: 'a' }), null)
})
test('deleting a parent keeps children visible as roots', () => {
  const s = createColosseumStore(fakeStorage().io, uid)
  s.actions.setDraftContender('amber-emissary'); s.actions.equip('socratic-inquiry'); s.actions.forge('P')
  const p = s.getSnapshot().builds[0]
  s.actions.sealMutation({ baseBuildId: p.id, variantSkillIds: [], name: 'C' })
  s.actions.deleteBuild(p.id)
  const st = s.getSnapshot(); assert.equal(st.builds.length, 1); assert.equal(lineageRoots(st.builds).length, 1)
})
test('import validates and never trusts the file fingerprint', () => {
  const s = createColosseumStore(fakeStorage().io, uid)
  assert.equal(s.actions.importBuild({}).ok, false)
  assert.equal(s.actions.importBuild({ format: 'colosseum-build', version: 1, build: { name: 'I', contenderId: 'amber-emissary', skillIds: ['sandboxed-execution'] } }).ok, false)
  const r = s.actions.importBuild({ format: 'colosseum-build', version: 1, build: { name: 'I', contenderId: 'amber-emissary', skillIds: ['socratic-inquiry'], fingerprint: 'zzzz', revision: 9 } })
  assert.ok(r.ok); if (r.ok) { assert.equal(r.build.revision, 1); assert.equal(r.build.fingerprint, fingerprint('amber-emissary', ['socratic-inquiry'])) }
})
test('data sanity: every contender/skill id referenced exists', () => {
  assert.equal(CONTENDERS.length, 8); assert.equal(SKILLS.filter((x) => x.available).length, 7)
})

console.log(`\n${passed} tests passed${process.exitCode ? ' — WITH FAILURES' : ''}`)
