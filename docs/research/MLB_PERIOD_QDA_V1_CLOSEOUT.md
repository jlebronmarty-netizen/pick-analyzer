# MLB joint run-environment QDA V1

State: `ALL_EIGHT_HISTORICAL_GATES_FAILED_EXTERNAL_CLOSED`.

Contract/evaluator/synthetic tests frozen at `968f8ac4` before the first real-data evaluation. This is a full-covariance Gaussian discriminant classifier over four strictly prior log run-environment rates, not a Davidson parameter variant, independent Poisson score model or CatBoost tree. Fixed covariance shrinkage20 and ridge0.001, rate shrinkage20, no search. See `contracts/MLB_PERIOD_QDA_V1.json` for the exact design.

The four existing certified period source hashes match the frozen Poisson/Davidson inputs exactly. Source rows F1/F3/F5/F7: 4,683 / 4,680 / 4,678 / 4,673, historical development through 2026-09-14 only. Eligibility additionally needs300 historical training vectors and20 per outcome class, after the300 league/10 team-game burn-in. Features for each training vector were formed before that vector's game; entire days forecast before updates, with same-season resets. No current outcome enters its feature vector or training parameters.

| Market | Eligible | Selected | Wins | Losses | Pushes | Accuracy | Coverage | Worst month | Gate |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| F1 ML |3452|40|12|7|21|63.16%|1.16%|0%|FAIL|
| F3 ML |3451|53|25|18|10|58.14%|1.54%|25%|FAIL|
| F5 ML |3450|94|52|31|11|62.65%|2.72%|35.29%|FAIL|
| F7 ML |3445|190|115|60|15|65.71%|5.52%|45.45%|FAIL|
| F1 3-way |3452|1|0|1|0|0%|0.029%|0%|FAIL|
| F3 3-way |3451|6|3|3|0|50%|0.174%|40%|FAIL|
| F5 3-way |3450|38|22|16|0|57.89%|1.10%|0%|FAIL|
| F7 3-way |3445|118|74|44|0|62.71%|3.43%|33.33%|FAIL|

ML accuracy excludes pushes; coverage uses eligible games. Gates remain accuracy75%, at least60 decisions, five selected months and minimum65% in every selected month. No month removal, threshold revision, alternate covariance choice or rescue. These are diagnostics, not certified probabilities or independent external results.

Artifacts `mlb_period_qda_v1_result.json` and `.json.gz` preserve monthly evidence, selected rows and all probabilities with a digest. Tests independently recompute selections, outcomes and gates; mutation tests prove no same-day/future-label influence; analytic diagonal Gaussian checks validate the density implementation. Independent code review found no material chronology/math/gate issue and no nonfinite real-data probabilities. Raw Gaussian confidence is uncalibrated and did not meet the selection-quality gates.

Zero provider calls/Odds API credits. No tracker, Official Picks, APOSTAR, production, prior-model or external changes. NRFI analog was a separately frozen parallel architecture; its result is recorded in `MLB_NRFI_ANALOG_V1_CLOSEOUT.md`. The next lineup-driven architecture encountered the documented pregame feature admission blocker in `MLB_LINEUP_TRANSITION_ADMISSION_BLOCKER_20260922.md`.

Integration validation: sixteen offline tests PASS; npm.cmd run build PASS (exit0, 400 static pages, CI placeholder configuration). No live credentials used by build. Frozen classifier/contract unchanged after the one real evaluation.
