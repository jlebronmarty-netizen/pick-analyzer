create or replace view public.mlb_statcast_pitcher_hand_split_summary
with (security_invoker = true) as
select
  game_year as season,
  pitcher,
  stand as batter_stand,
  max(player_name) as player_name,
  max(p_throws) as p_throws,
  count(distinct game_pk)::int as games,
  min(game_date) as first_game_date,
  max(game_date) as last_game_date,
  count(*)::int as total_pitches,
  count(distinct (game_pk, at_bat_number))::int as plate_appearances,
  count(*) filter (where is_strikeout)::int as strikeouts,
  count(*) filter (where is_walk)::int as walks,
  count(*) filter (where is_intentional_walk)::int as intentional_walks,
  count(*) filter (where is_hit)::int as hits,
  count(*) filter (where is_home_run)::int as home_runs,
  count(*) filter (where is_whiff)::int as whiffs,
  count(*) filter (where is_swing)::int as swings,
  count(*) filter (where is_chase)::int as chases,
  count(*) filter (where is_outside_zone)::int as outside_zone_pitches,
  count(*) filter (where is_zone)::int as zone_pitches,
  count(*) filter (where is_batted_ball)::int as batted_balls,
  count(*) filter (where is_hard_hit)::int as hard_hits,
  count(*) filter (where is_barrel)::int as barrels,
  avg(release_speed) as avg_release_speed,
  avg(launch_speed) as avg_exit_velocity,
  avg(launch_angle) as avg_launch_angle,
  avg(estimated_ba_using_speedangle) as avg_xba,
  avg(estimated_woba_using_speedangle) as avg_xwoba,
  count(*) filter (where is_strikeout)::double precision / nullif(count(distinct (game_pk, at_bat_number)),0) as strikeout_rate,
  (count(*) filter (where is_walk) + count(*) filter (where is_intentional_walk))::double precision / nullif(count(distinct (game_pk, at_bat_number)),0) as walk_rate,
  count(*) filter (where is_whiff)::double precision / nullif(count(*) filter (where is_swing),0) as whiff_rate,
  count(*) filter (where is_chase)::double precision / nullif(count(*) filter (where is_outside_zone),0) as chase_rate,
  count(*) filter (where is_zone)::double precision / nullif(count(*) filter (where zone is not null),0) as zone_rate,
  (count(*) filter (where is_swing) - count(*) filter (where is_whiff))::double precision / nullif(count(*) filter (where is_swing),0) as contact_rate,
  count(*) filter (where is_hard_hit)::double precision / nullif(count(*) filter (where is_batted_ball),0) as hard_hit_rate,
  count(*) filter (where is_barrel)::double precision / nullif(count(*) filter (where is_batted_ball),0) as barrel_rate,
  max(ingested_at) as refreshed_at
from public.mlb_statcast_classified_v
where pitcher is not null and stand in ('L','R')
group by game_year, pitcher, stand;

create or replace view public.mlb_statcast_batter_hand_split_summary
with (security_invoker = true) as
select
  game_year as season,
  batter,
  p_throws as pitcher_throws,
  max(stand) as batter_stand,
  count(distinct game_pk)::int as games,
  min(game_date) as first_game_date,
  max(game_date) as last_game_date,
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
  count(*) filter (where is_whiff)::int as whiffs,
  count(*) filter (where is_swing)::int as swings,
  count(*) filter (where is_chase)::int as chases,
  count(*) filter (where is_outside_zone)::int as outside_zone_pitches,
  count(*) filter (where is_zone)::int as zone_pitches,
  count(*) filter (where is_batted_ball)::int as batted_balls,
  count(*) filter (where is_hard_hit)::int as hard_hits,
  count(*) filter (where is_barrel)::int as barrels,
  avg(launch_speed) as avg_exit_velocity,
  avg(launch_angle) as avg_launch_angle,
  avg(estimated_ba_using_speedangle) as avg_xba,
  avg(estimated_woba_using_speedangle) as avg_xwoba,
  count(*) filter (where is_strikeout)::double precision / nullif(count(distinct (game_pk, at_bat_number)),0) as strikeout_rate,
  (count(*) filter (where is_walk) + count(*) filter (where is_intentional_walk))::double precision / nullif(count(distinct (game_pk, at_bat_number)),0) as walk_rate,
  count(*) filter (where is_whiff)::double precision / nullif(count(*) filter (where is_swing),0) as whiff_rate,
  count(*) filter (where is_chase)::double precision / nullif(count(*) filter (where is_outside_zone),0) as chase_rate,
  count(*) filter (where is_zone)::double precision / nullif(count(*) filter (where zone is not null),0) as zone_rate,
  (count(*) filter (where is_swing) - count(*) filter (where is_whiff))::double precision / nullif(count(*) filter (where is_swing),0) as contact_rate,
  count(*) filter (where is_hard_hit)::double precision / nullif(count(*) filter (where is_batted_ball),0) as hard_hit_rate,
  count(*) filter (where is_barrel)::double precision / nullif(count(*) filter (where is_batted_ball),0) as barrel_rate,
  max(ingested_at) as refreshed_at
