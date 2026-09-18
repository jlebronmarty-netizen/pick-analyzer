# MLB Batter Doubles — Unified Market Rule V1

Status: RESEARCH-ONLY / SHADOW-ONLY

Frozen candidate: `batter_doubles_under_0p5_proj_0p16_v1`

## Frozen rule

- line = **0.5 doubles**
- direction = **UNDER**
- select when projected doubles <= **0.16**
- equivalent edge = at least **0.34 doubles below** the 0.5 line
- strict prior-date batter history only
- same-day game 1 is not prior input for game 2

Final all-2025 refit for external scoring:

- n = 42,601
- intercept = 0.126877618354346
- slope = 0.210234641434428

## 2025 expanding rolling evidence

- 12,507 / 14,454 = **86.53%**
- worst month = **84.94%**
- baseline UNDER 0.5 = **85.07%**
- lift = **+1.46 percentage points**

Monthly:
- May: 2,399/2,770 = 86.61%
- Jun: 2,704/3,142 = 86.06%
- Jul: 2,690/3,167 = 84.94%
- Aug: 2,135/2,458 = 86.86%
- Sep: 2,579/2,917 = 88.41%

State before external: `TARGET_MET_75_PLUS_EXTERNAL_PENDING`.

Incremental signal is modest; keep baseline/lift visible. Historical prop pricing is not certified; no ROI/EV/CLV claim.

## 2026 one-shot external result

Validation class: `UNIFIED_2025_ROLLING_TO_2026_ONE_SHOT`.

- eligible rows: 40,648
- selected: 20,282
- correct: 17,632
- accuracy: **86.93%**
- selected coverage: **49.90%**
- worst selected month: **85.87%**
- unconditional UNDER 0.5 baseline: **85.65%**
- lift vs baseline: **+1.28 percentage points**
- retuned after external result: **NO**

Monthly:
- Apr: 2,386/2,770 = 86.14%
- May: 3,366/3,920 = 85.87%
- Jun: 3,170/3,675 = 86.26%
- Jul: 3,148/3,586 = 87.79%
- Aug: 3,601/4,118 = 87.45%
- Sep-to-date: 1,961/2,213 = 88.61%

State: `TARGET_MET_75_PLUS`.

Incremental signal is positive but modest. Historical prop prices are not certified; ROI/EV/CLV remain unclaimed.
