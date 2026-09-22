# MLB period Davidson outcome-rating V1 — 2026-09-22 UTC

State: `ALL_DEVELOPMENT_GATES_FAILED_NO_EXTERNAL`.

After the free historical-line source audit admitted zero regular-season pregame rows, executed a new line-free outcome-rating architecture on the existing certified F1/F3/F5/F7 historical-development sources. No public sample data, external outcomes, new provider calls or Odds API credits were used.

## Freeze and source integrity

Contract `contracts/MLB_PERIOD_DAVIDSON_V1.json` frozen in commit `b76a1c8d`, evaluator in `2b5d4a5a`, before the first real-data evaluation. Tests prior to evaluation used synthetic chronology fixtures only. Input hashes exactly match the previous Poisson audit's four certified source exports. Source rows respectively 4,683 / 4,680 / 4,678 / 4,673, March18 2025–September14 2026; historical-seen development only. No September19 quarantine or September20+ prospective outcome was opened.

Daily-batched opponent-adjusted Elo ratings plus Davidson draw mass differ from the frozen independent-Poisson count architecture and earlier CatBoost/strength-agreement classifiers. Each season begins at1500, K20, scale400, home offset0; prior draw fraction Beta(1,1). All same-date forecasts use state before that date; deltas are applied afterward. Burn-in300 league games and10 games per team. ML confidence conditions on no draw; 3-way confidence is unconditional. Threshold0.75, accuracy75%, minimum60 decisions, five selected months, worst selected month65%: all unchanged. No search grid, alternate threshold, fitted home advantage or post-result change.

## Results

Coverage denominator is eligible games after burn-in. ML accuracy excludes pushes; selections include them. Rows are historical diagnostics, not recommendations.

| Market | Eligible | Selected | Wins | Losses | Pushes | Accuracy | Coverage | Worst month | Gate |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| F1 ML | 4057 | 30 | 11 | 4 | 15 | 73.33% | 0.74% | 33.33% | Fail |
| F3 ML | 4055 | 19 | 7 | 6 | 6 | 53.85% | 0.47% | 0% | Fail |
| F5 ML | 4053 | 27 | 13 | 9 | 5 | 59.09% | 0.67% | 50% | Fail |
| F7 ML | 4048 | 74 | 52 | 15 | 7 | 77.61% | 1.83% | 0% | Fail |
| F1/F3/F5 3-way | 4057/4055/4053 | 0 each | 0 | 0 | 0 | null | 0% | null | Fail |
| F7 3-way | 4048 | 2 | 0 | 2 | 0 | 0% | 0.049% | 0% | Fail |

F7 ML exceeds75% only in aggregate. July2026 is5/8=62.5%; August2026 is0/1=0%. No small-month exemption is allowed by the frozen protocol. It therefore cannot open external, earn certification or replace a champion. Do not remove either month, change K/threshold or reclassify 2026 as fresh external.

Prior results remain unchanged: F5 transferred spread2/2 insufficient; Poisson F7 ML132/185=71.35%; third-pass F7 ML42/58=72.41% failed stability; all other prior formulas preserved. This result is a separate candidate, not a rescue or retune of those formulas.

Evidence: `artifacts/research/mlb_period_davidson_v1_result.json` contains metrics, monthly breakdown and selected rows; `.json.gz` preserves all historical probabilities with SHA256 in the summary. No ROI/EV/CLV or real-line performance is inferred. No tracker, Official Picks, APOSTAR or production model changes.

Validation covers same-day and future-outcome mutation invariance, input-order invariance, season reset, duplicate/cutoff/period/external rejection, independently recomputed probabilities and settlements, and enforcement of monthly gates even when aggregate accuracy exceeds75%. Source hashes match previously audited data.

Continuation gate: all eight new candidates are closed without external. Period spread/totals/team-total research still needs certified exact-line history. Game Totals read-only inventory has4,311 historical rows (2,425 SBR2025 consensus,1,576 SDI2026 consensus,310 stored TOA cross-book consensus; zero invalid feature cutoffs). That inventory is not new information, not single-book truth, and was not used to start another opportunistic sweep. NRFI receives no retuning of its frozen failed candidates. Further work needs new certified information or a separately justified architecture; these failed models remain frozen.

Validation completed: eight offline tests PASS, including historical artifact arithmetic and temporal leakage checks. npm.cmd run build PASS (exit0, 400 static pages, CI placeholder configuration). Frozen evaluator and contract remained unchanged after the first real evaluation.
