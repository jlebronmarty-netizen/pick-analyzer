# MLB First 7 Innings 3-Way Moneyline — Unified Market V1

Status: RESEARCH-ONLY / SHADOW-ONLY

Frozen fallback: `f7_3way_sp2p0_win0p20_v1`

## Target certification

Score after inning 7 from Statcast.

2025 dual-source audit vs Retrosheet:

- mapped games: 2,430
- exact score matches: 2,418
- one-run mismatches excluded fail-closed: 12
- exact-match rate: 99.51%

## Frozen rule

Predict HOME when:

- away SP RA9 - home SP RA9 >= 2.0
- home prior win% - away prior win% >= 0.20

Predict AWAY on the symmetric inverse.

The candidate does not emit DRAW.

A separate DRAW-only search was completed before freeze:

- best stable DRAW rule: 21/125 = **16.80%**
- base DRAW rate: **11.33%**

## 2025 evidence

- 62 / 89 = **69.66%**
- worst month = **50.00%**
- minimum monthly n = 10

Monthly:
- May: 27/38 = 71.05%
- Jun: 13/16 = 81.25%
- Jul: 5/10 = 50.00%
- Aug: 7/13 = 53.85%
- Sep: 10/12 = 83.33%

State before external: `REVISIT_AFTER_FIRST_PASS_EXTERNAL_PENDING`.

No historical F7 3-way pricing is certified in the current corpus.

## 2026 one-shot external result

Validation class: `UNIFIED_2025_TO_2026_ONE_SHOT`.

- eligible feature rows: 1,966
- selected: 59
- correct: 33
- accuracy: **55.93%**
- selection coverage: **3.00%**
- selected outcomes that were DRAW: 5
- worst selected month: **41.18%**
- retuned after external result: **NO**

Monthly:
- Apr: 14/34 = 41.18%, 3 draw outcomes
- May: 10/15 = 66.67%, 2 draw outcomes
- Jun: 2/3 = 66.67%
- Jul: 5/5 = 100.00%
- Aug: 2/2 = 100.00%

State: `REVISIT_AFTER_FIRST_PASS`.

Do not rescue this version with 2026-driven thresholds or postgame draw filters.
