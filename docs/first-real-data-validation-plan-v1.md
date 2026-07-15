# First Real-Data Validation Plan V1

Last updated: 2026-07-14

## Objective

Promote from trial validation to real production evidence only after a small, explicitly approved import proves genuine prices, stable mappings, leakage-safe feature snapshots and settlement correctness.

## Required Approval

Before execution, approval is required for:

- Exact provider endpoints and date/season scope.
- Maximum provider-call budget and concurrency.
- Production eligibility for imported rows.
- Prediction persistence using real rows.
- Backtesting, calibration, CLV and model-learning use.
- Any migration that is not already applied.

## Minimum Real-Data Contract

Rows must be:

- `trial=false`
- `scrambled=false`
- `production_eligible=true`
- Mapped to stable sport, league, event, team, market and provider IDs.
- Linked to prediction-time odds snapshots.
- Linked to durable pregame feature snapshots.
- Generated at or before cutoff and before event start.
- Settled only from final results with supported market rules.

Discovery/provider-specific quarantine:

- SportsDataIO MLB Discovery Lab rows must start as `trial=false`, `scrambled=false`, `production_eligible=false` and `validation_status=quarantined`.
- If a table constraint does not yet permit literal `validation_status='quarantined'`, preserve quarantine in row metadata and keep `production_eligible=false` until an additive schema decision is approved.

Prospective MLB Day 1 readiness is now documented in `docs/mlb-live-validation-readiness-v1.md`, `docs/mlb-daily-operations-v1.md` and `docs/mlb-30-day-validation-scorecard-v1.md`. It uses Puerto Rico local-date resolution, date-wide capture windows, event-aware cutoff selection and a conservative 6/8/12 daily call budget, but remains disabled until explicitly activated.
- The Discovery Lab paid key proves access only to confirmed endpoints. It does not authorize production promotion.
- Enterprise `/v3/mlb/...` paths are not valid substitutes for Discovery Lab `/api/mlb/{product}/json/{endpoint}` paths.

## First Validation Window

Use a narrow completed NBA date window first for production-eligible validation because NBA has the deepest trial lineage evidence. For MLB Discovery Lab, endpoint confirmation now exists and Batch V1 persisted quarantined `2026-07-12` teams, players, events, stats, 90 date-level odds rows and 36,442 line-movement odds rows. The approved expansion proved timestamp-safe pregame odds exist for all 15 events, with 25,498 rows at or before a 10-minute pregame cutoff. The bounded MLB lineage validation now proves the Feature Store -> Prediction History -> Settlement path for 45 quarantined MLB rows across moneyline, spread/run line and total, with 0 provider calls during lineage and 0 production leakage. Broader MLB validation still requires explicit approval for production promotion rules, genuine closing-snapshot/CLV handling and larger-sample confidence thresholds. Keep provider calls capped and sequential.

## Acceptance Checks

- No provider transport failures.
- No duplicate natural keys or snapshot links.
- No orphan event/team/player references.
- No timestamp leakage.
- No trial/scrambled rows in production metrics.
- CLV uses genuine closing snapshots only.
- Settlement fixtures pass before settlement.
- Backtest/calibration sample is reported as limited until enough production rows exist.
- Model promotion remains blocked until minimum production sample requirements are met.

## Rollback And Stop Rules

Stop immediately on transport failure, non-200 response, mapping conflict, duplicate production identity, missing offered price, timestamp leakage, unsupported settlement semantics or any trial row entering a production metric.
