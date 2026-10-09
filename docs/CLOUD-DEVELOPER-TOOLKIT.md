# COLOSSEUM Cloud Developer Toolkit

This file lives in GitHub and survives fresh cloud coding sessions. No local install is required just to **read** project skills.

## Discoverability
- **Source branch**: `reixdd/2`, `phase4-playable-arena` until this PR is merged.
- **Location**: `.agents/skills/<skill-name>/SKILL.md`.
- Read root `AGENTS.md`, `HANDOFF.md` and the selected skill before work. Project skills must live on the branch the cloud agent checks out.
- **These skills are instructions, not runtime packages.** Importing component source, browser binaries, MCP connections and API credentials are separate operations.
- Preserve the previous 11 project skills. New additions: `frontend-design`, `magic-ui`, `react-threejs-game`, `colosseum-cinematic-design`, `colosseum-game-studio`, `colosseum-deep-engineering`, `colosseum-git-quality`.

## Where to find actual non-generic UI tools
| Tool | Primary purpose | Link |
| --- | --- | --- |
| React Bits | Animated typography, atmosphere, interactive components | https://github.com/DavidHDev/react-bits |
| Magic UI | Component registry and animated UI patterns | https://github.com/magicuidesign/magicui |
| React Three Fiber | Real 3D scenes and camera | https://github.com/pmndrs/react-three-fiber |
| Drei | 3D helpers for R3F | https://github.com/pmndrs/drei |
| Motion | React animation and microinteraction | https://github.com/motiondivision/motion |
| GSAP | Carefully choreographed timeline motion | https://github.com/greensock/GSAP |
| Lenis | Smooth scrolling where appropriate, not inside game controls | https://github.com/darkroomengineering/lenis |
| shadcn/ui | Accessible base primitives, customized beyond presets | https://github.com/shadcn-ui/ui |

**Use only components whose license and dependencies have been reviewed.** Components are not installed just because linked here. Prefer one signature effect per scene, proper typographic hierarchy and actual camera/lighting continuity. Avoid wrapping every surface in a card.

## Engineering and game development
- Existing project skills already include Next.js, React performance, component composition, browser QA, gameplay, local inference and release QA.
- `frontend-design` is the unmodified upstream Apache-2.0 design skill from Anthropic (license alongside it).
- `magic-ui` is the unmodified upstream MIT skill including its component references (license alongside it).
- `react-threejs-game` is an unmodified skill declaring MIT from Hack23 (provenance alongside it).
- COLOSSEUM-specific new skills route to the above without blindly changing the game's working implementation.
- Current OpenAI game specialist skills: https://github.com/openai/plugins/tree/main/plugins/game-studio/skills (read upstream as needed; not copied into this repo). The previously suggested `openai/skills/.../develop-web-game` path is absent.
- Superpowers and Context7 are already connected in ChatGPT, where supported. They are not implicitly installed as NPM packages or GitHub source files.

## GitKraken: what GitHub setup can and cannot do
- GitKraken's MCP service is a **separate authenticated program**, not a GitHub `SKILL.md`. GitHub connector is already connected and can handle commits, branch/PR review.
- Official integration guide: https://help.gitkraken.com/mcp/MCP-getting-started/
- To use GitKraken with a **cloud agent**, the cloud runtime must permit installation of `gk`, interactive authentication and registering an MCP server. Merely committing config won't authenticate it. Avoid storing tokens or credentials in this public repository. Follow your cloud platform's supported MCP interface if/when it offers one.
- Do not assert GitKraken is connected until a real authenticated query works.

## Quick verification in every new session
1. Open the checked-out repository and report its branch/commit.
2. Read `AGENTS.md` and list `.agents/skills/*/SKILL.md` (expect 18 on this branch after merge).
3. Select skill(s) explicitly based on task; for UI: cinematic-design + frontend-design; for 3D: game-studio + react-threejs-game; for bug fixes: deep-engineering.
4. Run `pnpm typecheck`, `pnpm test`, and relevant Playwright tests when code changes. Do not invent results.
5. Record reproducible tests and exact scope in PR; no unsolicited whole-site redesign.

## Reuse on future repos
For a new cloud GitHub repo, **copy only the reusable skills** `frontend-design`, `magic-ui`, `react-threejs-game` and their license/reference files. Do not copy project-specific COLOSSEUM instructions as universal policy. To truly share across repositories, create a separate developer-toolkit template repository or an account-level Skills/Plugins installation supported by the agent. Cloud Codex project skills do not automatically become ChatGPT Work account-wide skills.
