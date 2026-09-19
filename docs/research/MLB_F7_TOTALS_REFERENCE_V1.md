# MLB First 7 Innings Totals — Reference-Line Research V1

Status: RESEARCH-ONLY / SHADOW-ONLY

Frozen fallback: `f7_total_over_ref6p5_proj7p0_v1`

## Pricing caveat

There are no historical F7 total lines in the current snapshot corpus.

The 6.5 point is used only as a balanced research reference line. In 2025, OVER 6.5 occurred about 49.30% of games.

## Target certification

Score after inning 7 from Statcast.

2025 dual-source audit vs Retrosheet:

- mapped games: 2,430
- exact score matches: 2,418
- one-run mismatches excluded fail-closed: 12
- exact-match rate: 99.51%

## Model

Strict-prior team F7 scored/allowed form:

- 25% weight on last-5-date form
- 75% weight on all prior-date form
- minimum 5 prior games per team
- same-day results excluded from prior history

Final all-2025 fit:

- n = 2,338
- intercept = 3.53517782634352
- slope = 0.504004641847965
- MAE = 3.15000355795273

## Frozen rule

- reference line = 6.5
- direction = OVER
- select when projected F7 total >= 7.0
- equivalent reference edge >= 0.5

## 2025 evidence

- 355 / 642 = **55.30%**
- worst month = **51.79%**
- minimum monthly n = 42

Monthly:
- May: 24/42 = 57.14%
- Jun: 29/56 = 51.79%
- Jul: 56/96 = 58.33%
- Aug: 123/211 = 58.29%
- Sep: 123/237 = 51.90%

State before external: `REVISIT_AFTER_FIRST_PASS_EXTERNAL_PENDING`.

No ROI/EV/CLV claim without certified historical F7 prices/lines.
