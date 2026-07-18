# MLB Bullpen And Pitcher Intelligence V1

## Scope

MLB Bullpen And Pitcher Intelligence V1 upgrades the existing pitcher/bullpen foundation endpoint into a cache-first analyst evidence report. It does not call providers, write rows, regenerate predictions, settle picks, promote models or change recommendation thresholds.

## Data Sources

- `sports_sync_jobs`: verified GamesByDate starter/weather/stadium snapshot evidence through `mlb-starter-weather-stadium-intelligence.service.ts`.
- `sport_player_stats`: cached MLB season and game player stat rows when available.
- `provider_ids.player`: provider player ID matching for starter stat cache joins.

## Contracts

`/api/mlb/intelligence/pitcher-bullpen-foundation` now returns cache status, freshness, row coverage, starter profile coverage, relief stat coverage, cached bullpen workload signals and explicit limitations for closer availability, high-leverage roles, injuries and lineup status.

Unavailable metrics remain `null` with missing reasons. The module never fills missing ERA, WHIP, K/9, BB/9, workload, fatigue or role data with fake defaults.

## Product Behavior

The AI Coach and MLB Data Quality route now surface cached pitcher/bullpen readiness in bettor-facing language. Bullpen output is analyst context only until settled calibration proves value. Official picks remain blocked by the existing production, calibration and recommendation gates.

## Provider Budget

Provider calls made by this module: `0`.

The next provider-backed step, if needed, should hydrate cached player stats only after Priority 1 lifecycle work is safe. Bulk historical imports still require explicit approval.

