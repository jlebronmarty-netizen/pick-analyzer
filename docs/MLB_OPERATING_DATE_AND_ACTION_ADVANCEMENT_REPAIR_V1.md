# MLB Operating Date and Action Advancement Repair V1

Date: 2026-07-20

## Summary

This repair fixes four runtime consistency defects without changing dashboard design, prediction formulas, recommendation policy, settlement formulas, learning formulas, Champion state or V7 state.

## Root Causes

1. Wrong selected date: `getOperatingDayAutomationStatus` used `getNextSlateStatus().selectedSlateDate`, which is a betting-active future slate selector. Late at night, unresolved July 19 games were no longer betting-active, so status refresh selected July 20.
2. Repeated `status_refresh`: status freshness required stale statuses to disappear instead of treating `SUCCESS_NO_CHANGE` with `providerCheckCompleted=true` as a successful provider check for the refresh window.
3. Health contradiction: operations health recomputed status freshness from events and ignored the latest `operating_day_lifecycle_events` provider evidence.
4. Dashboard false empty: Today degraded dependency fallbacks returned empty rows with no distinction between confirmed empty, timeout, failed query or fallback.

## Repairs

- Added `resolveMlbOperatingDate` to separate `localCalendarDate`, `activeOperatingDate`, `activeSlateDate`, `providerQueryDate`, `nextSlateDate` and `dateSelectionReason`.
- `status_refresh` and `sync_results` use an active unresolved prior slate before any next slate only inside the bounded recovery window.
- Older unresolved slates are classified as `STALE_ORPHAN_EXCLUDED` and surfaced through `excludedStaleOrphanCount`, `oldestUnresolvedDate` and `unresolvedEventsByDate`.
- `prepare_next_slate` may use the next slate.
- Automation reads latest `status_refresh` lifecycle evidence and sets `nextEligibleStatusRefreshAt`.
- `SUCCESS_CHANGED` and `SUCCESS_NO_CHANGE` both satisfy provider-check freshness.
- Added action-loop diagnostics: `consecutiveSameActionCount`, `actionStuck`, `nextActionReason`.
- Operations health now derives status provider evidence from persisted lifecycle rows before event-derived fallback.
- External scheduler verification is inferred from successful protected lifecycle evidence, not secret introspection.
- Today now distinguishes `AVAILABLE`, `EMPTY_CONFIRMED`, `QUERY_TIMEOUT`, `QUERY_FAILED` and `FALLBACK_LAST_KNOWN`.
- Today uses a bounded last-known stored slate fallback when the primary current-events query times out or fails.

## Expected Action Sequence

For late-night unresolved prior-day games:

1. `status_refresh` targets the unresolved active slate date.
2. A completed provider check records `nextEligibleStatusRefreshAt`.
3. Until that time, scheduler advances to odds/results work rather than looping status refresh.
4. `sync_results` continues targeting the unresolved active slate date.
5. `prepare_next_slate` may target the next slate separately.

For stale orphan residual rows outside the recovery window:

1. Puerto Rico `localCalendarDate` remains the operational primary date.
2. Older residual rows are diagnostics, not provider-query targets.
3. The scheduler can continue to current-day status, odds, results and downstream work.

## Migration

No migration is required. The repair uses existing `sport_events`, `operating_days`, `operating_day_lifecycle_events` and metadata contracts.

## Validation

Local validation:

- `npm.cmd run build`: PASS
- Static generation: 307 pages
- Provider calls: 0
- Remote mutations: 0

Production validation required after push/deploy:

- `/api/cron/operating-day?dryRun=false`
- `/api/operations/health`
- `/api/operations/adaptive-refresh`
- `/api/dashboard?mode=today`
- `/api/current-board`
- `/api/results/sync`

## Certification

- MLB Runtime Certification: FAIL until production evidence confirms the repaired action sequence.
- Closed Beta Ready: NO until production Today and scheduler evidence are consistent.
- Core Freeze Eligible: NO until production runtime evidence passes.