from public.mlb_statcast_classified_v
where batter is not null and p_throws in ('L','R')
group by game_year, batter, p_throws;

create or replace view public.mlb_statcast_pitcher_vs_team_summary
with (security_invoker = true) as
select
  game_year as season,
  pitcher,
  batting_team as opponent_team,
  max(player_name) as player_name,
  max(p_throws) as p_throws,
  count(distinct game_pk)::int as games,
  min(game_date) as first_game_date,
  max(game_date) as last_game_date,
  count(*)::int as total_pitches,
  count(distinct (game_pk, at_bat_number))::int as plate_appearances,
  count(*) filter (where is_strikeout)::int as strikeouts,
  count(*) filter (where is_walk)::int as walks,
  count(*) filter (where is_intentional_walk)::int as intentional_walks,
  count(*) filter (where is_hit)::int as hits,
  count(*) filter (where is_home_run)::int as home_runs,
  count(*) filter (where is_whiff)::int as whiffs,
  count(*) filter (where is_swing)::int as swings,
  count(*) filter (where is_chase)::int as chases,
  count(*) filter (where is_outside_zone)::int as outside_zone_pitches,
  count(*) filter (where is_batted_ball)::int as batted_balls,
  count(*) filter (where is_hard_hit)::int as hard_hits,
  count(*) filter (where is_barrel)::int as barrels,
  avg(launch_speed) as avg_exit_velocity,
  avg(launch_angle) as avg_launch_angle,
  avg(estimated_ba_using_speedangle) as avg_xba,
  avg(estimated_woba_using_speedangle) as avg_xwoba,
  count(*) filter (where is_strikeout)::double precision / nullif(count(distinct (game_pk, at_bat_number)),0) as strikeout_rate,
  (count(*) filter (where is_walk) + count(*) filter (where is_intentional_walk))::double precision / nullif(count(distinct (game_pk, at_bat_number)),0) as walk_rate,
  count(*) filter (where is_whiff)::double precision / nullif(count(*) filter (where is_swing),0) as whiff_rate,
  count(*) filter (where is_chase)::double precision / nullif(count(*) filter (where is_outside_zone),0) as chase_rate,
  count(*) filter (where is_hard_hit)::double precision / nullif(count(*) filter (where is_batted_ball),0) as hard_hit_rate,
  count(*) filter (where is_barrel)::double precision / nullif(count(*) filter (where is_batted_ball),0) as barrel_rate,
  max(ingested_at) as refreshed_at
from public.mlb_statcast_classified_v
where pitcher is not null and batting_team is not null
group by game_year, pitcher, batting_team;

create or replace view public.mlb_statcast_batter_pitch_type_summary
with (security_invoker = true) as
select
  game_year as season,
  batter,
  p_throws as pitcher_throws,
  pitch_type,
  max(pitch_name) as pitch_name,
  max(stand) as batter_stand,
  count(distinct game_pk)::int as games,
  count(*)::int as pitches_seen,
  count(distinct (game_pk, at_bat_number))::int as plate_appearances_seen,
  count(*) filter (where is_strikeout)::int as terminal_strikeouts,
  count(*) filter (where is_hit)::int as terminal_hits,
  count(*) filter (where is_home_run)::int as terminal_home_runs,
  count(*) filter (where is_whiff)::int as whiffs,
  count(*) filter (where is_swing)::int as swings,
  count(*) filter (where is_chase)::int as chases,
  count(*) filter (where is_outside_zone)::int as outside_zone_pitches,
  count(*) filter (where is_zone)::int as zone_pitches,
  count(*) filter (where is_batted_ball)::int as batted_balls,
  count(*) filter (where is_hard_hit)::int as hard_hits,
  count(*) filter (where is_barrel)::int as barrels,
  avg(launch_speed) as avg_exit_velocity,
  avg(launch_angle) as avg_launch_angle,
  avg(estimated_ba_using_speedangle) as avg_xba,
  avg(estimated_woba_using_speedangle) as avg_xwoba,
  count(*) filter (where is_whiff)::double precision / nullif(count(*) filter (where is_swing),0) as whiff_rate,
  count(*) filter (where is_chase)::double precision / nullif(count(*) filter (where is_outside_zone),0) as chase_rate,
  count(*) filter (where is_zone)::double precision / nullif(count(*) filter (where zone is not null),0) as zone_rate,
  (count(*) filter (where is_swing) - count(*) filter (where is_whiff))::double precision / nullif(count(*) filter (where is_swing),0) as contact_rate,
  count(*) filter (where is_hard_hit)::double precision / nullif(count(*) filter (where is_batted_ball),0) as hard_hit_rate,
  count(*) filter (where is_barrel)::double precision / nullif(count(*) filter (where is_batted_ball),0) as barrel_rate,
  max(ingested_at) as refreshed_at
