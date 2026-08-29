# MLB-DATA-01C-R5 Native MLB Identity Foundation Migration

Status: `MLB_DATA_01C_R5_NATIVE_IDENTITY_FOUNDATION_MIGRATION_CERTIFIED`

R5 prepares the additive repository migration package that lets Pick 2 MLB operate natively on MLB Official/Statcast `game_pk`, MLBAM `person_id` and the existing certified canonical team ids. The migration was authored but not applied to Production, and no 2025 backfill, feature build, model work, prediction write, provider call, automation activation or cron change occurred.

Migration applied: `NO`

Backfill performed: `NO`

## Baseline

- Local HEAD, `origin/main` and Production were aligned at `cae0be91bbff5872a0529601f2d65cca62e548b7` before R5 edits.
- R4D is authoritative: SportsDataIO MLB is not required by Pick 2 identity, `game_pk` is the game root, MLBAM `person_id` is the player root and legacy `sport_events.id` / `sport_players.id` are optional compatibility only.
- Certified source counts remain: 712,528 raw Statcast rows, 2,430 games, 1,469 source MLBAM players, 0 duplicate pitch identities, 0 feature rows, 0 model rows, champion `NONE`, 0 predictions and 0 2026 raw rows.

## Current Schema Gap Audit

The current foundation table definitions show these Pick 2 identity blockers:

| Table | Current blocker | R5 action |
| --- | --- | --- |
| `pick2_raw_mlb_statcast_pitches` | Native game identity exists through non-null `game_pk`; pitcher/batter MLBAM ids are stored as source evidence only. | Add nullable `mlbam_pitcher_id` and `mlbam_batter_id` for native clarity; do not remove source or legacy columns. |
| `pick2_feature_snapshots` | Generic `subject_id` is required; `event_id` is nullable legacy compatibility. | Add nullable `target_game_pk`, `mlbam_person_id`, `mlbam_pitcher_id`, `mlbam_batter_id` and native metadata. |
| `pick2_mlb_pitcher_daily_features` | `player_id` hard-requires `sport_players.id`. | Add nullable `target_game_pk` and `mlbam_pitcher_id`; relax `player_id` to compatibility. |
| `pick2_mlb_batter_daily_features` | `player_id` hard-requires `sport_players.id`. | Add nullable `target_game_pk` and `mlbam_batter_id`; relax `player_id` to compatibility. |
| `pick2_mlb_team_daily_features` | No legacy player/event blocker; team id is the certified canonical team id. | Add nullable `target_game_pk`. |
| `pick2_mlb_bullpen_daily_features` | No legacy player/event blocker; team id is the certified canonical team id. | Add nullable `target_game_pk` and optional MLBAM pitcher id array for row-level reliever evidence. |
| `pick2_mlb_matchup_daily_features` | `event_id` hard-requires `sport_events.id`. | Add nullable `target_game_pk`, `mlbam_pitcher_id`, `mlbam_batter_id`; relax `event_id` to compatibility. |
| `pick2_mlb_first_inning_daily_features` | `event_id` hard-requires `sport_events.id`. | Add nullable `target_game_pk`, starter MLBAM ids and lineup MLBAM ids; relax `event_id` to compatibility. |
| `pick2_game_predictions` | `event_id` hard-requires `sport_events.id`. | Add nullable `game_pk`; relax `event_id` to compatibility while preserving immutable prediction rows. |
| `pick2_prediction_results` | `result_id` is already optional legacy compatibility. | Add nullable `game_pk` and create a native `pick2_mlb_game_results` adapter keyed by `game_pk`. |
| `pick2_market_value_evaluations` | `odds_snapshot_id` is required only in the downstream market layer. | Keep price storage separate and create `pick2_mlb_market_event_mappings`. |

`R5_CURRENT_SCHEMA_GAP_AUDIT_COMPLETE = YES`

## Migration Package

New migration: `supabase/migrations/202608290001_pick2_mlb_native_identity_foundation_v1.sql`

The migration creates:

- `pick2_mlb_games`, keyed by `game_pk`.
- `pick2_mlb_players`, keyed by `mlbam_person_id`.
- `pick2_mlb_game_results`, keyed by `game_pk`, with optional `legacy_game_result_id`.
- `pick2_mlb_market_event_mappings`, mapping `game_pk` to downstream market provider event ids without making price data canonical identity.

The migration adds only nullable native identity columns to existing Pick 2 tables, plus non-destructive `NOT NULL` relaxation for legacy compatibility columns that would otherwise block native writes. It does not drop tables, drop columns, delete rows, truncate rows, rewrite legacy rows, backfill by name or introduce a SportsDataIO identity dependency.

## Native Contracts

