# NHL Independent 3-Market Challenger — Research V0 (Nov 13, 2026)

## Goal and caution
We want to improve NHL main-market probability accuracy and risk-adjusted expected returns, and subsequently launch NHL player props. The existing production NHL feed is a frozen public DRatings Moneyline shadow baseline; it is not an independently trained Pick Analyzer model.

No existing champion, moneyline pick, spread pick, total pick, player prop, betting stake, API budget, or cron has been altered by this proposal. All generated forecasts are descriptive unvalidated SHADOW research with no sportsbook odds, edge, or official-pick status.

## Previously validated inventory
- 74 distinct final scores documented in the existing NHL free-run archive as of audit. Earliest observed final timestamps are kept; contradictory later finals are excluded.
- 50 of these final games have gamecenter postgame PBP/boxscore. The dedicated capped gamecenter backfill is already scheduled via NHL_MAIN_MARKET_HISTORY_ENABLED; no second backfill or paid source is introduced.
- 20 teams have five finished games in the score archive, but independent chronological walk-forward pairs were 0 when the last inventory was checked: at least five already-observed games from both teams are required before the decision.
- DRatings 40/62 wins, 64.5% directional ML accuracy. Within the 35 frozen paired-Circa events its Brier was .2175, market no-vig Brier .2112. Cannot claim a return or superior probability model from this sample.
- Old generic odds snapshots for moneyline/spread/total have not refreshed since July 28, 2026. The live free feed provides some Circa Moneyline prices, not a current FanDuel ML/puckline/totals market universe.

## Research model designed
- Read-only GET /api/nhl/challenger-research, using JSON games from existing historical nhl_free_runs_v1 PASS/PARTIAL rows; no external requests, writes, user actions or model promotion.
- Earliest captured official FINAL (not game start) is the knowledge timestamp for that result. Reject contradictory finals, postponed, malformed, live, future or non-2026-27 regular-season event identifiers; preserve earliest official FINAL. Do not fabricate pregame access to later backfilled boxes.
- Minimum 25 prior NHL final games across league and 5 prior games for each team. At cutoff, last-5 attack/defense scoring expected-goals baseline is computed 75%, shrunk toward venue-specific league prior 25%. These weights are fixed before evaluation and not tuned against actual winners.
- Independent Poisson score distribution supplies PROXIES for NHL full-game ML, home puck line -1.5 and Over 5.5 (including complementary sides and integer-line pushes). This is not a final 60-minute/full-game contract, nor actual sportsbook odds, and omits goalie, 5v5 xG, PP/PK, schedule-specific injury factors.
- The score distribution permits equal simulated scores. It currently assigns them 50/50 for the ML proxy; this is an explicit unvalidated placeholder for NHL OT/SO. Do NOT interpret as a certified NHL moneyline probability.
- Walk-forward evaluates only games for which BOTH teams' previous matches were scored and archived before the decision time. Train/projection inputs exclude the target result and any evidence captured after cutoff. Historical simulations are not genuinely prospective predictions made in advance.
- Paired Brier comparison against the same-game original DRatings frozen timestamp, and, only if both sides have Circa prices, the same-game no-vig market. Three-market proxy evaluation uses the actual final score, but is not validation of real -1.5 or 5.5 quoted sportsbook lines. Requires >=30 independent forward observations merely for directional work; 30 is NOT a validation or holdout certificate.
- For independent confirmation, next step will freeze immutable prospective shadow predictions before NHL tipoff, with source features and version. It must later settle against exact verified market contracts, and earn a chronological independent holdout versus an actual market baseline. Current branch does not write an automatic forecast ledger.

## Next improvements
1. Continue existing free NHL boxscore backfill to gain 2026-27 score/team histories, without duplicating provider calls.
2. Verify truly fresh Moneyline, puck line and totals quotes (game identity, market period, game-scoring OT/SO, time, exact line, price, source); identify whether permitted FanDuel quotes can be obtained. Fallback to no model edge if unavailable.
3. Build pregame as-of starting-goalie confirmation, goalie form, team 5v5 shots and xG, PP/PK, fatigue/rest/travel, injuries, and lineups. Actual postgame goalie may be used only for backtest labels or known earlier-game history.
4. Persist immutable pregame challenger v1 rows only after demonstrating the baseline's safe data gates, then compare calibration Brier/log loss, ML vs no-vig, puck line and total, MAE, coverage, CLV and holdout.
5. Explore NHL shots-on-goal and goalie saves props after stat/odds/DNP contract completeness.

## Passing criteria
- Unit tests for Poisson math, cutoff, contradictory postgame finals, same-game reference alignment, and zero model mutation.
- TypeScript compile pass and Preview READY; production release must remain research-only and fail closed if Supabase source evidence is missing.
- Never claim validated improvement, expected winnings, betting odds, or profitable strategy before paired holdout. No auto-promotion or Official Picks.
