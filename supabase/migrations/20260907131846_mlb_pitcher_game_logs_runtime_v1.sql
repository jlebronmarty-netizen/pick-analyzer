-- Runtime rollup for research paths that need many pitcher game logs.
-- Source remains the certified Statcast game-log view; this materializes only
-- the small game-level result so request-time reads do not rescan raw pitches.

create materialized view if not exists public.mlb_statcast_pitcher_game_logs_mv as
select * from public.mlb_statcast_pitcher_game_logs
with data;

create unique index if not exists mlb_statcast_pitcher_game_logs_mv_uidx
  on public.mlb_statcast_pitcher_game_logs_mv (season, game_pk, pitcher);
create index if not exists mlb_statcast_pitcher_game_logs_mv_pitcher_date_idx
  on public.mlb_statcast_pitcher_game_logs_mv (season, pitcher, game_date desc, game_pk);
create index if not exists mlb_statcast_pitcher_game_logs_mv_workload_idx
  on public.mlb_statcast_pitcher_game_logs_mv (season, total_pitches, game_date, game_pk);

revoke all on public.mlb_statcast_pitcher_game_logs_mv from public, anon, authenticated;
grant select on public.mlb_statcast_pitcher_game_logs_mv to service_role;

create or replace function public.refresh_mlb_statcast_pitcher_game_logs_mv()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  refresh materialized view public.mlb_statcast_pitcher_game_logs_mv;
end;
$$;

revoke all on function public.refresh_mlb_statcast_pitcher_game_logs_mv() from public, anon, authenticated;
grant execute on function public.refresh_mlb_statcast_pitcher_game_logs_mv() to service_role;
