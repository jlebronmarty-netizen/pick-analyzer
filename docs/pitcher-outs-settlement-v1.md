# Pitcher Outs Settlement V1

Pitcher-outs shadow settlement is independent of sportsbook markets.

## Rules

- actual recorded outs comes from trusted stored player game stats
- actual >= threshold means the threshold was reached
- actual < threshold means the threshold was not reached
- Over 17.5 maps to actual >= 18
- Under 17.5 maps to actual <= 17

Settlement persists actual outs, error, absolute error, squared error, threshold outcomes, source and settlement timestamp when eligible stored projections and outcomes exist.

No sportsbook line settlement is active until verified player prop markets exist.
