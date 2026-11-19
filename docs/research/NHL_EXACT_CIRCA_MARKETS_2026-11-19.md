# NHL — exact Circa Puck Line and Total research (2026-11-19)

**Status:** exploratory as-of research, not official model calibration, bookmaker ROI or NHL-eligible betting recommendation. All inputs originate from already archived NHL cron receipts and frozen Poisson predictions, not new provider API requests.

## Locked methodology
- Use each original NHL Poisson V1 frozen decision's home and away goal expectations, without refitting or changing the forecast.
- Quote source: already archived `nhl_free_runs_v1.detail.marketQuoteObservations` from DRatings/Circa. Exact NHL event ID, scheduled start, home and away team names/IDs, both market sides/lines/prices; source captured **at or before** the original frozen decision, at least 60 minutes before the game and not more than 60 minutes older than freeze.
- Evaluate `nhlScoreDistribution(homeLambda,awayLambda,{puckLine:currentHomeSpread,totalLine:currentTotal})` on the actual paired line. **Independent Poisson model does not certify OT/SO mechanics.**
- Compare the candidate model's **conditional non-push probability** against the two-sided Circa no-vig price of the same handicap/total; score Brier/Log Loss only for W or L. Record integer-total pushes separately and never force a side or score them as losses.
- The team identities, probability source time and final result ID are all strictly checked. Source quote publication timestamp and full book-specific market settlement contract are not verified; no EV/ROI conclusions.
- Circa's publicly posted hockey house rules state a shootout winner is awarded one goal for final-score purposes (https://www.circasports.com/house-rules); that is important context, **not a proof the specific parsed quoted market follows an identical contract in every jurisdiction or live/book variation**.

## As-of retrospective result — 15 settled games

| Market | Actual lines | Model ML-threshold hits | Model Brier | Circa no-vig Brier | Model Log Loss | Circa Log Loss |
|---|---|---:|---:|---:|---:|---:|
| Puck Line | home -1.5 (12), +1.5 (3) | 9/15 | 0.25823 | **0.24863** | 0.72966 | **0.69095** |
| Total | 5.5 (2), 6 (8), 6.5 (5) | 8/15 | 0.25972 | **0.24990** | 0.71372 | **0.69294** |

Book no-vig side-threshold hits in the same cohort were 8/15 for Puck Line and 7/15 for Total; 0 total pushes happened in this particular sample even though 8 were integer total line 6. These outcome observations cannot prove improved decision quality because the sample is small, overlapping, exploratory and the market model has known OT/SO limitations. Less Brier/Log Loss is better; Circa was marginally better in both markets.

Reproducible stored SQL (read-only): `sql/research/nhl_exact_circa_v1_asof_20261119.sql`. It returned 30 observations = 15 games x 2 markets; calculations use the Poisson 0–18 goal mass already implemented by V1 and the exact half/integer source line.

## New code and reliability
- `src/lib/nhl-exact-circa-market-research.mjs`: pure exact-book/side/timestamp quote normalization, score-mass and push-aware W/L evaluator; explicit nonpromotion/non-ROI flags.
- `src/services/nhl-exact-circa-market-research.service.ts`: read-only bounded fetch of V1, V6, final outcomes and already archived free quotes. Bounded 2,000 runs / 8,000 market receipts, fail closed on scan cap.
- `src/app/api/nhl/exact-circa-market-research/route.ts`: research JSON response with separate early V1 retrospective and late V6 prospective cohorts; no database writes, requests to odds vendors or third-party scrapers.
- Add V6 `market_proxies.frozenTeams` to preserve immutable original NHL team display names for an exact future line match. This does not change Poisson probabilities, model weights or existing stored freezes.

## Follow-up gates
1. Ensure CI (exact lines, push/ambiguous market/time guard, existing V6 safety and TypeScript) and protected Preview are successful, then merge read-only research.
2. Check upcoming 22:07 UTC free ESPN V5 and V6 cycles; prospective V6 market record is only useful if goalie probable, frozen market and score were present **before** the decision.
3. Score at least 30 new pairwise-evaluable future games for initial screening, and preferably 100+ for a stable conclusion. Evaluate Puck/Total exact line using a *prospectively frozen* same-time quote, non-push denominators and line-specific Brier and Log Loss; retain all pushes and unverified as separate evidence.
4. Validate goalie *confirmed* vs *probable* status with independent timestamped evidence and source rights. NHL official postgame boxscores cannot confirm what was known before the game.
5. Promote no formula or official pick until independent, statistically meaningful improvement and source market-rule contract verification.

No model, official pick, DB migration, paid subscription, cron schedule or other sport was changed in this research task.
