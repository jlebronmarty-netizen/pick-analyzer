# SportsDataIO Identity Mapping

Status: Implemented
Version: V1

## Canonical Tables

SportsDataIO provider IDs map through:

- `sports_teams`
- `sport_players`
- `sport_events`
- `provider_entity_mappings`

## Discovery Contract

The discovery API reports current provider mapping row counts and separates:

- Provider player/team/event ID
- Canonical player/team/event ID
- Team mapping state
- Stored evidence source

## Rule

No synthetic team, player or event mapping may be created by discovery. Mapping repair requires deterministic evidence or explicit operator approval.
