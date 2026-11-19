# NHL Circa exact-line exploratory benchmark — 19 Nov 2026

## Data and lineage
Read-only Supabase audit of project Pick Analyzer, using the **existing** `nhl_free_runs_v1`, `nhl_challenger_shadow_v1` and `nhl_free_outcomes_v1` tables. No added provider calls or mutations. Window: 21 days before the audit; historical results below are a snapshot and must not be used as an automatically updated accuracy figure.

- 732 NHL runs; 186 runs with market quotes.
- Circa SPREAD: 1,005 captured observations, 32 unique events.
- Circa TOTAL: 1,005 captured observations, 32 unique events.
- All 2,010 observations precede event start by at least ten minutes, but **none** contain a verified source-updated timestamp or certified market rules. The observed capture time is not the provider's original publication time.
- Early Poisson V1 frozen rows: 31 distinct events; 26 with pre-freeze quotes from within 60 minutes, frozen at least 60 minutes pre-tip. 15 of those had stored outcomes.
- Late V6 frozen rows: 11; all 11 had pre-freeze pairs, no outcomes yet.

## Exploratory exact-line paired result (early V1 only)
The latest pre-freeze quote per event + market was selected with as-of gate, event/tip/team identity checked, and only matching settled outcomes used. Outcome classified on the **exact recorded line**, not against a universal -1.5/5.5 line. A push must be excluded from win-loss score. For model proxy, independent Poisson home/away goal distributions were truncated at 18 goals as in `nhlScoreDistribution`; conditional win probability excludes push mass. Circa two-sided prices are normalized to no-vig for comparison. Brier and binary log loss computed on **the same 15 events** per market, no pushes found in this sample.

| Market | Paired games | Pushes | Poisson Brier | Circa no-vig Brier | Poisson Log Loss | Circa Log Loss |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Puck line / Spread | 15 | 0 | 0.25823 | **0.24863** | 0.72966 | **0.69095** |
| Total Goals | 15 | 0 | 0.25972 | **0.24990** | 0.71372 | **0.69294** |

Smaller scores are better. In the current descriptive 15-game cohort, Circa is directionally better on both markets. This **does not** prove a significant difference, provider value, sportsbook opportunity, or future performance. No new model promotion is justified.

## Hard gates
1. Verify contract's full-game timing, OT/SO and push eligibility for each bookmaker jurisdiction. The current proxy does not certify OT/SO reconciliation.
2. Verify source quote publication timestamp, not just our captured-at timestamp.
3. Require an independent prospective frozen sample at exact matched lines; compare calibrated Brier/log-loss on identical games, report confidence intervals by game/day and avoid same-game quote duplicates.
4. Confirm user-region executable price for expected-value / ROI claims; Circa research quotes are not equivalent to FanDuel offers.
5. Keep NHL current ML models, forecasts, existing settlements, and all provider budgets unchanged until candidate results meet the independent validation gate.

## Presentation
The read-only `/api/nhl/exact-circa-market-research` already calculates source-gated cohort summaries. The NHL UI can now load those metrics on demand in `NhlExactMarketValidation`. The audit result above is from a separate direct read-only SQL reproduction, not a claim about a live sportsbook offer or an official pick.
