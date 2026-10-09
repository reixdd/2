# COLOSSEUM — Claude Source Recovery / Integration Patch

**Purpose:** preserve Claude's last recoverable source changes and finish the Skill Hall integration. This ZIP is an **overlay for the existing COLOSSEUM Next.js repository**, **not** a replacement project and **not** a ready-to-run standalone app.

## Contents

Recovered directly from supplied Claude source/logs:

- `lib/builds.ts` — pure build identity, compatibility, revisions, mutations, lineage, imports (exact supplied attachment).
- `components/skill-art.tsx` — custom relic glyphs/colors (exact supplied attachment).
- `components/loadout.tsx` — loadout slots with keyboard/click and drag placement.
- `components/skill-detail.tsx` — readable skills and limitations, evidence disclosure.
- `components/workshop.tsx` — three-column forge, saved builds, active status, clone, export/import, revisions.
- `patches/claude-globals-additions.css` — Claude's additional animations/styles. Script appends once.
- `tests/logic.test.ts` — Claude's 21 logic tests, with actual 7 available skills expectation.

Reconstructed or completed in this recovery:

- `lib/store.ts` — rebuild of the missing source, consistent with Claude's tests and Workshop APIs. Keeps `colosseum:v1` persistence and validates imports. Preserves legacy `saveBuild`/`loadBuildIntoDraft` calls.
- `components/skill-hall.tsx` — previously unfinished constellation/catalogue: wing filters, skill details, states and shared relic equipment.
- `components/mutation-lab.tsx` — updated to use the new loadout controller and mutation/lineage functions.
- `components/lineage-tree.tsx` — updated for revision-aware builds, safe cycle handling and orphan branches.

## Apply to an existing repo (no manual replacement needed)

1. Extract this ZIP to any folder, **separate from the repository**.
2. Find your existing COLOSSEUM repo: it must contain `package.json`, `lib/data.ts`, `data/skills.json`, `components/rune.tsx` and `app/globals.css`.
3. Double-click `APPLY-WINDOWS.cmd` and provide the project root as the argument, OR run:

   `python scripts/apply_patch.py "C:\path\to\colosseum" --check`

   `python scripts/apply_patch.py "C:\path\to\colosseum"`

4. The script saves replaced originals in `<project>/.recovery-backups/<timestamp>/` and appends styles only if absent.
5. In the repo, run `npx tsx tests/logic.test.ts`, then `npm run build`.

## Important limitations / scope

- The **full `/home/claude/colosseum` repository was NOT attached**. This ZIP cannot contain the project's original dependencies, pages, artwork or data files; those must already be in your repo. In particular, the original skill registry/data, assets, footer, battle engine and routing were not included in the uploaded files.
- `lib/store.ts`, `skill-hall.tsx`, `mutation-lab.tsx` and `lineage-tree.tsx` were authored/reconstructed here. They are not claimed to be byte-for-byte Claude originals.
- No model API calls, public trial records or fictional evaluation data have been added. Skill equipment changes instructions/configuration only; it does not establish performance.
- If your repository diverged from the transcript, there may be additional integration changes needed. Back up first. The ZIP does not prove a working production build without testing against your actual original repo.

## Validation performed on this patch

- TypeScript syntax: 9 source files parsed/transpiled without syntax diagnostics.
- **21 logic tests passed** under a local test harness with a fixture registry mirroring the transcript's 8 contenders / 13 skills (7 available). This validates core build behaviors but does **not** replace an actual `next build` against your repository.

## Where Claude stopped

The uploaded transcript ends: “Workshop is rewritten (three columns, champion preview, relic equipment, shared state). Now I'm building the Skill Hall constellation on the same build state.” There was **no completed Skill Hall or production build output** in the provided transcript. This overlay closes that known gap while preserving the recovered core work.
