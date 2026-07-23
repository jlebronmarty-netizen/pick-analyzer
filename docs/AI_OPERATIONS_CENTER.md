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

V2 adds daily evidence stages for Today, Yesterday and Last 7 Days:

- games
- odds
- predictions
- board candidates
- official picks
- completed games
- settlements
- labels
- accepted learning samples
- rejected samples
- shadow learning
- weight updates

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

Learning is never claimed unless persisted evidence exists. Deterministic settled rows can be shown as candidates. They are accepted for shadow validation only when point-in-time feature evidence exists. They are treated as trained/applied only when persisted model-weight history proves it.

Missing next scheduler times are displayed as `Waiting for next scheduler execution`.
