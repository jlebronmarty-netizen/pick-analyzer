# NFL Prediction Engine V1

## Status

Completed as a provider-independent prediction architecture module.

Completion labels:

- `ARCHITECTURE_COMPLETE`
- `DETERMINISTIC_VALIDATION_COMPLETE`
- `REAL_DATA_VALIDATION_PENDING`
- `HISTORICAL_CALIBRATION_PENDING`

## Objective

Create the first NFL prediction engine architecture using the Shared Sport Prediction Engine SDK, Feature Store Core and NFL Feature Store Integration V1.

This module does not train a model, call providers, persist picks, settle picks or claim production betting accuracy.

## Implementation

- Service: `src/services/nfl-prediction-engine.service.ts`
- Dashboard panel: `src/components/dashboard/NflPredictionEnginePanel.tsx`
- Dashboard mount: `src/app/dashboard/page.tsx`
- APIs:
  - `GET /api/nfl/predictions`
  - `GET /api/nfl/predictions/health`
  - `GET /api/nfl/predictions/validation`

## Markets

V1 produces deterministic previews for:

- moneyline
- spread
- total
- first half

Player props, live betting and same-game parlays are intentionally out of scope.

## Reused Services

- `sport-prediction-engine-sdk.service.ts` for probability, fair odds, implied probability, edge, expected value, confidence, recommendation, Kelly and Smart Ranking contracts.
- `feature-store-core.service.ts` for deterministic feature snapshots and no-leakage rules.
- `multi-sport-feature-registry.service.ts` for NFL feature-set readiness.
- `nfl-feature-store-integration.service.ts` for NFL-specific missing-domain warnings.

## Missing Inputs

The engine does not fabricate:

- quarterback impact context
- injury impact context
- weather context
- rest and travel context
- advanced provider metrics

Those unavailable domains remain warnings and keep the engine in partial status.

## Validation

`GET /api/nfl/predictions/validation` checks:

- deterministic preview predictions are generated
- provider calls are zero
- Feature Store snapshot has no leakage
- no persistence is attempted
- raw provider payloads are not consumed
- Shared Prediction SDK contracts are used
- settlement compatibility contracts exist
- real-data validation and historical calibration remain pending

## Persistence

No migration is required. V1 returns deterministic previews only and does not write to `prediction_history`.

## Future Work

- Real stored-data candidate generation after normalized NFL event and odds coverage is verified.
- Quarterback, injury, weather and rest/travel feature definitions after approved sources exist.
- Historical calibration with settled NFL predictions.
- Production persistence only after validation and duplicate-prevention rules are implemented for NFL.
