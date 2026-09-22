# F1 distribution-kernel ML V1 closeout

Research-only. Frozen **8942ec7e** before candidate outcomes, together with the read-only closed-market comparison and priority decision. **FAIL**, no retuning, external closed.

The new mechanism uses a fixed Gaussian random-Fourier kernel representation of each team's strictly prior joint F1 runs-scored/allowed distribution. Nine score cells (0,1,2+ by0,1,2+) per team, Hellinger transformation,64 data-independent Fourier components and a penalized conditional logistic model. Monthly rolling fits use earlier same-season decisive contexts only; source draws remain pushes in evaluation. Initial300league/20team histories and250nonpush supervised cases are required. Entire dates are processed before updating history. This is not the prior CatBoost model, its0.625threshold, a QDA refit, neighbor voting or a retuned failed ensemble.

4,683 exact F1 source games (2,428 in2025;2,255 in2026); source hash matches the prior certified historical-development bundle.4,055 eligible feature contexts;2,927 fitted forecasts across June–September of each season.1,128 contexts abstain for fit burn-in;0 numerical nonconvergence exclusions. No lineup/starter/odds or target-game feature data.

At frozen conditional probability0.75: **0 selections,n0,wins0,losses0,pushes0,coverage0%**. Accuracy, worst-month, selected baseline/lift, confidence lower bounds and LOMO are undefined. Every eligible month has zero selections and is retained in the JSON. Eligible prior-league modal nonpush baseline55.87%. All original accuracy/sample/monthly gates fail. No alternate bandwidth, component count, penalty, window or threshold is tried after this result.

Artifacts `mlb_f1_kernel_distribution_v1.json` and `.json.gz` retain contract/source/frequency hashes, every as-of feature, model fit and forecast. Reproduce offline with `node scripts/research/evaluate_mlb_f1_kernel_distribution_v1.mjs`. Tests prove feature mass, date isolation, season reset, known synthetic nonlinear signal learning, identity/lineage guards and exact selection/metric replay (probability tolerance1e-10 for floating-point portability; no selection tolerance).

Prior F1 evidence51/69=73.91%,worst63.16% remains unchanged. Per the pre-outcome priority decision, continue to F3 ML with a separately frozen ordinal-margin likelihood. F7 stays frozen; no external or provider calls, no Odds credits, no tracker/official/production changes.

Validation: 72 combined offline tests PASS; this module build PASS (400 pages). Exporter HTTP 410 verified. See MLB_NEXT_MARKET_BLOCK_V1_CLOSEOUT.md for subsequent-market admission and remaining limits.
