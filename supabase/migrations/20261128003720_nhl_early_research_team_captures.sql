set local lock_timeout='3s';
-- Research observations, isolated from the betting tracker and manual-feature ledger.
create schema nhl_early_research;
revoke all on schema nhl_early_research from public, anon, authenticated, service_role;

create table nhl_early_research.captures (
  slot timestamptz primary key,
  captured_at timestamptz not null,
  run_id text not null,
  special_teams_source text not null,
  special_teams_at timestamptz not null,
  special_teams_hash text not null,
  season_id integer not null,
  teams jsonb not null check (jsonb_typeof(teams) = 'object')
);
revoke all on nhl_early_research.captures from public, anon, authenticated, service_role;

alter table nhl_early_research.captures enable row level security;
create trigger preserve_capture before update or delete or truncate on nhl_early_research.captures
for each statement execute function public.nhl_free_immutable_v1();

create function nhl_early_research.capture(p_run_id text) returns integer
language plpgsql set search_path = pg_catalog as $$
declare
  cutoff timestamptz := statement_timestamp();
  bucket timestamptz := date_bin(interval '30 minutes', cutoff, timestamptz '2000-01-01 00:00Z');
  written integer;
begin
  if exists (select from nhl_early_research.captures where slot = bucket) then return 0; end if;
  with source as (
    select * from public.nhl_special_teams_asof_v1
    where captured_at between cutoff - interval '36 hours' and cutoff and created_at <= cutoff
    order by captured_at desc, id limit 1
  ), teams as (
    select source.id, entry, (entry->>'teamId')::integer as team_id
    from source cross join lateral jsonb_array_elements(source.teams) entry
    where (entry->>'gamesPlayed')::integer > 0
      and (entry->>'powerPlayPct')::numeric between 0 and 1
      and (entry->>'penaltyKillPct')::numeric between 0 and 1
  ), observed as (
    select s.id, t.team_id, jsonb_build_object('specialTeams', t.entry,
      'observedGames', coalesce(g.history,'[]'::jsonb)) as stats
    from teams t join source s on s.id=t.id
    left join lateral (
      select jsonb_agg(to_jsonb(prior) order by prior.started desc, prior.event_id) history
      from (
        select c.event_id, (b->>'startTimeUTC')::timestamptz started,
          c.updated_at, c.boxscore_captured_at, b->>'gameDate' as game_date,
          b->'awayTeam'->'id' away_id, b->'homeTeam'->'id' home_id,
          b->'awayTeam'->'sog' away_shots, b->'homeTeam'->'sog' home_shots
        from public.nhl_game_context_v2 c cross join lateral (select c.boxscore b) box
        where c.updated_at <= cutoff and c.boxscore_captured_at <= cutoff
          and b->>'season'=s.season_id::text and b->>'gameType'='2'
          and b->>'gameState' in ('FINAL','OFF')
          and (b->>'startTimeUTC')::timestamptz < cutoff
          and t.team_id::text in (b->'awayTeam'->>'id',b->'homeTeam'->>'id')
        order by started desc, c.event_id limit 10
      ) prior
    ) g on true
  )
  insert into nhl_early_research.captures
  select bucket, clock_timestamp(), p_run_id, s.id,s.captured_at,s.source_hash,s.season_id,
    jsonb_object_agg(o.team_id::text,o.stats)
  from source s join observed o on o.id=s.id
  group by s.id,s.captured_at,s.source_hash,s.season_id,s.team_count
  having count(*)=32 and count(distinct o.team_id)=32 and s.team_count=32
  on conflict(slot) do nothing;
  get diagnostics written = row_count;
  return written;
end $$;
revoke all on function nhl_early_research.capture(text) from public, anon, authenticated, service_role;

create function nhl_early_research.after_run() returns trigger
language plpgsql security definer set search_path = pg_catalog as $$
begin
  perform nhl_early_research.capture(new.id);
  return new;
exception when others then
  raise warning 'NHL early research capture failed (SQLSTATE %)', SQLSTATE;
  return new;
end $$;
revoke all on function nhl_early_research.after_run() from public, anon, authenticated, service_role;
create trigger capture_early_team_statistics after update of status on public.nhl_free_runs_v1
for each row when (old.status is distinct from new.status and new.status in ('PASS','PARTIAL'))
execute function nhl_early_research.after_run();

create view nhl_early_research.first_observation_pairs as
with originals as (
  select distinct on (event_id) * from public.nhl_free_predictions_v1
  order by event_id, created_at, id
)
select p.event_id, p.id as prediction_id, p.scheduled_at, p.created_at as forecast_archived_at,
  s.captured_at as dratings_observed_at, c.slot, c.captured_at as stats_archived_at,
  p.body->>'awayId' as away_id, p.body->>'homeId' as home_id
from originals p join public.nhl_free_source_v1 s on s.id=p.source_id
join lateral (
  select * from nhl_early_research.captures r
  where r.captured_at < least(p.created_at,s.captured_at)
    and r.captured_at >= s.captured_at - interval '36 hours'
    and left(r.season_id::text,4)=substr(p.event_id,5,4)
    and r.teams ? (p.body->>'homeId') and r.teams ? (p.body->>'awayId')
  order by r.captured_at desc limit 1
) c on true
where p.created_at < p.scheduled_at and s.captured_at <= p.created_at
  and s.source_url='https://www.dratings.com/predictor/nhl-hockey-predictions/'
  and s.body->>'http_status'='200'
  and p.body->>'awayId' <> p.body->>'homeId';
revoke all on nhl_early_research.first_observation_pairs from public, anon, authenticated, service_role;
