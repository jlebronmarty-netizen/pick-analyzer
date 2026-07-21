# Game Intelligence V1

Date: 2026-07-21

## Route

`GET /api/games/[eventId]/intelligence`

## Data Sources

The route is read-only and uses:

- `sport_events`
- Current Board candidates from the existing Current Board service
- shared market alignment
- shared market classification
- shared recommendation explanations

## Returned Sections

- Event identity and data freshness.
- Model context when a linked Current Board row exists.
- Stored market rows with snapshot EV and actionable EV separated.
- Team comparison as limited stored evidence only.
- Pitching context only when existing stored starter/pitcher context is present.
- Missing unsupported inputs for confirmed lineups, injuries, verified props and multi-book movement.
- One summary state from the canonical classifier.

## Guardrails

The route makes 0 provider calls and 0 remote mutations. It does not fabricate weather, injuries, lineups, props, multi-book movement, full-season splits or starter identities.
