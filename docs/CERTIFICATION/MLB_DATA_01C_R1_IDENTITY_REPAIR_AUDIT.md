# MLB-DATA-01C-R1 Canonical Identity Repair Audit

Certification verdict: `MLB_DATA_01C_R1_IDENTITY_REPAIR_EXTERNAL_ID_GAP`

Generated artifact: `docs/CERTIFICATION/mlb-data-01c-r1-identity-repair-audit.json`

## Scope

This R1 pass audited the canonical identity infrastructure that blocked `MLB-DATA-01C_2025_CANONICAL_GAME_PLAYER_TEAM_MAPPING`. It made read-only production checks and reused the certified `MLB-DATA-01A` and `MLB-DATA-01C` artifacts for expensive raw Statcast and mapping dry-run evidence.

No provider calls, production DML, production DDL, raw-payload rewrites, source-ID rewrites, 2026 imports, feature builds, model runs, prediction writes, automation changes or cron changes were performed.

## Event Identity Finding

The 2025 Statcast source has 2,430 unique `game_pk` identities. Canonical `sport_events` has 2,462 MLB 2025 rows, but only 2,175 unique date/home/away identities. The apparent +32 canonical surplus is not a safe repair path because it hides 287 duplicate or excess canonical date/home/away rows plus missing or unsafe source-game identities.

The prior deterministic dry run remains the certified event state:

- 1,816 mapped by exact date plus canonical home/away team.
- 305 unmapped.
- 309 ambiguous.
- 0 conflicts.

Exact `game_pk` identity is not stored on `sport_events`, and the available MLB provider crosswalk is partial at 227 rows. Therefore R1 did not write `event_id`.

## Player Identity Finding

The 2025 Statcast source has 1,469 unique MLBAM player ids: 796 pitcher-only, 596 batter-only and 77 appearing as both pitcher and batter. The existing canonical player corpus has 7,389 MLB players and 7,567 provider player mappings, but the 2025 source MLBAM ids still produce:

- 0 mapped.
- 1,469 unmapped.
- 0 ambiguous.
- 0 conflicts.

Name-only or fuzzy repair is unsafe and was not used. Therefore R1 did not write `canonical_pitcher_id` or `canonical_batter_id`.

## Infrastructure Decision

No additive migration is required for this repair layer. The existing `provider_entity_mappings` table already provides the reusable identity contract for exact provider crosswalks through `sport_key`, `entity_type`, `provider`, `provider_id`, `season` and `internal_id`.

Migration required: `NO`

Migration applied: `NO`

Reusable for 2026: `YES`

Reusable for daily ingest: `YES`

## Downstream Gate

`MLB_DATA_01D_2025_FEATURE_BUILD_READY = NO`

Feature construction remains blocked until exact `game_pk -> sport_events.id` and MLBAM `person_id -> sport_players.id` evidence can be populated or certified without guessing.
