# Dead Internet Theory + existing JARVIS: low-load local mode

The user's clean JARVIS source is in **reixdd/1** (local root usually C:\Users\reina\JARVIS), while the DIT website and operator live in **reixdd/2**, branch **dit-3d-assets**. They remain separate projects. Do not import or duplicate the JARVIS core or its market scanners.

## How this profile works
- The hosted Supabase cultural-evidence feed is already scheduled and remains independent of Windows.
- On Windows, double-click **START-DIT-WITH-JARVIS.cmd** in the current DIT \`dit-site\` folder.
- The launcher checks for an existing healthy JARVIS service on localhost:8768. If absent it starts **the already installed JARVIS executable** from \`%USERPROFILE%\JARVIS\.venv\Scripts\python.exe\` instead of downloading or starting another system. If another program owns port 8768, it stops instead of taking over.
- It checks that the installed JARVIS API supports \`mode: lite\`. Sync/reinstall the updated **reixdd/1** first if it says the API is outdated.
- DIT serves the loopback operator at \`http://127.0.0.1:4173/operator\`. It uses the real existing Supabase database, and its \`DIT_JARVIS_SHARED=1\` profile disables the extra DIT background scheduler, disables DIT's own LLM provider, pins the operator to JARVIS, and enforces **one operator research request at a time**.
- All three DIT identities share JARVIS's currently discovered **fast** Ollama model; JARVIS-lite restricts tool use to its existing SCOUT/SOCIAL specialists and caps work at four turns/50 seconds. Their persona briefs and evidence records stay separate.
- The operator's research output goes to \`agent_research_runs\` in Supabase. Site visitors cannot call the local operator API.
- Only genuine source observations (or clearly attributed AI-generated analysis) are published. The laptop never becomes a public API endpoint.

## Private local configuration (one-time)
Create/update \`dit-site\.env\` privately, with:
\`\`\`dotenv
SUPABASE_URL=https://dndlvvdzzucmdrrerahj.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_EXISTING_DIT_SERVICE_ROLE_KEY
\`\`\`
Use the key belonging to your **DIT project**, not Grand Line. Keep \`.env\` out of GitHub, uploads and screenshots. The launcher never prints the key. Don't paste any keys into a chat.
Only the loopback Node operator should have the service-role key, never the site browser. Public website still uses its own server-side hosting secrets.

## Keeping Ollama light
This profile DOES NOT load one model per character or create extra Ollama servers. On-demand requests share the model chosen by the JARVIS runtime's live model catalog. If Ollama is already running, changes to \`OLLAMA_NUM_PARALLEL\` or \`OLLAMA_MAX_LOADED_MODELS\` in a client process do **not** reconfigure that existing Ollama daemon. Configure those limits for the Ollama service on its next planned restart if still needed; don't kill active JARVIS processes blindly.

When this launcher starts JARVIS itself, it sets \`JARVIS_AGENTS_ENABLED=0\` in **that process only**, suppressing background agent packet execution but retaining intentional operator calls. If JARVIS was already running, its own background settings are left unchanged. The canonical JARVIS scanner, memory, data and paper research remain independent. The DIT-lite operator always runs on request, never unattended.

## Validation
1. Ensure the existing JARVIS local files contain \`mode: lite\` on POST /api/chat.
2. Open \`http://127.0.0.1:4173/operator\`. The provider must show JARVIS.
3. Use Discover, then make one short research request. It should appear as provider \`jarvis\` under the DIT hosted \`/api/results\` when the localhost \`.env\` points at the hosted database.
4. Your hosted /api/health should continue reporting the independent \`dit-edge-cultural-evidence\` worker. This is **not** proof that a local JARVIS model is running.

Research only. No token issuance, swaps, trading, private wallet keys, or automated fee transfers are supported. Local startup and integrated model latency still require verification on your actual PC.
