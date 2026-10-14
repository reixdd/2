# COLOSSEUM recovered source bundle — READ FIRST

This package combines **the two files actually uploaded by the user** with earlier fixes recovered from the previous Claude transcript. It is **NOT** a runnable COLOSSEUM application or a validated production integration.

## Where the files came from

- `01-ORIGINAL-CLAUDE-OVERLAY/`: byte-for-byte extracted files from `COLOSSEUM_CLAUDE_RECOVERED_CHANGES.zip`. Contains the 10 code replacements, its original Apply-Windows.cmd installer, CSS and logic tests. **Not applied to any project.**
- `02-BATTLE-STAGE-RECOVERY/components/battle-stage.tsx`: exact uploaded standalone `battle-stage.tsx`, **unchanged**.
- `02-BATTLE-STAGE-RECOVERY/lib/battle.ts`: **new companion source, independently reconstructed** to implement the API expected by that battle-stage. Not Claude's original lost `battle.ts`. Does not generate or score model outputs. Includes structural provenance validation but is not independent attestation.
- `02-BATTLE-STAGE-RECOVERY/tests/battle-recovery-test.cjs`: new isolated test suite for the companion battle module.
- `03-LATER-LOG-FIXES-REVIEW-BEFORE-MERGE/`: later store, pure-build and Mutation Lab corrections reconstructed from the user-shared Claude transcript. These have NOT been integrated with the user's current full source. Copy only after reviewing how the source has changed.
- `04-CSS-REFERENCE-ONLY/`: preserved v2 class definitions for battle, mutation, Hall of Fame from transcript; **reference, not automatically wired**.

## Inspect the installer BEFORE using it

`01-ORIGINAL-CLAUDE-OVERLAY/APPLY-WINDOWS.cmd` invokes a Python patcher that **replaces** `lib/builds.ts`, `lib/store.ts`, seven components and a logic test, and **appends** styles to `app/globals.css`. It backs up overwritten files but is still NOT safe to run blindly against a newer or different COLOSSEUM source. Its preflight expects `lib/data.ts`, `data/skills.json`, `components/rune.tsx`, `components/contender-art.tsx`, `package.json`, and `app/globals.css`; the older `colosseum-recovery-and-launch` ZIP does NOT match that structure. Do not run APPLY-WINDOWS.cmd against it.

## What is proven vs unknown

- Original overlay's `TEST-RESULTS.txt` reports **21 logic tests** with fixture data and TS syntax transpilation only. These are the original author's reported results, not rerun against the real project here.
- Newly authored `02-BATTLE-STAGE-RECOVERY/lib/battle.ts` has been compiled with globally available TypeScript in strict mode and its **10 isolated tests passed**.
- All 12 source modules in the consolidated source folders passed syntactic TypeScript transpilation here (no full application type-check).
- No production Next.js build, routed site, local inference guard, UI integration, or actual battle playback was run. No Hall of Fame component, drag-dock component, real model engine, original roster/skills registry or character artwork is in these sources.
- The uploaded separate `battle-stage.tsx` needs both `lib/battle.ts`, a working `ContenderArt` and companion `.bs` styles. A caller must supply **genuinely recorded or actual visitor-started trial results**, not fabricated fixtures.

## Safest integration path

1. Obtain the latest complete **authoritative** COLOSSEUM source, including its package.json, runtime, artwork, routes, data registry, and tests.
2. Back up or commit that project first.
3. Compare rather than automatically overwrite newer versions of the above files.
4. Port later fixes to champion browsing/selection, mutation URL/name, and cross-tab saves; test real storage and UI.
5. Wire the battle stage to actual trial results, optionally add its reference `.bs` CSS, and explicitly label recorded/practice/local AI output.
6. Run the real app type-check, build, tests and browser interactions. Validate mobile/reduced-motion and click targets.
7. Export/commit the integrated project after testing. Never deploy from this recovery bundle alone.

See `NEXT-AGENT-PROMPT.md` for a full instructions handoff.
