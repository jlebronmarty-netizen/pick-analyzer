# MLB Opening Consensus Moneyline — Prospective Runtime V1

Status: **RESEARCH-ONLY / SHADOW-ONLY**

This runtime automates the exact pregame workflow proven manually on 2026-09-26.

It does **not** promote the formula. The frozen formula remains uncertified because the untouched 2026 external test passed pooled accuracy (30/37 = 81.08%) but failed n>=60 and worst-month stability.

## Hourly workflow

The existing hourly MLB Official settlement cron runs this research stage independently and non-blocking:

1. Stage only future games from `pick2_mlb_games` into `mlb_ml_xyear_game_v1`.
   - insert-only;
   - scores, innings and actual_winner are NULL;
   - no existing postgame row can be overwritten.

2. Capture probable-starter evidence with the existing timestamp gate.

3. Run `mlb_ml_xyear_materialize_pregame_v4`.
   - must return COMPLETE;
   - must return READY_CORE_FAIL_CLOSED;
   - cutoff violations must be zero;
   - starter timestamp violations must be zero.

4. Re-read BALLDONTLIE opening Moneyline for the current date.
   - BetMGM + BetRivers only;
   - exact opening endpoint, never current odds as substitute;
   - deterministic insert of missing opening rows only;
   - current date is requeryable.

5. Apply the frozen formula:
   - two-book no-vig favorite probability >=0.65;
   - 6/6 fundamentals aligned;
   - HOME/AWAY symmetric.

6. Freeze exact candidate rows into `mlb_ml_opening_consensus_forward_v1`.

Formula state remains:

`EXTERNAL_ACCURACY_PASS_N_AND_STABILITY_FAIL_NO_RETUNE`

Every frozen row is shadow evidence only.

The manual Sep26 proof produced one crossing: CWS ML vs COL, 67.3005% consensus, 6/6 fundamentals.
