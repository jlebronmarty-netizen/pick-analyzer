# Retrosheet Historical Feature Production Isolation

Date: 2026-07-24

Status: PERSISTED PASS.

## Baseline Before Import

- Phase 2A prefixed historical feature snapshots: 0
- `prediction_history`: 1,327
- current-board-like MLB rows: 897
- production-eligible predictions: 0
- `universal_projection_history`: 25
- `sports_odds_snapshots`: 47,142
- `sports_sync_jobs`: 504
- `historical_import_registry`: 2
- `historical_import_checkpoints`: 30

## Isolation Contract

Generated Phase 2A snapshots are historical-only and must remain:

- `metadata.historicalOnly=true`
- `metadata.trainingEligible=false`
- `metadata.livePredictionEligible=false`
- `production_eligible=false`
- `trial=false`
- `scrambled=false`

## Execution Result

The Phase 2A persisted backfill and second-run resume certification completed through the local worker.

Final verified persisted state:

- Phase 2A scoped historical feature snapshots: 70,470
- historical games covered: 2,430
- coverage: 100%
- duplicate deterministic keys: 0
- leakage failures: 0
- provider calls: 0
- external sports API calls: 0

No Prediction Engine, Learning Brain, Current Board, Official Pick, market, settlement, live Performance or universal projection rows were intentionally changed.

Read-only production isolation probe after resume found:

- prediction_history Retrosheet game leaks: 0
- prediction_history Retrosheet snapshot leaks: 0
- prediction_history Retrosheet settlement leaks: 0
- current production-eligible MLB prediction rows: 0
- historical pregame-eligible games: 0
- historical training-eligible games: 0
- non-historical-only historical games: 0
