# PA-12 — Pitcher ER Forward Shadow V2 Certification

Date: 2026-09-18

Status: `POINT_SHADOW_FORECAST_READY / OUTCOME_EVALUATION_PENDING`

## Purpose

Create a new, separately versioned forward research path for Pitcher Earned Runs without reopening or promoting the sealed PA-12 V1 research result.

Model version:

`MLB_PITCHER_ER_PA12_FORWARD_SHADOW_V2`

The mathematical coefficients are inherited unchanged from the validation-selected V1 candidate. They were **not** refit or retuned using 2026 outcomes.

## Frozen point-forecast math

- base intercept: `1.90273530551357`
- base slope on `priorErAll`: `0.227085168912444`
- K residual intercept: `0.653408289475204`
- K-rate residual slope: `-3.0156054216154`
- minimum exact prior starts: `3`

No probability layer is carried forward.

## Exact feature semantics

### priorErAll

Mean exact earned runs over **prior starts only** in the current season.

Source:

`MLB StatsAPI gameLog / pitching / earnedRuns`

Admission requires source game date strictly earlier than the target date and `gamesStarted > 0`.

### pitcherKRate

`sum(strikeouts) / sum(batters_faced)` across **all prior pitcher appearances** in the current season, strictly before target date.

This matches the historical V1 daily-feature semantics. A six-row semantic check reproduced all 6 historical K-rates when all prior appearances were included; the one pitcher with prior relief work would not match under a starts-only approximation.

## MLB Official ER source parity

A deterministic 24-row starter sample spanning April through September 2025 was compared against the already-certified Retrosheet `data,er` labels:

- sample: **24**
- exact MLB Official ER matches: **24 / 24**
- mismatches: **0**

This certifies MLB Official game-log ER as a valid candidate source for the new forward V2 research path. It does not alter `SHARED_MLB_PITCHER_ER_OUTCOME_V1`, which remains the frozen 2025 Retrosheet contract.

## First prospective point-forecast pilot

Research ledger:

`415b36ba-6137-4803-ba27-8eca5965f54e`

Prediction timestamp:

`2026-09-18T18:07:51.740Z`

Target population came from exact PA-13 forward Pitcher ER market identities. Lines/prices/books were **not** model inputs.

Results at freeze:

- target pitchers: **26**
- eligible point predictions: **23**
- blocked: **3**
- earliest game start: `2026-09-18T22:40:00Z`
- all predictions were written pregame.

Blocked only for insufficient exact ER start history:

- Cesar Perdomo — 2 prior starts
- Daniel Espino — 1 prior start
- Andrew Sears — 2 prior starts

Evaluation status:

`AWAITING_FINAL_OUTCOMES`

No forecast accuracy claim is made before settlement.

## Gates

`PA12_ER_FORWARD_V2_SOURCE_READY = YES`

`PA12_ER_FORWARD_V2_POINT_SHADOW_READY = YES`

`PA12_ER_FORWARD_V2_PROBABILITY_LAYER_AUTHORIZED = NO`

`PA12_ER_FORWARD_V2_MARKET_RECOMMENDATION_AUTHORIZED = NO`

`PA12_ER_FORWARD_V2_PRODUCTION_ELIGIBLE = NO`

PA-13 historical pricing, historical ROI, CLV and EV remain uncertified.

## Next valid step

After exact final ER outcomes exist, settle the frozen 23 point predictions without retuning and report forecast-only MAE/RMSE/bias/correlation.

Then accumulate repeated fixed-clock shadow days before considering any new probability calibration or recommendation policy.

## Safety

- research/shadow only
- Official Picks unchanged
- APOSTAR inactive
- no model retune
- sportsbook values are not model inputs
- no production promotion
