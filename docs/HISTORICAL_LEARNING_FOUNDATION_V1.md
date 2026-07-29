# Historical Learning Foundation V1

Date: 2026-07-29

Status: READ-ONLY FOUNDATION COMPLETE

## Mission

Create a canonical historical learning foundation from existing stored predictions, canonical results, settlement state and feature evidence.

This phase prepares future training evidence only. It does not train, recalibrate, backfill, replay, activate an epoch or mutate production data.

## Architecture

Canonical flow:

`prediction_history` -> `game_results` -> canonical settlement classifier -> feature snapshot reference -> learning acceptance/rejection -> future manual training review

Source tables:

- `prediction_history`
- `game_results`
- `historical_feature_snapshots`
- `model_weight_history`

Canonical services:

- `src/services/canonical-settlement-state.service.ts`
- `src/services/historical-learning-foundation-v1.service.ts`

The dataset stores references and summaries only. It does not export bulk feature payloads.

## Inventory

Read-only inventory result:

- Predictions scanned: 2,595
- Production training-ready rows: 354
- Rejected or blocked rows: 2,241
- Model weight history before: 41
- Model weight history after: 41
- Deterministic fingerprint: `6cd3c4f765e4decaa581b5bd1efaeca0e74796a4c63116f4df7c21a236c4c3a1`

Primary rejection categories are recorded in `docs/HISTORICAL_LEARNING_READINESS_V1.json` by exact reason, sport, market, model version, month, outcome and readiness partition.

## Training Queue Readiness

The foundation reports sport-level readiness groups but does not promote any group automatically. A `SAMPLE_PRESENT_FOR_FUTURE_REVIEW` status means stored evidence exists for later human-approved training evaluation, not that training has run or that weights should change.

No readiness threshold was invented silently. The service reports coverage and sample counts; future training policy remains a separate approval gate.

## No-Training Proof

Verified:

- Historical Replay was not started.
- Historical backfill was not started.
- No retrospective predictions were created.
- No model training occurred.
- No model weights changed.
- No epoch was activated.
- No settlement rows were modified.
- No prediction rows were modified.
- Provider calls were 0.
- Database mutations were 0.

## Evidence

- `src/services/historical-learning-foundation-v1.service.ts`
- `scripts/historical-learning-foundation-v1.mjs`
- `scripts/historical-learning-foundation-v1-validate.mjs`
- `docs/HISTORICAL_LEARNING_READINESS_V1.json`
- `docs/HISTORICAL_LEARNING_DATASET_CONTRACT_V1.md`

## Markers

- HISTORICAL_LEARNING_FOUNDATION_PASS
- HISTORICAL_LEARNING_DATASET_CONTRACT_PASS
- HISTORICAL_LEARNING_DATASET_DETERMINISM_PASS
- HISTORICAL_LEARNING_FEATURE_LINKAGE_PASS
- HISTORICAL_LEARNING_RESULT_LINKAGE_PASS
- HISTORICAL_LEARNING_LEAKAGE_SAFETY_PASS
- HISTORICAL_LEARNING_READINESS_MATRIX_PASS
- NO_HISTORICAL_REPLAY_PASS
- NO_HISTORICAL_BACKFILL_PASS
- NO_RETROSPECTIVE_PREDICTION_PASS
- NO_MODEL_TRAINING_PASS
- NO_MODEL_WEIGHT_MUTATION_PASS
- NO_EPOCH_ACTIVATION_PASS
