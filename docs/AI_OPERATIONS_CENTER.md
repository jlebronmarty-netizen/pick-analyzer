# AI Operations Center

Status: implemented
Mode: `ai_learning_lifecycle_v1`
Route: `/ai-operations`
API: `/api/ai-operations/lifecycle`

## Purpose

The AI Operations Center shows whether the daily AI lifecycle has persisted evidence for each stage:

- Prediction Pipeline
- Current Board
- Settlement Queue
- Replay Queue
- Learning Queue
- Weight Updates
- Calibration
- Provider Health
- Scheduler Health
- Historical Imports
- Feature Store

Each panel reports one operational status: `Healthy`, `Waiting`, `Blocked`, `Running`, `Completed` or `Error`.

## Isolation

The center is read-only. It does not run prediction generation, settlement, replay, model learning, weight updates, provider refreshes or Official Pick promotion. Provider calls remain `0`; provider health comes from stored budget accounting.

## Evidence Sources

- `sport_events`
- `sports_odds_snapshots`
- `prediction_history`
- `universal_projection_history`
- `historical_feature_snapshots`
- `model_weight_history`
- `ai_performance_snapshots`
- `sports_sync_jobs`
- existing calibration read model
- existing provider budget read model

## Product Semantics

Learning is never claimed unless persisted evidence exists. Deterministic settled rows can be shown as queue candidates, but they are not treated as accepted learning samples unless a persisted model-weight history row exists after settlement.

Missing next scheduler times are displayed as `Waiting for next scheduler execution`.
