# SportsDataIO NBA Player Props Readiness V1

Last updated: 2026-07-13 21:54:36 -04:00

## Summary

SportsDataIO NBA Player Props Readiness V1 adds contract-only player prop readiness without calling SportsDataIO and without enabling production prop betting.

The module exposes `/api/providers/sportsdataio/nba/player-props/readiness` and `/api/providers/sportsdataio/nba/player-props/endpoint-preflight`, and validates a deterministic local fixture that expands one player prop offer into two normalized odds-style rows: over and under.

## Safety

- External provider calls used: 0.
- API key exposure: none.
- Migration created: none.
- Prediction persistence enabled: no.
- Backtesting enabled: no.
- Model training enabled: no.
- Settlement enabled: no.

## Persistence Contract

No new migration is required for readiness. Future pilot rows can use existing `sports_odds_snapshots` with prop-specific metadata after exact endpoint paths, entitlement and settlement support are approved.

Natural key:

- `sport_key`
- `event_id`
- `provider_player_id`
- `sportsbook`
- `prop_market`
- `outcome`
- `snapshot_time`

## Blockers

Player props remain blocked for live execution until:

- Exact authenticated SportsDataIO NBA player prop endpoint paths are confirmed.
- Subscription entitlement and bookmaker coverage are verified under a capped pilot.
- Player prop settlement and validation rules exist.
- Trial/scrambled rows remain excluded from production predictions and confidence improvement.

## Endpoint And Settlement Preflight

The readiness and endpoint-preflight APIs return `endpointPreflight` with zero-provider-call gates for:

- exact player prop endpoint path or paths
- supported prop market keys and provider market names
- sportsbook identifiers and coverage expectations
- player, team and event mapping fields
- line, price, over/under outcome and timestamp semantics
- settlement source fields and grading rules for every supported prop market

First capped pilot requirements:

- maximum requests: 1
- concurrency: 1
- automatic retries: false
- `trial=true`
- `scrambled=true`
- `production_eligible=false`
- stop on any transport or non-200 failure

Do not enable prop predictions, production persistence, backtesting, model training, settlement or confidence improvement from trial prop rows.

## API

- `GET /api/providers/sportsdataio/nba/player-props/readiness`
- `GET /api/providers/sportsdataio/nba/player-props/endpoint-preflight`

The endpoint-preflight route returns required confirmations, capped pilot requirements, go/no-go gates, persistence targets and validation blockers directly. It makes zero provider calls and does not authorize player-prop provider transport, prediction persistence, settlement, backtesting or model training.
