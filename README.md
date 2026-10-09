# COLOSSEUM — Intelligence Must Be Proven

A playable celestial AI arena continued from the complete supplied Next.js source. Select a real model, equip instruction relics, save a build, create a mutation, run a challenge, inspect evidence, and explore educational missions. Approved character artwork is unchanged.

## Run

Node 24+, pnpm 11.19.0. No inference credentials are needed.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Development prepares the browser worker and WASM automatically. Model weights download from pinned Hugging Face repositories only after explicit visitor consent. The site performs generation on the visitor's device; it does not use the owner's home network or paid hosted inference.

```sh
pnpm typecheck
pnpm test
pnpm build:public
pnpm test:ui
pnpm package:launch
```

The static distribution is `public-dist/`. `npm run package:public` builds it and creates `COLOSSEUM-PHASE4-SITE.zip` and `COLOSSEUM-PHASE4-SOURCE.zip` in the parent directory. Source includes all eleven `.agents/skills/` directories, the retained original CPU/Vite engine, recovery references, environment template, lockfile and tests. Generated runtimes are rebuilt; downloaded weights, credentials and caches are excluded.

For a GitHub project site, build with `COLOSSEUM_BASE_PATH=/2 pnpm build:public`. Root hosting is the default. See START-HERE.md for free hosting.

## Working loop

- Model browsing and confirmed active configuration are separate.
- Three equipment sockets support drag, keyboard/touch selection, replacement, removal and undo; older four-relic saves remain recoverable.
- Shared Workshop/Skill Hall state, explicit saves, reload, complete configuration exports, mutation parent revisions and lineage.
- Consent-based streamed browser generation, sequential two-model execution with identical input and budget, real timing/errors/cancellation, deterministic math and structured-reasoning checkers.
- Animated practice and authentic recording playback, pause/resume/skip, reduced motion and low effects. Animation never assigns scores.
- Four sourced Ledger Island missions, daily contracts, personal journal, repository dispatch notices and separate public evidence/personal recognition.
- Existing IndexedDB saves are retained. Older overlay v1 files can be explicitly imported; exact source records are retained and unknown parent revisions remain unknown. `colosseum:v1` is never overwritten.

## Verified models and limits

Browser CPU/ONNX q4: SmolLM2 135M (~185 MB), Qwen2.5 0.5B (~794 MB), Qwen3 0.6B (~929 MB), plus ~15 MB runtime. All three genuinely initialized and generated in Chromium 151 release QA. Exact repositories, revisions and output/configuration/timing records are in `data/model-research.json` and `data/browser-verified-captures.json`.

The initial 128-token math attempts all failed the checker: their reasoning ended before a valid final answer. Generation took approximately 42, 133 and 168 seconds respectively. This establishes execution, not accuracy or superiority. Two additional genuine native CPU recordings preserve both an accepted result and a rejected final-answer format.

The observed aggregate Chromium process RSS peaked around 6.27 GB during release QA; it includes runtime/UI and can double-count shared pages. Model-only peak and visitor-device memory are unmeasured. Prefer a desktop with several GB free. Mobile layout works; mobile model generation has not been verified. Gemma/LFM remain research candidates, and avatars without browser adapters remain SHOWCASE/OFFLINE. A visitor sees PLAYABLE—VERIFIED only after actual generation and evaluation in that session.

Practice is the player's answer. Recorded playback is prior captured output. Browser records are client controlled; published recordings are owner curated, not independently authenticated. There are no worldwide ranks or universal intelligence scores. Public hosted inference remains denied by default. No wallets, trades, funds, live chain claims or arbitrary code execution.

Ledger examples cite the exact official Solana documentation commit; they are not live chain observations. Hosting/model-hosting quotas and visitor hardware still apply. There is no promise of unlimited free inference.

See HANDOFF.md for validation and CHANGES.md for the source inventory.
