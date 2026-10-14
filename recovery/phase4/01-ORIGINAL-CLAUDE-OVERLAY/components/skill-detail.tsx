'use client'

import { Check, FlaskConical, Plug } from 'lucide-react'
import { MAX_SLOTS, PUBLIC_TRIALS, contenderById, type Skill } from '@/lib/data'
import { isExternalRequirement, skillCompat } from '@/lib/builds'
import { cn } from '@/lib/utils'
import { FORM_LABEL, RelicIcon, skillForm, wingColor } from '@/components/skill-art'
import { StateBadge, useLoadout, type LoadoutCtl } from '@/components/loadout'
import { Modal, Pill, RuneButton } from '@/components/rune'

/** Measured evidence for a skill = public trial records that list this skill in their build. None exist yet. */
function measuredTrials(skillId: string) {
  return PUBLIC_TRIALS.trials.filter((t) => Array.isArray((t as { skillIds?: string[] }).skillIds) && (t as { skillIds: string[] }).skillIds.includes(skillId))
}

function implementationType(skill: Skill): string {
  if (skill.available) return 'Instruction prompt: text appended to the champion’s instructions. No code runs.'
  if (isExternalRequirement(skill)) return 'External integration: needs a connected tool or data source this free mode does not include.'
  return 'Community slot: not open for submissions yet.'
}

function limitations(skill: Skill): string[] {
  const out: string[] = []
  if (skill.available) {
    out.push('It only changes what the model is asked. It cannot add knowledge, tools or data the model does not already have.')
    out.push('Whether it helps, hurts or does nothing on a given task is unmeasured until a comparable trial exists.')
  } else {
    out.push('Cannot be equipped in this runtime, so it has no effect on any build.')
  }
  if (skill.description) out.push(skill.description)
  return out
}

function Section({ title, children, open }: { title: string; children: React.ReactNode; open?: boolean }) {
  return (
    <details open={open} className="group rounded-2xl bg-black/40 ring-1 ring-ink/10 open:ring-gold/30">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-4 py-2 text-sm font-bold text-ink">
        {title}
        <span aria-hidden="true" className="text-gold-deep transition-transform group-open:rotate-90">›</span>
      </summary>
      <div className="px-4 pb-4 text-sm leading-relaxed text-ink-soft">{children}</div>
    </details>
  )
}

export function SkillDetail({ skill, onClose, ctl }: { skill: Skill | null; onClose: () => void; ctl?: LoadoutCtl }) {
  const own = useLoadout()
  const c = ctl ?? own
  const contender = contenderById(c.contenderId)
  const compat = skill ? skillCompat(skill.id, c.contenderId, c.ids) : null
  const equipped = compat?.state === 'equipped'
  const trials = skill ? measuredTrials(skill.id) : []

  return (
    <Modal open={!!skill} onClose={onClose} title={skill?.name ?? 'Skill'}>
      {skill && compat && (
        <div>
          <div className="flex items-center gap-4 pr-12">
            <span className="animate-pop rounded-3xl bg-black/50 p-3 ring-1" style={{ ['--tw-ring-color' as string]: `${wingColor(skill.wing)}66` }}>
              <RelicIcon skillId={skill.id} wing={skill.wing} size={84} dim={!compat.ok && !equipped} title={`${skill.name} relic`} />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Pill tone="gold">{skill.wing}</Pill>
                <Pill tone="ink">{FORM_LABEL[skillForm(skill.id)]}</Pill>
              </div>
              <h2 className="text-display mt-2 text-2xl font-black leading-tight text-ink sm:text-3xl">{skill.name}</h2>
              <div className="mt-1">
                <StateBadge state={compat.state} />
              </div>
            </div>
          </div>
          <p className="mt-4 text-lg text-ink">{skill.summary}</p>

          <div className="mt-4 flex flex-col gap-2.5">
            <Section title="What it changes in the build" open>
              <p>
                <strong className="text-ink">Implementation:</strong> {implementationType(skill)}
              </p>
              {skill.available && skill.instructionPrompt ? (
                <>
                  <p className="mt-2">
                    Adds exactly {skill.instructionPrompt.length} characters of instruction:
                  </p>
                  <pre className="scroll-thin mt-2 max-h-44 overflow-auto whitespace-pre-wrap rounded-xl bg-black/70 px-3 py-2.5 text-[0.8rem] leading-relaxed text-sky ring-1 ring-gold/30">
                    {skill.instructionPrompt}
                  </pre>
                </>
              ) : (
                <p className="mt-2">Nothing. It adds no instruction while it is unavailable.</p>
              )}
            </Section>

            <Section title={`Compatibility with ${contender?.name ?? 'this champion'}`}>
              <p className={cn(compat.ok ? 'text-[#7cf0dc]' : 'text-[#ff9d90]')}>
                {compat.ok ? `Compatible. ${skill.compatibleFamilies === 'all' ? 'Works with every contender family.' : `Families: ${skill.compatibleFamilies}.`}` : compat.reason}
              </p>
            </Section>

            <Section title="External requirements">
              {isExternalRequirement(skill) ? (
                <p className="flex items-start gap-2 text-[#f0c768]">
                  <Plug className="mt-0.5 size-4 shrink-0" /> {skill.unavailableReason}
                </p>
              ) : skill.available ? (
                <p>None. It needs no tool, wallet or network access.</p>
              ) : (
                <p>{skill.unavailableReason}</p>
              )}
            </Section>

            <Section title="Measured trial evidence">
              {trials.length === 0 ? (
                <p className="flex items-start gap-2">
                  <FlaskConical className="mt-0.5 size-4 shrink-0 text-ink-soft" />
                  <span>
                    <strong className="text-ink">NOT YET TESTED.</strong> No replayable trial compares builds with and without this skill, so no buff, debuff,
                    accuracy change or speed change is claimed.
                  </span>
                </p>
              ) : (
                <p>{trials.length} public trial record(s) include this skill. Open the Evidence Vault to inspect them.</p>
              )}
            </Section>

            <Section title="Possible limitations">
              <ul className="list-disc space-y-1.5 pl-5">
                {limitations(skill).map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
            </Section>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            {equipped ? (
              <RuneButton variant="ghost" onClick={() => c.unequip(skill.id)}>
                Remove from loadout
              </RuneButton>
            ) : compat.ok ? (
              <>
                <span className="eyebrow mr-1">Equip into</span>
                {Array.from({ length: MAX_SLOTS }, (_, i) => (
                  <RuneButton
                    key={i}
                    size="sm"
                    variant={i === c.ids.length ? 'gold' : 'ghost'}
                    onClick={() => {
                      const r = c.equip(skill.id, i)
                      if (r.ok) onClose()
                    }}
                  >
                    {c.ids[i] ? `Swap slot ${i + 1}` : `Slot ${i + 1}`}
                  </RuneButton>
                ))}
              </>
            ) : (
              <p className="text-sm text-ink-soft">Cannot be equipped: {compat.reason}</p>
            )}
          </div>
          <p role="status" aria-live="polite" className="mt-2 min-h-5 text-xs text-[#ffe7a3]">
            {c.notice?.tone === 'bad' ? <span className="text-[#ff9d90]">{c.notice.text}</span> : c.notice?.text}
            {equipped && !c.notice && (
              <span className="inline-flex items-center gap-1">
                <Check className="size-3" /> Equipped in the shared build.
              </span>
            )}
          </p>
        </div>
      )}
    </Modal>
  )
}
