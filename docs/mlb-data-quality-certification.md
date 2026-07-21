# MLB Current-Season Data Quality Certification

Certification: pending production smoke

Date: 2026-07-21

## Scope

The MLB current-season data-quality audit measures stored 2026 MLB data only. It performs no provider calls, no database mutations, no prediction regeneration, no recommendation changes, no settlement changes and no dashboard behavior changes.

## Route

- `GET /api/mlb/current-season/data-quality?season=2026`
- `GET /api/mlb/current-season/data-quality?season=2026&includeValidation=true`

## Audited Domains

The audit covers teams, players, schedules/events, results, standings, team statistics, player game statistics, odds snapshots, prediction records, official picks, settlement status, feature snapshots, provider mappings, historical import jobs and checkpoint coverage.

## Player Game Stats

The audit reports expected completed MLB dates, imported dates, missing dates, represented events, rows per date, unique players per date, exact identity resolution rate, provisional identity rate, unresolved identity rate, duplicate stat rate, event mapping rate, team mapping rate, production-feature exclusions and reconciliation backlog.

Unresolved player rows remain allowed only when provider identity is preserved and the row is observable/reviewable. The audit does not use fuzzy matching and does not fabricate player identity.

## Odds And CLV

The odds section reports event coverage, books, snapshot density, opening rows, closing rows, moneyline rows, run-line/spread rows, totals rows, stale/latest snapshot evidence, events without markets and market rows without events.

The audit does not claim CLV readiness unless genuine opening and closing rows exist.

## Prediction And Settlement

The prediction section reports generated predictions, official picks, settled and pending predictions, duplicate prediction keys, predictions created after game start, missing result linkage, settlement coverage, calibration availability, backtesting readiness and sample size by market.

## Scoring

Scores are transparent and intentionally conservative:

- ingestion completeness
- identity completeness
- event mapping
- team mapping
- odds coverage
- settlement coverage
- feature readiness
- backtesting readiness
- overall MLB data readiness

Low scores are reported as low scores. Provider-unavailable domains remain caveats rather than fabricated completeness.
