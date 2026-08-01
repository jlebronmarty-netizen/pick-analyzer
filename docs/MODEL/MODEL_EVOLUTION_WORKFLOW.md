# Model Evolution Workflow

Status: HUMAN-APPROVED STATISTICAL GATE

Release 08 defines the only allowed path from model idea to production.

## Required Pipeline

1. Candidate
2. Evidence
3. Segmentation
4. Statistical validation
5. Offline simulation
6. Regression detection
7. Human approval
8. Deployment

If any step fails, the candidate is rejected or classified as NEEDS MORE DATA.

## Candidate Contract

Every candidate must include:

- affected sport, market and segment
- canonical evidence source
- sample size
- expected Brier improvement
- expected calibration improvement
- expected accuracy impact
- confidence level
- risk level
- rollback plan

## Approval Rules

No optimization can reach production until all of these are true:

- sample size meets the configured threshold
- Brier improves by at least 0.005
- calibration improves by at least 2.00 percentage points
- overall accuracy does not decrease
- Official Pick performance does not degrade
- high-confidence buckets do not regress
- provider calls are zero during certification
- database mutations are zero during certification
- a human explicitly approves promotion

## Deployment Rule

Approved candidates must ship as a separate future release. Release 08 does not deploy experimental model behavior automatically.

## Prohibited Shortcuts

- no fabricated predictions
- no replayed history
- no modified historical outcomes
- no global probability recalibration by intuition
- no Official Pick threshold changes without evidence
- no learning-weight changes without approved release scope
