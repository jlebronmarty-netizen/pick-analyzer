# MLB First 1 Inning Moneyline — Unified Market V1

Status: RESEARCH-ONLY / SHADOW-ONLY

Frozen fallback: `f1_ml_sp1p0_win0p20_v1`

## Target certification

Score after inning 1 from Statcast.

2025 dual-source audit vs Retrosheet:

- mapped games: 2,430
- exact score matches: 2,428
- one-run mismatches excluded fail-closed: 2
- exact-match rate: 99.92%

Ties are pushes for the 2-way inning moneyline.

## Frozen rule

Predict HOME when:

- away SP RA9 - home SP RA9 >= 1.0
- home offense OPS proxy is at least away offense OPS proxy
- home prior win% - away prior win% >= 0.20

Predict AWAY on the symmetric inverse.

## 2025 evidence

- 51 / 74 = **68.92%**
- pushes = 60
- worst month = **50.00%**
- minimum monthly n = 8

Monthly:
- May: 23/36 = 63.89%, 17 pushes
- Jun: 8/11 = 72.73%, 13 pushes
- Jul: 4/8 = 50.00%, 10 pushes
- Aug: 9/11 = 81.82%, 10 pushes
- Sep: 7/8 = 87.50%, 10 pushes

A higher pooled candidate existed using the 95th percentile of prior win% advantage:

- 42/55 = **76.36%**
- but minimum monthly n = 3
- therefore it failed the frozen stability gate and was rejected before external validation.

State before external: `REVISIT_AFTER_FIRST_PASS_EXTERNAL_PENDING`.

No historical F1 pricing is certified in the current corpus.
