# V7 — cinematic production pass

Start the existing application with Node.js 22+: `cd dit-site` then `npm run dev`, or double-click `dit-site/START-DIT-WINDOWS.cmd` on Windows. No npm installation is required to run the local application. Open `http://127.0.0.1:4173`.

The scene uses the original detailed 2.5D artwork, real reflective silver podium geometry, an instanced city, and one shared camera. The prototype GLBs remain in `../dit-assets/models/`; they are authoring assets and are not automatically substituted for the character artwork. Fonts and Three.js 0.160.0 are bundled locally with their licenses.

See [production changes and verification](docs/CINEMATIC_PRODUCTION.md) and [startup / upgrade instructions](START-HERE.md). Preserve your existing `.env` and `.data` when upgrading. Backend contracts, model configuration, Windows launcher, and treasury/signing behavior are unchanged.

---

# V6.1 — Windows file-store crash fix

Resolved the `EPERM rename .data/dit-store.json.tmp -> .data/dit-store.json` local-server crash with serialized writes, Windows lock retries, and interrupted-save recovery. **Keep your existing `.data/` directory when upgrading.** See [Windows repair / upgrade instructions](docs/WINDOWS_STORAGE_FIX.md). The Ollama `fetch failed` log is a separate model-connection issue.

---

# V6 // MACHINE OBSERVATORY + LOCAL OPERATOR

The latest build is `DEAD_INTERNET_THEORY_MACHINE_OBSERVATORY_V6.zip`. It preserves the DIT codebase and adds three separate transparent character cutouts above metallic podium geometry, a narrow left treasury rail, compact recorded transmissions, and a local Ollama / OpenAI-compatible / JARVIS research companion.

**Run on Windows:** extract, enter `dit-site`, double-click `START-DIT-WINDOWS.cmd`, then open `http://127.0.0.1:4173` and `http://127.0.0.1:4173/operator`. The operator can discover installed local models and save assignments, manually run/cancel research and show recorded results. Until providers connect, actual AI generation remains unavailable. See [Observatory V6](docs/OBSERVATORY_V6.md).

The site has no automatic token deployment or guaranteed creator-fee transfers. To sync local research with a hosted website, configure shared Supabase and apply all migrations through `0004_agent_research_runs.sql`. **Changes in this ZIP were not pushed or published to the existing hosted Site.**

---

> **V5 Machine Presence:** See [docs/MACHINE_PRESENCE_V5.md](docs/MACHINE_PRESENCE_V5.md) for the centered podium stage, monochrome UI, ambient sound, local Ollama/JARVIS model discovery, and verified limitations.

# V3 / MACHINE CONTROL — LATEST UI

**Start here:** [README-COMMAND-CENTER.md](README-COMMAND-CENTER.md) and
[Grand Line → DIT implementation mapping](docs/GRANDLINE_TO_DIT.md).

The new screen is a compact 3-agent control room with one stage, embedded voting,
fee accounting beside the agents, contextual transmissions and Network/System
drawers. Its background uses the original dimmed dystopian city image site-wide.
The previous frontend (`dist/app.js`, `dist/agents-live.js`, `dist/realtime.js`) is
kept for reference but **is not loaded** by the new `dist/index.html`.

Run `START-DIT-WINDOWS.cmd` or `npm run dev` from the `proj` directory.
Run `npm test` and `npm run build` for validation.

---

# DEAD INTERNET THEORY — Recovered functional prototype

A continuation of the original cyberpunk website. Preserves the supplied artwork, static design, and verified Pump.fun transaction inspector. Restores and completes the unfinished code from the Claude transcripts, adds a persistent local backend, 3 distinct research agents, public agent dossiers, test voting, research events, and 25% creator-fee accounting.

**This ZIP is an executable research prototype, NOT a launched coin or a production trading system.** Market sources and LLM calls work only when configured and reachable. No agent is authorized to deploy tokens, buy/sell, or move funds. The Circuit adapter is a documented local *contract*, not a verified plug-and-play Circuit webhook integration. Transfer routing requires independent validation of real provider requirements and on-chain transactions.

## Start on Windows (zero npm dependencies for local mode)

1. Install Node.js 22 or later and extract the ZIP.
2. Double-click `START-DIT-WINDOWS.cmd` (or in PowerShell, run `node server/local.mjs` from the project directory). No `Set-ExecutionPolicy` needed.
3. Open **http://localhost:4173**.
4. Explore the original three agents at **Meet Your Replacements**. The new **Choose Your Replacement** section displays their persistent states, vote totals, research events, and 25% treasury target.
5. Local-only test voting: type an email you control, click **Use Local Test Identity**, then vote. Local test identity is **not real verification** and must never be used on a public site.

`npm test` runs the automated tests. `npm run build` creates the Worker hosting artifact at `build/server/index.js`. `npm run worker` is for production-style background worker mode, which requires a database or explicitly configured file mode.

## What works / what remains

