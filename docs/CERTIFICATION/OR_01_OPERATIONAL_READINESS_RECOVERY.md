# OR-01 Operational Readiness Recovery

Date: 2026-08-04

Starting production commit: `1cdfe1061453a738cbf019acbcd123479362cc05`

## Verdict

`OR_01_REPOSITORY_RECOVERY_DEPLOYMENT_REQUIRED`

Repository recovery is complete for the proven scheduler-action starvation defect. Production readiness is not certified until the automatic writer runs against this repair and current production evidence shows fresh active markets and current scheduler cadence.

## Root Cause

Production evidence showed three independent CRITICAL states:

- Scheduler Execution: CRITICAL, latest successful protected invocation age 48 minutes, missed intervals 3.
- Market Freshness: CRITICAL, latest visible market snapshot `2026-08-04T11:41:18.639Z`, age 686 minutes, 30 visible markets, 0 fresh.
- Settlement Closure: CRITICAL, 9 completed prediction rows missing canonical `game_results`, oldest missing date `2026-07-27`.

Adaptive refresh selected `sync_results` when both active market refresh and older missing-result recovery were due. Because the missing-result backlog was older than the active slate, this could repeatedly select historical result recovery ahead of active market acquisition and keep current betting surfaces stale.

## Repair

`src/services/adaptive-refresh-orchestrator.service.ts` now allows active market refresh to preempt older missing-result recovery only when:

- odds are due for the active slate;
- no settlement-ready rows exist;
- missing result rows remain;
- the oldest missing-result date is older than the active slate.

Settlement still has highest priority. True result sync remains available. Settlement eligibility still requires authoritative `game_results` with scores. No prediction, ranking, Official Pick, Rent Play, Moneyline, Smart Parlay, Kelly, model, settlement, learning, provider contract, or scheduler cadence rule changed.

## Production Evidence Before Repair

| Surface | Evidence |
| --- | --- |
| `/api/operations/health` | `status=CRITICAL`; schedulerExecution `CRITICAL`; marketFreshness `CRITICAL`; providerBudget `HEALTHY`; settlementClosure `CRITICAL`; productReadiness `CRITICAL`. |
| `/api/operations/adaptive-refresh/status` | `status=PARTIAL`; due `odds:STALE:10:1` and `results:PENDING:25:1`; selected next action `sync_results`; provider budget allowed plan. |
| `/api/current-board?mode=current&limit=200` | 10 games, 30 candidates, latest odds `2026-08-04T11:41:18.639Z`, freshness `stale`, 0 fresh visible markets. |
| `/api/dashboard/today` | 15 current games, 10 upcoming games, 30 prediction candidates, latest odds `2026-08-04T11:41:18.639Z`, freshness `stale`. |
| `/api/operations/event-refresh-plan?sportKey=baseball_mlb&limit=200` | 15 events, 10 execution-enabled `REFRESH_MARKET` actions. |
| `/api/operations/settlement-guarantee?includeValidation=true` | checked 148, completed 97, settled 97, ready 0, blocked 0, silent pending 0, missing-result evidence 9. |

## Status After Repository Repair

- Market Freshness: REMAINS CRITICAL until production writer refreshes active markets.
- Operational Health: REMAINS CRITICAL until production writer cadence and market freshness recover.
- Product Readiness: REMAINS CRITICAL until limiting domains recover or are proven external-only.
- Provider calls during OR-01 certification reads: 0.
- Remote mutations during OR-01 certification reads: 0.

## Required Production Proof

After deployment, rerun read-only production evidence:

- `/api/system/version`
- `/api/operations/health`
- `/api/operations/adaptive-refresh/status`
- `/api/operations/event-refresh-plan?sportKey=baseball_mlb&limit=200`
- `/api/current-board?mode=current&limit=200`
- `/api/dashboard/today`
- `/api/operations/settlement-guarantee?includeValidation=true`

OR-01 can advance only when:

- production serves the OR-01 repair commit;
- automatic protected writer invocation is current;
- active market freshness is HEALTHY or any remaining CRITICAL is proven external-only;
- product readiness no longer hides stale market or scheduler evidence;
- provider calls and writes are reported only from the protected writer, not certification reads.
