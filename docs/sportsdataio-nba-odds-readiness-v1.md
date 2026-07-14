# SportsDataIO NBA Odds Readiness V1

Last updated: 2026-07-14 15:05:00 -04:00

## Summary

SportsDataIO NBA Odds Readiness V1 adds a zero-provider-call readiness endpoint for game odds and historical odds.

The module exposes `/api/providers/sportsdataio/nba/odds/readiness` and `/api/providers/sportsdataio/nba/odds/endpoint-preflight`, and validates a deterministic local fixture covering moneyline, spread and total outcome rows for the existing `sports_odds_snapshots` table.

## Safety

- External provider calls used: 0.
- API key exposure: none.
- Migration created: none.
- Prediction persistence enabled: no.
- CLV/backtesting/model training enabled: no.
- Historical odds execution enabled: no.

## Persistence Contract

No new migration is required. Future capped odds pilots can use existing `sports_odds_snapshots` rows after exact endpoint paths, entitlement and sportsbook coverage are approved.

Natural key:

- `sport_key`
- `event_id`
- `provider`
- `sportsbook`
- `market`
- `outcome`
- `snapshot_time`

## Blockers

Live odds and historical odds execution remain blocked until:

- Exact authenticated SportsDataIO NBA odds endpoint paths are confirmed.
- Subscription entitlement and sportsbook coverage are verified under a capped pilot.
- Historical odds windows and request caps are explicitly approved.
- Trial/scrambled rows remain excluded from production predictions, CLV, backtesting and confidence improvement.

## Endpoint Preflight

The readiness and endpoint-preflight APIs return `endpointPreflight` with zero-provider-call gates for:

- exact current odds endpoint path
- exact historical odds endpoint path, if separate
- moneyline, spread and total market keys
- sportsbook identifiers and coverage expectations
- historical odds date-window and quota limits
- snapshot timestamp, opening and closing semantics

First capped pilot requirements:

- maximum requests: 2
- concurrency: 1
- automatic retries: false
- `trial=true`
- `scrambled=true`
- `production_eligible=false`
- stop on any transport or non-200 failure

Do not enable CLV, production predictions, backtesting, model training or confidence improvement from trial odds rows.

## API

- `GET /api/providers/sportsdataio/nba/odds/readiness`
- `GET /api/providers/sportsdataio/nba/odds/endpoint-preflight`

The endpoint-preflight route returns required confirmations, capped pilot requirements, go/no-go gates, persistence targets and validation blockers directly. It makes zero provider calls and does not authorize current odds, historical odds, CLV, backtesting, model training or production prediction use.

## Betting Events And Market-Detail Contract Pilot V1

The capped pilot path is implemented through the existing protected `/api/historical-import/execute` route with:

- `domains=["odds"]`
- `dateFrom=dateTo=2025-12-26`
- `maximumRequests=2`
- `concurrencyLimit=1`
- `confirmed=true`
- `dryRun=false`
- no automatic retries

Approved endpoint order:

- `GET /v3/nba/odds/json/BettingEventsByDate/2025-12-26`
- `GET /v3/nba/odds/json/BettingMarkets/{eventId}` for exactly one event only if the first payload proves market detail is required

`AlternateMarketGameOddsByDate/2025-12-26` and the typo-sensitive `LveGameOddsByDate/{date}` path remain uncalled after the discovery classification.

Execution result on 2026-07-14:

- Provider calls used: 2 of 2.
- `BettingEventsByDate/2025-12-26` returned HTTP 200 with 9 top-level records.
- The sanitized shape showed a `BettingEvent -> BettingMarkets` discovery/index relationship with nested market metadata but no sportsbook-priced outcome rows.
- The approved one-event follow-up `BettingMarkets/22888` returned HTTP 200 with 0 records.
- Snapshots inserted/updated: 0.
- `records_skipped`: 0.
- Migration created: none.
- Production predictions, CLV, ROI, backtesting, calibration and model training remained disabled.

The pilot completed as discovery-only. No unsupported odds snapshots were fabricated, and the next blocker was identifying the exact priced-outcome endpoint for discovered SportsDataIO betting markets.

## Priced Game Odds Pilot V1

The bounded priced pilot used the existing protected `/api/historical-import/execute` route with:

- endpoint: `GET /v3/nba/odds/json/GameOddsByDate/2025-12-26`
- initial provider calls used: 1
- corrected retry provider calls used: 1
- concurrency: 1
- retries: 0
- `trial=true`
- `scrambled=true`
- `production_eligible=false`

Execution result on 2026-07-14:

- HTTP status: 200
- top-level game records fetched: 9
- normalized rows produced by the first run: 1,476
- persisted rows recorded by sync-job metadata: 1,476
- intended pregame full-game rows found by read-only audit: 540
- alternate-like rows found by read-only audit: 936
- sportsbook identity: `Scrambled`
- `records_skipped`: 0
- sync job: `8ee9314a-f8e4-4a13-b861-2574a904bdc8`
- sync job status: `partial`

The first run stopped before lineage retry because post-persistence validation reported missing rows and the first-run traversal included alternate-like rows, which are outside this pilot. The local service now fixes those two issues by exact-id chunk validation, skipping `AlternateMarketPregameOdds`/`LiveOdds`, requiring mapped events and keeping moneyline `line=null`.

Cleanup result:

- deleted alternate-like trial rows: 936
- retained `PregameOdds` rows: 540
- remaining alternate-like rows: 0
- remaining live rows: 0
- retained market counts: 180 moneyline, 180 spread, 180 total
- unresolved events: 0
- duplicate retained rows: 0

Corrected retry and supersession result:

- endpoint: `GET /v3/nba/odds/json/GameOddsByDate/2025-12-26`
- HTTP status: 200
- normalized rows: 540
- inserted corrected null-line moneylines: 180
- updated spread/total rows: 360
- deleted superseded legacy moneylines: 180
- final rows: 540
- final market counts: 180 moneyline, 180 spread, 180 total
- legacy non-null-line moneylines: 0
- duplicate logical rows: 0
- production leakage: 0

The bounded lineage pilot then used provider calls `0`, inserted 5 trial-only prediction rows, settled them locally, and reused all 5 on immediate rerun. These rows validate the architecture only; production predictions, CLV, ROI, calibration and model training remain blocked for trial/scrambled/non-production rows and missing genuine closing snapshots.

## Identifier And Routing Hardening

SportsDataIO Betting Market Normalization Core V1 adds zero-call deterministic coverage for:

- `BettingEventID`, preserved separately from `GameID`
- `BettingMarketID`
- `BettingOutcomeID`
- `SportsbookID`
- discovery-only events
- market-index payloads
- priced sportsbook outcomes
- consensus outcomes
- unlisted outcomes
- valid empty responses
- entitlement-blocked statuses
- archive-required routing for older events

The importer must not use `GameID`, `BettingMarketID` or trial mapping IDs as betting event identifiers. Discovery records are counted separately from normalized snapshots and are not treated as skipped odds rows.
