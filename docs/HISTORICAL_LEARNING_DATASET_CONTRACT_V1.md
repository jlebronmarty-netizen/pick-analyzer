# Historical Learning Dataset Contract V1

Date: 2026-07-29

Status: READY FOR FUTURE MANUAL TRAINING REVIEW

## Row Contract

Each projected dataset row contains:

- prediction ID;
- canonical event ID;
- sport;
- event start time;
- generated_at;
- cutoff_at;
- model version;
- feature snapshot reference;
- market;
- selection;
- market line;
- odds;
- model probability;
- implied probability;
- confidence;
- edge;
- EV;
- canonical result ID;
- outcome label;
- settlement source;
- settled_at;
- lifecycle state;
- leakage-safe flag;
- acceptance status;
- rejection reasons;
- training-readiness status.

Feature payloads are not duplicated. The contract stores `feature_snapshot_id`, `feature_snapshot_key` or an embedded-feature reference marker only.

## Acceptance Rules

A row is accepted only when all are true:

- genuine prediction row exists in `prediction_history`;
- generated before event start/cutoff according to the canonical cutoff classifier;
- authoritative `game_results` evidence exists for the row's canonical `game_id`;
- market is supported by the canonical settlement classifier;
- stored outcome and deterministic canonical outcome agree;
- feature evidence is linked or embedded;
- model version is present;
- row is not trial, scrambled, fixture, preview, shadow, replay or incompatible legacy evidence;
- row is canonical production-settled.

## Rejection Reasons

Supported rejection reasons:

- `MISSING_CANONICAL_RESULT`
- `MISSING_FEATURE_EVIDENCE`
- `INVALID_CUTOFF`
- `POST_START_PREDICTION`
- `POST_FINAL_PREDICTION`
- `UNSUPPORTED_MARKET`
- `RESULT_CONFLICT`
- `DUPLICATE_LOGICAL_ROW`
- `PREVIEW_ROW`
- `SHADOW_ROW`
- `AUDIT_ROW`
- `FIXTURE_ROW`
- `MISSING_MODEL_VERSION`
- `INCOMPLETE_PROVENANCE`
- `OTHER_PROVEN_CAUSE`

The current implementation emits the subset proven by current data. It does not force rows into unsupported categories.

## Readiness Partitions

- `PRODUCTION_TRAINING_READY`: accepted rows with canonical result, feature evidence and leakage-safe lifecycle.
- `RESEARCH_PREVIEW_ONLY`: preview/shadow-compatible evidence that is not production training-ready.
- `BLOCKED_MISSING_EVIDENCE`: rows blocked by missing canonical result or missing feature evidence.
- `REJECTED_INVALID`: rows blocked by cutoff, unsupported market, conflict, fixture or missing model version.
- `UNKNOWN_REVIEW_REQUIRED`: rows without enough classification evidence for a stronger claim.

## Determinism

The deterministic fingerprint is a SHA-256 hash over normalized inventory counts, accepted IDs and readiness partitions. The same database state must produce the same fingerprint.

Current fingerprint:

`6cd3c4f765e4decaa581b5bd1efaeca0e74796a4c63116f4df7c21a236c4c3a1`

## Non-Goals

This contract does not:

- run Historical Replay;
- run historical feature backfill;
- create retrospective predictions;
- train a model;
- recalibrate probabilities;
- change model weights;
- activate an epoch;
- write learning labels to a new table;
- change Official Pick policy.
