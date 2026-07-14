# Historical Feature Snapshot Persistence V1

## Status

Implemented as an additive migration, typed service contract and bounded trial write path. The migration file existing locally is not treated as proof of remote application; runtime readiness is based on the server schema capability probe.

- Migration: `supabase/migrations/202607140001_historical_feature_snapshots_v1.sql`
- Table: `historical_feature_snapshots`
- Linked table: `prediction_history`
- Provider calls: 0
- API routes added: 0
- Build: `npm.cmd run build` exits 0
- Runtime probe status on 2026-07-14: `applied`
- Verified write pilot on 2026-07-14: first run inserted 15 trial snapshots; immediate rerun reused 15 and inserted 0
- Verified Batch V1 on 2026-07-14: first run inserted 27 market-specific trial snapshots; immediate rerun reused 27 and inserted 0

## Migration Summary

`historical_feature_snapshots` is a generic, sport-agnostic store for immutable prediction-time feature snapshots.

Key columns:

- `id uuid primary key`
- `deterministic_key text unique`
- `sport_key`, `league_key`, `event_id`, `provider_event_id`, `market`
- `prediction_cutoff`, `as_of_timestamp`, `generated_at`
- `model_version`, `feature_set_version`, `snapshot_version`
- `feature_values jsonb`, `feature_lineage jsonb`, `source_timestamps jsonb`
- `data_quality_score`, `data_sufficiency_score`, `unresolved_mapping_count`
- `leakage_status`, `leakage_warnings`
- `trial`, `scrambled`, `production_eligible`
- `generation_job_id`
- `immutable_after_prediction_link`
- `metadata`, `created_at`, `updated_at`

The migration also adds prediction lineage columns to `prediction_history`:

- `feature_snapshot_id uuid references historical_feature_snapshots(id)`
- `feature_snapshot_key`
- `feature_set_version`
- `feature_snapshot_generated_at`
- `production_eligible`
- `trial`
- `scrambled`

Indexes cover sport/event/market/cutoff/model/version lookup, cutoff scans, production/trial filtering and GIN lookup over feature lineage/values. Constraints keep counters nonnegative, quality scores bounded, leakage status typed, prediction cutoff no later than as-of timestamp and production eligibility incompatible with trial/scrambled rows.

## Immutability

The migration creates `prevent_linked_feature_snapshot_mutation()`. Once a snapshot is linked from `prediction_history.feature_snapshot_id`, protected prediction-time fields cannot be overwritten. Corrected or regenerated data must create a distinct deterministic key or snapshot version.

## Service Contract

`src/services/historical-feature-generation.service.ts` now exposes:

- runtime schema-probed persistence readiness
- deterministic persistence keys and lineage hashes
- bounded write-mode pilot over stored normalized NBA trial rows only
- dry-run persistence result with nonnegative counters
- backtest eligibility checks that require durable snapshot lineage
- deterministic validation for one-to-one, one-to-many, dedupe, cancellation/resume, trial isolation, ROI and CLV blockers

The existing `/api/features/store/validation` route includes these checks through the current Feature Store validation contract. Existing historical import planning, NBA daily sync dry-run and NBA backtest/calibration surfaces expose the same blocker without new routes. The existing `/api/features/store` route accepts `POST` action `historical_feature_snapshot_write_pilot` for the capped write pilot; no new route was added.

The write path is insert-only for new deterministic keys. Existing rows are reused only when `feature_values` and `feature_lineage` match. Changed-lineage attempts are rejected instead of overwriting historical prediction-time evidence. The initial verified NBA trial pilot used `maximumEvents=5`, `maximumMarketsPerEvent=3`, `maximumSnapshots=15`, `concurrency=1`, `retries=0`, `trial=true`, `scrambled=true` and `production_eligible=false`. NBA Trial Validation Batch V1 used the same action with `maximumEvents=9`, `maximumMarketsPerEvent=3` and `maximumSnapshots=50`; it inserted 27 market-specific trial snapshots on first run and reused all 27 on rerun.

## Backtesting Gate

Production ROI, CLV, calibration and promotion metrics remain blocked unless a settled prediction has:

- `feature_snapshot_id`
- `feature_set_version`
- prediction-time lineage
- valid price for ROI
- genuine closing snapshot for CLV
- no leakage warnings
- production-eligible, non-trial, non-scrambled rows

Inline `prediction_history.feature_snapshot` remains legacy context, not the canonical immutable snapshot store.

## Schema Probe

`src/lib/server-schema-capabilities.ts` verifies remote schema with server-only Supabase access and minimal select/head-style probes. It classifies runtime status as:

- `applied`
- `missing`
- `permission_blocked`
- `configuration_missing`
- `probe_failed`
- `unknown`

The probe checks `historical_feature_snapshots`, `prediction_history` feature-snapshot linkage columns, `sport_player_stats` and `sport_lineups`. It returns table and column names only, never URLs, keys or row values.

## Validation Endpoints

Re-run these read-only endpoints after schema changes:

1. `GET /api/features/store/validation`
2. `GET /api/historical-import/plan?sportKey=basketball_nba&season=2026`
3. `GET /api/nba/predictions/backtest`

Expected post-application status is `applied` for the schema probe and `ready` for durable snapshot persistence readiness. Backtesting can still be `eligible=false` for legitimate missing linked snapshots, prices, closing snapshots and settled production sample reasons.

The 2026-07-14 write-mode verification returned 15 eligible candidates, inserted 15 snapshots on first confirmed execution, inserted 0 and reused 15 on the immediate rerun, found 0 duplicate rows after local reprocessing, made 0 provider calls and did not create or mutate prediction rows.

## Trial Prediction Lineage Pilot

The follow-up bounded lineage pilot uses existing `/api/features/store` action `historical_prediction_snapshot_lineage_pilot`. It validates snapshot-to-prediction linkage without adding routes or creating production recommendations.

The initial 2026-07-14 validation considered the 15 persisted NBA trial snapshots and returned `no_eligible_candidates` because all 15 lacked a genuine offered price. Since `prediction_history.odds` is not nullable, inserting a prediction row would have required fabricated odds, so the pilot correctly inserted 0 rows at that stage.

The follow-up `GameOddsByDate/2025-12-26` priced odds pilot confirmed provider access and persisted trial-only odds rows. The approved cleanup removed 936 alternate-like rows, the corrected retry inserted 180 null-line moneyline replacements and updated 360 spread/total rows, and the supersession cleanup deleted 180 legacy non-null-line moneylines. Existing immutable base snapshots were not mutated in place; five odds-enriched trial snapshot versions were created for the first lineage validation. NBA Trial Validation Batch V1 then created 27 market-specific trial snapshots across 9 completed trial events, inserted 22 new linked trial prediction rows, reused the 5 existing linked predictions and reused all 27 on immediate rerun. Settlement/backtesting production metrics remain blocked because the linked rows are trial/scrambled/non-production and lack genuine closing snapshots.
