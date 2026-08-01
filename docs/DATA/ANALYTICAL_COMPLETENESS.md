# Analytical Completeness

Release 07 completes the analytical foundation by exposing canonical values that already exist in repository persistence. No history was replayed and no labels were fabricated.

| Field | Status | Canonical Basis | Notes |
| --- | --- | --- | --- |
| Opening Line | PARTIAL | `sports_odds_snapshots.line` opening or earliest aligned snapshot | Exists when stored odds snapshots are aligned to the prediction event/market/selection. |
| Closing Line | PARTIAL | latest aligned pre-start `sports_odds_snapshots.line` or explicit closing snapshot link | Coverage depends on stored snapshot cadence and settlement metadata. |
| Settlement | COMPLETE | canonical settlement helper over `prediction_history` | Settled rows resolve to win, loss, push, void, pending or blocked. |
| Learning | PARTIAL | derived settlement label plus `settlement_details.learning_evidence_v1` | Analytics can segment by label, but no universal first-class column exists. |
| Feature Snapshot | PARTIAL | `feature_snapshot_id`, `feature_set_version`, `feature_snapshot` | Coverage is strongest on newer rows. |
| EV | COMPLETE | `prediction_history.ev` | Complete where the prediction row stored EV. |
| Edge | COMPLETE | `prediction_history.edge` | Complete where the prediction row stored edge. |
| Weather | PARTIAL | `prediction_history.feature_snapshot.weather_context` | Available only when compact feature metadata includes weather. |
| Park | PARTIAL | `prediction_history.feature_snapshot.park_context` or stadium context | Available only when compact feature metadata includes park/stadium context. |
| Starter | PARTIAL | `prediction_history.feature_snapshot.starter_context` | Available only when compact feature metadata includes starter context. |
| Market | COMPLETE | `prediction_history.market` | Production segment rows expose moneyline, spread and total where present. |

## API Completion

`/api/model/segments` now exposes:

- opening line, opening price and opening snapshot id
- closing line, closing price and closing snapshot id
- edge and expected value
- learning label
- model version and feature version
- starter, weather, park and feature coverage flags
- canonical source metadata per row
- analytical coverage summary

`/api/model/intelligence` now exposes:

- analytical coverage percent
- canonical coverage percent
- missing and partial analytical dimensions
- duplicated analytical field list
- feature completeness
- settlement completeness
- learning completeness

All values are derived from existing persistence. Provider calls and database mutations remain zero.
