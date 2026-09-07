create or replace view public.mlb_statcast_pitcher_season_summary
with (security_invoker = true) as
select
  game_year as season,
  pitcher,
  max(player_name) as player_name,
  max(p_throws) as p_throws,
  count(distinct game_pk)::int as games,
  count(*)::int as total_pitches,
  count(distinct (game_pk, at_bat_number))::int as plate_appearances,
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
  count(*) filter (where is_first_pitch_strike)::double precision
    / nullif(count(*) filter (where is_first_pitch),0) as first_pitch_strike_rate,
  count(*)::double precision / nullif(count(distinct (game_pk, at_bat_number)),0) as pitches_per_pa,
  max(ingested_at) as refreshed_at
from public.mlb_statcast_classified_v
where pitcher is not null
group by game_year, pitcher;

create or replace view public.mlb_statcast_batter_season_summary
with (security_invoker = true) as
select
  game_year as season,
  batter,
  max(stand) as stand,
  count(distinct game_pk)::int as games,
  count(*)::int as pitches_seen,
  count(distinct (game_pk, at_bat_number))::int as plate_appearances,
  count(*) filter (where is_strikeout)::int as strikeouts,
  count(*) filter (where is_walk)::int as walks,
  count(*) filter (where is_intentional_walk)::int as intentional_walks,
  count(*) filter (where is_hit)::int as hits,
  count(*) filter (where is_single)::int as singles,
  count(*) filter (where is_double)::int as doubles,
  count(*) filter (where is_triple)::int as triples,
  count(*) filter (where is_home_run)::int as home_runs,
  count(*) filter (where is_hit_by_pitch)::int as hit_by_pitch,
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
where batter is not null
group by game_year, batter;

create or replace view public.mlb_statcast_pitcher_pitch_type_summary
with (security_invoker = true) as
select
  game_year as season,
  pitcher,
  pitch_type,
  max(pitch_name) as pitch_name,
  max(p_throws) as p_throws,
  count(*)::int as total_pitches,
  count(*)::double precision
    / nullif(sum(count(*)) over (partition by game_year, pitcher),0) as usage_rate,
  avg(release_speed) as avg_release_speed,
  max(release_speed) as max_release_speed,
  avg(release_spin_rate) as avg_spin_rate,
  avg(release_extension) as avg_extension,
  avg(pfx_x) as avg_pfx_x,
  avg(pfx_z) as avg_pfx_z,
  count(*) filter (where is_zone)::double precision
    / nullif(count(*) filter (where zone is not null),0) as zone_rate,
  count(*) filter (where is_whiff)::double precision
    / nullif(count(*) filter (where is_swing),0) as whiff_rate,
  count(*) filter (where is_chase)::double precision
    / nullif(count(*) filter (where is_outside_zone),0) as chase_rate,
  count(*) filter (where is_in_play)::double precision / nullif(count(*),0) as in_play_rate,
  count(*) filter (where is_batted_ball)::int as batted_balls,
  avg(launch_speed) as avg_exit_velocity,
  avg(launch_angle) as avg_launch_angle,
  avg(estimated_ba_using_speedangle) as avg_xba,
  avg(estimated_woba_using_speedangle) as avg_xwoba,
  max(ingested_at) as refreshed_at
from public.mlb_statcast_classified_v
where pitcher is not null and pitch_type is not null
group by game_year, pitcher, pitch_type;

create or replace view public.mlb_statcast_team_batting_season_summary
with (security_invoker = true) as
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
group by game_year, batting_team;

create or replace view public.mlb_statcast_team_pitching_season_summary
with (security_invoker = true) as
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
group by game_year, fielding_team;

revoke all on public.mlb_statcast_pitcher_season_summary from anon, authenticated;
revoke all on public.mlb_statcast_batter_season_summary from anon, authenticated;
revoke all on public.mlb_statcast_pitcher_pitch_type_summary from anon, authenticated;
revoke all on public.mlb_statcast_team_batting_season_summary from anon, authenticated;
revoke all on public.mlb_statcast_team_pitching_season_summary from anon, authenticated;

grant select on public.mlb_statcast_pitcher_season_summary to service_role;
grant select on public.mlb_statcast_batter_season_summary to service_role;
grant select on public.mlb_statcast_pitcher_pitch_type_summary to service_role;
grant select on public.mlb_statcast_team_batting_season_summary to service_role;
grant select on public.mlb_statcast_team_pitching_season_summary to service_role;
