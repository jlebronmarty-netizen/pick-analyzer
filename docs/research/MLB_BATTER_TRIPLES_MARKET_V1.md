# MLB Batter Triples — Unified Market Rule V1

Status: RESEARCH-ONLY / SHADOW-ONLY

Frozen candidate: `batter_triples_under_0p5_proj_0p015_v1`

## Frozen rule

- line = **0.5 triples**
- direction = **UNDER**
- select when projected triples <= **0.015**
- strict prior-date batter history only
- same-day game 1 is not prior input for game 2

Final all-2025 refit for external scoring:

- n = 42,601
- intercept = 0.00876081897272024
- slope = 0.294769143425622

## 2025 expanding rolling evidence

- 27,562 / 27,832 = **99.03%**
- worst month = **98.90%**
- unconditional UNDER 0.5 baseline = **98.74%**
- lift = **+0.29 percentage points**

State before external: `TARGET_MET_75_PLUS_EXTERNAL_PENDING_LOW_INCREMENTAL_SIGNAL`.

This market is explicitly **baseline-dominated**. High accuracy must not be interpreted as strong incremental model value or betting profitability.

Historical prop pricing is not certified; no ROI/EV/CLV claim.

## 2026 one-shot external result

Validation class: `UNIFIED_2025_ROLLING_TO_2026_ONE_SHOT`.

- eligible rows: 40,648
- selected: 30,045
- correct: 29,689
- accuracy: **98.82%**
- selected coverage: **73.92%**
- worst selected month: **98.61%**
- unconditional UNDER 0.5 baseline: **98.63%**
- lift vs baseline: **+0.18 percentage points**
- retuned after external result: **NO**

Monthly:
- Apr: 4,300/4,349 = 98.87%
- May: 5,547/5,619 = 98.72%
- Jun: 5,391/5,467 = 98.61%
- Jul: 5,191/5,252 = 98.84%
- Aug: 5,978/6,037 = 99.02%
- Sep-to-date: 3,282/3,321 = 98.83%

State: `TARGET_MET_75_PLUS_LOW_INCREMENTAL_SIGNAL`.

This result remains baseline-dominated. Do not interpret 98%+ event accuracy as strong betting edge. Historical prop prices are not certified; ROI/EV/CLV remain unclaimed.
