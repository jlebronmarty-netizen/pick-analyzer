# MLB Pitcher Backtest Readiness V1

Status: PARTIAL

The repository has enough historical starter appearance data to prepare a future backtest, but V1 does not claim completed calibrated backtest results.

## Available Historical Data

- Historical starter pitcher appearances: 4,860
- Recorded outs coverage among starter rows: complete in audit sample
- Pitch-count coverage among starter rows: nearly complete
- Supporting game dates and home/away context: available through `historical_baseball_games`

## Current Limitations

- Current SportsDataIO player IDs are not yet fully bridged to Retrosheet canonical player IDs.
- V1 exact-name matching is sufficient for guarded live preview but is not certification-grade identity linkage for full backtesting.
- Opponent lineup strength, bullpen availability, umpire, park and weather features are incomplete or not yet wired into pitcher projections.

## Future Metrics

Required backtest metrics:

- mean absolute error for outs
- root mean squared error
- percentage within 1 out
- percentage within 2 outs
- threshold Brier score
- threshold calibration
- over/under accuracy by line
- performance by confidence tier
- performance by starter certainty
- performance by sample size

## Readiness Result

Current data is sufficient to validate distribution math and limited historical workload baselines. It is not sufficient to certify a full production-calibrated pitcher outs model without stronger current-to-historical identity mapping and settled projection history.
