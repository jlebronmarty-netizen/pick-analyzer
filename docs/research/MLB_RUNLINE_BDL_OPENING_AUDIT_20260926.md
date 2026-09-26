# MLB Standard Run Line — BALLDONTLIE Opening Audit

Status: **RESEARCH-ONLY / NO NEW CANDIDATE PASSED**

This audit repeats the clean Moneyline-V2 style exercise for the standard MLB Run Line without using 2026 to select thresholds.

## Exact market contract
- BetMGM + BetRivers only.
- Both books must offer the exact standard ±1.5 line.
- Both books must agree which club is DOG +1.5.
- Retrosheet market identity is mapped through the canonical 2025 game map to exact MLB gamePk.
- No fuzzy matching and no line extrapolation.

May-Sep exact joined baseline: **803/1306 = 61.49% DOG +1.5 cover**.

## Protocol
Thresholds/cuts are derived only from May-Jul 2025 feature distributions. Aug-Sep is internal holdout. 2026 is not used for threshold selection.

### Family 1 — market + raw fundamentals/context
Best architecture: RL-B/RL-D
- 105/149 = **70.47%**
- May-Jul: 65/96 = 67.71%
- Aug-Sep: 40/53 = 75.47%
- worst month: 66.67%
- FAIL overall accuracy.

### Family 2 — market + frozen DOG-oriented PREGAME components
Best architecture: RL-H broad composite
- 84/118 = **71.19%**
- May-Jul: 54/74 = 72.97%
- Aug-Sep: 30/44 = 68.18%
- worst month: 65.38%
- FAIL accuracy.

No threshold rescue or sign reversal is allowed after these outcomes were read.

## Existing benchmark
The previously frozen DOG +1.5 V2 remains a prospective research benchmark. Its historical thresholds were developed using 2025 plus already-opened 2026, so they are not treated as clean thresholds for this audit.

## Disposition
**NO_NEW_75_PLUS_STABLE_STANDARD_RUN_LINE_OPENING_FORMULA**

No Official Picks changes, no APOSTAR activation, no production promotion, and no historical Odds API spend.
