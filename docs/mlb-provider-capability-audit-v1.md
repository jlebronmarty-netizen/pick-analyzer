# MLB Provider Capability Audit V1

## Route

`GET /api/mlb/provider-capabilities/audit?date=2026-07-17&includeValidation=true`

The route is read-only and makes zero provider calls.

## Findings

Current SportsDataIO MLB subscription variant:

- `sportsdataio_discovery_lab`
- route family: `/api/mlb/{product}/json/{endpoint}`

Confirmed Discovery Lab endpoints in the repository catalog include:

- `CurrentSeason`
- `Teams`
- `Players`
- `FreeAgents`
- `Standings/{season}`
- `DfsSlatesByDate/{date}`
- `PlayerGameStatsByDate/{date}`
- `PlayerSeasonStats/{season}`
- `PlayerGameProjectionStatsByDate/{date}`
- `PlayerSeasonProjectionStats/{season}`
- `GamesByDate/{date}`
- `GameOddsByDate/{date}`
- `GameOddsLineMovement/{gameid}`
- `Games/{season}`
- `Stadiums`
- `TeamGameStatsByDate/{date}`
- `TeamSeasonStats/{season}`

Enterprise-only MLB endpoints are cataloged but not available to the current Discovery Lab key without separate entitlement confirmation. That includes `StartingLineupsByDate`, `DepthCharts`, `InjuredPlayers`, `BettingPlayerPropsByGameID`, betting markets and market-result settlement endpoints.

## Engine Readiness

- Starting Pitcher Engine: blocked until `GamesByDate` starter fields or projection payload fields are verified.
- Lineup Engine: blocked because the cataloged lineup endpoint is enterprise-only for the current MLB integration.
- Injury Engine: blocked because the cataloged injury endpoint is enterprise-only for the current MLB integration.
- Bullpen Engine: architecture-ready, but relief split and recent workload fields are not verified.
- Weather Engine: blocked until `GamesByDate` weather fields or an authorized weather provider are verified.
- Projection Engine: blocked for the current slate because `PlayerGameProjectionStatsByDate/2026-JUL-17` returned 0 rows.
- First Five, Team Totals and Props: blocked until odds, feature builder, model, settlement and calibration exist.

## Current Pipeline

The implemented current MLB pipeline uses stored schedule, full-game odds, projection checkpoint evidence and team-season context. Recommendation markets remain moneyline, run line/spread and total only.
