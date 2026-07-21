# MLB Current-Season Player Game Stats Backfill

Certification: pending production execution

Date: 2026-07-21

## Scope

The current-season backfill orchestrator is limited to SportsDataIO MLB `PlayerGameStatsByDate` for season `2026`.

It does not import previous seasons, does not start BSN, does not alter prediction, recommendation, Current Board, scheduler, settlement or dashboard logic, and does not create a parallel queue system.

## Architecture

`src/services/mlb-current-season-backfill-orchestrator.service.ts` wraps the existing durable SportsDataIO MLB historical import executor.

Every child date still runs through:

- `executeSportsDataIoMlbDiscoveryImport`;
- existing provider budget guard;
- durable `sports_sync_jobs` running checkpoint before provider transport;
- one provider call maximum per date;
- 60-second provider timeout;
- terminal child checkpoint;
- existing dedupe/checkpoint key.

The orchestrator adds a parent `sports_sync_jobs` invocation record with job type `mlb_current_season_player_game_stats_backfill_v1`.

## Route

- `GET /api/mlb/historical-backfill/player-game-stats?season=2026`
- `POST /api/mlb/historical-backfill/player-game-stats`

`GET` is read-only.

`POST` defaults to dry-run. Write mode requires `CRON_SECRET`, `confirmed=true` and `dryRun=false`.

## Batch Policy

The initial batch size is bounded by the existing provider budget configuration. Production currently sets `maxCallsPerAction=3`, so a single orchestrator invocation will not exceed 3 date imports unless the configured source of truth changes.

A batch boundary is `PARTIAL_PROGRESS` and resumable, not a failure.

## Stop Conditions

The orchestrator stops before provider transport when:

- an active historical job exists;
- an ambiguous, failed, partial or timed-out player-game-stat checkpoint exists for an eligible date;
- provider accounting is unavailable, uncertain or invalid;
- hourly or daily budget would not allow the batch;
- no eligible date remains;
- protected write mode is not confirmed.

It stops during execution when any child date does not finish as `completed`.

## Validation

Operations Validation includes deterministic fixture checks for:

- completed dates estimate zero calls;
- one date per child import unit;
- 60-second timeout;
- no automatic retry;
- active duplicate job prevention;
- resumable batch boundary;
- provider budget source of truth;
- deterministic checkpoint key;
- stored eligible completed-event planning;
- provider calls equal imported dates only.
