-- Private shadow ledger; the public pages never call providers or write.
create table public.free_sports_runs_v1 (
  id bigint generated always as identity primary key,
  league text not null check (league in ('NFL','ATP','WTA','BSN')),
  slot timestamptz not null,
  source text not null,
  requested_at timestamptz not null default clock_timestamp(),
  observed_at timestamptz,
  state text not null default 'RUNNING' check (state in ('RUNNING','OK','ERROR')),
  evidence jsonb,
  unique (league,slot)
);
create index free_sports_runs_latest_idx on public.free_sports_runs_v1 (league,id desc);
create table public.free_sports_forecasts_v1 (
  league text not null check (league in ('NFL','ATP','WTA','BSN')),
  event_id text not null,
  run_id bigint not null references public.free_sports_runs_v1(id),
  start_at timestamptz not null,
  issued_at timestamptz not null check (issued_at<start_at),
  forecast jsonb not null,
  primary key (league,event_id)
);
create table public.free_sports_results_v1 (
  league text not null,
  event_id text not null,
  run_id bigint not null references public.free_sports_runs_v1(id),
  start_at timestamptz not null,
  observed_at timestamptz not null,
  a_id text not null,
  b_id text not null check (a_id<b_id),
  outcome text not null,
  primary key (league,event_id,start_at,a_id,b_id,outcome),
  foreign key (league,event_id) references public.free_sports_forecasts_v1(league,event_id)
);
alter table public.free_sports_runs_v1 enable row level security;
alter table public.free_sports_forecasts_v1 enable row level security;
alter table public.free_sports_results_v1 enable row level security;
revoke all on public.free_sports_runs_v1,public.free_sports_forecasts_v1,public.free_sports_results_v1 from public,anon,authenticated,service_role;
revoke all on sequence public.free_sports_runs_v1_id_seq from public,anon,authenticated,service_role;
grant select on public.free_sports_runs_v1,public.free_sports_forecasts_v1,public.free_sports_results_v1 to service_role;
grant insert (league,slot,source) on public.free_sports_runs_v1 to service_role;
grant usage on sequence public.free_sports_runs_v1_id_seq to service_role;

create function public.finish_free_sports_run_v1(p_run bigint,p_state text,p_observed timestamptz,p_evidence jsonb,p_forecasts jsonb,p_results jsonb)
returns integer language plpgsql security definer set search_path = '' as $$
declare r public.free_sports_runs_v1; inserted integer := 0;
begin
  select * into r from public.free_sports_runs_v1 where id=p_run for update;
  if not found or r.state<>'RUNNING' then raise exception 'Invalid or closed run'; end if;
  if p_state not in ('OK','ERROR') or p_evidence is null then raise exception 'Invalid completion'; end if;
  if p_state='OK' then
    if p_observed is null or p_observed<r.requested_at or p_observed>clock_timestamp() then raise exception 'Invalid observation clock'; end if;
    insert into public.free_sports_forecasts_v1 (league,event_id,run_id,start_at,issued_at,forecast)
    select r.league,f#>>'{event,id}',r.id,(f#>>'{event,start}')::timestamptz,(f->>'issuedAt')::timestamptz,f
    from jsonb_array_elements(p_forecasts) f
    where f->>'league'=r.league and f#>>'{event,state}'='PRE'
      and (f->>'issuedAt')::timestamptz>=p_observed
      and (f->>'issuedAt')::timestamptz<=clock_timestamp()
      and (f#>>'{event,start}')::timestamptz>clock_timestamp()
      and (f#>>'{event,quote,capturedAt}' is null or (f#>>'{event,quote,capturedAt}')::timestamptz=p_observed)
    on conflict (league,event_id) do nothing;
    get diagnostics inserted = row_count;
    insert into public.free_sports_results_v1 (league,event_id,run_id,start_at,observed_at,a_id,b_id,outcome)
    select r.league,x.event_id,r.id,x.start_at,p_observed,least(x.a_id,x.b_id),greatest(x.a_id,x.b_id),x.outcome
    from jsonb_to_recordset(p_results) as x(event_id text,start_at timestamptz,a_id text,b_id text,outcome text)
    join public.free_sports_forecasts_v1 f on f.league=r.league and f.event_id=x.event_id
    where p_observed>=f.issued_at and (x.outcome in ('EXCLUDED','IDENTITY_CHANGED') or p_observed>=f.start_at)
    on conflict do nothing;
  end if;
  update public.free_sports_runs_v1 set state=p_state,observed_at=p_observed,evidence=p_evidence where id=p_run;
  return inserted;
end;
$$;
revoke all on function public.finish_free_sports_run_v1(bigint,text,timestamptz,jsonb,jsonb,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.finish_free_sports_run_v1(bigint,text,timestamptz,jsonb,jsonb,jsonb) to service_role;
