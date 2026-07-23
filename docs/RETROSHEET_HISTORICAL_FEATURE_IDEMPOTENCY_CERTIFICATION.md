# Retrosheet Historical Feature Idempotency Certification

Date: 2026-07-23

Status: NOT CERTIFIED. Blocked before first import.

## Verified

- Full-season DRY_RUN generated 70,470 planned snapshots.
- Deterministic keys were unique in the dry-run plan.
- Persistence code uses deterministic `historical_feature_snapshots.deterministic_key`.
- Persistence code uses insert-only upsert behavior for feature snapshots to prevent duplicate rows on an identical second run.

## Not Executed

- First `FULL_SEASON_IMPORT`
- Second identical `FULL_SEASON_IMPORT`
- Persisted duplicate-key reconciliation
- Insert/update/skip reconciliation for the second run

Reason: protected production write command was rejected by approval review before mutation.

`RETROSHEET_HISTORICAL_FEATURE_IDEMPOTENCY_PASS` is code-ready but not execution-certified.
