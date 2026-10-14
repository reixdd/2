'use client'

import Link from 'next/link'
import { Dna, GitBranch } from 'lucide-react'
import { lineageRoots, childrenOf, unreachableBuilds, type Build } from '@/lib/builds'
import { useStore } from '@/lib/store'
import { BuildCard } from '@/components/workshop'
import { EmptyState } from '@/components/rune'

function Branch({ node, builds, chain = [] }: { node: Build; builds: Build[]; chain?: string[] }) {
  if (chain.includes(node.id)) return <li className="text-sm text-[#ff9d90]">Lineage cycle detected for {node.name}. This branch was stopped.</li>
  const children = childrenOf(builds, node.id)
  return <li>
    <BuildCard build={node}><Link className="rune-btn rune-btn-ghost rune-btn-sm" href={`/mutation-lab?build=${node.id}`}><Dna className="size-4" /> Mutate</Link></BuildCard>
    {children.length > 0 && <ul className="ml-5 mt-3 space-y-3 border-l-2 border-gold/50 pl-4">{children.map(child => <Branch key={child.id} node={child} builds={builds} chain={[...chain, node.id]} />)}</ul>}
  </li>
}
export function LineageTree() {
  const { builds } = useStore()
  const roots = lineageRoots(builds)
  const unreachable = unreachableBuilds(builds)
  return <section className="mx-auto max-w-[85rem] px-4 pb-8 sm:px-6" aria-label="Build lineage">
    {builds.length === 0 ? <EmptyState title="No bloodlines yet" icon={<GitBranch className="size-8" />} action={<Link className="rune-btn rune-btn-primary rune-btn-sm" href="/workshop">Forge your first champion</Link>}>Forge a champion, then seal a mutation to begin its lineage.</EmptyState> : <ul className="space-y-5">{roots.map(node => <Branch key={node.id} node={node} builds={builds} />)}</ul>}
    {unreachable.length > 0 && <p role="alert" className="mt-4 text-sm text-[#ff9d90]">{unreachable.length} build(s) are in an invalid parent cycle and cannot be displayed as a normal lineage.</p>}
    <p className="mt-5 text-xs text-ink-soft">Lineage records build configurations, not measured model performance. Deleting a parent leaves its children visible as roots.</p>
  </section>
}
