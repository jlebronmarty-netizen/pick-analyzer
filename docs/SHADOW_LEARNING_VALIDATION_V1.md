# Shadow Learning Validation V1

Status: shadow-only evidence bridge.

## Scope

Shadow learning may use accepted feature/label evidence to create a chronological validation bridge. It does not activate production weights.

## Split

Accepted samples are sorted by time and split chronologically:

- training
- validation
- holdout

Random splits are not allowed.

## Activation Gate

Production weight updates require:

- sufficient accepted sample
- zero leakage
- deterministic labels
- chronological holdout
- Brier non-worsening
- Log Loss non-worsening
- calibration within tolerance
- no material market subgroup collapse
- rollback readiness

Current status is `WEIGHT_UPDATE_BLOCKED_INSUFFICIENT_EVIDENCE`.
