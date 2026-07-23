# Feature Label Coverage Recovery V1

Status: read-only bridge implemented; Retrosheet 2025 feature backfill write blocked pending approval.

## Baseline

Current deterministic MLB production labels:

- labels: 776
- accepted with feature evidence: 228
- rejected: 548
- main rejection reason: `FEATURE_SNAPSHOT_MISSING`
- coverage: 29.38%

## Acceptance Rules

Samples are acceptable only when all are true:

- deterministic settlement exists
- exact event identity exists
- point-in-time feature evidence exists
- feature cutoff is not after game start
- leakage status is not blocked
- market is supported
- chronology is valid
- row is not test, legacy, ignored, replay, historical, shadow, cancelled, or voided

## Important Boundary

The Retrosheet 2025 historical feature backfill creates historical-only feature snapshots. It does not automatically link those snapshots to existing 2026 production `prediction_history` labels. Label acceptance must remain deterministic; the worker does not force feature links or fabricate training evidence.

## Shadow Readiness

Current accepted evidence remains sufficient for read-only shadow readiness reporting, but no production model weights are changed. A real shadow validation run is required before claiming `SHADOW_LEARNING_READY`.
