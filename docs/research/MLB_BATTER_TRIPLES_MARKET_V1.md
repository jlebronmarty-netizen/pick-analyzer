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
