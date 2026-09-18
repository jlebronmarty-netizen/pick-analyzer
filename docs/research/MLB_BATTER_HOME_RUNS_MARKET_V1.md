# MLB Batter Home Runs — Unified Market Rule V1

Status: RESEARCH-ONLY / SHADOW-ONLY

Frozen candidate: `batter_hr_under_0p5_proj_0p10_v1`

## Frozen rule

- line = **0.5 HR**
- direction = **UNDER**
- select when projected HR <= **0.10**
- strict prior-date batter history only
- same-day game 1 is not prior input for game 2

Final all-2025 refit reserved for external scoring:

- n = 40,886
- intercept = 0.0562641814171271
- slope = 0.536870614141035

## 2025 expanding rolling evidence

- 11,176 / 12,016 = **93.01%**
- worst month = **92.31%**
- baseline UNDER 0.5 = **88.75%**
- lift = **+4.26 percentage points**

Monthly:

- May: 2,493/2,673 = 93.27%
- Jun: 2,421/2,610 = 92.76%
- Jul: 2,050/2,199 = 93.22%
- Aug: 2,196/2,379 = 92.31%
- Sep: 2,016/2,155 = 93.55%

State before external check: `TARGET_MET_75_PLUS_EXTERNAL_PENDING`.

Historical prop prices are not certified; accuracy does not imply ROI/EV/CLV.

Official Picks unchanged. APOSTAR disabled. Historical Odds API credits: 0.

## 2026 one-shot external result

Validation class: `UNIFIED_2025_ROLLING_TO_2026_ONE_SHOT`.

- eligible strict-prior rows: 35,558
- selected: 13,507
- correct: 12,448
- accuracy: **92.16%**
- selected coverage: **37.99%**
- worst selected month: **90.77%**
- unconditional UNDER 0.5 baseline: **89.00%**
- lift vs baseline: **+3.16 percentage points**
- retuned after external result: **NO**

Monthly:

- Apr: 2,065/2,275 = 90.77%
- May: 2,891/3,113 = 92.87%
- Jun: 2,543/2,769 = 91.84%
- Jul: 2,180/2,370 = 91.98%
- Aug: 2,529/2,719 = 93.01%
- Sep-to-date: 240/261 = 91.95%

State: `TARGET_MET_75_PLUS`.

Historical sportsbook prices are not certified; ROI/EV/CLV remain unclaimed.
