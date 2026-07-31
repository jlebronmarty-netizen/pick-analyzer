# Model Performance Audit V1

Status: RELEASE 04 LOCAL AUDIT

Source: `/api/performance?diagnostics=full` on production commit `d9a3e08a9167272595024eef286fdb21a8ece82f`, repository performance scope `performance_scope_v2`, and current model source contracts.

This audit did not replay history, create predictions, call providers or mutate data. It analyzes the current cutoff-safe production sample exposed by the existing read-only performance contract.

## Scope

| Field | Value |
| --- | --- |
| Rows read by performance scope | 2,000 |
| Eligible settled rows analyzed | 485 |
| Scored win/loss rows | 479 |
| Pushes | 6 |
| Pending eligible rows | 0 |
| Wins | 239 |
| Losses | 240 |
| Accuracy | 49.90% |
| Brier Score | 0.2598 |
| Average confidence | 42.48 |
| Calibration error | 7.42 |
| Calibration bias | -7.42 |
| Settlement coverage | 100% |
| Provider calls during audit | 0 |
| Remote mutations during audit | 0 |

ROI is not available from the current public performance contract because stake sizing and realized bet accounting are not exposed for all historical rows. Expected value and Kelly exist as model-side fields, but Release 04 does not infer realized ROI without stored realized wager outcomes.

## Sport And League

This section satisfies the required sport and league breakdown for the currently exposed production sample.

| Sport | League | Rows | Scored | W-L-P | Accuracy | Brier |
| --- | --- | ---: | ---: | --- | ---: | ---: |
| baseball_mlb | MLB | 485 | 479 | 239-240-6 | 49.90% | 0.2598 |

All currently exposed settled production performance is MLB. NBA, NFL, NHL, soccer, tennis, UFC and BSN have model/feature contracts, but no settled production sample in the current performance scope.

## Market Breakdown

| Market | Rows | Scored | W-L-P | Accuracy | Avg Confidence | Brier | Interpretation |
| --- | ---: | ---: | --- | ---: | ---: | ---: | --- |
| Moneyline | 183 | 183 | 88-95-0 | 48.09% | 43.54 | 0.2507 | Near coin-flip accuracy; pricing/edge quality needs improvement before trust increases. |
| Spread / Run Line | 151 | 151 | 72-79-0 | 47.68% | 42.06 | 0.2517 | Underperforms total accuracy and remains below a profitable decision threshold. |
| Total | 151 | 145 | 79-66-6 | 54.48% | 41.61 | 0.2799 | Best raw accuracy, but worse probability error; likely wins come from direction more than calibrated probability. |

First Half and First Five markets are present in roadmap/feature contracts but are not implemented as production settled recommendation markets in the current performance sample. They should remain blocked from recommendation claims until ingestion, prediction, settlement and performance evidence exist.

## Confidence Buckets

| Confidence Bucket | Rows | Scored | W-L-P | Accuracy | Avg Confidence | Brier |
| --- | ---: | ---: | --- | ---: | ---: | ---: |
| <40 | 170 | 169 | 70-99-1 | 41.42% | 37.85 | 0.2559 |
| 40-49 | 281 | 277 | 149-128-4 | 53.79% | 43.53 | 0.2646 |
| 50-59 | 26 | 25 | 15-10-1 | 60.00% | 52.68 | 0.2560 |
| 60-69 | 4 | 4 | 2-2-0 | 50.00% | 63.34 | 0.2000 |
| 70-79 | 3 | 3 | 2-1-0 | 66.67% | 73.65 | 0.2323 |
| >=80 | 1 | 1 | 1-0-0 | 100.00% | 92.00 | 0.0333 |

The model has too few high-confidence settled rows to justify threshold changes. Low-confidence rows are correctly not trusted as Official Picks.

## Probability Buckets

| Probability Bucket | Rows | Scored | W-L-P | Accuracy | Avg Confidence | Brier |
| --- | ---: | ---: | --- | ---: | ---: | ---: |
| <40 | 307 | 304 | 143-161-3 | 47.04% | 39.67 | 0.2631 |
| 40-44 | 117 | 115 | 61-54-2 | 53.04% | 44.93 | 0.2593 |
| 45-49 | 40 | 39 | 22-17-1 | 56.41% | 49.04 | 0.2530 |
| 50-54 | 11 | 11 | 7-4-0 | 63.64% | 50.34 | 0.2428 |
| 55-59 | 4 | 4 | 1-3-0 | 25.00% | 51.08 | 0.3011 |
| >=65 | 6 | 6 | 5-1-0 | 83.33% | 74.12 | 0.1566 |

The model appears more useful above 45% and especially above 65%, but the high-probability sample is very small. Release 05 should add a row-level calibration artifact before any probability adjustment.

## Home/Away And Favorite/Underdog

The current public history rows expose matchup and display prediction text, but not normalized side role or favorite/underdog role for every historical row. Current Board has these fields for active rows, but Release 04 does not infer historical home/away or favorite/underdog from display strings.

Required next artifact: a read-only segment report from `prediction_history` that includes `team`, `home_team`, `away_team`, `odds`, `implied_probability`, `market`, `line`, `result`, `confidence` and `model_probability`.

## Prediction Source

| Source Category | Rows | Scored | W-L-P | Accuracy | Avg Confidence | Brier |
| --- | ---: | ---: | --- | ---: | ---: | ---: |
| Model-only / skipped | 453 | 447 | 223-224-6 | 49.89% | 41.91 | 0.2623 |
| Pending-category historical rows | 27 | 27 | 12-15-0 | 44.44% | 45.71 | 0.2365 |
| Official | 5 | 5 | 4-1-0 | 80.00% | 76.21 | 0.1686 |

Official Pick sample size is too small to relax policy, but it supports the design principle: strict gates are selecting a better subset than broad model-only output.

## Main Findings

1. The model is operationally measurable: settled sample is nonzero, push-aware, cutoff-safe and fully covered by settlement.
2. The broad model is not yet a high-confidence betting edge: 49.90% accuracy and Brier 0.2598 are not enough for policy relaxation.
3. Totals are the strongest raw market by accuracy, but their Brier score says probability calibration still needs work.
4. Official Picks are promising at 4-1, but the sample is too small for threshold changes.
5. The model should improve first through calibration and segment reporting, not by changing formulas blindly.
