# NFL-02 Production Import Executor

Status: `NFL_02_PRODUCTION_IMPORT_EXECUTOR_CERTIFIED_READY_FOR_PUBLICATION`

## Scope

NFL-02 R3 wires a bounded production persistence executor around the existing
certified NFL canonical normalization in `scripts/nfl-02-canonical-historical-import.mjs`.
It does not redesign normalization and does not call providers.

## Execution Guard

Dry-run remains the default. Production writes require both:

- `--execute`
- `NFL_02_CANONICAL_PRODUCTION_IMPORT_AUTHORIZED=true`

If either guard is missing, execution fails closed with `0` provider calls and
`0` database mutations.

## Import Order

The executor writes in dependency-safe order:

1. `sports_teams`
2. `sport_players`
3. parent `provider_entity_mappings`
4. `sport_events`
5. event `provider_entity_mappings`
6. `game_results`
7. `sport_game_stats`
8. game `sport_player_stats`
9. season `sport_player_stats`
10. `sport_standings`
11. forward-only `sport_lineups`

Existing 2026 The Odds API NFL events and mappings are outside the historical
BallDontLie identity set and must remain preserved.

## Result Identity

`game_results.id` remains a database-generated UUID surrogate key. NFL-02 uses
`game_id` as the logical result identity and never sends deterministic text into
the UUID column.

## Resume / Failure

Progress is written locally under
`data/imports/balldontlie/nfl/import-progress/`, but database deterministic
identity remains the source of truth. On batch failure, the executor stops the
current entity class and reports the failing class, batch, identity range and DB
error. A rerun reuses completed rows through deterministic identities.

## Certification

Local certification exercised:

- default dry-run
- execution guard fail-closed behavior
- dry-run/execute identity parity
- batch sizing
- game-results UUID/game_id contract
- provider-error exclusion
- cancelled-game exclusion
- roster forward-only semantics
- partial-failure stop semantics
- zero provider calls
- zero production database mutations
