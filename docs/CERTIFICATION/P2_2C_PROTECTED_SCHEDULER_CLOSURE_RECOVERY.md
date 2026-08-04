# P2.2C Protected Scheduler 409 Diagnostic And Closure Recovery

Status: REPAIR_DEPLOYED_EXTERNAL_SETTLE_PENDING

P2.2C investigated the protected scheduler HTTP 409 that occurred after P2.2B.

## Findings

- The 409 root cause was `BUDGET_BLOCKED`.
- The selected action was `sync_results`.
- The selected recovery date was `2026-07-27`.
- The blocked reason was `MLB_STATS_API_AUTHORIZATION_POOL, UNKNOWN_COST_MODEL, UNKNOWN_BUDGET_FAILS_CLOSED`.
- This was a repository budget-model defect: `sync_results` mapped to `mlb_stats_api`, but the provider budget service did not classify MLB Stats API as a known bounded HTTP provider.

## Repairs

- Added a bounded `mlb-stats-api` provider budget profile.
- Added bounded HTTP request cost modeling for MLB Stats API `sync_results` and `status_refresh`.
- Prevented internal settlement actions from inheriting unrelated provider-call budget demand.
- Prevented mutation-producing protected executions from being labeled `SUCCESS_NO_CHANGE`.

## Production Evidence

- Runtime commit `9cfa84e134d12015b8fede4afa4016afa3e1c091` cleared the budget defect.
- One protected post-repair execution returned HTTP 200 and selected `sync_results`.
- Provider calls: 1.
- Remote mutations: 12.
- Rows received: 53.
- Aug 3 events moved to `SETTLEMENT` with imported results.
- Current `nextAction` is `settle`.
- Current Era remains 69 canonical predictions, 0 settled, 69 pending until settlement execution completes.

## Current Stop Condition

P2.2 closure is not certified yet because settlement has not executed after result import.

Final classification: `EXTERNAL_WAIT_SETTLEMENT_EXECUTION`.

