# Legacy Prediction Archive And Metric Isolation V2

Status: Locally implemented as a read-only metric isolation and deletion-candidate report.

`GET /api/data-foundation/legacy-metrics` audits `prediction_history` samples without deleting, updating, archiving or mutating rows.

Local validation on 2026-07-27:

- validation checks: 8/8 passed
- prediction rows audited: 0
- deletion candidates classified: 0
- delete executed: false
- provider calls: 0
- remote mutations: 0

## Contract

Legacy rows:

- remain queryable
- remain settled when already settled
- remain auditable
- do not contaminate the future active epoch by default
- are not physically deleted

Deletion candidates are classification-only for:

- trial or scrambled rows
- fixture-like rows
- duplicate-review rows
- invalid rows
- post-start or post-final risk rows
- preview-only rows
- shadow or non-production rows

## Safety

- Provider calls: 0
- Remote mutations: 0
- Prediction deletions: 0
- Mass updates: 0
- Automatic archive mutation: none

## Certification

Certification markers:

`LEGACY_METRIC_ISOLATION_V2_PASS`

`NO_PREDICTION_DELETION_PASS`

`EPOCH_FILTERING_PASS`
