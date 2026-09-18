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
