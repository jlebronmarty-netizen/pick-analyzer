# MLB Batter Singles — Unified Market Rule V1

Status: RESEARCH-ONLY / SHADOW-ONLY

Frozen candidate: `batter_singles_under_1p5_proj_0p50_v1`

## Frozen rule

- line = **1.5 singles**
- direction = **UNDER**
- select when projected singles <= **0.50**
- equivalent edge = at least **1.0 single below** the 1.5 line
- strict prior-date batter history only
- same-day game 1 is not prior input for game 2

Final all-2025 refit for external scoring:

- n = 42,601
- intercept = 0.260944252887134
- slope = 0.515544560255828

## 2025 expanding rolling evidence

- 7,822 / 8,328 = **93.92%**
- worst month = **93.10%**
- minimum monthly n = 1,197
- unconditional UNDER 1.5 baseline = **89.96%**
- lift = **+3.96 percentage points**

Monthly:
- May: 1,200/1,289 = 93.10%
- Jun: 1,130/1,197 = 94.40%
- Jul: 1,431/1,515 = 94.46%
- Aug: 1,867/1,998 = 93.44%
- Sep: 2,194/2,329 = 94.20%

State before external: `TARGET_MET_75_PLUS_EXTERNAL_PENDING`.

Historical prop pricing is not certified; no ROI/EV/CLV claim. Official Picks unchanged. APOSTAR disabled.
