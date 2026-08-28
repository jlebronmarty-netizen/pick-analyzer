# PICK-2.0 RESET-04 Data Foundation

Status: `PICK_2_RESET_04R1B_FULL_STATCAST_SCHEMA_CERTIFIED`

Starting commit: `f857d2f23bcd0423fd03f22ea4482e2d58c5547b`

RESET-04 prepares the database foundation for Pick Analyzer 2.0 without importing data, training models, applying production migrations, changing automation or erasing legacy history. RESET-04R1B repairs the still-unapplied raw Statcast contract after auditing the complete original Baseball Savant files for 2025 and 2026 YTD.

## Full Multi-Season Source Audit

- 2025 files: 30
- 2025 pitches: 712,528
- 2025 games: 2,430
- 2025 date range: 2025-03-18 through 2025-09-28
- 2026 YTD files: 30
- 2026 YTD pitches: 591,316
- 2026 YTD games: 2,004
- 2026 YTD date range: 2026-03-25 through 2026-08-26
- Combined pitches: 1,303,844
- Combined games: 4,434
- MLB teams: 30
- Schema columns: 119 in both seasons
- Cross-season schema compatibility: PASS
- Deduplication identity: `game_pk + at_bat_number + pitch_number`
- Duplicate identities: 0
- Synthetic pitches: 0

All 119 source columns are accounted for in the JSON artifact. The migration explicitly types the highest-value fields and preserves every original Baseball Savant field in `raw_payload` with `raw_payload_digest`.

| Group | Explicit SQL destination | Use |
| --- | --- | --- |
| Identity / game state | `game_pk`, `game_date`, `game_year`, `game_type`, `source_home_team`, `source_away_team`, `source_pitcher_id`, `source_batter_id`, `source_player_name`, `at_bat_number`, `pitch_number` | mapping, grouping, import identity |
| Pitch state | `inning`, `inning_topbot`, `balls`, `strikes`, `outs_when_up`, `stand`, `p_throws`, `pitch_type`, `pitch_name`, `description`, `events`, `type` | prior-game features, labels, audit |
| Pitch shape / velocity / release | `release_speed`, `effective_speed`, `release_spin_rate`, `spin_axis`, `release_extension`, `release_pos_x`, `release_pos_y`, `release_pos_z`, `arm_angle` | pitcher quality and pitch-shape features |
| Movement / location | `pfx_x`, `pfx_z`, `plate_x`, `plate_z`, `zone`, `vx0`, `vy0`, `vz0`, `ax`, `ay`, `az`, `api_break_z_with_gravity`, `api_break_x_arm`, `api_break_x_batter_in` | command, movement and location features |
| Batted-ball / contact | `launch_speed`, `launch_angle`, `estimated_ba_using_speedangle`, `estimated_woba_using_speedangle`, `estimated_slg_using_speedangle`, `launch_speed_angle`, `hit_distance_sc`, `bb_type`, `hit_location`, `hc_x`, `hc_y` | contact-quality features from prior games |
| Batter swing | `bat_speed`, `swing_length`, `attack_angle`, `attack_direction`, `swing_path_tilt` | swing-quality features from prior games |
| Score / label state | `home_score`, `away_score`, `bat_score`, `fld_score`, `post_home_score`, `post_away_score`, `post_bat_score`, `post_fld_score` | labels only for target game |

Missing optional analytical fields such as `pitch_type` and `release_speed` must not reject a legitimate row. Required ingestion identity remains minimal and source-supported.

R1's unsupported-field claim is superseded. The full source supports `launch_speed`, `launch_angle`, `estimated_woba_using_speedangle`, `release_spin_rate`, `spin_axis`, `plate_x`, `plate_z`, `pfx_x`, `pfx_z`, `release_extension`, `arm_angle`, `bat_speed`, `swing_length` and `attack_angle`. Direct `barrel` and `HardHit%` fields are not source columns in this contract; they may be derived only after certified definitions.

The pregame feature denylist blocks same-target-game use of score state, win expectancy, run expectancy, pitcher/batter days-until-next-game and other future/outcome fields. These fields may remain available for label generation, audit and prior-game aggregate derivation only when temporal as-of rules are certified.

## Current DB Revalidation

The RESET-01 exact inventory remains the authority for reset-critical row counts:

