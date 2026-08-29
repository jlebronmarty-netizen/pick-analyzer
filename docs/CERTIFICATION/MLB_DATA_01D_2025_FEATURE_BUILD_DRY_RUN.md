# MLB-DATA-01D 2025 Feature Build Dry Run

Status: `MLB_DATA_01D_2025_FEATURE_BUILD_DRY_RUN_CERTIFIED`

Artifact: `docs/CERTIFICATION/mlb-data-01d-2025-feature-build-dry-run.json`

## Scope

01D prepares the 2025 Pick 2 MLB pregame feature foundation from already imported and native-identity-certified Statcast rows. This certification is dry-run only.

Feature writes, model training, model validation, champion promotion, predictions, Official Picks, market-value evaluation, provider calls, 2026 import, automation and cron changes were not performed.

## Identity Baseline

- Production commit: `875b46d34553bc3618067fec202a2f780a39b2d8`
- Raw rows: `712528`
- Unique pitch identities: `712528`
- Duplicate pitch identities: `0`
- Native games: `2430`
- Native players: `1469`
- Pitcher native coverage: `712528 / 712528`
- Batter native coverage: `712528 / 712528`

## As-Of Contract

Production native game rows do not yet carry scheduled timestamps. The dry-run therefore uses a conservative chronology:

`source_game_date < target_game_date`

The `as_of_date` is the calendar day before the target game. Same-day games and doubleheaders are excluded from source history unless a later phase certifies completed-before-start timestamps.

## Feature Table Inventory

Actual existing tables:

- `pick2_feature_snapshots`
- `pick2_mlb_team_daily_features`
- `pick2_mlb_pitcher_daily_features`
- `pick2_mlb_bullpen_daily_features`
- `pick2_mlb_batter_daily_features`
- `pick2_mlb_matchup_daily_features`
- `pick2_mlb_first_inning_daily_features`

R5 native columns support `target_game_pk`, MLBAM pitcher/batter/person IDs and legacy-relaxed matchup/first-inning keys. Current row count for every feature table is `0`.

## Dry-Run Row Projection

- Target games: `2430`
- Eligible games: `2249`
- Insufficient-history games: `181`
- Team rows: `4498`
- Starter rows: `4498`
- Bullpen rows: `4498`
- Batter rows: `44943`
- Offense rows: `4498`
- Matchup rows: `2249`
- First-inning rows: `2249`
- Snapshot rows: `67433`

## Safety Results

- Leakage violations: `0`
- Identity conflicts: `0`
- Feature sanity audit: `PASS`
- Temporal spot check: `PASS`
- Raw immutability: `PASS`
- Native identity preservation: `PASS`
- Feature write authorized: `NO`
- Feature dry-run ready for persistence: `YES`
- Model work performed: `NO`
- Prediction work performed: `NO`
- Provider calls: `0`
- Production schema mutations: `0`
- Production DML mutations: `0`
