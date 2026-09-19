# MLB Pitcher Record a Win — Second-Pass Revisit V1

Status: `TARGET_MET_75_PLUS_PROSPECTIVE_FORWARD_PENDING`

Protocol: `MLB_MARKET_REVISIT_FORWARD_PROTOCOL/1.0.0`

## Frozen champion

Research identifier:

`pitcher_record_win_revisit_catboost_no_p0225_v1`

Rule:

- model family: `side_normalized_catboost_pitcher_win_v1`;
- prediction: **NO — starter will not record a win**;
- select when frozen ensemble predicted starter-win probability <= **0.225**;
- no additional prior-win-rate cap;
- no minimum prior starts beyond what the PREGAME feature surface itself provides.

The ensemble is the mean of two frozen CatBoost classifiers:

- depth 4, 350 iterations, learning rate 0.035, L2 7;
- depth 6, 350 iterations, learning rate 0.035, L2 7;
- seed family rooted at 20260919.

## Historical development evidence

Historical development class:

`HISTORICAL_SEEN_DEVELOPMENT`

Outcome sources:

- 2025: exact Retrosheet pitcher decisions already stored in Supabase;
- 2026: official MLB StatsAPI schedule hydration `decisions`, matched by exact MLBAM starter IDs.

Coverage:

- 2025 starter rows: 4,860;
- 2026 starter rows: 4,588;
- total source rows: 9,448;
- rolling OOF rows: 8,380;
- official 2026 decision games resolved: 2,294 / 2,294;
- MLB decision retrieval required 7 schedule requests;
- Odds API historical credits consumed: 0.

Frozen champion OOF:

- correct: **1,126 / 1,386**;
- accuracy: **81.24%**;
- coverage vs rolling OOF: **16.54%**;
- months with selections: **11**;
- minimum selected month n: **82**;
- worst selected month: **76.47%**;
- unconditional OOF NO baseline: **70.92%**;
- lift vs unconditional NO baseline: **+10.32 pts**.

Monthly accuracy remained >=75% in every selected month.

## Higher-accuracy lower-coverage candidate

A stricter probability threshold of 0.175 produced:

- 325 / 380 = **85.53%**;
- coverage **4.53%**;
- worst month **76.19%**;
- minimum monthly n **11**;
- lift vs unconditional NO baseline **+14.61 pts**.

It is preserved as an alternative, not the champion, because the 0.225 champion has more than 3.6x the selected sample, materially greater coverage, and a slightly better worst-month accuracy while still exceeding the 75% target.

## Freeze boundary

The champion was selected and frozen before any prospective 2026-09-20+ outcome was opened.

- historical max allowed: 2026-09-18;
- actual max historical game date available: 2026-09-17;
- 2026-09-19: quarantined;
- prospective forward begins: 2026-09-20;
- forward outcomes opened: false;
- forward used for tuning: false.

State:

`TARGET_MET_75_PLUS_PROSPECTIVE_FORWARD_PENDING`

Do not change features, architecture, ensemble specs, direction, or the 0.225 threshold based on forward outcomes.

## Boundaries

Official Picks writes: 0.

APOSTAR: disabled.

Production promotion: none.

Historical Odds API credits consumed: 0.

The temporary Supabase research exporter was closed after the bounded run.
