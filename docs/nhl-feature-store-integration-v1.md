# NHL Feature Store Integration V1

Status: Completed for provider-independent architecture and deterministic validation.

## Objective

NHL Feature Store Integration V1 verifies that NHL can consume the shared Feature Store Core, Multi-Sport Feature Registry and Shared Sport Prediction Engine SDK contracts without provider calls, migrations or production-data fabrication.

The module is intentionally read-only. It does not change prediction generation, persist feature snapshots or claim predictive accuracy.

## Scope

- Service: `src/services/nhl-feature-store-integration.service.ts`
- APIs:
  - `GET /api/nhl/features/store`
  - `GET /api/nhl/features/preview`
  - `GET /api/nhl/features/validation`
- Dashboard: `NhlFeatureStoreIntegrationPanel` in the multi-sport dashboard section.

## Feature Contract

The integration uses:

- sport key: `icehockey_nhl`
- league key: `nhl`
- market: `moneyline`
- feature source: computed Feature Store Core snapshots
- feature registry: `icehockey_nhl:moneyline:nhl_feature_set_v1`

The preview snapshot is a deterministic fixture. It is labeled as architecture validation, not production data.

## Missing NHL Domains

These domains are not fabricated:

- starting goalie context
- goalie form context
- injury impact context
- special teams context
- rest and travel context

Unavailable domains must degrade confidence or block future NHL predictions instead of being filled with synthetic data.

## Validation

The validation endpoint checks:

- Feature Store Core validation succeeds.
- Multi-Sport Feature Registry validation succeeds.
- The NHL feature set exists.
- Required Feature Store Core definitions are present.
- Snapshot no-leakage checks pass.
- Provider calls remain zero.

Completion labels:

- `ARCHITECTURE_COMPLETE`
- `DETERMINISTIC_VALIDATION_COMPLETE`
- `REAL_DATA_VALIDATION_PENDING`
- `HISTORICAL_CALIBRATION_PENDING`

## Persistence And Migrations

No migration is required for V1. Durable feature snapshot persistence remains deferred until an additive migration is approved.

## Phase B Readiness

Future NHL prediction work should consume this compatibility layer and continue to keep goalie, injury, rest and special-teams context explicit until approved normalized sources exist.
