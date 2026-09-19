# MLB Pitcher Record a Win — Numeric Prospective Forward V1

Status: `FROZEN_RESEARCH_FORWARD_READY_RUNTIME_WIRED`

Candidate: `pitcher_win_forward_numeric_p015_v1`

Contract: `MLB_PITCHER_WIN_FORWARD_NUMERIC/1.0.0`

## Why a second forward-compatible freeze was necessary

The second-pass historical champion `pitcher_record_win_revisit_catboost_no_p0225_v1` reached 81.24%, but several of its reconstructed historical starter/bullpen/lineup features could not be reproduced 1:1 by the daily runtime.

The project therefore did not deploy a degraded approximation.

A forward-compatible experiment was frozen before the prospective window using only inputs with a deterministic runtime path.

## Feature parity evidence

Large-sample parity checks against the historical research corpus established exact equality for:

- games prior;
- season win percentage;
- run differential per game;
- Pythagorean win percentage;
- L5 games / win percentage / run differential;
- L10 games / win percentage / run differential;
- rest days;
- head-to-head win percentage.

Across a sampled 674 historical games spanning 2025 and 2026, these fields had maximum absolute difference 0.

Schedule identity fields were also checked against the operational MLB game table:

- game number: 2,236 / 2,236 exact;
- doubleheader flag: 2,236 / 2,236 exact.

Starter performance features such as RA9/WHIP/K% were **not** exact and were intentionally excluded.

## Frozen numeric model

Architecture:

- two CatBoost binary classifiers;
- numeric features only;
- depth 3 + depth 5;
- 300 iterations each;
- learning rate 0.035;
- L2 8;
- fixed seed family 20260919.

Selection:

**NO — starter will not record a win**

when:

`ensemble p(win) <= 0.15`

Historical rolling OOF:

- correct: **128 / 147**;
- accuracy: **87.07%**;
- coverage: **1.75%**;
- months with selections: **8**;
- worst selected month: **75.00%**;
- unconditional NO baseline: **70.92%**;
- lift: **+16.16 pts**.

This clears the existing frozen development gate.

## TypeScript inference certification

The frozen models were exported as CatBoost JSON and evaluated with the repository's numeric JSON inference implementation.

Golden-set validation:

- rows checked: **96**;
- maximum single-model probability difference: **1.11e-16**;
- maximum ensemble probability difference: **1.11e-16**;
- status: **PASS**.

This establishes practical numerical identity between CatBoost Python inference and the Node/TypeScript runtime.

## Prospective runtime

Forward begins:

`2026-09-20`

Freeze window:

`10:45-10:59 America/Puerto_Rico`

The existing `/api/cron/mlb-statcast-daily` route is reused.

Before a freeze can write:

1. previous-day MLB history must be ready;
2. the current slate must be MLB regular season;
3. freeze must occur before the earliest first pitch;
4. a probable starter must be present for that starter-side observation;
5. every model feature is computed strictly from prior-date data;
6. model files, feature order, and threshold must match the frozen contract.

The freeze writes to:

`public.mlb_pitcher_win_forward_tracker_v1`

Strictly-prior starter decisions are read from:

`public.mlb_pitcher_win_forward_starter_history_v1`

After previous-day Statcast readiness is certified, the cron syncs actual starters from raw Statcast through `sync_mlb_pitcher_win_forward_starter_history_v1(date)` and labels those starter rows from MLB Official `hydrate=decisions`. The current day's freeze runs only after that sync. Outcomes for the current slate are never read during freeze and are settled only on a later daily run.

## Quarantine treatment

2026-09-19 remains excluded from model tuning and gate evaluation.

After the model is frozen, completed Sep 19 games may enter Sep 20 as strictly-prior factual context in the same way any previous-day game would. They cannot alter the model, feature list, threshold, or selection rule.

## Boundaries

- research-only: YES;
- Official Picks writes: 0;
- APOSTAR: disabled;
- production eligibility: false;
- Odds API calls: 0;
- historical Odds API credits: 0;
- ROI/EV/CLV: not certified;
- prospective outcomes may not be used for retuning.
