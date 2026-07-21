# MLB Current-Season Data Quality Certification

Certification: `MLB_CURRENT_SEASON_DATA_QUALITY_PASS`

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

## Production Certification

Production commit `cf7075126f656f723b6f73bda6553966efb8fa0e` passed the read-only audit smoke on 2026-07-21:

- Audit route success: true.
- Validation: 8/8 fixture checks passed.
- Provider calls: 0.
- Remote mutations: 0.
- Backfill status: complete, remaining dates 0, active jobs 0, ambiguous checkpoints 0.
- Player game stat rows: 44,459.
- Imported player-stat dates: 114.
- Missing player-stat dates: 0.
- Exact player identity resolution rate: 71.2%.
- Unresolved player stat rows: 12,806 across 656 provider player IDs.
- Duplicate stat row IDs: 0.
- Natural-key collision candidates: 244.
- Event mapping rate: 100%.
- Team mapping rate: 100%.
- Odds coverage: 62.69%, one book, 46,002 snapshot rows.
- Opening odds rows: 0.
- Closing odds rows: 0.
- Predictions: 909.
- Official picks: 148.
- Settled predictions: 593.
- Predictions created after game start: 612.
- Overall MLB data readiness score: 79.64, label `GOOD`.

Certification caveats:

- CLV readiness is not certified because genuine opening and closing odds rows are absent.
- Unresolved player identities remain safely preserved/reviewable and must not be resolved by fuzzy matching.
- The 244 natural-key collision candidates require review before using player game stats as high-confidence player-level production features.
