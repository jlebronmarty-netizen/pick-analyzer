# SportsDataIO NBA Players Pilot V1

Last updated: 2026-07-13 11:39:51 -04:00

## Status

Completed for the approved capped trial/scrambled scope.

This pilot validated the SportsDataIO NBA `Players` feed through the existing guarded historical import execution path. It persisted player identity and provider mapping records only. It did not import odds, injuries, lineups, props, player game stats, play-by-play, recommendations, calibration data or training data.

## Scope

Objective:

- Validate the real-provider NBA player import path with a capped live request.
- Normalize players into existing `sport_players`.
- Create one-to-one SportsDataIO player mappings in `provider_entity_mappings`.
- Preserve team relationships through existing normalized NBA teams.
- Keep imported records isolated as trial/scrambled and non-production.

Explicitly excluded:

- Production predictions
- Real ROI
- Historical accuracy claims
- Model training
- Real calibration
- Player props
- Injury persistence
- Lineup persistence
- Player game stats
- Play-by-play

## Execution

Configured cap:

- `provider=sportsdataio`
- `sportKey=basketball_nba`
- `leagueKey=nba`
- `season=2026`
- `domains=players`
- `dryRun=false`
- `confirmed=true`
- `maximumRequests=4`
- `maximumRecords=700`
- `batchSizeDays=1`
- `concurrencyLimit=1`

Endpoint:

- `GET /v3/nba/scores/json/Players`: HTTP `200`, 579 records

External calls used for the successful import execution: `1`.

Additional calls in the same autonomous session:

- One prior entitlement/shape probe to `GET /v3/nba/scores/json/Players`: HTTP `200`, 579 records.
- Two failed execution attempts reached the provider before a Supabase preflight chunking fix.
- One injury entitlement probe to `GET /v3/nba/scores/json/Injuries`: HTTP `404`.

No secret value was printed, logged, documented or returned.

## Persistence Result

- Records fetched: 579
- Records normalized: 579
- Players inserted: 579
- Players updated: 0
- Player mappings inserted: 579
- Player mappings updated: 0
- Records skipped: 0
- Record-level errors: 0

Tables populated:

- `sport_players`
- `provider_entity_mappings`
- `sports_sync_jobs`

No migration was required.

## Isolation Rules

Every imported player and mapping is marked with trial-isolation metadata:

- `source=sportsdataio`
- `trial=true`
- `scrambled=true`
- `production_eligible=false`
- `importModule=sportsdataio_nba_players_pilot_v1`

The imported data is trial/scrambled provider data. It must not be used for real ROI, accuracy validation, model training, calibration, betting recommendations or production player intelligence.

## Validation

Post-import validation passed:

- No duplicate normalized player IDs.
- No duplicate SportsDataIO player provider IDs.
- SportsDataIO provider IDs persisted.
- Team relationships resolved against existing NBA teams.
- Unresolved players preserved count: 0.
- Active status is available.
- Positions are preserved where available.
- Provider mapping conflicts: 0.
- Trial isolation preserved for imported players and player mappings.
- Production prediction eligibility: false.
- Production backtesting eligibility: false.

NBA data-quality audit after the pilot:

- Overall status: `warning`.
- Total issues: 5.
- By severity: info 2, warning 3, error 0, critical 0.
- Teams coverage: 100%.
- Events coverage: 100%.
- Completed games coverage: 100%.
- Game-stat coverage: 69.23%.
- Standings coverage: 100%.
- Odds snapshots: 0.
- Provider mappings: 653.

Feature preview:

- External provider calls: 0.
- Preview remains fixture-only.
- `injury_context` and `lineup_context` remain optional unavailable features with warnings.
- No recommendations were persisted.

Prediction health:

- Status: `degraded`.
- Production prediction data still excludes trial/non-production events.
- No upcoming production NBA events are available for prediction generation.

## Runtime Fix

The first live execution exposed a Supabase preflight limitation when checking hundreds of player IDs in a single `.in()` query. The import service now chunks existing-ID and provider-mapping preflight reads before upsert. This is a non-migrating runtime hardening change.

## Idempotency

The successful execution performed local idempotency checks without repeating the provider call:

- Stable player upsert keys: true.
- Stable mapping keys: true.
- No duplicate player keys: true.
- No mapping conflicts: true.

Conflict targets:

- `sport_players.id`
- `provider_entity_mappings` unique tuple: `sport_key, entity_type, provider, provider_id, season`

## Recommended Next Step

SportsDataIO NBA Depth Charts / Expected Lineups Pilot V1 should remain blocked until the exact endpoint and entitlement are confirmed with a single capped probe. If the endpoint is not confirmed, continue with provider-independent lineup capability contracts and confidence penalties only.
