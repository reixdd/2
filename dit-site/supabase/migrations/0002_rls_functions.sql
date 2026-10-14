-- RLS, transition guards, atomic functions, realtime. Service role bypasses RLS; browsers never get it.

-- ---------- append-only ledger ----------
create function public.forbid_mutation() returns trigger language plpgsql as $$
begin raise exception '% is append-only', tg_table_name using errcode = 'P0001'; end $$;
create trigger treasury_ledger_no_update before update or delete on public.treasury_ledger
  for each row execute function public.forbid_mutation();

-- ---------- proposal lifecycle guard ----------
-- RESEARCHING→DRAFT→EVALUATED→PROPOSED are agent-driven. APPROVED needs a human approver.
-- SIMULATED needs recorded simulation output. VERIFIED needs a verified_tokens row for this proposal.
create function public.guard_proposal_transition() returns trigger language plpgsql as $$
declare ok boolean;
begin
  new.updated_at := now();
  if new.status = old.status then return new; end if;
  ok := (old.status, new.status) in (
    ('RESEARCHING','DRAFT'),('DRAFT','EVALUATED'),('EVALUATED','PROPOSED'),('PROPOSED','APPROVED'),
    ('APPROVED','SIMULATED'),('SIMULATED','VERIFIED'),
    ('RESEARCHING','REJECTED'),('DRAFT','REJECTED'),('EVALUATED','REJECTED'),('PROPOSED','REJECTED'));
  if not ok then raise exception 'illegal proposal transition % -> %', old.status, new.status using errcode = 'P0001'; end if;
  if new.status = 'PROPOSED' and coalesce(array_length(new.evidence_ids,1),0) = 0 then
    raise exception 'a proposal needs recorded evidence before it can be PROPOSED' using errcode = 'P0001'; end if;
  if new.status = 'APPROVED' and (new.approved_by is null or new.approved_at is null) then
    raise exception 'APPROVED requires a human approver' using errcode = 'P0001'; end if;
  if new.status = 'SIMULATED' and new.simulation is null then
    raise exception 'SIMULATED requires launch simulation output' using errcode = 'P0001'; end if;
  if new.status = 'VERIFIED' and not exists (select 1 from public.verified_tokens v where v.proposal_id = new.id) then
    raise exception 'VERIFIED requires an on-chain verified token record' using errcode = 'P0001'; end if;
  insert into public.audit_logs(actor, action, subject_type, subject_id, details)
    values (coalesce(current_setting('request.jwt.claim.role', true), 'db'), 'proposal_transition', 'token_proposal', new.id::text,
            jsonb_build_object('from', old.status, 'to', new.status, 'approved_by', new.approved_by));
  return new;
end $$;
create trigger token_proposals_guard before update on public.token_proposals
  for each row execute function public.guard_proposal_transition();

-- ---------- atomic vote ----------
-- One current vote per user. Serialised per user with an advisory lock; switching moves one count atomically.
-- Callable ONLY by service_role (the API verifies the Supabase JWT and passes the user id).
create function public.cast_vote(p_user uuid, p_agent text, p_max_changes_per_hour integer default 5)
returns jsonb language plpgsql security definer set search_path = public as $$
declare cur record; recent integer; prev text;
begin
  if not exists (select 1 from public.agents where id = p_agent and is_active) then
    raise exception 'unknown agent' using errcode = 'P0002'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user::text, 0));
  select * into cur from public.agent_votes where user_id = p_user for update;
  if not found then
    insert into public.agent_votes(user_id, agent_id) values (p_user, p_agent);
    update public.agent_vote_counts set votes = votes + 1, updated_at = now() where agent_id = p_agent;
    insert into public.vote_changes(user_id, from_agent, to_agent) values (p_user, null, p_agent);
    return jsonb_build_object('agent_id', p_agent, 'previous_agent_id', null, 'changed', true);
  end if;
  if cur.agent_id = p_agent then
    return jsonb_build_object('agent_id', p_agent, 'previous_agent_id', p_agent, 'changed', false);
  end if;
  select count(*) into recent from public.vote_changes where user_id = p_user and created_at > now() - interval '1 hour';
  if recent >= p_max_changes_per_hour then
    raise exception 'vote change limit reached; try again later' using errcode = 'P0003'; end if;
  prev := cur.agent_id;
  update public.agent_votes set agent_id = p_agent, updated_at = now(), change_count = change_count + 1 where user_id = p_user;
  update public.agent_vote_counts set votes = votes - 1, updated_at = now() where agent_id = prev;
  update public.agent_vote_counts set votes = votes + 1, updated_at = now() where agent_id = p_agent;
  insert into public.vote_changes(user_id, from_agent, to_agent) values (p_user, prev, p_agent);
  return jsonb_build_object('agent_id', p_agent, 'previous_agent_id', prev, 'changed', true);
