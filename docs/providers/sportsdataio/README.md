# SportsDataIO Provider Catalog

Status: Provider-independent catalog created 2026-07-14.

The canonical typed endpoint metadata lives in `src/config/sportsdataio-endpoint-catalog.ts`.
These docs summarize how Pick Analyzer uses that catalog without copying provider documentation verbatim.

## Rules

- Exact endpoint paths must exist in the catalog before any new live pilot.
- Provider calls remain capped, sequential and retry-free until production sync is approved.
- Trial imports remain `trial=true`, `scrambled=true` and `production_eligible=false`.
- Raw provider payloads, keys, authorization headers and secret query parameters must not be logged or documented.
- Soccer endpoints are competition scoped; do not treat all competitions as one league.

## Current State

- NBA teams, players, injuries, lineups and player stats have completed trial persistence pilots.
- NBA betting events are confirmed as discovery/index data for `2025-12-26`; the verified follow-up `BettingMarkets/22888` returned 0 records.
- NBA odds snapshots remain empty for SportsDataIO because no sportsbook-priced outcome rows were returned.
- NBA odds identifier hardening now separates `BettingEventID`, `GameID`, `BettingMarketID`, `BettingOutcomeID` and `SportsbookID` in deterministic fixtures before any future live odds call.
- Betting metadata is modeled as a zero-call contract domain; numeric market IDs must not be interpreted before BettingMetadata and ActiveSportsbooks are confirmed.
- MLB, NFL, NHL and Soccer are cataloged but live provider pilots remain pending sport-specific fixture validation, persistence checks and call-budget approval.
