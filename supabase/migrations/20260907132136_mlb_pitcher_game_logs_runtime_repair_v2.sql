-- MLB pitcher game-log runtime repair V2.
-- Preserve the original view contract while reading from the materialized runtime surface.

create or replace view public.mlb_statcast_pitcher_game_logs
with (security_invoker = true) as
select
  season,game_pk,game_date,pitcher,player_name,pitching_team,opponent_team,p_throws,
  total_pitches,plate_appearances,strikeouts,walks,intentional_walks,hits,home_runs,hit_by_pitch,
  balls,strikes,in_play,called_strikes,whiffs,swings,zone_pitches,outside_zone_pitches,chases,
  first_pitches,first_pitch_strikes,batted_balls,hard_hits,barrels,
  avg_exit_velocity,avg_launch_angle,avg_release_speed,max_release_speed,
  ball_rate,strike_rate,in_play_rate,csw_rate,whiff_rate,chase_rate,zone_rate,contact_rate,
  first_pitch_strike_rate,refreshed_at
from public.mlb_statcast_pitcher_game_logs_mv;

revoke all on public.mlb_statcast_pitcher_game_logs from public,anon,authenticated;
grant select on public.mlb_statcast_pitcher_game_logs to service_role;

create or replace function public.refresh_mlb_statcast_all_analytics()
returns void language plpgsql security definer set search_path=public as $$
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
revoke all on function public.refresh_mlb_statcast_all_analytics() from public,anon,authenticated;
grant execute on function public.refresh_mlb_statcast_all_analytics() to service_role;