-- DIT Free-tier read-only cultural evidence runner. No AI generation or financial operations.
-- The token is generated server-side. Never paste it into a file or expose it to the browser.
create table if not exists public.dit_worker_auth (
  id smallint primary key check (id = 1),
  token text not null
);
alter table public.dit_worker_auth enable row level security;
revoke all on public.dit_worker_auth from public, anon, authenticated;
grant select on public.dit_worker_auth to service_role;
insert into public.dit_worker_auth (id, token)
select 1, encode(gen_random_bytes(32), 'hex')
where not exists (select 1 from public.dit_worker_auth where id = 1);

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net;
