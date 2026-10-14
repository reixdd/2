-- Fix repeated cycle jobs producing duplicate key (dedupe_key) on completion.
-- Keep every historic job; rename older duplicate logical keys instead of deleting rows.
WITH ranked AS (
  SELECT id, dedupe_key, ROW_NUMBER() OVER (
    PARTITION BY dedupe_key ORDER BY
      CASE status WHEN 'succeeded' THEN 0 WHEN 'running' THEN 1 WHEN 'queued' THEN 2 ELSE 3 END,
      created_at, id
  ) AS occurrence
  FROM public.agent_jobs
)
UPDATE public.agent_jobs AS j
SET dedupe_key = j.dedupe_key || ':legacy:' || j.id::text
FROM ranked AS r
WHERE j.id = r.id AND r.occurrence > 1;

DROP INDEX IF EXISTS public.agent_jobs_active_dedupe_idx;
DROP INDEX IF EXISTS public.agent_jobs_success_dedupe_idx;
CREATE UNIQUE INDEX IF NOT EXISTS agent_jobs_all_status_dedupe_idx
  ON public.agent_jobs(dedupe_key);
