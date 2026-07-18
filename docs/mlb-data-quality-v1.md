# MLB Data Quality V1

## Route

`GET /api/mlb/data-quality?date=2026-07-17&includeValidation=true`

The route is read-only and makes zero provider calls.

## Current 2026-07-17 Coverage

- scheduled games: 15
- odds-ready games: 15
- feature-ready games: 15
- prediction-ready games: 15
- Current Board candidates: environment-dependent current preview count
- official picks: 0

Critical input coverage:

- starting pitchers: 0/15
- lineups: 0/15
- injuries: 0/15
- weather: 15/15 for verified forecast low/high/description only
- bullpen context: 0/15
- projections: 0/15

Stored GamesByDate payload audit:

- raw payload retained: no
- starter fields with retained values: not verified; prior sanitizer omitted documented starter fields
- weather fields verified populated: `ForecastTempLow`, `ForecastTempHigh`, `ForecastDescription`
- weather fields documented not yet verified: `ForecastWindChill`, `ForecastWindSpeed`, `ForecastWindDirection`
- venue field verified populated: `StadiumID`
- games with starter IDs/names: 0/15 verified, inconclusive due to incomplete snapshot
- games with weather values: 15/15 for low/high/description
- games with venue values: 15/15 for `StadiumID`

Field names alone do not count as coverage. Verified sanitized values count only for the specific retained fields.

## Scoring

Current Board now canonicalizes missing MLB data from stored snapshot warnings including `missingDataWarnings`, `missingData`, `unavailableDomains` and projection unavailable domains.

Critical inputs:

- starting pitcher
- confirmed lineup
- injury diagnosis
- weather
- bullpen context

Even with partial weather verified, current candidates remain gated by missing starters, lineups, injuries, bullpen context, projections and calibration:

- featureQuality: 35
- dataSufficiency: 30
- criticalDataCompleteness: 0
- dataCompletenessLabel: `INSUFFICIENT`

This does not change model probabilities or official-pick thresholds. It makes readiness honest across surfaces.
