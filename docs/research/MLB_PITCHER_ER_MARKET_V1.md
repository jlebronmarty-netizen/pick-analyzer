# MLB Pitcher Earned Runs — Unified Market Rule V1

Status: RESEARCH-ONLY / SHADOW-ONLY

Frozen candidate: `pitcher_er_over_1p5_p70_v1`

## Model

Underlying research model:

`MLB_PITCHER_EARNED_RUNS_RESEARCH_V1_R2`

Frozen R2 coefficients reproduced from canonical 2025 official Retrosheet ER labels:

- base intercept = 1.90273530551357
- base slope on prior ER all-history = 0.227085168912444
- residual intercept = 0.653408289475203
- residual slope on pregame pitcher K-rate = -3.0156054216154

TEST checksum:

- MAE = 1.53264877098586
- RMSE = 1.89392266393888

## Frozen market rule

- line: **1.5 earned runs**
- direction: **OVER**
- select when empirical P(OVER 1.5 ER) >= **70%**
- probability source: TRAIN residual distribution only

## 2025 development evidence

Across 2025 VALIDATION + fixed TEST:

- 73 / 91 correct = **80.22%**
- worst split = **79.66%**
- minimum split n = 32
- unconditional OVER 1.5 baseline = **64.70%**
- lift vs baseline = **+15.52 percentage points**

Split detail:

- VALIDATION: 47/59 = 79.66%
- TEST: 26/32 = 81.25%

## 2026 gate

External 2026 event accuracy is **not opened**.

Reason: the canonical exact Pitcher ER outcome contract currently certifies 2025 Retrosheet `data,er` outcomes. There is no equivalent certified 2026 exact-ER outcome contract in the current canonical path.

Do not substitute Runs Allowed or unvalidated provider fields to manufacture 2026 evidence.

State:

`TARGET_MET_75_PLUS_EXTERNAL_PENDING_CANONICAL_OUTCOME`

## Boundaries

- Official Picks unchanged.
- APOSTAR disabled.
- No production promotion.
- Historical Odds API credits consumed: 0.
- Historical sportsbook prices for exact selected ER props are not certified.
- No ROI/EV/CLV claim.
