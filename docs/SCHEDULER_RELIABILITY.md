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

Protected execution method:

```bash
POST https://pick-analyzer.vercel.app/api/operations/adaptive-refresh?dryRun=false
```

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
- Resolves the active operating day.
- Skips when already current.
- Delegates to `executeOperatingDay`.
- Returns structured provider calls, writes and retryability.

## Duplicate Protection

Adaptive Refresh uses the existing provider action lock to avoid overlapping equivalent runs.

## External Cadence Requirement

The production GitHub Actions workflow `.github/workflows/production-operating-day.yml` is the prepared external scheduler. It requires repository secret:

- `CRON_SECRET`

Recommended UTC cadence: `*/15 * * * *`. The adaptive planner decides whether status, odds, results, settlement or no work is actually due, and provider locks prevent overlapping equivalent work.

Latest protected local evidence on 2026-07-20:

- `status_refresh` executed for `2026-07-20` with 1 MLB Stats API provider call and completed provider-check evidence.
- `midday_refresh` executed for `2026-07-20` with 3 provider calls, including SportsDataIO `GameOddsByDate/2026-07-20`, and inserted 90 odds snapshots.
- User-mode Today reads after execution made 0 provider calls and 0 remote mutations.

Certification status: PASS_LOCAL for protected execution. FAIL for unattended production scheduling until the workflow is enabled in production, `CRON_SECRET` is verified, and at least one scheduled invocation records lifecycle evidence.
