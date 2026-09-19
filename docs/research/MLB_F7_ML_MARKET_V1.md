# MLB First 7 Innings Moneyline — Unified Market V1

Status: RESEARCH-ONLY / SHADOW-ONLY

Frozen candidate: `f7_ml_run_diff_extreme_q95_v1`

## Target certification

Score after inning 7 from Statcast.

2025 dual-source audit vs Retrosheet:

- mapped games: 2,430
- exact score matches: 2,418
- one-run mismatches excluded fail-closed: 12
- exact-match rate: 99.51%

Ties are pushes for the 2-way period moneyline and are excluded from accuracy.

## Frozen rule

- feature = home prior run differential per game - away prior run differential per game
- select only when absolute advantage >= **2.82541420162881**
- positive => HOME
- negative => AWAY
- threshold = 95th percentile of absolute 2025 development advantage

## 2025 evidence

- 69 / 91 = **75.82%**
- pushes = 8
- worst month = **66.67%**
- minimum monthly n = 8
- monthly SD = 4.08 percentage points

Monthly:
- May: 33/43 = 76.74%, 5 pushes
- Jun: 14/18 = 77.78%, 1 push
- Jul: 6/8 = 75.00%, 1 push
- Aug: 6/9 = 66.67%, 1 push
- Sep: 10/13 = 76.92%

State before external: `TARGET_MET_75_PLUS_EXTERNAL_PENDING`.

No historical F7 pricing is certified in the current corpus.

## 2026 one-shot external result

Validation class: `UNIFIED_2025_TO_2026_ONE_SHOT`.

- eligible rows: 2,240
- selected including pushes: 91
- non-push selections: 79
- correct: 35
- accuracy: **44.30%**
- pushes: 12
- selection coverage: **4.06%**
- worst selected month: **34.62%**
- retuned after external result: **NO**

Monthly:
- Mar: 9/26 = 34.62%, 5 pushes
- Apr: 20/45 = 44.44%, 6 pushes
- May: 4/5 = 80.00%
- Jun: 2/3 = 66.67%, 1 push

State: `REVISIT_AFTER_FIRST_PASS`.

The frozen 2025 candidate exceeded 75%, but failed external 2026. Do not modify the q95 cutoff using 2026.
