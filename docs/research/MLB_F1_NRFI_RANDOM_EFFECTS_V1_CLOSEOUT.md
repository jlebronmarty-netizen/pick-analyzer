# F1 NRFI Random Effects V1 — Closeout

Status: **RESEARCH ONLY / DEVELOPMENT GATE FAILED / EXTERNAL CLOSED**

Contract: `MLB_F1_NRFI_RANDOM_EFFECTS_V1/1.0.0`

The contract was frozen at `6f7698c6` and the evaluator at `c9adb945` before reading the real result.

## Architecture

Joint penalized logistic likelihood:

```
logit P(NRFI) =
  intercept
+ home-starter effect
+ away-starter effect
+ home-offense effect
+ away-offense effect
```

Pitcher and offense effects use fixed L2 penalty 20. The model is refit once per calendar month from strictly earlier same-season games only. Same-date outcomes are never available to the prediction pass. Eligibility requires 300 prior league games, 3 starts per pitcher and 10 prior games per offense.

Frozen selection rule:
- NRFI if p >= 0.75
- YRFI if p <= 0.25
- otherwise abstain

No grid, calibration rescue, lambda search or post-result feature change was authorized.

## Result

- source rows: **4,683**
- eligible forecasts: **2,977**
- selected: **2,373**
- wins/losses: **1,189 / 1,184**
- accuracy: **50.11%**
- coverage: **79.71%**
- selected months: **8**
- worst month: **47.02%**
- modeled p(NRFI) range: **0.0000014 to 0.6242**
- development gate: **FAIL**

The model never reached the frozen NRFI threshold of 0.75. The selected cohort therefore comes from the symmetric YRFI tail and performs near chance. This is a decisive architecture failure under the frozen contract; it is not a candidate for threshold lowering.

External remains closed.

## Boundaries

- research-only
- zero provider calls
- zero historical Odds API credits
- no Official Picks writes
- APOSTAR disabled
- no production promotion
- tracker unchanged
- no retuning