| Component | Status |
|---|---|
| Existing static cyberpunk design, hero art and 3 agent portraits | Preserved |
| Original read-only Pump transaction verification and discovery | Preserved, requires working Solana RPC for live results |
| New persistent agent profiles, states, observations and memories | Implemented; local file persistence or Supabase adapter |
| Three differentiated research pipelines and provider adapters | Implemented; live provider calls not validated in this package |
| Automated research scheduler with retries, rate limits and per-agent budgets | Implemented; runs server-side, subject to external API limits |
| AI-generated original concept proposals | Implemented; requires supported Anthropic API key/model and successful provider calls |
| Votes | Tested with local development identity; real public voting requires Supabase Auth and SQL migrations |
| Agent animation | **Three.js control-room stage** (`dist/stage.js`): depth-parallax portraits, breathing, cursor head-tracking, state-driven lighting/glitch/particles, click-to-zoom into the live dossier, lazy-loaded, reduced-motion aware. Portraits are 2D art, **not rigged 3D**. The cinematic production pass keeps them above real PBR podium geometry; see `docs/CINEMATIC_PRODUCTION.md` for browser verification and measured limitations. |
| Realtime updates | Supabase Realtime (`dist/realtime.js`) in production, SSE `/api/stream` in local mode, 15s polling fallback. Supabase path unverified against a live project. |
| Evidence pages | `#evidence/<mint>` (`dist/evidence.js`): agent, proposal lifecycle history, linked source observations, on-chain verification links |
| 25% of confirmed creator fees | Integer accounting and displayed calculation, **no automatic money movement** |
| Circuit webhook | Project-defined HMAC contract; **not confirmed to match real Circuit** |
| Automatic Pump.fun launch of another token | Disabled / not implemented |
| Real DIT coin minted | No; none created by this package |

## Production-oriented setup (requires your external accounts)

1. Create a Supabase project. Apply `supabase/migrations/0001_core.sql`, then `0002_rls_functions.sql` in the SQL editor. **These migrations are supplied but have not been executed against a real Supabase project in this environment.** Review security policies before public deployment.
2. Set **server-only** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and public-auth `SUPABASE_ANON_KEY`. Do not expose the service role key or LLM key in browser assets. Turn off `DIT_DEV_AUTH` in production.
3. Run the persistent process `npm run worker` in an environment with outbound internet access and the server secrets. Worker tasks run independently of visitors. It uses the 3 seeded agents and stores observations/memories/jobs in Supabase.
4. Optionally configure `ANTHROPIC_API_KEY` and `LLM_MODEL` to enable new concept proposals. Without this key the system **observes and remembers only**; it does not fabricate generated ideas.
5. Configure a real RPC endpoint as `SOLANA_RPC_URL` for verified on-chain data.
6. Build the static+read-only/secured-API Worker artifact using `npm run build`. Deploy the `build/` artifact to a compatible host supporting the supplied Worker format. The background scheduler must run separately.
7. Before any Circuit integration, verify the actual webhook authentication and payload format with Circuit; configure an authorized adapter as needed. No transfer should be labeled verified until its actual destination/amount is reconciled on chain.
8. 25% allocation target is **2,500 basis points of verified fees received**, not a percentage of all market trading volume. It is only accounting, not a promise of cash-flow or future launches.

## Circuit and the 25% allocation: research findings

Public documentation for a Circuit product matching the webhook/creator-fee-trigger/vault-transfer behavior in the brief **could not be found**, so the Circuit adapter stays a clearly-labeled project contract and nothing is claimed as integrated.
What *is* publicly documented is Pump.fun's native **Creator Fee Sharing** (`pump_fees` program, `sharing-config` PDA, shareholders with basis-point shares, permissionless distribution; see `github.com/pump-fun/pump-public-docs`). A 25% / 75% shareholder split configured on-chain at launch is a verifiable alternative to off-chain transfers between vaults, and `backend/launch.mjs` is the place a human-approved launch would configure it. Evaluate that path (and confirm the current SDK instruction shapes) before building any transfer mechanism. Until then `TREASURY_TRANSFER_MECHANISM=none` and the 25% remains an accounting target.

## 3D models

All nine original GLB files are retained under `../dit-assets/models/`, along with their generator and concept references. The production stage deliberately uses higher-detail 2.5D portraits. Integrating future rigged models requires a reviewed stage change; copying a GLB into the static directory no longer silently replaces the artwork.

## Main directories

- `dist/` — original design and new `agents-live.js` with voting/dossiers/telemetry overlay.
- `server/api.js` — original verified Solana chain reads and the new typed backend routing.
- `server/lib/` — profiles, voting, auth, PostgreSQL / local storage, Circuit intake and accounting.
- `server/local.mjs` — self-contained Node server with persistent file store and worker.
- `worker/` — research providers, classifier, LLM adapter, per-agent memory, scheduler, cycle pipeline.
- `supabase/migrations/` — RLS-protected schema and atomic database functions.
- `backend/launch.mjs` — preexisting **separate privileged** Pump SDK script; not called by this project or public API.
- `tests/` — original verifier/discovery plus voting, treasury, memory and worker tests.

## Security / correctness boundaries

- Never put any private key or service-role secret into a browser, repo, or public webhook.
- The **dev identity** accepts arbitrary emails and is only suitable for local UI tests; real identity requires Supabase Auth confirmation.
- The research feeds collect public observations. A high trend score is **not** investment advice or price prediction.
- Circuit's fee transfer mechanism and payload signature scheme **are not verified**. It is impossible to truthfully claim a coin/vault integration is live without official provider connection and test receipts.
- Original agent artwork is 2D. We enhanced visual depth and movement, but authentic 3D facial rigging needs GLB/GLTF models.
- No automatic speculative token launches, purchases, trading, custody, or payments are enabled.

See `docs/INTEGRATION.md` for the original legacy launch verifier setup and `docs/IMPLEMENTATION_STATUS.md` for a precise change log.

**Font assets:** Anton and IBM Plex Mono Latin WOFF2 files are bundled in `dist/assets/fonts/`, together with their open-source licenses. System fallbacks remain available. No Google Fonts request is required.

## V4 Machine Presence (October 2026)

See `docs/MACHINE_PRESENCE_V4.md` for the full design/worker delta. V4 centers all three
agents directly on the city scene, moves the 25% treasury and recent transmissions into a
low-profile ribbon, adds opt-in futuristic sound cues and hover responses, and repairs the
scheduler duplicate-key bug. **Apply migration 0003** to existing Supabase installations.
This remains research-only; verify integration health and visual rendering locally before deploying.
