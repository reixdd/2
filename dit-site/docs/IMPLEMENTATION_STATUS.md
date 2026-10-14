## Session 3: Grand Line-inspired machine control redesign

- Replaced stacked long-scroll DIT homepage with one compact cockpit centered on the three existing agents.
- Removed duplicate agent portrait cards and duplicate voting cards. Votes appear in one agent nameplate each.
- Dystopian city art is a fixed full-website background, desaturated/dimmed under translucent panels.
- Stage glow, grid, particles and shader changed from red to one understated accent per agent.
- Grand Line V6 systems reviewed and deliberately ported by interaction pattern: featured host, crew rail, pulse on authentic event, compact live center and state-driven stage. See `docs/GRANDLINE_TO_DIT.md`.
- Mainnet-verified launches and AI proposals now live under the on-demand Network drawer; original separate archive removed. Per-token evidence route preserved.
- Fee accounting, activity feed, and chain status moved next to visible agents. Research transmissions cause contextual updates only after server events.
- Existing backend, Circuit placeholder, read-only verification and privileged launch code unchanged.
- **38 automated tests passing, Worker build passing, local API smoke tests passing.** Chromium screenshot capture unavailable in this environment; full rendered visuals await local browser check.

# DIT completion notes (recovery from Claude logs)

## Delivered

- Recovered actual unfinished source files from the uploaded logs, rather than re-generating the site.
- Preserved original website design, art, `server/api.js` mainnet verification, `backend/launch.mjs` and official Pump SDK pinned dependencies.
- Recovered and integrated 2 Supabase migrations, agent/persona configuration, Supabase & local stores, auth, voting, Circuit event normalization, verified-fee accounting, persistent research pipeline, scheduler, LLM adapter, and tests.
- Fixed Cloud Worker module bundling to include backend imports in a single ESM bundle without external bundler dependencies.
- Corrected the Circuit event deduplication key (`source,external_id`), public 422 validation status, SQL nullable system-job agent ID, and privileged backend package `prepare` auto-execution trap.
- Fixed worker `runCycle` throwing `ReferenceError` in `finally` after successfully recording observations.
- Created one-process local backend (`server/local.mjs`) using atomic file persistence and a scheduled worker.
- Added an agent-voting dashboard and real backend-driven dossier data, activity/fee views, plus CSS-powered 2.5D movement using existing agent artwork.
- Disabled implied treasury transfer support from arbitrary configuration strings; real transfer verification has not been implemented.
- Added worker persistence/scheduling test coverage. Final result: **33 automated Node tests passing** in this workspace.
- Smoke-tested built Worker API and local server routes (`/api/config`, `/api/agents`, `/api/votes`, `/api/health`, `/api/treasury`, `/api/activity`).

## Limitations / external services not exercised

- Supabase SQL migrations not applied to a live instance. No authenticated production vote via Supabase was tested; local dev votes are synthetic identity tests.
- Research provider network requests were tested using deterministic fixtures, not the live social/market APIs. A real deployment must respect providers' terms and rate limits.
- The Anthropic model endpoint and token costs require valid provider configuration. Absent credentials, research runs but proposal generation is held.
- Circuit webhook handling implements a configurable project HMAC-SHA256 envelope. Its signature/payload format is **not confirmed against official Circuit docs or a live account**. Do not set a production secret until the contract is independently verified.
- The 25% treasury is an accounting target only. The transfer workflow is intentionally unsupported, and no money is sent.
- Portraits use parallax/tilt animation rather than fabricated GLB rigging. No GLB models supplied.
- Browser-based full visual QA was unavailable due to the sandbox browser blocking localhost; Node HTTP and logic tests passed instead.
- No DIT mainnet coin was created or configured with Circuit. This bundle must not be described as a deployed coin.

## What to configure next

1. Real Supabase project + SQL migration QA + OAuth/email confirmation redirect settings.
2. One reachable market-data RPC/API and authorized research feed accounts.
3. Official Circuit webhook contract or supported event export (to replace the placeholder adapter); review its creator fee and fee-sharing architecture before any mainnet use.
4. Real rigged 3D assets only if needed for full head/face animation.

## Test/Run

- `node --version` (Node 22+)
- `npm test`
- `npm run dev`
- `npm run build`

No package install is needed for local demo: all runtime APIs are built-in Node. `backend/` is isolated and not executed.

- Original font binaries are intentionally omitted from the delivered archive; restore them from your own uploaded original ZIP for pixel-perfect typography.

## Session 2 additions

- `dist/stage.js`: Three.js control-room scene (3 agents, state-driven visuals from `/api/agents`, honest "worker offline" dimming, GLB drop-in, lazy load, reduced-motion, mobile DPR cap, context-loss handling). Syntax-checked only; not rendered in a browser here.
- `dist/realtime.js` + `/api/stream` (local SSE): triggers refetches; API remains source of truth.
- `dist/evidence.js`: per-mint evidence file page; `/api/evidence/:mint` now returns sanitized `proposal_history` from audit logs.
- Dossier now has a vote button; token dossier links to its evidence file.
- Tests: 35 passing (2 new for evidence route).
- Circuit documentation search found nothing authoritative; see README for the Pump native fee-sharing alternative.
- Still not done: live Supabase verification, live provider calls, GLB assets, browser visual QA, real Circuit integration.
