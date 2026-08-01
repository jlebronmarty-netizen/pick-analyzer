# Row-Level Segment Analysis V1

Status: RELEASE 05 READ-ONLY EXPORT

Source: production `/api/performance?diagnostics=full` on starting commit `300444109c19ec521dd9ce3f52f4c37d7f4f699c`.

This document is the Release 05 row-level segment export summary. The underlying endpoint returned 485 eligible rows from the current cutoff-safe production scope. The export did not call providers, mutate data, replay history, create retrospective labels or generate predictions.

## Row Schema

Each row-level segment record is expected to include:

| Field | Availability | Notes |
| --- | --- | --- |
| sport | Available | `historyRows[].sport` |
| league | Not exposed in current public history row | Must be added to future read-only export from stored row fields. |
| market | Derived from display prediction text | Reliable for moneyline, spread/run-line and total; should become explicit in Release 06. |
| event date | Available | `timestamp` or event date projection |
| home/away | Not exposed in current public history row | Do not infer from display text. |
| favorite/underdog | Not exposed in current public history row | Requires stored odds and selection side fields. |
| implied probability | Not exposed in current public history row | Available elsewhere in source table but not in this contract. |
| predicted probability | Available | `probability` |
| confidence | Available | `confidence` |
| prediction source | Available | `category` |
| edge | Not exposed in current public history row | Requires stored row-level export. |
| expected value | Not exposed in current public history row | Requires stored row-level export. |
| closing result | Not available | Closing-line result requires a dedicated stored field. |
| settlement result | Available | `result` |
| push/void state | Available | `result` values include push/void handling. |

## Current Production Sample

| Metric | Value |
| --- | ---: |
| Rows returned | 485 |
| Rows read by performance scope | 2,718 |
| Scored rows | 479 |
| Wins | 239 |
| Losses | 240 |
| Pushes | 6 |
| Accuracy | 49.90% |
| Brier Score | 0.2598 |
| Average predicted probability | 38.06% |
| Average confidence | 42.48 |
| Aggregate calibration error | -11.84 percentage points |
| Provider calls during export | 0 |
| Remote mutations during export | 0 |

Certification counters: `providerCallsMade: 0`, `remoteMutationsMade: 0`.

## Segment Export Limitation

The current public diagnostics contract is enough for safe model-quality documentation, but not enough for a runtime calibration patch. Release 05 therefore does not implement a probability, confidence or market adjustment. A statistically meaningful optimization requires explicit normalized row fields for league, market, side, home/away, favorite/underdog, implied probability, edge and expected value.

## Release 06 Data Contract Need

Add a read-only internal segment export backed by stored `prediction_history` fields:

`sport_key`, `league_key`, `market`, `commence_time`, `team`, `home_team`, `away_team`, `odds`, `implied_probability`, `model_probability`, `confidence`, `edge`, `ev`, `model_role`, `validation_status`, `recommended_pick`, `production_eligible`, `result`, `status`, `settlement_details`, `settled_at`, `is_current`.

This should remain read-only and must report `providerCallsMade: 0` and `remoteMutationsMade: 0`.
