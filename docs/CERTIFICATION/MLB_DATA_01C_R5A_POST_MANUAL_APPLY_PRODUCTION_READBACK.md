# MLB-DATA-01C-R5A Post-Manual-Apply Production Readback

Status: `MLB_DATA_01C_R5A_NATIVE_IDENTITY_MIGRATION_PRODUCTION_CERTIFIED`

The user manually applied `supabase/migrations/202608290001_pick2_mlb_native_identity_foundation_v1.sql` through the Supabase Production SQL Editor and reported successful completion. Codex did not reapply the migration and made 0 production DDL and 0 production DML mutations in this certification task.

`R5_NATIVE_IDENTITY_MIGRATION_APPLIED = YES_USER_CONFIRMED`

## Alignment

- Local HEAD: `01124630a3bd6724d0ebaf806b36d6150db4cdf1`
- origin/main: `01124630a3bd6724d0ebaf806b36d6150db4cdf1`
- Production runtime: `01124630a3bd6724d0ebaf806b36d6150db4cdf1`
- Provider calls reported by `/api/system/version`: 0

`R5A_POSTAPPLY_ALIGNMENT = PASS`

## Schema Readback

Read-only production probes confirmed the native R5 schema is visible through the production schema cache:

- `pick2_mlb_games`
- `pick2_mlb_players`
- `pick2_mlb_game_results`
- `pick2_mlb_market_event_mappings`
- `pick2_raw_mlb_statcast_pitches.mlbam_pitcher_id`
- `pick2_raw_mlb_statcast_pitches.mlbam_batter_id`
- Native feature identity columns on feature snapshots and daily feature tables
- `pick2_game_predictions.game_pk`
- `pick2_prediction_results.game_pk`

Legacy/source columns remain present: `game_pk`, `source_pitcher_id`, `source_batter_id`, `event_id`, `canonical_pitcher_id`, `canonical_batter_id`, `raw_payload` and `raw_payload_digest`.

## Readback Flags

- `PICK2_NATIVE_IDENTITY_TABLES_VISIBLE = YES`
- `PICK2_MLB_GAMES_READBACK = PASS`
- `PICK2_MLB_PLAYERS_READBACK = PASS`
- `PICK2_MLB_GAME_RESULTS_READBACK = PASS`
- `PICK2_MLB_MARKET_CROSSWALK_READBACK = PASS`
- `RAW_NATIVE_IDENTITY_COLUMN_READBACK = PASS`
- `RAW_LEGACY_AND_SOURCE_COLUMNS_PRESERVED = YES`
- `FEATURE_NATIVE_IDENTITY_COLUMN_READBACK = PASS`
- `LEGACY_FK_RELAXATION_READBACK = PASS`
- `LEGACY_COLUMNS_PRESERVED = YES`
- `PREDICTION_NATIVE_IDENTITY_READBACK = PASS`
- `PREDICTION_IMMUTABILITY_PRESERVED = YES`
- `PREDICTION_RESULT_NATIVE_IDENTITY_READBACK = PASS`
- `NATIVE_IDENTITY_CONSTRAINT_READBACK = PASS`
- `NATIVE_IDENTITY_INDEX_READBACK = PASS`
- `NATIVE_IDENTITY_SECURITY_READBACK = PASS`

## Zero Baseline

R5B was not executed, so native identity storage remains empty:

- `pick2_mlb_games`: 0
- `pick2_mlb_players`: 0
- `pick2_mlb_game_results`: 0
- `pick2_mlb_market_event_mappings`: 0
- Raw `mlbam_pitcher_id` populated rows: 0
- Raw `mlbam_batter_id` populated rows: 0

`R5A_NATIVE_TABLE_ZERO_ROW_BASELINE = PASS`

`R5A_RAW_NATIVE_ID_ZERO_BASELINE = PASS`

## Data Preservation

- Raw rows: 712,528
- 2026 raw rows: 0
- Raw `event_id` rows: 0
- Raw `canonical_pitcher_id` rows: 0
- Raw `canonical_batter_id` rows: 0
- Feature tables: 0
- Model tables: 0
- Champion: `NONE`
- Pick 2 predictions: 0
- Prediction results: 0
- Market-value evaluations: 0

`R5A_RAW_ROW_STABILITY = PASS`

`R5A_RAW_IMMUTABILITY = PASS`

`R5A_LEGACY_ISOLATION = PASS`

## Product Boundary

Production `/`, `/today`, `/performance`, `/model-lab` and `/data-health` remain clean-start surfaces. R5A did not run R5B, build features, train models, generate predictions, import 2026 data, activate automation or change cron.

`R5A_UI_CLEAN_START_PRESERVED = YES`

`R5B_BACKFILL_PERFORMED = NO`

`MLB_DATA_01D_2025_FEATURE_BUILD_READY = NO`

`MLB_DATA_01D_PROJECTED_READY_AFTER_R5B = YES`

## Safety

- Provider calls: 0
- Codex production DDL mutations: 0
- Codex production DML mutations: 0
- Migration reapply by Codex: NO
- Backfill: NO
- Feature build: NO
- Model work: NO
- Prediction writes: 0
- 2026 import: NO
- Automation activated: NO
- Active cron added: NO
