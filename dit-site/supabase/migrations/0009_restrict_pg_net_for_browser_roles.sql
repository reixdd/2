-- Secure Supabase pg_net networking without disrupting database-owned cron jobs.
-- Cron executes as postgres. Browser roles must never use network extension functions.
revoke all on schema net from public, anon, authenticated;
revoke execute on all functions in schema net from public, anon, authenticated;
