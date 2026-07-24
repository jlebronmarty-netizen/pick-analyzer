# Supabase Disk IO Recovery Audit V1

Date: 2026-07-24
Starting commit: `375e1a3d4ef507f7a9647173692fd7d13135e326`

## Scope

This was a read-only Supabase REST and code-path audit after Supabase reported Disk IO budget depletion during Historical Feature Backfill Phase 2A. The audit did not rerun Phase 2A, did not start Historical Replay Phase 2B, did not run full idempotency validation, did not execute AI retraining, did not recalibrate models and did not perform database maintenance such as `VACUUM FULL`, `REINDEX`, table rewrites or index drops.

Provider calls during the audit: 0.
Remote data mutations during the audit: 0.

## Baseline

Read-only audit generated at `2026-07-24T11:43:02.085Z`.

Observed estimated row counts through Supabase REST:

- `historical_feature_snapshots`: 71,604 rows, estimated-count probe 1,145 ms.
- `sports_odds_snapshots`: 48,508 rows, estimated-count probe 558 ms.
- `sport_player_stats`: 48,150 rows, estimated-count probe 333 ms.
- `sport_events`: 5,082 rows, estimated-count probe 624 ms.
- `sport_game_stats`: 2,961 rows, estimated-count probe 360 ms.
- `prediction_history`: 1,387 rows, estimated-count probe 608 ms.
- `sports_sync_jobs`: 544 rows, estimated-count probe 424 ms.
- `historical_import_checkpoints`: 138 rows, estimated-count probe 292 ms.
- `historical_import_registry`: 6 rows, estimated-count probe 312 ms.

Phase 2A registry evidence:

- Full write job `13fa8cd2-41ec-4f98-bbb0-d1ac16e97802`: completed, 2,430 games, 70,470 normalized records, 70,441 inserted, 29 skipped, provider calls 0, started `2026-07-24T02:35:34.951+00:00`, finished `2026-07-24T03:28:20.041+00:00`.
- Resume/idempotency evidence job `4ce68718-4661-4159-ab07-d71510c40c3f`: completed, 2,430 games, 37,120 normalized records, 0 inserted, 37,120 skipped, provider calls 0, started `2026-07-24T03:40:36.563+00:00`, finished `2026-07-24T11:06:06.174+00:00`.
- Latest completed checkpoint in both full and resume jobs: `local_game_batch_49`, processed games 2,430.
- Previously certified Phase 2A surface remains 70,470 snapshots, 2,430 games, 100% coverage, 49 checkpoints, 80/80 candidate features ready, 0 duplicate deterministic keys and 0 leakage failures.

Operational health:

- Running sync/import jobs: 0.
- Recent production scheduler jobs were completed; some scheduled SportsDataIO preview jobs used provider calls independently of this audit.
- Settlement exact counts remained bounded: pending 584, wins 384, losses 414, pushes 5.
- Learning metadata remained bounded: `model_weight_history` 41 rows, `ai_performance_snapshots` 31 rows.

## Largest Tables And Index Findings

Largest observed tables by estimated rows were `historical_feature_snapshots`, `sports_odds_snapshots` and `sport_player_stats`. True table byte sizes and true index byte sizes were not available from the current repository/Supabase REST access because catalog/stat views such as `pg_stat_user_tables`, `pg_statio_user_tables`, `pg_stat_database`, `pg_locks`, `pg_stat_activity` and `pg_indexes` are not exposed through PostgREST in this project.

Existing migrations already provide the required primary lookup indexes for the audited Phase 2A paths:

- `historical_feature_snapshots.deterministic_key` unique constraint.
- `historical_feature_snapshots_sport_event_idx`.
- `historical_feature_snapshots_cutoff_idx`.
- `historical_feature_snapshots_production_idx`.
- GIN indexes on `feature_lineage` and `feature_values`.
- `historical_import_registry_status_idx`.
- `historical_import_checkpoints_unique_idx`.
- `sports_odds_snapshots_event_idx`.
- `sports_odds_snapshots_market_idx`.
- `sport_events_sport_start_idx`.
- `prediction_history_versioning_lookup_idx`.

No index was added, dropped or rebuilt in this pass.

## Root Cause

The likely Disk IO spike was caused by the approved Phase 2A full write and resume/idempotency work, especially the worker's previous chunk accounting pattern. Before this audit, each 250-row snapshot upsert chunk ran full scoped exact counts over `historical_feature_snapshots` before and after the write. Across the full Phase 2A import and resume path, that created hundreds of repeated partition-wide count probes against the largest table at the same time as large historical reads and snapshot writes.

This is consistent with a temporary Phase 2A write/resume IO spike rather than evidence of a persistent production-dashboard IO drain: the latest audit showed no running jobs, bounded REST timings after the backfill window and current production dashboard paths using limited samples or registry metadata for Phase 2A counts.

## Implemented Optimization

The local backfill worker and the older service-layer approved-write path now calculate inserted/skipped rows by reading only the deterministic keys in the current write chunk and relying on the existing unique `deterministic_key` constraint. The code no longer performs before/after full scoped snapshot counts per chunk.

The Retrosheet historical feature diagnostics endpoint now derives stored snapshot evidence from completed `historical_import_registry` metadata instead of running an exact count over the Phase 2A snapshot partition when loading diagnostics.

## Remaining Expensive Paths

- Full validation/backfill/idempotency modes intentionally read large historical datasets and must remain operator-controlled.
- AI Operations reads all current `prediction_history` rows for lifecycle calculations; this is acceptable at the current 1,387-row scale but should be paginated or snapshot-backed before very large replay expansion.
- Exact platform checks for cache hit ratio, dead tuples, autovacuum recency, bloat, blocked sessions and true table/index byte sizes require Supabase dashboard metrics, SQL Editor access or a read-only SQL/RPC diagnostic not currently available through the repository.

## Classification

Disk IO classification: `PHASE_2A_BACKFILL_SPIKE_WITH_CODE_PATH_OPTIMIZATION_REQUIRED`.

Compute recommendation: `MONITOR_BEFORE_UPGRADE` for normal production operations. Consider a temporary compute/storage IO upgrade only before an explicitly approved Phase 2B replay or another large write/read validation pass.

Replay readiness: do not start Phase 2B yet. `REPLAY_IO_READINESS_PASS` is withheld until platform metrics confirm acceptable cache hit ratio, dead tuples/autovacuum state, bloat and long-running query health, and until Phase 2B has a bounded execution plan.

## Certifications

- `DATABASE_IO_AUDIT_PASS`: read-only audit completed with provider calls 0 and remote mutations 0.
- `PHASE_2A_IO_ROOT_CAUSE_PASS`: repeated full scoped counts in the Phase 2A chunk write path were identified as the likely avoidable IO amplifier.
- `PHASE_2A_IO_OPTIMIZATION_PASS`: chunk write accounting now uses deterministic-key lookups instead of partition-wide before/after counts.
- `PRODUCTION_DATABASE_STABILITY_OBSERVED`: no running import/sync jobs were observed during the audit, and bounded production read probes returned successfully.
- `REPLAY_IO_READINESS_PASS`: not certified.
