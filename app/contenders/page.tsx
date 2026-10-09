import type { Metadata } from "next"
import { CONTENDERS } from "@/lib/colosseum/characters"
import { ContenderPortrait } from "@/components/colosseum/contender-portrait"
import { StatusBadge } from "@/components/colosseum/status-badge"
import {PUBLIC_DATA} from "@/lib/colosseum/public-trials-data"

export const metadata: Metadata = {
  title: "Contenders — COLOSSEUM",
  description: "Meet the real AI models summoned into the COLOSSEUM arena.",
}

export default function ContendersPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <header className="mb-10 max-w-2xl">
        <h1 className="font-display text-glow-ice mb-3 text-3xl sm:text-4xl">The Contenders</h1>
        <p className="text-pretty leading-relaxed text-muted-foreground">
          Each contender is a real language model given a face and a legend. Behind the armor and the fur is an
          registered model family. These are unofficial fictional interpretations. Public model execution is disabled; a catalog entry is not a tested capability.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {CONTENDERS.map((c) => (
          <article key={c.id} className="tactile clip-panel flex flex-col gap-4 bg-card/60 p-6">
            <div className="flex items-center gap-4">
              <ContenderPortrait contender={c} size="lg" />
              <div className="min-w-0">
                <h2 className="font-display text-lg leading-tight">{c.name}</h2>
                <p className="font-mono text-xs tracking-wider text-muted-foreground uppercase">{c.archetype}</p>
              </div>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">{c.lore}</p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Character themes · not tested ratings</p>
            {c.specialties.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {c.specialties.map((s) => (
                  <span key={s} className="clip-tag bg-muted/70 px-2.5 py-1 text-[11px] text-muted-foreground">
                    {s}
                  </span>
                ))}
              </div>
            )}
            <div className="mt-auto flex items-center justify-between gap-2 pt-3">
              <span className="truncate font-mono text-xs text-muted-foreground">
                {c.family}
                {c.modelId ? ` · ${c.modelId}` : ""}
                {c.tier === "open-weight" ? " · Family associated with open weights" : " · Hosted model"}
              </span>
              <StatusBadge status="unavailable">{PUBLIC_DATA.valid.some(t=>t.trial.contenderId===c.id)?"Recorded":"Untested"}</StatusBadge>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}
