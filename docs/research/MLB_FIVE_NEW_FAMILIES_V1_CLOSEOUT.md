# Five new outcome-only families — historical development closeout

Research-only,2026-09-22. Baseline PR187/a1110f49. **All40 market/architecture gates failed; external remains closed.** Prior lineup lineage audit and Bayesian mixture remain closed. No old candidate was retuned or combined to rescue it.

## Predeclaration and lineage

Four families froze together at **e4072652** before any real outcome evaluation; they then ran sequentially: hierarchical, Kalman, archetype, isotonic. Their contract is `contracts/MLB_NEW_FAMILIES_V1.json`. After those failures a distinct37-dimensional multiperiod interaction representation froze at **f69a52fa**, before its evaluation, under `contracts/MLB_MULTIPERIOD_BILINEAR_V1.json`.

Only the existing certified **historical-development outcome** exports are admitted, with identical SHA256 to the original Poisson/QDA source manifests. Exact period outcome lineage is STATCAST_RETROSHEET_EXACT_F1/F3/F5/F7 for2025 and STATCAST_F1/F3/F5/F7 for2026. The canonical F7 readback reconfirmed2,418 historical2025 rows and2,255 historical2026 rows, all research-only/HISTORICAL_SEEN_DEVELOPMENT. No quarantineSeptember19 or prospectiveSeptember20+ data were read. Last2026 outcome dateSeptember14;2025 extendsSeptember28.

Input columns are season, exact gamePK/date, exact home/away period runs, exact team IDs, prior-date cutoff, outcome lineage, research flag and development class. All cutoff checks pass. New predictors are deterministic transformations of **strictly earlier games only**, generated walk-forward. Every game on a date is predicted before **any** outcomes from that date update counts, centroids, regressions, states or calibration. All state resets each season. Current-game runs enter only targets and subsequent-date histories.

This inherits the existing historical outcome certificate; it does **not** create an as-published/prospective lineup, starter, weather or schedule certificate. No payload features, lineup data, starter IDs, historical exact lines, FULL target features, retroactive roster corrections or fuzzy matching are used. The former NRFI starter-identity caveat is avoided by excluding starters entirely.

The multiperiod representation joins exact gamePK/season, requiring matching dates/teams and cumulative-score monotonicity.4,673 games join with0 identity conflicts and0 score-order contradictions. It derives inning1, innings2–3,4–5,6–7 **prior** scoring segments. Incomplete period coverage is excluded by a predeclared identity/availability rule, not based on targets or candidate results.

## Mechanisms and rolling protocol

- **Hierarchical:** nested Dirichlet pooling of team and team-venue categorical W/L/D outcomes, with fixed30-game priors; combine home and reversed away posterior evidence relative to league prior. This uses categorical outcome counts, not Davidson latent strengths, Gaussian QDA likelihoods or mixtures of old models.
- **Kalman:** full-covariance Gaussian team run-margin state, daily random-walk uncertainty and strictly prior margin variance; exact period run magnitudes update the state. Discretized predictive normal determines HOME/AWAY/DRAW. It is a temporal state model, not a changed Davidson learning rate.
- **Archetype:** online8-centroid unsupervised clustering of prior team scoring/allowing contexts; categorical posteriors within clusters require30 prior assigned contexts. Cluster initialization/updates never inspect future labels.
- **Isotonic:** monotonic PAVA calibration trained on prior non-draw outcomes and a fixed prior-scoring contrast. Bins require30 cases, initial300 supervised contexts, fixed Beta(1,1) bin smoothing. No changed confidence threshold or post-result binning.
- **Bilinear:** four separate softmax heads with8 contrasts of prior scoring-segment rates,28 pair products and intercept; fixed daily-batch gradient update, regularization and300-context warmup. No ensemble or source-model reweighting.

All fits are rolling/prequential; no random full-season train/test split. Different burn-ins produce different eligible cohorts, so raw architecture accuracies are not controlled head-to-head improvements. No hyperparameter grid, threshold scan, weak-month exclusion or external selection occurred.

## Metrics and baselines

