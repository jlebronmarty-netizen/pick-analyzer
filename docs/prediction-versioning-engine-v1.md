# Prediction Versioning Engine V1

Date: 2026-07-17

## Objective

Unblock immutable model regeneration by allowing multiple prediction versions for the same event, market, selection, sportsbook and line without overwriting historical rows.

## Schema

Migration:

- `supabase/migrations/202607170002_prediction_versioning_engine_v1.sql`

The migration adds versioning metadata to `prediction_history`:

- `is_current`
- `prediction_version`
- `model_role`
- `prediction_group_key`
- `parent_prediction_id`
- `challenger_of_prediction_id`
- `superseded_at`
- `superseded_by_prediction_id`
- `version_created_reason`
- `idempotency_key`
- `version_lineage`

It replaces the legacy `prediction_history_unique_pick` constraint with a partial uniqueness rule on `prediction_group_key where is_current = true`. This allows champion, challenger and shadow rows to coexist while preserving one current row for active board consumption.

## Runtime Behavior

`probePredictionVersioningSchemaCapabilities` checks whether the remote Supabase schema has the required columns before version-aware code uses them.

Current Board behavior:

- Before migration: preserves the legacy query path.
- After migration: `CURRENT` and `UPCOMING` modes read only `is_current=true`.
- Historical explorer modes can inspect all versions.

V6 regeneration behavior:

- Before migration: returns `preflight_migration_pending` or `prediction_versioning_migration_required`.
- After migration: writes V6 rows as `model_role=challenger`, `is_current=false`.
- Existing champion rows are not overwritten.
- Official picks, settlement, thresholds and provider usage are unchanged.

## Safety

- Provider calls: 0.
- Official history mutations: 0.
- Settled prediction mutations: 0.
- Recommendation threshold changes: 0.
- Current Board does not consume challenger rows until a future promotion/rollback phase.

## Production Verification

The corrective migration was applied remotely and verified through V6 challenger persistence rather than by assuming schema state.

Verification results:

- Dry-run preflight: `preflight_ready`, `versioningApplied=true`, `plannedPredictions=15`, `providerCallsMade=0`.
- First confirmed write with idempotency key `mlb-v6-challenger-20260717-after-legacy-drop-v1`: inserted 15 challenger rows, reused 0 rows, analyzed 15 rows, `providerCallsMade=0`, checkpoint `ffb2e6eb-cb80-421a-87a6-69b0b345c5e5`.
- Idempotency rerun with the same key: inserted 0 rows, reused 15 rows, analyzed 15 rows, `providerCallsMade=0`, checkpoint `733ccb04-c751-4648-a06f-6685898d738c`.
- Model comparison matched 15 champion/challenger pairs, with average probability delta `-1.36` and average confidence delta `-1.93`.
- Deployed standalone comparison route matched 15 champion/challenger pairs, returned `qualityGateStatus=probationary`, and warned only that matched comparison coverage is insufficient for promotion. Per-market average probability deltas were moneyline `-1.04`, spread `-1.04` and total `-1.99`; `providerCallsMade=0`.

V6 remains `model_role=challenger` and `is_current=false`. It is not promoted, not official, not settled and not consumed by default Current Board calls.

## Corrective Migration

Production validation showed the versioning columns were applied, but a legacy unique object named `prediction_history_unique_pick` still existed and blocked side-by-side challenger inserts.

Corrective migration:

- `supabase/migrations/202607170003_prediction_versioning_drop_legacy_unique_pick.sql`

This migration explicitly drops both the constraint and index forms of `prediction_history_unique_pick`.

Until it is applied remotely, V6 write mode returns:

- `status: persistence_failed`
- `providerCallsMade: 0`
- `persistenceError: prediction_history upsert failed: duplicate key value violates unique constraint "prediction_history_unique_pick"`

After remote application, this blocker is cleared. Future work should use the read-only comparison, shadow-evaluation, promotion-readiness and rollback-plan routes before any manual promotion decision.
