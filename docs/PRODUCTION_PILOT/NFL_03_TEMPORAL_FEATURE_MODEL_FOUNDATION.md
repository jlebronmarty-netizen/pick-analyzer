# NFL-03 Temporal Feature Model Foundation

Status: `NFL_03_TEMPORAL_FEATURE_MODEL_FOUNDATION_CERTIFIED`

NFL-03 builds the first production-grade offline NFL historical feature and
training foundation from certified canonical BallDontLie history. It does not
call providers, write production predictions, activate NFL Current Era, expose
Official Picks, modify Learning Brain weights or fabricate historical betting
markets.

## Temporal Contract

Each feature row represents one completed target game. Every source input must
satisfy `source_event.start_time < target_event.start_time`; result-dependent
features require prior completed games. Same-game statistics, future games,
final season aggregates, final standings and forward-only roster data are
blocked from pregame features.

## Split

- Train: 2021, 2022, 2023
- Validation/calibration: 2024
- Holdout: 2025

2025 is opened only after the model, feature set and Platt calibration contract
are frozen.

## Results

- Eligible feature rows: 1311
- Train rows: 767
- Validation rows: 272
- Holdout rows: 272
- Feature count: 86
- Leakage violations: 0
- 2025 holdout Brier: 0.2329
- 2025 holdout accuracy: 59.93%
- 2025 total MAE: 10.97
- 2025 margin MAE: 10.74

## Market Boundary

Moneyline probabilities are certified as model outputs. Spread and total product
probabilities require real exact sportsbook lines in a later phase. NFL-03 does
not fabricate historical spread or total lines.

## Next Gate

`NFL-04_CURRENT_ERA_SHADOW_AND_CURRENT_MARKET_INTEGRATION` may use this
foundation with current The Odds API NFL markets, but it remains separately
authorization-gated.
