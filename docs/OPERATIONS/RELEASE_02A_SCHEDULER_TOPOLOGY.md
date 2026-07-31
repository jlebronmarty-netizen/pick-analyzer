# Release 02A Scheduler Topology

Status: REPAIRED / PENDING POST-DEPLOYMENT SCHEDULED OBSERVATION

Release 02A investigates the only Release 02 production blocker: settlement guarantee returned HTTP 409 because scheduler health was `DEGRADED`, cadence was `CRITICAL`, and missed scheduler intervals were `3`.

## Active Scheduler Ownership

| Scheduler | Definition | Timezone | Caller | Endpoint | Authentication | Expected Persistence | Heartbeat Timestamp | Failure / Retry Behavior |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Vercel cron | `vercel.json` contains `"crons": []` | n/a | Disabled | n/a | n/a | None | None | Not an active scheduler. |
| GitHub writer | `.github/workflows/production-operating-day.yml`, `7-57/10 * * * *` | UTC | GitHub Actions schedule or workflow dispatch | `POST /api/cron/operating-day?dryRun=false` | `Authorization: Bearer CRON_SECRET` | Existing operating-day pipeline writes lifecycle rows for successful work/no-change. | `operating_day_lifecycle_events.completed_at` | Workflow fails on non-2xx; app preserves strict status such as `BUDGET_BLOCKED`, `MISSED_REFRESH`, `FAILED_RETRYABLE`. |
| GitHub heartbeat | `.github/workflows/production-operating-day-heartbeat.yml`, `3,33 * * * *` | UTC | GitHub Actions schedule or workflow dispatch | `POST /api/cron/operating-day?dryRun=true` | `Authorization: Bearer CRON_SECRET` | Release 02A records `scheduler_heartbeat` in `operating_day_lifecycle_events` after successful protected dry-run observation. | `operating_day_lifecycle_events.completed_at` for `scheduler_heartbeat` | Workflow fails on non-2xx; failed heartbeat does not update health. |
| Manual refresh | `.github/workflows/operating-day-refresh.yml`, workflow dispatch only | Manual | GitHub Actions dispatch | `POST /api/cron/operating-day?dryRun=true` | repository secrets for base URL and cron secret | Same protected route; can record a heartbeat marker when successful. | Lifecycle heartbeat marker after successful protected dry-run. | Manual fallback only. |
| Settlement guarantee | `src/app/api/operations/settlement-guarantee/route.ts` | America/Puerto_Rico for lookback windows | Read-only product health | `GET /api/operations/settlement-guarantee?includeValidation=true` | Public read-only route | No writes | Reads operations health marker | Returns 409 when ready rows, silent pending rows, or late/critical scheduler exists. |

## Freshness Calculation

| Field | Source |
| --- | --- |
| Expected writer interval | `MLB_OPERATING_DAY_WRITE_SCHEDULER_INTERVAL_MINUTES = 10` |
| Grace window | `MLB_OPERATING_DAY_SCHEDULER_GRACE_MINUTES = 10` |
| Canonical success marker | latest successful `operating_day_lifecycle_events` row with `SUCCESS_CHANGED`, `SUCCESS_NO_CHANGE`, `completed`, `morning_synced`, `midday_refreshed`, or `results_synced` |
| Missed interval formula | `floor((evidenceAge - (interval + grace)) / interval) + 1` after the grace window |
| Active windows | `EARLY`, `PREGAME`, `NEAR_START`, `LIVE`, or any due/due-soon refresh plan |
| Critical threshold | `missedSchedulerIntervals >= 2` |

## Root Cause

The GitHub heartbeat workflow was configured as a protected dry-run observer. The application treated dry-run as plan-only and returned before writing any lifecycle evidence. Operations health then used only lifecycle rows as canonical scheduler evidence. A successful dry-run heartbeat could therefore occur without updating `lastSuccessfulProtectedInvocationAt`, causing false scheduler-late/critical classification when the writer was delayed, had no work, or had not recently produced a lifecycle row.

This was a stale/missing heartbeat persistence defect, not a settlement formula defect and not proof of unsettled ready rows.

## Release 02A Repair

- Added `recordOperatingDaySchedulerHeartbeat` to write an operational-only `scheduler_heartbeat` lifecycle row after successful protected dry-run heartbeat.
- Updated the consolidated cron route to call that helper only when dry-run succeeds.
- Corrected the scheduler topology contract in pregame coverage so heartbeat shows `dryRun=true` and actual cron `3,33 * * * *`.
- Kept settlement guarantee strict: late/critical scheduler still returns action required.

## Non-Changes

- No prediction probabilities changed.
- No ranking or Official Picks policy changed.
- No learning weights changed.
- No settlement formulas changed.
- No provider configuration changed.
- No database migration or architecture change was created.
