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

## First Validation Window

Use a narrow completed NBA date window first. Validate one market at a time, starting with moneyline, then spread and total after moneyline passes. Keep provider calls capped and sequential.

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
