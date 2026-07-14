# NBA Data Quality Player Stats Expansion V1

Date: 2026-07-13

## Summary

NBA Data Quality Player Stats Expansion V1 extends the existing read-only NBA data-quality audit so player identity and future player-stat persistence readiness are visible before any additional SportsDataIO execution.

No provider calls are made. No migration is applied automatically.

## Coverage Added

- `sport_players` coverage against a conservative NBA roster baseline.
- Duplicate player identity keys by display name, team and position.
- Player rows with missing or unresolved team links.
- Optional `sport_player_stats` coverage when the additive migration is available.
- Duplicate player-stat natural keys by stat type, season, event, team and player.
- Player game stats that reference missing events.
- Player stat rows with unresolved player or team links.
- Player stat rows outside the active NBA season.
- Trial player-stat rows incorrectly marked `production_eligible=true`.

## Migration Tolerance

`sport_player_stats` is introduced by `supabase/migrations/202607130002_sport_player_stats_v1.sql`, but the quality audit remains usable before that migration is applied. If the table is unavailable, the audit returns an informational issue recommending the migration instead of failing all NBA quality endpoints.

## Safety

- External provider calls used: 0.
- Prediction persistence changed: no.
- Backtesting changed: no.
- Model training changed: no.
- Trial rows remain unable to improve production confidence.

## Remaining Blocker

Live SportsDataIO NBA player season/game stat execution remains blocked until exact authenticated endpoint paths are confirmed and the additive `sport_player_stats` migration is applied in the target Supabase environment.
