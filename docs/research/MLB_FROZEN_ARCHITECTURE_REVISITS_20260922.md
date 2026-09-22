# Frozen architecture revisits — 2026-09-22 UTC

Research/shadow only. State: `DEVELOPMENT_GATES_FAILED_NO_EXTERNAL`.

## New information and architecture

No new provider evidence was acquired. New representations were evaluated on existing certified historical outcome tables in canonical Supabase `ynuocvexviorgdjrfthw`, using read-only SELECTs. All rows are `HISTORICAL_SEEN_DEVELOPMENT`, ending 2026-09-14. Neither the 2026-09-19 quarantine nor the 2026-09-20+ prospective window was opened.

The earlier CatBoost, starter-rate, ML and 3-way formulas remain unchanged. This experiment adds two separately versioned architectures:

1. **F1 NRFI factorization:** beta-smoothed pitcher and opposing-offense first-inning scoreless rates combined in log-odds space, then multiplied across halves. Frozen at commit `a379b127` before source extraction/evaluation.
2. **F1/F3/F5/F7 scoring distributions:** gamma-Poisson team attack/defense shrinkage with independent score distributions; conditional non-tie probabilities for two-way ML and unconditional HOME/AWAY/DRAW probabilities for 3-way. Frozen at commit `01a80996` before source extraction/evaluation.

Both use one predeclared threshold, 0.75, and fixed prior strength 20. There is no parameter grid, confidence scan, side-rule rescue or post-result modification. All games on a calendar date are scored before any outcomes from that date update the histories. Histories reset each season. Exact stored team identity and, for NRFI, exact MLBAM starter identity are used without fuzzy matching. No current-game FULL/postgame features are inputs. Historical final scores enter only the target or strictly earlier-game history.

This is historical reconstruction, not proof that starter identity was captured prospectively before each historical game. A future external test additionally requires preserved pregame identity/lineage. Poisson independence and the half-inning factorization are modeling assumptions, not certified calibration claims.

## Results at frozen threshold

Accuracy excludes pushes; coverage is selected / eligible. All eight period gates and the NRFI gate failed. Minimum gate: accuracy 75%, 60 decided selections, five months, worst selected month 65%.

| Market | Eligible | Selected | Wins | Losses | Pushes | Accuracy | Coverage |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| F1 NRFI / YRFI | 3,188 | 0 | 0 | 0 | 0 | null | 0% |
| F1 ML | 4,057 | 122 | 39 | 23 | 60 | 62.90% | 3.01% |
| F3 ML | 4,055 | 168 | 72 | 52 | 44 | 58.06% | 4.14% |
| F5 ML | 4,053 | 181 | 101 | 55 | 25 | 64.74% | 4.47% |
| F7 ML | 4,048 | 203 | 132 | 53 | 18 | 71.35% | 5.01% |
| F1 3-way | 4,057 | 0 | 0 | 0 | 0 | null | 0% |
| F3 3-way | 4,055 | 0 | 0 | 0 | 0 | null | 0% |
| F5 3-way | 4,053 | 33 | 21 | 12 | 0 | 63.64% | 0.81% |
| F7 3-way | 4,048 | 47 | 32 | 15 | 0 | 68.09% | 1.16% |

F7 ML has the strongest pooled result in this architecture, 132/185, but its worst selected month is 50%. Keep the formula and the prior 58.24% CatBoost revisit as separate results; do not certify or promote either. Cohorts differ, so this is not a controlled head-to-head improvement claim. F1's prior 73.91% and F5's prior 67.1875% remain intact. NRFI's earlier 399/738 = 54.07% remains intact; the new model's zero selections have **null accuracy**, not 0% accuracy.

External was not opened because no candidate passed development. There is no pristine historical 2026 holdout to relabel as external. No candidate is eligible for prospective activation from these results.

## Durable evidence and verification

- Contracts: `contracts/MLB_F1_NRFI_FACTORIZED_V1.json` and `contracts/MLB_PERIOD_POISSON_V1.json`.
- Evaluators: `scripts/research/evaluate_mlb_f1_nrfi_factorized_v1.mjs` and `scripts/research/evaluate_mlb_period_poisson_v1.mjs`.
- Summary/selected rows: `artifacts/research/mlb_f1_nrfi_factorized_v1_result.json` and `artifacts/research/mlb_period_poisson_v1_result.json`.
- Complete probability records: corresponding `.json.gz` files, with SHA256 in each summary. Full files preserve abstentions as well as selections.
- Input digests and actual source counts are in the artifacts. Source counts: NRFI/F1 4,683; F3 4,680; F5 4,678; F7 4,673.
- Four verification groups pass: same-day target mutation leaves earlier/current probabilities unchanged; duplicate/missing-cutoff/prospective input rejection; season reset; independent artifact arithmetic, confidence and boundary checks.
- Run verification with `node --test scripts/research/verify_mlb_frozen_architectures_v1.test.mjs`. Synthetic chronology fixtures are explicitly testing-only and never count toward research metrics.

## Remaining certification gates

F5 Spread's separate PR #186 preserves 2/2 on 22 exact FanDuel lines as insufficient evidence. The prior threshold-distribution experiment is closed in `MLB_PERIOD_TEAM_THRESHOLD_CLASSIFIER_V1_CLOSEOUT.md`: none of its eight targets passed development.

F3/F7 spreads, alternate period spreads, period totals, alternate period totals and team/alternate team totals still require a sufficiently large exact historical line corpus. The already-purchased pilots establish market existence and variable lines, not adequate certification samples. Fixed, modal, consensus-inferred and current-line substitutions are prohibited. Outcome-only models do not resolve this external-data blocker.

Game Totals' previous 430/804 = 53.48% remains unchanged. This cycle adds no genuinely new pregame information for that full-game market; the failed period scoring models do not justify opening a new external test or recycling known full-game results to choose another threshold.

Next admissible work requires new pregame information/independent evidence or a provenance-complete free historical real-line corpus. No Odds API acquisition is authorized. The last user-confirmed balance (~2,032) and 2,000 reserve are preserved as historical facts, not newly polled values. Existing free-source audits found no complete usable corpus; this cycle does not claim to exhaust every possible future source or architecture.

Provider calls: 0. Odds API credits: 0. Database DML/DDL: 0. Official Picks writes: 0. APOSTAR activation: false. Production promotion: false. Tracker modified: false. No UI, operations or recommendation work.

Fresh canonical readback on 2026-09-22 found zero sports_odds_snapshots rows for all 16 queried period-spread, alternate-spread, period-total, alternate-total and team-total keys (baseball_mlb). See artifacts/research/mlb_period_line_coverage_readback_20260922.json. This does not erase the separately purchased small GitHub pilot artifacts. The latest Actions credential audit skipped the Vercel environment check because VERCEL_TOKEN was absent; BALLDONTLIE runtime availability was not freshly proven in this cycle. No provider call was attempted.

Build verification: npm.cmd run build PASS, 400 static pages, using the repository CI placeholder configuration (no live credentials).
