# SportsDataIO NBA Odds Readiness V1

Last updated: 2026-07-13 21:50:16 -04:00

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
