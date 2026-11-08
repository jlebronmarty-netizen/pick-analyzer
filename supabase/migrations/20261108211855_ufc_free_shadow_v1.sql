create table public.ufc_free_runs_v1 (
 id text primary key, started_at timestamptz not null default now(), completed_at timestamptz,
 status text not null check (status in ('RUNNING','PASS','PARTIAL','FAILED')),
 provider_calls integer not null default 0 check (provider_calls between 0 and 8),
 detail jsonb not null default '{}'::jsonb
);
create table public.ufc_free_sources_v1 (
 id text primary key, run_id text not null references public.ufc_free_runs_v1(id),
 captured_at timestamptz not null, source_url text not null, body jsonb not null
);
create index ufc_free_sources_run_idx on public.ufc_free_sources_v1(run_id);
create table public.ufc_free_predictions_v1 (
 id text primary key, bout_id text not null unique, scheduled_at timestamptz not null,
 captured_at timestamptz not null, source_id text not null references public.ufc_free_sources_v1(id),
 history_source_id text not null references public.ufc_free_sources_v1(id), body jsonb not null,
 check (captured_at < scheduled_at)
);
create index ufc_free_predictions_source_idx on public.ufc_free_predictions_v1(source_id);
create index ufc_free_predictions_history_idx on public.ufc_free_predictions_v1(history_source_id);
create table public.ufc_free_results_v1 (
 id text primary key, bout_id text not null, captured_at timestamptz not null,
 source_id text not null references public.ufc_free_sources_v1(id), body jsonb not null
);
create index ufc_free_results_bout_idx on public.ufc_free_results_v1(bout_id);
create index ufc_free_results_source_idx on public.ufc_free_results_v1(source_id);
create table public.ufc_free_quotes_v1 (
 id text primary key, bout_id text not null, captured_at timestamptz not null, scheduled_at timestamptz not null,
 source_id text not null references public.ufc_free_sources_v1(id), body jsonb not null,
 check (captured_at < scheduled_at)
);
create index ufc_free_quotes_bout_idx on public.ufc_free_quotes_v1(bout_id,captured_at desc);
create index ufc_free_quotes_source_idx on public.ufc_free_quotes_v1(source_id);
create table public.ufc_free_lock_v1 (id boolean primary key default true check(id), owner uuid, expires_at timestamptz not null default now());
insert into public.ufc_free_lock_v1(id) values(true);
create function public.ufc_free_claim_v1(run_id uuid) returns boolean language plpgsql security definer set search_path='' as $$
begin
 update public.ufc_free_lock_v1 set owner=run_id,expires_at=now()+interval '6 minutes' where id and expires_at<now();
 return found;
end $$;
revoke all on function public.ufc_free_claim_v1(uuid) from public,anon,authenticated;
grant execute on function public.ufc_free_claim_v1(uuid) to service_role;
create function public.ufc_free_immutable_v1() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'UFC_FORWARD_EVIDENCE_IMMUTABLE'; end $$;
revoke all on function public.ufc_free_immutable_v1() from public,anon,authenticated,service_role;
do $$
declare t text;
begin
 foreach t in array array['ufc_free_runs_v1','ufc_free_sources_v1','ufc_free_predictions_v1','ufc_free_results_v1','ufc_free_quotes_v1','ufc_free_lock_v1'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);
 if t in ('ufc_free_runs_v1','ufc_free_lock_v1') then
 execute format('grant select,insert,update on public.%I to service_role',t);
 else
 execute format('grant select,insert on public.%I to service_role',t);
 execute format('create trigger ufc_free_no_mutation before update or delete on public.%I for each row execute function public.ufc_free_immutable_v1()',t);
 end if;
 end loop;
end $$;
