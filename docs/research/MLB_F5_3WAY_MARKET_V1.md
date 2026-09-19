# MLB First 5 Innings 3-Way Moneyline — Unified Market V1

Status: RESEARCH-ONLY / SHADOW-ONLY

Frozen fallback: `f5_3way_sp1p0_ops0p05_win0p20_v1`

## Target

Outcomes are HOME / AWAY / DRAW from the Statcast score at the end of inning 5.

2025 target certification:

- 2,430 mapped games
- 2,423 exact Statcast/Retrosheet F5 score matches
- 7 one-run mismatches excluded fail-closed

## Frozen rule

Predict HOME when:

- away SP RA9 - home SP RA9 >= 1.0
- home offense OPS proxy - away offense OPS proxy >= 0.05
- home prior win% - away prior win% >= 0.20

Predict AWAY on the symmetric inverse.

The frozen candidate does not emit DRAW.

A separate 2025 DRAW-only search was performed before freeze. Best stable DRAW rule was only 13/56 = 23.21%, versus a 15.97% base draw rate, and did not approach the 75% target.

## 2025 evidence

- 53 / 84 = **63.10%**
- worst month = **45.45%**
- minimum monthly n = 7

Monthly:

- May: 27/39 = 69.23%
- Jun: 6/12 = 50.00%
- Jul: 5/11 = 45.45%
- Aug: 10/15 = 66.67%
- Sep: 5/7 = 71.43%

No stable F5 3-way candidate reached 75%.

State before external: `REVISIT_AFTER_FIRST_PASS_EXTERNAL_PENDING`.

No historical F5 3-way pricing is certified in the current corpus.
