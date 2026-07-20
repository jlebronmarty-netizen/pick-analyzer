# AI Evolution

AI Evolution compares current measured performance against previous windows:

- Today
- Yesterday
- 7 days
- 30 days
- Season
- Lifetime
- Model version

Metrics include accuracy, Brier Score, calibration error, Trust Score, data quality, feature quality, confidence quality and readiness.

ROI and yield are returned only when legitimate stored odds, stake/profit and settlement data exist. Shadow probability-only predictions return `null`.

Durable snapshots are idempotent through `ai_performance_snapshots.idempotency_key`.
