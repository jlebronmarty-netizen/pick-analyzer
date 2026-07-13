# NBA Data Sync V1

NBA Data Sync V1 is the reusable sync layer for NBA data. It builds on the
Multi-Sport Engine and preserves the existing NBA Adapter, Prediction Engine V4,
Odds API integration and public endpoints.

## Provider

The current NBA provider in this project is The Odds API using the normalized
sport key `basketball_nba`.

Available through the provider today:

- upcoming games from odds payloads
- moneyline, spread and total odds
- recent completed scores through the scores endpoint

Not available through the current project provider:

- player rosters
- injuries
- lineups
- advanced NBA team metrics such as offensive rating, defensive rating and pace

Those unsupported domains return explicit capability warnings and do not
fabricate data.

## Architecture

- `src/services/nba-data-sync.service.ts` is the sync orchestrator.
- `src/services/nba-adapter.service.ts` remains the readiness adapter.
- `src/services/multi-sport-*.service.ts` supplies sport resolution, provider
  resolution, normalized events, normalized odds and health.
- `src/components/dashboard/NbaDataSyncPanel.tsx` surfaces health and manual
  sync controls.
- `supabase/migrations/202607110001_nba_data_sync_v1.sql` creates generic
  sports sync tables.

## Flow

The orchestrator supports:

- teams
- games
- results
- standings
- team stats
- game stats
- players contract
- injuries contract
- lineups contract
- odds snapshots
- full orchestration

`runNbaSync('all')` executes a safe incremental sequence:

1. sync teams
2. sync games
3. sync results
4. derive standings from results
5. derive team stats and game stats from results
6. record player/injury/lineup provider warnings
7. sync odds snapshots

## Full Versus Incremental

Modes:

- `incremental`: default safe mode
- `today`: limits event sync to today
- `live`: reserved for focused live updates
- `full`: wider available provider window
- `historical`: reconciles provider-supported historical scores
- `date_range`: accepts `dateFrom` and `dateTo`

The Odds API scores endpoint has a limited recent historical window. The sync
does not claim full season backfill when the provider cannot supply it.

## Tables

Existing tables reused:

- `team_stats`
- `game_results`
- `prediction_history`

Generic tables added:

- `provider_entity_mappings`
- `sports_sync_jobs`
- `sports_teams`
- `sport_events`
- `sport_standings`
- `sport_game_stats`
- `sport_players`
- `sport_injuries`
- `sports_odds_snapshots`

All writes are idempotent through deterministic IDs or `upsert` conflict keys.

## Endpoints

- `POST /api/nba/sync`
- `GET /api/nba/sync`
- `POST /api/nba/sync/teams`
- `POST /api/nba/sync/games`
- `POST /api/nba/sync/standings`
- `POST /api/nba/sync/stats`
- `POST /api/nba/sync/players`
- `POST /api/nba/sync/injuries`
- `POST /api/nba/sync/odds`
- `GET /api/nba/sync/status`
- `GET /api/nba/data-health`

Query parameters:

- `season=YYYY-YY`
- `mode=incremental|today|live|full|historical|date_range`
- `dateFrom=YYYY-MM-DD`
- `dateTo=YYYY-MM-DD`

## Cron

`vercel.json` schedules:

- `/api/nba/sync?mode=incremental` at `0 9,15,21 * * *`

The route uses the existing `CRON_SECRET` authorization pattern.

## Idempotency

Idempotency is handled by:

- canonical NBA team IDs
- provider mapping rows keyed by sport, entity type, provider, provider ID and
  season
- provider event IDs for games
- deterministic odds snapshot IDs by event, book, market, outcome, price, line
  and minute
- upserts for standings, team stats and game stats

## Error Handling

Each job records:

- job type
- sport
- league
- provider
- season
- started/completed timestamps
- status
- fetched/inserted/updated/skipped counts
- error count
- last error
- duration

Record-level failures are collected into job summaries. Unsupported provider
features are warnings, not fabricated data.

## Data Health

Use:

- `GET /api/nba/data-health`

It checks:

- team coverage
- event team links
- event provider IDs
- standings coverage
- team stats coverage
- odds snapshots
- recent failed sync jobs
- provider health

Statuses:

- `healthy`
- `degraded`
- `unavailable`
