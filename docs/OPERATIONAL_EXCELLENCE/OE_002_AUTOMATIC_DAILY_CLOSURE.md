# OE-002 Automatic Daily Closure

Status: CONDITIONAL PASS pending post-deployment scheduler observation.

## Root Cause

Production evidence showed completed MLB prediction rows blocked by `RESULT_NOT_IMPORTED` even though no settlement-ready or silent-pending rows existed. The adaptive scheduler only treated results as due when the active dashboard slate had final games. A prior completed event with no canonical `game_results` row was visible to settlement monitoring, but not actionable to the result-import planner.

## Repair

`src/services/adaptive-refresh-orchestrator.service.ts` now counts pending prediction rows whose linked `sport_events` row is final/scored but has no authoritative `game_results` row. That condition makes the `results` domain `DUE_NOW` and selects `sync_results` for the oldest missing-result operating date.

The repair does not infer scores, settle rows, create labels, change prediction logic, change probability, change Official Picks, change Kelly, change learning weights, or change provider contracts.

## Production Evidence Before Repair

- Production commit: `829db0e2b8b9412f4bd4b6bd237c15636e6bc826`.
- `/api/operations/settlement-guarantee?includeValidation=true`: completed prediction rows 15; settled rows 12; ready rows 0; blocked rows 3; silent pending rows 0; blocked reason `RESULT_NOT_IMPORTED`.
- Blocked event: `baseball_mlb:mlb:sportsdataio:event:78934`, `NYY @ CHC`, start `2026-07-31T18:20:00+00:00`.
- `/api/performance`: yesterday generated 45 prediction rows, 0 production-settled rows for the yesterday bucket at observation time; season settled rows 485 and pending 0 in eligible performance scope.
- `/api/operations/health`: status `DEGRADED`, blocker `odds_not_current`, scheduler cadence `HEALTHY`, missed intervals 0.

## Operational Summary

| Area | Status | Evidence |
| --- | --- | --- |
| Today's Events | PRESENT | Dashboard reported 15 current-day MLB games for `2026-08-01`. |
| Predicted | PRESENT | Dashboard current-day predictions were generated from stored data. |
| Eligible | BLOCKED_BY_MARKETS | Dashboard reported 15 games missing market prices. |
| Skipped | NONE | July 31 scheduler coverage reported 0 skipped games. |
| Live | NONE_AT_OBSERVATION | Dashboard current slate reported 0 live games. |
| Final | PARTIAL_PRIOR_DAY | Settlement guarantee found completed prior-day rows. |
| Settled | PARTIAL | Settlement guarantee found 12 settled completed rows. |
| Learning Labels | PARTIAL | 12 settled rows available for learning evidence; no model training. |
| Performance Updated | PARTIAL | Performance includes settled rows but excludes missing-result blocked rows. |
| Scheduler | HEALTHY | Settlement guarantee scheduler health reported missed intervals 0. |
| Result Import | REPAIRED_PLANNER | Missing canonical results now make `sync_results` due. |
| Settlement | HEALTHY_WITH_BLOCKS | 0 ready rows, 0 silent pending rows, explicit blocked reason present. |
| Learning | READ_ONLY_DERIVED | Learning evidence derives from settled prediction history only. |
| Dashboard | SYNCHRONIZED_WITH_STORED_DATA | Dashboard reports current slate separately from settlement guarantee. |

## Certification Boundary

OE-002 validates that the automatic scheduler will select the existing result importer when canonical result evidence is missing for completed prediction rows. Final PASS requires observing a later automatic scheduler run import the missing result and then observing settlement/performance closure without manual provider calls.
