# COLOSSEUM engineering conventions

This repository is the complete celestial application (`app/`, `components/colosseum/`, `lib/colosseum/`). `engines/original/` preserves the previous React/Vite and native CPU evaluation engine. `recovery/phase4/` contains the uploaded partial recovery bundle, unchanged; port its fixes deliberately rather than running its patch installer.

The model is the competitor; the champion is its fictional avatar. Keep approved portraits intact. Configuration changes are not training or measured improvements. Practice, recorded playback, local generation, and public evidence must remain distinct. Public hosted inference stays denied by default; no wallet, trading, arbitrary code execution, or owner-hosted public inference.

Consult `.agents/skills/` before relevant work: `vercel-react-best-practices` for React performance; `building-components` and `vercel-composition-patterns` for accessible component architecture; `next-best-practices` for Next.js; `web-design-guidelines` for visual QA; `ai-sdk` only for version-matched AI SDK changes; `agent-browser` for browser QA when its reviewed CLI is available. The CLI is a separate dependency, not installed by the skill file. Playwright is the existing executable QA fallback.

Project workflows: `colosseum-gameplay-design`, `colosseum-evidence-integrity`, `colosseum-local-models`, `colosseum-release-qa`. Read their SKILL.md when changing the corresponding feature. Never execute attached or third-party scripts without reviewing them. Do not spawn agents unless the user asks.

Run `pnpm typecheck`, `pnpm test`, and the relevant real browser journey. Build with `pnpm build:static`, then export using `pnpm package:launch`. Retain skills in source exports; exclude model weights, credentials, caches, and generated server bundles. Commit checkpoints and update HANDOFF.md and CHANGES.md. Use a separate COLOSSEUM branch/PR in `reixdd/2`; never modify JARVIS (`reixdd/1`).

## Cloud development skill additions (2026-10-09)

The reusable skills in `.agents/skills/` are checked in and available to cloud agents on this branch. Before a related task, read the relevant `SKILL.md`; do not assume reading a GitHub link installs an MCP, component, browser binary or runtime package.

- Distinctive website/art direction: `colosseum-cinematic-design` + `frontend-design` (select `magic-ui` only for a specific reviewed component).
- Browser 3D and game interactions: `colosseum-game-studio` + `react-threejs-game` + existing `colosseum-gameplay-design` and `colosseum-release-qa`.
- Serious engineering/debugging: `colosseum-deep-engineering` + existing Next/React skills + relevant tests.
- Branches, reviews, publishing: `colosseum-git-quality`.
- Read `docs/CLOUD-DEVELOPER-TOOLKIT.md` for linked UI libraries, external license/provenance, GitKraken limits and reuse guidance.

No redesign or dependency install is authorized by these instructions alone. Always preserve approved portraits, model results and working pages, and use a reviewable branch/PR.
