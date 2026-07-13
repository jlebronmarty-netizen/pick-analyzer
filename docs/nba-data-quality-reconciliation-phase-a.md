# NBA Data Quality and Historical Reconciliation Phase A

Phase A is a read-only audit and planning layer. It uses only data already stored in Supabase and never calls external providers.

## Scope

- Audit NBA tables for data quality issues.
- Summarize coverage for teams, events, completed games, game stats, standings, odds snapshots, predictions, settled predictions and provider mappings.
- Detect historical gaps by date range from stored `sport_events`, `game_results` and `sports_odds_snapshots`.
- Produce a dry-run reconciliation plan with estimated provider calls and quota impact.
- Surface the audit and plan in the dashboard.

## Tables Read

- `sports_teams`
- `sport_events`
- `sport_game_stats`
- `sport_standings`
- `sports_odds_snapshots`
- `sports_sync_jobs`
- `prediction_history`
- `game_results`
- `team_stats`
- `provider_entity_mappings`

## Audit Rules

The audit detects:

- missing or duplicate teams
- missing provider IDs
- orphan or unresolved event teams
- invalid statuses
- completed events without scores
- partial scores
- invalid dates
- duplicate events
- missing or duplicate game stats
- missing or stale standings
- missing, stale or duplicate odds snapshots
- impossible odds or lines
- predictions without valid events
- completed predictions not settled
- failed or stale running sync jobs
- provider mapping conflicts
- season inconsistencies
- potential historical date gaps

Issue severities are:

- `info`
- `warning`
- `error`
- `critical`

## Coverage Formulas

- Teams: `sports_teams / 30`
- Events: `sport_events / max(game_results, sport_events, 1)`
- Completed games: completed `sport_events / max(game_results, completed_events, 1)`
- Game stats: completed events with two team stat rows / completed events
- Standings: `sport_standings / 30`
- Odds snapshots: `sports_odds_snapshots / max(sport_events, 1)`
- Predictions: `prediction_history / max(sport_events, 1)`
- Settled predictions: final predictions / all predictions
- Provider mappings: `provider_entity_mappings / 30`

## Reconciliation Planning

The planner returns:

- missing event, result and odds date ranges
- entities requiring refresh
- events requiring score reconciliation
- events requiring stats reconciliation
- seasons requiring standings refresh
- odds gaps
- estimated provider calls
- estimated quota impact
- recommended batch size
- recommended execution order
- safe incremental plan

The planner is intentionally conservative. Estimates are not executed in Phase A.

## Dry-Run Behavior

`POST /api/nba/reconciliation/plan` defaults to `dryRun=true`.

Phase A guarantees:

- no external provider calls
- no Supabase writes
- no historical downloads
- no settlement execution
- no fabricated data

## APIs

- `GET /api/nba/data-quality`
- `GET /api/nba/data-quality/issues`
- `GET /api/nba/data-quality/coverage`
- `POST /api/nba/reconciliation/plan`
- `GET /api/nba/reconciliation/status`

## Dashboard

`NbaDataQualityPanel` shows:

- overall quality status
- issue counts by severity
- coverage percentages
- historical gaps
- provider-call estimates
- quota warning
- proposed dry-run execution order

There is no external execution button in Phase A.

## Phase B Boundary

Phase B may execute provider-backed reconciliation only after explicit approval. It should use capped parameters:

- small date windows
- low batch size
- incremental mode
- teams first, then events, results, derived standings/stats, odds, settlement and backtesting

Phase B must stop if provider quota, provider cost or destructive data repair becomes risky.
