# MLB Learning Brain V1

MLB Learning Brain V1 is the first controlled end-to-end learning loop for Pick Analyzer. The initial use case is pitcher recorded-outs shadow projections.

## Architecture

- Data source: stored MLB `sport_player_stats`, `sport_events` and `universal_projection_history`.
- Projection store: `universal_projection_history`.
- Feature snapshot store: `universal_projection_history.feature_snapshot`.
- Model version: `mlb_pitcher_outs_shadow_baseline_v1`.
- Feature version: `pitcher_outs_feature_contract_v1`.
- Settlement version: `pitcher_outs_settlement_v1`.

No new provider calls are made by ordinary learning reads, training reports or UI reads.

## Daily Loop

1. Existing importers and operating-day jobs update schedule, results and player stats under provider budget controls.
2. Learning Brain audits pitcher outcome rows and starter evidence from stored data.
3. Eligible pregame starter rows can produce immutable shadow feature snapshots.
4. Shadow pitcher recorded-outs projections are stored only when exact event identity, exact pitcher identity, pregame starter evidence and minimum history gates pass.
5. Completed games can settle shadow projections from trusted recorded-outs outcomes.
6. Daily metrics aggregate settled history without mutating model weights.
7. Challenger training and promotion remain sample-gated.

## Safety

The system does not create Official Picks, EV, edge, Kelly, stake or sportsbook recommendations from pitcher-outs projections. Pitcher prop market status remains `NO_MARKET`.

## API

- `GET /api/mlb/learning-brain`
- `GET /api/mlb/learning-brain?validate=true`
- `POST /api/mlb/learning-brain` with `dryRun=true` by default

Protected non-dry execution uses stored data only and persists only eligible shadow rows.
