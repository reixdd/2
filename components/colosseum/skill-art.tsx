import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Hand-authored vector relics for each skill. These are visual metaphors only:
 * the artwork carries no power rating, rarity or stat. The registry in data/skills.json
 * stays the source of truth for what a skill actually does.
 */

export const WING_COLOR: Record<string, string> = {
  'Blockchain & Crypto': '#f0c768', // gold
  'Research & Knowledge': '#cfd8e6', // silver
  'Mathematics & Reasoning': '#a597ff', // violet
  'Programming & Development': '#34d399', // emerald
  'Creativity & Media': '#f0925b', // copper
  'Data Analysis': '#e58fb5', // rose
  'Planning & Automation': '#9bd45f', // lime
  Community: '#b59a78', // bronze
}
export const wingColor = (wing: string) => WING_COLOR[wing] ?? '#cfd8e6'

type Form = 'scroll' | 'crystal' | 'talisman' | 'tool' | 'sigil'

export const FORM_LABEL: Record<Form, string> = {
  scroll: 'Scroll',
  crystal: 'Crystal',
  talisman: 'Talisman',
  tool: 'Enchanted tool',
  sigil: 'Sigil',
}

const FRAME: Record<Form, ReactNode> = {
  scroll: (
    <>
      <path d="M9 9h30a3 3 0 0 1 3 3v24a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3V12a3 3 0 0 1 3-3z" />
      <ellipse cx="24" cy="6.5" rx="19" ry="3.2" />
      <ellipse cx="24" cy="41.5" rx="19" ry="3.2" />
    </>
  ),
  crystal: <polygon points="24,3 42,14 42,34 24,45 6,34 6,14" />,
  talisman: (
    <>
      <circle cx="24" cy="24" r="20.5" />
      <circle cx="24" cy="24" r="16.5" strokeDasharray="1.5 3.5" opacity="0.7" />
    </>
  ),
  tool: <path d="M24 3 42 9v16c0 10-8 17-18 20C14 42 6 35 6 25V9z" />,
  sigil: (
    <>
      <polygon points="16,3.5 32,3.5 44.5,16 44.5,32 32,44.5 16,44.5 3.5,32 3.5,16" />
      <polygon points="18,9 30,9 39,18 39,30 30,39 18,39 9,30 9,18" opacity="0.5" />
    </>
  ),
}

type Art = { form: Form; glyph: ReactNode }

