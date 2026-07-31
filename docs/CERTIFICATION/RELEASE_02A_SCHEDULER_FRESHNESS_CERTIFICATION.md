# Release 02A Scheduler Freshness Certification

Status: LOCAL PASS / PRODUCTION SCHEDULED OBSERVATION PENDING

Release 02A repairs the Release 02 production blocker by ensuring successful protected heartbeat executions update the canonical scheduler health marker.

## Verdict

Local repository certification: PASS after validation.

Production certification: pending one automatic deployment and a subsequent scheduled heartbeat or writer run.

## Root Cause

Successful GitHub heartbeat executions used `dryRun=true`. The application returned the dry-run plan without persisting lifecycle evidence, while operations health trusted `operating_day_lifecycle_events` as the canonical success marker. This made scheduler health appear late/critical even when a protected observer heartbeat could have succeeded.

## Code Changes

| File | Change |
| --- | --- |
| `src/services/operating-day.service.ts` | Added `recordOperatingDaySchedulerHeartbeat`, which writes an operational-only lifecycle event with zero provider calls and no product-data mutation. |
| `src/app/api/cron/operating-day/route.ts` | Records heartbeat evidence after successful protected dry-run execution. Failed dry-runs do not update health. |
| `src/services/pregame-scheduler-coverage.service.ts` | Uses canonical scheduler config constants and documents heartbeat as `dryRun=true`. |
| `scripts/release02a-scheduler-freshness-validate.mjs` | Adds bounded static validation for scheduler definitions, freshness boundaries, heartbeat marker behavior, strict settlement guarantee and dirty-file preservation. |

## Certification Requirements

| Requirement | Local Status |
| --- | --- |
| No conflicting canonical cadence | PASS |
| Timezone/cadence calculation deterministic | PASS |
| Freshness interval boundary cases | PASS |
| Successful scheduler execution updates health marker | PASS |
| No-work dry-run records scheduler freshness | PASS |
| Failed execution does not report healthy | PASS |
| Settlement guarantee remains strict | PASS |
| No retrospective prediction writes | PASS |
| Release 01 validator still passes | PASS |
| Release 02 validator still passes | PASS |
| Build passes | PASS |
| JSON validation passes | PASS |
| Targeted secret scan passes | PASS |
| `git diff --check` passes | PASS |
| Unrelated dirty files untouched | PASS |

## Production Pass Criteria

- `/api/system/version` serves the Release 02A commit.
- `/api/dashboard/today` returns HTTP 200.
- `/api/operations/settlement-guarantee?includeValidation=true` returns PASS or a documented non-critical scheduler state.
- Scheduler cadence is not `CRITICAL`.
- `readyForSettlementRows = 0`.
- `silentPendingRows = 0`.
- Embedded validation passes.
- Certification checks make zero provider calls and no database mutations.
- The next scheduled heartbeat or writer run creates normal scheduler-owned operational evidence; no manual heartbeat forging.

## Current Release 02 Upgrade State

Release 02 can be upgraded from CONDITIONAL PASS to PASS only after production observes the deployed Release 02A repair and settlement guarantee is no longer blocked by a critical scheduler cadence.
