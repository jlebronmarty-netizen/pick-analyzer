# F1 strict-pregame logit V1 — Closeout

Status: **RESEARCH ONLY / INSUFFICIENT SAMPLE / EXTERNAL CLOSED**

Contract frozen at `6ee07da1`; evaluator frozen at `4e0d79ee` before the real-data run.

The model uses the admitted reconstructed strict-prior pregame subset only. Ten pairwise features are standardized from prior training rows and fitted with monthly rolling L2 logistic regression. F1 ties are pushes.

## Result

- source rows: **4,099**
- eligible forecasts: **2,702**
- selected: **2**
- non-push decisions: **2**
- wins/losses: **2 / 0**
- accuracy: **100%**
- coverage: **0.074%**
- selected months: **2**
- worst selected month: **100%**
- p(HOME) range: **0.3734–0.7842**
- gate: **FAIL — insufficient n and months**

The 2/2 result is descriptive only. It does not pass the frozen minimum of 60 settled decisions and 5 selected months. Confidence 0.75, feature subset and lambda remain unchanged.

No external window is opened.

## Boundaries

Research-only; no provider calls, historical Odds API credits, Official Picks, APOSTAR, production promotion, tracker edit or post-result rescue.
