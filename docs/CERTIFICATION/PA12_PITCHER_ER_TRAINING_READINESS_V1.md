# PA-12 — Pitcher Earned Runs Training Readiness V1

Date: 2026-09-15

Status: `RESEARCH_ONLY_NOT_PROMOTED`

## Purpose

Rebuild the Pitcher Earned Runs research path from current `main` after certification of the exact observed-outcome boundary `SHARED_MLB_PITCHER_ER_OUTCOME_V1`.

This path does not revive or merge stale PR #25. It reuses only the research design that can be reproduced from current certified data.

## Outcome boundary

Training labels are admitted only through `readSharedPitcherErOutcomePage()` and therefore inherit the PA-12 exact Retrosheet `data,er` contract:

- 4,473 exact starter outcome rows;
- 4,470 positive-out research-outcome-eligible rows;
- 3 zero-out exclusions;
- exact MLB gamePk and MLBAM pitcher identity;
- source checksum and lineage retained;
- raw source remains historical/postgame known and pregame/training ineligible;
- Runs Allowed is never substituted for Earned Runs.

The trainer joins outcomes to pregame features by exact `(target_game_pk, mlbam_pitcher_id)` identity and fails closed on lineage drift or duplicate identity.

## Frozen temporal split reconciliation

The canonical materialized pregame surface defines:

- TRAIN: 2025-04-01 through 2025-07-31 — 2,944 rows (2,942 positive-out);
- VALIDATION: 2025-08-01 through 2025-08-31 — 806 rows;
- TEST: 2025-09-01 through 2025-09-28 — 723 rows (722 positive-out).

The previously handed-off counts `2,638 / 879 / 956` do not match the current canonical materialized split and cannot be used as a training gate.

Applying the reproduced PR #25 research admission rule — strict certified pregame lineage, positive outs, available pitcher K rate, exact feature version, and at least 3 prior ER starts from strictly earlier dates — yields exactly:

- TRAIN: 2,194;
- VALIDATION: 729;
- TEST: 645.

This reproduces the historical PR #25 modeled population without reusing its stale implementation.

## Selection discipline

The new V1 readiness workflow enforces:

1. Fit coefficients on TRAIN only.
2. Compare only two minimal candidates on VALIDATION RMSE:
   - `CALIBRATED_ER_ALL`;
   - `CALIBRATED_ER_ALL_PLUS_K_RATE`.
3. Baselines are TRAIN mean, prior ER all-history, and prior ER L5.
4. Probability lines are frozen before TEST at 1.5 / 2.5 / 3.5 / 4.5 ER.
5. Probability calibration uses empirical TRAIN residuals only.
6. Candidate selection is completed from TRAIN -> VALIDATION before TEST is scored.
7. TEST is descriptive sealed evaluation only and must not be used for tuning after readback.

## Sealed TEST execution

The protected Vercel preview was build-ready, but its Deployment Protection SSO intercepted non-interactive requests before the handler. The project protection was not weakened. The sealed evaluation was therefore executed exactly once as one atomic read-only Supabase query reproducing the trainer's frozen computation order: TRAIN fit -> VALIDATION-only candidate selection -> TEST scoring.

Execution marker:

`PA12_ER_SEALED_TEST_2026_09_15_SINGLE_READONLY_SQL`

The modelable split reproduced exactly:

- TRAIN: 2,194;
- VALIDATION: 729;
- TEST: 645.

Validation selected `CALIBRATED_ER_ALL_PLUS_K_RATE`:

| Candidate | Validation n | MAE | RMSE | Corr | Bias |
| --- | ---: | ---: | ---: | ---: | ---: |
| `CALIBRATED_ER_ALL_PLUS_K_RATE` | 729 | 1.681017 | 2.089144 | 0.208840 | -0.348199 |
| `CALIBRATED_ER_ALL` | 729 | 1.700082 | 2.103495 | 0.184183 | -0.340696 |

Frozen selected coefficients:

- base intercept: `1.90273530551357`;
- base slope on prior ER all-history: `0.227085168912444`;
- K-rate residual intercept: `0.653408289475204`;
- K-rate residual slope: `-3.0156054216154`.

Selected-candidate metrics:

| Split | n | MAE | RMSE | Corr | Bias | Avg actual | Avg prediction |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| TRAIN | 2,194 | 1.553309 | 1.941016 | 0.123454 | 0.000000 | 2.431632 | 2.431632 |
| VALIDATION | 729 | 1.681017 | 2.089144 | 0.208840 | -0.348199 | 2.781893 | 2.433694 |
| sealed TEST | 645 | 1.532649 | 1.893923 | 0.145151 | +0.043340 | 2.376744 | 2.420084 |

## Probability diagnostics

Probabilities use the empirical TRAIN residual distribution only. TEST was not used to fit the point model, select the candidate, choose lines, or calibrate probabilities.

| Split | ER line | Brier | Climatology Brier | Brier skill | Directional accuracy |
| --- | ---: | ---: | ---: | ---: | ---: |
| VALIDATION | 1.5 | 0.220995 | 0.223577 | +1.155% | 66.255% |
| VALIDATION | 2.5 | 0.248414 | 0.249793 | +0.552% | 59.122% |
| VALIDATION | 3.5 | 0.228837 | 0.225760 | -1.363% | 65.569% |
| VALIDATION | 4.5 | 0.166947 | 0.165828 | -0.674% | 79.012% |
| sealed TEST | 1.5 | 0.229318 | 0.233241 | +1.682% | 62.946% |
| sealed TEST | 2.5 | 0.239037 | 0.242327 | +1.358% | 55.504% |
| sealed TEST | 3.5 | 0.186678 | 0.188849 | +1.150% | 74.729% |
| sealed TEST | 4.5 | 0.120918 | 0.122291 | +1.123% | 85.736% |

The probability layer is not promotion-ready because VALIDATION Brier skill is negative at 3.5 and 4.5 ER despite positive sealed-TEST skill at all four frozen lines. No post-TEST retuning is allowed under this V1 gate.

## Endpoint

`GET /api/mlb/research/pitcher-earned-runs/training-readiness`

The endpoint is read-only, no-store, and returns model-selection evidence plus the sealed TEST evaluation only after the validation-selected candidate is fixed in the same deterministic run.

## Safety boundary

- no provider/sportsbook calls;
- no Odds API calls or credits;
- no Supabase DML/DDL;
- no Official Pick writes;
- no APOSTAR activation;
- no model registry promotion;
- no Champion/serving changes;
- output status remains `RESEARCH_ONLY_NOT_PROMOTED`.

## Gate result

`PA12_ER_TRAINING_READINESS_V1 = RESEARCH_COMPLETE_NOT_PROMOTED`

`PA12_ER_PROBABILITY_PROMOTION_READY = NO`

`PA12_ER_SEALED_TEST_REUSE_FOR_TUNING = PROHIBITED`

PA-13 also found no historical Pitcher Earned Runs sportsbook pricing in the stored project surfaces, so historical ROI/CLV/price-aware EV remain non-computable and must not be inferred.

Any future promotion requires a new explicitly versioned research path with additional genuinely out-of-sample/shadow evidence and a separate activation gate.
