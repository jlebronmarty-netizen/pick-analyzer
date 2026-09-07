-- MLB Statcast runtime performance v1
-- Keeps pick2_raw_mlb_statcast_pitches as the single source of truth.
-- These indexes match the derived identity/team expressions used by the
-- security-invoker analytical views so filtered API reads can avoid scanning
-- the complete pitch table.

create index if not exists pick2_raw_mlb_statcast_pitches_season_pitcher_effective_date_idx
  on public.pick2_raw_mlb_statcast_pitches (
    game_year,
    (coalesce(mlbam_pitcher_id, source_pitcher_id)),
    game_date desc,
    game_pk
  )
  where coalesce(mlbam_pitcher_id, source_pitcher_id) is not null;

create index if not exists pick2_raw_mlb_statcast_pitches_season_batter_effective_date_idx
  on public.pick2_raw_mlb_statcast_pitches (
    game_year,
    (coalesce(mlbam_batter_id, source_batter_id)),
    game_date desc,
    game_pk
  )
  where coalesce(mlbam_batter_id, source_batter_id) is not null;

create index if not exists pick2_raw_mlb_statcast_pitches_season_pitcher_effective_pitch_type_idx
  on public.pick2_raw_mlb_statcast_pitches (
    game_year,
    (coalesce(mlbam_pitcher_id, source_pitcher_id)),
    pitch_type,
    game_date desc
  )
  where coalesce(mlbam_pitcher_id, source_pitcher_id) is not null
    and pitch_type is not null;

create index if not exists pick2_raw_mlb_statcast_pitches_season_batting_team_date_idx
  on public.pick2_raw_mlb_statcast_pitches (
    game_year,
    (case
      when inning_topbot = 'Top' then source_away_team
      when inning_topbot = 'Bot' then source_home_team
      else null
    end),
    game_date desc,
    game_pk
  );

create index if not exists pick2_raw_mlb_statcast_pitches_season_fielding_team_date_idx
  on public.pick2_raw_mlb_statcast_pitches (
    game_year,
    (case
      when inning_topbot = 'Top' then source_home_team
      when inning_topbot = 'Bot' then source_away_team
      else null
    end),
    game_date desc,
    game_pk
  );

-- Coverage requires whole-season distinct counts, so a normal view necessarily
-- rescans the entire raw pitch table. Materialize this tiny season-level result
-- and refresh it only when the raw Statcast source changes.
create materialized view if not exists public.mlb_statcast_coverage_mv as
select
  game_year as season,
  min(game_date) as first_game_date,
  max(game_date) as last_game_date,
  count(*)::bigint as pitches,
  count(distinct game_pk)::bigint as games,
  count(distinct coalesce(mlbam_pitcher_id, source_pitcher_id))::bigint as pitchers,
  count(distinct coalesce(mlbam_batter_id, source_batter_id))::bigint as batters,
  count(distinct case
    when inning_topbot = 'Top' then source_away_team
    when inning_topbot = 'Bot' then source_home_team
    else null
  end)::bigint as batting_teams,
  max(ingested_at) as source_refreshed_at,
  now() as materialized_at
from public.pick2_raw_mlb_statcast_pitches
where game_year is not null
group by game_year
with data;

create unique index if not exists mlb_statcast_coverage_mv_season_uidx
  on public.mlb_statcast_coverage_mv (season);

revoke all on public.mlb_statcast_coverage_mv from public, anon, authenticated;
grant select on public.mlb_statcast_coverage_mv to service_role;

create or replace function public.refresh_mlb_statcast_coverage_mv()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  refresh materialized view public.mlb_statcast_coverage_mv;
end;
$$;

revoke all on function public.refresh_mlb_statcast_coverage_mv() from public, anon, authenticated;
grant execute on function public.refresh_mlb_statcast_coverage_mv() to service_role;
