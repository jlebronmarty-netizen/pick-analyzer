# MLB First 3 Innings Totals — Reference-Line Research V1

Status: RESEARCH-ONLY / SHADOW-ONLY

Frozen fallback: `f3_total_over_ref2p5_proj3p0_v1`

## Pricing caveat

There are no historical F3 total lines in the current snapshot corpus.

The 2.5 point is used only as a balanced research reference line. In 2025, OVER 2.5 occurred 48.40% of games.

## Target certification

Score after inning 3 from Statcast.

2025 dual-source audit vs Retrosheet:

- mapped games: 2,430
- exact score matches: 2,425
- one-run mismatches excluded fail-closed: 5
- exact-match rate: 99.79%

## Model

Strict-prior team F3 scored/allowed form:

- 75% weight on last-5-date form
- 25% weight on all prior-date form
- minimum 5 prior games per team
- same-day results excluded from prior history

Final all-2025 fit:

- n = 2,345
- intercept = 2.5303236380252
- slope = 0.151683250978056
- MAE = 1.99397956601203

## Frozen rule

- reference line = 2.5
- direction = OVER
- select when projected F3 total >= 3.0
- equivalent reference edge >= 0.5

## 2025 evidence

- 368 / 715 = **51.47%**
- worst month = **49.12%**
- minimum monthly n = 96

State before external: `REVISIT_AFTER_FIRST_PASS_EXTERNAL_PENDING`.

No ROI/EV/CLV claim without certified historical F3 prices/lines.
