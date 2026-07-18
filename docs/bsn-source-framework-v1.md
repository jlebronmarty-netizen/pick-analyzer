# BSN Source Framework V1

BSN Platform V1 now has a provider-independent basketball source framework. It is a foundation layer, not production betting readiness.

## Purpose

The framework lets Pick Analyzer validate and plan BSN ingestion from multiple source types without making the rest of the platform care where data came from.

Supported source types:

- Official BSN digital properties
- Future API
- CSV import
- Manual entry
- Future provider

All source routes are validation or dry-run only. They make zero provider calls and zero writes.

## Implemented Routes

- `/api/bsn/sources`
- `/api/bsn/source-quality`
- `/api/bsn/sources/validate`
- `/api/bsn/import`

Existing BSN routes now expose source-framework context:

- `/api/bsn/capabilities`
- `/api/bsn/sync`
- `/api/bsn/operations/readiness`
- `/api/bsn/current-board`

## Source Intelligence

Current source investigation confirms the official BSN web/app surfaces expose or advertise:

- Schedule
- Results
- Standings
- Teams
- Players
- Venues
- Statistics
- Playoffs and series context
- Individual leaders

No documented production API or automated-ingestion permission is configured. Official public surfaces are treated as source-discovery evidence only until terms, permission or a provider contract is approved.

## Reusable Basketball Blueprint

The source framework defines reusable basketball abstractions for:

- Quarter
- Half
- Pace
- Possessions
- Offensive Rating
- Defensive Rating
- Net Rating
- Home Court
- Travel
- Rest
- Back-to-back
- Playoffs
- Series
- Momentum
- Clutch
- Overtime
- Close Games
- Pressure

The Team DNA contract includes:

- Identity
- Offense
- Defense
- Pace
- Home Court
- Travel
- Momentum
- Recent Form
- Clutch
- Depth
- Consistency
- Playoff Performance
- Series Performance

These contracts are reusable for NBA, NCAA, EuroLeague, FIBA, WNBA and future basketball leagues.

## Import Contract

The framework normalizes source rows into:

- `sports_teams`
- `sport_events`
- `sport_standings`
- `sport_players`
- `sport_game_stats`
- `sports_odds_snapshots`

Import planning requires:

- Source lineage
- Fetched/source timestamp
- Source document URL for manual or CSV data
- Idempotency key policy
- Provider mapping validation
- Audit-trail write path
- Rollback plan

Writes remain disabled until these approvals exist.

## Guardrails

- No aggressive scraping
- No access-restriction bypass
- No fake odds
- No fake EV
- No fake official picks
- No champion mutation
- No provider calls in validation
- No import writes without audit approval

## Current Status

BSN Platform Foundation is complete. BSN is not production betting-ready until approved source ingestion, verified odds, historical results, calibration and settled prediction samples exist.
