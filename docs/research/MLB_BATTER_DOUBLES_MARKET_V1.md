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
