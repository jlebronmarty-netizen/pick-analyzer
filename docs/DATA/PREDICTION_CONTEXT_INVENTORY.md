# Prediction Context Inventory V1

Status: RELEASE 06 DATA INTELLIGENCE FOUNDATION

Source: repository schema migrations, `prediction_history` consumers, `performance_scope_v2`, Current Board, settlement guarantee, and the new read-only segment engine.

Release 06 did not replay history, fabricate predictions, create retrospective labels, change prediction formulas, change Official Pick thresholds, modify provider contracts, modify settlement rules or change scheduler behavior.

## Persisted Prediction Fields

| Field | Analytical Dimension | Status |
| --- | --- | --- |
| `id` | Prediction identity | Available |
| `sport_key` | Sport | Available |
| `game_id` | Event | Available |
| `commence_time` | Event date fallback | Available |
| `home_team` | Home team fallback | Available |
| `away_team` | Away team fallback | Available |
| `team` | Selected side | Available |
| `opponent` | Opponent/display context | Available |
| `market` | Market | Available |
| `sportsbook` | Price source label | Available |
| `odds` | American price | Available |
| `implied_probability` | Market implied probability | Available |
| `model_probability` | Prediction probability | Available |
| `confidence` | Confidence | Available |
| `edge` | Implied edge | Available |
| `ev` | Expected value | Available when stored |
| `line` | Market line | Available |
| `result` | Settlement result | Available |
| `status` | Prediction state | Available |
| `lifecycle_status` | Lifecycle state | Available |
| `recommended_pick` | Official Pick marker | Available |
| `production_eligible` | Production recommendation eligibility | Available |
| `trial` | Trial isolation | Available |
| `scrambled` | Provider trial/scrambled isolation | Available |
| `validation_status` | Prediction source/status | Available |
| `validation_warnings` | Quality warnings | Available |
| `model_role` | Champion/shadow role | Available |
| `model_version` | Model version | Available |
| `feature_snapshot_id` | Feature snapshot link | Available |
| `feature_set_version` | Feature version | Available |
| `feature_snapshot` | Embedded feature metadata | Available when populated |
| `odds_snapshot_id` | Odds snapshot link | Available |
| `operating_day_id` | Scheduler/operating-day link | Available |
| `idempotency_key` | Duplicate protection | Available |
| `generated_at` | Generation timestamp | Available |
| `cutoff_at` | Pregame cutoff | Available |
| `created_at` | Persistence timestamp | Available |
| `settled_at` | Settlement timestamp | Available |
| `settlement_details` | Settlement metadata | Available |
| `is_current` | Current/superseded state | Available |

## Joined Event Fields

| Field | Source | Analytical Dimension |
| --- | --- | --- |
| `league_key` | `sport_events` | League |
| `season` | `sport_events` | Season |
| `start_time` | `sport_events` | Canonical event date |
| `status` | `sport_events` | Event lifecycle |
| `home_team` | `sport_events` | Home team |
| `away_team` | `sport_events` | Away team |
| `home_score` / `away_score` | `sport_events` | Outcome context |

## Derived Dimensions Now Available

| Dimension | Derivation |
| --- | --- |
| Home/Away flag | Selected team compared to event home/away team. |
| Favorite/Underdog | Negative American odds classify as favorite; positive odds classify as underdog. |
| Probability bucket | Deterministic buckets: `<50`, `50-55`, `55-60`, `60-65`, `65-70`, `70-75`, `75+`. |
| Confidence bucket | Deterministic buckets: Very Low, Low, Medium, High, Very High. |
| Prediction source | Official markers first, then model role or validation status. |
| Feature coverage | Presence of embedded feature snapshot domains. |
| Settlement result | Canonical stored outcome. |

## Missing Or Partial Dimensions

| Dimension | Status | Next Step |
| --- | --- | --- |
| Opening line | Only available if embedded in snapshot metadata. | Normalize into future analytical export when already stored. |
| Closing line | Only available if embedded in snapshot or settlement metadata. | Add read-only extraction from stored closing-line artifacts if present. |
| Closing result | Not consistently stored as first-class row field. | Add explicit stored closing-line outcome only after source contract is proven. |
| Feature contribution values | Snapshot metadata exists, but not all rows expose normalized feature values. | Add versioned compact feature-summary persistence in a later release. |
| Learning label | Settlement and learning services derive labels, but not every prediction exposes a first-class learning-label field. | Add read-only label view before any write-path change. |

