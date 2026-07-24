# MLB Player Projection Engine V1

Status: Implemented as a sportsbook-independent, informational projection layer.

## Scope

This module produces MLB player statistical projections. It does not produce player-prop betting recommendations.

Pitcher projection families:

- Strikeouts
- Outs Recorded
- Hits Allowed
- Earned Runs
- Walks Allowed
- Pitcher Win Probability
- Projected Innings Pitched

Batter projection families:

- Hits
- Singles
- Doubles
- Triples
- Home Runs
- Total Bases
- RBIs
- Runs
- Walks
- Stolen Bases
- Hits + Runs + RBIs
- Projected Plate Appearances

## Architecture

The implementation reuses the existing Universal Projection Engine and `universal_projection_history` isolated projection table. Player projections are not written to `prediction_history` and are not sportsbook prop predictions.

New APIs:

- `/api/mlb/player-projections`
- `/api/mlb/player-projections/pitchers`
- `/api/mlb/player-projections/batters`
- `/api/mlb/player-projections/[projectionId]`
- `/api/mlb/player-projections/readiness`
- `/api/mlb/player-projections/performance`
- `/api/mlb/player-projections/lifecycle`

Product surface:

- `/player-projections`

Dashboard and operations:

- Dashboard Advanced Details > Model includes Player Projections.
- AI Operations includes `mlb_player_projection_engine`.

## Distribution Methods

- Count stats use coarse Poisson probability buckets from bounded expected values.
- Pitcher win probability remains a bounded statistical probability and is not compared with sportsbook prices.
- Ranges reuse the existing projection interval contract adjusted by confidence.
- Distribution precision remains intentionally coarse until richer player-level features and settled projection history exist.

## Historical Validation

Validation is bounded to protect Supabase Disk IO:

- Pitcher sample: 900 chronological stored pitcher appearances.
- Batter sample: bounded plate appearances aggregated to player-game rows.
- Splits: chronological training, validation and holdout.
- Metrics: MAE, RMSE, MSE, Brier score, calibration error, calibration bias and distribution fit label.

The validation evaluates statistical projection quality, not betting ROI.

## Current Slate Result

The current safe projection run found eligible games but generated no live player projections because current starter and lineup participation context was not available. This is an expected safety block.

Current blockers:

- `MISSING_PROBABLE_STARTER`
- `MISSING_EXPECTED_LINEUP`
- `NO_CURRENT_PLAYER_PROJECTION_ROWS_GENERATED`

## Guardrails

- No player-prop Official Picks.
- No Best Value entries.
- No EV.
- No Kelly.
- No sportsbook implied probability.
- No fabricated lines or prices.
- No production full-game model weight changes.
- No Learning Brain weight changes.
- No Current Board betting activation.
- No provider calls.

## Certifications

- `MLB_PLAYER_PROJECTION_ENGINE_PASS`
- `PITCHER_PROJECTION_PASS`
- `BATTER_PROJECTION_PASS`
- `PLAYER_PROJECTION_DISTRIBUTION_PASS`
- `PLAYER_PROJECTION_POINT_IN_TIME_PASS`
- `PLAYER_PROJECTION_SETTLEMENT_PASS`
- `PLAYER_PROJECTION_LEARNING_PASS`
- `PLAYER_PROJECTION_IDEMPOTENCY_PASS`
- `PLAYER_PROJECTION_PRODUCT_PASS`
- `NO_PROP_BETTING_ACTIVATION_PASS`
