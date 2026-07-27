# Prediction Epoch Governance Seeding V1

Status: local artifacts prepared; production SQL application requires separate explicit approval.

This phase prepares Gate 2 of Prediction Epoch Governance V2. It seeds canonical governance rows only:

- `LEGACY_EPOCH_V1`
- `DATA_FOUNDATION_V2_EPOCH`

It does not activate `DATA_FOUNDATION_V2_EPOCH`, archive legacy behavior, backfill `prediction_history`, run historical imports, rebuild features, change scheduler behavior, change settlement behavior or enable cron jobs.

## Root Files

- Seed SQL: `supabase/migrations/202607270002_prediction_epoch_governance_seed_v1.sql`
- Precheck: `supabase/migrations/checks/202607270002_prediction_epoch_governance_seed_v1_precheck.sql`
- Postcheck: `supabase/migrations/checks/202607270002_prediction_epoch_governance_seed_v1_postcheck.sql`
- Rollback: `supabase/migrations/rollback/202607270002_prediction_epoch_governance_seed_v1_rollback.sql`
- Fixture validation: `scripts/prediction-epoch-governance-seed-v1-fixtures.mjs`

## Canonical Rows

`LEGACY_EPOCH_V1`

- `epoch_name`: `Legacy Certified Prediction Epoch V1`
- `status`: `ACTIVE`
- `rollback_epoch_key`: `null`
- `activated_at`: manual seed execution timestamp
- `archived_at`: `null`
- Training and data windows: `null` because exact historic windows are not provable from this gate
- Model metadata: `legacy_certified_platform`, `v1.0-platform-certified`
- Feature metadata: `legacy_certified_platform`, `pre_epoch_governance_rows`

`DATA_FOUNDATION_V2_EPOCH`

- `epoch_name`: `Historical Sports Data Foundation V2 Epoch`
- `status`: `SHADOW`
- `rollback_epoch_key`: `LEGACY_EPOCH_V1`
- `activated_at`: `null`
- `archived_at`: `null`
- Training and data windows: `null` because production historical imports and feature rebuilds are not complete in this gate
- Model metadata: `data_foundation_v2_contracts`, `migration_ready_only`
- Feature metadata: `sports_data_warehouse_v2_contract`, `feature_rebuild_plan_v2_not_executed`

## Safety Contract

The seed uses `INSERT ... ON CONFLICT (epoch_key) DO NOTHING` after explicit conflict guards. If either canonical row already exists with conflicting values, the seed raises an exception before insert. It also blocks if prediction rows are already epoch-linked, if a noncanonical active epoch exists, or if V2 is active.

Expected post-seed state:

- `migrationApplied: true`
- `migrationState: APPLIED_INACTIVE`
- `epochRowCount: 2`
- `activeEpochCount: 1`
- `activeEpochKey: LEGACY_EPOCH_V1`
- `newEpochActive: false`
- `legacyBehaviorActive: true`
- `activationRequired: true`
- `DATA_FOUNDATION_V2_EPOCH status: SHADOW`

## Gates

Gate 1: schema migration

- Applies `202607270001_prediction_epoch_governance_v2.sql`
- Creates schema only
- No seed rows
- No activation

Gate 2: governance row seeding

- Applies `202607270002_prediction_epoch_governance_seed_v1.sql`
- Creates the two canonical governance rows
- Keeps legacy as the single active fallback
- Keeps V2 shadow/inactive
- No prediction backfill

Gate 3: legacy backfill and V2 activation

- Not started
- Requires separate approval
- Must define bounded prediction-history linking, future-only scheduler selection, metrics behavior, rollback and post-activation monitoring

## Manual Application Order

1. Run `supabase/migrations/checks/202607270002_prediction_epoch_governance_seed_v1_precheck.sql`.
2. Confirm the precheck passes.
3. Run `supabase/migrations/202607270002_prediction_epoch_governance_seed_v1.sql`.
4. Run `supabase/migrations/checks/202607270002_prediction_epoch_governance_seed_v1_postcheck.sql`.
5. Verify data-foundation endpoints still report legacy behavior active and V2 inactive.

Rollback, if required, is allowed only before epoch linking or V2 activation and must use `supabase/migrations/rollback/202607270002_prediction_epoch_governance_seed_v1_rollback.sql`.
