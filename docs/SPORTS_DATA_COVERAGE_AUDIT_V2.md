# Sports Data Coverage Audit V2

Status: Locally implemented.

`GET /api/data-foundation/coverage` provides a stored-data-only inventory for MLB, NBA, NFL, NHL, Soccer, BSN, Tennis and UFC. The normal GET path reports `providerCallsMade: 0` and `remoteMutationsMade: 0`.

## Scope

The audit reads existing canonical and operational tables where available:

- `sports_teams`
- `sport_players`
- `sport_events`
- `game_results`
- `sport_standings`
- `sport_game_stats`
- `sport_player_stats`
- `sport_lineups`
- `sport_injuries`
- `sports_odds_snapshots`
- `prediction_history`
- `historical_feature_snapshots`
- `provider_entity_mappings`
- `sports_sync_jobs`

Missing or empty datasets are reported as coverage findings rather than critical failures. The audit does not call providers, spend quota, apply migrations, persist rows, generate predictions, execute historical odds, settle predictions or alter certified platform behavior.

## Sport Handling

- MLB uses calendar-year season hints.
- NBA and NHL use cross-year season hints.
- NFL uses season-year hints with postseason allowed in the next calendar year.
- Soccer remains competition-specific and must not be reported as global coverage.
- BSN remains a custom league adapter.
- Tennis and UFC remain event-driven and are not forced into a team-season schema.

## Readiness Signals

Each sport returns row counts, earliest/latest dates, source providers observed in stored rows, duplicate indicators from bounded samples, unresolved or missing identity signals, stale record counts, missing required field samples, import readiness and prediction readiness.

Readiness is conservative:

- `ready`: core stored tables exist with rows.
- `partial`: some useful coverage exists, but required domains are incomplete.
- `blocked`: no core stored coverage is available yet.

## Certification

Local validation:

- `GET /api/data-foundation/coverage?validate=true`
- `GET /api/data-foundation/coverage`
- `npm.cmd run build`
- `git diff --check`

Stored-data validation on 2026-07-26 observed:

| Sport | Completeness | Import readiness | Prediction readiness | Notes |
| --- | --- | --- | --- | --- |
| MLB | High | Ready | Ready | Existing canonical teams, events, player stats, odds, predictions, feature snapshots, mappings and 11 genuine recorded-outs prop rows are visible. |
| NBA | High | Ready | Ready | Existing trial/pilot NBA coverage is visible; odds sample duplicate indicators require follow-up reconciliation before production use claims. |
| NFL | Low | Blocked | Blocked | Legacy predictions exist, but canonical teams/events/mappings are empty. |
| NHL | Empty | Blocked | Blocked | No stored canonical NHL coverage observed. |
| Soccer | Empty | Blocked | Blocked | No global soccer coverage is claimed; future work must be competition-specific. |
| BSN | Medium | Ready | Partial | Teams, events, standings, predictions and mappings exist; odds and stat domains are incomplete. |
| Tennis | Empty | Blocked | Blocked | Event-driven readiness contract required before picks. |
| UFC | Empty | Blocked | Blocked | Event-driven readiness contract required before picks. |

Observed audit totals:

- sports audited: 8
- ready for import: 3
- ready for prediction: 2
- partial prediction readiness: 1
- stored rows observed across audited domains: 259477
- provider calls: 0
- remote mutations: 0

Certification markers:

`SPORTS_DATA_COVERAGE_AUDIT_V2_PASS`

`NO_PROVIDER_CALL_AUDIT_PASS`
