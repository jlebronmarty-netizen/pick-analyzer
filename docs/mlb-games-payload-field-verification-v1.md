# MLB Games Payload Field Verification V1

Date: 2026-07-17

## Scope

`GET /api/mlb/games-payload-audit?date=2026-07-17` is a read-only diagnostic route over stored Supabase evidence. It makes zero provider calls, writes no data, does not alter thresholds, does not regenerate predictions and does not change official history.

## Contract Correction

The first audit used non-contract starter names such as `AwayProbablePitcherID`, `HomeProbablePitcherID`, `AwayStartingPitcherID` and `HomeStartingPitcherID`.

The documented GamesByDate starter fields are:

- `AwayTeamProbablePitcherID`
- `HomeTeamProbablePitcherID`
- `AwayTeamStartingPitcherID`
- `HomeTeamStartingPitcherID`
- `AwayTeamStartingPitcher`
- `HomeTeamStartingPitcher`
- `AwayTeamOpener`
- `HomeTeamOpener`

Because the raw payload was not retained and the sanitized snapshot omitted those exact names, starter support is `DOCUMENTED_NOT_YET_VERIFIED`, not unsupported.

## Corrected Findings

For `2026-07-17` in `America/Puerto_Rico`, the stored slate has 15 MLB games.

Retained evidence:

- Raw GamesByDate payload retained: no.
- Sanitized verification ledger: `8845bc94-d5ac-40db-ab42-0aa8dc4f8d6b`.
- Starter fields: documented but not yet verified.
- Weather fields verified populated: `ForecastTempLow`, `ForecastTempHigh`, `ForecastDescription`.
- Weather fields documented not yet verified: `ForecastWindChill`, `ForecastWindSpeed`, `ForecastWindDirection`.
- Venue field verified populated: `StadiumID`.

Coverage counted from populated retained values:

- Games with starter IDs: 0 verified; inconclusive due to incomplete snapshot.
- Games with starter names: 0 verified; inconclusive due to incomplete snapshot.
- Games with weather values: 15 for low/high/description.
- Games with venue data: 15 for `StadiumID`.

## Normalization Decision

No starter normalizer is safe yet.

A narrow weather normalizer can be designed for `ForecastTempLow`, `ForecastTempHigh` and `ForecastDescription`. Wind fields need one corrected verification before being classified. `StadiumID` can support a narrow venue ID normalizer, while stadium names, surface, roof type and park metadata should come from the documented `Stadiums` endpoint after approval.

## Next Safe Step

If approved, make exactly one corrected authenticated verification call through:

`POST /api/mlb/provider-verification/games-by-date`

Purpose: extract exact documented starter and wind fields. Planned provider calls: 1.
