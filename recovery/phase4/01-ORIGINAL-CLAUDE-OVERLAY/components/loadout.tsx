'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, Lock, Plug, Plus, Sparkles, X } from 'lucide-react'
import { MAX_SLOTS, SKILLS, contenderById, skillById, type Skill } from '@/lib/data'
import { placeSkill, skillCompat, type SkillState } from '@/lib/builds'
import { actions, useStore } from '@/lib/store'
import { cn } from '@/lib/utils'
import { RelicIcon, wingColor } from '@/components/skill-art'

export const DND_TYPE = 'application/x-colosseum-skill'

/* ------------------------------------------------------------------ */
/* Controller: one hook, two backends                                   */
/*   - no options  → the shared draft in the store (Arena/Workshop/Hall) */
/*   - with options → a local variant (Mutation Lab)                    */
/* ------------------------------------------------------------------ */

type Notice = { tone: 'ok' | 'bad'; text: string } | null

export function useLoadout(opts?: { skillIds: string[]; contenderId: string; onChange: (ids: string[]) => void }) {
  const { draft } = useStore()
  const ids = opts?.skillIds ?? draft.skillIds
  const contenderId = opts?.contenderId ?? draft.contenderId
  const [notice, setNotice] = useState<Notice>(null)
  const [armed, setArmed] = useState<string | null>(null)
  const [pulse, setPulse] = useState<{ id: string; n: number } | null>(null)

  const equip = useCallback(
    (skillId: string, index?: number) => {
      const r = opts ? placeSkill(ids, skillId, contenderId, index) : actions.equip(skillId, index)
      const name = skillById(skillId)?.name ?? 'Skill'
      if (!r.ok) {
        // Full loadout and no explicit slot: arm the relic so the next slot choice replaces something.
        if (index === undefined && ids.length >= MAX_SLOTS && !ids.includes(skillId) && skillCompat(skillId, contenderId).ok) {
          setArmed(skillId)
          setNotice({ tone: 'ok', text: `${name} is ready. Choose a slot to swap it into.` })
        } else {
          setNotice({ tone: 'bad', text: r.reason })
        }
        return r
      }
      if (opts) opts.onChange(r.skillIds)
      const replaced = r.replaced ? ` · replaced ${skillById(r.replaced)?.name ?? r.replaced}` : ''
      setNotice({ tone: 'ok', text: `${name} ${r.moved ? 'moved' : 'equipped'}${replaced}.` })
      setPulse({ id: skillId, n: Date.now() })
      setArmed(null)
      return r
    },
    [opts, ids, contenderId],
  )

  const unequip = useCallback(
    (skillId: string) => {
      if (opts) opts.onChange(ids.filter((s) => s !== skillId))
      else actions.unequip(skillId)
      setNotice({ tone: 'ok', text: `${skillById(skillId)?.name ?? 'Skill'} removed.` })
      setArmed(null)
    },
    [opts, ids],
  )

  return { ids, contenderId, equip, unequip, notice, setNotice, armed, setArmed, pulse }
}
export type LoadoutCtl = ReturnType<typeof useLoadout>

/** True while any relic is being dragged (native drag), so every socket can light up as a target. */
export function useDragActive() {
  const [active, setActive] = useState(false)
  useEffect(() => {
    const start = (e: DragEvent) => {
      if ((e.target as HTMLElement | null)?.closest?.('[data-relic-drag]')) setActive(true)
    }
    const end = () => setActive(false)
    document.addEventListener('dragstart', start)
    document.addEventListener('dragend', end)
    document.addEventListener('drop', end)
    return () => {
      document.removeEventListener('dragstart', start)
      document.removeEventListener('dragend', end)
      document.removeEventListener('drop', end)
    }
  }, [])
  return active
}

/* ------------------------------------------------------------------ */
/* State presentation                                                   */
/* ------------------------------------------------------------------ */

export const STATE_LABEL: Record<SkillState, string> = {
  equipped: 'Equipped',
  available: 'Available',
  incompatible: 'Not compatible',
  external: 'Needs integration',
  unavailable: 'Not open yet',
  experimental: 'Experimental',
}

