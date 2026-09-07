-- MLB Statcast matchup runtime rollups v1
-- Runtime reads use these compact materialized relations while the descriptive
-- source views remain available for validation/research. The canonical raw
-- source remains pick2_raw_mlb_statcast_pitches.

create materialized view if not exists public.mlb_statcast_pitcher_hand_split_summary_mv as
select * from public.mlb_statcast_pitcher_hand_split_summary
with data;
create unique index if not exists mlb_statcast_pitcher_hand_split_summary_mv_uidx
  on public.mlb_statcast_pitcher_hand_split_summary_mv (season, pitcher, batter_stand);

create materialized view if not exists public.mlb_statcast_batter_hand_split_summary_mv as
select * from public.mlb_statcast_batter_hand_split_summary
with data;
create unique index if not exists mlb_statcast_batter_hand_split_summary_mv_uidx
  on public.mlb_statcast_batter_hand_split_summary_mv (season, pitcher_throws, batter);

create materialized view if not exists public.mlb_statcast_pitcher_vs_team_summary_mv as
select * from public.mlb_statcast_pitcher_vs_team_summary
with data;
create unique index if not exists mlb_statcast_pitcher_vs_team_summary_mv_uidx
  on public.mlb_statcast_pitcher_vs_team_summary_mv (season, pitcher, opponent_team);

create materialized view if not exists public.mlb_statcast_batter_pitch_type_summary_mv as
select * from public.mlb_statcast_batter_pitch_type_summary
with data;
create unique index if not exists mlb_statcast_batter_pitch_type_summary_mv_uidx
  on public.mlb_statcast_batter_pitch_type_summary_mv (season, pitcher_throws, batter, pitch_type);

create materialized view if not exists public.mlb_statcast_team_vs_pitch_type_summary_mv as
select * from public.mlb_statcast_team_vs_pitch_type_summary
with data;
create unique index if not exists mlb_statcast_team_vs_pitch_type_summary_mv_uidx
  on public.mlb_statcast_team_vs_pitch_type_summary_mv (season, team, pitcher_throws, pitch_type);

create materialized view if not exists public.mlb_statcast_league_pitch_type_summary_mv as
select * from public.mlb_statcast_league_pitch_type_summary
with data;
create unique index if not exists mlb_statcast_league_pitch_type_summary_mv_uidx
  on public.mlb_statcast_league_pitch_type_summary_mv (season, pitcher_throws, pitch_type);

create materialized view if not exists public.mlb_statcast_pitcher_batter_summary_mv as
select * from public.mlb_statcast_pitcher_batter_summary
with data;
create unique index if not exists mlb_statcast_pitcher_batter_summary_mv_uidx
  on public.mlb_statcast_pitcher_batter_summary_mv (season, pitcher, batter);

revoke all on public.mlb_statcast_pitcher_hand_split_summary_mv from public, anon, authenticated;
revoke all on public.mlb_statcast_batter_hand_split_summary_mv from public, anon, authenticated;
revoke all on public.mlb_statcast_pitcher_vs_team_summary_mv from public, anon, authenticated;
revoke all on public.mlb_statcast_batter_pitch_type_summary_mv from public, anon, authenticated;
revoke all on public.mlb_statcast_team_vs_pitch_type_summary_mv from public, anon, authenticated;
revoke all on public.mlb_statcast_league_pitch_type_summary_mv from public, anon, authenticated;
revoke all on public.mlb_statcast_pitcher_batter_summary_mv from public, anon, authenticated;

grant select on public.mlb_statcast_pitcher_hand_split_summary_mv to service_role;
grant select on public.mlb_statcast_batter_hand_split_summary_mv to service_role;
grant select on public.mlb_statcast_pitcher_vs_team_summary_mv to service_role;
grant select on public.mlb_statcast_batter_pitch_type_summary_mv to service_role;
grant select on public.mlb_statcast_team_vs_pitch_type_summary_mv to service_role;
grant select on public.mlb_statcast_league_pitch_type_summary_mv to service_role;
grant select on public.mlb_statcast_pitcher_batter_summary_mv to service_role;

create or replace function public.refresh_mlb_statcast_matchup_runtime_rollups()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  refresh materialized view public.mlb_statcast_pitcher_hand_split_summary_mv;
  refresh materialized view public.mlb_statcast_batter_hand_split_summary_mv;
  refresh materialized view public.mlb_statcast_pitcher_vs_team_summary_mv;
  refresh materialized view public.mlb_statcast_batter_pitch_type_summary_mv;
  refresh materialized view public.mlb_statcast_team_vs_pitch_type_summary_mv;
  refresh materialized view public.mlb_statcast_league_pitch_type_summary_mv;
  refresh materialized view public.mlb_statcast_pitcher_batter_summary_mv;
end;
$$;

revoke all on function public.refresh_mlb_statcast_matchup_runtime_rollups() from public, anon, authenticated;
grant execute on function public.refresh_mlb_statcast_matchup_runtime_rollups() to service_role;
