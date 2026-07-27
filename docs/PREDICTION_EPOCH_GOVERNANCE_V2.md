# Prediction Epoch Governance V2

Status: Locally implemented as a migration-ready, read-only epoch governance contract.

`GET /api/data-foundation/epochs` exposes the epoch contract and validation without applying SQL, mutating `prediction_history`, archiving rows or activating a new production epoch.

## Epochs

Defined epochs:

- `LEGACY_EPOCH_V1`
- `DATA_FOUNDATION_V2_EPOCH`

`DATA_FOUNDATION_V2_EPOCH` is migration-ready only. It is not active.

Local validation on 2026-07-27:

- validation checks: 9/9 passed
- epochs defined: 2
- migrations created: 1
- local prediction rows audited: 0
- local production-eligible rows observed: 0
- provider calls: 0
- remote mutations: 0
- automatic activation: false

## Migration

Created but not applied:

- `supabase/migrations/202607270001_prediction_epoch_governance_v2.sql`

The migration is additive:

- creates `prediction_epochs`
- adds nullable `prediction_epoch_id` and `prediction_epoch_key` columns to `prediction_history`
- adds lookup indexes
- grants service-role access

## Activation Boundary

Manual activation is required before any production epoch change.

This phase does not:

- apply production SQL
- update prediction rows
- delete prediction rows
- archive legacy predictions
- activate the new epoch
- generate retrospective predictions

## Certification

Certification markers:

`PREDICTION_EPOCH_GOVERNANCE_V2_PASS`

`LEGACY_PREDICTION_PRESERVATION_PASS`

`PREDICTION_ROLLBACK_CONTRACT_PASS`
