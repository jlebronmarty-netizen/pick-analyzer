-- Runtime index for the quarantined SportsDataIO 2026 starter research surface.
-- This does not change validation or production eligibility of those rows.

create index if not exists sport_player_stats_mlb_sportsdataio_starters_2026_runtime_idx
  on public.sport_player_stats(source_timestamp,id)
  where sport_key='baseball_mlb'
    and league_key='mlb'
    and season='2026'
    and stat_type='game'
    and provider='sportsdataio'
    and stats->>'Started'='1';