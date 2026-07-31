# Runtime Resilience

Status: RELEASE 03 CERTIFIED

Release 03 audited production resilience without adding betting features, models, historical replay, probability recalibration, provider changes or database architecture changes.

## Resilience Inventory

| Area | Deterministic Outcome | Evidence | Release 03 Result |
| --- | --- | --- | --- |
| Scheduler writer | Bounded GitHub Actions writer calls protected endpoint with `dryRun=false`; non-2xx fails workflow. | `.github/workflows/production-operating-day.yml`, `/api/cron/operating-day` | PASS |
| Scheduler heartbeat | Successful protected dry-run records scheduler-owned lifecycle heartbeat; failed dry-run does not update health. | `recordOperatingDaySchedulerHeartbeat`, `/api/cron/operating-day` | PASS |
| Duplicate execution | Provider action locks protect overlapping adaptive execution. | `claimProviderActionLock`, `releaseProviderActionLock` | PASS |
| No-work execution | No-work scheduler state returns `SUCCESS_NO_CHANGE`/`NOT_DUE` and remains observable. | `runAdaptiveRefresh`, `recordOperatingDaySchedulerHeartbeat` | PASS |
| Provider failures | Provider budget and provider result classification keep failures explicit. | `adaptive-refresh-orchestrator.service.ts`, `provider-budget.service.ts` | PASS |
| Supabase failures | Read/write failures throw contextual errors or return degraded read-only responses. | operations, settlement, dashboard and current-board services | PASS |
| Timeout handling | Provider status refresh uses `AbortController`, bounded timeout and `provider_timeout` status. | `operating-day.service.ts` | PASS |
| Graceful degradation | Today dashboard returns typed HTTP 200 degraded fallback with zero provider calls and zero mutations. | `/api/dashboard/today` | PASS |
| Settlement strictness | Settlement guarantee remains HTTP 409 when ready rows, silent pending rows or unsafe scheduler health exists. | `settlement-guarantee.service.ts` | PASS |
| Production observability | Scheduler, provider, settlement, freshness, retries, failures and readiness are exposed. | `operations-health.service.ts` | PASS |

## Deterministic Failure States

- Unauthorized scheduler request: HTTP 401.
- Provider budget blocked: explicit blocked/budget status.
- Provider timeout: `provider_timeout`.
- Duplicate scheduler execution: lock-protected blocked state.
- Scheduler late/critical: settlement guarantee action required.
- No settlement-ready rows: settlement guarantee can pass when scheduler is healthy.
- Dashboard dependency failure: typed degraded fallback, not an unstructured crash.

## Remaining Resilience Backlog

| Priority | Item | Reason |
| --- | --- | --- |
| P2 | Add durable timeout/failure count rollups if operator dashboards need trend charts. | Current evidence exists in lifecycle rows, but rollups are not materialized. |
| P3 | Standardize a shared logging helper across scripts and services. | Useful for consistency, not required for current production safety. |
| P3 | Add manual GitHub Actions run-history capture to certification docs when connector access is available. | Current certification uses repository config and production health evidence. |
