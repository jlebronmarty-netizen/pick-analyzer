# Epoch-Aware Performance And Learning V2

Status: Locally implemented as a read-only reporting and learning-boundary contract.

`GET /api/data-foundation/epoch-performance` reports active, archived and all-epoch performance scopes without changing Learning Brain weights, model calibration, champion rows or production scheduling.

Local validation on 2026-07-27:

- validation checks: 12/12 passed
- provider calls: 0
- remote mutations: 0
- learning weight changes executed: false
- recalibration executed: false
- model promotion executed: false

## Reporting Views

- active epoch: `DATA_FOUNDATION_V2_EPOCH` after manual migration and activation
- archived epoch: `LEGACY_EPOCH_V1`
- all epochs: explicit scope only

## Metrics

The route reports bounded local samples grouped by inferred epoch, sport and model version. Calibration buckets are reported only from settled rows with stored model probability evidence.

## Learning Boundary

Learning labels must carry the originating epoch before they can be consumed by epoch-specific learning views. This phase does not create labels, change weights, recalibrate models, promote a model or change Official Pick policy.

## Certification

Certification markers:

`EPOCH_PERFORMANCE_REPORTING_PASS`

`EPOCH_AWARE_LEARNING_LABELS_PASS`

`NO_LEARNING_WEIGHT_CHANGE_PASS`

`NO_MODEL_RECALIBRATION_PASS`
