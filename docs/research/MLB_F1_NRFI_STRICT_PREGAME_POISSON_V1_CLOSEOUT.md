# F1 NRFI strict-pregame Poisson V1 — Closeout

Status: **RESEARCH ONLY / DEVELOPMENT GATE FAILED / EXTERNAL CLOSED**

Contract freeze: `228f53e1`  
Evaluator freeze: `f538957a`

## Architecture

A shared Poisson GLM models each first-inning half separately using only the admitted strict-prior pregame subset:

- batting offense OPS proxy
- batting offense strikeout rate
- opposing starter L5 RA9
- opposing starter L5 WHIP
- home-batting-half indicator

The two expected run rates are combined mechanically:

```
P(NRFI) = exp(-(lambda_home + lambda_away))
```

Frozen L2=8, monthly prior-only refits and threshold 0.75 were fixed before evaluation.

## Result

- source games: **4,099**
- eligible forecasts: **3,438**
- selected: **15**
- wins/losses: **9 / 6**
- accuracy: **60.00%**
- coverage: **0.44%**
- selected months: **5**
- worst month: **0%**
- P(NRFI) range: **4.97%–45.74%**
- development gate: **FAIL**

The model never generated an NRFI probability at or above the frozen 75% threshold. All selected decisions came from the symmetric YRFI tail. This architecture fails pooled accuracy, sample size and monthly stability.

No threshold lowering, lambda search, feature expansion or post-result calibration is permitted.

## Boundaries

Research-only; zero provider calls, historical Odds API credits, Official Picks, APOSTAR, production promotion or tracker changes. External remains closed.
