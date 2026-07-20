# MLB Projection Unit Contracts

Projection units are explicit:

- `COUNT_PER_GAME`
- `SEASON_COUNT`
- `RATE_PER_9`
- `PERCENT_0_TO_1`
- `PERCENT_0_TO_100`
- `DECIMAL_RATE`
- `INNINGS_BASEBALL_NOTATION`
- `OUTS_COUNT`
- `PITCH_COUNT`
- `PROBABILITY`
- `UNKNOWN`

Baseball innings notation is not decimal innings. `5.2` baseball innings equals 17 outs. Pitcher game outcomes are generated from game-level expectations, not raw season totals. ERA and K/9 remain rate metrics. Probability is stored/displayed on a 0-100 scale for projection board output.

