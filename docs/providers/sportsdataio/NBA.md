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

## Priced Game Odds

Verified on 2026-07-14:

- `GET /v3/nba/odds/json/GameOddsByDate/2025-12-26` returned HTTP 200 with 9 top-level game records.
- The payload contained `PregameOdds`, `AlternateMarketPregameOdds` and `LiveOdds` arrays.
- The first persistence run inserted trial-only `sports_odds_snapshots` rows but stopped as partial because alternate-like rows were included by the initial traversal and validation used a broad first-page read.

Current blocker: approve cleanup/quarantine for the trial-only alternate-like rows and rerun the corrected full-game-only `GameOddsByDate` pilot if desired. Do not call alternate, live, props, typo-sensitive or historical archive endpoints during that cleanup.

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
- For `GameOddsByDate` pilots, persist only `PregameOdds` full-game moneyline, spread and total rows; skip `AlternateMarketPregameOdds` and `LiveOdds`.
