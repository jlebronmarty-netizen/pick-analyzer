# Adaptive Refresh Architecture V1

Pick Analyzer now has a read-only Adaptive Refresh Orchestrator in `src/services/adaptive-refresh-orchestrator.service.ts`.

It extends the existing Autonomous Daily Operations, Operating Day, Current Board, Next Slate and Provider Budget services. It does not create a second scheduler, does not call providers, and does not mutate predictions.

## Responsibilities

- Audit configured scheduler state.
- Read current operating day, next slate, Current Board, provider budget and lifecycle events.
- Normalize data freshness across schedule, odds, results, player context, feature snapshots, predictions, recommendations and settlement.
- Produce a refresh plan with affected games, estimated provider calls and the existing scheduler action that would perform the work.
- Forecast provider budget mode: `NORMAL`, `CONSERVATIVE`, `CRITICAL`, `EXHAUSTED`.
- Preserve stale-odds safeguards so stale or missing odds are not presented as actionable.

## Guardrails

- Provider calls added by status APIs: `0`.
- Prediction mutations: `0`.
- Official thresholds unchanged.
- Champion rows unchanged.
- V7 not promoted.
- Settlement policy unchanged.

Execution remains delegated to `/api/cron/operating-day`.
