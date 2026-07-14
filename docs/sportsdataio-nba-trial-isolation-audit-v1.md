# SportsDataIO NBA Trial Isolation Audit V1

Date: 2026-07-13

## Summary

SportsDataIO NBA Trial Isolation Audit V1 adds a read-only Supabase audit endpoint:

- `/api/providers/sportsdataio/nba/trial-isolation`

The audit checks stored SportsDataIO NBA rows for trial isolation metadata and scans NBA prediction rows for trial-event or trial-feature leakage.

## Scope

Audited tables:

- `sports_teams`
- `sport_events`
- `sport_standings`
- `sport_game_stats`
- `sport_injuries`
- `sport_players`
- `sport_lineups`
- `sport_player_stats` when available
- `sports_odds_snapshots`
- `provider_entity_mappings`
- `prediction_history`

## Safety

- External provider calls used: 0.
- Mutations: none.
- Prediction persistence enabled: no.
- Backtesting enabled: no.
- Model training enabled: no.

## Checks

- SportsDataIO rows carry trial/scrambled metadata.
- Trial rows remain `production_eligible=false`.
- NBA predictions do not reference SportsDataIO trial event IDs.
- NBA prediction feature snapshots do not carry trial/scrambled markers.
