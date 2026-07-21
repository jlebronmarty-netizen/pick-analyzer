# MLB Backtesting, Calibration And Model Audit

Certification: `MLB_MODEL_AUDIT_PASS_INSUFFICIENT_SAMPLE`

Date: 2026-07-21

## Scope

`mlb_model_audit_v1` audits stored MLB prediction history only. It performs no provider calls, no database writes, no calibration mutation, no model-weight changes, no recommendation-threshold changes and no Current Board, Official Pick, settlement or scheduler changes.

## Route

- `GET /api/mlb/model-audit?season=2026`
- `GET /api/mlb/model-audit?season=2026&includeValidation=true`

## Cohort Rules

The audit uses only predictions that:

- are settled as win/loss/push;
- were generated at or before game start;
- retain an inline or durable feature snapshot reference.

Rows generated after game start are counted and excluded. Settled rows missing immutable feature snapshots are counted and excluded.

## Metrics

The audit reports win rate, push rate, ROI when stake/profit exist, units when stake/profit exist, Brier score, log loss, expected versus actual win rate, calibration buckets, performance by market, model version, confidence band, edge band and feature-quality band.

Closing-line comparison remains unavailable unless genuine opening and closing odds history exists.

## Threshold Policy

Recommendation thresholds, official-pick eligibility, minimum feature quality, market quality, EV, edge and risk policy are preserved. The audit may certify the framework with insufficient sample rather than forcing recalibration.

## Production Certification

Production commit `c9534afa275743a071bff0f9a2f92e12326a7c01` passed read-only smoke on 2026-07-21:

- Route success: true.
- Certification: `MLB_MODEL_AUDIT_PASS_INSUFFICIENT_SAMPLE`.
- Provider calls: 0.
- Remote mutations: 0.
- Validation: 8/8 fixture checks passed.
- Prediction rows: 909.
- Settled rows: 593.
- Eligible no-leakage immutable-snapshot cohort: 0.
- Official eligible audit cohort: 0.
- Post-start settled rows excluded: 561.
- Settled rows missing immutable feature snapshots excluded: 548.
- Duplicate prediction key review candidates: 282.
- Calibration status: `INSUFFICIENT_SAMPLE_FOR_THRESHOLD_CHANGE`.

No threshold, recommendation, calibration, Current Board, Official Pick, settlement or scheduler change was made.
