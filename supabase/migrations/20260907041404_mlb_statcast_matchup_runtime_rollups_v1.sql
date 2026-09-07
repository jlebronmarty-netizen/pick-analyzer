-- Follow-up ledger entry for the same runtime-rollup phase.
-- The materialized views/indexes were already created by 20260907041118.
-- This migration adds stable refresh entrypoints for daily Statcast ingestion.

create or replace function public.refresh_mlb_statcast_matchup_rollups()
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

revoke all on function public.refresh_mlb_statcast_matchup_rollups() from public, anon, authenticated;
grant execute on function public.refresh_mlb_statcast_matchup_rollups() to service_role;

create or replace function public.refresh_mlb_statcast_all_analytics()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.refresh_mlb_statcast_runtime_rollups();
  perform public.refresh_mlb_statcast_matchup_rollups();
end;
$$;

revoke all on function public.refresh_mlb_statcast_all_analytics() from public, anon, authenticated;
grant execute on function public.refresh_mlb_statcast_all_analytics() to service_role;
