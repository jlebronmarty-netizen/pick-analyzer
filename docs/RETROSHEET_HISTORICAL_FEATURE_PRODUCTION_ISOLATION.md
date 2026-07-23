# Retrosheet Historical Feature Production Isolation

Date: 2026-07-23

Status: DRY_RUN/PREVIEW PASS. Persisted-row isolation blocked until import executes.

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

The full production import was not executed because approval review rejected the protected write command before mutation.

No Prediction Engine, Learning Brain, Current Board, Official Pick, market, settlement, live Performance or universal projection rows were intentionally changed.