Confidence0.75; gate accuracy>=75%,n>=60 non-push decisions,>=5 selected calendar months,worst selected month>=65%. Coverage=selected/eligible. Accuracy excludes ML pushes;3-way draws are outcomes. Empty accuracy/baseline/lift are undefined, not0%.

Predeclared baseline is the **strict-prior league modal side/outcome**, not a sportsbook favorite. Reported matched baseline uses the identical selected non-push cohort. Lift is model accuracy minus that baseline in percentage points. Eligible-population baseline and full monthly n/wins/baseline dictionaries are also preserved in each artifact.

|Architecture|Market|Eligible|W–L–P|n|Coverage|Accuracy|Worst month|Months|Matched baseline|Lift pp|
|---|---|---:|---|---:|---:|---:|---:|---:|---:|---:|
|hierarchical|F1 ML|4057|68–55–111|123|5.77%|55.28%|0.00%|12|58.54%|-3.25|
|hierarchical|F1 3WAY|4057|12–12–0|24|0.59%|50.00%|0.00%|8|50.00%|0.00|
|hierarchical|F3 ML|4055|13–12–13|25|0.94%|52.00%|0.00%|8|68.00%|-16.00|
|hierarchical|F3 3WAY|4055|0–0–0|0|0.00%|—|—|0|—|—|
|hierarchical|F5 ML|4053|23–11–9|34|1.06%|67.65%|0.00%|9|73.53%|-5.88|
|hierarchical|F5 3WAY|4053|2–0–0|2|0.05%|100.00%|100.00%|2|100.00%|0.00|
|hierarchical|F7 ML|4048|66–18–12|84|2.37%|78.57%|0.00%|7|58.33%|20.24|
|hierarchical|F7 3WAY|4048|24–9–0|33|0.82%|72.73%|0.00%|6|54.55%|18.18|
|kalman|F1 ML|4057|56–37–96|93|4.66%|60.22%|0.00%|12|49.46%|10.75|
|kalman|F1 3WAY|4057|0–3–0|3|0.07%|0.00%|0.00%|2|66.67%|-66.67|
|kalman|F3 ML|4055|84–64–56|148|5.03%|56.76%|33.33%|12|60.14%|-3.38|
|kalman|F3 3WAY|4055|6–14–0|20|0.49%|30.00%|0.00%|7|65.00%|-35.00|
|kalman|F5 ML|4053|94–62–26|156|4.49%|60.26%|20.00%|12|58.97%|1.28|
|kalman|F5 3WAY|4053|27–18–0|45|1.11%|60.00%|0.00%|10|55.56%|4.44|
|kalman|F7 ML|4048|125–52–17|177|4.79%|70.62%|50.00%|12|57.63%|12.99|
|kalman|F7 3WAY|4048|30–23–0|53|1.31%|56.60%|0.00%|11|52.83%|3.77|
|archetype|F1 ML|3572|1–1–1|2|0.08%|50.00%|50.00%|1|50.00%|0.00|
|archetype|F1 3WAY|3572|0–0–0|0|0.00%|—|—|0|—|—|
|archetype|F3 ML|3564|0–0–0|0|0.00%|—|—|0|—|—|
|archetype|F3 3WAY|3564|0–0–0|0|0.00%|—|—|0|—|—|
|archetype|F5 ML|3560|0–0–0|0|0.00%|—|—|0|—|—|
|archetype|F5 3WAY|3560|0–0–0|0|0.00%|—|—|0|—|—|
|archetype|F7 ML|3550|0–0–0|0|0.00%|—|—|0|—|—|
|archetype|F7 3WAY|3550|0–0–0|0|0.00%|—|—|0|—|—|
|isotonic|F1 ML|2785|0–0–0|0|0.00%|—|—|0|—|—|
|isotonic|F1 3WAY|2785|0–0–0|0|0.00%|—|—|0|—|—|
|isotonic|F3 ML|3259|5–3–9|8|0.52%|62.50%|60.00%|2|62.50%|0.00|
|isotonic|F3 3WAY|3259|0–0–0|0|0.00%|—|—|0|—|—|
|isotonic|F5 ML|3314|4–0–1|4|0.15%|100.00%|100.00%|1|100.00%|0.00|
|isotonic|F5 3WAY|3314|0–0–0|0|0.00%|—|—|0|—|—|
|isotonic|F7 ML|3354|32–9–1|41|1.25%|78.05%|33.33%|5|70.73%|7.32|
|isotonic|F7 3WAY|3354|0–0–0|0|0.00%|—|—|0|—|—|
|bilinear|F1 ML|3445|0–0–0|0|0.00%|—|—|0|—|—|
|bilinear|F1 3WAY|3445|0–0–0|0|0.00%|—|—|0|—|—|
|bilinear|F3 ML|3445|0–0–0|0|0.00%|—|—|0|—|—|
|bilinear|F3 3WAY|3445|0–0–0|0|0.00%|—|—|0|—|—|
|bilinear|F5 ML|3445|0–0–0|0|0.00%|—|—|0|—|—|
|bilinear|F5 3WAY|3445|0–0–0|0|0.00%|—|—|0|—|—|
|bilinear|F7 ML|3445|0–0–0|0|0.00%|—|—|0|—|—|
|bilinear|F7 3WAY|3445|0–0–0|0|0.00%|—|—|0|—|—|

