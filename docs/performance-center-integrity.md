# Performance Center Integrity

Date: 2026-07-21

## Changes

- The ambiguous `Trust Confidence` UI label is now `Trust Evidence`.
- Internal calibration diagnostics label the stored metric as `Absolute Calibration Error`.
- Existing score math was not changed.

## Required Separation

Performance surfaces should keep these concepts separate:

- Operational Health
- Data Health
- Model Performance
- Recommendation Readiness
- Official Picks performance
- AI Leans performance
- Shadow/ineligible/post-start/test rows

When settled sample size is zero, user-facing metrics must show unqualified or not available states rather than implying 0% accuracy, 0 Brier or perfect trust.

## Remaining Caveat

This pass did not mutate historical pending predictions. Settlement reconciliation should be run only for deterministic exact event/result links.
