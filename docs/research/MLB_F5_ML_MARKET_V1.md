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
