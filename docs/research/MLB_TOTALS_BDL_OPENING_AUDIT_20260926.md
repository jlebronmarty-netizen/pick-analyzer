# MLB Full Game Total — BALLDONTLIE Opening Audit

Status: **RESEARCH-ONLY / NO NEW CANDIDATE PASSED**

This audit repeats the clean Moneyline-V2 style exercise for Full Game Totals.

## Exact market contract
- BetMGM + BetRivers only.
- Both books must have the identical exact opening total.
- Different opening lines (for example 7.5 vs 8.0) are different contracts and are not averaged together.

May-Sep exact same-line games: **1,243**.
- Over: 556
- Under: 625
- Push: 62
- average no-vig opening Over probability: 50.02%

## Protocol
Cuts are derived only from May-Jul 2025 distributions. Aug-Sep is internal holdout. 2026 is not used to choose thresholds.

Season and L5 run features were reconstructed from `mlb_ml_xyear_team_game_v1` using only `source_game_date < target_game_date`; no same-date doubleheader result enters history.

### Family 1 — opening-line residuals
Season, recent L5, and SP+ bullpen projections were evaluated against the exact opening total.

Best accuracy was only:
- TOT-A: **131/251 = 52.19%**
- TOT-D market-confirmed composite: **73/144 = 50.69%**

No sign reversal was attempted.

### Family 2 — Statcast run environment
2025 clean coverage:
- offense hard-hit / barrel: 1,243/1,243
- starter hard-hit / whiff: 1,126/1,243
- park/weather/roof/bullpen-fatigue persisted fields: 0/1,243, therefore excluded.

Run-environment residual vs market:
- best = TOT-F
- **286/534 = 53.56%**
- May-Jul 50.62%
- Aug-Sep 58.10%
- worst month 46.23%

FAIL.

## Disposition
**NO_75_PLUS_STABLE_FULL_GAME_TOTAL_OPENING_FORMULA_CURRENT_CLEAN_INFORMATION**

Current evidence does not support further threshold search with these same information families. A future Total attempt should wait for genuinely new clean pregame information rather than retuning these cuts.

No Official Picks changes, no APOSTAR activation, no production promotion, and no historical Odds API spend.
