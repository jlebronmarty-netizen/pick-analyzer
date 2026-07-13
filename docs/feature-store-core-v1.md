# Feature Store Core V1

## Status

Completed as a provider-independent computed feature contract. It does not persist feature snapshots, does not require a migration and makes zero external provider calls.

## Objective

Define versioned, cutoff-safe feature snapshots that sport prediction engines can consume without reading provider-specific payload fields.

## Implementation

- Service: `src/services/feature-store-core.service.ts`
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

The deterministic validation suite includes one valid fixture and one intentional leakage fixture to prove the validator catches future-data risk.

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

Durable feature snapshot persistence is deferred. A future additive migration can store snapshots if operational needs justify it.

Core V1 is compatible with existing `prediction_history.feature_snapshot` and provides a typed contract for future prediction engines.

## Provider Calls

`providerUsage.externalProviderCallsMade` is always `0`.

## Future Work

- Multi-Sport Feature Registry.
- NBA Feature Store Integration.
- Durable feature snapshot table if approved.
- Backtest-compatible recomputation by cutoff time.
- Provider-backed injury and lineup features after approved provider activation.
