# MLB User Mode Freshness And Provider Budget Phase 1

Status: Implemented locally
Date: 2026-07-20

## Scope

Phase 1 only. This pass does not change prediction formulas, Current Board generation, recommendation policy, settlement, learning, provider adapters or supported markets.

## Architecture Found

- Vercel production cron is once daily: `/api/cron/operating-day` at `0 12 * * *`.
- Intraday operation depends on the prepared external scheduler workflow calling the protected operating-day runtime.
- User Mode page loads read stored state only and make zero provider calls.
- Provider calls are made through the existing operating-day executor and are recorded in `operating_day_lifecycle_events` and `sports_sync_jobs`.
- SportsDataIO odds snapshots are persisted idempotently in `sports_odds_snapshots`; prediction and recommendation refreshes reuse stored odds and do not require a provider call unless the upstream market/status data is due.
- Current Board candidate generation still uses the existing immutable candidate-selection policy. Display freshness is now separated from candidate selection so the dashboard can show stale market data without deleting stored candidates.
- Confirmed MLB lineups remain unsupported and are not polled.

## Root Cause

The 267-minute stale display was not a missing-market or dashboard rendering problem. The adaptive freshness policy allowed MLB market prices to remain fresh for 90 minutes and not stale until 360 minutes, while the production Vercel cron only runs once daily unless the external scheduler is active. That combination made intraday odds and downstream prediction/recommendation timestamps truthful but too old for same-day betting.

## Cadence

Old effective cadence:

- Vercel cron: once daily at 12:00 UTC.
- Adaptive market freshness: fresh 90 minutes, stale after 360 minutes.
- Current Board candidate generation unchanged.

New configurable adaptive cadence:

- No MLB slate: no wasteful odds polling.
- Early game day: odds fresh for `MLB_ODDS_REFRESH_MINUTES_EARLY`, default 60.
- Pregame window: odds fresh for `MLB_ODDS_REFRESH_MINUTES_PREGAME`, default 15.
- Final 90 minutes: odds fresh for `MLB_ODDS_REFRESH_MINUTES_NEAR_START`, default 10.
- Live/status: status score cadence config exposed through `MLB_SCORE_REFRESH_MINUTES_LIVE`, default 5.
- Postgame results: `MLB_RESULTS_REFRESH_MINUTES_POSTGAME`, default 15.
- Stale threshold defaults to `freshMinutes * MLB_ODDS_AGING_MULTIPLIER`, default 2.

## Budget Controls

New or supported environment controls:

- `MLB_DAILY_CREDIT_BUDGET`
- `PROVIDER_DAILY_CREDIT_BUDGET`
- `SPORTSDATAIO_DAILY_CALL_BUDGET`
- `MLB_DAILY_CREDIT_RESERVE`
- `PROVIDER_DAILY_CREDIT_RESERVE`
- `SPORTSDATAIO_SOFT_RESERVE`
- `MLB_MAX_CALLS_PER_ACTION`
- `SPORTSDATAIO_MAX_CALLS_PER_ACTION`
- `MLB_MAX_REFRESH_CALLS_PER_HOUR`
- `PROVIDER_MAX_REFRESH_CALLS_PER_HOUR`
- `PROVIDER_BUDGET_WARNING_PERCENT`
- `PROVIDER_BUDGET_STOP_PERCENT`
- `MLB_ODDS_REFRESH_MINUTES_EARLY`
- `MLB_ODDS_REFRESH_MINUTES_PREGAME`
- `MLB_ODDS_REFRESH_MINUTES_NEAR_START`
- `MLB_SCORE_REFRESH_MINUTES_LIVE`
- `MLB_RESULTS_REFRESH_MINUTES_POSTGAME`
- `MLB_ODDS_AGING_MULTIPLIER`
- `MLB_CURRENT_BOARD_DISPLAY_ODDS_STALE_MINUTES`
- `MLB_ODDS_DISPLAY_STALE_MINUTES`

Defaults are bounded: daily budget 1500, reserve 150, max calls per action 3, max refresh calls per hour 12, warning at 80%, hard stop at 95%.

## Guardrails

- Per-action provider cap remains enforced.
- Rolling-hour cap blocks duplicate scheduler bursts.
- Daily stop threshold blocks optional provider calls before the configured daily budget is exhausted.
- Soft reserve protects late pregame movement and results work.
- Budget status exposes calls today, calls last hour, hourly remaining, usage percent, warning/stop thresholds, warnings and next eligibility.
- Adaptive status exposes the active MLB freshness window and applied odds/results thresholds.
- Unsupported confirmed lineups remain `NOT_SUPPORTED` and do not create refresh work.
- Current Board display freshness defaults to 30 minutes while candidate generation remains unchanged.

## Usage Estimate

Assuming the external scheduler runs every 15 minutes and the orchestrator skips not-due work:

- Low-volume day: 8-20 SportsDataIO/MLB Stats API calls.
- Normal MLB slate: 35-80 calls, depending on first-pitch clustering and odds changes.
- Heavy/staggered slate: 80-140 calls if near-start windows are active across many hours.

The rolling-hour default cap of 12 calls prevents runaway execution even when multiple scheduler invocations overlap or retry.

## Validation Plan

- `npm.cmd run build`
- Read-only `/api/providers/budget/status?provider=sportsdataio&sportKey=baseball_mlb&includeValidation=true`
- Read-only `/api/operations/adaptive-refresh/status`
- Read-only `/api/operations/data-freshness`
- Read-only `/api/operations/health`
- Read-only `/api/dashboard/today?includeValidation=true`

Protected write-mode refreshes are intentionally not required for Phase 1 validation unless the runtime reports a due provider-backed action and budget permits it.

## Deployment Notes

Set the environment variables in Vercel before deploying if production should differ from defaults. Keep `CRON_SECRET` configured. If Vercel remains on the once-daily Hobby cron, enable the external scheduler workflow only after repository secrets are present and operator approval is explicit.

Phase 2 was not started.
