# Feature Store Core V1

## Status

Completed as a provider-independent computed feature contract. Durable historical snapshot persistence now lives in Historical Feature Snapshot Persistence V1; Feature Store Core itself still makes zero external provider calls.

## Objective

Define versioned, cutoff-safe feature snapshots that sport prediction engines can consume without reading provider-specific payload fields.

## Implementation

- Service: `src/services/feature-store-core.service.ts`
- Historical feature orchestrator: `src/services/historical-feature-generation.service.ts`
- Dashboard panel: `src/components/dashboard/FeatureStoreCorePanel.tsx`
- Dashboard mount: `src/app/dashboard/page.tsx`
- APIs:
  - `GET /api/features/store`
  - `GET /api/features/store/definitions`
  - `GET /api/features/store/validation`

## Feature Definitions

Core V1 defines:

- `event_context`
- `team_form`
- `market_odds`
- `injury_context`
- `lineup_context`

Each definition includes:

- key
- display name
- version
- supported sports
- supported markets
- value type
- max age policy
- required/optional status
- source tables
- no-leakage rule

## Snapshot Contract

Feature snapshots include:

- `sportKey`
- `leagueKey`
- `eventId`
- `market`
- `generatedAt`
- `cutoffAt`
- `eventStartTime`
- store version
- feature quality score
- data sufficiency score
- no-leakage status
- values
- provenance
- freshness
- sample size
- invalidation keys
- warnings

## No-Leakage Guarantees

Validation enforces:

- `cutoffAt` before event start
- `generatedAt` before event start
- feature provenance observed at or before cutoff
- valid ISO timestamps

The deterministic validation suite includes one valid fixture and one intentional leakage fixture to prove the validator catches future-data risk. The existing validation API now also returns `historicalFeatureGeneration`, a 12-case Historical Feature Generation Orchestrator V1 fixture suite covering cutoff inclusivity, post-cutoff rows, final scores, postgame player stats, after-cutoff injury/lineup rows, before-cutoff odds, closing lines, trial rows in production generation, production rows in trial fixtures and missing source timestamps.

## Freshness And Quality

Feature values carry:

- definition version
- computed timestamp
- freshness minutes
- quality score
- sample size
- source provenance
- warnings

Required features drive data sufficiency. Optional features such as injuries and lineups can be unavailable without fabricating records.

## Persistence

Core V1 remains the computed feature contract. Durable historical snapshot storage is handled by `historical_feature_snapshots` through Historical Feature Snapshot Persistence V1.

Core V1 is compatible with existing `prediction_history.feature_snapshot`, but durable backtest lineage should use `prediction_history.feature_snapshot_id` plus snapshot key/version metadata. The bounded trial lineage pilot now validates that path with 5 trial/scrambled/non-production linked predictions after corrected priced odds were available; production metrics remain blocked for trial rows and missing genuine closing snapshots.

## Provider Calls

`providerUsage.externalProviderCallsMade` is always `0`.

## Future Work

- Multi-Sport Feature Registry.
- NBA Feature Store Integration.
- Durable feature snapshot table if approved.
- Backtest-compatible recomputation by cutoff time.
- Additive generic historical feature snapshot persistence if approved.
- Provider-backed injury and lineup features after approved provider activation.
