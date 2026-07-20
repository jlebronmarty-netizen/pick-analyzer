# MLB Market Model Requirements V1

Existing reusable systems:
- Multi-Sport Engine
- Provider SDK
- Odds normalization
- Feature Store
- Prediction SDK
- Historical Import Engine
- Settlement
- Replay
- Calibration
- AI Performance Center
- AI Brain
- Current Board
- Market Intelligence

Production-modeled today:
- Moneyline
- Run Line
- Game Total

Team Totals:
- Existing model reusable: No
- Prediction SDK reusable: Yes
- Feature builder reusable: Partially
- New model required: Yes
- New calibration required: Yes
- Complexity: Medium

First Five:
- Existing model reusable: No
- Prediction SDK reusable: Yes
- Feature builder reusable: Partially
- New model required: Yes
- New calibration required: Yes
- Complexity: High

First Inning:
- New market-specific model required.
- High variance and small edge reliability require conservative calibration.
- Complexity: Very High

Pitcher Props:
- New player-level models required.
- Requires player identity, starter status, pitch count/rest features and stat-specific settlement.
- Complexity: Very High

Batter Props:
- New player-level models required.
- Requires confirmed lineups, batting order, plate appearance context and stat-specific settlement.
- Complexity: Very High

Combined/Alternate:
- Requires distribution/correlation models and rule-compatible pricing.
- Complexity: Very High
