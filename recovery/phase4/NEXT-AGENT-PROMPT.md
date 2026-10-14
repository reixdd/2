# COLOSSEUM — FINAL IMPLEMENTATION HANDOFF

Continue the existing, fully working COLOSSEUM codebase. I have attached `COLOSSEUM-SOURCE-CONSOLIDATED.zip`. This is source recovery, **not a new runnable app**. You must establish the actual authoritative full source before replacing any file. Do not let this partial ZIP overwrite the complete project.

## Begin by preserving completed work

1. Read `README-START-HERE.md` inside the archive and inspect all code. Import the exact earlier Workshop/loadout/Skill Hall source only when compatible. Review the later state/mutation corrections as a separate candidate, not as arbitrary overrides.
2. `02-BATTLE-STAGE-RECOVERY/components/battle-stage.tsx` is the actual downloaded component from Claude. `02-BATTLE-STAGE-RECOVERY/lib/battle.ts` is a new replacement authored to satisfy its contract and validated with 10 standalone tests. Port both to the real app, with the existing approved art, challenge registry and evidence source. Never treat test fixtures as model output.
3. Inspect the original `APPLY-WINDOWS.cmd` and script but do not execute without a diff and full backup. It overwrites ten files. The earlier ZIP lacks the prerequisite project shape.

## Product psychology: real game, real meaning

COLOSSEUM should feel like a magical floating-islands AI RPG with an engrossing core loop **Summon → Equip → Challenge → Inspect Evidence → Mutate → Earn Real Recognition**. Its motivational engine is **curiosity** about contender capabilities, **agency** through genuine build changes, **mastery** through comparable results and explanations, and **recognition** through legitimately earned records. No fake leaderboard, misleading XP, random cash/prize pressure, or deceptive notifications.

## Required gameplay changes, in priority order

**P1 — Functional state and mutation:** Resolve the Abyssal featured/Capybara active-loadout mismatch by separating browsing and choosing; synchronize Workshop, Skill Hall and Arena. Fix mutation URL repeatedly resetting selection and whitespace name bug, parent/child lineage saving, storage failures and cross-tab data loss. Use real tests. Review `03-LATER-LOG-FIXES-REVIEW-BEFORE-MERGE` and port compatible improvements.

**P2 — Workshop + Skill Hall:** Three-column RPG equipment view, with large selected champion on the right. Replace flat blue add-on cards with illustrated, distinct gold-accented relics. Reuse recovered loadout source: click/tap/keyboard equip and accessible draggable items. The previous drag system failed at standard viewport height when dragging caused scrolling. Fix at 1440×900 and mobile; do not require a 3200px-tall browser. Dock/auto-scroll may be implemented, but the last Claude dock was unverified and is not in this bundle. Check hitboxes, safe portrait crops and meaningful press/equip VFX.

**P3 — Visual battles:** Wire the recovered 2D battle stage into the real Arena. Produce tasteful summoned-character, scroll, answer reveal, checker and evidence phases. The recorded source must be actually captured; practice must be labeled; local AI requires explicit opt-in and clear download cost. Use no fictional combat scores. Check reduced-motion path reveals the full answer, never an empty screen. Preserve answer and timing provenance. The reconstructed `lib/battle.ts` validates data shape, NOT authenticity; use server-verified provenance when available.

**P4 — Hall of Fame and discovery:** Make Hall of Fame prominent on home and Arena. Display genuine public evidence, local practice milestones and unranked contenders as separate categories. Build a trophy-chamber aesthetic, not a static spreadsheet. No fake accomplishments. Hall component was NOT recovered, so recreate it against real data.

**P5 — Mutation VFX + Ledger Island:** Finish side-by-side mutation chamber, visibly changed relics, truthfully labeled UNTESTED variants, persistent lineage and short satisfying seal effect. Transform Solana's three documentation-based lessons into short sequential research missions with deterministic feedback and source links. No wallet, live trades or paid inference.

## Non-negotiables

- Preserve the newer complete COLOSSEUM app, existing model execution, exact art, API cost guards, real challenge checker, archive and exports.
- Keep public AI billing OFF by default and disclose substantial browser-local model downloads before any optional use.
- Make navigation and clickable buttons stable; use subtle helpful animations and respect reduced motion.
- No dependency on a fabricated global score.
- Run real Next.js build/type checks, current tests and end-to-end browser flows on the ACTUAL app, not on a fake fixture-only harness. Clearly distinguish untested features.
- Verify on normal desktop/mobile, actual saved build reload, equip in Workshop and Hall, mutation seal/lineage, replay/practice evidence, Hall tiers, Ledger lessons, and no unexpectedly billable requests.

## Save and finish

Ship a full, recoverable project ZIP/commit with updated handoff docs. Report exact integrated files, tests actually run, remaining blockers, and preserve original art/assets. Do not stop at another audit. Work milestone by milestone but SAVE source before any time/credit cutoff.
