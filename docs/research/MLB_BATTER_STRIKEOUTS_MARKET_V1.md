# MLB Batter Strikeouts — Unified Market Rule V1

Status: RESEARCH-ONLY / SHADOW-ONLY

Frozen candidate: `batter_k_under_1p5_proj_0p5_v1`

## Frozen rule

- line = **1.5 batter strikeouts**
- direction = **UNDER**
- select when projected strikeouts <= **0.50**
- equivalent edge = at least **1.0 K below** the 1.5 line
- strict prior-date batter history only
- same-day game 1 is not prior input for game 2

Final all-2025 refit for external scoring:

- n = 40,886
- intercept = 0.243436273584974
- slope = 0.713440597820141

## 2025 expanding rolling evidence

- 564 / 592 = **95.27%**
- worst month = **92.86%**
- minimum monthly n = 36
- unconditional UNDER 1.5 baseline = **80.11%**
- lift = **+15.16 percentage points**

Monthly:
- May: 36/36 = 100.00%
- Jun: 94/99 = 94.95%
- Jul: 104/112 = 92.86%
- Aug: 165/172 = 95.93%
- Sep: 165/173 = 95.38%

State before external: `TARGET_MET_75_PLUS_EXTERNAL_PENDING`.

Historical prop pricing is not certified; no ROI/EV/CLV claim. Official Picks unchanged. APOSTAR disabled.