from public.mlb_statcast_classified_v
where batter is not null and p_throws in ('L','R') and pitch_type is not null
group by game_year, batter, p_throws, pitch_type;

create or replace view public.mlb_statcast_team_vs_pitch_type_summary
with (security_invoker = true) as
select
  game_year as season,
  batting_team as team,
  p_throws as pitcher_throws,
  pitch_type,
  max(pitch_name) as pitch_name,
  count(distinct game_pk)::int as games,
  count(*)::int as pitches_seen,
  count(distinct (game_pk, at_bat_number))::int as plate_appearances_seen,
  count(*) filter (where is_strikeout)::int as terminal_strikeouts,
  count(*) filter (where is_hit)::int as terminal_hits,
  count(*) filter (where is_home_run)::int as terminal_home_runs,
  count(*) filter (where is_whiff)::int as whiffs,
  count(*) filter (where is_swing)::int as swings,
  count(*) filter (where is_chase)::int as chases,
  count(*) filter (where is_outside_zone)::int as outside_zone_pitches,
  count(*) filter (where is_zone)::int as zone_pitches,
  count(*) filter (where is_batted_ball)::int as batted_balls,
  count(*) filter (where is_hard_hit)::int as hard_hits,
  count(*) filter (where is_barrel)::int as barrels,
  avg(launch_speed) as avg_exit_velocity,
  avg(launch_angle) as avg_launch_angle,
  avg(estimated_ba_using_speedangle) as avg_xba,
  avg(estimated_woba_using_speedangle) as avg_xwoba,
  count(*) filter (where is_whiff)::double precision / nullif(count(*) filter (where is_swing),0) as whiff_rate,
  count(*) filter (where is_chase)::double precision / nullif(count(*) filter (where is_outside_zone),0) as chase_rate,
  count(*) filter (where is_zone)::double precision / nullif(count(*) filter (where zone is not null),0) as zone_rate,
  (count(*) filter (where is_swing) - count(*) filter (where is_whiff))::double precision / nullif(count(*) filter (where is_swing),0) as contact_rate,
  count(*) filter (where is_hard_hit)::double precision / nullif(count(*) filter (where is_batted_ball),0) as hard_hit_rate,
  count(*) filter (where is_barrel)::double precision / nullif(count(*) filter (where is_batted_ball),0) as barrel_rate,
  max(ingested_at) as refreshed_at
from public.mlb_statcast_classified_v
where batting_team is not null and p_throws in ('L','R') and pitch_type is not null
group by game_year, batting_team, p_throws, pitch_type;

create or replace view public.mlb_statcast_league_pitch_type_summary
with (security_invoker = true) as
select
  game_year as season,
  p_throws as pitcher_throws,
  pitch_type,
  max(pitch_name) as pitch_name,
  count(*)::int as total_pitches,
  count(distinct (game_pk, at_bat_number))::int as plate_appearances_seen,
  count(*) filter (where is_whiff)::int as whiffs,
  count(*) filter (where is_swing)::int as swings,
  count(*) filter (where is_chase)::int as chases,
  count(*) filter (where is_outside_zone)::int as outside_zone_pitches,
  count(*) filter (where is_zone)::int as zone_pitches,
  count(*) filter (where is_batted_ball)::int as batted_balls,
  count(*) filter (where is_hard_hit)::int as hard_hits,
  count(*) filter (where is_barrel)::int as barrels,
  avg(launch_speed) as avg_exit_velocity,
  avg(launch_angle) as avg_launch_angle,
  avg(estimated_ba_using_speedangle) as avg_xba,
  avg(estimated_woba_using_speedangle) as avg_xwoba,
  count(*) filter (where is_whiff)::double precision / nullif(count(*) filter (where is_swing),0) as whiff_rate,
  count(*) filter (where is_chase)::double precision / nullif(count(*) filter (where is_outside_zone),0) as chase_rate,
  count(*) filter (where is_zone)::double precision / nullif(count(*) filter (where zone is not null),0) as zone_rate,
  (count(*) filter (where is_swing) - count(*) filter (where is_whiff))::double precision / nullif(count(*) filter (where is_swing),0) as contact_rate,
  count(*) filter (where is_hard_hit)::double precision / nullif(count(*) filter (where is_batted_ball),0) as hard_hit_rate,
  count(*) filter (where is_barrel)::double precision / nullif(count(*) filter (where is_batted_ball),0) as barrel_rate,
  max(ingested_at) as refreshed_at
