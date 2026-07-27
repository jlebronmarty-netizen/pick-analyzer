# Prediction Epoch Migration Detection Fix V1

Status: Locally implemented, pending push/deploy approval.

## Root Cause

`GET /api/data-foundation/epochs` reported `migrationApplied: false` because `src/services/prediction-epoch-governance-v2.service.ts` hardcoded migration detection instead of probing the deployed schema.

The root migration intentionally creates no seed rows and performs no activation. Therefore `prediction_epochs` can validly exist with zero rows immediately after SQL Editor application. The old response treated the planned migration contract as static state and could not distinguish migration missing from migration applied with an empty table.

## Corrected Contract

Canonical migration state now comes from `src/services/prediction-epoch-migration-state.service.ts`.

States:

- `NOT_APPLIED`
- `APPLIED_EMPTY`
- `APPLIED_UNSEEDED`
- `APPLIED_INACTIVE`
- `APPLIED_ACTIVE`
- `PARTIALLY_APPLIED`
- `SCHEMA_CACHE_PENDING`
- `VERIFICATION_ERROR`

Core fields include `migrationApplied`, `migrationState`, `tableExists`, `epochColumnsExist`, `epochRowCount`, `activeEpochCount`, `legacyEpochPresent`, `v2EpochPresent`, `newEpochActive`, `legacyBehaviorActive`, `activationRequired`, `schemaCacheWarning` and `verificationWarnings`.

## Empty Table Behavior

If `prediction_epochs` is readable and `prediction_history.prediction_epoch_id` / `prediction_history.prediction_epoch_key` are readable, but `prediction_epochs` has zero rows, the state is:

- `migrationApplied: true`
- `migrationState: APPLIED_EMPTY`
- `newEpochActive: false`
- `legacyBehaviorActive: true`
- `activationRequired: true`

An empty table is not classified as missing.

## Partial Migration Behavior

Partial states are explicit:

- table visible but epoch columns missing: `PARTIALLY_APPLIED`
- columns visible but table missing through PostgREST: `SCHEMA_CACHE_PENDING`
- both relation and columns missing: `NOT_APPLIED`
- non-schema verification failures: `VERIFICATION_ERROR`

## Production Verification

Read-only production probes after manual SQL Editor execution confirmed:

- `prediction_epochs` is readable
- `prediction_epochs` row count is 0
- `prediction_history.prediction_epoch_id` is readable
- `prediction_history.prediction_epoch_key` is readable
- `prediction_history` row count remains 1477
- provider calls: 0
- remote mutations: 0
- production mutations: 0

Indexes, RLS policies and foreign-key existence are not directly exposed through the current PostgREST API. They remain verified through the reviewed migration artifact and postcheck SQL.

## Related Endpoint Consistency

The canonical state is consumed by:

- `prediction-epoch-governance-v2.service.ts`
- `legacy-prediction-metric-isolation-v2.service.ts`
- `future-only-prediction-continuity-v2.service.ts`
- `epoch-performance-learning-v2.service.ts`
- `data-foundation-quality-v2.service.ts`

## Activation Boundary

This fix does not reapply SQL, seed epoch rows, activate an epoch, archive an epoch, backfill prediction rows, update `prediction_history`, run historical imports, run feature rebuilds or enable cron jobs.

`DATA_FOUNDATION_V2_EPOCH` activation remains a separate later gate.

## Certifications

`PREDICTION_EPOCH_MIGRATION_DETECTION_PASS`

`PREDICTION_EPOCH_EMPTY_TABLE_STATE_PASS`

`PREDICTION_EPOCH_PARTIAL_SCHEMA_DETECTION_PASS`

`PREDICTION_EPOCH_CANONICAL_STATE_CONTRACT_PASS`

`PREDICTION_EPOCH_RELATED_API_CONSISTENCY_PASS`

`PREDICTION_EPOCH_REMAINS_INACTIVE_PASS`

`LEGACY_BEHAVIOR_REMAINS_ACTIVE_PASS`

`NO_DATABASE_MUTATION_PASS`

`NO_PROVIDER_CALL_PASS`

`NO_CERTIFIED_PLATFORM_REGRESSION_PASS`
