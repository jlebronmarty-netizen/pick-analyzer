# Local Historical Feature Backfill V1

Status: worker implemented; full production write execution blocked by protected approval review.

## Purpose

`scripts/retrosheet-feature-backfill.mjs` runs the Retrosheet Phase 2A feature-store engine locally from `C:\Projects\pick-analyzer` so the 2025 historical feature snapshot set can avoid Vercel serverless runtime limits.

The worker explicitly loads `.env.local`, imports the existing `src/lib/supabase-admin.ts` client, and reuses `src/services/retrosheet-historical-feature-store.service.ts` for feature generation. It does not duplicate the Phase 2A feature engine.

## Commands

- Dry run: `npm run historical:features:dry-run`
- Full backfill: `npm run historical:features:backfill`
- Resume: `npm run historical:features:resume`
- Validate: `npm run historical:features:validate`
- Idempotency: `npm run historical:features:idempotency`
- Single game: `npm run historical:features:single-game -- --start-game-id retrosheet:mlb:game:CHN202503180`

Safe arguments include `--batch-size`, `--write-size`, `--start-date`, `--end-date`, `--start-game-id`, `--limit`, `--concurrency`, and `--max-retries`.

## Connection Certification

Before mutation the worker verifies:

- `NEXT_PUBLIC_SUPABASE_URL` is present
- `SUPABASE_SERVICE_ROLE_KEY` is present
- sanitized hostname equals `ynuocvexviorgdjrfthw.supabase.co`
- historical source tables are readable
- `historical_feature_snapshots`, `sports_sync_jobs`, `historical_import_registry`, `historical_import_checkpoints`, `sport_events`, `sports_teams`, and `sport_players` are readable

Secrets are never printed.

## Batch Contract

Default batch sizes:

- 50 games per generation batch
- 250 snapshot rows per database write
- 3 retries per write chunk

The worker loads persisted source rows once, then generates and writes snapshots by game batch. It does not materialize all 70,470 feature snapshots before writing.

## Production Isolation

Persisted snapshots remain:

- `production_eligible=false`
- `trial=false`
- `scrambled=false`
- `metadata.historicalOnly=true`
- `metadata.trainingEligible=false`
- `metadata.livePredictionEligible=false`

No provider calls, Prediction Engine changes, Learning Brain weight changes, Current Board mutations, Official Pick changes, odds changes, settlement mutations, or live Performance contamination are performed.

## Current Execution Evidence

Full local dry run completed with:

- games: 2,430
- planned snapshots: 70,470
- leakage failures: 0
- duplicate deterministic keys: 0
- HIGH: 55,311
- MEDIUM: 4,430
- LOW: 8,601
- INSUFFICIENT: 2,128

The first full write was not executed because protected review rejected the large persistent write. No workaround was attempted.
