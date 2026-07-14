# SportsDataIO NBA Depth Charts And Starting Lineups Pilot V1

Last updated: 2026-07-13 17:56:54 -04:00

## Scope

This pilot adds the guarded execution contract for SportsDataIO NBA depth charts and starting lineups while keeping trial data isolated from production recommendations.

Approved endpoints:

- `GET /v3/nba/scores/json/DepthCharts`
- `GET /v3/nba/projections/json/StartingLineupsByDate/2025-DEC-26`

Execution guardrails:

- `provider=sportsdataio`
- `sport=basketball_nba`
- `league=nba`
- `domains=["lineups"]`
- `dateFrom=dateTo=2025-12-26`
- `maximumRequests<=2`
- `maximumRecords<=1000`
- `batchSizeDays=1`
- `concurrencyLimit=1`
- `confirmed=true`
- `dryRun=false`
- predictions, backtesting and model training disabled

## Implementation State

The historical import readiness service now contains a dedicated `sportsdataio_nba_depth_lineups_pilot_v1` branch. It normalizes depth-chart player/team IDs, position, depth order, starter or bench role when derivable, active status, starting-lineup event/team/player IDs, starter status, lineup status, confirmation level, source timestamp, unresolved mapping warnings and trial metadata.

Payload Normalization V1 added:

- sanitized payload-shape summaries over field names, paths, value types, nullability and redacted examples only
- nested player-row flattening for team/game container payloads
- home/away lineup context propagation from game containers
- position-group context propagation for depth-chart structures
- broader SportsDataIO key candidates for player, team, event, position, depth, starter, status, confirmation and timestamps
- duplicate upsert-batch prevention for `sport_players`, `sport_lineups` and `provider_entity_mappings`

Existing `sport_players`, `sport_lineups`, `provider_entity_mappings` and `sports_sync_jobs` can be updated during the pilot. Event/team/player relationship rows use stable `sport_lineups.id` upsert keys and remain trial-isolated.

## Migration

The required additive migration was applied remotely and verified through Supabase REST:

- `supabase/migrations/202607130001_sport_lineups_depth_charts_v1.sql`

It creates `sport_lineups` for event/team/player lineup and depth-chart rows with lineage, provider IDs, role, starter flag, position, depth order, confirmation level and trial/scrambled/production eligibility metadata.

The service upserts normalized depth-chart and starting-lineup relationship rows with `onConflict: 'id'`.

## Trial Isolation Rules

All imported rows must carry `source=sportsdataio`, `trial=true`, `scrambled=true`, `production_eligible=false` and `importModule=sportsdataio_nba_depth_lineups_pilot_v1`.

Trial lineups can validate architecture but must not improve production confidence, create production picks, feed real backtesting, feed calibration or train models.

## Validation State

Live verification was rerun through the protected historical-import route after confirming the remote `sport_lineups` table, conflict targets, duplicate upsert-batch prevention, deterministic IDs and local process state. No duplicate local Next.js app process was listening on port 3000 before execution. The rerun used the exact approved two endpoint sequence with no automatic retries.

Recorded result:

- provider HTTP statuses: `DepthCharts` 200, `StartingLineupsByDate/2025-DEC-26` 200
- external provider calls used: 2
- records fetched: 39 top-level provider records, with 30 depth-chart records and 9 starting-lineup records
- records flattened and normalized: 758 relation rows, with 440 depth-chart rows and 318 starting-lineup rows
- players inserted/updated: 0 inserted, 439 updated
- lineups inserted/updated: 758 inserted, 0 updated
- provider mappings inserted/updated: 758 inserted, 0 updated
- skipped normalized rows: 0 effective
- unresolved players: 54
- unresolved teams: 0
- unresolved events: 0
- duplicate lineup rows: 0
- duplicate mapping keys: 0
- mapping conflicts: 0
- record errors: 0
- latest sync job: `ae45b0bd-57d9-4f58-9095-0f014781185c`, status `completed`, `externalCallsUsed=2`, `last_error=null`
- secret exposure: none

