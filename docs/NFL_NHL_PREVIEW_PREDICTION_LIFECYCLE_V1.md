# NFL + NHL Preview Prediction Lifecycle V1

Generated: 2026-07-28

## Objective

Activate genuine Preview-only prediction lifecycle coverage for NFL and NHL after Universal Event Identity cleared canonical event blockers.

The lifecycle is:

`Canonical Event -> Pregame Features -> Pregame Prediction -> Result -> Settlement -> Learning -> Performance -> Promotion Readiness`

## Shared Implementation

- Reuses `sport_events` canonical event IDs.
- Reuses `sports_odds_snapshots` stored The Odds API rows.
- Reuses Feature Store Core snapshot contracts.
- Reuses Shared Sport Prediction SDK.
- Reuses `historical_feature_snapshots` for immutable pregame feature evidence.
- Reuses `prediction_history` for quarantined Preview rows.
- Reuses Settlement Reconciliation V2 for deterministic settlement dry-runs.

No new prediction engine, settlement engine, feature store, scheduler, learning engine or crosswalk was created.

## Checkpoint A - NFL Preview Activation

Status: PASS

Production data mutation scope:

| Table | Rows |
| --- | ---: |
| `historical_feature_snapshots` | 776 |
| `prediction_history` | 776 |

Evidence:

| Item | Result |
| --- | --- |
| Future canonical events scanned | 12 |
| Stored odds rows used | 776 |
| Markets | moneyline, spread, total |
| Cutoff rejects | 0 |
| Production eligible rows | 0 |
| Official picks | 0 |
| Provider calls | 0 |
| Idempotency dry-run | 776 reused, 0 inserted, 0 mutations |

Lifecycle:

| Stage | Status |
| --- | --- |
| Canonical Event | PASS |
| Pregame Features | PASS |
| Pregame Prediction | PASS |
| Result | WAITING_FOR_FUTURE_RESULTS |
| Settlement | WAITING_FOR_DETERMINISTIC_FINAL_RESULTS |
| Learning | BLOCKED_UNTIL_SETTLEMENT_LABELS_EXIST |
| Performance | BLOCKED_UNTIL_SETTLED_PREVIEW_ROWS_EXIST |
| Promotion Readiness | BLOCKED_PREVIEW_SAMPLE_AND_SETTLEMENT_SAMPLE_PENDING |

## Checkpoint B - NHL Preview Activation

Status: PASS

Production data mutation scope:

| Table | Rows |
| --- | ---: |
| `historical_feature_snapshots` | 258 |
| `prediction_history` | 258 |

Evidence:

| Item | Result |
| --- | --- |
| Future canonical events scanned | 12 |
| Stored odds rows used | 258 |
| Markets | moneyline, spread, total |
| Cutoff rejects | 0 |
| Production eligible rows | 0 |
| Official picks | 0 |
| Provider calls | 0 |
| Idempotency dry-run | 258 reused, 0 inserted, 0 mutations |

Lifecycle:

| Stage | Status |
| --- | --- |
| Canonical Event | PASS |
| Pregame Features | PASS |
| Pregame Prediction | PASS |
| Result | WAITING_FOR_FUTURE_RESULTS |
| Settlement | WAITING_FOR_DETERMINISTIC_FINAL_RESULTS |
| Learning | BLOCKED_UNTIL_SETTLEMENT_LABELS_EXIST |
| Performance | BLOCKED_UNTIL_SETTLED_PREVIEW_ROWS_EXIST |
| Promotion Readiness | BLOCKED_PREVIEW_SAMPLE_AND_SETTLEMENT_SAMPLE_PENDING |

## Safety

- No retrospective predictions.
- No post-start predictions.
- No production promotion.
- No Official Picks.
- No recommendation policy change.
- No Learning Brain weight change.
- No scheduler change.
- No provider calls.
- Missing quarterback, goalie, injury, lineup, weather, team-form and rest/travel context is recorded as unavailable instead of fabricated.

## Certification Markers

- NFL_PREVIEW_PREDICTION_ACTIVATION_PASS
- NFL_PREGAME_FEATURE_SNAPSHOT_PASS
- NFL_PREVIEW_ISOLATION_PASS
- NFL_SETTLEMENT_DRY_RUN_PASS
- NHL_PREVIEW_PREDICTION_ACTIVATION_PASS
- NHL_PREGAME_FEATURE_SNAPSHOT_PASS
- NHL_PREVIEW_ISOLATION_PASS
- NHL_SETTLEMENT_DRY_RUN_PASS
- NFL_LEARNING_BLOCKED_UNTIL_LABELS_PASS
- NFL_PERFORMANCE_BLOCKED_UNTIL_SETTLED_SAMPLE_PASS
- NHL_LEARNING_BLOCKED_UNTIL_LABELS_PASS
- NHL_PERFORMANCE_BLOCKED_UNTIL_SETTLED_SAMPLE_PASS
- NO_RETROSPECTIVE_PREDICTION_PASS
- NO_POST_START_LEAKAGE_PASS
- NO_PRODUCTION_POLLUTION_PASS
- NO_PROVIDER_CALL_PASS
