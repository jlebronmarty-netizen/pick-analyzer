# MLB Statcast Runtime Performance V1

Status: `MLB_STATCAST_RUNTIME_PERFORMANCE_V1_VALIDATED`

## Scope

Read-only performance repair for the permanent Statcast foundation. The raw source of truth remains `pick2_raw_mlb_statcast_pitches`; no betting market, Official Pick write, or provider call is introduced.

## Failure reproduced before repair

Production `GET /api/mlb/statcast?mode=coverage` returned HTTP 500 with a PostgreSQL statement timeout.

Production `GET /api/mlb/statcast?mode=pitcher&season=2026&pitcherId=645261&recentGames=20` also returned HTTP 500 with a statement timeout.

A team profile remained over the statement-timeout boundary after identity indexes alone; a direct 2026 HOU batting-season aggregation required roughly 8.4 seconds and a PHI-vs-RHP pitch-type aggregation required roughly 9.6 seconds.

## Repair

- expression indexes now match the effective MLBAM/fallback pitcher and batter identities used by the analytical views;
- team expression indexes match the batting/fielding team derivation;
- season coverage is served through a tiny materialized rollup while preserving the existing `mlb_statcast_coverage_v` API contract;
- team batting/pitching season summaries are served through materialized rollups while preserving their existing view names;
- refresh functions are service-role only;
- `anon` and `authenticated` retain no direct access to the new materialized relations or refresh functions.

## Runtime validation

After the database migration, the existing production application (without an application-code change) returned HTTP 200 for:

- coverage: 2025 = 712,528 pitches / 2,430 games / 30 teams; 2026 = 631,404 pitches / 2,139 games / 30 teams;
- pitcher profile: Sandy Alcantara (`645261`), 2026, including season summary, pitch mix and last 3/5/10/20 windows;
- batter profile: MLBAM `621566`, 2026, including season and recent-game detail;
- team profile: HOU, 2026, including batting and pitching summaries.

No provider requests or remote sportsbook mutations are part of these reads.

## Refresh contract

Whenever raw Statcast data changes, service-role ingestion/maintenance must call `refresh_mlb_statcast_runtime_rollups()` after the raw transaction completes. The refresh updates coverage and team season materializations from the canonical raw table.

## Integration dependency

Production Supabase already contains migration `20260907035256_mlb_statcast_matchup_views_v1`, represented on branch `feature/mlb-statcast-matchup-v1`. Repository migration ordering should include that migration before the runtime migrations (`20260907035833` and `20260907040410`) are merged to `main`.
