# NBA Trial Validation Batch V1

Last updated: 2026-07-14 15:23:35 -04:00

## Status

Completed as a bounded technical trial validation batch using existing persisted trial data only.

This is not production performance evidence, not profitability evidence, not calibration evidence and not suitable for real wagering decisions.

## Execution

- Provider calls: 0
- API routes added: 0
- API route count before/after: 205 / 205
- Snapshot batch cap: 50
- Prediction batch cap: 50
- Concurrency assumption: 1
- Retries: 0
- Production recommendations: 0
- Production-eligible predictions: 0

## Pre-Batch Audit

- Eligible trial NBA events: 14
- Completed trial events: 14
- Trial events with start times and final scores: 14
- Valid SportsDataIO trial odds rows: 540
- Moneyline odds rows: 180
- Spread odds rows: 180
- Total odds rows: 180
- Duplicate logical odds rows: 0
- Legacy non-null-line moneylines: 0
- Existing trial feature snapshots before batch: 20
- Existing linked trial predictions before batch: 5
- Existing settled linked trial predictions before batch: 5
- Unresolved SportsDataIO provider mappings in sampled audit: 0

## Snapshot Batch

The existing `POST /api/features/store` action `historical_feature_snapshot_write_pilot` was rerun with:

- `maximumEvents=9`
- `maximumMarketsPerEvent=3`
- `maximumSnapshots=50`
- `dryRun=false`
- `confirmed=true`

First run:

- Events considered: 14
- Eligible events: 9
- Eligible candidates: 27
- Snapshots inserted: 27
- Snapshots reused: 0
- Snapshots rejected: 0
- Duplicate rows after write: 0

Immediate rerun:

- Snapshots inserted: 0
- Snapshots reused: 27
- Duplicate rows after write: 0

## Prediction Batch

The existing `POST /api/features/store` action `historical_prediction_snapshot_lineage_pilot` was rerun with:

- `maximumSnapshots=50`
- `maximumPredictions=50`
- `dryRun=false`
- `confirmed=true`
- `settle=true`

First run:

- Snapshots considered: 47
- Eligible snapshots: 27
- Rejected snapshots: 20
- Rejection reason: `missing_genuine_offered_price=15`
- Predictions inserted: 22
- Predictions reused: 5
- Predictions rejected: 0
- Prediction failures: 0
- Duplicate prediction identities: 0
- Duplicate snapshot links: 0

Immediate rerun:

- Predictions inserted: 0
- Predictions reused: 27
- Predictions rejected: 0
- Prediction failures: 0

## Events And Markets

Events included:

- `basketball_nba:nba:sportsdataio:22888`
- `basketball_nba:nba:sportsdataio:22889`
- `basketball_nba:nba:sportsdataio:22890`
- `basketball_nba:nba:sportsdataio:22891`
- `basketball_nba:nba:sportsdataio:22892`
- `basketball_nba:nba:sportsdataio:22893`
- `basketball_nba:nba:sportsdataio:22894`
- `basketball_nba:nba:sportsdataio:22895`
- `basketball_nba:nba:sportsdataio:22896`

Prediction market counts:

- Moneyline: 9
- Spread: 9
- Total: 9

Feature-set counts:

- `basketball_nba_moneyline_feature_set_v1`: 9
- `basketball_nba_spread_feature_set_v1`: 9
- `basketball_nba_total_feature_set_v1`: 9

Model-version count:

- `basketball_nba_model_v1`: 27

## Settlement

First bounded settlement:

- Attempted: 22 newly inserted predictions
- Settled: 22
- Pending: 0
- Errors: 0

Final linked trial settlement state:

- Settled predictions: 27
- Wins: 9
- Losses: 18
- Pushes: 0
- Voids: 0
- Pending: 0

Immediate rerun:

- Settlement attempted: 0
- Double settlement: 0

## Technical Backtest

`GET /api/nba/predictions/backtest` returned a technical trial-only summary:

- Total rows: 27
- Settled rows: 27
- Recommended rows: 0
- Markets: moneyline, spread, total
- Win rate: 33.33%
- Trial profit: -448.93
- Trial units: -4.49
- Average offered odds: -71.48
- Average predicted probability: 59.2
- Average confidence: 48.52
- Average edge: 3.74
- Average EV: 0.26
- Brier score: 0.2896

These numbers are trial diagnostics only. Production ROI, production CLV, production calibration and model promotion remain blocked.

By market:

- Moneyline: 9 total, 4 wins, 5 losses, 0 pushes, 0 voids
- Spread: 9 total, 5 wins, 4 losses, 0 pushes, 0 voids
- Total: 9 total, 0 wins, 9 losses, 0 pushes, 0 voids

By confidence band:

- `45-49`: 18 total, 8 wins, 10 losses
- `50-54`: 9 total, 1 win, 8 losses

By data-sufficiency band:

- `80plus`: 27 total, 9 wins, 18 losses

## Data Quality

- Duplicate odds rows: 0
- Duplicate snapshot deterministic keys: 0
- Duplicate prediction identities: 0
- Duplicate snapshot links: 0
- Orphan snapshot links: 0
- Orphan prediction-event links: 0
- Invalid prices: 0
- Invalid spread/total lines: 0
- Moneyline line non-null regressions: 0
- Source timestamps after cutoff: 0
- Odds timestamps after cutoff: 0
- Feature snapshots generated after prediction: 0
- Trial/production contamination: 0
- Recommended picks: 0
- Raw secret leakage hits in audited snapshot JSON: 0

## Runtime Surfaces

Validated existing endpoints only:

- `GET /api/features/store/validation`: 200, provider calls 0
- `GET /api/historical-import/plan?sportKey=basketball_nba&season=2026`: 200, provider calls 0
- `GET /api/nba/features/preview`: 200, provider calls 0
- `GET /api/nba/predictions/backtest`: 200, provider calls 0
- `GET /api/nba/predictions/performance`: 200, provider calls 0
- `GET /api/nba/predictions/model-health`: 200, provider calls 0
- `GET /api/nba/predictions/settlement-backlog`: 200, provider calls 0
- `GET /api/settlement/core`: 200, provider calls 0
- `GET /api/nba/markets/multi-book`: 200, provider calls 0
- `GET /api/nba/markets/steam`: 200, provider calls 0

## Remaining Blockers

- Trial rows remain excluded from production recommendations, confidence improvement, ROI, CLV, calibration and model promotion.
- CLV remains blocked because no genuine later closing snapshot is linked.
- Backtest endpoint intentionally warns that the 27-row trial sample is below 30 and that historical trial rows have timestamp-risk warnings because the technical batch was generated after historical events.
- Production use requires production-eligible non-scrambled data, explicit approval, sufficient settled production samples and genuine closing snapshots.
