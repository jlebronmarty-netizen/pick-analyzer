# Next-market research block V1

Research-only, 2026-09-22. The pre-evaluation comparison is [MLB_CLOSED_MARKET_COMPARISON_V1.md](MLB_CLOSED_MARKET_COMPARISON_V1.md); its inventory fixes baseline `12de8d43`, 142 artifacts and 119 normalized historical records. Raw maxima, sufficient-sample evidence, cohorts, coverage denominators and missing metrics remain separate. No external outcomes were used to choose markets.

| Priority | Market / new family | Freeze commit before evaluation | Eligible | Selected / W-L-P | Coverage | Accuracy / worst month | Result |
|---|---|---|---:|---|---:|---|---|
| 1 | F1 ML / nonlinear distribution kernel | 8942ec7e | 2,927 | 0 / 0-0-0 | 0% | Undefined | FAIL |
| 2 | F3 ML / ordinal run-margin likelihood | c4da535c | 2,136 | 0 / 0-0-0 | 0% | Undefined | FAIL |
| 3 | F5 three-way / learned hidden sequence states | b9a32586 | 2,926 | 0 / 0-0-0 | 0% | Undefined | FAIL |
| 4 | F1 NRFI / factorized Beta-smoothed pitcher+offense log-odds | pre-existing frozen contract | 3,188 | 0 / 0-0-0 | 0% | Undefined | FAIL |
| 5 | F1 NRFI / joint logistic random effects | 6f7698c6 / c9adb945 | 2,977 | 2,373 / 1,189-1,184-0 | 79.71% | 50.11% / 47.02% | FAIL |
| 6 | F3 ML / ridge graph-margin ratings | ffde4213 / 5a051dd4 | 3,756 | 12 / 6-4-2 | 0.32% | 60.00% / 50.00% | FAIL |
| 7 | F1 ML / strict-pregame team+starter L5 logistic | 6ee07da1 / 4e0d79ee | 2,702 | 2 / 2-0-0 | 0.07% | 100% / 100% | FAIL n/months |
| 8 | F1 NRFI / strict-pregame Poisson half-runs | 228f53e1 / f538957a | 3,438 | 15 / 9-6-0 | 0.44% | 60.00% / 0% | FAIL |
| 9 | F1 NRFI / starter-L5 half-zero logistic | 826223f6 / 2e468eca | 1,563 | 0 / 0-0-0 | 0% | Undefined | FAIL |
| 10 | F5 ML / strict-pregame team+starter L5 logistic | 694457f5 / f77422be | 1,562 | 13 / 9-3-1 | 0.83% | 75.00% / 62.50% | FAIL n/months/stability |

All six use only already-certified exact historical-development outcomes with strictly earlier same-season histories; the NRFI families additionally require exact starter identities from the preserved NRFI surface. This is not certification of prospective performance or reconstructed lineup availability. Entire dates predict before updates; monthly fitting uses earlier dates. Selection confidence was fixed at 0.75. Original accuracy/sample/monthly gates were unchanged. Every eligible month, including zero selections, remains in the artifacts; selected baseline/lift, Wilson/Beta bounds and leave-one-month-out accuracy are undefined when no decisions exist, never zero accuracy. No alternate parameters, thresholds, targets or post-result features were evaluated to rescue these attempts.

## Stored Game Totals admission

Read-only Supabase metadata queries and results are preserved in `artifacts/research/mlb_stored_game_totals_admission_v1.json`. No provider calls, new imports, SBR searches or outcome evaluation were made.

* 2026 legacy SportsDataIO: 1,576 games over six months, March 26-August 13. All canonical timestamps are prestart; the raw join still labels the book `Consensus`. Original individual-book identity is not established by this surface. These timestamps must not be described as absent.
* Stored The Odds API: eleven identified book labels each cover 354 games over August 9-September 10, only two months. These are overlapping games, not 3,894 distinct games. This metadata query is an upper bound before checking paired sides, exact line selection and immutable capture. The canonical extension has 310 games, August 14-September 10; the difference follows the extension start, not a contradiction. No Odds API request was made.
* 2025 canonical totals: 2,425 rows, all version `sbr_2025_open_close_totals_v1_price_sanitized`, created September 17, 2026. The canonical schema has no per-quote timestamp. This is the previously reviewed source family, not a new source warranting another crawl. A later ingestion timestamp alone does not prove leakage; it also cannot certify pregame publication. Existing exploratory results are preserved.

`BLOCKED_EXACT_BOOK_TOTALS_FIVE_MONTH_ADMISSION`: the inspected stored identified-book surface cannot supply five months, while the longer sources are not independently admitted as exact-book pregame lines. Do not silently pool them, lower the five-month gate, treat consensus as a named book, or manufacture missing history. The audit does not prove that every upstream snapshot is absent. Reopening requires an original timestamped source or an independently verifiable existing lineage chain; a metadata count is not that certificate.

## Remaining scope and stopping boundary

F7 remains `F7_ML_RESEARCH_SATURATION_PENDING_NEW_INFORMATION`. Lineup remains `BLOCKED_LINEUP_FEATURE_LINEAGE`. Period and team exact-line markets retain their existing data blockers. F5 ML's opponent-count model, F1/F3 three-way's previously evaluated families and NRFI analog/boosting/factorized/random-effects families are closed; F3 graph-margin is also closed; transferring one of the just-failed mechanisms to another label or changing smoothing/state counts would not meet the requested material-novelty standard.

After these additional frozen attempts, no model passes the full historical gate. A new strict-prior starter-L5 information surface was admitted, but its first F1/NRFI/F5 uses also failed. The F5 starter-logit reaches the 75% pooled point estimate but remains non-qualifying at only 12 settled decisions across three months with a 62.5% worst month. Their outcomes remain usable; they are **not** declared data-blocked or mathematically exhausted. The remaining bottleneck is an independently motivated, materially distinct architecture or newly certified pregame information, rather than permission to tune closed candidates. The comparison and failed artifacts are preserved so the next proposal can establish novelty before any additional outcome evaluation. No claim is made that all possible models have been tried.

## Validation and scope

Existing 72-test validation remains preserved; new dedicated closeout tests were added for factorized NRFI, NRFI random-effects and F3 graph-margin, with separate research workflows for the latter two. Three module builds PASS, each generating 400 pages. The existing research branch is retained; live main `8df2a5ba` was fetched and its two concurrent Statcast read-performance script changes do not intersect these experiments. No history rewrite or rollback.

External remains closed. BALLDONTLIE production key presence was re-audited safely: the corrected no-provider-call workflow reports configured=false in Vercel production; providerCallsMade=0 and secretValueExposed=false. The single persisted BDL quote remains schema/provenance evidence only, not a historical corpus. No exporter was opened. Odds API credits consumed: 0. Tracker, source production code, migrations, Official Picks and APOSTAR are unchanged. Publication is to existing research PR #187 only; no merge or production deployment is authorized by this work.
