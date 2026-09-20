# MLB Moneyline Prior-Starts Repair — Execution Certification

**Date:** 2026-09-20  
**Repository:** `jlebronmarty-netizen/pick-analyzer`  
**Canonical Supabase:** `ynuocvexviorgdjrfthw`  
**Scope:** research warehouse / daily ingestion only  
**Authority:** `STARTER_POPULATION_AUTHORITY = PRIOR_STARTS_ONLY`

## Authorized production repair

Exact repair SQL authorized and applied by the upstream recovery workstream:

`SHA-256 51e3151070e49cfc09c24e23d2cbf0770e1b8c8545f2188145aa1eac4f152455`

The repair is a lineage/parity correction only. It is not a model retune.

Canonical Starter semantics:

- accumulated RA9: strict-prior starts only;
- accumulated WHIP: strict-prior starts only;
- accumulated K%: strict-prior starts only;
- accumulated BB%: strict-prior starts only;
- accumulated hard-hit%: strict-prior starts only;
- accumulated whiff rate: strict-prior starts only;
- L5 RA9: last five strict-prior starts;
- L5 WHIP: last five strict-prior starts.

For every Starter input: `source_game_date < target_game_date` and `starter = true`.

## Independent production readback

Gold-standard Sep14 accumulated Starter revalidation:

- cells: **120/120 exact**;
- maximum absolute difference: **4.44089209850063e-16**.

Upstream execution certification additionally reports the full Sep14 gate:

- **310/310 feature cells PASS**;
- **30/30 component scores PASS**.

Sep18 materialization:

- source games: **15**;
- feature games: **15**;
- feature-value rows: **1,350**;
- component rows: **150**;
- Starter evaluable: **12**;
- Lineup/Matchup evaluable: **0**;
- B/C/D route-evaluable: **12**;
- zero-populated non-null scores: **0**;
- cutoff violations: **0**;
- starter timing violations: **0**;
- integrity: `READY_CORE_FAIL_CLOSED`.

Sep19 materialization:

- source games: **15**;
- feature games: **15**;
- feature-value rows: **1,350**;
- component rows: **150**;
- Starter evaluable: **13**;
- Lineup/Matchup evaluable: **0**;
- B/C/D route-evaluable: **13**;
- zero-populated non-null scores: **0**;
- cutoff violations: **0**;
- starter timing violations: **0**;
- integrity: `READY_CORE_FAIL_CLOSED`.

Forward tracker readback:

- rows: **69**;
- frozen rows: **69**;
- date span: **2026-09-16 through 2026-09-20**;
- no historical/prospective freeze rewrite was authorized.

## Daily pipeline completion

A separate source audit found that V4 was wired into the daily cron but the deployed
`mlb_ml_xyear_refresh_base_v2(date)` base/history refresh was not called by the
runtime wrapper. The canonical daily wrapper is therefore closed as:

`completed Statcast -> base_v2 -> materializer_v4`

The target-date base rows are postgame history storage only. V3/V4 use strict-prior
history for PREGAME features, so target-game postgame values are never same-game
pregame inputs.

## Preserved boundaries

- `pregame_high_conf_home_v2`: unchanged;
- formula routes/thresholds: unchanged;
- `mlb_ml_prior_scores_2026_v1`: preserved;
- Lineup/Matchup: remains NULL without timestamped pregame evidence;
- missing component with `populated_feature_count=0`: score remains NULL;
- Official Picks: unchanged;
- APOSTAR: disabled;
- historical Odds API credits: 0;
- production betting eligibility: false.

## Remaining limitation

Five non-decision-essential PREGAME component families remain non-evaluable on Sep18/Sep19
under the current V3 recovery surface. They must not be reconstructed from same-game
postgame data. Any future expansion must separately prove strict-pregame parity before
population.

This certification closes the Starter population conflict and the daily xyear base-to-V4
runtime gap. It does not promote Moneyline or authorize betting.
