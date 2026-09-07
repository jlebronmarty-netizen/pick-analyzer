-- MLB Statcast daily analytics repair v1
-- Keep the production cron critical path inside the Vercel runtime budget.
-- Heavy descriptive matchup rollups and NRFI research refreshes remain available
-- through their dedicated functions and are intentionally excluded here.

create or replace function public.refresh_mlb_statcast_all_analytics()
returns void
language plpgsql
security definer
set search_path = 'public'
set statement_timeout = '4min'
as $function$
begin
  perform public.refresh_mlb_statcast_pitcher_game_logs_mv();
  perform public.refresh_mlb_statcast_batter_runtime_rollups();
  perform public.refresh_mlb_statcast_runtime_rollups();

  if to_regprocedure('public.refresh_mlb_statcast_batter_prop_rollups()') is not null then
    execute 'select public.refresh_mlb_statcast_batter_prop_rollups()';
  end if;

  -- Intentionally excluded from the daily Vercel critical path:
  --   public.refresh_mlb_statcast_matchup_rollups()
  --   public.refresh_mlb_nrfi_research_rollups()
  -- They are research/descriptive refreshes and can exceed the request budget.
end;
$function$;

comment on function public.refresh_mlb_statcast_all_analytics() is
  'Daily runtime-safe Statcast analytics refresh. Heavy matchup and NRFI research rollups are intentionally decoupled from the Vercel cron critical path.';
