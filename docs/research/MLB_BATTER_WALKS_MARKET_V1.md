# MLB Batter Walks — Unified Market Rule V1

Status: RESEARCH-ONLY / SHADOW-ONLY

Frozen candidate: `batter_walks_under_0p5_proj_0p20_v1`

## Frozen rule

- line = **0.5 batter walks**
- direction = **UNDER**
- select when projected walks <= **0.20**
- equivalent edge = at least **0.30 walks below** the 0.5 line
- strict prior-date batter history only
- same-day game 1 is not prior input for game 2

Final all-2025 refit for external scoring:

- n = 40,886
- intercept = 0.117815177785939
- slope = 0.593708345578887

## 2025 expanding rolling evidence

- 1,253 / 1,489 = **84.15%**
- worst month = **81.49%**
- minimum monthly n = 131
- unconditional UNDER 0.5 baseline = **73.92%**
- lift = **+10.23 percentage points**

Monthly:
- May: 108/131 = 82.44%
- Jun: 234/280 = 83.57%
- Jul: 153/177 = 86.44%
- Aug: 273/335 = 81.49%
- Sep: 485/566 = 85.69%

State before external: `TARGET_MET_75_PLUS_EXTERNAL_PENDING`.

Historical prop pricing is not certified; no ROI/EV/CLV claim. Official Picks unchanged. APOSTAR disabled.

## 2026 one-shot external result

Validation class: `UNIFIED_2025_ROLLING_TO_2026_ONE_SHOT`.

- eligible strict-prior rows: 35,558
- selected: 3,106
- correct: 2,590
- accuracy: **83.39%**
- selected coverage: **8.74%**
- worst selected month: **79.13%**
- unconditional UNDER 0.5 baseline: **72.66%**
- lift vs baseline: **+10.73 percentage points**
- retuned after external result: **NO**

Monthly:
- Apr: 398/503 = 79.13%
- May: 568/676 = 84.02%
- Jun: 509/608 = 83.72%
- Jul: 517/605 = 85.45%
- Aug: 546/649 = 84.13%
- Sep-to-date: 52/65 = 80.00%

State: `TARGET_MET_75_PLUS`.

Historical prop prices are not certified; ROI/EV/CLV remain unclaimed.
