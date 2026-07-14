# SportsDataIO NBA Catalog

NBA is the most mature SportsDataIO integration in Pick Analyzer.

## Implemented Trial Domains

- Teams: `/v3/nba/scores/json/Teams`
- Players: `/v3/nba/scores/json/Players`
- Injuries: `/v3/nba/projections/json/InjuredPlayers`
- Depth charts: `/v3/nba/scores/json/DepthCharts`
- Starting lineups: `/v3/nba/projections/json/StartingLineupsByDate/{date}`
- Player stats: `/v3/nba/stats/json/PlayerSeasonStats/{season}` and `/v3/nba/stats/json/PlayerGameStatsByDate/{date}`

## Odds Discovery

Verified on 2026-07-14:

- `GET /v3/nba/odds/json/BettingEventsByDate/2025-12-26` returned HTTP 200 with 9 top-level records.
- The payload contained nested `BettingMarkets` discovery metadata.
- No sportsbook-priced `BettingOutcome` rows were directly persistable into `sports_odds_snapshots`.
- `GET /v3/nba/odds/json/BettingMarkets/22888` returned HTTP 200 with 0 records.
- No odds snapshots were inserted or updated.

Current blocker: identify the exact SportsDataIO endpoint that returns sportsbook-priced outcomes for the discovered betting markets. Do not call broad odds, live odds, typo-sensitive, props or historical archive endpoints until the endpoint is cataloged and approved.

## Registered Odds Endpoints

- `/v3/nba/odds/json/BettingMarkets/{eventId}`
- `/v3/nba/odds/json/BettingMarketsByGameID/{gameID}`
- `/v3/nba/odds/json/BettingMarketsByMarketType/{eventId}/{marketTypeID}`
- `/v3/nba/odds/json/BettingPlayerPropsByGameID/{gameId}`
- `/v3/nba/odds/json/BettingMarket/{marketId}`
- `/v3/nba/odds/json/BettingMarketResults/{marketId}`
- `/v3/nba/odds/json/GameOddsByDate/{date}`
- `/v3/nba/odds/json/AlternateMarketGameOddsByDate/{date}`
- `/v3/nba/odds/json/GameOddsLineMovement/{gameid}`
- `/v3/nba/odds/json/LiveGameOddsByDate/{date}`
- `/v3/nba/odds/json/BettingMetadata`
- `/v3/nba/odds/json/ActiveSportsbooks`

The misspelled `LveGameOddsByDate` path is not cataloged and must not be called.

## Identifier Rules

- Use `BettingEventID` as the betting event identifier.
- Preserve `GameID` separately as the provider game identifier.
- Preserve `BettingMarketID`, `BettingOutcomeID` and `SportsbookID` separately.
- Never use `GameID`, `BettingMarketID` or a trial mapping ID as a `BettingEventID`.
- Do not persist `sports_odds_snapshots` rows unless an actual sportsbook-priced outcome exists.
