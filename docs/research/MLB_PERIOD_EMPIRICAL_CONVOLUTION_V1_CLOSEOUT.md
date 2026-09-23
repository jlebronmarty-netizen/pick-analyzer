# Empirical period-run convolution V1 closeout

Research-only; frozen contract/evaluator in commit **292dc45d** before this evaluation. No odds, lineup inputs, external outcomes or provider calls.

This materially new nonparametric mechanism retains the complete empirical integer run distribution (including zero mass and tails), unlike a Poisson rate model. Each team's last30 strictly prior same-season games supplies scoring/allowed histograms; ten pseudo-games use the prior-date league marginal. Home/away distributions average offense and opponent defense, then independently convolve. Minimum20 team games/200 league games, confidence0.75 and all historical gates are fixed. No truncation, search, retuning or probability calibration claim. Independent side distributions may miss common game conditions.

## Development results

| Market | Source rows | Eligible | Selected | Wins-losses-pushes | Accuracy | Coverage |
|---|---:|---:|---:|---|---|---|
| F1 ML |4,683|4,069|1|0-1-0|0%|0.02458%|
| F3 ML |4,680|4,066|0|0-0-0|undefined|0%|
| F5 ML |4,678|4,064|0|0-0-0|undefined|0%|
| F7 ML |4,673|4,059|0|0-0-0|undefined|0%|

All four3-way markets selected0 with the corresponding eligible denominators above. Accuracy is undefined for empty selections. F1ML's only selected month is2025-09,0/1. Every market fails the unchanged75% accuracy,60 non-push decisions,5 selected months and65% worst-month gates. Source dates2025-03-18–2026-09-14 are **historical seen development**, not pristine external. All four input hashes match the preserved certified Poisson/QDA source hashes.

**Close architecture; no rescue. External remains closed.** Full probabilities, exact side PMFs, decisions and outcomes are preserved in `artifacts/research/mlb_period_empirical_convolution_v1_result.json.gz`; summary contains hash and freeze commit. Tests check probability mass, untruncated support, source boundaries, same-date/future mutation invariance, season reset, and artifact decision/gate reconciliation. No ROI/EV/CLV claim is possible without exact odds.

The parallel lineup investigation resolves its numerical mismatches but remains BLOCKED_LINEUP_FEATURE_LINEAGE for historical as-published certification. Next substantive input step is recover archived source/builder revision evidence; no lineup training is allowed meanwhile. Historical exact-line markets retain their previously documented access/provenance/coverage blockers. This experiment does not establish that every future architecture is impossible.
