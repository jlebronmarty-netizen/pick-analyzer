# Soccer Feature Store Integration V1

## Status

Completed as a provider-independent soccer feature-store compatibility layer.

Completion labels:

- `ARCHITECTURE_COMPLETE`
- `DETERMINISTIC_VALIDATION_COMPLETE`
- `REAL_DATA_VALIDATION_PENDING`
- `HISTORICAL_CALIBRATION_PENDING`

## Objective

Verify that soccer can consume Feature Store Core snapshots, Multi-Sport Feature Registry feature sets and Shared Sport Prediction Engine SDK contracts before adding Soccer Prediction Engine V1.

This module does not generate soccer picks, train models, call providers or claim production accuracy.

## Implementation

- Service: `src/services/soccer-feature-store-integration.service.ts`
- Dashboard panel: `src/components/dashboard/SoccerFeatureStoreIntegrationPanel.tsx`
- Dashboard mount: `src/app/dashboard/page.tsx`
- APIs:
  - `GET /api/soccer/features/store`
  - `GET /api/soccer/features/preview`
  - `GET /api/soccer/features/validation`

## Missing Soccer Domains

The module does not fabricate:

- draw-aware context
- league strength context
- confirmed lineup context
- injury context
- advanced provider metrics

These remain explicit warnings. Soccer Prediction Engine V1 must handle draw-aware markets carefully and degrade confidence or block recommendations when unavailable domains are required.

## Validation

`GET /api/soccer/features/validation` uses a deterministic local fixture labeled as non-production data. It verifies that required Feature Store definitions are present, registry validation passes, no-leakage checks pass, quality and sufficiency are reported and zero external provider calls are made.

## Persistence

No migration is required. V1 is read-only and computed. Durable generic feature snapshot persistence remains deferred until an additive migration is explicitly approved.

## Provider Usage

Provider calls made: `0`.

The integration reads existing Supabase metadata when available and treats empty tables as valid typed state.

## Future Work

- Soccer Prediction Engine V1 over the Shared Sport Prediction Engine SDK.
- Draw-aware probability contracts and league-specific feature definitions.
- Real-data validation and historical calibration after reliable historical soccer data is available.
