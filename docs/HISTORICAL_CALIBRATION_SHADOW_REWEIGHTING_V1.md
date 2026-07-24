# Historical Calibration & Shadow Reweighting V1

Date: 2026-07-24
Starting commit: `7f4cffff7426c39135fa6908e801d3cd0d6e3bc9`

## Scope

Phase 2 uses Full Historical Replay Phase 2B evidence to build a versioned shadow calibration layer. It is read-only and shadow-only.

No production model weights were changed. No model was promoted. No provider calls were made. No replay rows, prediction rows, Current Board rows, Official Picks, Learning Brain weights or Historical Feature Store rows were mutated.

## Implementation

- Service: `src/services/historical-shadow-calibration.service.ts`
- API: `/api/model/shadow-calibration`
- CLI: `npm.cmd run historical:shadow-calibration`
- AI Operations: `/api/ai-operations/lifecycle` and `/ai-operations`
- Shadow version: `historical_calibration_shadow_bucket_v1`
- Method: chronological market/probability bucket calibration

## Evidence

- Replay rows read: 7,290
- Graded rows: 7,260
- Excluded push rows: 30
- Markets: Moneyline, Run Line/spread, Total
- Provider calls: 0
- Remote mutations: 0
- Production weights changed: false
- Production model promoted: false

## Chronological Splits

- Training: 4,356 rows, `2025-03-18T00:00:00+00:00` through `2025-07-18T00:00:00+00:00`
- Validation: 1,452 rows, `2025-07-18T00:00:00+00:00` through `2025-08-24T00:00:00+00:00`
- Holdout: 1,452 rows, `2025-08-24T00:00:00+00:00` through `2025-09-28T00:00:00+00:00`
- Chronological integrity: PASS

## Holdout Comparison

Baseline:

- Accuracy: 56.61%
- Brier score: 0.2422
- Log loss: 0.6774
- Calibration error: 3.27
- Calibration bias: 3.27
- Confidence reliability: 96.73

Shadow:

- Accuracy: 57.16%
- Brier score: 0.2425
- Log loss: 0.6782
- Calibration error: 0.73
- Calibration bias: 0.73
- Confidence reliability: 99.27

Holdout deltas:

- Accuracy: +0.55
- Brier score: +0.0003
- Log loss: +0.0008
- Calibration error: -2.54

## Recommendation

Shadow equivalent.

Do not promote shadow calibration automatically. The shadow layer materially improves calibration error and reliability but is fractionally worse on Brier score and log loss, so it should remain a review-only candidate.

## Certifications

- `CHRONOLOGICAL_CALIBRATION_PASS`
- `SHADOW_REWEIGHTING_PASS`
- `NO_AUTO_PROMOTION_PASS`
- `SHADOW_COMPARISON_PASS`
- `CALIBRATION_EVIDENCE_PASS`
