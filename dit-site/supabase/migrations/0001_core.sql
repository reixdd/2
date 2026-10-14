-- DEAD INTERNET THEORY — core schema. Target: Supabase (Postgres 15+, auth schema present).
-- Money is ALWAYS integer lamports (bigint). LLM cost is integer micro-USD in a separate unit column.
create extension if not exists pgcrypto;

create table public.agents (
  id text primary key check (id in ('GHOST_001','NULL_ENTITY','ECHO.exe')),
  title text not null,
  tagline text not null,
  specialty text not null,
  state text not null default 'IDLE' check (state in ('OBSERVING','THINKING','CREATING','IDLE')),
  current_stage text check (current_stage in ('OBSERVE','CLASSIFY','RESEARCH','REMEMBER','GENERATE','EVALUATE','ARCHIVE')),
  state_since timestamptz not null default now(),
  last_active_at timestamptz,
  is_active boolean not null default true
);

create table public.agent_profiles (
  agent_id text primary key references public.agents(id) on delete cascade,
  personality text not null,
  voice_line text not null,
  memory_focus text not null,
  portrait smallint not null check (portrait between 0 and 2),
  prompt_version text not null,
  prompt_sha256 text not null,           -- the prompt itself lives in source control, never in the browser payload
  config jsonb not null default '{}'::jsonb
);

