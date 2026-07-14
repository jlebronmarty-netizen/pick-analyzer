# SportsDataIO Historical Import Execution Readiness V1

Status: Completed for execution architecture and deterministic validation.

Completion labels:

- `EXECUTION_ARCHITECTURE_COMPLETE`
- `DETERMINISTIC_VALIDATION_COMPLETE`
- `LIVE_PROVIDER_VALIDATION_COMPLETE`
- `PILOT_IMPORT_COMPLETE_FOR_APPROVED_TRIAL_SCOPE`

## Objective

SportsDataIO Historical Import Execution Readiness V1 prepared the project for capped SportsDataIO historical import execution with strict dry-run defaults and live-execution guardrails.

The module is not Historical Reconciliation Phase B. The only live import currently approved and completed is NBA Pilot Import V1 for the trial/scrambled `2025-DEC-25` NBA date.

## Implementation

- Runtime adapter: `src/services/sportsdataio-runtime-adapter.service.ts`
- Execution readiness service: `src/services/sportsdataio-historical-import-readiness.service.ts`
- Dashboard integration: `src/components/dashboard/HistoricalImportEnginePanel.tsx`

APIs:

- `GET /api/providers/sportsdataio/status`
- `GET /api/providers/sportsdataio/capabilities`
- `GET /api/providers/sportsdataio/execution-readiness/validation`
- `POST /api/historical-import/execute`
- `POST /api/historical-import/resume`
- `POST /api/historical-import/cancel`
- `GET /api/historical-import/jobs/[jobId]`
- `POST /api/historical-import/pilot-plan`
- `POST /api/historical-import/validate/[jobId]`

## Guardrails

Execution defaults to `dryRun=true` and `maximumRequests=0`.

Non-dry-run requests are rejected unless they exactly match the approved capped NBA pilot shape:

- `confirmed=true`
- `provider=sportsdataio`
- a sport and league
- a season or date range
- requested domains
- a positive request cap

This preserves the execution contract while preventing accidental live imports before explicit approval. Broader provider-backed reconciliation remains blocked.

For SportsDataIO NBA requests, non-dry-run validation also reads the aggregate NBA readiness guardrails before any provider transport can start:

- `providerExecutionGate`
- `externalBlockerResolutionChecklist`
- `productionUsageExclusionAudit`

While external blockers remain open, the execution planner returns all three summaries in `guardrails`, reports `providerCallsAllowedNow=0` and `providerCallsAllowedBeforeResolution=0`, confirms prediction persistence/backtesting/model training/confidence lift remain disabled for trial-only rows, and rejects the request before dispatching a provider call.

## Supported Import Domains

The readiness contract covers:

- leagues
- teams
- schedules
- completed games
- scores
- standings
- team stats
- game stats
- players
- player stats
- injuries
- lineups
- odds
- historical odds

Each domain declares destination tables or future persistence boundaries, natural keys, dependency order, expected pagination and quota warnings.

## Normalization Boundary

SportsDataIO payloads remain isolated inside provider adapter and normalizer code. Sport prediction engines consume normalized events, teams, players, injuries, lineups, odds and feature snapshots only.

No provider-specific payload dependency is introduced into sport engines.

## Persistence Plan

Readiness V1 uses existing persistence targets only:

- `sports_teams`
- `sport_events`
- `sport_standings`
- `sport_game_stats`
- `sport_players`
- `sport_injuries`
- `sports_odds_snapshots`
- `provider_entity_mappings`
- `sports_sync_jobs`

No migration is required for V1. NBA Pilot Import V1 writes job metadata into `sports_sync_jobs` using existing fields.

## Deterministic Validation

Validation checks:

- missing-key behavior remains safe
- runtime adapter remains disabled
- capabilities resolve
- local fixture events normalize
- local fixture odds normalize
- local fixture players normalize
- 429 retry metadata is present
- 5xx retry metadata is retryable
- no external provider calls are made
- no secret value is returned
- dry-run plans use zero provider calls
- uncapped/non-confirmed live execution is rejected
- live-shaped SportsDataIO NBA execution is rejected by the aggregate provider execution gate before provider transport while the gate is closed
- live-shaped SportsDataIO NBA execution is rejected by the external blocker resolution checklist before provider transport while blocker evidence is missing
- live-shaped SportsDataIO NBA execution exposes production-usage exclusion guardrails before provider transport
- one-to-many provider payload expansion reports nonnegative skipped counters
- pilot plan is capped
- dependency graph is present
- persistence plan targets existing tables
- validation no-op is safe

Deterministic fixtures are explicitly non-production data.

`GET /api/providers/sportsdataio/execution-readiness/validation` exposes this deterministic validation packet directly. It is read-only, makes zero provider calls, performs no mutations and does not dispatch the historical import execution route.

`HistoricalImportEnginePanel` now displays the same validation packet beside the import planning and NBA handoff controls. The card shows pass counts, zero-call accounting, provider execution gate status, external blocker resolution status, production usage exclusion status, live-shaped rejection before provider transport and the 39 provider records -> 758 normalized rows counter fixture with `recordsSkipped=0`.

## Future Activation Beyond The Pilot

A future non-pilot import must be a separate approved module with:

- real credentials configured server-side
- explicit provider quota approval
- a small sport/date window
- `dryRun=false`
- `confirmed=true`
- positive `maximumRequests`
- hard request cap not exceeding the documented limit
- post-import data quality validation
- immediate stop on 401, 403, 429, FK mismatch or provider mapping conflict

Recommended next pilot:

