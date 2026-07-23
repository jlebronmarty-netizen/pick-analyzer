# Historical Feature Backfill Idempotency

Status: implemented in the local worker; full production idempotency run blocked pending write approval.

## Deterministic Identity

Snapshot keys use the certified Phase 2A prefix:

`retrosheet_mlb_feature_store_v1`

The worker writes to `historical_feature_snapshots` with `onConflict=deterministic_key` and `ignoreDuplicates=true`.

## Expected Second Run

An identical second run should report:

- inserted: 0
- updated: 0
- skipped: 70,470
- duplicate deterministic keys: 0
- duplicate feature definitions: 0
- no state oscillation
- no existing row corruption

Only approved audit/job/checkpoint metadata may be newly inserted for the second audit job.

## Resume Semantics

Resume mode finds the latest `running` `historical_import_registry` row whose metadata has:

`workerVersion=retrosheet_local_feature_backfill_worker_v1`

Completed `local_game_batch_{n}` checkpoints are skipped. Missing checkpoints are regenerated and written idempotently.

## Current Evidence

Full dry-run generated 70,470 deterministic keys with 0 collisions. Full write/idempotency execution was not performed because the protected review mechanism rejected the large production historical feature write.
