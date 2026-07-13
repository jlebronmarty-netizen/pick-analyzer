# SportsDataIO NBA Injuries Pilot V1

Last updated: 2026-07-13 15:22:53 -04:00

## Status

Completed for the approved capped trial/scrambled scope.

The live injury pilot persisted trial-isolated records from the confirmed SportsDataIO NBA projections endpoint. The earlier scores-path probe remains historical evidence only; the active endpoint is `GET /v3/nba/projections/json/InjuredPlayers`.

## Scope

Objective:

- Confirm the exact NBA injury endpoint.
- Import only a small supported payload if entitlement and payload shape are valid.
- Normalize injuries into existing `sport_injuries`.
- Preserve unknown-player records as unresolved warnings rather than fabricating player mappings.
- Keep all trial records isolated with `trial=true`, `scrambled=true` and `production_eligible=false`.

Explicitly excluded:

- Production predictions
- Real ROI
- Historical accuracy claims
- Model training
- Real calibration
- Odds
- Lineups
- Props
- Player stats
- Play-by-play

## Execution

External provider calls used for the successful import execution: `1`

Endpoint tested:

- `/v3/nba/projections/json/InjuredPlayers`

Result:

- HTTP status: `200`
- Records fetched: `6`
- Records normalized: `6`
- Injuries inserted: `6`
- Injuries updated: `0`
- Injury mappings inserted: `6`
- Injury mappings updated: `0`
- Skipped: `0`
- Record-level errors: `0`
- Unresolved players: `2`
- Unresolved teams: `2`
- Mapping conflicts: `0`

No secret value was printed, logged, documented or returned.

## Persistence

Tables used:

- `sport_injuries`
- `sport_players`
- `provider_entity_mappings`
- `sports_sync_jobs`

No migration was created.

Every imported injury and mapping is marked:

- `source=sportsdataio`
- `trial=true`
- `scrambled=true`
- `production_eligible=false`
- `importModule=sportsdataio_nba_injuries_pilot_v1`

## Validation

Post-import validation passed:

- No duplicate normalized injury IDs.
- No duplicate SportsDataIO injury provider IDs.
- Injury statuses normalized to the existing `sport_injuries` check constraint.
- Player references are valid when resolved.
- Team references are valid when resolved.
- Unknown players are preserved with `player_id=null`; count: `2`.
- Unknown teams are preserved with `team_id=null`; count: `2`.
- Provider mapping conflicts: `0`.
- Trial isolation preserved.
- Production prediction eligibility: false.
- Production backtesting eligibility: false.
- Production confidence leakage: false.

NBA data-quality audit after the pilot:

- Overall status: `warning`.
- Total issues: `5`.
- By severity: info `2`, warning `3`, error `0`, critical `0`.
- Provider mappings: `659`.

Feature preview:

- External provider calls: `0`.
- Preview remains fixture-only.
- No recommendations were persisted.

## Recommended Next Step

SportsDataIO NBA Depth Charts / Expected Lineups Pilot V1 remains blocked until the exact endpoint and entitlement are confirmed with a capped probe. Trial injury rows must not feed production recommendations, real ROI, calibration or model training.
