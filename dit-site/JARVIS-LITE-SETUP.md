# Dead Internet Theory + existing JARVIS: 3-agent concurrent research

These are TWO existing projects, not duplicate services:
- **JARVIS Core:** https://github.com/reixdd/1 (local root usually `C:\Users\reina\JARVIS`).
- **DIT:** https://github.com/reixdd/2 on branch **dit-3d-assets**, inside `dit-site`.
- Supabase project **dndlvvdzzucmdrrerahj** already has public source research from its independent Edge Function. Do not remove it.

## Updating an existing Windows installation without re-extracting ZIPs

A source-only refresh utility is included as `UPDATE-DIT-LOCAL.ps1`. From your existing `dit-site` folder, stop JARVIS and DIT, then run:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File ".\UPDATE-DIT-LOCAL.ps1"
```

It stages and checks all GitHub downloads before copying them, backs up the old copies under `dit-site/.data/source-backups/`, and changes only a fixed manifest of JARVIS and DIT **source files**. It never touches `.env`, `.venv`, `data`, `history`, or installed Ollama weights. If the updater is not in the older extracted directory, download just `dit-site/UPDATE-DIT-LOCAL.ps1` from branch `dit-3d-assets` into that existing folder first. Then run `START-DIT-WITH-JARVIS.cmd`.

The GitHub source already contains the original uploaded `vbs8nw7.html` artwork and the live-research adapter; no new artwork or separate project is required.

## Start the recovered Astra integration on Windows (October 14, 2026)

1. Download **reixdd/2 → dit-3d-assets → Code → Download ZIP** and extract a **new** `dit-site` folder. Copy only your existing private `.env` into the new folder. Do not upload or commit that file.
2. Stop old JARVIS (port 8768) and old DIT (port 4173) terminals with Ctrl+C. Leave the already installed Ollama service running.
3. In the new `dit-site` folder run **UPDATE-JARVIS-DIT.cmd** once. This backs up exactly the two updated JARVIS Python modules, restores missing workbench files if necessary, and runs a Python syntax check. It does not overwrite JARVIS data, history, GMGN settings or models.
4. Run **START-DIT-WITH-JARVIS.cmd**. Its health gate requires JARVIS `dit_stream_protocol: 2` and current model-routing support.
5. Open `http://127.0.0.1:4173/operator` for private **AUTONOMOUS ENTITIES**, saved schedules, model selection, and human-reviewed fictional concepts. Automatic cycles require NO manual Run button.
6. Open `http://127.0.0.1:4173/` for the user's **original MIAMI SIGNAL HTML** (full artwork, hotspots, audio) with real researcher presence, evidence, research transmissions and approved fictional concept archive below. If local JARVIS is unavailable, it shows **offline**, not simulated online status.

**Publication is separate:** Updating this GitHub branch does not deploy to the already published `*.chatgpt.site` URL. In ChatGPT Sites open the existing Site in edit mode, sync/redeploy its source from this branch, review the new preview, and click Publish. Keep the original hosting secrets server-side. Do not create an unrelated Site or Supabase project.

Agent responses are persisted to `agent_research_runs`. Supported source URLs are matched against recorded `observations`, with one independent episodic memory per completed run. Valid structured JSON concepts with recorded evidence become private `fictional_concepts` in **review**; a human may edit and approve a *fictional concept page* through the loopback Command Center. No automated mainnet token launch, wallet action, trading or paid API use is enabled.

## What runs concurrently
- **GHOST_001**: `qwen3.5:4b`, histories and internet lore.
- **NULL_ENTITY**: `qwen3.5:9b`, emerging culture/technology evidence and counter-evidence.
- **ECHO.exe**: `qwen3.5:4b`, humor, social narratives and creative drafts.
- They are **three independent active schedules** with separate prompts, Supabase `agent_research_runs`, source links and activity history. The Ollama model weights of 4B are shared across GHOST and ECHO, so there are only TWO distinct text models to keep loaded, not three copies of the same weights.
- The local scheduler uses the existing JARVIS API's `mode: lite`, now enhanced with a verified installed-model override and a **three-request admission semaphore**. Standard JARVIS fast/deep mode and its existing canonical research pipeline remain separate.
- The three independent loops schedule a new research brief about every **20 minutes per agent**, or wait when the model is busy. They are alive between cycles, not consuming GPU continuously while idle. Genuine source evidence is added when available. Concepts are explicitly fictional/simulation drafts, not on-chain assets.
- Outcomes are stored in the existing Supabase project and visible through the hosted DIT research-results API after public Site deployment; local work does not implicitly publish a new Site build.
- The manual "Question / Research Brief" field is an OPTIONAL override. It is no longer needed for autonomous research.

