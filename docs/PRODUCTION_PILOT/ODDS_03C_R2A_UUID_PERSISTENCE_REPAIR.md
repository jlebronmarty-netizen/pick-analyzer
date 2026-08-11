# ODDS-03C-R2A UUID Persistence Repair

## Verdict

`ODDS_03C_R2A_UUID_PERSISTENCE_REPAIR_LOCAL_PASS`

## Incident

GitHub fallback reached the line-versioned re-prediction writer and failed before
any provider call or write completed:

`invalid input syntax for type uuid`

The invalid value was a logical feature context identifier:

`line_versioned_reprediction_writer_v1:50c7066e-b954-589a-82d5-235dbf9d9826:total:2026-08-11t11_55_18.789z`

## Root Cause

`prediction_history.feature_snapshot_id` is a UUID FK to
`historical_feature_snapshots(id)`. The R2 writer created a composite logical
feature identifier and then reused it as the feature snapshot ID. That value was
valid as a feature snapshot key, but invalid for a UUID column.

## Repair

- `feature_snapshot_id` now receives only an existing valid source feature
  snapshot UUID, or the case is blocked by feature-snapshot safety.
- Logical/composite identifiers remain in text fields such as
  `feature_snapshot_key`, `prediction_group_key`, and `idempotency_key`.
- The new prediction ID remains a deterministic UUID from the exact event,
  market, selection, line, old prediction, and source timestamp.
- UUID-typed values are validated before insert so future internal mistakes fail
  with a precise diagnostic.
- Supersession still links old and new prediction rows by real prediction UUIDs.

## Safety

No prediction formula, model weight, Official Pick threshold, settlement formula,
learning weight, HR-03 status, odds authority, or MLB data-source mode changed.

Provider calls from certification: `0`

Production DB mutations from certification: `0`
