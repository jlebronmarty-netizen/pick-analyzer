# MLB Moneyline Opening Consensus — Forward Freeze 2026-09-26

Status: **RESEARCH-ONLY / FROZEN BEFORE FIRST PITCH**

The frozen Moneyline formula from PR #237 is not certified for production because its untouched 2026 external test failed the permanent n/stability gates despite 30/37 = 81.08% pooled accuracy.

This artifact therefore records **shadow forward evidence only**.

## Prospective materialization

For 2026-09-26, 13 schedule-only matchup rows were staged before games began and passed through the existing leakage-safe V4 feature materializer.

Readback:
- 13 scheduled games
- 13 xyear feature rows
- materializer status COMPLETE
- integrity READY_CORE_FAIL_CLOSED
- 0 cutoff violations
- 0 starter-evidence time violations
- 9 games with all six formula features
- 11 games with exact BetMGM + BetRivers opening Moneyline
- 7 games where both feature and opening evidence overlap
- 1 exact threshold crossing

No same-day result was used.

## Frozen candidate

**CWS Moneyline vs COL**

- gamePk: 824543
- first pitch: 2026-09-26 23:10 UTC
- consensus opening no-vig HOME probability: **67.3005%**
- threshold: >=65%
- fundamentals aligned: **6/6**

Opening:
- BetMGM CWS -235 / COL +190, opened 00:39:04 UTC
- BetRivers CWS -240 / COL +195, opened 01:21:04 UTC

Fundamentals, all CWS-favorable:
- season win%: 51.57% vs 35.63%
- run diff/game: +0.346 vs -1.206
- Pythagorean win%: 53.42% vs 39.57%
- L5 win%: 80% vs 0%
- starter RA9: 3.643 vs 5.400
- bullpen RA9: 4.581 vs 5.708

Feature cutoff: 2026-09-25.

## Settlement

The settlement script reads only the final MLB Official feed for gamePk 824543. It cannot settle before FINAL and does not recompute the model or replace opening prices.

This is shadow evidence only and does not modify Official Picks or APOSTAR.