end $$;

-- ---------- job claiming (lease based; safe with several workers) ----------
create function public.claim_job(p_worker text, p_lease_seconds integer default 180)
returns setof public.agent_jobs language plpgsql security definer set search_path = public as $$
begin
  return query
  update public.agent_jobs j set status = 'running', locked_by = p_worker, locked_until = now() + make_interval(secs => p_lease_seconds),
         attempts = j.attempts + 1, started_at = coalesce(j.started_at, now())
  where j.id = (select id from public.agent_jobs
                where (status = 'queued' and run_after <= now()) or (status = 'running' and locked_until < now())
                order by run_after for update skip locked limit 1)
  returning j.*;
end $$;

-- ---------- fee accounting (integer lamports, idempotent) ----------
create function public.ingest_fee_receipt(p_source text, p_external_id text, p_mint text, p_wallet text, p_signature text,
  p_claimed bigint, p_simulated boolean default false, p_event_id uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r public.fee_receipts; created boolean := false;
begin
  insert into public.fee_receipts(source, external_id, mint, wallet, tx_signature, claimed_lamports, simulated, circuit_event_id)
  values (p_source, p_external_id, p_mint, p_wallet, p_signature, p_claimed, p_simulated, p_event_id)
  on conflict (source, external_id) do nothing returning * into r;
  if found then
    created := true;
    insert into public.treasury_ledger(idempotency_key, entry_type, bucket, amount, simulated, receipt_id, memo)
    values ('fee_observed:' || r.id, 'fee_observed', 'remainder', p_claimed, p_simulated, r.id, 'observed, not yet confirmed on chain');
  else
    select * into r from public.fee_receipts where source = p_source and external_id = p_external_id;
  end if;
  return jsonb_build_object('receipt_id', r.id, 'created', created, 'status', r.status);
end $$;

create function public.confirm_fee_receipt(p_receipt uuid, p_confirmed bigint, p_treasury_bps integer,
  p_treasury_dest text, p_remainder_dest text, p_mechanism text, p_transfer_supported boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r public.fee_receipts; t bigint; rem bigint; a public.treasury_allocations; st text;
begin
  select * into r from public.fee_receipts where id = p_receipt for update;
  if not found then raise exception 'unknown receipt' using errcode = 'P0002'; end if;
  select * into a from public.treasury_allocations where receipt_id = p_receipt;
  if found then return jsonb_build_object('receipt_id', p_receipt, 'allocation_id', a.id, 'created', false); end if;
  if p_confirmed < 0 or p_treasury_bps < 0 or p_treasury_bps > 10000 then raise exception 'invalid amounts' using errcode = 'P0001'; end if;
  t := (p_confirmed * p_treasury_bps) / 10000;       -- integer floor; remainder keeps the rounding lamports so t + rem = confirmed
  rem := p_confirmed - t;
  update public.fee_receipts set confirmed_lamports = p_confirmed, confirmed_at = now(),
         status = case when p_confirmed = claimed_lamports then 'confirmed' else 'mismatch' end where id = p_receipt;
  st := case when r.simulated then 'simulated' when p_transfer_supported then 'pending' else 'unsupported' end;
  insert into public.treasury_allocations(receipt_id, basis_bps, treasury_lamports, remainder_lamports, treasury_destination,
         remainder_destination, status, mechanism, simulated, note)
  values (p_receipt, p_treasury_bps, t, rem, p_treasury_dest, p_remainder_dest, st, p_mechanism, r.simulated,
          case when st = 'unsupported' then 'No documented/authorized transfer mechanism configured; allocation is a calculation only.' end)
  returning * into a;
  insert into public.treasury_ledger(idempotency_key, entry_type, bucket, amount, simulated, receipt_id, allocation_id, memo) values
    ('fee_confirmed:' || p_receipt, 'fee_confirmed', 'remainder', p_confirmed, r.simulated, p_receipt, a.id, 'confirmed on chain'),
    ('alloc_treasury:' || a.id, 'allocation_calculated', 'treasury', t, r.simulated, p_receipt, a.id, 'treasury share (calculated)'),
    ('alloc_remainder:' || a.id, 'allocation_calculated', 'remainder', rem, r.simulated, p_receipt, a.id, 'remaining allocation (calculated)');
  return jsonb_build_object('receipt_id', p_receipt, 'allocation_id', a.id, 'created', true, 'treasury_lamports', t, 'remainder_lamports', rem, 'status', st);
end $$;

create function public.record_transfer(p_allocation uuid, p_signature text, p_lamports bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a public.treasury_allocations;
begin
  select * into a from public.treasury_allocations where id = p_allocation for update;
  if not found then raise exception 'unknown allocation' using errcode = 'P0002'; end if;
  if a.simulated then raise exception 'simulated allocations cannot record transfers' using errcode = 'P0001'; end if;
  if a.status = 'transferred' then return jsonb_build_object('allocation_id', a.id, 'created', false); end if;
  if p_lamports <= 0 or p_lamports > a.treasury_lamports then raise exception 'transfer exceeds allocation' using errcode = 'P0001'; end if;
  update public.treasury_allocations set status = 'transferred', transferred_lamports = p_lamports, transfer_signature = p_signature, updated_at = now() where id = a.id;
  insert into public.treasury_ledger(idempotency_key, entry_type, bucket, amount, receipt_id, allocation_id, memo)
  values ('transfer:' || p_signature, 'transfer_confirmed', 'treasury', p_lamports, a.receipt_id, a.id, 'verified transfer');
  return jsonb_build_object('allocation_id', a.id, 'created', true);
end $$;

create view public.treasury_summary with (security_invoker = true) as
select
  coalesce(sum(amount) filter (where entry_type='fee_observed'  and not simulated), 0) as observed_lamports,
  coalesce(sum(amount) filter (where entry_type='fee_confirmed' and not simulated), 0) as confirmed_lamports,
  coalesce(sum(amount) filter (where entry_type='allocation_calculated' and bucket='treasury'  and not simulated), 0) as allocation_treasury_lamports,
  coalesce(sum(amount) filter (where entry_type='allocation_calculated' and bucket='remainder' and not simulated), 0) as allocation_remainder_lamports,
  coalesce(sum(amount) filter (where entry_type='transfer_confirmed' and not simulated), 0) as transferred_lamports,
  coalesce(sum(amount) filter (where entry_type='funding_recorded' and unit='lamports' and not simulated), 0) as funding_lamports,
  coalesce(sum(amount) filter (where entry_type='expense_recorded' and unit='lamports' and not simulated), 0) as expense_lamports,
  coalesce(sum(amount) filter (where entry_type='expense_recorded' and unit='usd_micros'), 0) as expense_usd_micros,
  coalesce(sum(amount) filter (where entry_type='fee_confirmed' and simulated), 0) as simulated_confirmed_lamports
from public.treasury_ledger;

create view public.worker_health with (security_invoker = true) as
select worker_id, started_at, last_seen_at, version, (now() - last_seen_at) < interval '3 minutes' as alive from public.worker_heartbeats;

-- ---------- RLS ----------
do $$ declare t text; begin
  foreach t in array array['agents','agent_profiles','agent_votes','agent_vote_counts','vote_changes','research_sources','trend_clusters','observations',
    'agent_jobs','agent_memories','token_proposals','verified_tokens','circuit_events','fee_receipts','treasury_allocations','treasury_ledger',
    'activity_events','audit_logs','worker_heartbeats'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
  -- public, read-only transparency tables
  foreach t in array array['agents','agent_profiles','agent_vote_counts','research_sources','trend_clusters','observations','agent_memories',
    'token_proposals','verified_tokens','fee_receipts','treasury_allocations','treasury_ledger','activity_events','worker_heartbeats'] loop
    execute format('grant select on public.%I to anon, authenticated', t);
    execute format('create policy %I on public.%I for select to anon, authenticated using (true)', t || '_public_read', t);
  end loop;
end $$;
grant select on public.treasury_summary, public.worker_health to anon, authenticated;
-- A signed-in person may read ONLY their own vote row; nobody can write votes except through cast_vote().
grant select on public.agent_votes to authenticated;
create policy agent_votes_own_read on public.agent_votes for select to authenticated using (user_id = auth.uid());
-- agent_jobs, circuit_events, audit_logs, vote_changes: no policies = no client access at all.

revoke all on function public.cast_vote(uuid, text, integer) from public, anon, authenticated;
revoke all on function public.claim_job(text, integer) from public, anon, authenticated;
revoke all on function public.ingest_fee_receipt(text, text, text, text, text, bigint, boolean, uuid) from public, anon, authenticated;
revoke all on function public.confirm_fee_receipt(uuid, bigint, integer, text, text, text, boolean) from public, anon, authenticated;
revoke all on function public.record_transfer(uuid, text, bigint) from public, anon, authenticated;
grant execute on function public.cast_vote(uuid, text, integer), public.claim_job(text, integer),
  public.ingest_fee_receipt(text, text, text, text, text, bigint, boolean, uuid),
  public.confirm_fee_receipt(uuid, bigint, integer, text, text, text, boolean), public.record_transfer(uuid, text, bigint) to service_role;

-- ---------- realtime (only public-safe tables; RLS still applies) ----------
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.agent_vote_counts, public.activity_events, public.agents, public.token_proposals, public.treasury_ledger;
  end if;
end $$;
