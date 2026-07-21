# MLB Backtesting, Calibration And Model Audit

Certification: pending production smoke

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
