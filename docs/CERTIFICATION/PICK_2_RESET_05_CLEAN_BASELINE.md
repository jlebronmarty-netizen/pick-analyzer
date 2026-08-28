# PICK-2.0 RESET-05 Clean Baseline

Status: `PICK_2_RESET_05_CLEAN_BASELINE_CERTIFIED`

Production commit: `4a1ca1913d9f21631151bb90a05bc010ef635cfd`

The user manually applied `supabase/migrations/202608270002_pick2_data_foundation_v1.sql` through the approved Supabase Production SQL Editor. RESET-05 did not reapply the migration and made no Codex DDL or DML changes.

## Production Readback

The RESET-05 readback used service-role Supabase `head` selects only. All 17 Pick 2 foundation tables were visible and readable, and every new Pick 2 table returned a zero-row baseline.

| Table | Rows |
| --- | ---: |
| `pick2_raw_mlb_statcast_pitches` | 0 |
| `pick2_feature_snapshots` | 0 |
| `pick2_mlb_pitcher_daily_features` | 0 |
| `pick2_mlb_batter_daily_features` | 0 |
| `pick2_mlb_team_daily_features` | 0 |
| `pick2_mlb_bullpen_daily_features` | 0 |
| `pick2_mlb_matchup_daily_features` | 0 |
| `pick2_mlb_first_inning_daily_features` | 0 |
| `pick2_model_registry` | 0 |
| `pick2_model_feature_sets` | 0 |
| `pick2_model_versions` | 0 |
| `pick2_model_training_runs` | 0 |
| `pick2_model_validation_runs` | 0 |
| `pick2_game_predictions` | 0 |
| `pick2_prediction_results` | 0 |
| `pick2_market_value_evaluations` | 0 |
| `pick2_data_health_status` | 0 |

## Contracts

- Raw Statcast production storage: `PASS`
- Raw pitch identity: `game_pk + at_bat_number + pitch_number`
- Source/canonical identity separation: `PASS`
- Feature as-of storage: `PASS`
- Model Lab storage: `PASS`
- Champion model: `NONE`
- Pure sports prediction storage: `PASS`
- Prediction evaluation storage: `PASS`
- Market-value storage separated from predictions: `PASS`
- Canonical core preservation: `PASS`
- FK contract: `PASS`
- Index contract: `PASS`
- RLS/security source contract: `PASS`

## Clean Baseline

- Pick 2 predictions: 0
- Pick 2 evaluations: 0
- Pick 2 market-value rows: 0
- Pick 2 models: 0
- Pick 2 training runs: 0
- Pick 2 validation runs: 0
- Statcast rows inserted: 0
- Legacy rows relabeled as Pick 2: 0
- Legacy physical deletes/truncates: 0

## Next Boundary

`MLB_DATA_01A_2025_RAW_VALIDATION_ALLOWED = YES`

Raw import is still not authorized. The next phase may validate the 2025 raw Statcast files against the certified schema, but must not import data until separately authorized after validation.
