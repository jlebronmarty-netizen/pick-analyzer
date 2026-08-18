# NFL-04R1 Frozen Model Artifact

Status: `NFL_04R1_FROZEN_MODEL_ARTIFACT_MATERIALIZED_CERTIFIED`

NFL-04R1 materializes the already-certified NFL-03 frozen model into a
runtime-loadable JSON artifact. It does not train, refit, recalibrate, call
providers, mutate production data, write predictions or activate NFL Current
Era product surfaces.

## Artifact

- Path: `artifacts/nfl/nfl-03-frozen-runtime-model.json`
- Model version: `nfl_ml_score_baseline_v1`
- Feature version: `nfl_temporal_pregame_feature_set_v1`
- Calibration version: `nfl_ml_score_baseline_platt_2024_v1`
- Ordered features: 86

## Parity

- Rows compared: 1311
- Max calibrated probability delta: 0
- Max home-score delta: 0
- Max away-score delta: 0

## Reproduced Metrics

- 2024 validation Brier: 0.2216
- 2024 validation log loss: 0.6335
- 2025 holdout Brier: 0.2329
- 2025 holdout log loss: 0.6585

## Safety

Provider calls: 0. Production database mutations: 0. Existing NFL
`prediction_history` and legacy Official Pick rows are not inputs and were not
mutated.
