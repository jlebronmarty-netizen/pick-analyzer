# Adaptive Refresh Execution

Status: Implemented
Version: V1

## API

- `GET /api/operations/adaptive-refresh/status`: read-only status.
- `GET /api/operations/adaptive-refresh`: dry-run by default.
- `POST /api/operations/adaptive-refresh?dryRun=false`: protected execution.

Live execution requires `CRON_SECRET`.

## Execution States

The bridge returns:

- `PLANNED`
- `NOT_DUE`
- `SUCCESS`
- `SUCCESS_CHANGED`
- `SUCCESS_NO_CHANGE`
- `PROVIDER_NO_CURRENT_MARKETS`
- `PROVIDER_DELAYED`
- `PROVIDER_BLOCKED`
- `BUDGET_BLOCKED`
- `BLOCKED`
- `FAILED_RETRYABLE`
 - `FAILED_TERMINAL`
 - `MISSED_REFRESH`

`PLANNED_NOT_EXECUTED` is no longer used for protected live execution.

## Safety

The executor:

- Uses the existing refresh plan.
- Maps due domains to existing operating-day actions.
- Checks provider budget.
- Uses a bounded action lock.
- Delegates to `executeOperatingDay`.
- Records provider calls and mutations from the delegated result.
- Preserves provider-backed intent with `forceRefresh=true` when a due schedule, odds or results step requires provider work.
- Requires `providerCheckCompleted=true` before provider-backed odds work can return `SUCCESS_NO_CHANGE`.
- Keeps prediction formulas, thresholds, champion state and settlement policy unchanged.

## MLB Odds Repair V1

Before: `midday_refresh` could reuse an existing `operating_day_odds_capture` checkpoint and perform a stored-data rebuild with zero provider calls.

After: due provider-backed odds work bypasses the odds checkpoint only, calls SportsDataIO `GameOddsByDate`, records provider-check evidence, persists accepted snapshots, and reports `SUCCESS_CHANGED`, `SUCCESS_NO_CHANGE`, `PROVIDER_NO_CURRENT_MARKETS`, `PROVIDER_DELAYED`, `BUDGET_BLOCKED`, `FAILED_RETRYABLE` or `MISSED_REFRESH` truthfully.
