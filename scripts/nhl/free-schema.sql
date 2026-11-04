create table public.nhl_free_runs_v1 (
 id text primary key, started_at timestamptz not null default now(), completed_at timestamptz,
 status text not null, provider_calls integer not null default 0, detail jsonb not null default '{}'::jsonb
);
create table public.nhl_free_source_v1 (
 id text primary key, run_id text not null references public.nhl_free_runs_v1(id),
 captured_at timestamptz not null, source_url text not null, body jsonb not null
);
create table public.nhl_free_predictions_v1 (
 id text primary key, event_id text not null unique, scheduled_at timestamptz not null,
 created_at timestamptz not null, body jsonb not null, source_id text not null references public.nhl_free_source_v1(id),
 check(created_at < scheduled_at), check(body->>'model'='DRATINGS_PUBLIC_V1')
);
create table public.nhl_free_outcomes_v1 (
 id text primary key, event_id text not null, body jsonb not null,
 source_id text not null references public.nhl_free_source_v1(id), observed_at timestamptz not null
);
create index nhl_free_outcomes_event_idx on public.nhl_free_outcomes_v1(event_id);
create index nhl_free_predictions_tip_idx on public.nhl_free_predictions_v1(scheduled_at);
create table public.nhl_free_lock_v1 (id boolean primary key default true check(id),expires_at timestamptz not null,owner text not null);
insert into public.nhl_free_lock_v1 values(true,'1970-01-01','INITIAL');
create function public.nhl_free_claim_v1(run_id text) returns boolean language plpgsql security invoker set search_path='' as $$
declare n integer;
begin
 update public.nhl_free_lock_v1 set expires_at=now()+interval '10 minutes',owner=run_id where id and expires_at<now();
 get diagnostics n=row_count;return n=1;
end $$;
create function public.nhl_free_immutable_v1() returns trigger language plpgsql security invoker set search_path='' as $$begin raise exception 'Immutable NHL evidence';end $$;
create trigger ncaab_source_immutable before update or delete on public.nhl_free_source_v1 for each row execute function public.nhl_free_immutable_v1();
create trigger ncaab_prediction_immutable before update or delete on public.nhl_free_predictions_v1 for each row execute function public.nhl_free_immutable_v1();
create trigger ncaab_outcome_immutable before update or delete on public.nhl_free_outcomes_v1 for each row execute function public.nhl_free_immutable_v1();
alter table public.nhl_free_runs_v1 enable row level security;
alter table public.nhl_free_source_v1 enable row level security;
alter table public.nhl_free_predictions_v1 enable row level security;
alter table public.nhl_free_outcomes_v1 enable row level security;
alter table public.nhl_free_lock_v1 enable row level security;
revoke all on public.nhl_free_runs_v1,public.nhl_free_source_v1,public.nhl_free_predictions_v1,public.nhl_free_outcomes_v1,public.nhl_free_lock_v1 from anon,authenticated;
grant select,insert,update on public.nhl_free_runs_v1,public.nhl_free_lock_v1 to service_role;
grant select,insert on public.nhl_free_source_v1,public.nhl_free_predictions_v1,public.nhl_free_outcomes_v1 to service_role;
revoke all on function public.nhl_free_claim_v1(text) from public,anon,authenticated;
grant execute on function public.nhl_free_claim_v1(text) to service_role;
revoke all on function public.nhl_free_immutable_v1() from public,anon,authenticated;

create index nhl_free_runs_started_idx on public.nhl_free_runs_v1(started_at desc);
create index nhl_free_source_denied_idx on public.nhl_free_source_v1 ((body->>'access_denied')) where body->>'access_denied'='true';
