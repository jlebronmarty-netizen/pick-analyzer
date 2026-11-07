create table public.nhl_free_quote_observations_v1 (
 id text primary key,
 prediction_id text not null references public.nhl_free_predictions_v1(id),
 event_id text not null,
 run_id text not null references public.nhl_free_runs_v1(id),
 source_id text not null references public.nhl_free_source_v1(id),
 forecast_source_id text not null references public.nhl_free_source_v1(id),
 schedule_source_id text not null references public.nhl_free_source_v1(id),
 directory_source_id text not null references public.nhl_free_source_v1(id),
 captured_at timestamptz not null,
 scheduled_at timestamptz not null,
 created_at timestamptz not null default now(),
 body jsonb not null,
 unique(prediction_id,run_id),
 check(captured_at < scheduled_at and created_at < scheduled_at),
 check(body->>'id'=prediction_id and body->>'eventId'=event_id),
 check((body->>'capturedAt')::timestamptz=captured_at and (body->>'scheduledAt')::timestamptz=scheduled_at),
 check(body->>'sportsbook'='CIRCA' and body->>'model'='DRATINGS_PUBLIC_V1'),
 check(jsonb_typeof(body->'awayOdds')='number' and jsonb_typeof(body->'homeOdds')='number'),
 check(abs((body->>'awayOdds')::numeric)>=100 and abs((body->>'homeOdds')::numeric)>=100),
 check(mod((body->>'awayOdds')::numeric,1)=0 and mod((body->>'homeOdds')::numeric,1)=0)
);
create index nhl_free_quote_prediction_time_idx on public.nhl_free_quote_observations_v1(prediction_id,captured_at desc,id);
create index nhl_free_quote_source_idx on public.nhl_free_quote_observations_v1(source_id);
create index nhl_free_quote_forecast_source_idx on public.nhl_free_quote_observations_v1(forecast_source_id);
create index nhl_free_quote_schedule_source_idx on public.nhl_free_quote_observations_v1(schedule_source_id);
create index nhl_free_quote_directory_source_idx on public.nhl_free_quote_observations_v1(directory_source_id);
create index nhl_free_quote_run_idx on public.nhl_free_quote_observations_v1(run_id);
create trigger nhl_quote_immutable before update or delete on public.nhl_free_quote_observations_v1 for each row execute function public.nhl_free_immutable_v1();
alter table public.nhl_free_quote_observations_v1 enable row level security;
revoke all on public.nhl_free_quote_observations_v1 from anon,authenticated;
grant select,insert on public.nhl_free_quote_observations_v1 to service_role;
create view public.nhl_free_latest_quotes_v1 with(security_invoker=true) as
 select distinct on(q.prediction_id) q.id,q.prediction_id,q.event_id,q.scheduled_at,q.captured_at,q.source_id,q.body
 from public.nhl_free_quote_observations_v1 q join public.nhl_free_runs_v1 r on r.id=q.run_id
 where r.status in ('PASS','PARTIAL')
 order by q.prediction_id,q.captured_at desc,q.id;
revoke all on public.nhl_free_latest_quotes_v1 from anon,authenticated;
grant select on public.nhl_free_latest_quotes_v1 to service_role;
