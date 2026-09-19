# MLB First 5 Innings Totals — Unified Market V1

Status: RESEARCH-ONLY / SHADOW-ONLY

Frozen fallback: `f5_total_over_ref4p5_proj5p0_v1`

## Important pricing caveat

There are **no historical F5 total lines in the current snapshot corpus**.

Therefore 4.5 is used only as a **research reference line**, not claimed to be the actual historical sportsbook line for every game.

## Target certification

F5 score uses Statcast post-inning scores.

2025 dual-source audit vs Retrosheet:

- 2,430 mapped games
- 2,423 exact F5 score matches
- 7 one-run mismatches excluded fail-closed

## Model

Strict prior-date team F5 form:

- expected home F5 runs = average(home prior F5 scored, away prior F5 allowed)
- expected away F5 runs = average(away prior F5 scored, home prior F5 allowed)
- raw total = expected home + expected away
- minimum 5 prior games per team
- same-day games excluded from prior history

Final all-2025 fit:

- n = 2,343
- intercept = 2.14443614450973
- slope = 0.591475378488326
- MAE = 2.61452632098546

## Frozen rule

- reference line = 4.5
- direction = OVER
- select when projected F5 total >= 5.0
- equivalent reference edge >= 0.5

## 2025 evidence

- 371 / 679 = **54.64%**
- worst month = **48.57%**
- minimum monthly n = 35

Monthly:

- May: 17/35 = 48.57%
- Jun: 20/41 = 48.78%
- Jul: 74/121 = 61.16%
- Aug: 104/196 = 53.06%
- Sep: 156/286 = 54.55%

No stable tested F5 total formula reached 75%.

State before external: `REVISIT_AFTER_FIRST_PASS_EXTERNAL_PENDING`.

No ROI/EV/CLV claim without certified historical F5 prices/lines.

## 2026 one-shot external result

Validation class: `UNIFIED_2025_TO_2026_ONE_SHOT_REFERENCE_LINE`.

- eligible prior-form rows: 2,178
- selected OVER 4.5 reference opportunities: 1,373
- correct: 719
- accuracy: **52.37%**
- selected coverage: **63.04%**
- unconditional OVER 4.5 reference baseline: **50.14%**
- worst selected month: **49.32%**
- retuned after external result: **NO**

Monthly:
- Apr: 102/181 = 56.35%
- May: 108/219 = 49.32%
- Jun: 137/257 = 53.31%
- Jul: 149/282 = 52.84%
- Aug: 153/293 = 52.22%
- Sep-to-date: 70/141 = 49.65%

State: `REVISIT_AFTER_FIRST_PASS`.

Do not rescue this version with 2026-driven thresholds.

Reminder: 4.5 is a research reference line only because historical F5 sportsbook lines are not available in the current corpus.
