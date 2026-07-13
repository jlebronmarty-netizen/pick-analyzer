# Provider Intelligence V1

Provider Intelligence V1 is a provider-independent routing and capability layer for Pick Analyzer. It inventories configured providers from the existing Multi-Sport Engine and explains which provider should be used for a requested sport, league, market and data type.

## Scope

- Inventory configured sports and providers.
- Normalize provider capabilities by sport, league, market and data type.
- Score provider health, freshness, coverage, latency, reliability and cost tier.
- Select primary and fallback providers in dry-run mode.
- Explain why a provider was selected or rejected.
- Prevent unsupported operations from being attempted by exposing reusable capability assertions.
- Provide dashboard observability.

## Data Sources

The module reads existing in-repository configuration only:

- `src/config/sports.config.ts`
- `src/services/multi-sport-registry.service.ts`
- `src/services/multi-sport-markets.service.ts`
- `src/services/multi-sport-providers.service.ts`

It does not call The Odds API, API-Sports or any paid provider.

## Data Types

The capability registry tracks:

- schedules
- scores
- standings
- team stats
- game stats
- players
- injuries
- lineups
- odds
- historical odds
- player props
- play-by-play
- live data

Unsupported domains return explicit `unsupported` or `partial` capability states.

## Scoring

Each capability receives:

- freshness score
- coverage score
- reliability score
- latency score
- cost tier
- total score

Scores are deterministic and derived from configured provider metadata and environment-key presence, not from live probes.

## Routing

`planProviderRoute()` accepts:

- `sportKey`
- `leagueKey`
- `dataType`
- `market`
- `providerId`
- `dryRun`

It returns:

- selected provider
- fallback providers
- support status
- provider score
- warning/explanation strings
- `externalProviderCallsMade: 0`

## APIs

`GET /api/providers/intelligence`

Returns provider inventory, global health and capability summaries.

`GET /api/providers/capabilities`

Optional query parameters:

- `sport`
- `league`
- `dataType`
- `market`

Returns filtered capability rows.

`GET /api/providers/route-plan`

Query parameters:

- `sport`
- `league`
- `dataType`
- `market`
- `provider`

Returns a dry-run provider routing decision.

## Dashboard

`ProviderIntelligencePanel` appears in the Multi-Sport dashboard section. It shows:

- provider counts
- sports/data-type coverage
- provider health and average score
- unavailable reasons
- capability summaries
- a dry-run NBA moneyline odds route decision

## Provider Boundary

Provider Intelligence V1 makes zero external calls.

It is safe for autonomous execution and can be used before provider-backed sync modules to decide whether a requested operation is supported.

## Extension Guidelines

When adding a new provider:

1. Register it in `multi-sport-providers.service.ts`.
2. Add sport coverage and broad feature claims.
3. Add partial-support notes in `provider-intelligence.service.ts` only when the provider can supply a domain but Pick Analyzer lacks a production ingestion contract.
4. Keep route planning dry-run until execution is explicitly implemented elsewhere.

When adding a new data type:

1. Add it to `ProviderDataType`.
2. Map any existing provider feature to the data type.
3. Add unsupported/partial warnings where execution requires future credentials or data contracts.
