# DIT cultural-evidence worker (Supabase Free)

This is a **limited, real-data serverless worker**, not the full Node.js/Ollama research engine.
It runs in the existing Supabase project `dndlvvdzzucmdrrerahj` without a paid server.
It does not create tokens, sign transactions, submit trades, transfer funds, or generate text using an LLM.

## What it does
- Every two minutes, a protected scheduled invocation writes a genuine worker heartbeat.
- Around the beginning of every UTC hour, it fetches public evidence from enabled Wikipedia and Hacker News sources.
- New, deduplicated observations are saved with source attribution; corresponding memories are **verbatim evidence notes, not inferred conclusions**.
- `verified_live` changes only after a successful source fetch.
- Market and chain feeds, token launches, and financial operations are disabled. Reddit remains disabled until separately authorized.
- An LLM is **not** configured here. `/api/health` may show this specific worker alive; that does not mean JARVIS/Ollama is connected.

## Security and reproducibility
- The function is deployed as `dit-cultural-evidence` with gateway JWT verification disabled **only because it enforces its own server-generated secret** on every POST.
- Migration `0007` creates the restricted token table with row-level security and installs `pg_cron`/`pg_net`.
- Migration `0008` schedules the function. The secret is selected by Postgres at runtime and is never copied into source control.
- Public users cannot read `public.dit_worker_auth`. The function's server-side service-role key stays in the Supabase Edge runtime.
- For any other Supabase project, change the project URL in migration `0008` before applying it.
- Monitor the schedule in Supabase → Integrations → Cron; inspect functions under Edge Functions.
- To disable scheduled calls, execute `select cron.unschedule('dit-cultural-evidence-every-two-minutes');` as a database administrator.

## Production limitations
- This lightweight process does not run the original Node.js `worker/index.js` pipeline, doesn't claim model-generated proposals, and cannot connect to a private Windows Ollama process.
- An unconfigured or unsuccessful external source is reported as such, never replaced with fake results.
- Supabase Free projects may pause during inactivity or be subject to platform usage limits.
- The `pg_net` extension installed by migration `0007` is not relocatable in place. If Supabase flags it as an extension-in-public advisory, review the documented extension placement before making a disruptive reinstall.
- Email OTP voting requires Supabase Auth's actual site URL and redirect settings, plus user-driven end-to-end testing.

## Supabase-managed pg_net advisory

Supabase reports that `pg_net` is installed with its extension owner in the public schema. We attempted a least-privilege REVOKE through a follow-up migration, but verified that Supabase-managed `net` function privileges still remain on `anon` and `authenticated` because the schema is owned by `supabase_admin`, not the current Postgres migration role. Do not treat the advisory as resolved. Keep the `net` schema out of the PostgREST exposed-schemas setting, and have a Supabase administrator review managed extension permissions before broader production deployment. This does not grant browser users access to the worker's dedicated token table, which has independently verified SELECT denials.
