# MLB Statcast Foundation V1

## Status

`MLB_STATCAST_ANALYTICS_V1_DATA_CERTIFIED`

The permanent MLB Statcast analytics foundation is active on the certified Pick Analyzer raw pitch table. No parallel raw-pitch table is used.

## Source of truth

- Raw table: `public.pick2_raw_mlb_statcast_pitches`
- Natural pitch identity: `game_pk + at_bat_number + pitch_number`
- 2025 certified final coverage: 712,528 pitches / 2,430 games / 30 teams / through 2025-09-28
- 2026 certified baseline: at least 631,404 pitches / 2,139 games / 30 teams / through at least 2026-09-05
- Duplicate pitch identity groups at certification: 0

The 2026 numbers are a certification floor, not a frozen ceiling. The daily ingestion pipeline may advance the active-season pitch count, game count and last game date beyond that baseline. Validation must fail on regression below the certified floor, not on healthy monotonic growth.

The final certification gap was closed with 4,590 pitches across 16 games on 2026-09-04 and 4,450 pitches across 15 games on 2026-09-05.

## Production database

The Statcast index and analytical-view migrations have been applied to production Supabase. They are additive and reuse the existing certified raw table.

Analytical surfaces:

- `mlb_statcast_classified_v`
- `mlb_statcast_coverage_v`
- `mlb_statcast_pitcher_game_logs`
- `mlb_statcast_batter_game_logs`
- `mlb_statcast_pitcher_season_summary`
- `mlb_statcast_batter_season_summary`
- `mlb_statcast_pitcher_pitch_type_summary`
- `mlb_statcast_team_batting_season_summary`
- `mlb_statcast_team_pitching_season_summary`

The views use `security_invoker = true`. Access is revoked from `anon` and `authenticated` and granted to `service_role`.

## Metrics

The foundation supports stored-data analysis for:

- Ball%, Strike%, In-Play%
- CSW%, Whiff%, Chase%, Zone%, Contact%
- First-Pitch Strike%
- pitch count and plate appearances
- strikeouts, walks, hits and home runs
- pitch mix and usage
- release velocity, spin, extension and movement
- exit velocity and launch angle
- hard-hit and barrel counts
- xBA and xwOBA by pitch type
- pitcher last 3 / 5 / 10 / 20 game windows
- batter game logs and season summaries
- team batting and pitching season summaries

## Read API

`GET /api/mlb/statcast`

Supported modes:

- `mode=coverage`
- `mode=pitcher&pitcherId=<MLBAM>&season=<year>`
- `mode=batter&batterId=<MLBAM>&season=<year>`
- `mode=team&team=<abbr>&season=<year>`

The API reads stored Supabase data only. It does not call Baseball Savant or any other provider at request time.

## Validation

Run:

```bash
npm run mlb:statcast:validate
```

The validator requires exact certified final coverage for 2025. For active-season 2026 it requires coverage at or above the certified baseline, a last game date at or beyond the certified baseline date, 30-team coverage, populated analytical views, and exact agreement between the raw-table pitch count and the coverage view. This preserves fail-closed regression detection without treating legitimate daily ingestion growth as a failure.

## Ingestion note

Baseball Savant may enrich historical pitch rows after initial publication, including fields such as arm angle and rest-day context. Existing certified raw rows are not overwritten by this foundation. New missing identities are stored from the source version available at ingestion time.

## Temporary gap-fill cleanup

The one-time 2026-09-04/05 backfill route was removed from the application branch after successful ingestion. The temporary Supabase function was replaced with a JWT-protected 410 response, and the temporary `pg_net` extension was removed after execution.

## Scope boundary

This foundation does not activate Official Picks or any new betting market. Pitcher props, NRFI/YRFI, totals and matchup models must be separately backtested and certified before production activation.
