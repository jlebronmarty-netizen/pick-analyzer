# SportsDataIO Adapter Contract V1

## Status

Completed as a contract-only provider adapter. It does not activate SportsDataIO, does not require credentials, does not call SportsDataIO and does not perform imports.

## Objective

Prepare Pick Analyzer for a future SportsDataIO or premium-provider activation without requiring sport-engine rewrites.

The contract maps SportsDataIO-style concepts into the Provider Adapter SDK and normalized project models.

## Implementation

- Service: `src/services/sportsdataio-adapter-contract.service.ts`
- Dashboard panel: `src/components/dashboard/SportsDataIoContractPanel.tsx`
- Dashboard mount: `src/app/dashboard/page.tsx`
- APIs:
  - `GET /api/providers/sportsdataio/contract`
  - `GET /api/providers/sportsdataio/validation`

## Activation State

Live calls are disabled.

Credentials are not required for this module.

Placeholder environment variable names are documented only as future activation references:

- `SPORTSDATAIO_API_KEY`
- `SPORTSDATAIO_NBA_API_KEY`
- `SPORTSDATAIO_NFL_API_KEY`
- `SPORTSDATAIO_MLB_API_KEY`
- `SPORTSDATAIO_NHL_API_KEY`

No real secrets are stored in docs or source.

## Endpoint Contracts

The contract maps these SportsDataIO-style concepts into Provider Adapter SDK endpoints:

- `gamesByDate` -> schedules
- `scoresByDate` -> scores
- `standingsBySeason` -> standings
- `teamSeasonStats` -> team stats
- `playerSeasonStats` -> players/player stats
- `injuries` -> injuries
- `projectedLineups` -> lineups
- `gameOddsByDate` -> odds
- `historicalGameOdds` -> historical odds

## Coverage

Contract coverage is currently:

- NBA: contract ready
- NFL: partial contract
- MLB: partial contract
- NHL: partial contract
- Soccer: unsupported in this contract

Partial contracts need sport-specific review before live provider execution.

## Normalization Rules

Provider payloads must be mapped into:

- `NormalizedEvent`
- `NormalizedParticipant`
- `NormalizedOddsSnapshot`
- `NormalizedInjury`
- `NormalizedLineup`

Sport engines must not read SportsDataIO payload fields directly.

## Fixture Validation

`GET /api/providers/sportsdataio/validation` validates local SportsDataIO-shaped fixtures only.

It checks:

- `GameID` maps into `providerIds.sportsdataio`
- home and away teams normalize into participants
- date/status normalize into `NormalizedEvent`
- moneyline odds normalize into `NormalizedOddsSnapshot`
- market mapping uses normalized market keys

Provider calls made: `0`.

## Future Activation Requirements

Before live execution:

1. Explicit provider approval.
2. Credential configuration.
3. Quota cap.
4. Execution route review.
5. Fixture-to-live smoke test plan.
6. Historical Import Engine checkpoint wiring.
7. Post-run data quality validation.

No live import should start until those requirements are met.
