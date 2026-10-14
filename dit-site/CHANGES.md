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
