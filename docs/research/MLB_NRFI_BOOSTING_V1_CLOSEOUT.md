# Direct joint NRFI boosting V1 — historical development closeout

Research-only, 2026-09-22. Contract, evaluator and three synthetic tests frozen at **675ddfbc before real outcome evaluation**. Gate FAIL; external remains closed. No retuning.

The new learner directly predicts the binary joint event that neither team scores in F1. It does not multiply team probabilities, match nearest analogs, combine failed candidates or vary the prior sequential mixture. Ten predictors use each team's last 30 strictly earlier same-season games: scoring-zero, allowing-zero and joint NRFI rates, plus log1p mean runs scored and allowed. Fixed ten-game smoothing uses prior league rates. Minimum 300 league games and 20 games per team. Exact F1 source hash `bfdd2216cfb93f9be745686a2a15c0fdd44679424058525e389af22e3ee016e3` matches the previously certified historical-development outcome bundle. No lineup, pitcher identity, current-game outcome features, odds or external dates are read.

Monthly rolling fits use at least 600 earlier contexts, reset by season. The frozen Bernoulli learner has 60 Newton boosting rounds, learning rate 0.05, L2 denominator 10, at least 60 training cases per stump child, and candidate cuts at training feature quintiles. It selects the best positive gain at each training round; this is the predeclared learning algorithm, not a validation or threshold search. There is no validation early stopping or post-result parameter change. Each date's contexts and predictions precede any updates from its outcomes. All fitted stumps and training/fit timestamps are retained.

| Metric | Result |
|---|---:|
| Source games | 4,683 |
| Prior-history feature contexts | 4,055 |
| Eligible rolling forecasts after fit requirements | 2,136 |
| Selected NRFI at p >=0.75 | 0 |
| Wins / losses / pushes | 0 / 0 / 0 |
| Coverage | 0% |
| Selected months | 0 |
| Accuracy / worst-month / matched baseline / lift | Undefined (no selections) |
| Eligible prior-league modal baseline accuracy | 48.88% |
| Eligible NRFI prevalence | 49.34% |
| Historical gate | FAIL |

No YRFI flip is evaluated. The unchanged gate requires at least 60 decisions, 75% accuracy, five selected calendar months and 65% worst-month accuracy. The learned probabilities never reached the fixed NRFI selection threshold. Do not lower it or reopen the architecture.

Reproduce offline: `node scripts/research/evaluate_mlb_nrfi_boosting_v1.mjs`. The existing compressed source bundle suffices; no credentials, network or providers are required. Summary: `artifacts/research/mlb_nrfi_boosting_v1.json`; full models/features/probabilities: `.json.gz`. Tests cover joint-signal learning on synthetic data, same-date and future label isolation, season reset, identity/lineage guards and exact full replay with source/contract hashes.

Together with the five-family and honest-regime closeouts, this block preserves seven new architectures and 49 failed market gates. This is a completed research block, not evidence that every possible architecture is exhausted. Further work must predeclare a materially different mechanism using the admitted historical outcome contract; failed formulas and gates stay frozen. Historical repeated development is not independent certification, and no profitability inference follows. Lineup remains BLOCKED_LINEUP_FEATURE_LINEAGE. No newly qualifying exact-line source was found; no discarded source was re-probed. External closed, Odds API credits zero, no tracker/Official Picks/APOSTAR/production changes.

Combined validation:48 offline tests PASS; `npm.cmd run build` PASS, exit0,400 pages with CI placeholders. Temporary F5 exporter HTTP410 verified. These checks do not certify a model or open external.
