# V5 — Machine Presence / Monochrome Terminal

This is an incremental change to the supplied V4. Existing authentication, token verification, voting, SQL migrations, Circuit simulation, research schema and read-only launch evidence remain intact.

## Visual system

- The three existing illustrated agents are the only main characters. A single transparent Three.js stage has raised eight-sided podium meshes under them instead of circles.
- The labels have a narrower 67%-wide centered alignment so they sit under the artwork at common desktop resolutions. WebGL uses the original sprite strip, not fictitious rigged models. If you add actual `dist/assets/models/ghost_001.glb`, `null_entity.glb`, `echo_exe.glb`, real rigging will be loaded by the existing stage.
- The shared city image is desaturated, and the interface colors are close to pure black, gray and white. Original background and characters preserved. Hover highlights and model-state updates remain.
- The operating 25% calculation and transmissions are a floating bottom telemetry ribbon. The top bar now exposes Network, Transmissions and System Health. No independent archive section.

## DIT model router / JARVIS compatibility

JARVIS `reixdd/1` (`src/jarvis/ollama.py`, `src/jarvis/agent_team.py`) discovers local Ollama models with `/api/tags` and chooses a fast/deep pair. DIT V5 independently uses that same **Ollama API protocol**; it does not require the JARVIS Python application or share its memory database.

- Run Ollama on the same computer (default `http://127.0.0.1:11434`), with some chat-capable models already installed.
- `worker/llm.js` probes available models on startup, rejects embedding models, and chooses a fast model (first >= 3B) and deepest model. NULL_ENTITY defaults to deep; GHOST_001 and ECHO.exe default to fast. Override with `DIT_MODEL_GHOST`, `DIT_MODEL_NULL`, `DIT_MODEL_ECHO` if desired; overrides must match installed model names.
- Copy `.env.example` to `.env` to customize settings. The Windows launcher loads `.env` if present (Node 22+). `DIT_LLM_PROVIDER=auto` will use Ollama, then optional Anthropic fallback if credentials exist. Use `DIT_LLM_PROVIDER=off` to disable generation.
- An Ollama server bound to localhost is independent of the website. For a deployed site, a controlled private backend has to reach it; browser JavaScript never receives the URL or model secrets. Public edge Worker builds do not run the model router.
- `/api/health` -> `worker.workers[].info` exposes only selected model name/provider, not URL or credentials. The UI reports RESEARCH ONLY when no LLM is available.

**Important:** Concept generation depends on model availability, supported responses and provider uptime. No synthetic concepts are inserted to hide missing inference.

## Soundtrack and interaction audio

The toggle/gesture model is adapted from Grand Line's music controls, not its soundtrack. Toggle **FX** for short sci-fi beeps and **AMBIENCE** for background audio. Both default OFF and require a user click.

The supplied DIT and Grand Line ZIPs did **not** contain the linked YouTube music video's file. V5 does not scrape or secretly embed a YouTube player. To use a soundtrack that you have permission to use, add ONE of:

- `dist/assets/dit-soundtrack.mp3`
- `dist/assets/dit-soundtrack.mp4`
- `dist/assets/dit-soundtrack.webm`

The audio engine will detect it when you click AMBIENCE. The local video element is visually hidden and only its sound plays; if no file exists, an original synthesised low-volume electronic ambient drone plays instead. Modern browser autoplay rules require a user gesture. The media asset is never sent with this archive because it wasn't supplied. The linked YouTube video cannot be treated as a downloadable owned asset automatically.

## Corrections / safeguards

- DEX Screener image-header URLs are not treated as user-facing titles. Old saved observation URLs remain in the audit record, but the interface labels them `VIEW SOURCE` rather than rendering an unreadable CDN URL.
- 25% is an **accounting target**, not a verified transfer, and this update does not add automated mainnet signing or financial transactions.
- DIT retains its original REST API contracts, persistent research worker, voting and evidence routes; no website rebuild or Next.js migration.

## Testing

`npm test` tests UI structure, original API, model routing and scheduler integrity. `npm run build` builds the worker bundle. Visual quality of WebGL podiums, audio and local model API must be tested on your own Windows computer; no live Ollama model was accessible in this environment.
