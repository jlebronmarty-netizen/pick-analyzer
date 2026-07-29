# Training Pipeline Architecture V1

Date: 2026-07-29

Status: DESIGN ONLY

No model training. No production prediction changes.

## Mission

Define the complete future training pipeline for controlled model evolution without running training, fitting a model, changing probabilities, changing confidence, changing Trust, changing Official Pick policy, changing Learning Brain weights, activating epochs or modifying historical predictions.

## Canonical Flow

1. Provider evidence enters through approved provider adapters and sync jobs.
2. Canonical identity resolves provider teams, players, events and markets into stable platform IDs.
3. Odds snapshots store point-in-time market evidence with provider provenance.
4. Feature snapshots store pregame, cutoff-safe feature references and immutable payload evidence.
5. Prediction rows are written to `prediction_history` by the current champion or approved preview/shadow pipeline.
6. Current Board reads current champion rows only and remains separate from shadow/candidate evidence.
7. Result ingestion stores authoritative final game evidence in `game_results`.
8. Settlement uses canonical event, market and selection logic to label predictions.
9. Learning evidence is derived from settled, cutoff-safe, production-compatible rows.
10. Historical Foundation projects stored evidence into a deterministic readiness inventory.
11. Training Dataset Builder, future only, freezes accepted row IDs and feature references.
12. Training Runner, future only, consumes a frozen manifest and writes candidate artifacts.
13. Validation evaluates walk-forward, holdout and calibration metrics without touching production rows.
14. Candidate Model is registered as inactive metadata.
15. Shadow Evaluation compares candidate output against champion output prospectively.
16. Promotion requires manual approval and epoch governance.
17. Rollback restores the prior champion pointer without deleting any row or artifact.
18. Production uses only the approved champion after activation.

## Stage Contracts

Prediction rows must include sport, event, market, selection, generated time, cutoff context, model version and feature evidence. Rows without cutoff-safe timing, canonical result evidence or feature linkage cannot enter a production training dataset.

Feature snapshots must be immutable point-in-time evidence. The training dataset stores snapshot references and fingerprints, not duplicated bulk feature payloads.

Settlement labels must come from authoritative final results after the event. Labels are never available as pregame features.

Learning evidence remains derived and read-only in this phase. `model_weight_history` is observed only as a count and provenance source.

## Blocked Actions

- No model training.
- No fitting, optimization or recalibration.
- No model weight mutation.
- No epoch activation.
- No production prediction changes.
- No settlement changes.
- No feature rebuilds.
- No provider calls.
- No database mutations.

## Evidence

The read-only implementation is `scripts/historical-training-readiness-v1.mjs`, which consumes `docs/HISTORICAL_LEARNING_READINESS_V1.json` and writes `docs/TRAINING_READINESS_V1.json`.
