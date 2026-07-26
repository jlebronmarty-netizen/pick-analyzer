# Season And Competition Governance V2

Status: Locally implemented as a read-only contract.

`GET /api/data-foundation/seasons` exposes canonical season and competition governance for the sports currently registered in Pick Analyzer. The route makes zero provider calls and zero remote mutations.

## Governance Rules

| Sport | Competition | Season model | Current season hint | Previous season hint | Notes |
| --- | --- | --- | --- | --- | --- |
| MLB | MLB | Calendar year | 2026 | 2025 | Postseason remains under the same season ID. |
| NBA | NBA | Cross-year | 2025-26 | 2024-25 | Playoffs occur in the ending calendar year. |
| NFL | NFL | Season year with cross-year postseason | 2026 | 2025 | Season ID is kickoff year; playoffs can occur in the next calendar year. |
| NHL | NHL | Cross-year | 2025-26 | 2024-25 | Goalie/starter domains remain future data readiness work. |
| Soccer | Competition-specific | Competition-specific | Competition-specific | Competition-specific | No global soccer coverage is claimed. |
| BSN | BSN Puerto Rico | Calendar year | 2026 | 2025 | Exact windows remain source-evidence driven. |
| Tennis | ATP/WTA | Event-driven | event_driven_2026 | event_driven_2025 | Tournaments, rounds and surfaces are event metadata. |
| UFC | UFC | Event-driven | event_driven_2026 | event_driven_2025 | Fight cards, bouts and divisions are event metadata. |

## Persistence Position

No migration is mandatory for read-time governance. A future additive `sport_competitions` or `sport_season_governance` table could persist this contract if production administration needs database-managed season windows. That migration is not required to continue this autonomous run.

## Safety

- Does not apply production SQL.
- Does not mutate stored events, predictions or mappings.
- Does not activate any epoch.
- Does not create retrospective predictions.
- Does not force Tennis or UFC into team-season schemas.

## Certification

Local validation:

- `GET /api/data-foundation/seasons?validate=true`
- `GET /api/data-foundation/seasons`
- `npm.cmd run build`
- `git diff --check`

Certification markers:

`SEASON_GOVERNANCE_V2_PASS`

`COMPETITION_GOVERNANCE_V2_PASS`
