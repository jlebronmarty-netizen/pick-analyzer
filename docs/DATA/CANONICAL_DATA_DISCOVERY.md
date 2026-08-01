# Canonical Data Discovery

Release 07 reviewed the repository for analytical fields required by evidence-based optimization. The golden rule is one canonical source per analytical field, with duplicates documented but not removed.

| Analytical Field | Status | Canonical Source | Persistence | Current Consumers | API Exposure | Missing Links |
| --- | --- | --- | --- | --- | --- | --- |
| Opening Line | Partial | `sports_odds_snapshots.line` where `is_opening=true`; fallback earliest aligned snapshot | `sports_odds_snapshots` | Historical feature generation, closing-line intelligence, Release 07 segment engine | `/api/model/segments`, `/api/model/intelligence` | Not every prediction has an aligned opening snapshot. |
| Closing Line | Partial | `sports_odds_snapshots.line` latest aligned pre-start snapshot; `settlement_details.closingSnapshotId` when present | `sports_odds_snapshots`, `prediction_history.settlement_details` | Closing-line intelligence, historical feature generation, Release 07 segment engine | `/api/model/segments`, `/api/model/intelligence` | Not every settlement row has a closing snapshot link. |
| Closing Odds Snapshot | Partial | `prediction_history.odds_snapshot_id` for prediction-time odds and `settlement_details.closingSnapshotId` for closing candidate | `prediction_history`, `sports_odds_snapshots` | Closing-line intelligence, stored preview lifecycle | `/api/model/segments` | Closing snapshot is not first-class on every historical row. |
| Final Settlement | Complete | `prediction_history.result`, `status`, `lifecycle_status`, and `settlement_details.settlement_reconciliation_v2` interpreted by canonical settlement helpers | `prediction_history` | Settlement guarantee, performance, dashboard, model segments | `/api/model/segments`, `/api/performance` | None for settled rows; pending rows remain intentionally pending or blocked. |
| Learning Label | Derivable | Canonical settlement outcome derived from `prediction_history` and `settlement_details.learning_evidence_v1` when present | `prediction_history.settlement_details` | Learning lifecycle, scheduler coverage, Release 07 segment engine | `/api/model/segments`, `/api/model/intelligence` | No universal first-class `learning_label` column. |
| Feature Snapshot | Partial | `prediction_history.feature_snapshot_id`, `feature_set_version`, `feature_snapshot`; historical detail in `historical_feature_snapshots` | `prediction_history`, `historical_feature_snapshots` | Historical feature generation, prediction history, model segments | `/api/model/segments`, `/api/model/intelligence` | Some production rows have compact or missing embedded metadata. |
| Model Version | Complete | `prediction_history.model_version` | `prediction_history` | Prediction history, model status, performance, model segments | `/api/model/segments`, `/api/model/intelligence` | Legacy rows can be null. |
| Feature Version | Partial | `prediction_history.feature_set_version` | `prediction_history` | Prediction history, historical feature snapshots, model segments | `/api/model/segments`, `/api/model/intelligence` | Legacy rows can be null. |
| EV | Complete where stored | `prediction_history.ev` | `prediction_history` | Current board, parlay generator, pattern discovery, model segments | `/api/model/segments` | Some older rows may be null. |
| Edge | Complete where stored | `prediction_history.edge` | `prediction_history` | Current board, parlay generator, pattern discovery, model segments | `/api/model/segments` | Some older rows may be null. |
| Probability | Complete | `prediction_history.model_probability` | `prediction_history` | Performance, dashboards, model segments | `/api/model/segments`, `/api/performance` | None for eligible model rows. |
| Confidence | Complete | `prediction_history.confidence` | `prediction_history` | Performance, dashboards, model segments | `/api/model/segments`, `/api/performance` | None for eligible model rows. |

## Canonical Mapping

| Analytical Field | Canonical Source | Current API | Current Consumer | Missing |
| --- | --- | --- | --- | --- |
| Opening Line | `sports_odds_snapshots.line` | `/api/model/segments` | Segment analytics | Coverage is partial. |
| Closing Line | `sports_odds_snapshots.line` latest aligned pre-start | `/api/model/segments` | Segment analytics, CLV intelligence | Coverage is partial. |
| Closing Odds Snapshot | `settlement_details.closingSnapshotId` or aligned `sports_odds_snapshots.id` | `/api/model/segments` | Segment analytics | Link is partial. |
| Final Settlement | Canonical settlement helper over `prediction_history` | `/api/model/segments` | Performance, learning evidence | Complete for settled rows. |
| Learning Label | Derived canonical settlement outcome | `/api/model/segments` | Segment analytics | First-class column missing. |
| Feature Snapshot | `prediction_history.feature_snapshot*` | `/api/model/segments` | Segment analytics | Some rows compact/missing. |
| Model Version | `prediction_history.model_version` | `/api/model/segments` | Segment analytics | Legacy nulls only. |
| Feature Version | `prediction_history.feature_set_version` | `/api/model/segments` | Segment analytics | Legacy nulls. |
| EV | `prediction_history.ev` | `/api/model/segments` | Segment analytics | Null older rows. |
| Edge | `prediction_history.edge` | `/api/model/segments` | Segment analytics | Null older rows. |
| Probability | `prediction_history.model_probability` | `/api/model/segments` | Segment analytics | None for eligible rows. |
| Confidence | `prediction_history.confidence` | `/api/model/segments` | Segment analytics | None for eligible rows. |

No Release 07 database migration is required because every allowed field either already exists or is derivable from canonical persisted rows.
