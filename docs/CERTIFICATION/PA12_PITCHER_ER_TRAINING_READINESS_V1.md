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

Any future promotion requires a separate explicit gate after PA-13 pricing availability is resolved and additional out-of-sample/shadow evidence is available.
