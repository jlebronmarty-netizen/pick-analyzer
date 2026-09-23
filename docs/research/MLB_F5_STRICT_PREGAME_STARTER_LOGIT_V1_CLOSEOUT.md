# F5 strict-pregame starter logit V1 — Closeout

Status: **RESEARCH ONLY / POOLED 75% BUT SAMPLE + STABILITY GATES FAIL / EXTERNAL CLOSED**

Contract freeze: `694457f5`  
Evaluator freeze: `f77422be`

This model uses newly admitted strict-prior starter L5 information together with reconstructed strict-prior team strength, offense and bullpen features. It is a monthly rolling L2 logistic classifier for non-push F5 HOME/AWAY outcomes.

Frozen settings:
- L2 = 8
- confidence = 0.75
- minimum 300 prior non-push training games
- 12 fixed pairwise pregame features
- exact L5 starter histories from prior dates only
- F5 ties are pushes

## Result

- source games: **2,662**
- eligible forecasts: **1,562**
- selected: **13**
- non-push decisions: **12**
- wins/losses: **9 / 3**
- pushes: **1**
- pooled accuracy: **75.00%**
- coverage: **0.83%**
- selected months: **3**
- worst month: **62.50%**
- development gate: **FAIL**

The pooled point estimate touches the target, but it does **not** satisfy the predeclared evidence standard:
- n must be at least 60;
- at least 5 selected months are required;
- worst selected month must be at least 65%.

Therefore this is not a qualifying candidate and no external window opens. The 0.75 threshold is not lowered and no feature/lambda rescue is allowed.

## Boundaries

Research-only; zero provider calls, historical Odds API credits, Official Picks, APOSTAR, production promotion or tracker changes.
