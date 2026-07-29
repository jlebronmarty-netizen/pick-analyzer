# Training Dataset Expansion V1

Date: 2026-07-29

Status: READ-ONLY DATASET MANIFEST EXPANSION

## Expanded Dataset

Historical Evidence Recovery V1 expands the read-only learning dataset from 354 to 419 rows by accepting 65 additional MLB rows that already have canonical result, linked feature snapshot, model version and cutoff-safe prediction evidence.

This expansion is a dataset-manifest expansion only. It does not change production prediction rows, settlement rows, model weights, epochs, probabilities, confidence, Trust or Official Pick policy.

## Per-Sport Growth

| Sport | Expanded Training Rows |
| --- | ---: |
| MLB | 419 |

No other sport gained accepted training rows in this phase.

## Per-Market Growth

| Market | Expanded Training Rows |
| --- | ---: |
| Moneyline | 139 |
| Spread/Runline | 140 |
| Totals | 140 |

## Per-Season Growth

| Season/Month | Expanded Training Rows |
| --- | ---: |
| 2026-07 | 419 |

## Remaining Blockers

The remaining blocked rows require one or more of:

- authoritative canonical result evidence;
- valid feature snapshot linkage;
- production-settled lifecycle evidence;
- cutoff-safe timing;
- non-fixture/non-shadow status;
- future approved preview/shadow review.

Rows with post-start, post-final, fixture, or unapproved preview/shadow lifecycle blocks remain excluded.

## Training Readiness

The platform is still below the first controlled candidate-training threshold:

- Current expanded training rows: 419
- First controlled candidate-training threshold: 1,000
- Remaining rows needed: 581

No model training is authorized by this phase.
