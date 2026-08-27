# PICK-2.0 RESET-02B Route / Service Consolidation

Status: `PICK_2_RESET_02B_ROUTE_SERVICE_CONSOLIDATION_CERTIFIED`

RESET-02B continued the runtime cleanup from the production-ready RESET-02A commit. It used the RESET-01 and RESET-02A manifests as authority, then removed only uncalled, manifest-archived API route wrappers.

## Routes Removed

- `/api/ai/game-analysis`
- `/api/ai-operations/lifecycle`
- `/api/ai-performance-center/daily-update`
- `/api/autonomous-daily-operations/demo`
- `/api/autonomous-daily-operations/simulation`

These routes had no active `src` callers and no cron dependency. Their underlying services were preserved when those services still have other runtime, panel, or audit uses.

## Deferred

The `/api/mlb/projections` alias remains because dashboard panels actively fetch it. Active cron routes remain unchanged. AI/bet-finder surfaces with live dashboard callers, MLB-04 research endpoints, SportsDataIO rollback diagnostics, and broad NBA/NFL/BSN runtime remain deferred.

## Safety

- Provider calls: 0
- Production DB mutations: 0
- Production DML: 0
- Table/schema changes: 0
- Prediction writes: 0
- Model changes: 0
- Calibration changes: 0
- Product writes: 0
- Automation activated: NO
- New cron: NO

Core safety infrastructure remains preserved, including temporal/as-of helpers, deterministic identity, idempotency, frozen evidence, readback parity, event/result linkage, provider budgeting, raw/calibrated separation, protected auth, and `/api/system/version`.
