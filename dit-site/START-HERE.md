# Run and upgrade Dead Internet Theory V7

## Start

1. Install Node.js 22 or newer.
2. Open the exported `dit-site` folder.
3. Windows: double-click `START-DIT-WINDOWS.cmd`.
4. macOS/Linux: run `npm run dev` in `dit-site`.
5. Open http://127.0.0.1:4173. The existing local operator is at http://127.0.0.1:4173/operator.

The local app has no required npm dependencies. The fonts, renderer and character artwork are bundled. API source requests, authentication and research providers still need their existing configured services; bundled graphics do not make Ollama/JARVIS or Supabase available.

For an existing installation, preserve `.env`, `.data/` and all private configuration before replacing source files. This archive intentionally excludes credentials and user data. It includes `.env.example` as documentation; do not replace your configured `.env` with it. On macOS/Linux, use `node --env-file=.env server/local.mjs` when loading an existing environment file. Windows already loads it through the original launcher.

## Verify

- `npm test`: existing application tests plus rendering-quality logic.
- `npm run build`: existing Worker bundle check. This does not deploy it.
- `npm ci` then `CHROMIUM_PATH=/path/to/chromium npm run test:browser`: actual Chromium journey against a temporary local API and isolated data store. On Windows set `CHROMIUM_PATH` using your shell before running the command. No browser is downloaded by the test. Output goes to `.qa/`.

The browser test uses local **test-only** identity for voting. Populated research fixtures exist only in test interception, never in application data. Model generation, live authenticated Supabase and finalized-chain verification require separately configured services.

## Included assets

`dit-site/dist/` contains the production frontend and original transparent character art. `dit-assets/` contains all nine prototype GLBs, their Python generator and the recovered concept references. They are preserved as authoring assets; the production scene combines the detailed 2.5D portraits with real 3D podiums. Reference filenames in the recovered directory do not consistently match the depicted character, so inspect the images rather than relying on filenames alone.

The top-level `verification/` folder in the release ZIP contains browser screenshots and measured results. Tests, server, workers, migrations, launcher and startup documentation are included. COLOSSEUM is not part of this scoped export and was not modified.

## Troubleshoot a hosted Site showing "ENTITY UNAVAILABLE"

The live error `backend_not_configured` (HTTP 503) means the running server did not receive both `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. Merely saving secrets in Site settings does not prove the currently published deployment receives them. Check the hosting project's environment bindings, apply/save, and **republish the exact existing Site**; do not create a second website or publish any keys in GitHub. Confirm `/api/config` reports `backend.configured: true` and `backend.kind: "supabase"`, then confirm `/api/health` works and `/api/agents` returns real records. Do not use a synthetic frontend database, static success fixture or browser-side service-role key as a workaround.

This version accepts either `SUPABASE_ANON_KEY` or the already-hosted `NEXT_PUBLIC_SUPABASE_ANON_KEY` for public client authentication; the service-role key remains **server-only**. If a new deployment still shows `configured: false`, the issue is Site secret binding/deployment, not a missing UI animation. Database migrations and a separately running research worker are required for live research; never interpret an offline worker as a connected AI.
