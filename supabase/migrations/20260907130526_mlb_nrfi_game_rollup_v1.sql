-- MLB NRFI/YRFI game-level Statcast rollup V1.
-- Source of truth remains pick2_raw_mlb_statcast_pitches.
-- This is a read-only analytical surface and does not activate betting.

create materialized view if not exists public.mlb_statcast_first_inning_game_mv as
select
  p.game_year as season,
  p.game_pk,
  min(p.game_date) as game_date,
  max(p.source_home_team) as home_team,
  max(p.source_away_team) as away_team,
  ((array_agg(coalesce(p.mlbam_pitcher_id, p.source_pitcher_id) order by p.at_bat_number, p.pitch_number)
    filter (where p.inning = 1 and p.inning_topbot = 'Top'))[1])::bigint as home_starter,
  ((array_agg(coalesce(p.mlbam_pitcher_id, p.source_pitcher_id) order by p.at_bat_number, p.pitch_number)
    filter (where p.inning = 1 and p.inning_topbot = 'Bot'))[1])::bigint as away_starter,
  coalesce(max(p.post_away_score) filter (where p.inning = 1), 0)::int as away_first_inning_runs,
  coalesce(max(p.post_home_score) filter (where p.inning = 1), 0)::int as home_first_inning_runs,
  (
    coalesce(max(p.post_away_score) filter (where p.inning = 1), 0)
    + coalesce(max(p.post_home_score) filter (where p.inning = 1), 0)
  )::int as first_inning_runs,
  (
    coalesce(max(p.post_away_score) filter (where p.inning = 1), 0)
    + coalesce(max(p.post_home_score) filter (where p.inning = 1), 0)
  ) = 0 as nrfi,
  count(*) filter (where p.inning = 1 and p.inning_topbot = 'Top')::int as away_first_inning_pitches,
  count(*) filter (where p.inning = 1 and p.inning_topbot = 'Bot')::int as home_first_inning_pitches,
  max(p.ingested_at) as refreshed_at
from public.pick2_raw_mlb_statcast_pitches p
where p.game_year in (2025, 2026)
group by p.game_year, p.game_pk
with data;

create unique index if not exists mlb_statcast_first_inning_game_mv_uidx
  on public.mlb_statcast_first_inning_game_mv (season, game_pk);
create index if not exists mlb_statcast_first_inning_game_mv_date_idx
  on public.mlb_statcast_first_inning_game_mv (season, game_date, game_pk);
create index if not exists mlb_statcast_first_inning_game_mv_home_team_date_idx
  on public.mlb_statcast_first_inning_game_mv (season, home_team, game_date, game_pk);
create index if not exists mlb_statcast_first_inning_game_mv_away_team_date_idx
  on public.mlb_statcast_first_inning_game_mv (season, away_team, game_date, game_pk);
create index if not exists mlb_statcast_first_inning_game_mv_home_starter_date_idx
  on public.mlb_statcast_first_inning_game_mv (season, home_starter, game_date, game_pk);
create index if not exists mlb_statcast_first_inning_game_mv_away_starter_date_idx
  on public.mlb_statcast_first_inning_game_mv (season, away_starter, game_date, game_pk);

revoke all on public.mlb_statcast_first_inning_game_mv from public, anon, authenticated;
grant select on public.mlb_statcast_first_inning_game_mv to service_role;

create or replace function public.refresh_mlb_statcast_first_inning_rollups()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  refresh materialized view public.mlb_statcast_first_inning_game_mv;
end;
$$;

revoke all on function public.refresh_mlb_statcast_first_inning_rollups() from public, anon, authenticated;
grant execute on function public.refresh_mlb_statcast_first_inning_rollups() to service_role;
