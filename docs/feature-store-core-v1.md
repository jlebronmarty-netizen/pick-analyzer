# Feature Store Core V1

## Status

Completed as a provider-independent computed feature contract. It does not persist feature snapshots, does not require a migration and makes zero external provider calls.

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

Durable feature snapshot persistence is deferred. A future additive migration can store snapshots if operational needs justify it.

Core V1 is compatible with existing `prediction_history.feature_snapshot` and provides a typed contract for future prediction engines.

Historical Feature Generation Orchestrator V1 is dry-run/contract-only until a generic durable snapshot table is approved. It plans deterministic snapshot IDs and lineage but does not write rows.

## Provider Calls

`providerUsage.externalProviderCallsMade` is always `0`.

## Future Work

- Multi-Sport Feature Registry.
- NBA Feature Store Integration.
- Durable feature snapshot table if approved.
- Backtest-compatible recomputation by cutoff time.
- Additive generic historical feature snapshot persistence if approved.
- Provider-backed injury and lineup features after approved provider activation.
