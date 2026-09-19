# MLB First 1 Inning 3-Way Moneyline — Unified Market V1

Status: RESEARCH-ONLY / SHADOW-ONLY

Frozen fallback: `f1_3way_draw_close_sp0p5_ops0p05_win0p20_v1`

## Target certification

Score after inning 1 from Statcast.

2025 dual-source audit vs Retrosheet:

- mapped games: 2,430
- exact score matches: 2,428
- one-run mismatches excluded fail-closed: 2
- exact-match rate: 99.92%

## Frozen rule

Predict **DRAW** when all are true:

- absolute starter RA9 advantage <= 0.50
- absolute offense OPS advantage <= 0.05
- absolute prior win% advantage <= 0.20

## 2025 evidence

- 125 / 221 = **56.56%**
- baseline DRAW = **52.33%**
- lift = **+4.23 percentage points**
- worst month = **45.61%**
- minimum monthly n = 34

Monthly:
- May: 23/39 = 58.97%
- Jun: 21/34 = 61.76%
- Jul: 19/39 = 48.72%
- Aug: 36/52 = 69.23%
- Sep: 26/57 = 45.61%

No stable First 1 3-way rule reached 75%.

State before external: `REVISIT_AFTER_FIRST_PASS_EXTERNAL_PENDING`.

No historical First 1 3-way pricing is certified in the current corpus.

## 2026 one-shot external result

Validation class: `UNIFIED_2025_TO_2026_ONE_SHOT`.

- eligible feature rows: 1,966
- baseline DRAW: **53.05%**
- selected: 285
- correct: 159
- accuracy: **55.79%**
- selection coverage: **14.50%**
- lift vs baseline: **+2.74 percentage points**
- worst selected month: **48.78%**
- retuned after external result: **NO**

State: `REVISIT_AFTER_FIRST_PASS`.

Do not rescue this version with 2026-driven closeness thresholds.
