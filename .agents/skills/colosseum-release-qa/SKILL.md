---
name: colosseum-release-qa
description: Validate, checkpoint, export, and publish a recoverable free COLOSSEUM release.
---

Run type checks and logic tests, then the real select/equip/save/reload/Skill Hall/mutate/lineage/battle/evidence/journal/Ledger/dispatch/export journey. Test 1920×1080, 1440×900, 1366×768, 390×844, keyboard, touch, reduced motion, storage errors, cross-tab conflicts, and cancellation. Audit requests for unexpected paid inference. Treat HTTP 200 alone as insufficient.

Verify all PLAYABLE models with real generation; explicitly document untested candidates. Build static distribution; inspect per-file Cloudflare limits and confirm no weights, secrets, API routes, or fabricated records ship. Update HANDOFF.md/CHANGES.md, commit checkpoints, and create source/site archives. Source must include all eleven repository skills and the retained original engine. Push a review branch to reixdd/2, create and attach a PR; do not merge without authorization. Publication requires actual hosting access. Report local validation separately from public smoke tests and never invent a deployment URL.
