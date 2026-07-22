# Starter Evidence Contract

Canonical MLB starter evidence is event-scoped, team-scoped, player-scoped and timestamped.

## Fields

- `eventId`
- `sport`
- `league`
- `season`
- `teamId`
- `opponentTeamId`
- `pitcherId`
- `providerPitcherId`
- `role`
- `status`
- `source`
- `provider`
- `sourceEventId`
- `sourceTimestamp`
- `observedAt`
- `eventStart`
- `evidenceAgeMinutes`
- `homeAway`
- `identityMethod`
- `evidenceCodes`
- `eligibility`

## Status

- `CONFIRMED`: live shadow eligible when timestamp-safe
- `PROBABLE`: live shadow eligible when timestamp-safe
- `EXPECTED`: not emitted by the SportsDataIO GamesByDate starter normalizer yet
- `INFERRED`: diagnostic only
- `UNKNOWN`: blocked
- `FINAL_ONLY`: blocked

## Freshness

- Confirmed starter evidence: fresh for 12 hours before game start
- Probable starter evidence: fresh for 36 hours before game start
- Source timestamps after event start are ineligible
- Stale evidence is retained but blocked from live projection generation

## Identity

Resolution is exact only:

1. `provider_entity_mappings` for `entity_type='player'`
2. exact `sport_players.provider_ids.sportsdataio`
3. unresolved provider ID retained as ineligible evidence

No fuzzy name matching is allowed.
