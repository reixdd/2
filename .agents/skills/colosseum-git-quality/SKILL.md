---
name: colosseum-git-quality
description: Use for GitHub branch hygiene, commits, pull requests, review, CI, release tracing and avoiding accidental overwrites of working COLOSSEUM code.
---

# Git / code review quality
- Confirm repository `reixdd/2` and intended base branch; check `git status` and current head. Never force-push protected or unrelated branches.
- Start a scoped feature branch. Review `git diff --check`, inspect changed file list, ensure no secrets, auth tokens, local model weights, caches or generated bundles.
- Make meaningful commits. Include commands run and results, plus any unverified paths, in the PR.
- Respond to CI/reviewer errors with actual fixes and reruns; don't add superficial green badges or fabricated assertions.
- GitKraken MCP is **optional and not connected by adding this SKILL.md**. GitHub tools already cover PRs and branches. See the manual GitKraken cloud setup note in `docs/CLOUD-DEVELOPER-TOOLKIT.md`.
- Never merge without explicit user approval.
