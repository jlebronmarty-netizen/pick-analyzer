-- MLB batter total-bases game rollup v1
-- Read-only analytical surface for historical batter total-bases research.
-- Source of truth remains pick2_raw_mlb_statcast_pitches.

create materialized view if not exists public.mlb_statcast_batter_total_bases_game_mv as
select
  p.game_year as season,
  p.game_pk,
  min(p.game_date) as game_date,
  coalesce(p.mlbam_batter_id, p.source_batter_id) as batter,
  max(case
    when p.inning_topbot = 'Top' then p.source_away_team
    when p.inning_topbot = 'Bot' then p.source_home_team
    else null
  end) as batting_team,
  max(case
    when p.inning_topbot = 'Top' then p.source_home_team
    when p.inning_topbot = 'Bot' then p.source_away_team
    else null
  end) as opponent_team,
  max(p.stand) as stand,
  count(distinct (p.game_pk, p.at_bat_number))::int as plate_appearances,
  count(*) filter (where p.events in ('single','double','triple','home_run'))::int as hits,
  count(*) filter (where p.events = 'single')::int as singles,
  count(*) filter (where p.events = 'double')::int as doubles,
  count(*) filter (where p.events = 'triple')::int as triples,
  count(*) filter (where p.events = 'home_run')::int as home_runs,
  (
    count(*) filter (where p.events = 'single')
    + 2 * count(*) filter (where p.events = 'double')
    + 3 * count(*) filter (where p.events = 'triple')
    + 4 * count(*) filter (where p.events = 'home_run')
  )::int as total_bases,
  max(p.ingested_at) as refreshed_at
from public.pick2_raw_mlb_statcast_pitches p
where p.game_year is not null
  and coalesce(p.mlbam_batter_id, p.source_batter_id) is not null
group by p.game_year, p.game_pk, coalesce(p.mlbam_batter_id, p.source_batter_id)
with data;

create unique index if not exists mlb_statcast_batter_total_bases_game_mv_uidx
  on public.mlb_statcast_batter_total_bases_game_mv (season, game_pk, batter);

create index if not exists mlb_statcast_batter_total_bases_game_mv_batter_date_idx
  on public.mlb_statcast_batter_total_bases_game_mv (season, batter, game_date desc, game_pk);

revoke all on public.mlb_statcast_batter_total_bases_game_mv from public, anon, authenticated;
grant select on public.mlb_statcast_batter_total_bases_game_mv to service_role;

create or replace function public.refresh_mlb_statcast_batter_prop_rollups()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  refresh materialized view public.mlb_statcast_batter_total_bases_game_mv;
end;
$$;

revoke all on function public.refresh_mlb_statcast_batter_prop_rollups() from public, anon, authenticated;
grant execute on function public.refresh_mlb_statcast_batter_prop_rollups() to service_role;

create or replace function public.refresh_mlb_statcast_all_analytics()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.refresh_mlb_statcast_runtime_rollups();
  perform public.refresh_mlb_statcast_matchup_rollups();
  perform public.refresh_mlb_statcast_batter_prop_rollups();
end;
$$;

revoke all on function public.refresh_mlb_statcast_all_analytics() from public, anon, authenticated;
grant execute on function public.refresh_mlb_statcast_all_analytics() to service_role;
