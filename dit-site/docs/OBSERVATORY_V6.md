# DEAD INTERNET THEORY // Observatory V6

## What changed

- Uses the existing cinematic city backdrop with slow **decorative** drift; a mostly black-and-white terminal UI with distinct blue (GHOST), purple (NULL), and green (ECHO) identification.
- Three transparent head-and-shoulders **cutouts** from the existing `agents.webp` render in one shared WebGL scene, centered above sculpted reflective silver podiums. They are parallax artwork, **not rigged 3D avatars**; optional `.glb` assets remain supported.
- Names, identities, voting, and states are aligned directly below their own subjects. The narrow creator-fee rail remains on the left. Recorded transmissions are displayed below the stage; detailed views use the existing drawers.
- UI effects use quiet synthesized relay noise and low resonant pulses instead of ascending musical bleeps. FX and ambience remain opt-in.
- Local operator companion: `http://127.0.0.1:4173/operator` is bound to loopback only. Host/Origin checks prevent remote writes. The public Worker bundle excludes `operator.html/js/css` and all model-configuration code.
- Model bridge supports **Ollama**, **OpenAI-compatible localhost**, and **JARVIS**. It discovers available models and rejects a selected unavailable model. JARVIS `/api/chat` runs use real streaming NDJSON and the confirmed `message` / `identity_key` / `mode` request structure.
- A research result is stored with its originating agent, prompt, provider, model (if reported), timestamps, run status, and answer. It appears in `/api/results` and each agent dossier, separated from launch proposals. No fake results are inserted.
- Model configuration is written only to `.data/operator-settings.json` and can be changed without restarting the local companion. The scheduled concept generator uses the saved local Ollama/OpenAI-compatible models. JARVIS research answers do **not** automatically become coin proposals.

## Local setup

1. Install Node.js 22 or newer and extract the ZIP.
2. Run `START-DIT-WINDOWS.cmd` in the `proj` directory. Open the home page at `http://127.0.0.1:4173`.
3. Open **`http://127.0.0.1:4173/operator`** separately. Select your provider and URL:
   - Ollama `http://127.0.0.1:11434`, started separately and containing installed models.
   - OpenAI-compatible local service, typically `http://127.0.0.1:1234` (or another loopback port). `/v1` is normalized automatically.
   - JARVIS `http://127.0.0.1:8768` by default. Its `/api/models` reports locally discovered models and `/api/chat` streams research responses.
4. Test/discover models. Assign installed models to the three agents (JARVIS controls its own specialist selection). Save settings. Enter a bounded research brief and choose the agent to run.
5. Open the agent's dossier or `/api/results` to inspect recorded research. Cancelling a manual run does not kill scheduled research jobs or wipe its memory.
6. To enable actual concept generation, use Ollama/OpenAI-compatible mode and ensure the model responds with the required JSON. Merely connecting JARVIS to the research bridge does not activate the concept generator.

## Shared host activation

The hosted Website **cannot access the owner's local Ollama/JARVIS endpoints**. A local companion can write to the same Supabase project used by the hosted read API. Apply `supabase/migrations/0001_core.sql`, `0002_rls_functions.sql`, `0003_job_dedupe_repair.sql`, and **`0004_agent_research_runs.sql`** in order. Set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_ANON_KEY` on trusted infrastructure (the service role key is never public). Launch the local companion with the same Supabase URL/key in environment variables. Do not activate `DIT_DEV_AUTH=1` on public infrastructure.

The existing DIT on-chain verification and voting APIs are retained. The 25% fee share is still a recorded accounting target, not a promise that Circuit transfers funds or autonomously launches coins. There are no real DIT tokens, live transfer receipts, or background music/video files embedded in this ZIP.

## Tests and scope

`npm test`, `npm run build`. The local server may use the ignored `.data/dit-store.json`; this example state is **not included** in the delivered ZIP. User-supplied music can be placed at `dist/assets/dit-soundtrack.mp3` or `.mp4` / `.webm` and played with the explicit AMBIENCE control without displaying video.

Browser screenshot capture requires a browser environment allowed to access the local host; the test environment blocks Chromium navigation with `net::ERR_BLOCKED_BY_ADMINISTRATOR`. Check portrait edges/labels and audio visually on your machine.
