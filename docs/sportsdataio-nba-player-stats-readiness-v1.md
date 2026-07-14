# SportsDataIO NBA Player Stats Readiness V1

Last updated: 2026-07-13 21:45:11 -04:00

## Scope

This module prepares NBA player season stats and player game stats for a future capped SportsDataIO pilot without making provider calls or guessing endpoint paths.

Status: readiness complete, live pilot blocked pending exact authenticated endpoint confirmation.

## Provider Call Policy

- External provider calls used: 0.
- No SportsDataIO endpoint was called.
- Exact endpoint paths are not present in the repository contract metadata, so live execution remains blocked.
- No secrets were read, printed, stored or documented.

## Persistence

Created additive migration:

- `supabase/migrations/202607130002_sport_player_stats_v1.sql`

The migration creates `sport_player_stats` with:

- season and game stat scopes
- event, team and player foreign keys where available
- basketball box-score fields
- shooting percentages and usage-related fields
- starter flag for game stats
- source timestamp
- provider IDs
- raw stat metadata
- trial/scrambled/production eligibility metadata

The migration was not applied automatically.

## Migration Preflight

The readiness APIs now return a zero-provider-call `migration.preflight` block with:

- verification SQL for table existence, columns, indexes and grants
- expected `sport_player_stats` columns
- expected indexes
- go/no-go gates for future player-stat persistence

Verification queries:

```sql
select to_regclass('public.sport_player_stats') as table_exists;
select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'sport_player_stats'
order by ordinal_position;
select indexname
from pg_indexes
where schemaname = 'public'
  and tablename = 'sport_player_stats'
order by indexname;
select grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name = 'sport_player_stats'
order by grantee, privilege_type;
```

Go/no-go gates:

- The additive migration is applied only after explicit approval.
- The table, primary key, lookup indexes and grants are present.
- Numeric stat columns remain compatible with decimal provider values.
- Exact SportsDataIO player season/game stat endpoints are confirmed before any provider call.
- Any future live pilot remains capped, sequential, trial-isolated and prediction-disabled.

## Runtime Contract

Added readiness API:

- `GET /api/providers/sportsdataio/nba/player-stats/readiness`
- `GET /api/providers/sportsdataio/nba/player-stats/migration-preflight`

The API returns:

- destination tables
- natural keys
- conflict targets
- dependency order
- blocked endpoint-readiness status
- deterministic normalized fixture rows
- trial isolation checks
- production confidence blocking

The migration-preflight API returns the migration block directly with expected columns/indexes, verification SQL, persistence targets, endpoint blockers and validation status. It does not apply the migration automatically.

## Contract Updates

Updated provider contracts so player stats are no longer conflated with roster identity:

- Generic Provider SDK `fetchPlayerStats` now uses `player_stats`.
- SportsDataIO Adapter Contract V1 maps `playerSeasonStats` and `playerGameStats` to `player_stats`.
- SportsDataIO runtime capabilities now point `player_stats` at `sport_player_stats`.

## Deterministic Validation

Fixture validation normalizes:

- 1 season stat row
- 1 game stat row

Corrected counters:

- provider records fetched: 2
- normalized rows produced: 2
- records skipped: 0

Validation confirms:

- deterministic IDs
- separated season/game stat types
- game stats preserve event provider ID
- season stats do not require event ID
- trial isolation remains `trial=true`, `scrambled=true`, `production_eligible=false`
- production confidence cannot improve from fixture/trial rows

## Remaining Blocker

Exact SportsDataIO NBA player season stats and player game stats endpoint paths must be confirmed from authenticated provider documentation or existing verified contract metadata before any live call or persistence pilot.
