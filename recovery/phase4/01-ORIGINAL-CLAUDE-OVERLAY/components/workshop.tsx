'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, Copy, Crown, Dna, Download, FolderOpen, Hammer, History, Save, Trash2, Upload } from 'lucide-react'
import { CONTENDERS, composeInstructions, contenderById, skillById, type Skill } from '@/lib/data'
import { diffConfigs, saveState } from '@/lib/builds'
import { actions, downloadJson, exportBuild, exportLineage, useStore, type Build } from '@/lib/store'
import { cn } from '@/lib/utils'
import { ContenderArt } from '@/components/contender-art'
import { LoadoutSlots, SkillTray, useLoadout } from '@/components/loadout'
import { RelicIcon } from '@/components/skill-art'
import { SkillDetail } from '@/components/skill-detail'
import { EmptyState, Pill, RuneButton } from '@/components/rune'

export function BuildCard({ build, children, highlight }: { build: Build; children?: React.ReactNode; highlight?: boolean }) {
  const c = contenderById(build.contenderId)
  return (
    <article className={cn('glass flex gap-4 rounded-3xl p-4', highlight && 'shadow-[0_0_0_2px_#f0c768,0_0_30px_rgba(240,199,104,.5)]')} data-build-id={build.id}>
      {c && <ContenderArt contender={c} className="w-20 shrink-0 rounded-2xl ring-1 ring-gold/60" />}
      <div className="min-w-0 flex-1">
        <h3 className="text-display truncate text-lg font-black text-ink">{build.name}</h3>
        <p className="text-sm text-ink-soft">
          {c?.name ?? build.contenderId} · revision {build.revision} · <span className="font-mono">{build.fingerprint}</span>
        </p>
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {build.skillIds.length === 0 && <li className="text-xs text-ink-soft">No skills equipped</li>}
          {build.skillIds.map((id) => {
            const s = skillById(id)
            return (
              <li key={id} className="inline-flex items-center gap-1 rounded-full bg-[#0a1020] py-0.5 pl-1 pr-2.5 text-xs font-semibold text-ink ring-1 ring-ink/12">
                {s && <RelicIcon skillId={s.id} wing={s.wing} size={18} />}
                {s?.name ?? id}
              </li>
            )
          })}
        </ul>
        {children && <div className="mt-3 flex flex-wrap gap-2">{children}</div>}
      </div>
    </article>
  )
}