- `PICK2_MLB_GAMES_SCHEMA_READY = YES`
- `PICK2_MLB_GAMES_CONSTRAINTS_READY = YES`
- `PICK2_MLB_PLAYERS_SCHEMA_READY = YES`
- `PICK2_MLB_PLAYERS_CONSTRAINTS_READY = YES`
- `RAW_NATIVE_IDENTITY_COLUMNS_READY = YES`
- `R5_RAW_NATIVE_IDENTITY_SEMANTICS_READY = YES`
- `PICK2_TEAM_FEATURE_NATIVE_SCHEMA_READY = YES`
- `PICK2_STARTER_FEATURE_NATIVE_SCHEMA_READY = YES`
- `PICK2_BULLPEN_FEATURE_NATIVE_SCHEMA_READY = YES`
- `PICK2_BATTER_FEATURE_NATIVE_SCHEMA_READY = YES`
- `PICK2_OFFENSE_FEATURE_NATIVE_SCHEMA_READY = YES`
- `PICK2_MATCHUP_FEATURE_NATIVE_SCHEMA_READY = YES`
- `PICK2_FIRST_INNING_NATIVE_SCHEMA_READY = YES`
- `PICK2_FEATURE_SNAPSHOT_NATIVE_SCHEMA_READY = YES`
- `LEGACY_FK_RELAXATION_SAFE = YES`
- `PICK2_PREDICTION_NATIVE_SCHEMA_READY = YES`
- `PICK2_PREDICTION_NATIVE_IDEMPOTENCY_READY = YES`
- `PICK2_RESULT_NATIVE_SCHEMA_READY = YES`
- `PICK2_NATIVE_RESULT_CONTRACT_READY = YES`
- `PICK2_MARKET_CROSSWALK_SCHEMA_READY = YES`

## Indexes And RLS

The index plan covers registry identity, game/date lookup, optional legacy links, raw MLBAM pitcher/batter scans, native feature uniqueness, prediction lookup by `game_pk`, result lookup by `game_pk` and market provider-event identity. New tables enable RLS, grant all access to `service_role` and grant authenticated select for product-safe read surfaces only.

`NATIVE_IDENTITY_INDEX_PLAN_READY = YES`

`NATIVE_IDENTITY_SECURITY_MODEL_READY = YES`

## R5B Backfill Preparation

Future script: `scripts/mlb-data-01c-r5b-2025-native-identity-backfill.mjs`

The script is restartable and dry-run by default. It reads only existing raw Statcast identity fields, calculates source counts, uses a checkpoint at `data/checkpoints/mlb-data-01c-r5b-native-identity-backfill-checkpoint.json`, and refuses execution unless a later phase supplies `--execute` plus an explicit R5B authorization environment flag.

Expected future backfill counts:

- Games: 2,430
- Unique MLBAM players: 1,469
- Raw rows: 712,528
- Expected pitcher identity rows: 712,528
- Expected batter identity rows: 712,528

Conflict handling:

- Same `game_pk` / same MLBAM id with compatible identity: `REUSE_NO_OP`
- Same `game_pk` / same MLBAM id with incompatible identity: `BLOCK_CONFLICT`
- Raw native column null plus certified source id: `UPDATE_ELIGIBLE`
- Raw native column already same value: `REUSE_NO_OP`
- Raw native column different value: `BLOCK_CONFLICT`

`R5B_2025_NATIVE_BACKFILL_SCRIPT_READY = YES`

`R5B_BACKFILL_SOURCE_CONTRACT_READY = YES`

`R5B_BACKFILL_CHECKPOINT_CONTRACT_READY = YES`

`R5B_NATIVE_BACKFILL_CONFLICT_CONTRACT_READY = YES`

`R5B_NATIVE_BACKFILL_IDEMPOTENCY_READY = YES`

## Readiness

After R5A migration application/readback and R5B native identity backfill, no Pick 2 MLB identity blocker is projected to remain for 01D feature building. Actual 01D feature building remains blocked now because the migration is not applied and the 2025 native backfill is not performed in R5.

- `MLB_DATA_01D_PROJECTED_READY_AFTER_R5A_R5B = YES`
- `MLB_DATA_01D_2025_FEATURE_BUILD_READY = NO`
- `R5_NATIVE_RUNTIME_PREPARATION_READY = YES`
- `R5_NATIVE_FOUNDATION_SPORTSDATAIO_INDEPENDENT = YES`
- `R5_UI_CLEAN_START_PRESERVED = YES`

## Safety

- Provider calls: 0
- SportsDataIO calls: 0
- MLB Official calls: 0
- The Odds API calls: 0
- BALLDONTLIE calls: 0
- Production DDL mutations: 0
- Production DML mutations: 0
- Migration applied: NO
- Backfill performed: NO
- Feature build: NO
- Model work: NO
- Prediction writes: 0
- 2026 import: 0
- Automation activated: NO
- Active cron added: NO
