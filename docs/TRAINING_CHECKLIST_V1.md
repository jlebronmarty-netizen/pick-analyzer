# Training Checklist V1

Date: 2026-07-29

Status: FUTURE APPROVAL CHECKLIST

No model training. No production prediction changes.

## Before Dataset Freeze

- Confirm provider calls are not required.
- Confirm no database mutation is planned.
- Confirm accepted rows meet sample thresholds.
- Confirm canonical results exist.
- Confirm feature snapshots are point-in-time.
- Confirm cutoff and leakage checks pass.
- Confirm duplicates are absent.
- Confirm trial, scrambled, preview and shadow rows are excluded.

## Before Training

- Obtain explicit training approval.
- Freeze dataset manifest.
- Record commit and dependency versions.
- Record deterministic seed.
- Record model configuration.
- Confirm output destination is candidate-only.
- Confirm production champion remains unchanged.

## Before Validation

- Use walk-forward splits.
- Keep test partition untouched until final evaluation.
- Compare against current champion.
- Report Brier, calibration, accuracy, log loss, precision, recall, ROI, CLV, EV, profit simulation, Sharpe and drawdown.

## Before Shadow

- Confirm candidate is inactive.
- Confirm shadow rows cannot appear as Official Picks.
- Confirm Current Board remains champion-only.
- Confirm monitoring and rollback references exist.

## Before Promotion

- Obtain manual promotion approval.
- Confirm prospective shadow metrics passed.
- Confirm no regression in safety metrics.
- Confirm rollback target is valid.
- Confirm epoch activation plan is explicit and reviewed.

## This Phase Result

- Training executed: no.
- Model weights changed: no.
- Epoch activated: no.
- Settlement changed: no.
- Production predictions changed: no.
