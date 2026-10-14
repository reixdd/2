-- Operator-initiated model research results. Server-side service role writes; no public direct writes.
create table if not exists public.agent_research_runs (
  id uuid primary key, agent_id text not null references public.agents(id),
  prompt text not null check (char_length(prompt) between 8 and 3500),
  provider text not null check (provider in ('ollama','openai-local','jarvis')),
  model text, status text not null check(status in('queued','running','completed','failed','cancelled')),
  started_at timestamptz not null default now(), finished_at timestamptz,
  answer text, error text, source_refs jsonb not null default '[]'::jsonb,
  requested_specialists text
);
create index if not exists agent_research_runs_recent on public.agent_research_runs(started_at desc);
create index if not exists agent_research_runs_agent_recent on public.agent_research_runs(agent_id,started_at desc);
alter table public.agent_research_runs enable row level security;
revoke all on public.agent_research_runs from anon, authenticated;
-- Public display reads from audited API only. Never expose credentials or private operator endpoints.