from public.mlb_statcast_classified_v
where p_throws in ('L','R') and pitch_type is not null
group by game_year, p_throws, pitch_type;

create or replace view public.mlb_statcast_pitcher_batter_summary
with (security_invoker = true) as
select
  game_year as season,
  pitcher,
  batter,
  max(player_name) as pitcher_name,
  max(p_throws) as p_throws,
  max(stand) as batter_stand,
  count(distinct game_pk)::int as games,
  min(game_date) as first_game_date,
  max(game_date) as last_game_date,
  count(*)::int as total_pitches,
  count(distinct (game_pk, at_bat_number))::int as plate_appearances,
  count(*) filter (where is_strikeout)::int as strikeouts,
  count(*) filter (where is_walk)::int as walks,
  count(*) filter (where is_intentional_walk)::int as intentional_walks,
  count(*) filter (where is_hit)::int as hits,
  count(*) filter (where is_home_run)::int as home_runs,
  count(*) filter (where is_whiff)::int as whiffs,
  count(*) filter (where is_swing)::int as swings,
  count(*) filter (where is_chase)::int as chases,
  count(*) filter (where is_outside_zone)::int as outside_zone_pitches,
  count(*) filter (where is_batted_ball)::int as batted_balls,
  count(*) filter (where is_hard_hit)::int as hard_hits,
  count(*) filter (where is_barrel)::int as barrels,
  avg(launch_speed) as avg_exit_velocity,
  avg(launch_angle) as avg_launch_angle,
  avg(estimated_ba_using_speedangle) as avg_xba,
  avg(estimated_woba_using_speedangle) as avg_xwoba,
  count(*) filter (where is_strikeout)::double precision / nullif(count(distinct (game_pk, at_bat_number)),0) as strikeout_rate,
  (count(*) filter (where is_walk) + count(*) filter (where is_intentional_walk))::double precision / nullif(count(distinct (game_pk, at_bat_number)),0) as walk_rate,
  count(*) filter (where is_whiff)::double precision / nullif(count(*) filter (where is_swing),0) as whiff_rate,
  count(*) filter (where is_chase)::double precision / nullif(count(*) filter (where is_outside_zone),0) as chase_rate,
  count(*) filter (where is_hard_hit)::double precision / nullif(count(*) filter (where is_batted_ball),0) as hard_hit_rate,
  count(*) filter (where is_barrel)::double precision / nullif(count(*) filter (where is_batted_ball),0) as barrel_rate,
  max(ingested_at) as refreshed_at
from public.mlb_statcast_classified_v
where pitcher is not null and batter is not null
group by game_year, pitcher, batter;

revoke all on public.mlb_statcast_pitcher_hand_split_summary from anon, authenticated;
revoke all on public.mlb_statcast_batter_hand_split_summary from anon, authenticated;
revoke all on public.mlb_statcast_pitcher_vs_team_summary from anon, authenticated;
revoke all on public.mlb_statcast_batter_pitch_type_summary from anon, authenticated;
revoke all on public.mlb_statcast_team_vs_pitch_type_summary from anon, authenticated;
revoke all on public.mlb_statcast_league_pitch_type_summary from anon, authenticated;
revoke all on public.mlb_statcast_pitcher_batter_summary from anon, authenticated;

grant select on public.mlb_statcast_pitcher_hand_split_summary to service_role;
grant select on public.mlb_statcast_batter_hand_split_summary to service_role;
grant select on public.mlb_statcast_pitcher_vs_team_summary to service_role;
grant select on public.mlb_statcast_batter_pitch_type_summary to service_role;
grant select on public.mlb_statcast_team_vs_pitch_type_summary to service_role;
grant select on public.mlb_statcast_league_pitch_type_summary to service_role;
grant select on public.mlb_statcast_pitcher_batter_summary to service_role;
