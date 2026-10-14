'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Check, Gem, Search, ShieldAlert, Swords } from 'lucide-react'
import { SKILLS, SKILL_WINGS, contenderById, type Skill } from '@/lib/data'
import { skillCompat } from '@/lib/builds'
import { RelicIcon, wingColor } from '@/components/skill-art'
import { LoadoutSlots, RelicTile, StateBadge, useLoadout } from '@/components/loadout'
import { SkillDetail } from '@/components/skill-detail'
import { Pill } from '@/components/rune'

/** Skill Hall: every relic is an explicit instruction, shared with Workshop and Mutation Lab. */
export function SkillHall() {
  const ctl = useLoadout()
  const [wing, setWing] = useState('All')
  const [term, setTerm] = useState('')
  const [selected, setSelected] = useState<Skill | null>(null)
  const [showUnavailable, setShowUnavailable] = useState(true)
  const champion = contenderById(ctl.contenderId)
  const visible = useMemo(() => SKILLS.filter(skill =>
    (wing === 'All' || skill.wing === wing) &&
    (showUnavailable || skill.available) &&
    `${skill.name} ${skill.wing} ${skill.summary}`.toLowerCase().includes(term.trim().toLowerCase())
  ), [wing, term, showUnavailable])

  return (
    <div className="mx-auto grid w-full max-w-[96rem] gap-5 px-4 pb-10 sm:px-6 xl:grid-cols-[minmax(0,1fr)_21rem]">
      <div className="min-w-0 space-y-5">
        <section className="glass-strong rounded-[2rem] p-5 sm:p-7" aria-label="Skill catalogue">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="eyebrow">The thirteen relics</p>
              <h2 className="text-display text-3xl font-black text-ink">Skill Hall</h2>
              <p className="mt-2 max-w-xl text-sm text-ink-soft">Select a relic to inspect its exact instructions. Equipping changes your build configuration, not an invented power rating.</p>
            </div>
            <Pill tone="ink">{SKILLS.filter(s => s.available).length} available · {SKILLS.length} catalogued</Pill>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <label className="flex min-w-[13rem] flex-1 items-center gap-2 rounded-xl bg-black/45 px-3 ring-1 ring-ink/20">
              <Search className="size-4 text-ink-soft" />
              <span className="sr-only">Find a skill</span>
              <input value={term} onChange={e => setTerm(e.target.value)} placeholder="Search relics" className="h-11 w-full bg-transparent text-sm text-ink outline-none" />
            </label>
            <label className="flex items-center gap-2 rounded-xl bg-black/35 px-3 py-2 text-xs text-ink-soft">
              <input type="checkbox" checked={showUnavailable} onChange={e => setShowUnavailable(e.target.checked)} />
              Show unavailable
            </label>
          </div>
          <div role="group" aria-label="Skill wings" className="mt-3 flex flex-wrap gap-2">
            {['All', ...SKILL_WINGS].map(w => (
              <button key={w} type="button" onClick={() => setWing(w)} aria-pressed={wing === w}
                className={`press rounded-full px-3 py-2 text-xs font-bold ring-1 ${wing === w ? 'bg-gold/20 text-ink ring-gold/70' : 'text-ink-soft ring-ink/20 hover:text-ink'}`}>
                {w}
              </button>
            ))}
          </div>

          {visible.length === 0 ? <p className="mt-6 text-sm text-ink-soft">No relics match that search.</p> : (
            <div className="mt-6 grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
              {visible.map(skill => {
                const compat = skillCompat(skill.id, ctl.contenderId, ctl.ids)
                return (
                  <article key={skill.id} className="edge-light flex min-w-0 flex-col rounded-3xl bg-black/50 p-4" style={{ borderTop: `2px solid ${wingColor(skill.wing)}` }}>
                    <button type="button" onClick={() => setSelected(skill)} className="flex min-h-24 items-center gap-3 text-left">
                      <RelicIcon skillId={skill.id} wing={skill.wing} size={65} dim={!compat.ok && compat.state !== 'equipped'} />
                      <span className="min-w-0"><span className="block text-display text-lg font-black leading-tight text-ink">{skill.name}</span><span className="mt-1 block text-xs text-ink-soft">{skill.wing}</span></span>
                    </button>
                    <p className="mt-2 min-h-12 text-sm text-ink-soft">{skill.summary}</p>
                    <div className="mt-auto flex items-center justify-between gap-2 pt-4">
                      <StateBadge state={compat.state} />
                      <button type="button" className="rune-btn rune-btn-ghost rune-btn-sm" onClick={() => setSelected(skill)}>Inspect</button>
                    </div>
                    <div className="mt-2">
                      {compat.ok && <button type="button" className="rune-btn rune-btn-sm rune-btn-primary w-full" onClick={() => compat.state === 'equipped' ? ctl.unequip(skill.id) : ctl.equip(skill.id)}>
                        {compat.state === 'equipped' ? <><Check className="size-4" /> Unequip</> : <><Gem className="size-4" /> Equip</>}
                      </button>}
                      {!compat.ok && <p className="flex gap-1 text-xs text-ink-soft"><ShieldAlert className="size-4 shrink-0" />{compat.reason}</p>}
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </section>
      </div>
      <aside className="min-w-0 space-y-4 xl:sticky xl:top-24 xl:self-start">
        <section className="glass-strong rounded-[2rem] p-5">
          <h2 className="text-display flex items-center gap-2 text-xl font-black text-ink"><Swords className="size-5 text-gold" /> Current loadout</h2>
          <p className="mt-2 text-sm text-ink-soft">{champion?.name} · {ctl.ids.length}/3 relics</p>
          <LoadoutSlots ctl={ctl} onInspect={setSelected} className="mt-4" />
          <Link href="/workshop" className="rune-btn rune-btn-primary mt-3 w-full">Open Workshop</Link>
          <p className="mt-3 text-xs text-ink-soft">No model calls are made by equipping a skill. Results require separate public evidence.</p>
        </section>
      </aside>
      <SkillDetail skill={selected} onClose={() => setSelected(null)} ctl={ctl} />
    </div>
  )
}
