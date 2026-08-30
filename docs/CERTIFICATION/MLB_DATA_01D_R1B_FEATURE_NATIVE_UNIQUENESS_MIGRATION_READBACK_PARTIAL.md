# MLB-DATA-01D-R1B Feature Native Uniqueness Migration Readback Partial

Generated: 2026-08-30

## Verdict

`MLB_DATA_01D_R1B_FEATURE_NATIVE_UNIQUENESS_MIGRATION_READBACK_PARTIAL`

The user reported successful manual application of:

`supabase/migrations/202608290002_pick2_mlb_feature_native_uniqueness_v1.sql`

Codex did not reapply the migration and made 0 production DDL mutations and 0 production DML mutations.

## Alignment

- Target commit: `61aeb84a58d0ae71ec02bbf044f70f3c60854d33`
- Production commit: `61aeb84a58d0ae71ec02bbf044f70f3c60854d33`
- Provider calls made by version readback: 0
- `R1B_POSTAPPLY_ALIGNMENT`: `PASS`

## Readback State

- `pick2_feature_snapshots`: 67,433
- Team daily features: 0
- Starter daily features: 0
- Bullpen daily features: 0
- Batter daily features: 0
- Matchup daily features: 0
- First-inning daily features: 0
- Raw Statcast rows: 712,528
- Raw `mlbam_pitcher_id` populated rows: 712,528
- Raw `mlbam_batter_id` populated rows: 712,528
- Native games: 2,430
- Native players: 1,469
- Models: 0
- Predictions: 0
- Prediction results: 0
- Market-value rows: 0

## Partial Items

Supabase REST does not expose `pg_indexes`, `pg_constraint`, or `information_schema.table_constraints` through the available service-role channel, so the team/bullpen constraint catalog readback cannot be certified by Codex in this phase.

The existing feature persistence script remains pinned to production commit `875b46d34553bc3618067fec202a2f780a39b2d8`, so the R1B recovery check is recorded as a snapshot-derived projection rather than a direct post-R1B dry-run execution.

## Safety

- Migration reapply: NO
- Feature DML resume authorized: NO
- Feature writes: 0
- Snapshot writes: 0
- Raw writes: 0
- Native identity writes: 0
- Model work: NO
- Prediction work: NO
- 2026 import: NO
- Automation: NO
- Cron changes: 0

## Artifact

See `docs/CERTIFICATION/mlb-data-01d-r1b-post-manual-migration-readback.json`.