export function Workshop() {
  const { draft, builds, activeBuildId, storage } = useStore()
  const ctl = useLoadout()
  const [previewId, setPreviewId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [message, setMessage] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null)
  const [inspect, setInspect] = useState<Skill | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const active = builds.find((b) => b.id === activeBuildId) ?? null
  const state = saveState(draft, active)
  const selected = contenderById(draft.contenderId)
  const shown = contenderById(previewId ?? draft.contenderId) ?? selected
  const previewing = !!previewId && previewId !== draft.contenderId
  const instructions = composeInstructions(draft.skillIds)

  const choose = (id: string) => {
    const r = actions.setDraftContender(id)
    setPreviewId(null)
    if (!r.ok) return setMessage({ tone: 'bad', text: r.reason })
    const dropped = r.dropped.map((d) => `${skillById(d.id)?.name ?? d.id} (${d.reason})`)
    setMessage({
      tone: 'ok',
      text: dropped.length ? `${contenderById(id)?.name} chosen. Removed: ${dropped.join(', ')}.` : `${contenderById(id)?.name} chosen. Loadout kept: every equipped skill is compatible.`,
    })
  }

  const report = (r: { ok: true; build: Build; persisted: boolean } | { ok: false; reason: string }, verb: string) => {
    if (!r.ok) return setMessage({ tone: 'bad', text: r.reason })
    setMessage({
      tone: r.persisted ? 'ok' : 'bad',
      text: r.persisted
        ? `${verb} “${r.build.name}” · rev ${r.build.revision} · fingerprint ${r.build.fingerprint}. Saved in this browser only.`
        : `${verb} “${r.build.name}” but the browser refused to store it. It will be lost on reload. Export it now.`,
    })
  }

  const onFile = async (file: File | undefined) => {
    if (!file) return
    try {
      const result = actions.importBuild(JSON.parse(await file.text()))
      setMessage(result.ok ? { tone: 'ok', text: `Imported “${result.build.name}”.` } : { tone: 'bad', text: result.reason })
    } catch {
      setMessage({ tone: 'bad', text: 'That file is not valid JSON.' })
    }
    if (fileRef.current) fileRef.current.value = ''
  }

  const modified = state.kind === 'modified'

  return (
    <div className="mx-auto w-full max-w-[96rem] px-4 pb-6 sm:px-6">
      {!storage.ok && (
        <p role="alert" className="mb-4 flex items-start gap-2 rounded-2xl bg-[#b4443a]/15 px-4 py-3 text-sm text-[#ffb3a8] ring-1 ring-[#b4443a]/40">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" /> This browser is not storing your builds ({storage.error}). Work is kept for this tab only. Export what matters.
        </p>
      )}
      <div className="grid gap-5 lg:grid-cols-[16rem_minmax(0,1fr)_21rem] xl:grid-cols-[18rem_minmax(0,1fr)_24rem]">
        {/* RIGHT on desktop, FIRST on mobile: large champion preview */}
        <aside aria-label="Champion preview" className="order-first lg:order-last">
          <div className="lg:sticky lg:top-24">
            <div className="mx-auto w-44 sm:w-56 lg:w-full">
              <div
                key={shown?.id}
                className={cn('animate-pop relative overflow-hidden rounded-[2rem] bg-black', previewing ? 'ring-2 ring-aether shadow-[0_0_40px_rgba(79,209,255,.5)]' : 'gold-edge')}
              >
                {shown && <ContenderArt contender={shown} eager />}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/70 to-transparent px-4 pb-4 pt-16">
                  <p className="text-[0.65rem] font-bold uppercase tracking-[0.25em] text-[#f6d98b]">{shown?.family}</p>
                  <p className="text-display text-2xl font-black uppercase text-white">{shown?.name}</p>
                </div>
                {!previewing && draft.skillIds.length > 0 && (
                  <ul aria-label="Equipped relics" className="absolute right-2 top-2 flex flex-col gap-1.5">
                    {draft.skillIds.map((id) => {
                      const s = skillById(id)
                      return s ? (
                        <li key={id} className="animate-relic-drop rounded-full bg-black/70 p-1 ring-1 ring-gold/60">
                          <RelicIcon skillId={s.id} wing={s.wing} size={30} title={s.name} />
                        </li>
                      ) : null
                    })}
                  </ul>
                )}
              </div>
            </div>
            <div className="mt-3 text-center" aria-live="polite">
              {previewing ? (
                <>
                  <Pill tone="sky">Previewing · not your champion</Pill>
                  <div className="mt-2">
                    <RuneButton size="sm" onClick={() => shown && choose(shown.id)} disabled={shown?.locked}>
                      <Crown className="size-4" /> Choose {shown?.name}
                    </RuneButton>
                  </div>
                </>
              ) : (
                <Pill tone="gold">
                  <Crown className="size-3.5" /> Active champion
                </Pill>
              )}
              <p className="mt-2 text-sm font-semibold text-ink">{shown?.title}</p>
              <p className="text-xs text-ink-soft">{shown?.species} · {shown?.element}</p>
            </div>
          </div>
        </aside>

        {/* CENTER: workbench */}
        <section aria-label="Equipment workbench" className="glass-strong rounded-[2rem] p-5 sm:p-6 lg:order-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="eyebrow">Workbench</p>
              <h2 className="text-display text-2xl font-black text-ink">
                {selected?.name} · {draft.skillIds.length}/3 equipped
              </h2>
            </div>
            <span
              role="status"
              data-save-state={state.kind}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wider ring-1',
                state.kind === 'saved' && 'bg-teal/12 text-[#7cf0dc] ring-teal/40',
                state.kind === 'modified' && 'bg-gold/15 text-[#ffe7a3] ring-gold/60',
                state.kind === 'draft' && 'bg-ink/8 text-ink ring-ink/20',
              )}
            >
              <span className={cn('size-2 rounded-full', state.kind === 'saved' ? 'bg-teal' : state.kind === 'modified' ? 'bg-gold animate-glow' : 'bg-ink-soft')} />
              {state.label}
            </span>
          </div>

          {modified && (
            <p className="mt-2 text-xs text-ink-soft">
              Since last save: {state.diff.added.map((id) => `+ ${skillById(id)?.name}`).join(', ')}
              {state.diff.added.length > 0 && state.diff.removed.length > 0 ? ' · ' : ''}
              {state.diff.removed.map((id) => `− ${skillById(id)?.name}`).join(', ')}
            </p>
          )}

          <LoadoutSlots ctl={ctl} onInspect={setInspect} className="mt-4" />

          <h3 className="eyebrow mt-3">Inventory · drag a relic into a socket, or press +</h3>
          <SkillTray ctl={ctl} onInspect={setInspect} className="mt-2" />

          <form
            className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end"
            onSubmit={(e) => {
              e.preventDefault()
              report(actions.forge(name), 'Forged')
              setName('')
            }}
          >
            <label className="flex-1">
              <span className="mb-1 block text-xs font-bold uppercase tracking-widest text-ink-soft">Build name</span>
              <input
                value={name}
                maxLength={60}
                onChange={(e) => setName(e.target.value)}
                placeholder={`${selected?.name ?? 'Champion'} — name your build`}
                className="h-12 w-full rounded-2xl bg-[#0a1020] px-4 font-semibold text-ink ring-1 ring-ink/20 placeholder:font-normal placeholder:text-ink-soft/60 focus:outline-none focus:ring-2 focus:ring-aether"
              />
            </label>
            <RuneButton type="submit" variant="gold">
              <Hammer className="size-4" /> Forge new
            </RuneButton>
          </form>
          <div className="mt-3 flex flex-wrap gap-2">
            <RuneButton variant="primary" size="sm" disabled={!modified} onClick={() => report(actions.saveRevision(), 'Saved revision of')}>
              <Save className="size-4" /> Save revision
            </RuneButton>
            {active && (
              <RuneButton
                variant="ghost"
                size="sm"
                disabled={!name.trim() || name.trim() === active.name}
                onClick={() => {
                  if (actions.renameBuild(active.id, name)) setMessage({ tone: 'ok', text: `Renamed to “${name.trim()}”.` })
                  setName('')
                }}
              >
                Rename active
              </RuneButton>
            )}
            {active && (
              <Link href={`/mutation-lab?build=${active.id}`} className="rune-btn rune-btn-ghost rune-btn-sm">
                <Dna className="size-4" /> Mutate
              </Link>
            )}
          </div>
          <p role="status" aria-live="polite" className={cn('mt-2 min-h-5 text-sm font-medium', message?.tone === 'bad' ? 'text-[#ff9d90]' : 'text-[#7cf0dc]')}>
            {message?.text}
          </p>
          {!modified && state.kind !== 'draft' && <p className="text-xs text-ink-soft">Save revision is available once the loadout differs from the saved build.</p>}

          <details className="mt-3 rounded-2xl bg-ink/5 px-4 py-3">
            <summary className="cursor-pointer text-sm font-bold text-ink">
              Instructions this build sends · fingerprint <span className="font-mono">{composeFp(draft.contenderId, draft.skillIds)}</span>
            </summary>
            {instructions ? (
              <pre className="scroll-thin mt-3 max-h-56 overflow-auto whitespace-pre-wrap text-[0.8rem] leading-relaxed text-ink">{instructions}</pre>
            ) : (
              <p className="mt-3 text-sm text-ink-soft">No skills equipped, so no extra instructions are added.</p>
            )}
          </details>

          {active && (active.history?.length ?? 0) > 0 && (
            <details className="mt-3 rounded-2xl bg-ink/5 px-4 py-3">
              <summary className="flex cursor-pointer items-center gap-2 text-sm font-bold text-ink">
                <History className="size-4" /> Revision history · {active.history!.length + 1} states
              </summary>
              <ol className="mt-3 space-y-2 text-sm text-ink-soft">
                {[...active.history!].reverse().map((h) => (
                  <li key={`${h.revision}-${h.at}`} className="rounded-xl bg-black/40 px-3 py-2">
                    <span className="font-bold text-ink">rev {h.revision}</span> · <span className="font-mono">{h.fingerprint}</span> · {h.skillIds.map((id) => skillById(id)?.name ?? id).join(', ') || 'no skills'}
                    <br />
                    <span className="text-xs">{h.note}</span>
                  </li>
                ))}
                <li className="rounded-xl bg-gold/10 px-3 py-2 text-ink">
                  <span className="font-bold">rev {active.revision}</span> (current) · <span className="font-mono">{active.fingerprint}</span>
                </li>
              </ol>
            </details>
          )}
        </section>

        {/* LEFT: champion selection + saved builds */}
        <div className="flex flex-col gap-5 lg:order-first">
          <section aria-label="Champions" className="glass rounded-[2rem] p-4">
            <h2 className="eyebrow mb-2">Champions</h2>
            <ul
              className="grid grid-cols-4 gap-2 lg:grid-cols-2"
              onMouseLeave={() => setPreviewId(null)}
              onBlur={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setPreviewId(null)
              }}
            >
              {CONTENDERS.map((c) => {
                const on = c.id === draft.contenderId
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      aria-pressed={on}
                      aria-label={c.locked ? `${c.name}, coming soon` : `${c.name}${on ? ' (active champion)' : ''}`}
                      disabled={c.locked}
                      data-selected={on}
                      onMouseEnter={() => !c.locked && setPreviewId(c.id)}
                      onFocus={() => !c.locked && setPreviewId(c.id)}
                      onClick={() => choose(c.id)}
                      className="edge-light press block w-full overflow-hidden rounded-2xl bg-[#0a1020] text-center disabled:cursor-not-allowed"
                    >
                      <ContenderArt contender={c} className="aspect-[4/5]" />
                      <span className="flex items-center justify-center gap-1 truncate px-1 py-1.5 text-xs font-bold text-ink">
                        {on && <Crown className="size-3 text-gold" aria-hidden="true" />}
                        {c.name}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
            <p className="mt-2 text-xs text-ink-soft">Hover or focus to preview. Click to choose.</p>
          </section>

          <section aria-label="Saved champions" className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-display text-xl font-black text-ink">Saved builds</h2>
              <div className="flex gap-1.5">
                <input ref={fileRef} type="file" accept="application/json,.json" className="sr-only" id="import-build" onChange={(e) => onFile(e.target.files?.[0])} />
                <label htmlFor="import-build" className="rune-btn rune-btn-ghost rune-btn-sm cursor-pointer">
                  <Upload className="size-4" /> Import
                </label>
                {builds.length > 0 && (
                  <RuneButton variant="ghost" size="sm" aria-label="Export all builds with lineage" onClick={() => downloadJson('colosseum-lineage.json', exportLineage(builds))}>
                    <Download className="size-4" />
                  </RuneButton>
                )}
              </div>
            </div>
            {builds.length === 0 ? (
              <EmptyState title="The forge is cold" icon={<Hammer className="size-8" />}>
                Equip a champion, then Forge new. It is saved here, in this browser only.
              </EmptyState>
            ) : (
              <ul className="flex flex-col gap-3">
                {builds.map((b) => {
                  const parent = b.parentId ? builds.find((x) => x.id === b.parentId) : null
                  const d = parent ? diffConfigs(parent, b) : null
                  return (
                    <li key={b.id}>
                      <BuildCard build={b} highlight={b.id === activeBuildId}>
                        {b.id === activeBuildId ? (
                          <Pill tone="gold">Active</Pill>
                        ) : (
                          <RuneButton
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              actions.loadBuild(b.id)
                              setMessage({ tone: 'ok', text: `Loaded “${b.name}”.` })
                            }}
                          >
                            <FolderOpen className="size-4" /> Load
                          </RuneButton>
                        )}
                        <RuneButton variant="ghost" size="sm" onClick={() => report(actions.cloneBuild(b.id), 'Cloned to')}>
                          <Copy className="size-4" /> Clone
                        </RuneButton>
                        <Link href={`/mutation-lab?build=${b.id}`} className="rune-btn rune-btn-ghost rune-btn-sm">
                          <Dna className="size-4" /> Mutate
                        </Link>
                        <RuneButton variant="ghost" size="sm" aria-label={`Export ${b.name}`} onClick={() => downloadJson(`${b.name.replace(/\W+/g, '-').toLowerCase()}.colosseum.json`, exportBuild(b))}>
                          <Download className="size-4" />
                        </RuneButton>
                        <RuneButton
                          variant="ghost"
                          size="sm"
                          aria-label={confirmDelete === b.id ? `Confirm delete ${b.name}` : `Delete ${b.name}`}
                          onClick={() => {
                            if (confirmDelete === b.id) {
                              actions.deleteBuild(b.id)
                              setConfirmDelete(null)
                            } else setConfirmDelete(b.id)
                          }}
                        >
                          <Trash2 className="size-4" /> {confirmDelete === b.id ? 'Confirm' : ''}
                        </RuneButton>
                        {parent && d && <p className="basis-full text-xs text-ink-soft">Mutated from “{parent.name}”: {d.added.length} added, {d.removed.length} removed.</p>}
                      </BuildCard>
                    </li>
                  )
                })}
              </ul>
            )}
            <Pill tone="ink" className="self-start">Stored in localStorage · not attested</Pill>
          </section>
        </div>
      </div>
      <SkillDetail skill={inspect} onClose={() => setInspect(null)} ctl={ctl} />
    </div>
  )
}

import { fingerprint } from '@/lib/data'
function composeFp(contenderId: string, skillIds: string[]) {
  return fingerprint(contenderId, skillIds)
}
