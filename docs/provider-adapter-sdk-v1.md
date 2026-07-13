# Provider Adapter SDK V1

## Status

Completed as a provider-independent SDK contract and fixture validation layer. It makes zero external provider calls and requires no provider credentials.

## Objective

Give future providers a typed contract so sport engines and prediction modules never depend directly on provider-specific payload fields.

The required boundary is:

Provider payload -> Provider Adapter SDK -> Normalized project models -> Historical Import Engine -> Persistence -> Feature Store -> Sport engines.

## Implementation

- Service: `src/services/provider-adapter-sdk.service.ts`
- Dashboard panel: `src/components/dashboard/ProviderAdapterSdkPanel.tsx`
- Dashboard mount: `src/app/dashboard/page.tsx`
- APIs:
  - `GET /api/providers/sdk`
  - `GET /api/providers/sdk/validation`

## Contract Scope

SDK V1 defines:

- provider interface
- capability declarations
- authentication contract
- schedule fetching
- scores
- standings
- team stats
- player stats/player records
- injuries
- lineups
- odds
- historical odds
- pagination shape
- rate-limit hints
- retry hints
- provider-specific normalization hooks
- fixture-based validation

## Required Endpoints

Concrete providers should support these when available:

- `fetchSchedules`
- `fetchScores`
- `fetchOdds`

Optional endpoints must still return typed empty results and warnings when unavailable:

- `fetchStandings`
- `fetchTeamStats`
- `fetchPlayerStats`
- `fetchInjuries`
- `fetchLineups`
- `fetchHistoricalOdds`

## Auth Contract

SDK V1 documents auth shape without storing secrets:

- `api_key`
- `bearer_token`
- `basic`
- `none`

Concrete adapters should declare provider-specific environment variable names, but docs and source must not contain real credentials.

Fixture and dry-run validation must not require credentials.

## Normalized Models

Adapters must output shared project models:

- `NormalizedLeague`
- `NormalizedParticipant`
- `NormalizedEvent`
- `NormalizedOddsSnapshot`
- `NormalizedInjury`
- `NormalizedLineup`
- `NormalizedPlayer`

Sport engines must consume those normalized models or persisted normalized rows, not raw provider payloads.

## Validation

`GET /api/providers/sdk/validation` runs local fixture validation only.

Validation checks:

- normalized event identity
- provider ID mapping
- shared event status enum
- participants
- odds snapshot identity
- sportsbook/market/outcome shape

The fixture validator reports errors and warnings but never calls external providers.

## Provider Calls

`providerUsage.externalProviderCallsMade` is always `0` in SDK V1.

Live provider calls belong to future concrete adapters and must be explicitly gated by credentials, quota caps and execution approval.

## Relationship To Historical Import Engine

Historical Import Engine Core V1 plans checkpoints and execution order. Provider Adapter SDK V1 defines how a concrete provider will fetch and normalize each checkpoint later.

Together they allow SportsDataIO or another provider to be activated without rewriting NBA, MLB, NFL, NHL, soccer, tennis or UFC prediction engines.

## Future Work

- SportsDataIO Adapter Contract using this SDK.
- Concrete adapter execution behind quota-approved routes.
- Durable checkpoint persistence if existing `sports_sync_jobs.metadata` is insufficient.
- Feature Store Core consuming normalized, cutoff-safe records.
