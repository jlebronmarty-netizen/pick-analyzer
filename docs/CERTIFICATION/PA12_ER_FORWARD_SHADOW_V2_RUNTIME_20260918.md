# PA-12 — Pitcher ER Forward Shadow V2 Runtime

Date: 2026-09-18

Status: `RESEARCH_RUNTIME_IMPLEMENTED / SHADOW_ONLY`

## Purpose

Automate the already-certified `MLB_PITCHER_ER_PA12_FORWARD_SHADOW_V2`
point-forecast path without adding another scheduler or promoting any betting
surface.

The existing authenticated MLB daily cron remains the scheduler.

## Daily freeze

The runtime calls the PA-12 ER V2 freeze immediately after the prospective
market-capture stage and **before** Statcast catch-up/readiness.

New freezes are allowed only during:

`10:45-10:59 America/Puerto_Rico`

A missed window cannot be reconstructed later.

Target identities come from persisted
`PA13_PITCHER_ER_FORWARD_CAPTURE_V1` evidence. Sportsbook line, price and book
are not model inputs.

Frozen point math is unchanged:

- base intercept: `1.90273530551357`
- base slope on prior exact ER starts: `0.227085168912444`
- K residual intercept: `0.653408289475204`
- K-rate residual slope: `-3.0156054216154`
- minimum prior exact starts: `3`

Feature semantics:

- `priorErAll`: MLB Official `earnedRuns`, prior starts only, strict prior date;
- `pitcherKRate`: K/BF over all prior appearances, strict prior date.

## Settlement

The same daily cron evaluates the previous Puerto Rico operating date before
Statcast catch-up.

Settlement requires:

1. a frozen research ledger (the Sep18 pilot or the new runtime freeze);
2. terminal MLB Official schedule state;
3. exact MLB Official game-log `earnedRuns` for each frozen pitcher/game.

Only forecast diagnostics are persisted:

- MAE
- RMSE
- bias
- correlation
- average prediction
- average actual

No result is converted into a bet, recommendation, EV or calibration update.

## Failure isolation

Freeze and settlement are wrapped as independent non-blocking research stages.
A failure cannot alter:

- Moneyline serving eligibility;
- Run Line candidate state;
- Official Picks;
- APOSTAR;
- production recommendation state.

Likewise a later Statcast catch-up failure does not erase a valid fixed-clock
Pitcher ER shadow freeze.

## Gates

`PA12_ER_FORWARD_V2_POINT_SHADOW_RUNTIME = RESEARCH_ONLY`

`PA12_ER_FORWARD_V2_PROBABILITY_LAYER_AUTHORIZED = NO`

`PA12_ER_FORWARD_V2_MARKET_RECOMMENDATION_AUTHORIZED = NO`

`PA12_ER_FORWARD_V2_PRODUCTION_ELIGIBLE = NO`

`PA12_ER_FORWARD_V2_RETUNING_AUTHORIZED = NO`

Historical Pitcher ER pricing/ROI/CLV/EV remain uncertified.

## Safety

- research/shadow only
- no new scheduler
- no historical Odds API calls
- no sportsbook values as model inputs
- no Official Picks writes
- APOSTAR inactive
- no production promotion
