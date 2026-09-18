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

## 2026 one-shot external result

Validation class: `UNIFIED_2025_ROLLING_TO_2026_ONE_SHOT`.

- eligible rows: 40,648
- selected: 13,634
- correct: 12,690
- accuracy: **93.08%**
- selected coverage: **33.54%**
- worst selected month: **91.16%**
- unconditional UNDER 1.5 baseline: **90.30%**
- lift vs baseline: **+2.78 percentage points**
- retuned after external result: **NO**

Monthly:
- Apr: 1,753/1,923 = 91.16%
- May: 2,563/2,745 = 93.37%
- Jun: 2,301/2,466 = 93.31%
- Jul: 2,223/2,385 = 93.21%
- Aug: 2,493/2,663 = 93.62%
- Sep-to-date: 1,357/1,452 = 93.46%

State: `TARGET_MET_75_PLUS`.

Historical prop prices are not certified; ROI/EV/CLV remain unclaimed.
