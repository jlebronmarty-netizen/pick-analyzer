# F1 NRFI Starter-L5 Zero-Logit V1 — Closeout

Status: **RESEARCH ONLY / DEVELOPMENT GATE FAILED / EXTERNAL CLOSED**

Contract freeze: `826223f6`  
Evaluator freeze: `2e468eca`

This architecture uses the newly admitted strict-prior starter L5 surface plus strict-prior offense context. It models each half-inning's probability of scoring zero runs with a shared Bernoulli logistic model, then multiplies the two half probabilities:

```
P(NRFI) = P(home batting half = 0) * P(away batting half = 0)
```

Frozen settings:
- starter history: exactly five prior starts, same season, prior date only;
- offense OPS proxy + offense K%;
- opposing starter L5 K/BF, BB/BF, Hits/BF, Whiff/Swings, Chase/OZ, HardHit/BIP;
- monthly prior-only refits;
- L2 = 8;
- NRFI if p >= 0.75, YRFI if p <= 0.25;
- no grid, threshold lowering, feature search or calibration rescue.

## Result

- source games: **2,663**
- eligible forecasts: **1,563**
- selected: **0**
- coverage: **0%**
- P(NRFI) range: **34.65%–67.75%**
- development gate: **FAIL**

The new starter information materially changed the probability surface versus earlier outcome-only models, but it still never reached the frozen 75% decision confidence. This is a coverage failure, not a 0% accuracy result.

No threshold or feature rescue is permitted. External remains closed.

## Boundaries

Research-only; zero provider calls, historical Odds API credits, Official Picks, APOSTAR, production promotion or tracker changes.
