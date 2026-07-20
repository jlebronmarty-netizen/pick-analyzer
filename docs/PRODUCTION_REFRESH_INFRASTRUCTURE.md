# Production Refresh Infrastructure

Status: Implemented locally
Date: 2026-07-20

## Root Cause

Production had two separate problems:

1. `vercel.json` defines only one Hobby-compatible cron: `/api/cron/operating-day` at `0 12 * * *`.
2. The protected cron route used `operating-day-automation` directly and could return `already_current` when the operating day was `ready_for_analysis`, even when Adaptive Refresh reported stale odds and a due `midday_refresh`.

The adaptive architecture was present, but the scheduled production entrypoint was not guaranteed to use it.

## Execution Chain

Production scheduler:

1. GitHub Actions `.github/workflows/production-operating-day.yml`
2. Runs four times per hour at `7,22,37,52 * * * *`.
3. Calls `POST https://pick-analyzer.vercel.app/api/cron/operating-day?dryRun=false`
4. Sends `Authorization: Bearer <CRON_SECRET>`.
5. `/api/cron/operating-day` delegates to `runAdaptiveRefresh`.
6. Adaptive Refresh reads stored slate, freshness, lifecycle, budget and provider evidence.
7. If due, it selects the existing operating-day action such as `status_refresh`, `midday_refresh`, `sync_results` or `settle`.
8. Existing provider budget checks and provider action locks run before provider work.
9. Existing operating-day executor performs the provider-backed work and records lifecycle evidence.
10. User Mode reads stored state only.

Vercel cron remains a daily safety net. It is not sufficient for active MLB betting freshness by itself.

The legacy `.github/workflows/operating-day-refresh.yml` workflow is manual-only. Its scheduled triggers were removed so production has one unattended intraday scheduler of record.

GitHub scheduled workflows are best-effort and can be delayed or skipped during platform load. A secondary heartbeat workflow, `.github/workflows/production-operating-day-heartbeat.yml`, calls the same protected endpoint at `14,44 * * * *` with the same concurrency group. The server-side Adaptive Refresh planner remains the only authority for whether provider work is due.

## Scheduler Contract

Endpoint:

```text
POST /api/cron/operating-day?dryRun=false
Authorization: Bearer <CRON_SECRET>
```

The route now reports `operating_day_consolidated_cron_execution_v2` and includes:

- delegated adaptive mode
- selected action/date
- due steps
- provider-call forecast
- provider-call count
- writes
- freshness validation
- scheduler contract guardrails

## Event-Driven Refresh Windows

Adaptive Refresh now exposes per-event windows:

- `EARLY`: odds cadence from `MLB_ODDS_REFRESH_MINUTES_EARLY`, default 60.
- `PREGAME`: odds cadence from `MLB_ODDS_REFRESH_MINUTES_PREGAME`, default 15.
- `NEAR_START`: odds cadence from `MLB_ODDS_REFRESH_MINUTES_NEAR_START`, default 10.
- `LIVE`: status/results cadence, no pregame market polling.
- `POSTGAME`: settlement/results only, no market refresh.

SportsDataIO's verified MLB odds endpoint is date based, so execution remains one budget-guarded operating-day action when any event window makes the date due. The event windows are used for due decisions and observability, not as a duplicate provider importer.

## Operations Health

`/api/operations/health` exposes:

- provider status
- last odds refresh
- last prediction refresh
- last recommendation refresh
- last results refresh
- next refresh due
- credits used today
- credits remaining
- hourly usage
- current budget percent
- scheduler running
- last scheduler run
- last scheduler success
- last scheduler failure
- expected scheduler interval
- scheduler grace
- missed scheduler intervals
- scheduler cadence status
- next expected scheduler window
- skipped calls
- skip reason
- current refresh window
- `HEALTHY`, `WARNING` or `CRITICAL`

## Manual Production Steps

To activate unattended production refresh:

1. Deploy this code to production.
2. Confirm repository secret `CRON_SECRET` is set for the GitHub Actions workflow.
3. Confirm the workflow file is present on the production/default branch.
4. Confirm GitHub Actions scheduled workflows are enabled for the repository.
5. Use `workflow_dispatch` once for a controlled authenticated production trigger.
6. Watch `/api/operations/health` for `automaticMultiRefreshActive=true` after the manual and scheduled runs.

Do not expose the actual secret value.
