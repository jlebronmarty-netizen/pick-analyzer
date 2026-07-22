# MLB Pregame Starter Evidence V1

This module unlocks live pitcher-outs shadow readiness by storing timestamp-safe MLB starting-pitcher evidence before game start.

## Source

- Selected source: SportsDataIO Discovery Lab `GamesByDate`.
- Endpoint: `/api/mlb/odds/json/GamesByDate/{date}`.
- Starter fields: `AwayTeamProbablePitcherID`, `HomeTeamProbablePitcherID`, `AwayTeamStartingPitcherID`, `HomeTeamStartingPitcherID`, `AwayTeamStartingPitcher`, `HomeTeamStartingPitcher`, `AwayTeamOpener`, `HomeTeamOpener`.
- Provider calls: zero for reads; one bounded call only when protected refresh is explicitly run with `refreshProvider=true`, `confirmed=true` and `dryRun=false`.

## Storage

Starter evidence uses existing `sport_lineups` rows:

- `lineup_type='starting_lineup'`
- `role='starting_pitcher'`
- `position='P'`
- `starter=true`
- `lineup_status='confirmed'` or `probable`
- `confirmation_level='confirmed'` for confirmed and `expected` for probable, matching the existing check constraint

Precise status, source timestamp, evidence age, source, provider, eligibility and rejection codes are stored in `metadata`.

## Eligibility

Live shadow eligibility requires:

- exact canonical event
- exact SportsDataIO provider game ID
- exact canonical player identity through `provider_entity_mappings` or `sport_players.provider_ids`
- source timestamp before event start
- `CONFIRMED` or `PROBABLE` status
- fresh evidence by policy
- no team assignment conflict

Final-only starter identity is never treated as pregame evidence.

## Output Policy

All generated pitcher-outs outputs remain `SHADOW / NO_MARKET`. The system does not create Official Picks, EV, edge, Kelly or stake from starter evidence.
