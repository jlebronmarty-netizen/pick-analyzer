# NBA Player Props — prospective SHADOW settlement gate (18 Nov 2026)

This branch is intentionally **research-only**, based on main. It does not change props UI PR #351, archive PR #340, crons, database, GOAT calls, Official Picks or model weights.

## Evidence
- Live quotes continue in `nba_market_quotes_v1`. Historic facts in `nba_goat_player_game_research_v1` remain at 192 games / 5,323 player-game rows; last archive capture UTC 2026-11-16.
- The UI direction from PR #351 is descriptive L10, **not a calibrated or contract-certified betting prediction**.
- A quote is not a frozen decision. Do not grade old quotes as if they were picks and do not use reconstructed historical data as genuine pregame evidence.

## What this commit provides
A pure deterministic grading helper for the eight props markets. It uses a separately frozen decision and an identity-matched, explicitly verified final record. It distinguishes WIN/LOSS/PUSH from UNSETTLED and fails closed on unresolved rules (OT, DNP/voids, FanDuel region), unsupported/partial stats, timing and disputes. Combined stats sum values from the **same final game**. The summary excludes unresolved rows from ROI denominators and includes coverage.

## Next integration gates (not enabled)
1. Reconcile PR #351 against updated main; pass latest-head CI and private Preview.
2. Add an append-only RLS-protected SHADOW decision table with unique key (game,player,market,line,side,freeze-time,formula version), source quote ID and region/period/contract evidence; write BEFORE pregame cutoff only, independently of UI GET. No official-pick writes.
3. Verify sportsbook DNP, overtime, void and push policies for the actual FanDuel region/contract; only then set verified options in the final grader.
4. Add separately audited final facts with provenance, replay-safe idempotency and corrected-final dispute handling; run daily settlement from an existing approved cron **without duplicate provider calls**.
5. Report by-market frozen coverage, MAE (where projected numeric line exists), outcomes, calibration (only when real probabilities have been frozen), ROI, confidence intervals, and forward holdout by version; do not label an L10 heuristic a model edge.
6. For GOAT incremental archive use isolated PR #340 path after cost/secret/Storage/cron protections; do not claim daily archive is operational while last capture remains Nov 16 UTC.

Run: `node --test tests/nba-props-settlement-shadow.test.mjs`. No writes or network calls.
