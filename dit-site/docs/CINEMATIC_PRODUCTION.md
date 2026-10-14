# V7 cinematic production verification

Authoritative project: `reixdd/2` → `dit-3d-assets` → `dit-site/`. Reviewed on 2026-10-14 against the checked-in concept references and the actual local application. The separate hosted Sites project was not used or published. No screen recording was available among the supplied files.

## Presentation

The detailed original GHOST, NULL and ECHO artwork remains the strongest supplied character source. It is rendered as transparent 2.5D busts in a shared Three.js camera with real silver podium geometry, recessed colored seams, bevels, fasteners, contact shadows, environment reflections, floor and three layers of instanced architecture. The nine recovered GLBs are included unchanged as authoring prototypes, not presented as newly finished character models. Reference image filenames do not consistently match their depicted characters.

Transparent picking and tapered silhouettes remove rectangular portrait hit areas. Idle tracking, breathing and accents respond to real backend states; selection has distinct opt-in audio. Dossiers now have a large portrait and accessible Memory, Signals, Research and Proposals tabs. The treasury stays on the left, transmissions run along the bottom, and navigation and audio remain available on mobile. The live page loads one consolidated stylesheet and locally bundled licensed fonts and Three.js.

The actual browser correction pass resolved laptop treasury/feed overlap, camera clipping after closing a dossier and resizing, and an empty reduced-motion canvas after resizing while outside the viewport. The last issue came from clearing the drawing buffer before a renderable frame; resize and rendering now happen together. Screenshot pixel assertions check that all three machines remain visible at each tested width.

## Reproducible checks

- `npm test`: application test files, including the existing API, persistence, worker, voting, verification and provider coverage.
- `node --test --test-isolation=none tests/*.test.js`: 69 individual tests passed, zero failures.
- `npm run build`: existing Worker build completed with 9 modules and 38 assets. No deployment was performed.
- `npm run test:browser`: 76 checks passed in installed Chromium via Playwright, with a disposable local file store and the scheduler disabled. Zero uncaught application errors. Detailed checks and measured timing are in the ZIP's `verification/results.json`.
- `git diff --check`: clean. Server, worker, migration, launcher and environment-contract source remained unchanged.
- All nine GLBs were checked for valid glTF 2 headers, declared byte lengths and embedded mesh/material data.
- An independent reduced-motion check counted actual WebGL clear calls: 5 after initial rendering, 6 after keyboard focus, unchanged during each subsequent idle observation. This confirms event-driven drawing separately from the low-power fallback.

The browser journey exercises actual silhouette hovering, transparent-margin rejection, keyboard selection, all dossier tabs, focus/escape handling, sign-in access from a dossier, recording/switching/reloading a vote through the real local API, Network/proposals/verification controls, Transmissions, System, audio toggles, API failure/retry, missing-renderer fallback and reduced-motion scheduling. Viewports: 1920×1080, 1440×900, 1366×768, 390×844 and 320×740. Captured screenshots are included in the release archive.

Populated memories, observations, failed research and simulated proposals are explicitly labeled **browser-only test fixtures**. They are never inserted into application storage. Voting uses the existing test-only local identity and an isolated temporary store. Production data and credentials were not read or modified.

## Performance and verification limits

The renderer uses display-synchronized `requestAnimationFrame`, capped adaptive DPR, sustained frame-time sampling, shared/instanced geometry, no expensive postprocessing, visibility pausing and resource cleanup. Sustained frame times over 50 ms at minimum DPR select a still scene; the native controls and dossiers remain usable. Reduced motion removes continuous idle rendering. The browser run used Chromium's SwiftShader software renderer, not a gaming GPU. Its timing is included as a diagnostic of the fallback behavior, **not evidence of 144 or 240 FPS**. Hardware refresh-rate targets still require measurement on appropriate devices.

The final software-rendered run measured a 433.4 ms median and 616.7 ms p95 during its 130-frame sampling window; DPR reduced to 0.75 and the scene selected still mode. These slow software timings are a material environment limitation, not a high-refresh benchmark.

Ollama/JARVIS model generation, real Supabase authentication, live research production and finalized-chain RPC verification were not configured for this run. Their source and API contracts were preserved, and the existing automated tests passed; this does not establish that those external services are operational. The local browser correctly displays the worker as offline and recorded-work empty states. No token deployment, fee transfer, signing change or trading feature was introduced.

The production characters remain 2.5D with restrained movement, not rigged full-volume models. Mobile keeps all three in view and exposes the larger artwork in dossiers. Safari, Firefox, physical mobile GPUs and high-refresh monitors were not tested in this environment.

See `../START-HERE.md` for launch, upgrade and verification instructions. Preserve your existing `.env` and `.data/` when updating.
