# SportsDataIO NBA Depth Charts And Starting Lineups Pilot V1

Last updated: 2026-07-13 16:48:00 -04:00

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

Live execution was rerun through the protected historical-import route after build and after starting the server with elevated network access. A sandboxed local server attempt failed before HTTP response with `fetch failed`; no provider HTTP status was available from that sandboxed process. The elevated capped run then reached both approved provider endpoints sequentially.

Endpoint access is confirmed, but persistence is not populated because the current normalizers produced zero persistable lineup/depth rows from the trial/scrambled provider payload shape.

Recorded result:

- provider HTTP statuses: `DepthCharts` 200, `StartingLineupsByDate/2025-DEC-26` 200
- successful provider responses: 2
- external provider calls used: 2
- records fetched: 39 total, with 30 depth-chart records and 9 starting-lineup records
- records normalized: 0
- records skipped: 39
- lineup/depth rows persisted: 0
- provider mappings inserted or updated: 0
- unresolved players: 0
- unresolved teams: 0
- unresolved events: 0
- mapping conflicts: 0
- sync job: `34b03c5b-472b-4388-829e-1ee84b55d340`, status `completed`, records fetched 39, inserted 0, updated 0, skipped 39
- secret exposure: none

## Confidence Integration

`nba-injury-lineup-confidence.service.ts` understands stored lineup/depth rows when `sport_lineups` exists. Because this run persisted zero lineup rows, missing lineups remain explicit warnings, trial-only injury rows cannot improve confidence, stale or unavailable lineup context reduces confidence and production prediction confidence remains capped.

Post-run read-only validation:

- NBA prediction health returned HTTP 200 with status `degraded`; lineup availability remains `lineup_provider_unavailable`.
- NBA feature preview returned HTTP 200 with `canImproveProductionConfidence=false`.
- NBA predictions returned HTTP 200 with `persisted=false`, `predictions=[]` and `saved=0`.
- NBA data quality returned HTTP 200 and remained dry-run only with 0 provider calls.
- Runtime observability returned HTTP 200 and counted one completed `sportsdataio_nba_depth_lineups_pilot_v1` sync job.

## Next Step

1. Inspect the observed SportsDataIO trial/scrambled depth-chart and starting-lineup payload shape from a separately approved shape-capture path that does not expose secrets.
2. Update the normalizer key extraction for depth-chart and starting-lineup payloads.
3. Rerun only after explicit approval for another capped live execution.
4. Keep `maximumRequests=2`, `concurrencyLimit=1`, no automatic retries and no prediction/backtest/training side effects.
