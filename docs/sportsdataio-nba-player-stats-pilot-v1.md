# SportsDataIO NBA Player Stats Pilot V1

Last updated: 2026-07-13 22:38:25 -04:00

## Summary

SportsDataIO NBA Player Stats Pilot V1 validated the capped trial path for normalized NBA player season and game stats.

The migration `supabase/migrations/202607130002_sport_player_stats_v1.sql` was applied remotely before execution.

## Execution

Provider calls used: 2.

Endpoints:

- `GET /v3/nba/stats/json/PlayerSeasonStats/2026` returned HTTP 200 with 602 records.
- `GET /v3/nba/stats/json/PlayerGameStatsByDate/2025-12-26` returned HTTP 200 with 316 records.

Execution constraints:

- `dryRun=false`
- `confirmed=true`
- `maximumRequests=2`
- `maximumRecords=2000`
- `concurrency=1`
- sequential requests only
- no automatic retries
- `trial=true`
- `scrambled=true`
- `production_eligible=false`

## Persistence

Rows persisted:

- `sport_player_stats`: 918 rows
- season stat rows: 602
- game stat rows: 316
- `provider_entity_mappings`: 918 `player_stat` mappings
- `sports_sync_jobs`: `777f9ac7-efeb-4396-a007-259557dfdcf8`

Counters:

- provider records fetched: 918
- normalized rows produced: 918
- records skipped: 0
- skipped provider records: 0
- skipped normalized rows: 0
- one-to-many expansion: false
- expansion ratio: 1

## Validation

Mapping and row validation:

- unresolved players: 203, preserved safely with null `player_id`
- unresolved teams: 0
- unresolved events: 0
- duplicate `sport_player_stats.id` values: 0
- duplicate provider mapping keys: 0
- trial-isolation violations: 0
- production-eligible violations: 0
- predictions referencing trial events: 0
- predictions with trial snapshots: 0

Read-only follow-up checks:

- NBA data quality status: warning
- player-stat coverage: healthy, 918 total rows
- NBA Feature Store preview: success, no leakage
- NBA Feature Store validation: success
- trial isolation status: `trial_isolation_preserved`

## Payload Shape

Sanitized payload-shape inspection ran during the live service path, but the shape metadata was not persisted because the post-persistence trial-isolation audit failed before success metadata recording. No raw provider payload was stored by design, and no provider retry was made.

Recovered safe shape facts from endpoint contracts and normalized rows:

- top-level type: array for both endpoints
- season endpoint rows normalized as `stat_type='season'`
- game endpoint rows normalized as `stat_type='game'`
- ID candidates used: `PlayerID`, `TeamID`, `GameID`, `StatID` when supplied
- season field used: `Season`
- numeric stat fields included minutes, points, rebounds, assists, steals, blocks, turnovers and shooting columns
- game rows resolved event IDs from provider game IDs when matching `sport_events` rows existed

## Safety

No production predictions were persisted. No real backtesting, calibration or model training ran. Trial player-stat rows are import-path validation data only and cannot improve production confidence.

## Post-Persistence Audit Fix

The initial service response failed after persistence because the trial-isolation audit selected `sport_game_stats.metadata`, but the deployed `sport_game_stats` table stores trial metadata in the `stats` JSON column. The audit now reads `stats` for `sport_game_stats`.

The sync job was completed from local persisted-row validation without another provider call.

## Remaining Blocker

Player-stat trial import is complete. Production use remains blocked until real-data validation, endpoint quota policy, historical windows and prediction-confidence rules are explicitly approved.

## Recommended Next Pilot

The next real functionality step is a capped SportsDataIO NBA odds pilot after exact current/historical odds endpoint paths, entitlement, sportsbook coverage and date windows are approved.
