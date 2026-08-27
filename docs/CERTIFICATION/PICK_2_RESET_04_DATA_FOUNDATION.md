# PICK-2.0 RESET-04 Data Foundation

Status: `PICK_2_RESET_04_DATA_FOUNDATION_CERTIFIED`

Starting commit: `f857d2f23bcd0423fd03f22ea4482e2d58c5547b`

RESET-04 prepares the database foundation for Pick Analyzer 2.0 without importing data, training models, applying production migrations, changing automation or erasing legacy history.

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

The migration is additive. It creates Pick 2 raw Statcast storage, feature snapshots, daily feature tables, model registry/version/training/validation tables, pure prediction storage, prediction result evaluation, market-value evaluation and data-health status storage.

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
