# MLB First 5 Innings Moneyline — Unified Market V1

Status: RESEARCH-ONLY / SHADOW-ONLY

Frozen fallback: `f5_ml_sp0p5_ops0p08_win0p05_v1`

## Target certification

F5 score is derived from Statcast `post_home_score/post_away_score` at the end of inning 5.

2025 dual-source audit against Retrosheet:

- mapped games: 2,430
- exact F5 score matches: 2,423
- mismatches: 7
- mismatch magnitude: exactly 1 run each
- development excludes those 7 mismatches fail-closed

F5 ties are treated as pushes and excluded from side accuracy.

## Frozen rule

HOME when all are true:

- away starter RA9 - home starter RA9 >= 0.50
- home offense OPS proxy - away offense OPS proxy >= 0.08
- home prior win% - away prior win% >= 0.05

AWAY when the symmetric inverse conditions are true.

## 2025 development evidence

- 60 / 88 non-push selections = **68.18%**
- pushes = 15
- worst month = **64.71%**
- monthly SD = 3.56 percentage points

Monthly:

- May: 31/45 = 68.89%
- Jun: 11/17 = 64.71%
- Jul: 8/12 = 66.67%
- Aug: 4/6 = 66.67%
- Sep: 6/8 = 75.00%

No tested stable 2025 F5 ML formula reached 75%.

State before external: `REVISIT_AFTER_FIRST_PASS_EXTERNAL_PENDING`.

No F5 historical pricing exists in the current snapshot corpus. Accuracy only; no ROI/EV/CLV claim.

## 2026 one-shot external result

Validation class: `UNIFIED_2025_TO_2026_ONE_SHOT`.

- eligible feature rows: 1,966
- selected including pushes: 70
- non-push selections: 61
- correct: 34
- accuracy: **55.74%**
- pushes: 9
- selection coverage: **3.56%**
- worst selected month: **40.00%**
- retuned after external result: **NO**

Monthly:
- Apr: 15/30 = 50.00%, 8 pushes
- May: 14/23 = 60.87%
- Jun: 3/3 = 100.00%
- Jul: 2/5 = 40.00%, 1 push

State: `REVISIT_AFTER_FIRST_PASS`.

Do not rescue this frozen fallback with 2026-driven thresholds. Revisit F5 ML later with a materially different architecture or certified F5 pricing information.
