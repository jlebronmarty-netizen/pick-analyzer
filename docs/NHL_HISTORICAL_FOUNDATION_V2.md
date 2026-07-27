# NHL Historical Foundation V2

Status: Locally implemented as a read-only audit and readiness contract.

`GET /api/data-foundation/nhl` audits stored NHL coverage for the previous completed and current cross-year seasons without provider calls, production mutations, picks or retrospective prediction generation.

## Scope

The audit checks:

- schedule and events
- results
- teams and players
- standings
- team/game stats
- player stats
- period-score and boxscore readiness
- goalie/starter coverage where stored
- injuries where stored
- odds snapshots
- provider mappings
- cross-year season governance

## Current Position

Stored NHL coverage is currently a readiness surface, not a complete historical foundation. The phase reports missing domains as blockers and does not generate NHL picks unless a future certified prediction engine and sufficient stored data exist.

Local validation on 2026-07-27:

- validation checks: 8/8 passed
- provider calls: 0
- remote mutations: 0
- events observed: 0
- game stat rows observed: 0
- player stat rows observed: 0
- odds rows observed: 0
- prediction rows observed: 0
- retrospective predictions generated: 0

Remaining honest blockers:

- `NHL_SCHEDULE_COVERAGE_EMPTY`
- `NHL_CANONICAL_GAME_RESULTS_EMPTY`
- `NHL_GAME_STATS_EMPTY`
- `NHL_PLAYER_STATS_EMPTY`
- `NHL_GOALIE_STARTER_COVERAGE_NOT_AVAILABLE`
- `NHL_INJURY_COVERAGE_NOT_AVAILABLE`
- `NHL_ODDS_COVERAGE_EMPTY`

## Safety

- Provider calls: 0
- Remote mutations: 0
- Historical odds calls: 0
- NHL picks generated: 0
- Retrospective predictions: 0
- Production model confidence changes: none
- Learning Brain weight changes: none

## Certification

Certification markers:

`NHL_HISTORICAL_FOUNDATION_V2_PASS`

`NHL_DATA_READINESS_PASS`