- sport: `basketball_nba`
- league: `nba`
- date range: one provider-supported completed-game day
- domains: teams, schedules, scores
- maximum requests: 3
- concurrency: 1
- request delay: 2500ms

## First NBA Live Pilot Attempt

Date: 2026-07-12.

Selected pilot date: `2025-12-25`.

Provider date format used for SportsDataIO date endpoints: `2025-DEC-25`.

Configured endpoints:

- `GET https://api.sportsdata.io/v3/nba/scores/json/Teams`
- `GET https://api.sportsdata.io/v3/nba/scores/json/GamesByDate/2025-DEC-25`
- `GET https://api.sportsdata.io/v3/nba/scores/json/ScoresByDate/2025-DEC-25`

Outcome:

- Dry-run plan was valid.
- Estimated calls: 3.
- Maximum request cap: 4.
- Live pilot stopped on `GamesByDate` with HTTP `401`.
- `ScoresByDate` was not called.
- No teams, mappings or events were persisted by this pilot because persistence occurs only after all capped provider payloads pass status and shape validation.
- No odds, injuries, lineups, props, play-by-play or player stats were requested.
- No production predictions were generated.

External calls used in this pilot run:

- `Teams`: HTTP `200`
- `GamesByDate/2025-DEC-25`: HTTP `401`
- Total calls used: 2.

Finding:

The NBA key authenticated successfully for the `Teams` feed, but did not authorize the `GamesByDate` feed for the selected historical date. This is a provider access or entitlement blocker for schedule/event import. The adapter should keep live schedule and score import blocked until feed entitlement is confirmed.

Implementation hardening added after the pilot:

- Failed pilot observability now maps non-UUID idempotency plan IDs into UUID `sports_sync_jobs.id` values and stores the original plan ID in metadata.

## NBA Pilot Import V1

Date: 2026-07-13.

Selected pilot date: `2025-12-25`.

Provider date format used for SportsDataIO date endpoints: `2025-DEC-25`.

Configured cap:

- `maximumRequests=3`
- `maximumRecords=100`
- `batchSizeDays=1`
- `concurrencyLimit=1`
- `dryRun=false`
- `confirmed=true`

Endpoints:

- `GET /v3/nba/scores/json/Teams`: HTTP `200`, 30 records
- `GET /v3/nba/scores/json/GamesByDate/2025-DEC-25`: HTTP `200`, 5 records
- `GET /v3/nba/scores/json/ScoresByDate/2025-DEC-25`: skipped because `GamesByDate` included normalized final scores

External calls used: 2.

Persistence result:

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

Trial/scrambled isolation:

- Provider mappings and pilot events include `source=sportsdataio`, `trial=true`, `scrambled=true` and `production_eligible=false`.
- Existing team rows are reused when names or abbreviations match; SportsDataIO pilot provenance is stored under `metadata.sportsdataioPilotV1`.
- NBA prediction generation filters trial/non-production events.
- NBA prediction validation rejects candidates tied to trial/non-production events.

Post-import validation:

- No duplicate teams.
- No duplicate events.
- All imported events link to valid teams.
- SportsDataIO provider IDs persisted.
- Final scores present for completed imported events.
- Provider mappings remain one-to-one.
- Trial records are not eligible for production prediction, backtesting, calibration or model training.

Full pilot notes are in `docs/sportsdataio-nba-pilot-import-v1.md`.

## NBA Pilot Import V2

V2 is complete for the approved trial/scrambled scope.

The verification rerun for `2025-DEC-26` used 4 external calls across GamesByDate, standings, team season stats and team game stats. It persisted trial-isolated events, standings, team season stats and 18 game-stat rows, completed the latest sync job and preserved stable upsert keys without duplicate rows. The importer guards integer-only columns with integer-safe normalization.

A future Pilot V3 should use one additional completed provider-supported date and remain capped until explicit broader reconciliation approval exists.

Detailed notes are in `docs/sportsdataio-nba-pilot-import-v2.md`.

## NBA Injuries Pilot V1

NBA Injuries Pilot V1 is complete for the approved trial/scrambled scope.

The successful execution called `GET /v3/nba/projections/json/InjuredPlayers` once, fetched 6 records, normalized 6 injuries, inserted 6 `sport_injuries` rows and inserted 6 injury provider mappings. Two player references and two team references did not resolve to existing normalized rows and were preserved with null foreign keys plus validation warnings.

Imported records are marked `source=sportsdataio`, `trial=true`, `scrambled=true`, `production_eligible=false` and `importModule=sportsdataio_nba_injuries_pilot_v1`.

The pilot does not unlock production confidence, real ROI, real calibration, model training or betting recommendations. The earlier `/v3/nba/scores/json/Injuries` HTTP 404 probe is historical evidence only.

Detailed notes are in `docs/sportsdataio-nba-injuries-pilot-v1.md`.

## NBA Players Pilot V1

NBA Players Pilot V1 is complete for the approved trial/scrambled roster scope.

The successful execution called `GET /v3/nba/scores/json/Players` once, fetched 579 records, normalized 579 players, inserted 579 `sport_players` rows and inserted 579 player provider mappings. Imported records are marked `source=sportsdataio`, `trial=true`, `scrambled=true`, `production_eligible=false` and `importModule=sportsdataio_nba_players_pilot_v1`.

The pilot does not unlock production player intelligence, player props, real calibration, model training or betting recommendations. It validates only the roster identity and mapping persistence path.

The import service now chunks large existing-ID and provider-mapping preflight reads before upsert. This avoids oversized Supabase `.in()` requests without changing conflict targets or requiring a migration.

Detailed notes are in `docs/sportsdataio-nba-players-pilot-v1.md`.
