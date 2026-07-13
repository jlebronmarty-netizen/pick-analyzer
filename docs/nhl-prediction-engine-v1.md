# NHL Prediction Engine V1

Status: Completed for provider-independent architecture and deterministic validation.

## Objective

NHL Prediction Engine V1 creates the first NHL-specific prediction orchestration layer on the Shared Sport Prediction Engine SDK without ML training, live provider calls, persistence or production betting claims.

## Scope

- Service: `src/services/nhl-prediction-engine.service.ts`
- APIs:
  - `GET /api/nhl/predictions`
  - `GET /api/nhl/predictions/health`
  - `GET /api/nhl/predictions/validation`
- Dashboard: `NhlPredictionEnginePanel` in the multi-sport dashboard section.

## Markets

The deterministic V1 preview covers:

- moneyline
- puck line through the shared spread contract
- total

The engine intentionally does not implement player props, live betting, goalie props or ML training.

## Reused Infrastructure

The service reuses:

- Shared Sport Prediction Engine SDK for normalized prediction output.
- Feature Store Core and NHL Feature Store Integration V1 for feature snapshots.
- Kelly staking and Smart Ranking through the shared SDK.
- Settlement compatibility contracts from the shared market families.

## Missing NHL Domains

The engine does not fabricate:

- starting goalie context
- goalie form context
- injury impact context
- special teams context
- rest and travel context

These gaps remain warnings and keep the engine in partial status until approved normalized data sources exist.

## Validation

The validation endpoint checks:

- three deterministic preview predictions are generated
- provider calls remain zero
- no raw provider payloads are used
- no persistence occurs
- feature snapshots have no leakage
- shared SDK compatibility is preserved
- settlement compatibility is declared for supported markets

Completion labels:

- `ARCHITECTURE_COMPLETE`
- `DETERMINISTIC_VALIDATION_COMPLETE`
- `REAL_DATA_VALIDATION_PENDING`
- `HISTORICAL_CALIBRATION_PENDING`

## Persistence And Migrations

No migration is required for V1. Predictions are previews only and are not saved to `prediction_history`.

## Future Work

Real-data validation and historical calibration should wait for normalized NHL event, odds, result, goalie, injury, rest and special-teams coverage.
