# MLB Prediction Engine V1

## Status

Completed as a provider-independent prediction architecture module.

Completion labels:

- `ARCHITECTURE_COMPLETE`
- `DETERMINISTIC_VALIDATION_COMPLETE`
- `REAL_DATA_VALIDATION_PENDING`
- `HISTORICAL_CALIBRATION_PENDING`

## Objective

Create the first MLB prediction engine architecture using the Shared Sport Prediction Engine SDK, Feature Store Core and MLB Feature Store Integration V1.

This module does not train a model, call providers, persist picks, settle picks or claim production betting accuracy.

## Implementation

- Service: `src/services/mlb-prediction-engine.service.ts`
- Dashboard panel: `src/components/dashboard/MlbPredictionEnginePanel.tsx`
- Dashboard mount: `src/app/dashboard/page.tsx`
- APIs:
  - `GET /api/mlb/predictions`
  - `GET /api/mlb/predictions/health`
  - `GET /api/mlb/predictions/validation`

## Markets

V1 produces deterministic previews for:

- moneyline
- run line through the shared `spread` market contract
- total

Player props, live betting and same-game parlays are intentionally out of scope.

## Reused Services

- `sport-prediction-engine-sdk.service.ts` for probability, fair odds, implied probability, edge, expected value, confidence, recommendation, Kelly and Smart Ranking contracts.
- `feature-store-core.service.ts` for deterministic feature snapshots and no-leakage rules.
- `multi-sport-feature-registry.service.ts` for MLB feature-set readiness.
- `mlb-feature-store-integration.service.ts` for MLB-specific missing-domain warnings.

## Missing Inputs

The engine does not fabricate:

- probable pitcher context
- confirmed lineup context
- weather context
- park-factor or ballpark adjustments
- advanced provider metrics

Those unavailable domains remain warnings and keep the engine in partial status.

## Validation

`GET /api/mlb/predictions/validation` checks:

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

## Historical Replay

MLB Historical Recommendation Replay V1 is separate from the architecture-only preview engine. It reads already-persisted, linked and settled July 12, 2026 validation predictions through explicit quarantined historical mode on `/api/predictions/by-sport`, then renders them inside the existing MLB Prediction Engine panel. It does not generate predictions, mutate settlement, call providers or change production recommendation defaults.

Recommendation Experience V1 updates replay semantics so each row shows model
selection, current shared-policy status, qualification blockers and final result
as separate concepts. A historical win does not turn an analyzed row into an
official pick, and negative-edge or negative-EV rows remain visibly not
recommended.

## Future Work

- Real stored-data candidate generation after normalized MLB event and odds coverage is verified.
- Probable pitcher, lineup, weather and park-factor feature definitions after approved sources exist.
- Historical calibration with settled MLB predictions.
- Production persistence only after validation and duplicate-prevention rules are implemented for MLB.
