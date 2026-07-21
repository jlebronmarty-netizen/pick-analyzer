# Event Import Recovery Contract

Last updated: 2026-07-21

## Required Evidence

A recovered event may be inserted into `sport_events` only when all required evidence exists:

- exact provider or source event ID
- provider name
- sport key
- league key
- season
- exact home team canonical ID
- exact away team canonical ID
- scheduled start
- status
- source timestamp
- ingestion timestamp
- source lineage

## Mapping Contract

Recovered source IDs must be persisted in `provider_entity_mappings`:

- `entity_type='event'`
- `internal_id=<sport_events.id>`
- `provider=<source provider>`
- `provider_id=<source event id>`
- `sport_key=<canonical sport>`
- `season=<season>`
- `metadata.evidenceMethod=<deterministic resolver method>`

Existing trusted mappings must not be overwritten.

## Blocked Evidence

The following are not sufficient for automatic event import:

- team display names alone
- matchup plus calendar date
- 32-character source-looking IDs without provider lineage
- sportsbook name without source event metadata
- home/away pairs without exact team IDs
- inferred schedule continuity for postponed or rescheduled games
