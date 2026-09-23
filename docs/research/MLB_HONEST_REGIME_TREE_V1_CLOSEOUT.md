# Honest pregame regime tree V1 — historical development closeout

Research-only, 2026-09-22. Contract, evaluator and synthetic chronology tests frozen at **8067b8ba before outcome evaluation**. All eight F1/F3/F5/F7 ML and three-way gates FAIL. External remains closed; no retuning.

This distinct nonlinear regime learner uses eight prior scoring/allowing contrasts from the frozen f69a52fa multiperiod representation. It consumes no source-model probabilities, selections, lineup data, starters or exact lines. The feature availability cohort is determined by prior history counts, never labels. The source and its historical-development lineage limitations are documented in `MLB_FIVE_NEW_FAMILIES_V1_CLOSEOUT.md`.

Per season and period, refit on the first available date of each month with at least 500 previous contexts. Exact gamePK parity divides data into structure (even) and leaf estimation (odd), with at least 200 each. Structure sample alone chooses depth-three Gini splits at feature terciles, minimum 40 structure cases per child. Leaf class counts use the separate odd sample and a fixed ten-case prior; require 30 leaf calibration cases. No current-date observations enter fits. Complete trees, fit timestamps and last training dates are preserved. Leaf estimates are not claimed externally calibrated.

| Period | Eligible | ML selected / wins / losses / pushes | Three-way selected / wins / losses | Coverage, both | Eligible ML modal baseline | Eligible three-way modal baseline |
|---|---:|---|---|---:|---:|---:|
| F1 | 2,132 | 0 / 0 / 0 / 0 | 0 / 0 / 0 | 0% | 57.93% | 52.39% |
| F3 | 2,132 | 0 / 0 / 0 / 0 | 0 / 0 / 0 | 0% | 56.21% | 42.45% |
| F5 | 2,093 | 0 / 0 / 0 / 0 | 0 / 0 / 0 | 0% | 53.93% | 45.87% |
| F7 | 2,132 | 0 / 0 / 0 / 0 | 0 / 0 / 0 | 0% | 53.05% | 47.33% |

At fixed 0.75 selection confidence there are no selections; accuracy, worst-month, selected-cohort baseline and lift are undefined, not zero. Each market has zero selected months and fails n >=60 / accuracy >=75% / >=5 selected months / worst-month >=65%. No weak-month exclusion or alternate threshold is allowed.

Reproduce offline: `node scripts/research/evaluate_mlb_honest_regime_tree_v1.mjs`. The evaluator uses `mlb_multiperiod_bilinear_v1.json.gz`; SHA256 binds that exact source artifact and the frozen contract. Summary and complete fitted trees/probabilities are `artifacts/research/mlb_honest_regime_tree_v1.json` and `.json.gz`. Tests prove leaf-calibration labels cannot choose splits, future labels cannot affect earlier forecasts, ordering invariance and exact full artifact replay.

This architecture is closed. Follow-through is the separately frozen direct NRFI boosting architecture, not another tree-depth/leaf-size variant. Lineup blocker and all earlier failures remain unchanged. Odds API credits, provider calls, production or official writes: zero.

Combined validation after both modules:48 offline tests PASS; `npm.cmd run build` PASS, exit0,400 pages with CI placeholders. Temporary F5 exporter HTTP410 verified; no exporter opened.
