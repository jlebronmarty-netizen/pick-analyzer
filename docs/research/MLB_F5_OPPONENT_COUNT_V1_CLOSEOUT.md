# F5 opponent-adjusted count model V1

Research-only, 2026-09-22. Contract/evaluator/synthetic tests frozen at **8a56b240 before real outcome evaluation**, following the F7 stability saturation decision. **FAIL**, no retuning, external remains closed.

## Mechanism and data

This model jointly estimates distinct team offensive and defensive effects on the observed opponent schedule, plus a home effect and intercept. Each prior game contributes both teams' F5 run counts to a fixed-shape2 negative-binomial likelihood. It differs from independent historical run-rate Poisson pooling, categorical hierarchical win probabilities, Davidson strengths and a single latent run-margin Kalman state. No previous coefficients, probabilities or selections are combined or revised.

Fixed L2 penalties and Fisher-scoring solver are in `contracts/MLB_F5_OPPONENT_COUNT_V1.json`. At each month's first available date, fit all strictly previous same-season games, minimum600. Both current teams require20 games in the fitted history. All states reset by season. Current-date outcomes cannot affect fits, baselines or same-date predictions. Each fitted coefficient vector, training cutoff, numerical convergence statistic and forecast is retained.

Only exact certified historical-development F5 outcomes and team IDs are admitted.4,678 source games; SHA256 `205b0db939d9e3623fd4934a70d361b0a06b65b460774309ced8924f567b140b` equals the earlier source manifest. No lineup, starter, odds, external or current-game postgame feature. The certificate covers historical development, not prospective/as-published feature snapshots.

Count distributions are convolved to HOME/AWAY/DRAW. Fixed conditional ML selection confidence is0.75. Numerical PMF tail mass must be below1e-12; explicit throws prevent silently losing probability mass. Independence and fixed dispersion are modeling assumptions, not demonstrated facts or sportsbook pricing.

## Results

| Metric | Result |
|---|---:|
| Eligible forecasts |2,926|
| Initial/no-fit exclusions |1,752|
| Nonconvergence / fitted-team-history exclusions |0 / 0|
| Selected |13|
| Wins / losses / pushes |7 / 5 / 1|
| Nonpush n |12|
| Accuracy |58.33%|
| Coverage |0.4443%|
| Worst month |33.33%|
| Minimum selected-month n / represented months |3 / 2|
| Matched prior-league modal baseline / lift |58.33% /0pp|
| Eligible nonpush modal baseline |53.37%|
| Minimum leave-one-selected-month-out accuracy |33.33%|
| Wilson / Beta uniform95% lower |31.95% /31.58%|
| Top-two-month selection concentration |100%|

June2025:6/9 with1 push,66.67%. July2025:1/3,33.33%. Excluding June leaves1/3; excluding July leaves6/9. August/September2025 and June–September2026 have eligible forecasts but0selections, all retained in artifact monthly accounting. No performance-based month exclusion.

Every original historical gate fails: accuracy75%,n60,at least5 selected months,worst-month65%. The F7 reporting helper additionally records its stronger robustness flag for transparency; F5 admission still uses the original F5 gates. No threshold/penalty/shape adjustments after this result.

## Reproduction and next information

`node scripts/research/evaluate_mlb_f5_opponent_count_v1.mjs` reproduces offline from the committed source bundle. Summary and complete model/forecast artifacts: `artifacts/research/mlb_f5_opponent_count_v1.json` and `.json.gz`. Tests cover analytic negative-binomial moments, symmetric count probabilities, SPD solution, future/same-date isolation, season reset, lineage/identity guards, convergence and full exact artifact replay.

The requested next-market continuation has been executed, not merely planned. This new mechanism is closed. The earlier F5 CatBoost43/64=67.1875%, hierarchical23/34=67.65% and all other failures remain preserved. No supported claim of exhaustive model search follows. Further F5 work should require a distinct, predeclared information source or mechanism; small dispersion/penalty/window variants of this failed model are not justified. Exact-line markets remain data-blocked; lineup features remain BLOCKED_LINEUP_FEATURE_LINEAGE. External closed; provider calls, Odds API credits, tracker/Official Picks/APOSTAR/production changes:0.


## Validation and boundaries

59 combined offline tests PASS. Both completed modules were followed by successful npm.cmd run build (exit0,400 pages, CI placeholders). Canonical Supabase readback restricted to development dates confirms2,418 F7 games in2025 and2,255 in2026, all research-only; last2026 date2026-09-14. Temporary F5 exporter HTTP GET returns410 GONE; none opened. Main remains c8aac466. No changes to src, Supabase schema/data, prior frozen models, tracker, Official Picks, APOSTAR or production.
