# OE-003D Event-Level Refresh Planner

Status: implemented pending production certification.

OE-003D adds a canonical event-level refresh planner in `SHADOW` mode. The planner decides per event, estimates provider-efficient batching, and reports budget authorization without executing provider calls or mutating data.

## Contract

Canonical route: `/api/operations/event-refresh-plan`

Default behavior:

- `sportKey=baseball_mlb`
- current Puerto Rico operating date through OE-003C lifecycle defaults
- `limit=50`, bounded to 200
- `plannerMode=SHADOW`
- provider calls 0
- database mutations 0

The planner consumes `/api/operations/event-lifecycle` evidence and preserves the existing operating-day acquisition path as the only active execution path.

## Planning Precedence

1. P0 closure and recovery: `SYNC_RESULT`, `SETTLE`, `RECOVERY`.
2. Post-start protection: `STOP_PREGAME_REFRESH`; no pregame odds refresh after start.
3. P1 actionable lock-window or recommendation-relevant events.
4. P2 events inside two hours.
5. P3 same-day active events.
6. P4 future/informational events.
7. P5 archived/no-action events.

Closure work outranks market refresh.

## Initial Cadence Policy

SportsDataIO MLB targets:

- More than 24h: 60 minutes.
- 6-24h: 30 minutes.
- 2-6h: 15 minutes.
- 30m-2h: 10 minutes.
- Final 30m: 5 minutes only for P1/actionable events; 10 minutes for other eligible events.
- After start: stop pregame refresh.
- Final without result: `SYNC_RESULT/P0`.

The Odds API remains shadow-only while current balance/reset/cost evidence is unknown. BSN remains observational until an active provider path is certified.

## Deduplication

The planner follows:

`DECIDE_PER_EVENT -> EXECUTE_WITH_PROVIDER_EFFICIENT_BATCHING -> STORE_ONE_CANONICAL_SNAPSHOT -> SERVE_MANY_PRODUCT_SURFACES`

OE-003D does not create a second acquisition pipeline and does not make Today, Current Board, Rent Play, Best Value or Workspace call providers independently.

## Adaptive Integration

`/api/operations/refresh-plan` now exposes a compact `eventRefreshPlan` shadow summary. Existing adaptive execution still falls back to the certified operating-day action selection.

## Safety

- Planner mode: `SHADOW`.
- Active execution enabled: false.
- Provider calls introduced: 0.
- Provider credits consumed: 0.
- Database mutations: 0.
- Prediction/result/settlement/learning writes: 0.
- Scheduler cadence changed: false.
- Refresh cadence changed: false.
- Official Pick policy changed: false.
- Prediction formula changed: false.

OE-003E was not started.
