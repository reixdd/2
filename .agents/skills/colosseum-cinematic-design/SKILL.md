---
name: colosseum-cinematic-design
description: Art-direct or implement non-generic COLOSSEUM web visuals, expressive motion, cinematic scenes, and coherent React components without rebuilding gameplay.
---

# COLOSSEUM cinematic design (project-specific)
Trigger on: UI redesign, character presentation, animated arena, landing page, navigation, world map, battle staging, motion effects, typography, visual polish.

1. Read AGENTS.md, HANDOFF.md and existing styles/components; identify approved character portraits, existing site palette and interaction rules. Preserve canonical imagery and already-working game flows. Never restyle the whole site when asked to fix one element.
2. Propose ONE distinctive visual direction for the requested surface (composition, texture, typography, motion hierarchy). Use an actual screenshot of the current state. Reject default SaaS card grids, interchangeable glowing gradients, unnecessary pills and giant empty decorative sections.
3. Seek implementation references from the project documentation in `docs/CLOUD-DEVELOPER-TOOLKIT.md`. Actual optional libraries: React Bits (animated text/effects), Magic UI (specific registry components), React Three Fiber + Drei (true 3D), Motion / GSAP (sequenced animation). A library is **not** automatically installed by being listed.
4. Implement the minimum coherent set. Favor scene depth, meaningful movement and tasteful sound cues over stacks of particle overlays. Avoid unrelated character changes, fake 3D and loud effect spam. Keep visuals readable at 1366x768 and 390x844.
5. Guard render time and accessibility: reduced motion, skip affordances, keyboard navigation, focus, contrast, mobile performance; prefer lazy 3D and effects-off mode.
6. Capture screenshots and compare before/after; exercise navigation, inventory/forge and battle interactions; run project validation commands. No claims of high quality without visual inspection.

Always pair this skill with `frontend-design` for art direction and `magic-ui` only if Magic UI is an actual implementation choice.
