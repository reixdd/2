---
name: colosseum-deep-engineering
description: Senior-engineer workflow for nontrivial repository coding, architectural changes, complex bugs, performance fixes, and multi-file development with evidence-driven delivery.
---

# Senior engineer + debugging + reviewer
Scope only the requested project. Verify branch is from `reixdd/2:phase4-playable-arena`. Never touch `reixdd/1`.

1. Inspect real files and current tests before designing a change; write down the expected behavior, exact affected boundary and reproducible failing example. Read `HANDOFF.md`; don't discard previous good architecture or recreate modules from partial chat snippets.
2. Identify root cause and affected call/data paths; separate UI, persistence, local models, worker, evaluation, serialization and runtime issues.
3. Write a focused regression test or explicit browser reproduction before changing code, where feasible. Change the smallest verified area; no global wildcard CSS fixes or fictional integrations.
4. Review compatibility, typed interfaces, error paths, state hydration, migration, security and async failure modes. Leave model evaluation scoring and user evidence semantics intact.
5. Run `pnpm typecheck`, `pnpm test` and relevant browser journey; use `pnpm build:public` for publish-related work. If unable to run, state exactly why and do not claim success.
6. Inspect visual snapshots for UI changes and preserve support for keyboard, touch, reduced motion. Include logs of failures and fixes.
7. Commit a scoped branch, review diff and open a PR; do not merge automatically. Update `HANDOFF.md` and `CHANGES.md` only when actual product behavior changes.

If Superpowers plugin is available use its planning/debugging/testing methods, but do not claim an installed plugin can execute a missing tool. Context7 can inform API details, not override real code or version pinning.
