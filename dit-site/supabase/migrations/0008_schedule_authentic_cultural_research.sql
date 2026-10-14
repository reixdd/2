-- Current DIT Supabase project: dndlvvdzzucmdrrerahj. For a different project,
-- change only the URL. The worker token is read at execution time, not embedded.
-- Heartbeat every 2m; source refresh hourly as implemented in the Edge Function.
select cron.schedule(
  'dit-cultural-evidence-every-two-minutes',
  '*/2 * * * *',
  $job$
  select net.http_post(
    url := 'https://dndlvvdzzucmdrrerahj.supabase.co/functions/v1/dit-cultural-evidence',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-dit-worker-key', (select token from public.dit_worker_auth where id = 1)
    ),
    body := '{"force":false}'::jsonb,
    timeout_milliseconds := 10000
  );
  $job$
);
