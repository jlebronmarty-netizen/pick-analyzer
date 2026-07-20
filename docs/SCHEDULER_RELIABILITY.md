# Scheduler Reliability

Status: Implemented
Version: V1

## Vercel Cron

`vercel.json` defines one production cron:

```json
{ "path": "/api/cron/operating-day", "schedule": "0 12 * * *" }
```

This is the safe Hobby-compatible cadence. Intraday cadence requires the external scheduler fallback or protected manual execution.

Actual deployed cadence on 2026-07-19 is once daily at `0 12 * * *` UTC. Desired MLB market freshness requires intraday execution around morning slate discovery, midday market refresh and pregame refresh windows. If the current Vercel plan cannot schedule those windows directly, an external scheduler must call the protected endpoint with `Authorization: Bearer <CRON_SECRET>`.

Canonical consolidated scheduler method:

```bash
POST https://pick-analyzer.vercel.app/api/cron/operating-day?dryRun=false
Authorization: Bearer <CRON_SECRET>
```

`status_refresh` now uses MLB Stats API and is selected ahead of odds/prediction work when current slate lifecycle status is stale or unconfirmed.

After a successful `status_refresh`, `SUCCESS_CHANGED` and `SUCCESS_NO_CHANGE` both satisfy the provider-check requirement until `nextEligibleStatusRefreshAt`. The scheduler should then advance to due odds/results work unless a new status refresh window opens.

Expected SportsDataIO usage for a due odds-only refresh is one odds call when schedule/projection checkpoints are reusable; full operating-day preparation can use up to three capped calls.

Expected MLB Stats API usage for a due status refresh is one schedule/status call for the selected operating date.

## Cron Route

`/api/cron/operating-day`:

- Requires `CRON_SECRET` when configured.
- Delegates first to Adaptive Refresh.
- Uses Adaptive Refresh to resolve active operating day, event window, freshness, due domains and provider budget.
- Calls the existing operating-day executor only when Adaptive Refresh selects due work.
- Returns structured provider calls, writes, due steps, freshness validation and retryability.

The route no longer lets `ready_for_analysis` short-circuit stale market refreshes as `already_current`.

## Duplicate Protection

Adaptive Refresh uses the existing provider action lock to avoid overlapping equivalent runs.

## External Cadence Requirement

The production GitHub Actions workflow `.github/workflows/production-operating-day.yml` is the production scheduler layer. It requires repository secret:

- `CRON_SECRET`

Recommended UTC cadence: `7,22,37,52 * * * *`. This preserves four primary attempts per hour while avoiding the common `:00`, `:15`, `:30` and `:45` GitHub Actions congestion boundaries. GitHub scheduled workflows are best-effort, so exact start time is not guaranteed.

The adaptive planner decides whether status, odds, results, settlement or no work is actually due, and provider locks prevent overlapping equivalent work. GitHub Actions workflow concurrency uses one production group with `cancel-in-progress: false`.

Secondary safe invocation path: `.github/workflows/production-operating-day-heartbeat.yml` calls the same protected endpoint at `14,44 * * * *` with the same `CRON_SECRET`, production URL and concurrency group. This is not a second refresh engine. It is a bounded heartbeat caller into the same Adaptive Refresh, provider budget and action-lock controls.

The older `.github/workflows/operating-day-refresh.yml` workflow is retained for manual fallback only. It has no scheduled triggers, avoiding duplicate unattended scheduler invocations.

Operations Health scheduler cadence fields:

- `expectedSchedulerIntervalMinutes`: `15`
- `schedulerGraceMinutes`: `10`
- `lastSchedulerRunAgeMinutes`: age of the latest successful protected scheduler evidence
- `missedSchedulerIntervals`: expected windows missed after interval plus grace
- `schedulerCadenceStatus`: `HEALTHY`, `LATE`, `CRITICAL`, `IDLE` or `NO_EVIDENCE`
- `nextExpectedSchedulerWindow`: next expected successful-run window from the last evidence
- `schedulerLate`
- `schedulerCritical`

Late scheduler catch-up policy: when a delayed invocation eventually arrives, it runs one current-state Adaptive Refresh plan. It must not replay every missed interval or multiply provider calls based on missed-run count.

Latest protected local evidence on 2026-07-20:

- `status_refresh` executed for `2026-07-20` with 1 MLB Stats API provider call and completed provider-check evidence.
- `midday_refresh` executed for `2026-07-20` with 3 provider calls, including SportsDataIO `GameOddsByDate/2026-07-20`, and inserted 90 odds snapshots.
- User-mode Today reads after execution made 0 provider calls and 0 remote mutations.

## Phase 1 Freshness Requirement

Once-daily Vercel cron cannot keep MLB market prices, predictions and recommendations fresh during a same-day betting slate. Production requires either:

- An external scheduler calling `POST https://pick-analyzer.vercel.app/api/cron/operating-day?dryRun=false` every 15 minutes with `Authorization: Bearer <CRON_SECRET>`, or
- A Vercel plan/scheduler configuration that can provide the same protected intraday cadence.

The server remains the decision-maker. A 15-minute external trigger does not guarantee a provider call: the adaptive planner checks the active MLB window, freshness thresholds, daily budget, rolling-hour budget, action lock and provider evidence before delegating work.

Recommended production environment values:

- `MLB_DAILY_CREDIT_BUDGET=1500`
- `MLB_DAILY_CREDIT_RESERVE=150`
- `MLB_MAX_CALLS_PER_ACTION=3`
- `MLB_MAX_REFRESH_CALLS_PER_HOUR=12`
- `PROVIDER_BUDGET_WARNING_PERCENT=80`
- `PROVIDER_BUDGET_STOP_PERCENT=95`
- `MLB_ODDS_REFRESH_MINUTES_EARLY=60`
- `MLB_ODDS_REFRESH_MINUTES_PREGAME=15`
- `MLB_ODDS_REFRESH_MINUTES_NEAR_START=10`
- `MLB_SCORE_REFRESH_MINUTES_LIVE=5`
- `MLB_RESULTS_REFRESH_MINUTES_POSTGAME=15`

Certification status: PASS_LOCAL for protected execution, Phase 1 budget/freshness controls and production cron entrypoint delegation. FAIL for unattended production scheduling until the workflow is deployed/enabled in production, `CRON_SECRET` is verified, and at least one scheduled invocation records lifecycle evidence after deployment.
