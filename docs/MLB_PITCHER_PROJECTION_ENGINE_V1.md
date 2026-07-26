# MLB Pitcher Projection Engine V1

Status: PARTIAL

MLB Pitcher Projection Engine V1 is an additive projection-only module for starting pitcher recorded outs.

## Implemented

- Canonical pitcher projection types in `src/types/mlb-pitcher-projections.ts`
- Feature builder in `src/services/mlb-pitcher-feature-builder.service.ts`
- Projection engine in `src/services/mlb-pitcher-projection-engine.service.ts`
- Read-only/dry-run APIs under `/api/mlb/pitchers/projections`
- Existing Player Projections UI integration with an MLB Pitcher Outs tab
- Local additive migration: `supabase/migrations/202607260001_mlb_pitcher_projections_v1.sql`

## API Surface

- `GET /api/mlb/pitchers/projections`
- `GET /api/mlb/pitchers/projections/health`
- `GET /api/mlb/pitchers/projections/validation`
- `GET /api/mlb/pitchers/[pitcherId]/projection`
- `POST /api/mlb/pitchers/projections/preview`
- `POST /api/mlb/pitchers/projections/generate`

POST generation defaults to dry-run. Persisting requires existing CRON authorization and the local migration to be approved and applied.

## Guardrails

- No provider calls during page rendering
- No production mutation by default
- No sportsbook lines or prices
- No betting recommendation language
- No official picks
- No portfolio selection
- No synthetic zero projections for unavailable values

## Persistence

The proposed `mlb_pitcher_projections` table is narrow and additive. Projection IDs are deterministic from sport, event, pitcher, projection key, model version and projection date. Upsert is idempotent by primary key.

Migration file: `supabase/migrations/202607260001_mlb_pitcher_projections_v1.sql`.

RLS state: intentionally not enabled, matching the existing certified service-owned table pattern in this repository. Writes are performed by `service_role` through protected server APIs. Authenticated read access is projection-only, and UI routes should continue to read through server APIs. The table does not contain sportsbook recommendations, official picks, stakes or portfolio selections.

Index coverage:

- `mlb_pitcher_projections_event_idx` supports event/date/model lookup.
- `mlb_pitcher_projections_pitcher_idx` supports pitcher/date lookup.
- `mlb_pitcher_projections_provider_pitcher_generated_idx` supports provider pitcher lookup and provider-scoped rows while canonical player rows are pending.
- `mlb_pitcher_projections_generated_idx` supports latest projections globally and generation audits.
- `mlb_pitcher_projections_event_generated_idx` supports latest projections by event.
- `mlb_pitcher_projections_pitcher_generated_idx` supports latest projections by pitcher.

The migration has not been applied to production.

## Migration Rollback Notes

The migration is additive: it creates `mlb_pitcher_projections`, indexes, grants and table comments. It does not alter or drop existing production tables.

Expected production impact is limited to enabling durable storage for MLB pitcher recorded-outs projections. The migration depends on existing `sport_events(id)` and should run after certified platform/base sports tables exist. For this module, apply database migrations before deploying code that persists projections.

Rollback limitation: dropping `mlb_pitcher_projections` deletes persisted pitcher projection history. Export rows before any destructive rollback. If rollback is required after code deployment, roll back the application first so production routes stop depending on the table, then perform any database rollback only with explicit destructive approval.

## Live Dry-Run Proof

After authorized starter-source refresh, the 2026-07-26 dry-run projection preview generated 11 grounded pitcher rows and 11 numeric projections.

Projection preview made:

- Provider calls: 0
- Remote mutations: 0
- Validation failures: 0

The provider refresh used for source grounding made 1 SportsDataIO call and wrote 1 existing `sports_sync_jobs` ledger row for attribution.

## Completion Classification

PARTIAL. The engine is now functional in live dry-run mode with real current-slate data. Durable persistence still requires explicit migration approval, and canonical player row synchronization should backfill provider-scoped starter IDs before production persistence.