create table public.agent_votes (
  user_id uuid primary key references auth.users(id) on delete cascade,   -- one CURRENT vote per person
  agent_id text not null references public.agents(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  change_count integer not null default 0 check (change_count >= 0)
);
create index agent_votes_agent_idx on public.agent_votes(agent_id);

create table public.agent_vote_counts (   -- denormalised totals, only ever written inside cast_vote()
  agent_id text primary key references public.agents(id) on delete cascade,
  votes bigint not null default 0 check (votes >= 0),
  updated_at timestamptz not null default now()
);

create table public.vote_changes (        -- abuse-control ledger (switch cooldown)
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  from_agent text references public.agents(id),
  to_agent text not null references public.agents(id),
  created_at timestamptz not null default now()
);
create index vote_changes_user_time_idx on public.vote_changes(user_id, created_at desc);

create table public.research_sources (
  id text primary key,
  kind text not null check (kind in ('social','culture','market','chain','internal')),
  base_url text,
  docs_url text,
  enabled boolean not null default true,
  rate_limit_per_min integer not null default 20 check (rate_limit_per_min > 0),
  requires_credentials boolean not null default false,
  verified_live boolean not null default false,   -- flipped only by a worker that actually got a valid response
  last_success_at timestamptz,
  last_error text,
  last_error_at timestamptz
);

create table public.trend_clusters (
  id uuid primary key default gen_random_uuid(),
  agent_id text not null references public.agents(id) on delete cascade,
  key text not null,
  label text not null,
  category text not null,
  score numeric not null default 0,
  observation_count integer not null default 0,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (agent_id, key)
);

create table public.observations (
  id uuid primary key default gen_random_uuid(),
  agent_id text not null references public.agents(id) on delete cascade,
  source_id text not null references public.research_sources(id),
  external_id text not null,
  title text not null,
  url text,                                       -- source link
  observed_at timestamptz not null default now(),
  category text not null default 'general',
  classifier text not null default 'rules',      -- 'rules' | 'llm' : which classifier produced the category
  confidence numeric check (confidence between 0 and 1),
  metrics jsonb not null default '{}'::jsonb,     -- raw numbers as returned by the provider
  evidence jsonb not null default '{}'::jsonb,
  cluster_id uuid references public.trend_clusters(id) on delete set null,
  job_id uuid,
  created_at timestamptz not null default now(),
  unique (agent_id, source_id, external_id)
);
create index observations_agent_time_idx on public.observations(agent_id, observed_at desc);
create index observations_cluster_idx on public.observations(cluster_id);

create table public.agent_jobs (
  id uuid primary key default gen_random_uuid(),
  agent_id text references public.agents(id) on delete cascade,
  kind text not null check (kind in ('cycle','outcome_check','reconcile')),
  status text not null default 'queued' check (status in ('queued','running','succeeded','failed','dead')),
  stage text,
  dedupe_key text not null,
  payload jsonb not null default '{}'::jsonb,
  attempts integer not null default 0,
  max_attempts integer not null default 3,
  run_after timestamptz not null default now(),
  timeout_ms integer not null default 120000,
  locked_by text,
  locked_until timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  error text,
  result jsonb,
  tokens_in integer not null default 0,
  tokens_out integer not null default 0,
  cost_usd_micros bigint not null default 0,
  created_at timestamptz not null default now()
);
-- At most one ACTIVE job per dedupe key (deduplication across restarts and multiple workers).
create unique index agent_jobs_active_dedupe_idx on public.agent_jobs(dedupe_key) where status in ('queued','running');
create unique index agent_jobs_success_dedupe_idx on public.agent_jobs(dedupe_key) where status = 'succeeded';
create index agent_jobs_claim_idx on public.agent_jobs(run_after) where status in ('queued','running');
create index agent_jobs_agent_idx on public.agent_jobs(agent_id, created_at desc);

create table public.agent_memories (
  id uuid primary key default gen_random_uuid(),
  agent_id text not null references public.agents(id) on delete cascade,
  kind text not null check (kind in ('episodic','semantic','lesson','outcome')),
  content text not null,
  summary text not null,
  tags text[] not null default '{}',
  importance numeric not null default 0.5 check (importance between 0 and 1),
  source_refs jsonb not null default '[]'::jsonb,
  job_id uuid references public.agent_jobs(id) on delete set null,
  recall_count integer not null default 0,
  last_recalled_at timestamptz,
  created_at timestamptz not null default now()
);
create index agent_memories_agent_idx on public.agent_memories(agent_id, created_at desc);
create index agent_memories_tags_idx on public.agent_memories using gin(tags);

create table public.token_proposals (
  id uuid primary key default gen_random_uuid(),
  agent_id text not null references public.agents(id) on delete cascade,
  status text not null default 'RESEARCHING'
    check (status in ('RESEARCHING','DRAFT','EVALUATED','PROPOSED','APPROVED','SIMULATED','VERIFIED','REJECTED')),
  name text,
  ticker text,
  narrative text,
  aesthetic_direction text,          -- text direction only; no image is generated at this stage
  transmission text,                 -- short fictional transmission
  rationale text,
  reasoning_summary text,
  cluster_id uuid references public.trend_clusters(id) on delete set null,
  evidence_ids uuid[] not null default '{}',
  confidence numeric check (confidence between 0 and 1),
  score numeric,
  score_breakdown jsonb,
  originality jsonb,
  rejected_reason text,
  approved_by text,                  -- human operator identifier; never set by an agent
  approved_at timestamptz,
  simulation jsonb,                  -- output summary of backend/launch.mjs simulation (launch id, budget, debit)
  outcome jsonb,                     -- later observable outcome
  outcome_checked_at timestamptz,
  lesson text,
  job_id uuid references public.agent_jobs(id) on delete set null,
  dedupe_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index token_proposals_dedupe_idx on public.token_proposals(agent_id, dedupe_key) where dedupe_key is not null and status <> 'REJECTED';
create index token_proposals_status_idx on public.token_proposals(status, created_at desc);

create table public.verified_tokens (
  mint text primary key,
  proposal_id uuid references public.token_proposals(id),
  agent_id text not null references public.agents(id),
  name text not null,
  ticker text not null,
  creator_wallet text not null,
  payer text not null,
  signature text not null unique,
  slot bigint not null,
  block_time timestamptz,
  metadata_uri text,
  narrative text,
  finality text not null default 'finalized' check (finality = 'finalized'),
  verified_at timestamptz not null default now()
);

create table public.circuit_events (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'circuit',
  external_id text not null,
  event_type text not null,
  payload jsonb not null,
  signature_valid boolean not null,
  status text not null default 'received' check (status in ('received','processed','rejected','failed')),
  error text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (source, external_id)
);

create table public.fee_receipts (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('circuit','pump_distribution','manual')),
  external_id text not null,
  mint text,
  wallet text not null,                           -- wallet that received the creator fees
  tx_signature text,
  claimed_lamports bigint not null check (claimed_lamports >= 0),    -- what the integration CLAIMED
  confirmed_lamports bigint check (confirmed_lamports >= 0),         -- what the chain showed
  status text not null default 'observed' check (status in ('observed','confirmed','mismatch','failed')),
  simulated boolean not null default false,
  circuit_event_id uuid references public.circuit_events(id),
  observed_at timestamptz not null default now(),
  confirmed_at timestamptz,
  note text,
  unique (source, external_id)
);
-- The same on-chain receipt can never be counted twice via two different integrations.
create unique index fee_receipts_tx_wallet_idx on public.fee_receipts(tx_signature, wallet) where tx_signature is not null;

create table public.treasury_allocations (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null unique references public.fee_receipts(id),
  basis_bps integer not null check (basis_bps between 0 and 10000),
  treasury_lamports bigint not null check (treasury_lamports >= 0),
  remainder_lamports bigint not null check (remainder_lamports >= 0),
  treasury_destination text,
  remainder_destination text,
  status text not null default 'calculated' check (status in ('calculated','pending','transferred','simulated','unsupported')),
  mechanism text,                                 -- how a transfer would/did happen (e.g. 'pump_fee_sharing_config'), null if none documented/available
  transferred_lamports bigint not null default 0 check (transferred_lamports >= 0),
  transfer_signature text unique,
  simulated boolean not null default false,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.treasury_ledger (            -- append-only
  id bigint generated always as identity primary key,
  idempotency_key text not null unique,
  entry_type text not null check (entry_type in ('fee_observed','fee_confirmed','allocation_calculated','transfer_confirmed','funding_recorded','expense_recorded')),
  bucket text not null check (bucket in ('treasury','remainder','operating')),
  unit text not null default 'lamports' check (unit in ('lamports','usd_micros')),
  amount bigint not null,
  simulated boolean not null default false,
  receipt_id uuid references public.fee_receipts(id),
  allocation_id uuid references public.treasury_allocations(id),
  job_id uuid references public.agent_jobs(id),
  memo text,
  created_at timestamptz not null default now()
);
create index treasury_ledger_bucket_idx on public.treasury_ledger(bucket, entry_type);

create table public.activity_events (
  id bigint generated always as identity primary key,
  agent_id text references public.agents(id) on delete set null,
  event_type text not null,
  severity text not null default 'info' check (severity in ('info','warn','error')),
  title text not null,
  detail text,
  payload jsonb not null default '{}'::jsonb,
  job_id uuid references public.agent_jobs(id) on delete set null,
  created_at timestamptz not null default now()
);
create index activity_events_time_idx on public.activity_events(created_at desc);
create index activity_events_agent_idx on public.activity_events(agent_id, created_at desc);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor text not null,
  action text not null,
  subject_type text,
  subject_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_time_idx on public.audit_logs(created_at desc);

create table public.worker_heartbeats (
  worker_id text primary key,
  started_at timestamptz not null,
  last_seen_at timestamptz not null,
  version text,
  info jsonb not null default '{}'::jsonb
);
