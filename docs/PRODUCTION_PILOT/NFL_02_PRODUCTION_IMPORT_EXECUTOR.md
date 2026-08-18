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

## Existing-Row Read Resilience

NFL-02-IMPORT-R5 is certified as
`NFL_02_SUPABASE_FETCH_RESILIENCE_REPAIR_CERTIFIED`.

The production import paused after the 32-team class was validly inserted. The
next class, `sport_players`, repeatedly failed before any player writes during
the existing-row pre-read for batch 1. The failing query shape was
`sport_players.select('*').in('id', ids)` with 500 deterministic player IDs in a
single request, from
`americanfootball_nfl_balldontlie_player_101` through
`americanfootball_nfl_balldontlie_player_13874644`, returning `TypeError: fetch
failed`.

A bounded read-only probe showed the same query succeeded for 1, 10, 50, 100
and 250 IDs, while the 500-ID request failed with an encoded filter near 24 KB.
The R5 root-cause classification is `URL_OR_FILTER_TOO_LARGE`, not a general
provider outage or canonical identity defect.

The executor now separates write batch size from existing-row read size:

- write batch size for `sport_players`: 500
- existing-row read chunk size: 100
- read retry backoff: 500 ms, 1500 ms, 3000 ms

Retries are applied only to safe read-only pre-read operations. Write failures
still fail closed; they are not blindly retried after an ambiguous transport
failure. The corrected production read-only probe completed the native first
player batch in 5 chunks, found 0 existing rows and classified all 500 players
as `WOULD_INSERT` with 0 provider calls and 0 database mutations.

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
- chunked existing-row reads
- bounded transient read retry
- no blind write retry
- zero provider calls
- zero production database mutations
