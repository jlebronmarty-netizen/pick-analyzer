# Duplicate Source Analysis

Release 07 detected duplicate or overlapping analytical sources. No duplicate was removed in this release.

| Field | Primary Canonical Source | Duplicate Or Overlap | Classification | Action |
| --- | --- | --- | --- | --- |
| Prediction odds | `prediction_history.odds` | `sports_odds_snapshots.price` | Intentional denormalization | Preserve; use snapshot when linked, row value as prediction-time fallback. |
| Market line | `prediction_history.line` | `sports_odds_snapshots.line`, embedded `feature_snapshot.openingLine/closingLine` | Overlapping analytical evidence | Preserve; segment API exposes canonical snapshot-backed opening/closing when available. |
| Feature snapshot | `prediction_history.feature_snapshot_id` | `prediction_history.feature_snapshot`, `historical_feature_snapshots.feature_values` | Compact plus detailed lineage | Preserve; use row-level compact context for production analytics. |
| Settlement | `prediction_history.result/status` | `settlement_details.settlement_reconciliation_v2` | Compatibility representation | Preserve; canonical helper resolves final outcome. |
| Learning label | Derived settlement label | `settlement_details.learning_evidence_v1` | Derived plus evidence detail | Preserve; segment API exposes derived canonical label. |
| Closing snapshot | `settlement_details.closingSnapshotId` | latest aligned pre-start `sports_odds_snapshots` | Link plus derivable candidate | Preserve; explicit link wins when present. |

## Duplicate APIs

`/api/closing-line/intelligence` remains the detailed CLV workflow. `/api/model/segments` is the aggregate model-intelligence surface. They share persisted inputs but do not duplicate provider calls or write behavior.

## Duplicate Persistence

No second source of truth was added. Release 07 only reads:

- `prediction_history`
- `sport_events`
- `sports_odds_snapshots`

Provider calls: 0.

Database mutations: 0.
