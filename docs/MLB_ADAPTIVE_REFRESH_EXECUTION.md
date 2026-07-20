# MLB Adaptive Refresh Execution V1

Status: plan-only diagnostic.

Adaptive Refresh currently plans refreshes and delegates execution to the existing operating-day scheduler. It does not call providers from status endpoints.

## Execution Status

`PLANNED_NOT_EXECUTED`

## Evidence

- `/api/operations/status`
- `/api/operations/adaptive-refresh/status`
- `/api/mlb/temporal-health`

The status layer audits:

- planned refreshes;
- provider budget;
- lifecycle state;
- freshness state;
- estimated provider calls;
- existing scheduler action.

It does not dispatch protected provider endpoints directly. Provider calls added by this mission: `0`.

## Cadence Proposal

The proposal is configurable and evidence-based:

- Schedule: daily slate rollover.
- Odds: stale or missing prices become due when games are pregame and budget allows.
- Predictions/features: regenerate only through existing operating-day pipeline after safe inputs.
- Results/settlement: after authoritative final results.
- Lineups: unsupported under current ingestion plan.

No additional provider usage is activated by this mission.
