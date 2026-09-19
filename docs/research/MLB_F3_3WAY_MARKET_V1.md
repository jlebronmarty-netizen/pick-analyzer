# MLB First 3 Innings 3-Way Moneyline — Unified Market V1

Status: RESEARCH-ONLY / SHADOW-ONLY

Frozen fallback: `f3_3way_sp1p5_ops0p05_win0p20_v1`

## Target certification

Score after inning 3 from Statcast.

2025 dual-source audit vs Retrosheet:

- mapped games: 2,430
- exact score matches: 2,425
- one-run mismatches excluded fail-closed: 5
- exact-match rate: 99.79%

## Frozen rule

Predict HOME when all are true:

- away SP RA9 - home SP RA9 >= 1.5
- home offense OPS proxy - away offense OPS proxy >= 0.05
- home prior win% - away prior win% >= 0.20

Predict AWAY on the symmetric inverse.

The candidate does not emit DRAW.

A separate pre-freeze DRAW-only search was completed:

- best stable DRAW rule: 38/114 = **33.33%**
- base DRAW rate: **25.00%**

## 2025 evidence

- 44 / 73 = **60.27%**
- worst month = **28.57%**
- minimum monthly n = 5

Monthly:
- May: 24/35 = 68.57%
- Jun: 7/12 = 58.33%
- Jul: 2/7 = 28.57%
- Aug: 8/14 = 57.14%
- Sep: 3/5 = 60.00%

State before external: `REVISIT_AFTER_FIRST_PASS_EXTERNAL_PENDING`.

No historical F3 3-way pricing is certified in the current corpus.
