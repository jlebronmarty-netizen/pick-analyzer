# P2.0 Prediction Epoch V2 Activation

Status: PRODUCTION_CERTIFIED.

P2.0 creates a future-only Current V2 Production era. Historical prediction rows remain preserved and unlinked unless a later explicitly bounded backfill is approved.

## Contract

| Field | Value |
| --- | --- |
| Current epoch key | `CURRENT_V2_PRODUCTION` |
| Legacy scope key | `LEGACY_PRE_V2` |
| Timezone | `America/Puerto_Rico` |
| Policy version | `production_evaluation_policy_v1_3` |
| Production scope version | `current_v2_production_scope_v1` |
| Production commit | `7db3713adc60bd5cdc3810cc91640837cd4b88db` |
| Epoch started at | `2026-08-03T19:57:02.418+00:00` |
| Activation result | HTTP 200 `ACTIVATED` |
| Provider calls | 0 |
| Epoch governance mutations | 2 |
| Prediction rows mutated | 0 |

Future prediction writes stamp `prediction_epoch_id`, `prediction_epoch_key` and `feature_snapshot.predictionEpoch` only when a Current V2 Production epoch is active and the prediction is generated after the activation timestamp.

## Safety

- Historical rows are not deleted.
- Historical rows are not rewritten.
- P1.4 rows generated before activation remain historical.
- No retrospective production predictions are created.
- Prediction formulas, model weights, recommendation gates and Official Pick policy are unchanged.
- Performance defaults to Current V2 Production when an active epoch exists.
- Historical evidence remains available as a separate era.

## Initial Current Era

Generated: 0

Production Eligible: 0

Settled: 0

Wins/Losses/Pushes: 0-0-0

Accuracy, Brier and Calibration: N/A

Production verification showed `/api/current-board?mode=current&limit=200` returning 0 Current V2 candidates immediately after activation, and `/api/performance` defaulting to `CURRENT_V2_PRODUCTION` with 0 generated, 0 production eligible and 0 settled rows. Historical rows remain available separately.
