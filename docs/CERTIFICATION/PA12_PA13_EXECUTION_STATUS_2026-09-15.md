# PA-12 / PA-13 Execution Status — Pre-Test Freeze

Date: 2026-09-15

## PA-12 state

`PA12_ER_TRAINING_CANDIDATE_CODE_FROZEN_BEFORE_SEALED_TEST = YES`

Current branch is based on certified PA-12 outcome `main` and implements a deterministic research-only training/readiness workflow.

Frozen rules before sealed TEST readback:

- outcome contract: `SHARED_MLB_PITCHER_ER_OUTCOME_V1`;
- exact outcome rows: 4,473;
- research-outcome-eligible: 4,470;
- zero-out exclusions: 3;
- temporal split source: canonical materialized 2025 pregame surface;
- modeled population after minimum 3 strictly prior ER starts: TRAIN 2,194 / VALIDATION 729 / TEST 645;
- candidate fits: TRAIN only;
- candidate selection: VALIDATION RMSE only;
- candidates: calibrated ER-all and calibrated ER-all + pitcher K-rate residual;
- probability calibration: empirical TRAIN residuals only;
- fixed lines: 1.5 / 2.5 / 3.5 / 4.5 ER;
- TEST cannot be used to modify candidate choice after readback.

No sealed-test runtime readback from this new branch has been executed at the time of this freeze record.

## PA-13 state

`HISTORICAL_PITCHER_ER_PRICING=ABSENT`

A read-only production audit found zero persisted Pitcher Earned Runs historical pricing rows across the current odds/market surfaces. Therefore ROI, CLV and price-aware historical EV remain unavailable and must not be invented.

## Safety

No Official Picks, no APOSTAR, no sportsbook/provider calls, no Odds API credits, no production DML/DDL and no model promotion.
