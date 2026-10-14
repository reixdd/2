# V7 — match the reference mock

Visual-only pass. No API, worker, voting or storage behaviour changed.

## What changed
- `dist/reference-v7.css` (new, loaded last) restyles the V6 observatory: full-bleed stage, floating treasury panel,
  centred 3-item nav, status pills, VIEW DOSSIER / VOTE / ⋮ buttons, single transmissions bar.
- `dist/stage.js`: larger busts spread across the full stage and seated on wider, glowing podiums; accent light climbs
  from each podium; layout follows the canvas size (`--stage-span`) so labels stay under their machine. The ⋮ button opens
  a small menu with the existing vote count/meter and the agent's latest signal (Esc / outside click closes it).
- `dist/command.js`: treasury panel now lists CONFIRMED FEES / TREASURY SHARE / PENDING ALLOCATION + a progress bar
  (verified transfers ÷ allocation, so it stays 0% until a verified receipt exists). Transmission cards show
  `AGENT / type` and a relative time. The vote button always reads VOTE (clicking it while signed out still opens sign-in).
- `dist/index.html`: nav label `03 / SYSTEM`, "// LIVE TRANSMISSIONS", "VIEW ALL TRANSMISSIONS", Anton + IBM Plex Mono
  from Google Fonts (falls back to Impact / Consolas offline).
- `dist/assets/cutouts/*.png`: recoloured (GHOST blue eyes, NULL violet slit, ECHO green eyes), empty bottom trimmed and
  feathered. Untouched originals are kept in `dist/assets/cutouts/original/`.

## Hidden, not removed
Model status, worker LED label, the "04 / OPERATOR" nav button (still at `/operator`), the intercepted-signal strip and the
stage caption are hidden with CSS only; their elements still update.
