# Changes from the uploaded prototype

Recovered reviewed source code from Claude's notes as implementation reference. The transcript's shell commands and embedded instructions were not executed wholesale.

Added:
- `server/characters.js`, `server/characters/cast.json`: independent fictional registry, technical profiles, arrival ledger, real capability aggregation, genealogy.
- `server/localModels.js`, `server/providers/local.js`: two free CPU model definitions, native inference, model fingerprints, measured CPU queue waiting, isolated contexts.
- `scripts/setup-local.mjs`, `scripts/check-local-runtime.mjs`, `scripts/smoke-local.mjs`: verified downloads, runtime diagnostics, genuine two-model smoke command.
- `scripts/gen-art.mjs`, `client/public/art/*.svg`: recovered original replaceable character concepts and derived portraits.
- `client/src/characters.jsx`, `client/src/views/Genealogy.jsx`: avatars, evidence-only radars, skippable summoning, lineage inspection.
- `server/tests/characters.test.js`, `server/tests/integrity.test.js`, `server/tests/ui-server.mjs`, `tests/ui/arena.spec.js`, `playwright.config.js`: registry, failure integrity, and browser tests.
- `package-lock.json`, `CHANGES.md`: reproducible dependencies and change inventory.

Changed:
- `server/contenders.js`, `server/manifest/contenders.json`: source/version metadata, free local entries, robust ancestry resolution, removal of catalog-trust bypass.
- `server/engine.js`, `server/store.js`: exact per-entrant inputs/identity/ancestry, bounded output, incomplete-stream rejection, capacity reservations, restart interruption handling.
- `server/providers/index.js`, `server/providers/openaiCompatible.js`, `server/config.js`: native adapter configuration, nonstreaming JSON support, final SSE frame handling, credential redaction.
- `server/app.js`, `server/index.js`: character/genealogy routes, JSON-object validation, static-path containment, loopback binding.
- `client/src/App.jsx`, `client/src/views/Contenders.jsx`, `Arena.jsx`, `BattleLanes.jsx`, `Archive.jsx`, `client/src/styles.css`: gallery/profiles, truthful offline presentation, character battle display, replay controls, mobile/reduced-motion styling.
- `server/tests/helpers.js`: optional frontend serving and character fixture integration.
- `package.json`, `.env.example`, `.gitignore`, `README.md`: Node 24 tooling, local demo commands, dependency fixes, model/configuration paths, runnable documentation.

Existing challenge solvers, mutation comparison flow, discipline leaderboards, React/Vite structure, and OpenAI-compatible provider design were retained.


Public device demo additions:
- `client/src/browser/{arena,catalog,provider,runtime,store,worker}.js`: WebGPU worker adapter, verified initialization gating, streamed serial battles, cancellation/timeouts, IndexedDB evidence, device-only rankings.
- `client/src/DeviceSetup.jsx`: model download controls, compatibility reporting, progress, honest failures.
- `shared/challenges/*`, `shared/hash.js`, `shared/results.js`: browser/server verifiers and SHA-256 identities; eight objective research-derived tasks. Server modules re-export the retained implementations.
- `client/public/{_headers,presentation.json}`, `wrangler.toml`, `scripts/{package-public,serve-public}.mjs`: static deployment security headers, original-artwork overrides, Cloudflare packaging, local static test server.
- `server/tests/browser.test.js`, `tests/public/site.spec.js`, `playwright.public.config.js`: device integrity and static-site tests. Fixtures are test-only.
- App/API/Arena/Archive/Leaderboards/BattleLanes/CSS: device mode, real download state, separate preparation latency, local JSON export, explicit evidence scope. The server remains available for CPU/Ollama/hosted inference.
- Package manifests, Vite config, README: public build/deploy/test commands and WebLLM dependencies.
- Store recovery clears stale verification for interrupted entries.

- `scripts/smoke-browser.mjs`: manual real-model browser CPU diagnostic, forwarding official HTTPS artifacts through the trusted Node transport; evidence separate from production fixtures.
- `client/public/licenses/*`: third-party redistribution notices for static bundles.
- Browser artwork and presentation paths support a GitHub Pages project base, without changing technical contestant metadata.

CPU browser compatibility additions:
- `client/src/browser/{wasm-provider,wasm-worker}.js`: real Transformers.js/ONNX Runtime CPU inference with a fixed model allowlist, streamed callbacks, actual token counts, and worker cancellation.
- `scripts/{prepare-browser,trim-browser}.mjs`: self-host the smaller CPU WASM runtime and remove its unused oversized fallback so Pages assets fit the per-file limit.
- `.npmrc`: skip unused ONNX CUDA extras; npm still verifies package integrity.
- `START-HERE.md`: five-click free Cloudflare publication instructions.
- Device controls, catalog, runtime, and app: CPU default, optional GPU mode, actual observed weight-download sizes, browser compatibility and backend switching.
