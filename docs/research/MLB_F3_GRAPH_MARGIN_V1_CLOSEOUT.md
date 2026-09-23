# F3 Graph Margin V1 — Closeout

Status: **RESEARCH ONLY / DEVELOPMENT GATE FAILED / EXTERNAL CLOSED**

Contract: `MLB_F3_GRAPH_MARGIN_V1/1.0.0`

Contract freeze: `ffde4213`  
Evaluator freeze: `5a051dd4`

## Architecture

The model treats prior F3 matchups as a weighted graph and fits ridge team ratings to the continuous F3 run margin:

```
margin = home advantage + rating(home) - rating(away) + error
```

Frozen settings:
- monthly refit from strictly earlier same-season games;
- ridge lambda = 12;
- 40 coordinate sweeps;
- minimum 300 prior league games;
- minimum 10 prior games per team;
- residual Normal distribution from the same frozen monthly fit;
- HOME/AWAY selection only when conditional non-push side probability >=0.75;
- F3 ties settle as pushes.

No lambda grid, confidence search or post-result calibration was run.

## Result

- source rows: **4,680**
- eligible forecasts: **3,756**
- selected: **12**
- settled non-push: **10**
- wins/losses: **6 / 4**
- pushes: **2**
- accuracy: **60.00%**
- coverage: **0.32%**
- selected months: **3**
- worst month: **50.00%**
- maximum side confidence: **81.91%**
- development gate: **FAIL**

This fails sample size, selected-month coverage, pooled accuracy and monthly stability. The 0.75 selection threshold is not lowered.

External remains closed.

## Boundaries

- research-only
- zero provider calls
- zero historical Odds API credits
- Official Picks unchanged
- APOSTAR disabled
- no production promotion
- tracker unchanged
- no retuning
