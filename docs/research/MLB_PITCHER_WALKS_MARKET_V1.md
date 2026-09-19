# MLB Pitcher Walks — Unified Market Rule V1

Status: RESEARCH-ONLY / SHADOW-ONLY

Frozen candidate: `pitcher_walks_under_2p5_proj_1p5_v1`

## Frozen rule

- Odds API market: `pitcher_walks`
- line = **2.5 walks**
- direction = **UNDER**
- select when projected walks <= **1.5**
- equivalent edge = at least **1.0 walk below** the 2.5 line
- previous starts only
- same-date earlier start is excluded from prior history

Final all-2025 refit for external scoring:

- n = 3,099
- intercept = 0.931348589817945
- slope = 0.436404300947991

## 2025 expanding rolling evidence

- 449 / 539 = **83.30%**
- worst month = **79.35%**
- minimum monthly n = 46
- unconditional UNDER 2.5 baseline = **76.04%**
- lift = **+7.26 percentage points**

Monthly:
- May: 112/132 = 84.85%
- Jun: 123/155 = 79.35%
- Jul: 39/46 = 84.78%
- Aug: 89/105 = 84.76%
- Sep: 86/101 = 85.15%

Higher lines such as 3.5 and 4.5 had high raw accuracy but were baseline-dominated, so they were not selected as the primary candidate.

State before external: `TARGET_MET_75_PLUS_EXTERNAL_PENDING`.

Historical prop pricing is not certified; no ROI/EV/CLV claim.

## 2026 one-shot external result

Validation class: `UNIFIED_2025_ROLLING_TO_2026_ONE_SHOT`.

- eligible starter rows: 2,568
- selected: 463
- correct: 396
- accuracy: **85.53%**
- selected coverage: **18.03%**
- unconditional UNDER 2.5 baseline: **75.23%**
- lift vs baseline: **+10.30 percentage points**
- worst selected month: **74.36%** in May
- retuned after external result: **NO**

Monthly:
- Apr: 2/2 = 100.00%
- May: 58/78 = 74.36%
- Jun: 86/99 = 86.87%
- Jul: 106/118 = 89.83%
- Aug: 133/155 = 85.81%
- Sep-to-source-end: 11/11 = 100.00%

State: `TARGET_MET_75_PLUS`.

Historical prop prices are not certified; ROI/EV/CLV remain unclaimed.
