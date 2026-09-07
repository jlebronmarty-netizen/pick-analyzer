create or replace view public.mlb_statcast_classified_v
with (security_invoker = true) as
select
  p.*,
  coalesce(p.mlbam_pitcher_id, p.source_pitcher_id) as pitcher,
  coalesce(p.mlbam_batter_id, p.source_batter_id) as batter,
  p.source_player_name as player_name,
  case
    when p.inning_topbot = 'Top' then p.source_away_team
    when p.inning_topbot = 'Bot' then p.source_home_team
    else null
  end as batting_team,
  case
    when p.inning_topbot = 'Top' then p.source_home_team
    when p.inning_topbot = 'Bot' then p.source_away_team
    else null
  end as fielding_team,
  (p."type" = 'B') as is_ball,
  (p."type" = 'S') as is_strike,
  (p."type" = 'X') as is_in_play,
  (p.description = 'called_strike') as is_called_strike,
  (p.description in ('swinging_strike','swinging_strike_blocked','missed_bunt')) as is_whiff,
  (p.description in (
    'swinging_strike','swinging_strike_blocked','missed_bunt',
    'foul','foul_bunt','foul_tip',
    'hit_into_play','hit_into_play_no_out','hit_into_play_score'
  )) as is_swing,
  (p.zone between 1 and 9) as is_zone,
  (p.zone is not null and not (p.zone between 1 and 9)) as is_outside_zone,
  (
    p.zone is not null
    and not (p.zone between 1 and 9)
    and p.description in (
      'swinging_strike','swinging_strike_blocked','missed_bunt',
      'foul','foul_bunt','foul_tip',
      'hit_into_play','hit_into_play_no_out','hit_into_play_score'
    )
  ) as is_chase,
  (p.pitch_number = 1) as is_first_pitch,
  (p.pitch_number = 1 and p."type" in ('S','X')) as is_first_pitch_strike,
  (p.launch_speed is not null) as is_batted_ball,
  (p.launch_speed >= 95) as is_hard_hit,
  (p.launch_speed_angle = 6) as is_barrel,
  (p.events in ('strikeout','strikeout_double_play')) as is_strikeout,
  (p.events = 'walk') as is_walk,
  (p.events = 'intent_walk') as is_intentional_walk,
  (p.events in ('single','double','triple','home_run')) as is_hit,
  (p.events = 'single') as is_single,
  (p.events = 'double') as is_double,
  (p.events = 'triple') as is_triple,
  (p.events = 'home_run') as is_home_run,
  (p.events = 'hit_by_pitch') as is_hit_by_pitch
from public.pick2_raw_mlb_statcast_pitches p;

create or replace view public.mlb_statcast_coverage_v
with (security_invoker = true) as
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
  end)::bigint as batting_teams
from public.pick2_raw_mlb_statcast_pitches
where game_year is not null
group by game_year;

create or replace view public.mlb_statcast_pitcher_game_logs
with (security_invoker = true) as
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
  max(ingested_at) as refreshed_at
from public.mlb_statcast_classified_v
where pitcher is not null
group by game_year, game_pk, pitcher;

create or replace view public.mlb_statcast_batter_game_logs
with (security_invoker = true) as
select
  game_year as season,
  game_pk,
  min(game_date) as game_date,
  batter,
  max(batting_team) as batting_team,
  max(fielding_team) as opponent_team,
  max(stand) as stand,
  count(*)::int as pitches_seen,
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
  max(ingested_at) as refreshed_at
from public.mlb_statcast_classified_v
where batter is not null
group by game_year, game_pk, batter;

revoke all on public.mlb_statcast_classified_v from anon, authenticated;
revoke all on public.mlb_statcast_coverage_v from anon, authenticated;
revoke all on public.mlb_statcast_pitcher_game_logs from anon, authenticated;
revoke all on public.mlb_statcast_batter_game_logs from anon, authenticated;

grant select on public.mlb_statcast_classified_v to service_role;
grant select on public.mlb_statcast_coverage_v to service_role;
grant select on public.mlb_statcast_pitcher_game_logs to service_role;
grant select on public.mlb_statcast_batter_game_logs to service_role;
