# Phase 4 source changes

Continued the complete supplied celestial application, preserved the original CPU/Vite engine under `engines/original/`, retained the uploaded recovery overlay under `recovery/phase4/`, and established source control in `reixdd/2`. JARVIS and the original running engine were left intact.

- `app/phase4.css`, `app/layout.tsx`, `components/colosseum/{nav,arena-view,model-sanctuary,world}.tsx`: model-first celestial presentation, compact world navigation, responsive artwork and shared providers.
- `components/colosseum/{equipment-forge,workshop-view,skill-hall,mutation-lab-view,lineage-view,skill-art}.tsx`: actual accessible relic equipment, shared builds, mutation sealing, ancestry and supplied relic SVGs.
- `lib/colosseum/{game-store,build-store,builds,legacy-build,journey-store}.ts*`: persistent configurations, stale-tab protection, isolated drafts, atomic journey merges and explicit legacy recovery.
- `runtime/local-worker.js`, `lib/colosseum/{models,local-runtime,device-store,battle-evidence}.ts*`: allowlisted pinned model artifacts, browser CPU worker, consent/progress/streaming, cancellation, actual timing, complete configuration/input validation and evidence capture.
- `components/colosseum/{encounter,battle-stage,local-vault}.tsx`, `lib/colosseum/{battle,native-replays,browser-replays}.ts`, `data/{native-battle-phase4,browser-verified-captures,model-research}.json`: real checkers and captured responses, original replay evidence, animation controls and independent provenance labels.
- `components/colosseum/{journey,dispatch,solana-island}.tsx`, `app/{journal,dispatch,leaderboards}/page.tsx`, `lib/colosseum/gameplay.ts`, `data/world-dispatch.json`: deterministic missions/contracts, local achievements and repository announcements.
- `scripts/{prepare-runtime,prepare-public,build-static,package-launch,verify-browser-models,smoke-public-site}.mjs`, `lib/colosseum/site-path.ts`, `next.config.mjs`: generated worker/WASM, API-free static export, root/GitHub project paths and recoverable release archives.
- `tests/gameplay.test.ts`, `tests/legacy-recovery.test.ts`, `tests/ui/{phase4,evidence}.spec.ts`: genuine checker/provenance regressions and real browser gameplay/failure/device journeys. Earlier interface tests are retained under `recovery/baseline-world.spec.ts`.
- `.agents/skills/`, `AGENTS.md`, package/lockfile, environment template and handoff documents: eleven retained development/project skills and reproducible run/release instructions.

All approved character PNGs remain unchanged. Fictional configuration changes are never presented as training, accuracy gains or global ranks.
