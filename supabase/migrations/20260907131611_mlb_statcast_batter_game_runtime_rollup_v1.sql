-- MLB Statcast batter-game runtime rollup V1.
-- Preserve the existing mlb_statcast_batter_game_logs contract while routing
-- request-time reads through a compact materialized surface.

create materialized view if not exists public.mlb_statcast_batter_game_logs_mv as
select * from public.mlb_statcast_batter_game_logs
with data;

create unique index if not exists mlb_statcast_batter_game_logs_mv_uidx
  on public.mlb_statcast_batter_game_logs_mv (season, game_pk, batter);
create index if not exists mlb_statcast_batter_game_logs_mv_batter_date_idx
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
  perform public.refresh_mlb_statcast_runtime_rollups();
  perform public.refresh_mlb_statcast_matchup_rollups();
  perform public.refresh_mlb_statcast_batter_runtime_rollups();
  perform public.refresh_mlb_statcast_batter_prop_rollups();
end;
$$;

revoke all on function public.refresh_mlb_statcast_all_analytics() from public, anon, authenticated;
grant execute on function public.refresh_mlb_statcast_all_analytics() to service_role;