# F5 strict-pregame count V1 — Closeout

Status: **RESEARCH ONLY / DEVELOPMENT GATE FAILED / EXTERNAL CLOSED**

Contract freeze: `1d933ffe`  
Evaluator freeze: `7dabf75b`

This architecture models HOME and AWAY F5 runs separately with a shared Poisson GLM using strict-prior team context and opposing starter L5. Exact Poisson convolution produces HOME/AWAY/PUSH probabilities; selection remains fixed at conditional non-push confidence >=75%.

## Result

- source games: **2,662**
- eligible: **1,562**
- selected: **37**
- settled non-push: **34**
- wins/losses: **24 / 10**
- pushes: **3**
- accuracy: **70.59%**
- coverage: **2.37%**
- selected months: **6**
- worst month: **40.00%**
- max side confidence: **88.06%**
- gate: **FAIL**

The count model improves selection volume relative to the direct F5 classifier, but remains below the required pooled accuracy and monthly stability. No parameter, threshold or feature rescue is permitted.

External remains closed.
