# MLB First 3 Innings Moneyline — Unified Market V1

Status: RESEARCH-ONLY / SHADOW-ONLY

Frozen fallback: `f3_ml_winpct_extreme_q95_v1`

## Target certification

Score after inning 3 from Statcast.

2025 dual-source audit vs Retrosheet:

- mapped games: 2,430
- exact score matches: 2,425
- one-run mismatches excluded: 5
- exact-match rate: 99.79%

Ties are pushes for the 2-way period moneyline and are excluded from accuracy.

## Frozen rule

- feature = home prior win% - away prior win%
- select only when absolute advantage >= **0.268037684706378**
- positive => HOME
- negative => AWAY

This threshold corresponds to the 95th percentile of absolute 2025 development advantage.

## 2025 evidence

- 55 / 77 = **71.43%**
- pushes = 22
- worst month = **66.67%**
- minimum monthly n = 7

Monthly:
- May: 30/41 = 73.17%, 7 pushes
- Jun: 8/12 = 66.67%, 8 pushes
- Jul: 6/9 = 66.67%, 4 pushes
- Aug: 5/7 = 71.43%, 3 pushes
- Sep: 6/8 = 75.00%

No tested stable F3 ML candidate reached 75%.

State before external: `REVISIT_AFTER_FIRST_PASS_EXTERNAL_PENDING`.

No historical F3 pricing is certified in the current corpus.

## 2026 one-shot external result

Validation class: `UNIFIED_2025_TO_2026_ONE_SHOT`.

- eligible rows: 2,240
- selected including pushes: 105
- non-push selections: 80
- correct: 36
- accuracy: **45.00%**
- pushes: 25
- selection coverage: **4.69%**
- worst selected month: **0.00%** on n=2 in June
- retuned after external result: **NO**

State: `REVISIT_AFTER_FIRST_PASS`.

Do not rescue this version using 2026 thresholds.
