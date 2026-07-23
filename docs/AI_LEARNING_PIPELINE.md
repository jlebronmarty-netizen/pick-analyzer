# AI Learning Pipeline

Status: implemented as persisted-evidence validation
Version: `ai_learning_lifecycle_v1`

## Lifecycle

The validated lifecycle is:

1. Game Scheduled
2. Odds Snapshot
3. Prediction Generated
4. Current Board
5. Official Pick Decision
6. Game Finished
7. Settlement
8. Replay Snapshot
9. Training Label
10. Learning Queue
11. Learning Validation
12. Weight Update
13. Performance Recalculation
14. Future Prediction

## Learning Queue Contract

The V1 queue is derived read-only from deterministic production-settled `prediction_history` rows.

Queue statuses:

- `QUEUED`: deterministic label and snapshot evidence exist, but no persisted weight-update acceptance exists.
- `VALIDATING`: sample is under validation.
- `ACCEPTED`: deterministic label and point-in-time feature evidence pass chronology/leakage checks.
- `REJECTED`: deterministic result or leakage-safe feature evidence is missing.
- `TRAINED`: persisted model-weight history exists after settlement.
- `APPLIED`: governed production update is active.
- `ROLLED_BACK`: governed update was reverted.

Every queue item carries prediction id, event id, sport, market, label, status, reason, timestamp, source and confidence.

## Label Rules

Win/loss/push labels come only from settled prediction results. Totals, runline, First 5 and first-inning labels require matching settled markets. Bullpen-specific labels remain blocked until a deterministic stored bullpen label contract exists.

## Guardrails

This validation does not modify Prediction Engine probabilities, Learning Brain weights, Official Pick policy, settlement outcomes, Current Board rows, historical features or replay rows.

Production weight activation remains blocked unless the shadow validation gate proves sufficient accepted sample, chronological holdout, non-worsening Brier/Log Loss, acceptable calibration, subgroup stability and rollback readiness.
