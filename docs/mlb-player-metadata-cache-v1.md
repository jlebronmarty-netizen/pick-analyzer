# MLB Player Metadata Cache V1

## Scope

MLB Player Metadata Cache V1 hardens the existing `/api/mlb/players/metadata-cache` endpoint into a TTL-aware cache coverage report. It does not call providers, write rows, regenerate predictions, alter official policy or promote a model.

## Data Sources

- `sport_players`: cached MLB player identity, team, position, roster and provider ID fields.
- `provider_entity_mappings`: cached SportsDataIO identity mappings.

## Contract

The endpoint reports:

- bounded cache sample size and read limit.
- player identity, active status, team, provider ID and position coverage.
- handedness and injury-status coverage when present in cached metadata.
- TTL status and whether a provider refresh is eligible under the 7-day player metadata policy.
- explicit blockers for uncached handedness, player injury status, lineups and separate injury feeds.

## Validation

Production validation after deployment returned 1,000 cached player rows, 1,000 provider mappings, 1,000 names, 1,000 active players, 1,000 provider IDs and 1,000 position rows with 0 provider calls. Handedness and injury status remain uncached and are not fabricated.

