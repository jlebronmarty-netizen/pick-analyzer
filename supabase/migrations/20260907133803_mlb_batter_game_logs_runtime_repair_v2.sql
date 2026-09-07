-- Repair the batter-game runtime materialization so refreshes read canonical
-- Statcast instead of self-copying through the compatibility view.

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
  count(*) filter (where is_whiff)::double precision / nullif(count(*) filter (where is_swing),0) as whiff_rate,
  count(*) filter (where is_chase)::double precision / nullif(count(*) filter (where is_outside_zone),0) as chase_rate,
  count(*) filter (where is_zone)::double precision / nullif(count(*) filter (where zone is not null),0) as zone_rate,
  (count(*) filter (where is_swing) - count(*) filter (where is_whiff))::double precision / nullif(count(*) filter (where is_swing),0) as contact_rate,
  max(ingested_at) as refreshed_at
from public.mlb_statcast_classified_v
where batter is not null
group by game_year, game_pk, batter;

revoke all on public.mlb_statcast_batter_game_logs from public, anon, authenticated;
grant select on public.mlb_statcast_batter_game_logs to service_role;

drop materialized view if exists public.mlb_statcast_batter_game_logs_mv;

create materialized view public.mlb_statcast_batter_game_logs_mv as
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
  count(*) filter (where is_whiff)::double precision / nullif(count(*) filter (where is_swing),0) as whiff_rate,
  count(*) filter (where is_chase)::double precision / nullif(count(*) filter (where is_outside_zone),0) as chase_rate,
  count(*) filter (where is_zone)::double precision / nullif(count(*) filter (where zone is not null),0) as zone_rate,
  (count(*) filter (where is_swing) - count(*) filter (where is_whiff))::double precision / nullif(count(*) filter (where is_swing),0) as contact_rate,
  max(ingested_at) as refreshed_at
from public.mlb_statcast_classified_v
where batter is not null
group by game_year, game_pk, batter
with data;

create unique index mlb_statcast_batter_game_logs_mv_uidx
  on public.mlb_statcast_batter_game_logs_mv (season, game_pk, batter);
create index mlb_statcast_batter_game_logs_mv_batter_date_idx
  on public.mlb_statcast_batter_game_logs_mv (season, batter, game_date desc, game_pk);

revoke all on public.mlb_statcast_batter_game_logs_mv from public, anon, authenticated;
grant select on public.mlb_statcast_batter_game_logs_mv to service_role;

create or replace view public.mlb_statcast_batter_game_logs
with (security_invoker = true) as
select * from public.mlb_statcast_batter_game_logs_mv;

revoke all on public.mlb_statcast_batter_game_logs from public, anon, authenticated;
grant select on public.mlb_statcast_batter_game_logs to service_role;

create or replace function public.refresh_mlb_statcast_batter_runtime_rollups()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  refresh materialized view public.mlb_statcast_batter_game_logs_mv;
end;
$$;

revoke all on function public.refresh_mlb_statcast_batter_runtime_rollups() from public, anon, authenticated;
grant execute on function public.refresh_mlb_statcast_batter_runtime_rollups() to service_role;

create or replace function public.refresh_mlb_statcast_all_analytics()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.refresh_mlb_statcast_pitcher_game_logs_mv();
  perform public.refresh_mlb_statcast_batter_runtime_rollups();
  perform public.refresh_mlb_statcast_runtime_rollups();
  perform public.refresh_mlb_statcast_matchup_rollups();
  if to_regprocedure('public.refresh_mlb_statcast_batter_prop_rollups()') is not null then
    execute 'select public.refresh_mlb_statcast_batter_prop_rollups()';
  end if;
  if to_regprocedure('public.refresh_mlb_nrfi_research_rollups()') is not null then
    execute 'select public.refresh_mlb_nrfi_research_rollups()';
  end if;
end;
$$;

revoke all on function public.refresh_mlb_statcast_all_analytics() from public, anon, authenticated;
grant execute on function public.refresh_mlb_statcast_all_analytics() to service_role;
