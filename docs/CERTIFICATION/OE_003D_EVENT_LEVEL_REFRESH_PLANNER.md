# OE-003D Event-Level Refresh Planner Certification

Verdict: pending production certification.

Starting commit: `4232edd5579b09366a0aed2cc95b72c72b996d2d`

OE-003D implements the event-level refresh planner in `SHADOW` mode. It is read-only and does not execute provider refresh.

## Certified Local Behavior

- Independent per-event plans are generated from OE-003C lifecycle evidence.
- P0 closure/recovery outranks market refresh.
- Post-start pregame odds refresh is blocked.
- P1 final-30m events can receive a 5-minute target.
- Non-P1 final-30m events receive a 10-minute target.
- SportsDataIO projected costs are estimated with provider-efficient batching.
- The Odds API remains shadow-only while balance/reset/cost evidence is unknown.
- BSN remains observational without a certified provider execution path.
- The adaptive refresh plan exposes the shadow event plan without changing execution fallback.

## Production Certification Plan

Read-only endpoints:

- `/api/system/version`
- `/api/operations/event-lifecycle?sportKey=baseball_mlb&limit=200`
- `/api/operations/event-refresh-plan?sportKey=baseball_mlb&limit=200`
- `/api/operations/health`
- `/api/operations/adaptive-refresh/status`
- `/api/operations/settlement-guarantee?includeValidation=true`
- `/api/operations/mlb-autonomous-operations`
- `/api/providers/budget/status?provider=sportsdataio&sportKey=baseball_mlb`
- `/api/operations/provider-budget-forecast`
- `/api/dashboard/today`
- `/api/current-board?mode=current&limit=200`
- `/mlb-operations`

Expected counters:

- Provider calls: 0.
- Provider credits: 0.
- Database mutations: 0.
- Prediction/result/settlement/learning writes: 0.

OE-003E was not started.