## Preserved strongest evidence and failures

Hierarchical F7ML: **66/84=78.57%,12 pushes,2.37% coverage**, baseline58.33%,lift+20.24pp. It fails monthly stability because **2026-07 is0/1**. That month stays included. Neither limiting to2025 nor raising minimum monthly sample is allowed. F5three-way2/2 also fails sample/month gates.

Kalman F7ML:125/177=70.62%,17pushes,4.79%coverage,worst50%,baseline57.63%,lift+12.99pp; below target.

Archetype F1ML1/2 with1push is insufficient; every other market has0selections. Isotonic F7ML32/41=78.05%,1push,1.25%coverage fails n and worst-month33.33%; F5ML4/4 with1push is insufficient. Bilinear has3,445 eligible forecasts per period and0selections across all8markets.

All formulas and complete outputs are preserved; none is promoted. This is repeated historical development, not an independent external certification or profitability claim. No ROI,EV,CLV or official pick is generated.

## Reproduction and validation

Source bundle: `artifacts/research/mlb_new_families_v1_source.json.gz`, with each period hash checked against the pre-existing Poisson manifest. Decompress locally; run `evaluate_mlb_new_families_v1.mjs <hierarchical|kalman|archetype|isotonic> source.json` or `evaluate_mlb_multiperiod_bilinear_v1.mjs source.json`. No network or database is required. Per-family summary JSON and compressed full probability evidence preserve source/result hashes, exclusions, decisions, monthly gates and baseline/lift. No previous artifacts are overwritten.

Tests verify future/own-day label mutation invariance, ordering, season reset, exact identity/period admission, independent normal/PAVA mathematics, matched-cohort baseline arithmetic and complete artifact replay. A verification-only fix compares serialized bilinear artifacts exactly as JSON: IEEE negative-zero interaction features serialize to0. No model calculation, threshold or stored prediction changed.

The research CI adds both offline test files. Lineup audit remains BLOCKED_LINEUP_FEATURE_LINEAGE and was not reopened. Passive exact-line source status is unchanged: no new qualifying source appeared in this block, no discarded source was re-probed. Provider calls, Odds API credits, Supabase writes, tracker/Official Picks/APOSTAR/production changes:0.

Follow-through is separately preserved in `MLB_HONEST_REGIME_TREE_V1_CLOSEOUT.md` and `MLB_NRFI_BOOSTING_V1_CLOSEOUT.md`: another eight period gates plus one NRFI gate failed. Combined validation: **48 offline tests PASS; npm.cmd run build PASS, exit0,400 pages**, with CI placeholders. The temporary F5 exporter was checked by HTTP GET and returns **410 GONE**. No exporter was reopened. Main readback remains c8aac466; research branch publication does not merge or promote it.
