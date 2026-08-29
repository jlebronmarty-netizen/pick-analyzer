# MLB-DATA-01C-R5B 2025 Native Identity Backfill

Status: `MLB_DATA_01C_R5B_2025_NATIVE_IDENTITY_BACKFILL_CERTIFIED`

Generated artifact: `docs/CERTIFICATION/mlb-data-01c-r5b-2025-native-identity-backfill.json`

Checkpoint: `data/checkpoints/mlb-data-01c-r5b-native-identity-backfill-checkpoint.json`

## Scope

R5B populated only the native Pick 2 MLB identity foundation from existing production 2025 Statcast rows:

- `pick2_mlb_games`
- `pick2_mlb_players`
- `pick2_raw_mlb_statcast_pitches.mlbam_pitcher_id`
- `pick2_raw_mlb_statcast_pitches.mlbam_batter_id`

No provider calls, schema mutations, feature generation, model work, prediction writes, result writes, market-value writes, 2026 import, automation activation or cron changes were performed.

## Source Baseline

- Raw rows: `712528`
- Unique pitch identities: `712528`
- Duplicate pitch identities: `0`
- Distinct `game_pk`: `2430`
- Distinct MLBAM players: `1469`
- Pitcher-only players: `796`
- Batter-only players: `596`
- Both-role players: `77`
- Null `game_pk`: `0`
- Null `source_pitcher_id`: `0`
- Null `source_batter_id`: `0`
- Pre-write conflicts: `0`

## Execution Accounting

The first guarded execution inserted the native game and player rows, then stopped before raw backfill because raw-row `upsert` was rejected by existing not-null insert constraints. No raw MLBAM identity rows were written by that failed raw step.

The resumed certified execution treated the already committed native game/player rows as compatible `REUSE_NO_OP` and completed raw native ID updates with true `update` statements limited to the two authorized raw columns.

Phase-level accounting:

- Native game source identities evaluated: `2430`
- Native games inserted: `2430`
- Native games reused on resume: `2430`
- Native game conflicts: `0`
- Native player source identities evaluated: `1469`
- Native players inserted: `1469`
- Native players reused on resume: `1469`
- Native player conflicts: `0`
- Raw pitcher rows evaluated: `712528`
- Raw pitcher rows updated: `712528`
- Raw pitcher conflicts: `0`
- Raw batter rows evaluated: `712528`
- Raw batter rows updated: `712528`
- Raw batter conflicts: `0`
- Rejected rows: `0`
- Quarantined rows: `0`
- Other production DML: `0`

## Final Readback

- `pick2_mlb_games` rows: `2430`
- `pick2_mlb_players` rows: `1469`
- `pick2_mlb_game_results` rows: `0`
- `pick2_mlb_market_event_mappings` rows: `0`
- Raw `mlbam_pitcher_id` populated rows: `712528`
- Raw `mlbam_batter_id` populated rows: `712528`
- Raw pitcher null rows: `0`
- Raw batter null rows: `0`
- Pitcher source parity mismatches: `0`
- Batter source parity mismatches: `0`
- Raw rows after backfill: `712528`
- Unique pitch identities after backfill: `712528`
- Duplicate pitch identities after backfill: `0`
- 2026 raw rows: `0`

## Certification Flags

- `R5B_ALIGNMENT = PASS`
- `R5B_SCHEMA_BASELINE = PASS`
- `R5B_SOURCE_BASELINE = PASS`
- `R5B_PREWRITE_CONFLICT_AUDIT = PASS`
- `R5B_RAW_IMMUTABILITY_BASELINE_READY = YES`
- `R5B_NATIVE_GAME_BACKFILL = PASS`
- `R5B_NATIVE_PLAYER_BACKFILL = PASS`
- `R5B_RAW_PITCHER_IDENTITY_BACKFILL = PASS`
- `R5B_RAW_BATTER_IDENTITY_BACKFILL = PASS`
- `R5B_GAME_IDENTITY_PARITY = PASS`
- `R5B_PITCHER_IDENTITY_PARITY = PASS`
- `R5B_BATTER_IDENTITY_PARITY = PASS`
- `R5B_NATIVE_IDENTITY_COVERAGE = 100%`
- `R5B_RAW_ROW_STABILITY = PASS`
- `R5B_RAW_IMMUTABILITY = PASS`
- `R5B_LEGACY_MAPPING_FIELDS_UNTOUCHED = YES`
- `R5B_CHECKPOINT_RESUME_ACTIVE = YES`
- `R5B_CHECKPOINT_FINAL_STATE = COMPLETE`
- `R5B_NATIVE_BACKFILL_IDEMPOTENCY = PASS`
- `R5B_01D_NATIVE_IDENTITY_PREREQUISITES = PASS`
- `MLB_DATA_01D_2025_FEATURE_BUILD_READY = YES`
- `R5B_NATIVE_IDENTITY_REUSABLE_FOR_2026 = YES`
- `R5B_NATIVE_IDENTITY_REUSABLE_FOR_DAILY_INGEST = YES`
- `R5B_UI_CLEAN_START_PRESERVED = YES`
- `FEATURE_BUILD_PERFORMED = NO`
- `MODEL_WORK_PERFORMED = NO`
- `PREDICTION_WORK_PERFORMED = NO`