## Resource and safety controls

The launcher opts in to:
```text
DIT_JARVIS_SHARED=1
DIT_JARVIS_PARALLEL=3
DIT_AUTONOMOUS=1
DIT_AUTONOMOUS_INTERVAL_MINUTES=20
DIT_MIN_FREE_RAM_GB=6
DIT_MAX_LOADED_VRAM_GB=13
DIT_MODEL_GHOST=qwen3.5:4b
DIT_MODEL_NULL=qwen3.5:9b
DIT_MODEL_ECHO=qwen3.5:4b
DIT_START_SCHEDULER=0
DIT_LLM_PROVIDER=off
```

The scheduler samples available system memory, CPU usage and Ollama `/api/ps` loaded-model GPU-memory figures. It defers NEW research when free RAM falls below 6 GB, CPU busy exceeds ~94%, or reported loaded-model VRAM exceeds 13 GB. Existing model runs aren't abruptly killed and there is no GPU **temperature** sensor integration; **this is backpressure, not a thermal safety guarantee**. Ollama's own loaded-model policies and OS/GPU protection still apply.

If you want a stronger service-level ceiling after measuring workload, configure the existing Ollama SERVER environment for its next restart: `OLLAMA_MAX_LOADED_MODELS=2`, `OLLAMA_NUM_PARALLEL=3`, `OLLAMA_CONTEXT_LENGTH=4096`, `OLLAMA_KEEP_ALIVE=2m`. Setting these in a separate Node or PowerShell client after Ollama is running DOES NOT change an existing Ollama daemon. On systems that struggle, set `OLLAMA_NUM_PARALLEL=2`; the third agent remains active but its model inference waits.

No 14B/27B background inference is requested. Normal JARVIS sessions can still use heavier models manually. On-demand JARVIS specialists currently use the discovered default fast model.

## Installation / launching

1. Sync the **updated source** from BOTH repositories onto the EXISTING local installations, carefully retaining local uncommitted code, `data/`, `history/`, `.venv/`, `dit-site/.env`, and Ollama's installed model library. Do not overwrite secrets or recreate Supabase. If JARVIS is installed as a Python package in the venv, confirm its installed package points to the updated `src/jarvis` source.
2. In your local DIT `dit-site/.env`, keep the exact existing `SUPABASE_URL=https://dndlvvdzzucmdrrerahj.supabase.co` and the corresponding PRIVATE `SUPABASE_SERVICE_ROLE_KEY`. Never commit or share the key.
3. Keep Ollama running normally. On Windows, double-click **START-DIT-WITH-JARVIS.cmd** in DIT's `dit-site` directory. The launcher REUSES a healthy JARVIS on `127.0.0.1:8768`, or starts the existing installed runtime only if absent. It refuses to start duplicates. If the installed local JARVIS API lacks the new `model` field, it STOPS with instructions rather than silently using an old copy.
4. Open `http://127.0.0.1:4173/operator`. The "AUTONOMOUS ENTITIES" area must show three schedules. `/operator/api/autonomous` shows all three agent states, next due times, active requests, and any resource-pressure pause.
5. Confirm each agent produces a completed result and that the same results appear on the **existing** public DIT site. Use `/api/health`, `/api/results`, `/api/agents`; don't assume a local browser display proves a hosted deployment.

The localhost JARVIS and DIT APIs bind only to `127.0.0.1`. NEVER expose a service-role key or a local model API to the open internet. The free Supabase serverless cultural feed continues when the PC is off, but **local Ollama-powered research cannot run when Windows/JARVIS/Ollama are off**. No extra paid service is needed.

No token deployment, on-chain transactions, wallet signing, trading, or fee transfers are enabled. The three identities can draft fictional concept names, short identifiers and social copy for human review without publishing financial products.

## Quick diagnosis
- `http://127.0.0.1:8768/health` → existing JARVIS Core, `ok: true`.
- `http://127.0.0.1:8768/api/models` → models installed/discovered and selected by JARVIS.
- `http://127.0.0.1:4173/operator/api/autonomous` → current schedules and resource guard.
- `http://127.0.0.1:4173/api/results` → finished/local research persisted to DIT.
- GitHub CI verifies source/test/build; only your PC can verify actual GPU usage and temperature under three-agent inference.
