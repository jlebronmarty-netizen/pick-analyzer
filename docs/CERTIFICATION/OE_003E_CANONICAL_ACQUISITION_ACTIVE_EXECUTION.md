# OE-003E Canonical Acquisition Active Execution Certification

Verdict: pending production certification.

Starting commit: `562fdfa9c2f996206309217c6771bd1ef2e0a713`

Runtime target: bounded SportsDataIO MLB active acquisition through the protected adaptive scheduler path.

## Local Certification

Implemented:

- Canonical acquisition contract `canonical_acquisition_execution_v1`.
- SportsDataIO MLB-only active execution boundary.
- Date-level provider-efficient batching for current pregame odds.
- Deterministic deduplication key with bounded refresh window.
- Idempotent `sports_odds_snapshots` upsert.
- Provider response time separated from market snapshot time.
- Adaptive bridge integration before legacy odds execution.
- Operations Center evidence.
- OE-003E validator.

No prediction, probability, confidence, edge, EV, Official Pick, Rent Play, Moneyline Bet, Smart Parlay, settlement, learning, provider mapping, provider subscription, scheduler cadence or sport-certification changes are included.

## Production Certification Plan

Read-only first:

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

If active guards pass, execute one protected acquisition:

- route: `/api/cron/operating-day?dryRun=false`;
- provider: SportsDataIO;
- sport: `baseball_mlb`;
- action source: adaptive event-level market refresh;
- maximum initial provider calls: 1.

The execution must record actual calls, actual cost where proven, budget before/after, reserve impact, snapshot writes, unchanged rows, freshness before/after and deduplication evidence.

OE-003F was not started.
