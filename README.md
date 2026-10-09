# COLOSSEUM — Floating Lands

An interactive celestial arena built from the supplied Next.js recovery project. The original character illustrations, model runner, deterministic checkers, server authorization guards, and browser storage keys are retained. Public launch emphasizes champion configurations, tutorials, and recorded evidence; it makes no model calls.

## Free publication

Follow [START-HERE.md](START-HERE.md). Upload `COLOSSEUM-FLOATING-LANDS-SITE.zip` to Cloudflare Pages Direct Upload for a free `pages.dev` URL. No home network serves visitors. No paid AI capability, wallet or database is enabled by default. Cloudflare and source repositories retain their own service limits.

## Development

Node **24+**, pnpm **11.19.0**, and Chromium are used here. Package releases and lockfile checks remain verified; only esbuild's necessary install script is explicitly allowed. SDK 7 is pinned to 7.0.131, an eligible release under the cloud's minimum-release-age policy; the uploaded 7.0.133 was too recent. Next.js and React received maintained version updates.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

The cache is placed in the parent directory's `.pnpm-store` by `pnpm-workspace.yaml`. Dependencies are excluded from deliverables. `.env.example` documents the disabled public default; no credentials are needed.

```sh
pnpm typecheck
pnpm test
pnpm build
pnpm build:static
pnpm test:ui
pnpm package:launch
```

`pnpm build` retains server API routes. `pnpm build:static` stages source, excludes API routes and server-route tests from the staged app, validates the remaining app with Next.js, and exports `public-dist`. Original API source and tests remain untouched by staging. Webpack is used for the staged export because Turbopack restricts symlinks outside its project root. The full source type-check and tests include API safeguards. Static mode also disables the browser runtime API hook.

`pnpm test:ui` starts a static validation server on port 8791 and uses `/usr/bin/chromium`; set `CHROMIUM_PATH` for another installation. Browser evidence fixtures are test-only and never shipped as model results. Package script requires a current static build and a `zip` executable.

## Working features

- Original lightweight SVG floating scenery; large champion scene; Discover/Develop destinations; mobile world map; tactile keyboard/touch controls.
- Champion arrows, keyboard and pointer swipe, remembered selection, shortcuts to recent saved builds.
- Workshop: four actual instruction slots, exact complete instruction preview, validation, name/model changes, explicit save, revisions, cloning, import/export, IndexedDB persistence.
- Skill constellation: real category branches, compatibility, requirements, instruction/tool distinctions, accessible details and equip flow. External tools remain locked.
- Mutation Lab: original versus variant portraits, exact configuration differences, local save, parent revision. Original operator experiment implementation is retained separately, outside the public UI.
- Lineage: selectable model families and real saved build ancestry/revisions, including orphaned imports without infinite recursion.
- Archive: search, public/personal evidence separation, original answers, provenance, JSON exports, rejection reasons; failures never receive completed-trial scores.
- Hall of Fame: challenge/model filters, separate evidence sources, sample size and honest empty podium. No global authenticated ranking or universal intelligence score.
- Developer Access: static datasets and schema, build exchange, answer re-grading, evidence recovery/publication workflow.
- Sensory preferences: optional original interface tones off by default, full/reduced motion and low visual effects.

## Evidence and Solana limits

`data/public-trials.json` contains **zero** replayable model trials. The historical Scholar/Challenger notes do not preserve original responses, so they remain non-replayable attestations. No scores or model outputs were fabricated or reconstructed. Deterministic tutorials never append themselves to model evidence.

Existing browser records require their original site origin and browser profile. Archive exports preserve originals plus validated publication candidates. Developer Access re-grades stored responses, checks known challenge versions/model identity, and rejects unsupported authentication claims. This proves an answer reproduces a verdict; it does not authenticate its author or execution. Owner publication requires reviewing candidates and replacing the static source dataset, then rebuilding.

Ledger Island uses exact request/response examples retrieved from Solana's official documentation at commit `2498072e8882ad866efa7a1b8c67a73b10a8489d`. It is labelled **documentation examples, not a live chain snapshot**. The requests name different mints, which the tutorial deliberately checks; token accounts are not unique holders. Retrieval time, source URLs, raw fields and example slots are preserved in `data/solana-snapshot.json`. No cross-mint concentration claim is calculated. The cloud proxy denied actual public RPC capture; a future recorded-chain trial requires genuine same-mint captures with timestamps and suitable context slots. The site makes zero RPC requests and connects no wallets or funds.

Complete build performance is **NOT YET TESTED**. The legacy trial pipeline accepts one skill, so the public Workshop never claims to have evaluated a full build. Original authorized runner behavior is retained for future work; no fresh model calls were made during this pass. Legacy single-skill records are excluded from baseline leaderboard views. Larger-scale ranking and independent authentication remain future work.

## Files

See [CHANGES.md](CHANGES.md) for the change inventory and [HANDOFF.md](HANDOFF.md) for the current state, startup, validation, and remaining work. The supplied video and Paint/floating-land reference images were not attached to this handoff; the included illustrations were preserved, and scenery was authored locally without paid image generation.
