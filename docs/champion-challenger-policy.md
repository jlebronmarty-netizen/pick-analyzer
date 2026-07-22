# Champion Challenger Policy

Learning Brain separates daily learning from model promotion.

## Champion

The current V1 champion is `mlb_pitcher_outs_shadow_baseline_v1`.

## Challenger

A challenger can be trained only from leakage-safe temporal datasets built from immutable feature snapshots and settled outcomes.

## Promotion Gate

Promotion requires:

- minimum holdout sample
- no leakage finding
- expected-outs MAE improvement or approved tolerance
- average threshold Brier improvement
- no material calibration regression
- no critical threshold regression
- stable missing-data behavior
- rollback target preserved

If sample is insufficient, the challenger status is `INSUFFICIENT_SAMPLE` and no promotion occurs.
