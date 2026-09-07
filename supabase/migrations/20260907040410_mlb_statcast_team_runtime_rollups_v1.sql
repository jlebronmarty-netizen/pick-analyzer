-- MLB Statcast team runtime rollups v1
-- Team season summaries touch ~20k pitches per club. Precompute the tiny
-- season/team result sets so request-time reads remain comfortably bounded.

create materialized view if not exists public.mlb_statcast_team_batting_season_summary_mv as
select
  game_year as season,
  batting_team as team,
  count(distinct game_pk)::int as games,
  count(*)::int as total_pitches,
  count(distinct (game_pk, at_bat_number))::int as plate_appearances,
  count(*) filter (where is_strikeout)::int as strikeouts,
  count(*) filter (where is_walk or is_intentional_walk)::int as walks,
  count(*) filter (where is_hit)::int as hits,
  count(*) filter (where is_home_run)::int as home_runs,
  count(*) filter (where is_ball)::int as balls,
  count(*) filter (where is_strike)::int as strikes,
  count(*) filter (where is_in_play)::int as in_play,
  count(*) filter (where is_whiff)::int as whiffs,
  count(*) filter (where is_swing)::int as swings,
  count(*) filter (where is_zone)::int as zone_pitches,
  count(*) filter (where is_outside_zone)::int as outside_zone_pitches,
  count(*) filter (where is_chase)::int as chases,
  count(*) filter (where is_batted_ball)::int as batted_balls,
  count(*) filter (where is_hard_hit)::int as hard_hits,
  count(*) filter (where is_barrel)::int as barrels,
  avg(launch_speed) as avg_exit_velocity,
  avg(launch_angle) as avg_launch_angle,
  count(*) filter (where is_ball)::double precision / nullif(count(*),0) as ball_rate,
  count(*) filter (where is_strike)::double precision / nullif(count(*),0) as strike_rate,
  count(*) filter (where is_in_play)::double precision / nullif(count(*),0) as in_play_rate,
  count(*) filter (where is_whiff)::double precision
    / nullif(count(*) filter (where is_swing),0) as whiff_rate,
  count(*) filter (where is_chase)::double precision
    / nullif(count(*) filter (where is_outside_zone),0) as chase_rate,
  count(*) filter (where is_zone)::double precision
    / nullif(count(*) filter (where zone is not null),0) as zone_rate,
  (count(*) filter (where is_swing) - count(*) filter (where is_whiff))::double precision
    / nullif(count(*) filter (where is_swing),0) as contact_rate,
  count(*)::double precision / nullif(count(distinct (game_pk, at_bat_number)),0) as pitches_per_pa,
  max(ingested_at) as refreshed_at
from public.mlb_statcast_classified_v
where batting_team is not null
group by game_year, batting_team
with data;

create unique index if not exists mlb_statcast_team_batting_season_summary_mv_uidx
  on public.mlb_statcast_team_batting_season_summary_mv (season, team);

create materialized view if not exists public.mlb_statcast_team_pitching_season_summary_mv as
select
  game_year as season,
  fielding_team as team,
  count(distinct game_pk)::int as games,
  count(*)::int as total_pitches,
  count(distinct (game_pk, at_bat_number))::int as plate_appearances,
  count(*) filter (where is_strikeout)::int as strikeouts,
  count(*) filter (where is_walk or is_intentional_walk)::int as walks,
  count(*) filter (where is_hit)::int as hits,
  count(*) filter (where is_home_run)::int as home_runs,
  count(*) filter (where is_ball)::int as balls,
  count(*) filter (where is_strike)::int as strikes,
  count(*) filter (where is_in_play)::int as in_play,
  count(*) filter (where is_called_strike)::int as called_strikes,
  count(*) filter (where is_whiff)::int as whiffs,
  count(*) filter (where is_swing)::int as swings,
  count(*) filter (where is_zone)::int as zone_pitches,
  count(*) filter (where is_outside_zone)::int as outside_zone_pitches,
  count(*) filter (where is_chase)::int as chases,
  count(*) filter (where is_batted_ball)::int as batted_balls,
  count(*) filter (where is_hard_hit)::int as hard_hits,
  count(*) filter (where is_barrel)::int as barrels,
  avg(launch_speed) as avg_exit_velocity,
  avg(launch_angle) as avg_launch_angle,
  count(*) filter (where is_ball)::double precision / nullif(count(*),0) as ball_rate,
  count(*) filter (where is_strike)::double precision / nullif(count(*),0) as strike_rate,
  count(*) filter (where is_in_play)::double precision / nullif(count(*),0) as in_play_rate,
  (count(*) filter (where is_called_strike) + count(*) filter (where is_whiff))::double precision
    / nullif(count(*),0) as csw_rate,
  count(*) filter (where is_whiff)::double precision
    / nullif(count(*) filter (where is_swing),0) as whiff_rate,
  count(*) filter (where is_chase)::double precision
    / nullif(count(*) filter (where is_outside_zone),0) as chase_rate,
  count(*) filter (where is_zone)::double precision
    / nullif(count(*) filter (where zone is not null),0) as zone_rate,
  (count(*) filter (where is_swing) - count(*) filter (where is_whiff))::double precision
    / nullif(count(*) filter (where is_swing),0) as contact_rate,
  max(ingested_at) as refreshed_at
from public.mlb_statcast_classified_v
where fielding_team is not null
group by game_year, fielding_team
with data;

create unique index if not exists mlb_statcast_team_pitching_season_summary_mv_uidx
  on public.mlb_statcast_team_pitching_season_summary_mv (season, team);

revoke all on public.mlb_statcast_team_batting_season_summary_mv from public, anon, authenticated;
revoke all on public.mlb_statcast_team_pitching_season_summary_mv from public, anon, authenticated;
grant select on public.mlb_statcast_team_batting_season_summary_mv to service_role;
grant select on public.mlb_statcast_team_pitching_season_summary_mv to service_role;

create or replace view public.mlb_statcast_team_batting_season_summary
with (security_invoker = true) as
select * from public.mlb_statcast_team_batting_season_summary_mv;

create or replace view public.mlb_statcast_team_pitching_season_summary
with (security_invoker = true) as
select * from public.mlb_statcast_team_pitching_season_summary_mv;

revoke all on public.mlb_statcast_team_batting_season_summary from public, anon, authenticated;
revoke all on public.mlb_statcast_team_pitching_season_summary from public, anon, authenticated;
grant select on public.mlb_statcast_team_batting_season_summary to service_role;
grant select on public.mlb_statcast_team_pitching_season_summary to service_role;

create or replace function public.refresh_mlb_statcast_runtime_rollups()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  refresh materialized view public.mlb_statcast_coverage_mv;
  refresh materialized view public.mlb_statcast_team_batting_season_summary_mv;
  refresh materialized view public.mlb_statcast_team_pitching_season_summary_mv;
end;
$$;

revoke all on function public.refresh_mlb_statcast_runtime_rollups() from public, anon, authenticated;
grant execute on function public.refresh_mlb_statcast_runtime_rollups() to service_role;
