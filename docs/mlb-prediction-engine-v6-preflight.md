# MLB Prediction Engine V6 Preflight, Feature Injection, And Safe Regeneration V1

Implemented on 2026-07-17.

## Scope

This phase adds an explicit V6 current-slate regeneration preflight and integrates verified starter, weather, wind and StadiumID context into the actual prospective projection calculation path. It does not add bullpen, lineup, injury, prop or dashboard work.

## Original Generation Path

The existing SportsDataIO MLB prospective preview flow writes predictions through:

1. `runSportsDataIoMlbProspectivePreview`
2. `writeSnapshotsAndPredictions`
3. `deriveMatchupIntelligence`
4. `derivedProjection`
5. `buildSportPrediction`
6. `prediction_history`
7. Current Board and Best Bets read models

Before V6, persisted probabilities were driven by completed-game team form, recent form, home/away splits, strength of schedule, rest and market line. Starter/weather/stadium evidence was added later by Current Board enrichment and did not prove persisted probability consumption.

## V6 Injection

V6 adds `mlb_v6_feature_input_contract` and injects stored verified context into `derivedProjection`:

- starter identity and certainty affect side margin/readiness only, bounded and disclosed as non-performance context
- weather temperature and run environment affect total projection within bounded limits
- wind speed is conservative and direction-neutral until stadium orientation exists
- StadiumID verifies venue but does not create a fake park factor
- missing lineup, injury, bullpen and stadium-metadata context increases uncertainty

The V6 model/version labels are:

- model: `baseball_mlb_prospective_v6`
- feature set: `baseball_mlb_prospective_feature_set_v6`
- regeneration reason: `starter_weather_stadium_calculation_integration_v1`

## Run-Line 50% Audit

The shared SDK computes all supported markets from projected margin:

`50 + tanh(margin / 8) * 32`, scaled by feature quality/data sufficiency and reduced by uncertainty.

Exact 50% run-line outputs can occur when the line-adjusted projected margin and uncertainty/quality scaling round to neutral. Legacy rows did not store `probabilityOrigin`, so V6 adds this diagnostic and read surfaces exclude `fallback` and `unavailable` origins from probability ranking.

## Safe Regeneration Preflight

New route:

`POST /api/mlb/predictions/v6-regeneration`

Dry-run reports:

- selected Puerto Rico operating date
- eligible pregame events
- excluded events and reasons
- persisted odds rows
- existing/current/protected predictions
- rows that would be inserted
- model and feature-set versions
- validation status
- provider calls planned/made: 0

Write mode requires:

- `confirmed=true`
- non-empty `idempotencyKey`
- deterministic validation success
- no immutable-history schema blocker

## Current Blocker

Write mode is currently blocked by database constraint `prediction_history_unique_pick`, which prevents inserting side-by-side immutable V6 prediction rows for the same event/market/team.

The route returns `schema_blocked_prediction_history_unique_pick` instead of overwriting prior rows. This preserves historical, official, locked and settled records.

## Validation

Local build passes:

`npm.cmd run build`

Local V6 dry-run result:

- status: `preflight_schema_blocked`
- eligible events: 14
- excluded events: 1
- planned V6 predictions: 42
- validation: true
- provider calls: 0

Confirmed write-mode result:

- status: `schema_blocked_prediction_history_unique_pick`
- provider calls: 0
- no prior prediction rows overwritten

## Next Safe Phase

Add an explicit schema migration or sidecar version table that supports immutable prediction versions for the same event/market/team, then rerun V6 write-mode regeneration. Do not proceed to bullpen intelligence until V6 persisted outputs are reviewed.
