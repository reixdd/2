-- Publicly readable only through the audited server API. Local JARVIS writes
-- a sanitized read-only market snapshot through a server-side service role.
-- Never put a service-role key or a localhost JARVIS URL in browser code.
create table if not exists public.dit_market_snapshots (
  id smallint primary key check (id=1),
  signals jsonb not null default '[]'::jsonb,
  source_states jsonb not null default '{}'::jsonb,
  observed_at timestamptz not null,
  updated_at timestamptz not null default now()
);
alter table public.dit_market_snapshots enable row level security;
revoke all on public.dit_market_snapshots from public, anon, authenticated;
grant select,insert,update on public.dit_market_snapshots to service_role;
comment on table public.dit_market_snapshots is 'Server-side, research-only cached Solana market observations. No trading or launch permissions.';
