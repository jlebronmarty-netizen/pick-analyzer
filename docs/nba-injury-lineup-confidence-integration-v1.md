# NBA Injury and Lineup Confidence Integration V1

Last updated: 2026-07-13 15:42:25 -04:00

## Status

Completed for provider-independent architecture.

This module consumes only stored Supabase injury rows and static provider capability status. It makes zero SportsDataIO calls, does not import new data, does not persist predictions, does not run backtesting and does not train models.

## Objective

Integrate NBA injury availability and expected-lineup availability into the existing confidence, feature quality, data sufficiency, prediction explanation, safety and model-health surfaces without fabricating unavailable data.

## Sources

- `sport_injuries`: stored NBA injury records.
- `sport_players`: referenced as the lineup source table in Feature Store provenance, but no lineup records are inferred.
- SportsDataIO runtime adapter environment status: configuration state only; no live feed is called.

## Rules

- Provider unavailable is not treated as a healthy roster.
- Provider configured but empty is not treated as a healthy roster.
- Trial or scrambled injury rows may validate architecture only.
- Trial or scrambled injury rows cannot improve production confidence.
- Trial or scrambled injury rows are flagged through Feature Store values, prediction warnings, safety warnings and model health.
- Stale injury feeds reduce confidence and data sufficiency.
- Unresolved player or team mappings produce warnings.
- Unresolved high-impact statuses receive larger penalties.
- Confirmed production-eligible `out` or `inactive` statuses are supported as confidence penalties.
- Expected lineups are marked unavailable until an approved provider endpoint is confirmed.
- Missing expected lineups cannot improve confidence.

## Feature Values

`nba-injury-lineup-confidence.service.ts` emits normalized feature values for:

- injury feed status
- active injury count
- status counts
- freshness
- sample size
- reliability
- trial flags
- production eligibility
- unresolved player and team counts
- contradictory status count
- confidence penalty
- data sufficiency penalty
- lineup provider availability

These values enrich NBA Feature Store optional `injury_context` and `lineup_context` snapshots.

## Prediction Integration

NBA Prediction Engine V1 now:

- subtracts injury/lineup penalties from feature quality and data sufficiency
- passes a negative injury impact into Prediction Engine V4
- blocks recommendation promotion when injury/lineup context is trial-only, stale, unavailable or unresolved
- includes injury availability, lineup availability, confidence impact and trial-data exclusion in explanations
- writes injury/lineup warning metadata into prediction feature snapshots when candidates are built

## Safety and Health

Prediction Safety Framework V1 now warns when injury availability is missing, trial-only, unresolved or penalty-bearing.

NBA Model Health V2 now detects:

- stale injury feed
- unresolved injury player mappings
- unresolved injury team mappings
- trial-only injury coverage
- missing provider coverage
- contradictory injury statuses
- lineup provider unavailability

## Dashboard

The NBA Feature Store panel and NBA Prediction Engine panel now show:

- injury feed status
- active injury count
- unresolved player count
- unresolved team count
- freshness
- confidence penalty
- trial rows
- production eligibility
- lineup availability

## Validation

Validation performed:

- `npm.cmd run build`
- TypeScript passed.
- Next.js generated 175/175 static pages.
- Local HTTP endpoint validation was attempted against the production server on port 3055, but sandboxed HTTP could not connect and escalation was rejected by the approval layer. No external provider calls were made.

## Future Work

Phase B should wait until exact depth-chart and starting-lineup endpoints are confirmed in the SportsDataIO portal or another approved provider contract. Any provider-backed lineup import must keep trial/scrambled rows isolated until production-eligible data is available.
