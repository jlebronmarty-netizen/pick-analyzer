# UFC Prediction Engine V1

Status: Completed for provider-independent architecture and deterministic validation.

## Objective

UFC Prediction Engine V1 creates a UFC-specific prediction orchestration layer on the Shared Sport Prediction Engine SDK without ML training, live provider calls, persistence or production betting claims.

## Scope

- Service: `src/services/ufc-prediction-engine.service.ts`
- APIs:
  - `GET /api/ufc/predictions`
  - `GET /api/ufc/predictions/health`
  - `GET /api/ufc/predictions/validation`
- Dashboard: `UfcPredictionEnginePanel` in the multi-sport dashboard section.

## Markets

The deterministic V1 preview covers:

- fight winner through the shared moneyline contract
- method contract as an explicit contract-only market

Method contracts are not marked settlement-compatible in V1. Combat-specific settlement rules must be added before these markets can be persisted or graded.

## Reused Infrastructure

The service reuses:

- Shared Sport Prediction Engine SDK for normalized prediction output.
- Feature Store Core and UFC Feature Store Integration V1 for feature snapshots.
- Kelly staking and Smart Ranking through the shared SDK.
- Settlement compatibility contracts for moneyline markets only.

## Missing UFC Domains

The engine does not fabricate:

- fighter form context
- camp context
- injury context
- method context
- weigh-in context

These gaps remain warnings and keep the engine in partial status until approved normalized data sources exist.

## Validation

The validation endpoint checks:

- two deterministic preview predictions are generated
- provider calls remain zero
- no raw provider payloads are used
- no persistence occurs
- feature snapshots have no leakage
- shared SDK compatibility is preserved
- moneyline settlement compatibility is preserved
- method contracts are explicitly not settlement-compatible

Completion labels:

- `ARCHITECTURE_COMPLETE`
- `DETERMINISTIC_VALIDATION_COMPLETE`
- `REAL_DATA_VALIDATION_PENDING`
- `HISTORICAL_CALIBRATION_PENDING`

## Persistence And Migrations

No migration is required for V1. Predictions are previews only and are not saved to `prediction_history`.

## Future Work

Real-data validation and historical calibration should wait for normalized UFC event, odds, result, fighter-form, camp, injury, method and weigh-in coverage.
