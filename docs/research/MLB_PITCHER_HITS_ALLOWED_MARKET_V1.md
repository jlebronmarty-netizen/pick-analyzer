# MLB Pitcher Hits Allowed — Unified Market Rule V1

Status: RESEARCH-ONLY / SHADOW-ONLY

Frozen candidate: `pitcher_hits_allowed_under_6p5_proj_5p0_v1`

## Frozen rule

- market key: `pitcher_hits_allowed`
- line = **6.5 hits allowed**
- direction = **UNDER**
- select when projected hits allowed <= **5.0**
- equivalent edge = at least **1.5 hits below** the 6.5 line
- previous **starts only**
- same-date earlier start is not allowed to enter later same-date prior history

Final all-2025 refit for external scoring:

- n = 3,099
- intercept = 2.97876810879942
- slope = 0.415326852941172

## 2025 expanding rolling evidence

- 634 / 761 = **83.31%**
- worst month = **77.78%**
- minimum monthly n = 9
- unconditional UNDER 6.5 baseline = **75.17%**
- lift = **+8.14 percentage points**

Monthly:
- May: 7/9 = 77.78%
- Jun: 109/139 = 78.42%
- Jul: 149/165 = 90.30%
- Aug: 181/224 = 80.80%
- Sep: 188/224 = 83.93%

State before external: `TARGET_MET_75_PLUS_EXTERNAL_PENDING`.

Historical prop pricing is not certified in our snapshot table; no ROI/EV/CLV claim. Official Picks unchanged. APOSTAR disabled.

## 2026 one-shot external result

Validation class: `UNIFIED_2025_ROLLING_TO_2026_ONE_SHOT`.

- eligible starter rows: 2,568
- selected: 1,226
- correct: 968
- accuracy: **78.96%**
- selected coverage: **47.74%**
- worst selected month: **75.69%**
- unconditional UNDER 6.5 baseline: **75.47%**
- lift vs baseline: **+3.49 percentage points**
- retuned after external result: **NO**

Monthly:
- Apr: 6/6 = 100.00%
- May: 193/255 = 75.69%
- Jun: 213/273 = 78.02%
- Jul: 252/311 = 81.03%
- Aug: 279/349 = 79.94%
- Sep-to-date: 25/32 = 78.13%

State: `TARGET_MET_75_PLUS`.

Historical sportsbook prices are not certified in our current snapshots; ROI/EV/CLV remain unclaimed.