/* Each glyph sits inside a 48x48 box, centre (24,24), roughly 22px across. */
const ART: Record<string, Art> = {
  'ledger-interpretation': {
    form: 'scroll',
    glyph: (
      <>
        <rect x="14" y="15" width="8" height="8" rx="1.5" />
        <rect x="26" y="15" width="8" height="8" rx="1.5" />
        <rect x="20" y="26" width="8" height="8" rx="1.5" />
        <path d="M22 19h4M20 23l2 3M30 23l-2 3" />
      </>
    ),
  },
  'socratic-inquiry': {
    form: 'talisman',
    glyph: (
      <>
        <path d="M18.5 19a5.5 5.5 0 1 1 8.2 4.8c-1.7 1-2.7 2-2.7 3.7" />
        <circle cx="24" cy="32.5" r="0.9" fill="currentColor" />
      </>
    ),
  },
  'source-triangulation': {
    form: 'crystal',
    glyph: (
      <>
        <path d="M24 14 14 33h20z" />
        <circle cx="24" cy="14" r="2.3" fill="currentColor" />
        <circle cx="14" cy="33" r="2.3" fill="currentColor" />
        <circle cx="34" cy="33" r="2.3" fill="currentColor" />
        <circle cx="24" cy="26.5" r="1.4" />
      </>
    ),
  },
  'proof-scaffolding': {
    form: 'sigil',
    glyph: (
      <>
        <path d="M15 33h6v-6h6v-6h6" />
        <path d="M15 33V15M15 15l18 18" opacity="0.65" />
        <path d="M30 17l2 2 4-4" />
      </>
    ),
  },
  'fermi-estimation': {
    form: 'crystal',
    glyph: (
      <>
        <path d="M14 33h20" />
        <path d="M16 33v-4M22 33v-8M28 33v-13M34 33v-19" />
        <path d="M14 18q4-4 8 0t8 0" opacity="0.7" />
      </>
    ),
  },
  'code-review-lens': {
    form: 'tool',
    glyph: (
      <>
        <circle cx="22" cy="22" r="7.5" />
        <path d="m27.5 27.5 7 7" />
        <path d="m20 19-3 3 3 3M24 19l3 3-3 3" strokeWidth="1.8" />
      </>
    ),
  },
  'sandboxed-execution': {
    form: 'tool',
    glyph: (
      <>
        <path d="M24 13 34 18.5v11L24 35l-10-5.5v-11z" strokeDasharray="3 2.2" />
        <path d="M24 24v11M14 18.5l10 5.5 10-5.5" opacity="0.7" />
      </>
    ),
  },
  'narrative-voice': {
    form: 'scroll',
    glyph: (
      <>
        <path d="M33 13c-9 1-15 7-17 17l-1.5 5 5-1.5c10-2 16-8 17-17z" />
        <path d="M16 32c5-6 9-10 15-14" opacity="0.7" />
      </>
    ),
  },
  'chart-interrogation': {
    form: 'crystal',
    glyph: (
      <>
        <path d="M13 34h16" />
        <path d="M15 34v-7M20 34v-11M25 34v-5" />
        <circle cx="30" cy="19" r="5" />
        <path d="m33.7 22.7 3.5 3.5" />
      </>
    ),
  },
  'task-decomposition': {
    form: 'sigil',
    glyph: (
      <>
        <circle cx="24" cy="14" r="2.5" fill="currentColor" />
        <path d="M24 17v6M24 23 15 28M24 23v5M24 23l9 5" />
        <circle cx="15" cy="31" r="2.5" />
        <circle cx="24" cy="31" r="2.5" />
        <circle cx="33" cy="31" r="2.5" />
      </>
    ),
  },
  'tool-orchestration': {
    form: 'talisman',
    glyph: (
      <>
        <circle cx="24" cy="24" r="4.5" />
        <path d="M24 12v4M24 32v4M12 24h4M32 24h4M15.5 15.5l2.8 2.8M29.7 29.7l2.8 2.8M32.5 15.5l-2.8 2.8M18.3 29.7l-2.8 2.8" />
      </>
    ),
  },
  'on-chain-pattern-reading': {
    form: 'crystal',
    glyph: (
      <>
        <path d="M12 28h5l3-9 4 14 3-10 2 5h7" />
        <path d="M12 36h24" opacity="0.5" />
      </>
    ),
  },
  'community-submission': {
    form: 'talisman',
    glyph: (
      <>
        <path d="M24 15a9 9 0 1 0 9 9" />
        <path d="M24 20v8M20 24h8" />
        <path d="M32 13v5M29.5 15.5h5" opacity="0.7" />
      </>
    ),
  },
}

export const skillForm = (id: string): Form => ART[id]?.form ?? 'talisman'

export function RelicIcon({
  skillId,
  wing,
  size = 56,
  dim,
  className,
  title,
}: {
  skillId: string
  wing: string
  size?: number
  /** Desaturate for locked / incompatible items. */
  dim?: boolean
  className?: string
  title?: string
}) {
  const art = ART[skillId] ?? { form: 'talisman' as Form, glyph: <circle cx="24" cy="24" r="6" /> }
  const color = wingColor(wing)
  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      className={cn('shrink-0 overflow-visible', className)}
      style={{
        color,
        filter: dim ? 'grayscale(0.85) brightness(0.7)' : `drop-shadow(0 0 7px ${color}66)`,
      }}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <g fill="rgba(6,10,22,0.94)" strokeWidth="2.2">
        {FRAME[art.form]}
      </g>
      <g strokeWidth="2.1">{art.glyph}</g>
    </svg>
  )
}
