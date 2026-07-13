# Multi-Sport Engine

The Multi-Sport Engine is the central reusable layer for sport registration,
provider resolution, adapter health, normalized events and market capabilities.
It is intentionally additive: legacy MLB, BSN and NBA routes continue to work
while new `/api/sports/*` endpoints expose normalized data.

## Architecture

- `src/config/sports.config.ts` is the sport registry source of truth.
- `src/types/multi-sport.ts` defines normalized domain models.
- `src/services/multi-sport-registry.service.ts` resolves sports and leagues.
- `src/services/multi-sport-providers.service.ts` describes provider coverage.
- `src/services/multi-sport-adapters.service.ts` defines the adapter interface
  and wraps current Odds API, BSN and NBA integrations.
- `src/services/multi-sport-normalizers.service.ts` maps provider payloads into
  normalized events and odds snapshots.
- `src/services/multi-sport-query.service.ts` is the query facade used by API
  routes.
- `src/services/multi-sport-health.service.ts` aggregates adapter, provider and
  sport coverage health.

## Register A New Sport

Add an entry to `SPORTS` in `src/config/sports.config.ts` with:

- `key`
- `label` and `shortLabel`
- `category`
- `format`
- `seasonFormat`
- `supportedMarkets`
- `supportedPredictionTypes`
- `adapterId`
- `leagueKeys`
- provider metadata such as `providerSportKey`

Use stable normalized keys. Do not reuse provider-specific IDs as first-class
project IDs unless the sport has no internal equivalent yet.

## Register A League

Add a `NormalizedLeague` entry in
`src/services/multi-sport-registry.service.ts`.

Each league should include:

- `key`
- `sportKey`
- `displayName`
- `active`
- `providerIds`
- optional region, country and metadata

## Create An Adapter

Implement the `SportAdapter` interface in
`src/services/multi-sport-adapters.service.ts`.

Adapters must provide:

- leagues
- teams or participants
- schedule
- single event
- standings
- stats
- injuries
- lineups
- odds
- `normalizeProviderData`
- `healthCheck`

If a capability is not supported yet, return a successful empty result with a
warning instead of throwing. Throw or return failed only for real runtime errors.

## Create A Provider

Register provider metadata in
`src/services/multi-sport-providers.service.ts`.

Providers should define:

- coverage
- authentication requirements
- rate limits
- feature support
- priority and fallback order
- health status
- current configuration errors

## Add Markets

Add normalized market definitions in
`src/services/multi-sport-markets.service.ts`.

Each market defines:

- normalized key
- display name
- category
- supported sport keys
- provider-specific market keys

Use sport-level `supportedMarkets` as the capability contract and market
registry entries as the normalized implementation map.

## Validate Health

Call:

- `GET /api/sports/health`

The response includes global status plus per-sport:

- adapter health
- provider health
- market coverage
- production readiness
- validation findings

Statuses are:

- `healthy`
- `degraded`
- `unavailable`

## API Surface

Core endpoints:

- `GET /api/sports`
- `GET /api/sports/[sport]`
- `GET /api/sports/[sport]/leagues`
- `GET /api/sports/[sport]/events`
- `GET /api/sports/[sport]/events/[eventId]`
- `GET /api/sports/[sport]/markets`
- `GET /api/sports/[sport]/providers`
- `GET /api/sports/health`

Extended query endpoints:

- `GET /api/sports/[sport]/participants`
- `GET /api/sports/[sport]/odds`
- `GET /api/sports/[sport]/standings`
- `GET /api/sports/[sport]/stats`
- `GET /api/sports/[sport]/injuries`
- `GET /api/sports/[sport]/lineups`

Query parameters supported where applicable:

- `league`
- `provider`
- `status`
- `dateFrom`
- `dateTo`
- `search`
- `limit`
- `page`
