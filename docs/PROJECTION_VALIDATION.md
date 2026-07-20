# Projection Validation V1

Projection validation compares only:

Projection -> Actual Outcome

It never compares projections to sportsbook lines.

Metrics:
- MAE
- RMSE
- MAPE
- Bias
- Calibration
- Prediction Drift
- Confidence Calibration

Integrity diagnostics:
- Duplicate projection IDs
- Null player entity IDs
- Duplicate event/entity/projection keys
- Incorrect event mappings
- Unverified participants
- Unit failures
- Plausibility failures
- League-baseline-only rows
- Projection rank distribution

Validation is stored in `universal_projection_history` after actual outcomes are attached.

Until enough settled projection rows exist, AI Brain reports projection readiness as `INSUFFICIENT_HISTORY`.