function StateBadge({ state }: { state: SkillState }) {
  const tone: Record<SkillState, string> = {
    equipped: 'text-[#ffe7a3]',
    available: 'text-ink-soft',
    incompatible: 'text-[#ff9d90]',
    external: 'text-[#f0c768]',
    unavailable: 'text-ink-soft',
    experimental: 'text-[#c3b9ff]',
  }
  const icon =
    state === 'equipped' ? <Check className="size-3" /> : state === 'external' ? <Plug className="size-3" /> : state === 'incompatible' || state === 'unavailable' ? <Lock className="size-3" /> : state === 'experimental' ? <Sparkles className="size-3" /> : null
  return (
    <span className={cn('inline-flex items-center gap-1 text-[0.68rem] font-bold uppercase tracking-wider', tone[state])}>
      {icon}
      {STATE_LABEL[state]}
    </span>
  )
}
export { StateBadge }

/* ------------------------------------------------------------------ */
/* Slots                                                                */
/* ------------------------------------------------------------------ */

export function LoadoutSlots({
  ctl,
  onInspect,
  className,
}: {
  ctl: LoadoutCtl
  onInspect?: (skill: Skill) => void
  className?: string
}) {
  const dragging = useDragActive()
  const [over, setOver] = useState<number | null>(null)
  const ready = dragging || !!ctl.armed

  return (
    <div className={className}>
      <ul aria-label="Equipment slots" className="grid gap-3 sm:grid-cols-3">
        {Array.from({ length: MAX_SLOTS }, (_, i) => {
          const id = ctl.ids[i]
          const skill = id ? skillById(id) : undefined
          const pulsing = !!skill && ctl.pulse?.id === skill.id
          const targetable = ready
          return (
            <li
              key={`${i}-${skill?.id ?? 'empty'}-${pulsing ? ctl.pulse!.n : 0}`}
              onDragOver={(e) => {
                if (Array.from(e.dataTransfer.types).includes(DND_TYPE)) {
                  e.preventDefault()
                  e.dataTransfer.dropEffect = 'copy'
                  setOver(i)
                }
              }}
              onDragLeave={() => setOver((o) => (o === i ? null : o))}
              onDrop={(e) => {
                e.preventDefault()
                setOver(null)
                const sid = e.dataTransfer.getData(DND_TYPE)
                if (sid) ctl.equip(sid, i)
              }}
              data-slot={i}
              data-filled={!!skill}
              className={cn(
                'relative flex min-h-[8.5rem] flex-col items-center justify-center gap-1.5 rounded-3xl px-3 py-3 text-center transition-[transform,box-shadow] duration-200',
                skill
                  ? 'bg-gradient-to-b from-[#2a2410]/90 to-[#0b0e1b] shadow-[0_0_0_1px_rgba(240,199,104,.9),0_10px_26px_-12px_rgba(154,111,18,.7)]'
                  : 'border-2 border-dashed border-ink/20 bg-black/35',
                pulsing && 'animate-equip',
                targetable && 'drop-ready',
                over === i && 'drop-over',
              )}
            >
              <span className="absolute left-3 top-2 text-[0.6rem] font-bold uppercase tracking-[0.25em] text-gold-deep">Slot {i + 1}</span>
              {skill ? (
                <>
                  <button
                    type="button"
                    onClick={() => (ctl.armed ? ctl.equip(ctl.armed, i) : onInspect?.(skill))}
                    aria-label={ctl.armed ? `Place ${skillById(ctl.armed)?.name} in slot ${i + 1}` : `Inspect ${skill.name}`}
                    className="flex min-h-[4.5rem] flex-col items-center gap-1 pt-3"
                  >
                    <RelicIcon skillId={skill.id} wing={skill.wing} size={56} className={cn(pulsing && 'animate-relic-drop')} />
                    <span className="text-sm font-bold leading-tight text-ink">{skill.name}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => ctl.unequip(skill.id)}
                    aria-label={`Remove ${skill.name}`}
                    className="absolute right-1.5 top-1.5 inline-flex size-11 items-center justify-center rounded-full text-ink-soft hover:text-ink hover:shadow-[0_0_14px_rgba(240,199,104,.6)]"
                  >
                    <X className="size-4" />
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  disabled={!ctl.armed}
                  onClick={() => ctl.armed && ctl.equip(ctl.armed, i)}
                  aria-label={ctl.armed ? `Place ${skillById(ctl.armed)?.name} in slot ${i + 1}` : `Slot ${i + 1} is empty`}
                  className="flex min-h-[4.5rem] flex-col items-center justify-center gap-1 pt-3 text-ink-soft disabled:cursor-default"
                >
                  <svg viewBox="0 0 48 48" width="44" height="44" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5" className="opacity-60">
                    <circle cx="24" cy="24" r="19" strokeDasharray="2 4" />
                    <circle cx="24" cy="24" r="9" opacity="0.6" />
                  </svg>
                  <span className="text-xs">{ctl.armed ? 'Place here' : ready ? 'Drop here' : 'Empty socket'}</span>
                </button>
              )}
            </li>
          )
        })}
      </ul>
      <p
        role="status"
        aria-live="polite"
        className={cn('mt-2 min-h-5 px-2 text-xs font-medium', ctl.notice?.tone === 'bad' ? 'text-[#ff9d90]' : 'text-[#ffe7a3]')}
      >
        {ctl.notice?.text}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Inventory                                                            */
/* ------------------------------------------------------------------ */

export function RelicTile({ skill, ctl, onInspect }: { skill: Skill; ctl: LoadoutCtl; onInspect?: (s: Skill) => void }) {
  const compat = skillCompat(skill.id, ctl.contenderId, ctl.ids)
  const equipped = compat.state === 'equipped'
  const usable = compat.ok
  const iconRef = useRef<HTMLSpanElement>(null)
  const armed = ctl.armed === skill.id
  const color = wingColor(skill.wing)
  return (
    <div
      draggable={usable}
      data-relic-drag={usable ? '' : undefined}
      data-selected={equipped || armed}
      onDragStart={(e) => {
        e.dataTransfer.setData(DND_TYPE, skill.id)
        e.dataTransfer.setData('text/plain', skill.name)
        e.dataTransfer.effectAllowed = 'copy'
        if (iconRef.current) e.dataTransfer.setDragImage(iconRef.current, 28, 28)
      }}
      style={{ ['--relic' as string]: color }}
      className={cn(
        'edge-light group flex items-center gap-2 rounded-2xl bg-black/55 py-1.5 pl-2 pr-1.5',
        usable ? 'cursor-grab active:cursor-grabbing' : 'opacity-80',
        equipped && 'bg-gradient-to-r from-[#2a2410]/80 to-black/55',
      )}
      title={compat.reason ?? undefined}
    >
      <span ref={iconRef} className="relative inline-flex shrink-0 transition-transform duration-200 group-hover:scale-110">
        <RelicIcon skillId={skill.id} wing={skill.wing} size={48} dim={!usable} />
      </span>
      <button
        type="button"
        onClick={() => (onInspect ? onInspect(skill) : usable ? ctl.equip(skill.id) : ctl.setNotice({ tone: 'bad', text: compat.reason ?? '' }))}
        aria-label={`Inspect ${skill.name}`}
        className="flex min-h-11 min-w-0 flex-1 flex-col items-start justify-center text-left"
      >
        <span className="w-full truncate text-sm font-bold text-ink">{skill.name}</span>
        <StateBadge state={compat.state} />
      </button>
      {usable ? (
        <button
          type="button"
          onClick={() => (equipped ? ctl.unequip(skill.id) : ctl.equip(skill.id))}
          aria-label={equipped ? `Unequip ${skill.name}` : `Equip ${skill.name}`}
          className={cn(
            'press inline-flex size-11 shrink-0 items-center justify-center rounded-xl ring-1 transition-colors',
            equipped ? 'bg-gold/20 text-[#ffe7a3] ring-gold/60 hover:bg-gold/30' : 'bg-white/5 text-ink ring-ink/20 hover:bg-gold/15 hover:ring-gold/60',
          )}
        >
          {equipped ? <X className="size-4" /> : <Plus className="size-4" />}
        </button>
      ) : (
        <span className="inline-flex size-11 shrink-0 items-center justify-center text-ink-soft" aria-hidden="true">
          {compat.state === 'external' ? <Plug className="size-4" /> : <Lock className="size-4" />}
        </span>
      )}
    </div>
  )
}

export function SkillTray({
  ctl,
  onInspect,
  wing,
  className,
}: {
  ctl: LoadoutCtl
  onInspect?: (skill: Skill) => void
  wing?: string
  className?: string
}) {
  const list = SKILLS.filter((s) => (wing && wing !== 'All' ? s.wing === wing : true))
  // Usable relics first so the inventory leads with what can actually be equipped.
  const sorted = [...list].sort((a, b) => Number(skillCompat(b.id, ctl.contenderId).ok) - Number(skillCompat(a.id, ctl.contenderId).ok))
  const contender = contenderById(ctl.contenderId)
  return (
    <div className={className}>
      <ul aria-label={`Skill inventory for ${contender?.name ?? 'champion'}`} className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {sorted.map((s) => (
          <li key={s.id}>
            <RelicTile skill={s} ctl={ctl} onInspect={onInspect} />
          </li>
        ))}
      </ul>
    </div>
  )
}