Reporting Counter Fix V1:

- root cause: the previous formula used `providerRecordsFetched - normalizedRowsProduced`, which is invalid when a smaller number of top-level provider containers expands into a larger number of normalized relation rows.
- corrected future counters for this case: `providerRecordsFetched=39`, `normalizedRowsProduced=758`, `recordsSkipped=0`, `skippedProviderRecords=0`, `skippedNormalizedRows=0`, `oneToManyExpansion=true`, `expansionRatio=19.4359`.
- persistence surface: no migration required; `sports_sync_jobs.records_skipped` remains backward-compatible and nonnegative, while richer counters are recorded in response counters and sync-job `metadata.recordCounters`.
- deterministic validation: local SportsDataIO execution readiness validation now includes the 39 -> 758 expansion fixture and confirms the corrected skipped counters with 0 provider calls.

Sanitized payload shapes:

- `depthCharts`: top-level array, 30 records, top-level fields `DepthCharts` and `TeamID`; nested array path `$[].DepthCharts` with object fields `DepthChartID`, `DepthOrder`, `Name`, `PlayerID`, `Position`, `PositionCategory`, `TeamID` and `Updated`.
- `depthCharts` field candidates: player ID from `$[].DepthCharts[*].PlayerID`, team ID from `$[].DepthCharts[*].TeamID` and `$[].TeamID`, position from `Position`/`PositionCategory`, depth order from `DepthOrder`, timestamp from `Updated`; no event, starter/bench, lineup-status or confirmation fields were supplied.
- `startingLineupsByDate`: top-level array, 9 records, top-level fields `AwayLineup`, `AwayTeam`, `AwayTeamID`, `DateTime`, `Day`, `GameID`, `HomeLineup`, `HomeTeam`, `HomeTeamID`, `Season`, `SeasonType` and `Status`; nested arrays `$[].HomeLineup` and `$[].AwayLineup`.
- `startingLineupsByDate` lineup item fields: `Confirmed`, `FirstName`, `LastName`, `LineupStatus`, `PlayerID`, `Position`, `Starting`, `Team` and `TeamID`.
- `startingLineupsByDate` field candidates: event ID from `GameID`, player ID from home/away lineup `PlayerID`, team ID from home/away lineup `TeamID` and container `HomeTeamID`/`AwayTeamID`, position from lineup `Position`, starter from `Starting`, confirmation from `Confirmed`, status from `LineupStatus`/container `Status`, timestamps from `DateTime` and `Day`.
- Trial/scrambled quirk: both payloads are accepted only as trial import-path validation data; values remain `trial=true`, `scrambled=true` and `production_eligible=false`.

## Confidence Integration

`nba-injury-lineup-confidence.service.ts` understands stored lineup/depth rows when `sport_lineups` exists. The verified pilot persisted trial-only lineup/depth rows, but they cannot improve production confidence, create production picks, feed real backtesting, feed calibration or train models.

Post-run read-only validation:

- NBA prediction health returned HTTP 200 with status `degraded`.
- NBA feature preview returned HTTP 200 and used 0 provider calls.
- NBA predictions returned HTTP 200 with `persisted=false`, `predictions=[]` and `saved=0`.
- NBA data quality returned HTTP 200 and remained dry-run only with 0 provider calls.
- Runtime observability returned HTTP 200 and used 0 provider calls.
- Runtime observability now includes a nested SportsDataIO NBA section summarizing readiness blockers, trial-isolation totals and prediction leakage counts with 0 provider calls.
- The live pilot response reported `canImproveProductionConfidence=false`, prediction persistence disabled, backtesting disabled, model training disabled, trial isolation preserved and production confidence leakage blocked.

## Next Step

The pilot is complete for the approved trial scope. Future work should either clean up flattened-row counter reporting or request a separately capped provider-backed NBA reconciliation/data coverage module.
