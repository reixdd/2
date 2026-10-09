'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { Dna, FlaskConical, GitBranch, Undo2 } from 'lucide-react'
import { composeInstructions, contenderById, fingerprint, skillById, type Skill } from '@/lib/data'
import { diffConfigs, mutationEvidence, mutantName, planMutation } from '@/lib/builds'
import { PUBLIC_TRIALS } from '@/lib/data'
import { actions, useStore } from '@/lib/store'
import { useLoadout, LoadoutSlots, SkillTray } from '@/components/loadout'
import { SkillDetail } from '@/components/skill-detail'
import { ContenderArt } from '@/components/contender-art'
import { Pill, RuneButton } from '@/components/rune'

const DRAFT = '__draft__'
export function MutationLab() {
  const { draft, builds } = useStore()
  const [baseId, setBaseId] = useState<string>(DRAFT)
  const [variant, setVariant] = useState<string[] | null>(null)
  const [name, setName] = useState('')
  const [inspect, setInspect] = useState<Skill | null>(null)
  const [message, setMessage] = useState('')
  // Apply the initial URL selection once. Allow the user to switch afterward.
  const urlApplied = useRef(false)
  useEffect(() => {
    if (urlApplied.current) return
    const id = new URLSearchParams(window.location.search).get('build')
    if (!id) { urlApplied.current = true; return }
    if (builds.some(b => b.id === id)) { urlApplied.current = true; setBaseId(id) }
  }, [builds])
  const saved = builds.find(b => b.id === baseId)
  const base = saved ?? { id: null, name: contenderById(draft.contenderId)?.name ?? 'Champion', revision: 1, ...draft }
  const proposed = variant ?? base.skillIds
  const contender = contenderById(base.contenderId)
  const ctl = useLoadout({ skillIds: proposed, contenderId: base.contenderId, onChange: setVariant })
  const suggestion = useMemo(() => mutantName(base.name, builds), [base.name, builds])
  const chosenName = name.trim() || suggestion
  const plan = planMutation({ id: saved?.id ?? null, name: base.name, contenderId: base.contenderId, skillIds: base.skillIds, revision: base.revision }, proposed, chosenName)
  const diff = diffConfigs(base, { contenderId: base.contenderId, skillIds: proposed })
  const beforeFp = fingerprint(base.contenderId, base.skillIds)
  const afterFp = fingerprint(base.contenderId, proposed)
  const evidence = mutationEvidence(beforeFp, afterFp, PUBLIC_TRIALS.trials)
  const seal = () => {
    const result = actions.sealMutation({ baseBuildId: saved?.id ?? null, variantSkillIds: proposed, name: chosenName })
    if (!result.ok) { setMessage(result.reason); return }
    setMessage(`Sealed ${result.child.name} (revision ${result.child.revision}, ${result.child.fingerprint}). ${result.persisted ? 'Saved locally.' : 'Storage unavailable: export this build.'}`)
    setBaseId(result.child.id)
    setVariant(null)
    setName('')
  }
  return (
    <div className="mx-auto grid w-full max-w-[96rem] gap-5 px-4 pb-10 sm:px-6 lg:grid-cols-2">
      <section className="glass-strong rounded-[2rem] p-5 sm:p-7">
        <p className="eyebrow">Specimen selection</p>
        <h2 className="text-display mt-1 text-2xl font-black text-ink">Mutate a champion</h2>
        <label className="mt-4 block text-xs font-bold uppercase tracking-widest text-ink-soft">Base build
          <select value={baseId} onChange={e => { setBaseId(e.target.value); setVariant(null); setName(''); setMessage('') }} className="mt-2 h-12 w-full rounded-xl bg-[#0a1020] px-3 text-base text-ink ring-1 ring-ink/30">
            <option value={DRAFT}>Current draft (unsaved)</option>
            {builds.map(b => <option key={b.id} value={b.id}>{b.name} · rev {b.revision}</option>)}
          </select>
        </label>
        {contender && <div className="mt-5 flex items-center gap-4"><ContenderArt contender={contender} className="w-24 rounded-2xl" /><div><p className="eyebrow">{contender.family}</p><h3 className="text-xl font-black text-ink">{contender.name}</h3><p className="text-xs text-ink-soft">{beforeFp} · base revision {base.revision}</p></div></div>}
        <p className="eyebrow mt-6">Variant equipment</p>
        <LoadoutSlots ctl={ctl} onInspect={setInspect} className="mt-3" />
        <details className="mt-4 rounded-2xl bg-black/35 px-4 py-3" open><summary className="cursor-pointer text-sm font-bold text-ink">Relic tray · choose a change</summary><SkillTray ctl={ctl} onInspect={setInspect} className="mt-3" /></details>
      </section>
      <section className="glass-strong rounded-[2rem] p-5 sm:p-7">
        <div className="flex flex-wrap gap-2"><Pill tone="gold"><FlaskConical className="size-4" /> Offline chamber</Pill><Pill tone="ink">No model call</Pill></div>
        <h2 className="text-display mt-4 text-2xl font-black text-ink">Before → After</h2>
        <p className="mt-2 text-sm text-ink-soft">Compare configuration and instructions only. No performance improvement is claimed without comparable public trials.</p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          {[{ label: 'Before', fp: beforeFp, ids: base.skillIds }, { label: 'After', fp: afterFp, ids: proposed }].map(row => <div key={row.label} className="rounded-2xl bg-black/45 p-4 ring-1 ring-gold/30"><p className="eyebrow">{row.label}</p><p className="mt-1 break-all font-mono text-lg font-bold text-ink">{row.fp}</p><p className="mt-2 text-xs text-ink-soft">{row.ids.map(id => skillById(id)?.name ?? id).join(', ') || 'No skills'}</p></div>)}
        </div>
        <p className="mt-4 text-sm text-ink"><strong>Changes:</strong> {diff.unchanged ? 'None yet' : [...diff.added.map(id => `+ ${skillById(id)?.name ?? id}`), ...diff.removed.map(id => `− ${skillById(id)?.name ?? id}`)].join(' · ')}</p>
        <p className="mt-3 text-sm font-bold text-ink">{evidence.label}</p><p className="text-xs text-ink-soft">{evidence.detail}</p>
        <details className="mt-4 rounded-2xl bg-black/40 px-4 py-3"><summary className="cursor-pointer text-sm font-bold text-ink">Instructions after mutation</summary><pre className="scroll-thin mt-2 max-h-56 overflow-auto whitespace-pre-wrap text-xs text-ink-soft">{composeInstructions(proposed) || 'No additional instructions.'}</pre></details>
        <label className="mt-5 block text-xs font-bold uppercase tracking-wider text-ink-soft">Mutant name
          <input value={name} onChange={e => setName(e.target.value)} placeholder={suggestion} maxLength={60} className="mt-2 h-12 w-full rounded-xl bg-[#0a1020] px-3 text-sm text-ink ring-1 ring-ink/30" />
        </label>
        <div className="mt-4 flex flex-wrap items-center gap-2"><RuneButton variant="gold" disabled={!plan.ok} onClick={seal}><Dna className="size-4" /> Seal mutation</RuneButton><RuneButton variant="ghost" onClick={() => { setVariant(null); setMessage('') }}><Undo2 className="size-4" /> Revert</RuneButton><Link className="rune-btn rune-btn-ghost rune-btn-sm" href="/lineage"><GitBranch className="size-4" /> Lineage</Link></div>
        {!plan.ok && <p className="mt-2 text-sm text-ink-soft">{plan.reason}</p>}
        <p role="status" aria-live="polite" className="mt-3 text-sm font-medium text-[#7cf0dc]">{message}</p>
      </section>
      <SkillDetail skill={inspect} ctl={ctl} onClose={() => setInspect(null)} />
    </div>
  )
}
