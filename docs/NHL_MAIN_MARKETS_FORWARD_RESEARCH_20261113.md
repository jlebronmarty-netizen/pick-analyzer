# NHL — Main Markets Model Research V1 (13 November 2026)

## Mission
Develop a genuinely independent, prospective research program for NHL Moneyline, puck line and full-game total goals, with player shots-on-goal and goalie saves later. Do not replace official models or reuse ex-post analysis as a pregame feature.

## Audited baseline (frozen, historical)
- Current free NBA-style NHL feed is public-source DRatings **Moneyline only**. It is not a Pick Analyzer-trained model. The own ML/spread/total predictor is architecture/fixture-only.
- DRatings observed 40/62 settled ML wins = 64.52%, Brier 0.2186.
- Only 35/62 settled records have a paired pregame Circa quote. In the SAME paired cohort, DRatings Brier was **0.2175**, de-vig Circa Brier **0.2112**. Difference is small and not validated on a separate holdout.
- General NHL market snapshots contain 164 ML, 144 spread and 118 total records, with newest data on 2026-07-28 (stale for the current NHL slate). Neither a current FanDuel line nor full-game market-rule certification can be assumed.
- Official NHL boxscore/PBP context covered 50 final games, about 100 team-game observations across 32 teams. Typical team has only 2–5 games; one has ≥5, none ≥10. Historical free-run detail contains 74 distinct final games; 24 lack captured context. Coverage changes as cron runs.

## Forward-only feature design
Current code uses frozen verified official final box scores to derive basic rolling five-game goals for/against, shots for/against, prior goalie actuals and rest. The data must have been both **played and captured before** the prospective decision timestamp; late backfills never become retrospectively valid pregame inputs.

Historical goalie appearances are NOT a verified starting goalie for the next game. Injuries, travel, special teams, xG and goalie status must remain unavailable until exact pregame evidence is collected and timestamped. Outputs are descriptive shadow projections with zero calibrated probabilities, EV, bets and automatic promotion.

For a production candidate:
- Moneyline: use full-game + OT/SO outcome contracts and compare against paired market no-vig and DRatings reference, stratified by confidence and price.
- Puck line: exactly match ±1.5 vs sportsbook payout and OT/SO scoring; include push protection for unusual integer lines.
- Total goals: distinguish 60-minute, full-game, OT/SO; price must be matched by game, side, line, period, source time and sportsbook.
- Additional validated candidate inputs: starting goalie/goalie form (save percentage, shot volume), PP/PK, schedule/rest/back-to-back, venue, 5v5 shot rates/xG if independently verified, injuries and projected lineups. Never substitute postgame actuals for pregame context.

Official NHL gamecenter boxscore/PBP endpoints (available in project) are documented at https://github.com/pseudo-r/Public-NHL-API/blob/main/docs/web-api/games.md .
NHL Stats REST reports include team powerplay, penaltykill, goalie summary and team game logs; need exact season/date filtering and time-of-availability before use: https://github.com/pseudo-r/Public-NHL-API/blob/main/README.md .
FanDuel general New Jersey ice-hockey terms reviewed in 2026 say ML/puck line/full-game totals incorporate OT/SO, but jurisdiction/game-specific book contracts MUST be independently confirmed: https://d38ayms4az88sz.cloudfront.net/SB/NJ/2026-07-30T12-49-55.html .

## Implemented in research branch
1. Pure forward-only normalizer for official regular-season final NHL boxscores and historical rolling-form baseline with 5 verified prior games as the minimum *descriptive* threshold; no market probabilities.
2. Read-only NHL main-market data/coverage endpoint at GET /api/nhl/main-markets-research. Reports historical sufficiency, current slate readiness, stale market prices and DRatings-vs-Circa paired Brier. No HTTP requests to providers, database writes, or picks.
3. Opt-in historical context recovery from the existing NHL-free archive's verified FINAL event records. The new collector is **disabled by default** via NHL_MAIN_MARKET_HISTORY_ENABLED; it never touches predictions or other sports. Fixed domain api-web.nhle.com, official boxscore+PBP only, no keys, max 2 calls every six hours UTC (00,06,12,18) and 4 runs/day = ≤8 free requests/day. Captures one previously unseen final game only and verifies team IDs, score, gameType and full response. Captured-at timestamps enforce future-only usage; no fabrication of historical available features.
4. Existing NHL cron source, settlement and causal enrichment run first; the extra opt-in collector runs last and fails independently. No extra cron schedule or altered free-source budget.

## Validation rules
- Validate minimum historical game counts and as-of source capture cutoff; test PBP identity, final status, team identity, scoreboard, game type and safe guardrails.
- Separate accuracy from the priced-subset ROI. Report Brier/log loss of probability model and comparison to the market; score projection MAE for margin/total; track coverage, invalid quote contracts, PUSH and CLV.
- Train chronologically and hold out later data by date and by game; do not allow repeated price snapshots of one game into separate folds. Do NOT promote a challenger without adequate samples, a demonstrable out-of-sample gain, and explicit approval.
- No new provider subscriptions, no FanDuel odds invented, no deployment of model formulas, no silent alteration of NHL/MLB/NBA/other engines.

## Recommended sequence
1. CI + exact preview verification, and verify new audit responds with current counts.
2. Merge safe research-only code, then activate low-budget backfill only if production budget and runtime controls are verified.
3. Obtain genuinely fresh paired ML, puck line and total prices with exact market semantics; audit historical provider feasibility/usage first.
4. Build stronger champion/challenger feature sets with pregame goalie and special-teams evidence, then run chronological walk-forward and independent holdout.
5. Extend separate research to shots-on-goal and goalie saves props only once player-specific odds/actuals and DNP rules are certified.
