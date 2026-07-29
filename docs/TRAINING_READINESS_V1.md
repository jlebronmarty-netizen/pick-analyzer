# Training Readiness V1

Date: 2026-07-29

Status: DESIGN SAMPLE PRESENT, TRAINING BLOCKED

No model training. No production prediction changes.

## Current Baseline

Read-only evidence from Historical Learning Foundation V1:

- Predictions scanned: 2,595
- Production training-ready rows: 354
- Learning queue rows: 386
- Learning accepted rows: 354
- Model weight history rows: 41
- Training runs executed: 0
- Epoch promotions executed: 0

The current accepted rows are valuable for designing the dataset contract and validation gates. They are not sufficient to train or promote a new model.

## Minimum Samples

Minimum future thresholds:

- Design review: 250 accepted rows.
- First candidate training: 1,000 accepted rows for one sport.
- Sport-market candidate: 300 accepted rows per market within the sport.
- Promotion shadow evaluation: 500 prospective settled shadow rows.
- Preferred production promotion: multi-season coverage, no material leakage findings and stable calibration.

These thresholds are design gates. They do not authorize training.

## Per-Sport Readiness

| Sport | Current State | Accepted Rows | Readiness |
| --- | --- | ---: | --- |
| MLB | Production settled evidence exists | 354 | Design sample present, not training-ready |
| NBA | Trial/shadow evidence only | 0 | Blocked |
| NFL | Preview rows and feature snapshots exist | 0 | Blocked until games settle |
| NHL | Preview rows and feature snapshots exist | 0 | Blocked until games settle |
| Soccer | Limited evidence, missing competition-scoped production lifecycle | 0 | Blocked |
| BSN | Limited evidence, no production prediction lifecycle | 0 | Blocked |
| Tennis | No production prediction persistence | 0 | Blocked |
| UFC | No production prediction persistence | 0 | Blocked |

## Training Blockers

- MLB sample is too small and too concentrated in one month.
- Non-MLB sports lack accepted production-settled training rows.
- Preview and shadow rows need future authoritative results before they can be considered.
- Trial and scrambled rows remain excluded.
- Future dataset builder still needs duplicate logical-row enforcement and frozen manifest approval.

## Evidence

Machine-readable readiness lives in `docs/TRAINING_READINESS_V1.json`.
