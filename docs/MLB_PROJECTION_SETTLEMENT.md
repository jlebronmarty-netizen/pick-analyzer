# MLB Projection Settlement

Projection history is separate from betting `prediction_history`.

GET requests are read-only. POST remains dry-run by default. Protected persistence may write only valid user-visible projections after temporal, identity, event, unit, plausibility and deduplication checks pass.

Settlement fields are designed for:

- Projected value.
- Actual value.
- Signed error.
- Absolute error.
- Squared error.
- Percentage error when mathematically valid.
- Model version.
- Readiness at projection time.
- Starter or participation certainty.
- Generated-at and settled-at timestamps.
- Invalidation reason.

Invalid or post-start projections must not become legitimate pregame projection samples.

