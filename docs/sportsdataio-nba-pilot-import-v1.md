# SportsDataIO NBA Pilot Import V1

Status: Completed capped live pilot.

Date: 2026-07-13.

## Scope

NBA Pilot Import V1 validated the real SportsDataIO provider import path using the trial/scrambled `2025-DEC-25` schedule feed.

This pilot is not historical reconciliation Phase B, not model training, not backtesting and not betting-recommendation data. Trial rows are stored only to validate authentication, normalization, upsert keys, provider mappings, foreign keys, sync-job observability and production-data isolation.

## Approved Endpoints

- `GET /v3/nba/scores/json/Teams`
- `GET /v3/nba/scores/json/GamesByDate/2025-DEC-25`
- `GET /v3/nba/scores/json/ScoresByDate/2025-DEC-25`, conditionally only if `GamesByDate` lacks final scores

Actual calls used:

- `Teams`: HTTP `200`, 30 records
- `GamesByDate/2025-DEC-25`: HTTP `200`, 5 records
- `ScoresByDate/2025-DEC-25`: skipped because `GamesByDate` already included normalized final scores
- Total external calls: 2

No API key value was printed, returned, logged or documented.

## Import Results

- Records fetched: 35
- Records normalized: 35
- Teams inserted: 0
- Teams updated: 30
- Provider mappings inserted: 35
- Provider mappings updated: 0
- Events inserted: 5
- Events updated: 0
- Scores inserted or updated: 4
- Records skipped: 0
- Record errors: 0

Tables populated:

- `sports_teams`
- `provider_entity_mappings`
- `sport_events`
- `sports_sync_jobs`

## Trial Isolation

Imported SportsDataIO pilot records and mappings are marked with metadata:

- `source=sportsdataio`
- `trial=true`
- `scrambled=true`
- `production_eligible=false`
- `dataUse=provider_import_path_validation_only`

Existing NBA team rows are reused when names or abbreviations match, preventing duplicate team-name conflicts. For reused teams, SportsDataIO pilot provenance is stored under `metadata.sportsdataioPilotV1` while `provider_ids.sportsdataio` is added to the normalized team row.

Pilot events and provider mappings carry top-level trial metadata. NBA prediction generation filters non-production events, and NBA prediction validation rejects candidates whose event metadata is trial or `production_eligible=false`.

## Validation

Post-import validation confirmed:

- No duplicate teams
- No duplicate events
- All event team references resolve
- SportsDataIO provider IDs are persisted
- Event statuses normalize into project status values
- Final scores are present for completed imported events
- Season is `2026`
- Provider mappings are one-to-one
- Trial events are not production prediction eligible
- Trial events are not production backtesting/calibration eligible

Three imported games start on `2025-12-26` in UTC while belonging to the provider date `2025-DEC-25`; this is expected date/time normalization for late NBA games.

## Data Quality Handoff

NBA data quality after the pilot:

- Status: `warning`
- Total issues: 4
- Errors: 0
- Critical issues: 0
- Teams: 30/30
- Events: 5/5
- Completed games: 4/4
- Game stats: 0/4
- Odds snapshots: 0/5
- Provider mappings: 65 total

Known remaining gaps:

- Completed pilot games have no `sport_game_stats` rows.
- No NBA odds snapshots are persisted for these games.
- Historical event/result/odds gaps remain dry-run planning outputs.

## Idempotency

The fetched in-memory payload was reprocessed locally without another provider call.

Confirmed:

- Stable team upsert keys
- Stable event upsert keys
- Stable provider mapping keys
- No duplicate teams would be created
- No duplicate events would be created
- Provider mappings remain one-to-one

## Build

`npm.cmd run build` completed with exit code 0 after the pilot changes and generated 175 static pages.

## Next Pilot

Recommended next pilot:

- Keep maximum requests capped at 3.
- Use a single provider-supported NBA date.
- Import teams plus one schedule/results date only.
- Do not import odds, injuries, lineups, props, player stats or play-by-play.
- Keep `dryRun=false`, `confirmed=true`, `maximumRecords<=100`, `batchSizeDays=1`, `concurrencyLimit=1`.
- Continue treating trial/scrambled payloads as non-production validation data only.
