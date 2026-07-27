# Prediction Epoch Governance V2 Migration Runbook

Status: migration review and hardening complete; production application requires separate explicit approval.

Root migration:

`supabase/migrations/202607270001_prediction_epoch_governance_v2.sql`

Precheck:

`supabase/migrations/checks/202607270001_prediction_epoch_governance_v2_precheck.sql`

Postcheck:

`supabase/migrations/checks/202607270001_prediction_epoch_governance_v2_postcheck.sql`

Rollback:

`supabase/migrations/rollback/202607270001_prediction_epoch_governance_v2_rollback.sql`

## Critical Boundary

This migration is a schema contract only. It must not activate `DATA_FOUNDATION_V2_EPOCH`, archive legacy predictions, backfill epoch columns, change scheduler behavior, execute historical imports, rebuild features, change Learning Brain weights, change model calibration or mutate production prediction rows.

`DATA_FOUNDATION_V2_EPOCH` activation is a separate later gate.

## Backup Recommendations

Before manual application:

- Confirm latest Supabase automated backup availability.
- Export `prediction_history` metadata counts and settled-row counts.
- Export `sports_sync_jobs` count.
- Export `historical_feature_snapshots` count.
- Keep the exact deployed application commit and rollback SQL available.

The certified pre-application production counts from the code deployment gate were:

- `prediction_history`: 1477
- `sports_sync_jobs`: 617
- `historical_feature_snapshots`: 72270
- `prediction_epochs`: table absent
- `DATA_FOUNDATION_V2_EPOCH`: inactive

If these counts naturally change before application, pause and update the precheck/postcheck expected-count constants before proceeding.

## Precheck Order

1. Open Supabase SQL Editor.
2. Paste and run:
   `supabase/migrations/checks/202607270001_prediction_epoch_governance_v2_precheck.sql`
3. Confirm `precheck_status = PASS`.
4. Confirm `prediction_epochs_not_already_present = true`.
5. Confirm row counts match the expected production snapshot or intentionally update the expected constants after a new read-only certification.
6. Stop if any required table is missing, the epoch table already exists unexpectedly, or counts do not match the approved gate.

## Migration Application Order

1. Confirm no historical import, feature rebuild, settlement recovery or epoch activation is running.
2. Paste and run:
   `supabase/migrations/202607270001_prediction_epoch_governance_v2.sql`
3. Expected SQL Editor behavior:
   - table creation for `prediction_epochs`
   - nullable column additions on `prediction_history`
   - guarded constraints
   - guarded RLS policies
   - indexes
   - comments and grants
4. Expected data behavior:
   - no `prediction_epochs` seed rows
   - no `prediction_history` row updates
   - no production prediction row deletion
   - no `DATA_FOUNDATION_V2_EPOCH` activation

## Schema Cache Guidance

After successful SQL Editor application:

- Wait for Supabase/PostgREST schema cache refresh.
- If API routes still report missing table immediately after migration, retry after a short delay.
- Do not run activation SQL to fix schema-cache timing.

## Postcheck Order

1. Paste and run:
   `supabase/migrations/checks/202607270001_prediction_epoch_governance_v2_postcheck.sql`
2. Confirm `postcheck_status = PASS`.
3. Confirm:
   - `prediction_history` count unchanged
   - `sports_sync_jobs` count unchanged
   - `historical_feature_snapshots` count unchanged
   - `prediction_epochs` row count is 0
   - `DATA_FOUNDATION_V2_EPOCH` active count is 0
   - `prediction_history` epoch-linked row count is 0
   - RLS enabled
   - service-role mutation policy exists
   - authenticated select policy exists
   - expected indexes exist
   - expected constraints exist

## API Smoke Tests

Run read-only production checks:

- `GET /api/system/version`
- `GET /api/data-foundation/epochs`
- `GET /api/data-foundation/epochs?validate=true`
- `GET /api/data-foundation/legacy-metrics`
- `GET /api/data-foundation/future-predictions`
- `GET /api/data-foundation/epoch-performance`
- `GET /api/current-board`
- `GET /api/market-opportunities/most-likely`
- `GET /api/market-opportunities/best-value`
- `GET /api/probability-picks`
- `GET /api/mlb/player-props`
- `GET /api/operations/status`
- `GET /api/operations/validation`
- `GET /api/dashboard?mode=today&includeValidation=true`
- `GET /api/performance`

Expected:

- HTTP 200 or documented empty-state response
- `providerCallsMade = 0`
- `remoteMutationsMade = 0`
- no automatic epoch activation
- no current dashboard/performance behavior change
- no legacy prediction rows disappear

## UI Smoke Tests

Open:

- `/dashboard`
- `/performance`

Expected:

- pages render successfully
- production behavior remains legacy/current
- no UI copy describes `DATA_FOUNDATION_V2_EPOCH` as active
- no local-only V2 work is presented as activated

## Rollback Decision Criteria

Rollback is allowed only before epoch activation or use.

Run rollback only if:

- migration application succeeded but postcheck fails
- `prediction_epochs` contains 0 rows
- `prediction_history.prediction_epoch_id` and `prediction_history.prediction_epoch_key` contain 0 non-null rows
- `DATA_FOUNDATION_V2_EPOCH` is not active

Do not run rollback after:

- epoch rows are inserted
- `DATA_FOUNDATION_V2_EPOCH` is activated
- legacy rows are backfilled with epoch keys
- prediction rows are linked to epoch IDs

## Rollback Procedure

1. Confirm rollback criteria above.
2. Paste and run:
   `supabase/migrations/rollback/202607270001_prediction_epoch_governance_v2_rollback.sql`
3. The rollback contains guard checks and will fail if epoch activation/use has started.
4. After rollback, rerun the precheck. It should again report `prediction_epochs_not_already_present = true`.

## Later Activation Gate

Activation is not part of this migration.

A later gate must separately review and approve:

- seeding `LEGACY_EPOCH_V1`
- seeding `DATA_FOUNDATION_V2_EPOCH`
- any legacy-row backfill plan
- active-epoch selection behavior
- scheduler activation behavior
- performance/learning epoch filters
- rollback and deactivation rules after activation
