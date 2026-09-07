-- MLB Statcast daily refresh timeout parity.
-- Production migration version: 20260907152748

alter function public.refresh_mlb_statcast_all_analytics()
  set statement_timeout = '5min';

alter function public.refresh_mlb_statcast_matchup_rollups()
  set statement_timeout = '5min';

alter function public.refresh_mlb_statcast_batter_prop_rollups()
  set statement_timeout = '5min';

alter function public.refresh_mlb_nrfi_research_rollups()
  set statement_timeout = '5min';

alter function public.refresh_mlb_pitcher_prop_research_rollups()
  set statement_timeout = '5min';
