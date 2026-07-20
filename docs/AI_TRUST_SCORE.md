# AI Trust Score

AI Trust Score V1 is an engineering health score, not a betting probability.

## Components

| Component | Weight | Source |
| --- | ---: | --- |
| Sample size adequacy | 15 | settled prediction rows |
| Accuracy stability | 10 | probability stability from history |
| Brier Score | 15 | stored probabilities and settled outcomes |
| Log Loss | 10 | stored probabilities and settled outcomes |
| Calibration error | 15 | average confidence minus accuracy |
| Feature quality | 10 | stored feature snapshots |
| Data sufficiency | 10 | stored feature snapshots |
| Settlement coverage | 8 | settled/graded rows divided by history rows |
| Drift control | 7 | model, confidence and feature drift |
| Provider health | 10 | existing readiness contracts |

Unavailable components are not fabricated. Their effective weight is removed. The score is marked provisional when available weight is below 75 or settled sample is below 30.

Labels: `EXCELLENT`, `STRONG`, `MODERATE`, `LIMITED`, `INSUFFICIENT DATA`.