| Table | Exact rows | Pick 2 classification |
| --- | ---: | --- |
| sports_teams | 117 | KEEP_CORE / REUSE_FOR_PICK_2 |
| sport_players | 27,164 | KEEP_CORE / REUSE_FOR_PICK_2 |
| sport_events | 11,459 | KEEP_CORE / REUSE_FOR_PICK_2 |
| game_results | 5,973 | KEEP_CORE / REUSE_FOR_PICK_2 |
| sport_game_stats | 13,082 | KEEP_CORE |
| sport_player_stats | 629,542 | KEEP_CORE |
| sport_lineups | 4,193 | KEEP_CORE |
| sport_injuries | 6 | KEEP_CORE |
| sports_odds_snapshots | 880,735 | KEEP_CORE / MARKET_STORAGE |
| prediction_history | 19,219 | LEGACY_ARCHIVE |
| historical_feature_snapshots | 103,232 | REPLACE_WITH_PICK_2_TABLE |
| mlb_starter_assignments | 25 | KEEP_CORE |
| mlb_context_snapshots | 8 | LEGACY_ARCHIVE |
| mlb_forward_opportunity_evidence | 20 | LEGACY_ARCHIVE |
| mlb_forward_research_ledger | 2 | LEGACY_ARCHIVE |
| model_weight_history | 41 | LEGACY_ARCHIVE |
| user_wagers | 0 | DELETE_LATER_AFTER_BACKUP |
| user_wager_legs | 0 | DELETE_LATER_AFTER_BACKUP |

`CURRENT_DB_REVALIDATED = YES` for RESET-04 because the exact RESET-01 production inventory was loaded and production alignment was rechecked. No provider calls or row mutations were used.

## Migration Package

Prepared but not applied:

- `supabase/migrations/202608270002_pick2_data_foundation_v1.sql`

The migration is additive and remains unapplied. It creates Pick 2 raw Statcast storage, feature snapshots, daily feature tables, model registry/version/training/validation tables, pure prediction storage, prediction result evaluation, market-value evaluation and data-health status storage. RESET-04R1B updates the raw table before application rather than creating a follow-up migration.

## Safety

- Statcast imports: 0
- New sports imports: 0
- Provider calls: 0
- Production DB mutations: 0
- Prediction writes: 0
- Model training: 0
- Calibration changes: 0
- Official Pick writes: 0
- Learning writes: 0
- Automation activated: NO
- New cron: NO
- Destructive legacy DML: 0
- Legacy physical removal: NOT PERFORMED

## Final Flags

- `PICK_2_DATA_DOMAINS_READY = YES`
- `STATCAST_RAW_STORAGE_READY = YES`
- `STATCAST_RAW_IDEMPOTENCY_READY = YES`
- `PICK_2_DAILY_FEATURE_SCHEMA_READY = YES`
- `PURE_SPORTS_PREDICTION_STORAGE_READY = YES`
- `SPORTS_MODEL_MARKET_STORAGE_SEPARATED = YES`
- `LEGACY_DB_ISOLATION_READY = YES`
- `PICK_2_DATA_SECURITY_MODEL_READY = YES`
- `PICK_2_LOGICAL_HARD_RESET_READY = YES`
- `PHYSICAL_DELETE_BACKUP_GATE_READY = YES`
- `PICK_2_CHAMPION_MODEL = NONE`
- `STATCAST_IMPORT_PERFORMED = NO`
- `SOURCE_COLUMNS_ACCOUNTED_FOR = 100%`
- `FULL_SOURCE_COLUMNS_ACCOUNTED_FOR = 100%`
- `STATCAST_2025_2026_SCHEMA_COMPATIBILITY = PASS`
- `RAW_SOURCE_FIDELITY_119_COLUMNS = PASS`
- `DEPRECATED_EMPTY_COLUMN_POLICY_READY = YES`
- `STATCAST_ADVANCED_FIELD_SUPPORT_CORRECTED = YES`
- `PICK_2_STATCAST_PREGAME_DENYLIST_READY = YES`
- `MULTI_MARKET_LABEL_RECONSTRUCTION_READY = YES`
- `PURE_F5_MODEL_FOUNDATION_READY = YES`
- `PURE_NRFI_YRFI_MODEL_FOUNDATION_READY = YES`
- `PURE_RUN_DISTRIBUTION_FOUNDATION_READY = YES`
- `PURE_WIN_PROBABILITY_FOUNDATION_READY = YES`
- `MONTE_CARLO_MULTI_MARKET_FOUNDATION_READY = YES`
- `STATCAST_RAW_SCHEMA_V1_READY = YES`
- `STATCAST_SOURCE_IDENTITY_CERTIFIED = YES`
- `STATCAST_PLAYER_IDENTITY_SEPARATION_READY = YES`
- `STATCAST_TEAM_IDENTITY_CONTRACT_READY = YES`
- `STATCAST_SCORE_STATE_STORAGE_READY = YES`
- `STATCAST_TARGET_RECONSTRUCTION_CONTRACT_READY = YES`
- `STATCAST_AS_OF_LEAKAGE_GUARD_READY = YES`
