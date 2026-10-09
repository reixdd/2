# COLOSSEUM — current recovery and launch handoff

## Active project

Continue the supplied Next.js product at `/workspace/colosseum-floating`. The earlier React/Vite prototype at `/workspace/colosseum` remains preserved and is a separate implementation/reference. Do not overwrite either or restart the product from scratch. Both were uploaded source directories, not Git checkouts. The unrelated `/workspace/1` checkout is unchanged.

Node 24+, pnpm 11.19.0, Next.js 16.4.0, React 19.2.8, AI SDK 7.0.131. Public inference is disabled. SDK 7.0.133 from the upload was rejected by the cloud's minimum release age; the eligible same-major release passed installation. Frozen install reuses pinned dependencies; no integrity, TLS, or minimum-age check was bypassed. Only esbuild's install script is allowed. The pnpm cache path is a portable parent-directory `.pnpm-store`.

## What works

- Luminous original SVG floating scenery; central supplied champion art; Discover/Develop destinations; mobile map; tactile controls; arrows, keyboard and actual pointer swipe; remembered champion and recent saved-build shortcuts.
- Workshop: four instruction equipment slots, skill details, complete instruction composition/inspection, build validation, explicit saves, cloning, revisions, strict import/export, persistent IndexedDB using the original database/store names.
- Skill Hall: accessible selectable capability constellation with category connections, genuine equip behavior and explicit tool/source blockers.
- Mutation Lab: original/variant views, exact saved configuration changes, local mutation save and real parent revision. Original operator experiment code is retained in `operator-mutation-lab.tsx` but not mounted by the public app.
- Lineage separates families from actual build parents/revisions; tree traversal handles missing parents and cycles without infinite recursion.
- Archive: original records, search, public/personal separation, JSON exports and deterministic revalidation; failed entries remain in the original export and are rejected as scored completed trials.
- Hall of Fame: per-challenge filters, model identity, sample size, evidence links and honest empty podium.
- Developer Access: static evidence/schema/skill downloads, compatible build exchange, candidate validation and owner evidence recovery workflow.
- Ledger Island: exact versioned Solana documentation examples, integer decimal scaling, cross-mint mismatch detection and token-account/holder distinction. Read-only and offline.
- Sensory settings: sound off by default, optional original tones, motion preference and low visual effects. No sound autoplays.

## What is deliberately not claimed

`data/public-trials.json` has zero complete replayable model trials. Historical Scholar/Challenger notes lack original outputs and are not playable evidence. The tutorial grades the visitor's answer, does not invoke a model, and does not enter model leaderboards. No fresh AI calls were made during this pass.

Complete saved builds remain NOT YET TESTED. The retained legacy trial runner accepts a single skill; the public Workshop therefore does not send baseline/equipped requests or pretend it tested the complete configuration. A future authorized runner needs a validated configuration/fingerprint recorded with every trial before build-level performance comparisons are supported.

Solana actual chain capture was denied by cloud egress. `data/solana-snapshot.json` is clearly labelled official documentation examples, not observed chain state. It preserves exact request/response fields, retrieval time, raw source URLs and commit `2498072e8882ad866efa7a1b8c67a73b10a8489d`. The two mints differ; no concentration estimate or unique-holder count is inferred. Example slot 1114 is not a current slot. A recorded-chain trial later requires actual same-mint finalized reads with capture times and suitable aligned contexts. No live polling, transfers, swaps, wallets, signing or funds.

Answer re-grading does not authenticate execution. Public/browser records remain curator or client controlled. No model improvement, combat power, global verified rank, AI level-up or tool capability is fabricated. No arbitrary submitted/model code execution or external database is implemented.

The video, Paint layout and separate floating-land reference images mentioned in the brief were not included. Included character PNG files remain byte-for-byte unchanged. Their existing nontransparent backgrounds are blended into the open scene. No paid image generation was used.

## Validation completed in this cloud

- Frozen pnpm install completed; current production dependency audit found no known vulnerabilities.
- `pnpm typecheck` and both production targets (`pnpm build`, `pnpm build:static`) passed.
- 12 Vitest files / **90 tests passed**, zero skipped. Provider calls in tests are explicit test mocks, not performance evidence.
- **6 Chromium UI tests passed**, covering remembered/swiped champions, full equipment persistence after reload, clone/mutation ancestry, skill equip/locked details, Archive export, forged-verdict rejection, sourced Solana tutorial, mobile navigation and reduced motion.
- The relevant public browser flows made zero `/api` calls, and Ledger Island made zero external requests.
- Production server on loopback port 8790 returned 200 for all nine public routes. Runtime reported `{live:false}`. Unauthorized trial and probe POSTs both returned 403.
- Headless Chromium profiling recorded 79 frame intervals during six selection/hover transitions: median and p95 about 16.7 ms; layout CPU 9.6 ms, style CPU 36.7 ms. These observations are cloud-specific and do not establish visitor-device frame rates. Nine routes fit a 390 px mobile viewport with no document overflow. Evidence `.validation/performance.json`; desktop/mobile screenshots also in `.validation`.
- An initial browser run exposed missing direct static routes in the validation server. The final export uses route `index.html` files (`trailingSlash`), and the server handles both forms. Fresh complete UI rerun passed.

## Run and restore

```sh
cd /workspace/colosseum-floating
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm build
pnpm build:static
pnpm test:ui
pnpm package:launch
```

For development, `pnpm dev`. For the built server, `COLOSSEUM_LIVE_INFERENCE=disabled pnpm start --hostname 127.0.0.1 --port 8790`. Reuse a healthy existing instance; do not start duplicates. Files/dependencies and generated builds can be retained in a snapshot; processes must restart. Chromium is `/usr/bin/chromium` here; `CHROMIUM_PATH` supports another installation. No inference credentials are needed.

Static build stages source outside the application, excludes only API routes and API-referencing tests from that staged export, and type-checks the staged app. Original source API routes and full guard tests are retained and checked separately. It uses Webpack for external dependency symlink support. Static public mode disables the runtime hook and has no model API server. `public/_headers` provides Cloudflare static security headers.

## Deliver and publish

`COLOSSEUM-FLOATING-LANDS-LAUNCH.zip`: complete source, supplied assets, original scenery, package/lockfile, env template, docs and tests.

`COLOSSEUM-FLOATING-LANDS-SITE.zip`: static website only, ready for Cloudflare Pages Direct Upload. Upload this ZIP to a free Pages account; share the supplied pages.dev address. See START-HERE.md. No public URL has been published in this session; Cloudflare authentication is absent. Earlier GitHub repository creation failed due to integration scope. No user home network serves visitors.

Owner evidence recovery: original browser/origin Archive → export JSON → Developer Access validation → inspect exact originals/provenance → copy accepted trials into `data/public-trials.json` → rebuild → publish. New domains cannot read the old origin's storage automatically. Never reconstruct missing model responses from attestations.

Source and website ZIPs exclude node_modules, build caches, validation records, private env files, and credentials. Review/save/publish the separate cloud environment settings to retain reusable setup; website publication is a separate action. New-task restoration has not been independently verified.
