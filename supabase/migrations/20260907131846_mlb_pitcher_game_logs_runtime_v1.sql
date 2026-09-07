-- MLB pitcher game-log runtime materialization V1.
-- Reproduces the production runtime surface while preserving the public view contract.

create materialized view if not exists public.mlb_statcast_pitcher_game_logs_mv as
select
  game_year as season,
  game_pk,
  min(game_date) as game_date,
  pitcher,
  max(player_name) as player_name,
  max(fielding_team) as pitching_team,
  max(batting_team) as opponent_team,
  max(p_throws) as p_throws,
  count(*)::int as total_pitches,
  count(distinct (game_pk,at_bat_number))::int as plate_appearances,
  count(*) filter (where is_strikeout)::int as strikeouts,
  count(*) filter (where is_walk)::int as walks,
  count(*) filter (where is_intentional_walk)::int as intentional_walks,
  count(*) filter (where is_hit)::int as hits,
  count(*) filter (where is_home_run)::int as home_runs,
  count(*) filter (where is_hit_by_pitch)::int as hit_by_pitch,
  count(*) filter (where is_ball)::int as balls,
  count(*) filter (where is_strike)::int as strikes,
  count(*) filter (where is_in_play)::int as in_play,
  count(*) filter (where is_called_strike)::int as called_strikes,
  count(*) filter (where is_whiff)::int as whiffs,
  count(*) filter (where is_swing)::int as swings,
  count(*) filter (where is_zone)::int as zone_pitches,
  count(*) filter (where is_outside_zone)::int as outside_zone_pitches,
  count(*) filter (where is_chase)::int as chases,
  count(*) filter (where is_first_pitch)::int as first_pitches,
  count(*) filter (where is_first_pitch_strike)::int as first_pitch_strikes,
  count(*) filter (where is_batted_ball)::int as batted_balls,
  count(*) filter (where is_hard_hit)::int as hard_hits,
  count(*) filter (where is_barrel)::int as barrels,
  avg(launch_speed) as avg_exit_velocity,
  avg(launch_angle) as avg_launch_angle,
  avg(release_speed) as avg_release_speed,
  max(release_speed) as max_release_speed,
  count(*) filter (where is_ball)::double precision/nullif(count(*),0) as ball_rate,
  count(*) filter (where is_strike)::double precision/nullif(count(*),0) as strike_rate,
  count(*) filter (where is_in_play)::double precision/nullif(count(*),0) as in_play_rate,
  (count(*) filter (where is_called_strike)+count(*) filter (where is_whiff))::double precision/nullif(count(*),0) as csw_rate,
  count(*) filter (where is_whiff)::double precision/nullif(count(*) filter (where is_swing),0) as whiff_rate,
  count(*) filter (where is_chase)::double precision/nullif(count(*) filter (where is_outside_zone),0) as chase_rate,
  count(*) filter (where is_zone)::double precision/nullif(count(*) filter (where zone is not null),0) as zone_rate,
  (count(*) filter (where is_swing)-count(*) filter (where is_whiff))::double precision/nullif(count(*) filter (where is_swing),0) as contact_rate,
  count(*) filter (where is_first_pitch_strike)::double precision/nullif(count(*) filter (where is_first_pitch),0) as first_pitch_strike_rate,
  max(ingested_at) as refreshed_at
from public.mlb_statcast_classified_v
where pitcher is not null
group by game_year,game_pk,pitcher
with data;

create unique index if not exists mlb_statcast_pitcher_game_logs_mv_uidx
  on public.mlb_statcast_pitcher_game_logs_mv(season,game_pk,pitcher);
create index if not exists mlb_statcast_pitcher_game_logs_mv_pitcher_date_idx
  on public.mlb_statcast_pitcher_game_logs_mv(season,pitcher,game_date desc,game_pk);
create index if not exists mlb_statcast_pitcher_game_logs_mv_workload_idx
  on public.mlb_statcast_pitcher_game_logs_mv(season,total_pitches,game_date,game_pk);

revoke all on public.mlb_statcast_pitcher_game_logs_mv from public,anon,authenticated;
grant select on public.mlb_statcast_pitcher_game_logs_mv to service_role;

create or replace function public.refresh_mlb_statcast_pitcher_game_logs_mv()
returns void language plpgsql security definer set search_path=public as $$
begin
  refresh materialized view public.mlb_statcast_pitcher_game_logs_mv;
end;
$$;
revoke all on function public.refresh_mlb_statcast_pitcher_game_logs_mv() from public,anon,authenticated;
grant execute on function public.refresh_mlb_statcast_pitcher_game_logs_mv() to service_role;