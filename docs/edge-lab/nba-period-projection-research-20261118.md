# NBA — period forecast challenger / chronological retrospective V1
Date: 2026-11-18
Branch: feat/nba-period-retrospective-shadow-20261118
Model: NBA_PERIOD_RETROSPECTIVE_SHADOW_V1

## Objective and boundaries

Improve period predictions (Q1–Q4, 1H, 2H with OT, full-game) without modifying Pick Analyzer GOAT models, official predictions, settlement, risk decisions, or HoopsAPI capture/cron. No external sports-provider calls, paid subscription, or user-facing advice.

Existing workbook exploratory baseline: 40% team last-five + 60% last-ten, each blended 50% with the opponent's points allowed in the same period. Challenger candidates vary team/opponent share, recent weights and pregame league-average shrinkage. All evaluations use the very same eligible games and target definitions. No percentage betting edge or expected value can be inferred from a point MAE.

## Data provenance

- BALLDONTLIE GOAT history was archived on 2026-11-18 in nba_market_sync_runs_v1 via successful research:history capture, NOT a contemporaneous October/November feature freeze.
- Expected dataset: 210 completed games 2026-10-20–2026-11-17, 12 overtime games. Stored quarter and OT points reconcile against final home/away scores for all games.
- This is retrospective simulation of what COULD have been known from prior final scores, NOT an audited historical pregame dataset. It does not establish that the predictions or injury contexts existed at the time.
- The replay uses only games with provider dates earlier than each target date. Every game in the same calendar date is scored before any such game's result enters training, protecting against a global-average same-day results leak.
- Require at least five older completed games for both teams to make a forecast. L5 uses most recent five; L10 uses min(10,available). Incomplete/inconsistent final/period score rejects the archive.
- Averages are team scoring in that period and opponent historical points allowed in that same period. Predictions for the two teams sum to period totals and differ to point spread.
- Q1–Q4 omit overtime. H1 includes first two quarters. H2 includes Q3 + Q4 + all observed overtime points, FT is four regulation quarters + OT. This is consistent with FanDuel published house rules from multiple US jurisdictions, but Puerto Rico execution / contract terms remain unverified. Source: https://d38ayms4az88sz.cloudfront.net/SB/NY/2026-03-02T08-00-00.html

## Validation design

- Historical source dates: 2026-10-20 through 2026-11-17.
- Development selection window: 2026-11-04 through 2026-11-11; select minimum absolute total points error by period.
- Later evaluation window: 2026-11-12 through 2026-11-17, LOCKED for scoring the previously selected candidate (not to tune further).
- For each of seven periods, report game sample count, team points MAE, period total points MAE/RMSE, spread MAE/RMSE and a 2,000-replicate seeded paired bootstrap interval for candidate-minus-baseline total MAE.
- Baseline candidate is preserved, so failure to improve does not damage production.
- Because candidates were explored on this same historical cohort and there are only roughly 40 holdout games, these are **exploratory** intervals, not a valid confirmatory winner, calibrated hit probability, betting EV, positive ROI or authorization to promote.
- Selection on total MAE does not guarantee improvement on spread: both are displayed and neither is suppressed.

## Technical implementation

- Pure reproducible core: src/lib/nba/period-research-core.mjs
- Tests: tests/nba-period-research.test.mjs, including same-day non-leakage, OT, immutable period consistency, fixture backtest and short-history rejection.
- Read-only archived-data service: src/services/nba-period-research.service.ts. It selects a complete research:history GOAT archive from Supabase and makes ZERO provider calls or DB writes.
- Protected Preview-only API: GET /api/nba/period-research. Requires x-vercel-oidc-token and rejects URL parameters; never exposed on production.
- Preview research table: /nba-period-research. No official picks, recommendations or calibrated betting percentages.
- Existing scheduled GOAT and HoopsAPI provider captures remain intact. No schema migrations, no model promotion.

## Next evidence required

1. Acquire a larger archive spanning multiple seasons for stable home/away/pace/rotation contexts. Re-evaluate with a fixed earlier train/dev split and untouched later holdout.
2. Freeze genuinely prospective predictions **before** tipoff, with archived input IDs, period and exact contract. Do not rely on backfilled results as proof of historical quote availability.
3. Link HoopsAPI period quotes to BALLDONTLIE game IDs only with verified team + date + start-time crosswalk. Do not interpret bookmaker labels as regional bet availability.
4. Accumulate prospective paired accuracy by period, compare against the champion baseline and bookmaker thresholds, and only propose a model promotion if a preregistered test passes. Never auto-promote or claim a betting edge from MAE alone.
