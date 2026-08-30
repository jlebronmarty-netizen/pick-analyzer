# MLB_DATA_01D_2025_FEATURE_PERSISTENCE_BLOCKED

Generated: 2026-08-29

## Verdict

`MLB_DATA_01D_2025_FEATURE_PERSISTENCE_BLOCKED`

The bounded production DML execution stopped during the first daily feature table
write after successfully inserting the certified generic feature snapshots.

## Authorized Scope

- Feature version: `MLB_DATA_01D_2025_PREGAME_FEATURE_DRY_RUN_V1`
- Authorized domains: team, starter, bullpen, batter, offense, matchup,
  first-inning and generic feature snapshots.
- Provider calls, schema changes, raw mutations, native identity mutations,
  model work, predictions, 2026 import, automation and cron changes remained
  unauthorized.

## Prewrite Gates

- Production commit: `875b46d34553bc3618067fec202a2f780a39b2d8`
- Dry-run artifact revalidated: YES
- Feature prewrite zero baseline: PASS
- Raw rows: 712,528
- Unique pitch identities: 712,528
- Duplicate pitch identities: 0
- Native games: 2,430
- Native players: 1,469
- Pitcher native parity: PASS
- Batter native parity: PASS
- Eligible target games: 2,249
- Insufficient-history games: 181

## Execution Result

`pick2_feature_snapshots` inserted successfully:

- Snapshot inserts: 67,433
- Snapshot conflicts: 0 observed before next-table failure

The next write, `pick2_mlb_team_daily_features`, failed at the first batch:

```text
duplicate key value violates unique constraint "pick2_mlb_team_daily_features_team_id_feature_date_feature__key"
```

The failure is caused by the legacy uniqueness contract
`team_id + feature_date + feature_version`, which cannot represent multiple
target games for the same team/date/version. This conflicts with the certified
native target-game key required for 2025 feature persistence.

## Production Readback After Stop

| Table | Rows |
| --- | ---: |
| `pick2_feature_snapshots` | 67,433 |
| `pick2_mlb_team_daily_features` | 0 |
| `pick2_mlb_pitcher_daily_features` | 0 |
| `pick2_mlb_bullpen_daily_features` | 0 |
| `pick2_mlb_batter_daily_features` | 0 |
| `pick2_mlb_matchup_daily_features` | 0 |
| `pick2_mlb_first_inning_daily_features` | 0 |
| `pick2_mlb_games` | 2,430 |
| `pick2_mlb_players` | 1,469 |
| `pick2_mlb_game_results` | 0 |
| `pick2_mlb_market_event_mappings` | 0 |
| `pick2_model_registry` | 0 |
| `pick2_model_feature_sets` | 0 |
| `pick2_model_versions` | 0 |
| `pick2_model_training_runs` | 0 |
| `pick2_model_validation_runs` | 0 |
| `pick2_game_predictions` | 0 |
| `pick2_prediction_results` | 0 |
| `pick2_market_value_evaluations` | 0 |
| 2026 raw probe | 0 |

## Safety

- Provider calls: 0
- Production schema mutations: 0
- Raw Statcast mutations: 0
- Native identity mutations: 0
- Model training: NO
- Model validation: NO
- Champion promotion: NO
- Prediction generation: NO
- Market-value writes: 0
- 2026 import: NO
- Automation activated: NO
- Cron changes: 0

## Required Next Phase

`MLB_DATA_01D_R1_FEATURE_PERSISTENCE_KEY_REPAIR`

The next phase must resolve the legacy daily-feature uniqueness mismatch before
resuming persistence. Do not append daily features blindly and do not train
models from the snapshot-only partial state.
