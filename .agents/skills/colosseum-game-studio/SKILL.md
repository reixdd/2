---
name: colosseum-game-studio
description: Build or refine COLOSSEUM gameplay, optional browser 3D, camera, arena, combat-like visual sequences, asset pipeline and player experience while preserving model evaluation truth.
---

# Game Studio — COLOSSEUM routing
Before game work read `colosseum-gameplay-design/SKILL.md` and `colosseum-evidence-integrity/SKILL.md`; if browser gameplay is involved read `colosseum-release-qa/SKILL.md`.

- The browser game is a representation of **model evaluations**, not a new simulated model scorer. Keep real checker/evidence data separate from visual animations.
- For React-hosted 3D use `react-threejs-game` and the upstream OpenAI Game Studio guidance (links below). Render the world in a dedicated opt-in scene while retaining a DOM HUD, working 2D fallback and the existing battle state.
- Enforce simulation/render/input boundaries; clock-delta animation; no per-frame React state updates; load GLB/glTF assets only from approved sources. Preserve approved avatars and keep other contenders visible.
- Prefer a 2–5 second vertical slice and a real-playable interaction over an entire 3D rewrite. For a scene transition, verify incoming/outgoing camera, characters, art, timing and audio continuity.
- Verify keyboard/touch, reduced motion, 1366x768 and mobile; measure render perf and stop if it degrades significantly. Run real Playwright browser QA, screenshots and existing tests.

Current upstream skill references (read before extending the corresponding area; these are links, not preinstalled copies):
- https://github.com/openai/plugins/blob/main/plugins/game-studio/skills/game-studio/SKILL.md
- https://github.com/openai/plugins/blob/main/plugins/game-studio/skills/react-three-fiber-game/SKILL.md
- https://github.com/openai/plugins/blob/main/plugins/game-studio/skills/game-ui-frontend/SKILL.md
- https://github.com/openai/plugins/blob/main/plugins/game-studio/skills/game-playtest/SKILL.md
- https://github.com/openai/plugins/blob/main/plugins/game-studio/skills/web-3d-asset-pipeline/SKILL.md

Do not use outdated `openai/skills/tree/main/skills/develop-web-game`: that path is no longer present upstream.
