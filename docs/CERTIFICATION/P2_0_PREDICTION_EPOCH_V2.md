# P2.0 Prediction Epoch V2 Activation

Status: LOCAL_READY_PENDING_PRODUCTION_ACTIVATION.

P2.0 creates a future-only Current V2 Production era. Historical prediction rows remain preserved and unlinked unless a later explicitly bounded backfill is approved.

## Contract

| Field | Value |
| --- | --- |
| Current epoch key | `CURRENT_V2_PRODUCTION` |
| Legacy scope key | `LEGACY_PRE_V2` |
| Timezone | `America/Puerto_Rico` |
| Policy version | `production_evaluation_policy_v1_3` |
| Production scope version | `current_v2_production_scope_v1` |

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

Production activation and certification will update this document after the protected activation endpoint is executed.
