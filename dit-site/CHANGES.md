# V7 cinematic production changes

- Consolidated the running page from six cascading stylesheets to one maintained stylesheet. Historical sheets remain for reference and existing historical tests, but are not loaded.
- Bundled Anton, IBM Plex Mono and pinned Three.js 0.160.0 with licenses.
- Retained detailed character artwork; added tapered bust silhouettes and alpha-aware picking instead of rectangular portrait hit areas.
- Replaced wide discs with compact bevelled PBR silver podiums, recessed color seams, top surfaces, fasteners, contact shadows and an environment reflection map.
- Added instanced city layers, restrained shared-camera tracking, agent-specific audio responses, adaptive pixel ratio, visibility scheduling and WebGL resource disposal.
- Projected character labels through the shared camera and fixed the resize-after-dossier clipping bug.
- Kept resize and rendering in the same frame to prevent an empty canvas when reduced-motion visibility handling pauses a draw.
- Enlarged dossiers with portrait panels, keyboard-operable Memory / Signals / Research / Proposals tabs, voting feedback and connection retry.
- Fixed sign-in being blocked behind a native dossier modal; preserved the existing API and actual local vote persistence.
- Kept navigation and both audio controls accessible on mobile; corrected laptop treasury/feed overlap.
- Added a disposable-backend Chromium regression suite. No backend, worker, migration, launcher, environment contract, signing logic or existing data was changed.

## Final interactive 2.5D art-direction amendment
- Removed procedural podiums, heavy PMREM material processing and synthetic stage geometry; kept the detailed transparent portraits.
- Restored earlier stronger .22 portrait tracking / .35 world-camera parallax, applied to all three entities through one update loop.
- Added gentle pointer-driven background-city and moving-bar depth; respected reduced motion.
- Replaced fake podiums in still fallback with diffuse colored pools, added slender non-card label accents.
- Kept safe hosted Supabase binding-name diagnostics; production secrets, credentials and live provider connections are not part of this ZIP.

## 2026-10-15 final launch pass
Spectral Phosphor terminal, source-clock market filtering, retained per-contract artwork, evidence dossiers and 67-update browser acceptance. See docs/FINAL-LAUNCH.md.
