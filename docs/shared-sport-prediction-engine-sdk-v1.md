# Shared Sport Prediction Engine SDK V1

## Status

Completed as a provider-independent sport prediction contract. It makes zero provider calls and does not claim real predictive accuracy.

Completion labels:

- `ARCHITECTURE_COMPLETE`
- `DETERMINISTIC_VALIDATION_COMPLETE`
- `REAL_DATA_VALIDATION_PENDING`
- `HISTORICAL_CALIBRATION_PENDING`

## Objective

Define the reusable prediction architecture that MLB, NFL, soccer, NHL, tennis and UFC engines can use without directly depending on provider-specific payloads.

## Implementation

- Service: `src/services/sport-prediction-engine-sdk.service.ts`
- Dashboard panel: `src/components/dashboard/SportPredictionSdkPanel.tsx`
- Dashboard mount: `src/app/dashboard/page.tsx`
- APIs:
  - `GET /api/prediction-sdk`
  - `GET /api/prediction-sdk/validation`

## Contracts

SDK V1 defines:

- reusable sport strategy interface
- normalized feature input
- normalized prediction output
- market capability declaration
- data sufficiency
- feature quality
- projected outcome contract
- probability contract
- fair odds
- implied probability
- edge
- expected value
- confidence
- uncertainty
- recommendation status
- explanation factors
- warning contracts
- Monte Carlo integration contract
- Kelly integration
- Smart Ranking integration
- persistence contract
- settlement compatibility
- model health labels
- typed empty/unsupported behavior

## Provider Independence

Inputs must be normalized:

- normalized events
- normalized participants/teams
- normalized odds
- Feature Store snapshots
- normalized injuries and lineups when eventually available

No sport engine should read raw SportsDataIO, Odds API, API-Sports or other provider payload fields.

## Deterministic Validation

`GET /api/prediction-sdk/validation` uses a local fixture with a Feature Store snapshot and validates:

- probability calculation
- fair odds
- implied probability
- edge
- expected value
- confidence
- Kelly stake
- Smart Ranking score
- persistence compatibility
- settlement compatibility

Provider calls made: `0`.

## Accuracy Limits

SDK V1 is architecture-complete only. Real-data validation and historical calibration are pending until reliable sport-specific historical data exists.

## Future Work

- MLB Feature Store Integration V1.
- MLB Prediction Engine V1.
- NFL, soccer, NHL, tennis and UFC engines using the same contracts.
- Global Backtesting & Calibration Framework V2.
