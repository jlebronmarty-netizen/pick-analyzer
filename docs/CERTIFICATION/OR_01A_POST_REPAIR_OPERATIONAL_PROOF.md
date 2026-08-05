# OR-01A Post-Repair Operational Proof

Date: 2026-08-05

Starting commit: `21f8d135f665fcf39cf2db6d64462ca9251d348e`

## Verdict

`OR_01A_EXTERNAL_WAIT_CADENCE_AND_NEXT_MARKET_WINDOW_PROOF`

OR-01A did not certify operational recovery. The OR-01 runtime repair is live, but current production evidence does not prove restored Market Freshness, Scheduler Execution Health, Operational Health or Product Readiness.

MC-08H was not rerun.

Manual protected writer executions: 0.

## Baseline

- Local HEAD: `21f8d135f665fcf39cf2db6d64462ca9251d348e`
- `origin/main`: `21f8d135f665fcf39cf2db6d64462ca9251d348e`
- Production `/api/system/version`: `21f8d135f665fcf39cf2db6d64462ca9251d348e`

## Before Snapshot

| Domain | Evidence |
| --- | --- |
| Adaptive Refresh | `status=SUCCESS`, `nextAction=sync_results`, due step `results:PENDING:30:1`, `activeMarketRefreshPreemptsHistoricalResultRecovery=false`. |
| Current Board | Current Board candidates 0, games 0, latest odds null, freshness `empty`. |
| Dashboard Today | `status=PARTIAL`, current games 15, upcoming games 15, prediction candidates 0, latest odds null, freshness `empty`. |
| Operations Health | `status=CRITICAL`; Scheduler Execution: CRITICAL; Market Freshness: UNKNOWN; Provider Budget: HEALTHY; Settlement Closure: CRITICAL; Product Readiness: CRITICAL. |
| Scheduler Evidence | Last successful protected invocation `2026-08-04T23:35:22.311+00:00`; missed intervals 18; scheduler running false. |
| Provider Budget | SportsDataIO mode normal/healthy, calls made today 0, estimated remaining 850, last provider call `2026-08-04T23:35:22.336437+00:00`. |
| Settlement | Settlement guarantee checked 148, completed 97, settled 97, ready 0, blocked 0, silent pending 0. |
| Older Recovery Backlog | 9 older completed prediction rows still lack canonical game_results: 3 on 2026-07-27 and 6 on 2026-07-28. |
| Performance | 105 total analyzed rows, 69 canonical rows, 24 settled canonical rows, recommendation eligible 0, grade F, trust LIMITED. |

## Post-Repair Writer Evidence

Public GitHub Actions metadata showed scheduled production writer runs on the OR-01 runtime commit:

| Run ID | Trigger | Commit | Started | Updated | Conclusion |
| --- | --- | --- | --- | --- | --- |
| `30961154690` | schedule | `21f8d135f665fcf39cf2db6d64462ca9251d348e` | `2026-08-04T23:47:12Z` | `2026-08-04T23:47:33Z` | success |
| `30965570325` | schedule | `21f8d135f665fcf39cf2db6d64462ca9251d348e` | `2026-08-05T01:09:51Z` | `2026-08-05T01:10:09Z` | success |

GitHub run logs returned HTTP 403, so the protected invocation response body, selected action from the workflow log and exact curl output could not be inspected from this environment.

Application-side production evidence did not advance past `2026-08-04T23:35:22.311+00:00` for the last successful protected invocation, and Operations Health still reports scheduler cadence CRITICAL.

## Manual Execution Decision

No manual protected writer was executed.

Reasons:

- public GitHub metadata already shows post-repair scheduled runs on `21f8d13`;
- the canonical current action is now `sync_results`, not active-market `midday_refresh`;
- event-refresh planning reports 15 `STOP_PREGAME_REFRESH` actions and 0 execution-enabled market refresh actions;
- active markets are no longer inside the certified pregame refresh window;
- forcing `midday_refresh` now would violate the canonical planner and the OR-01A one-writer safety rule.

## Health Classification

| Domain | Classification | Evidence |
| --- | --- | --- |
| Market Freshness | UNKNOWN | Current Board is empty with no current visible odds timestamp. This is not HEALTHY and was not greenwashed from page `generatedAt`. |
| Scheduler Execution | CRITICAL | Last successful protected invocation `2026-08-04T23:35:22.311+00:00`, missed intervals 18, scheduler running false. |
| Provider Budget | HEALTHY | SportsDataIO budget healthy, calls made today 0, estimated remaining 850. |
| Settlement Closure | CRITICAL | No ready/silent pending rows, but 9 older missing-result rows remain visible. |
| Product Readiness | CRITICAL | Current Board has no candidates and Operations Health is CRITICAL. |
| Operational Health | CRITICAL | Limiting domain: schedulerExecution. |

## Decision

OR-01 production proof remains incomplete.

Production Ready: NO.

Production Pilot Week: NOT READY.

MC-03: NOT STARTED.

Next human action: inspect GitHub Actions repository scheduling/secret/execution logs in the GitHub UI and confirm why successful scheduled runs after `21f8d13` did not advance the application-side protected invocation ledger beyond `2026-08-04T23:35:22.311+00:00`.
