# SportsDataIO Historical Availability

Status: Implemented
Version: V1

## Evidence Model

Historical availability is measured from stored import checkpoints and normalized tables, not from assumptions.

Key evidence:

- `sports_sync_jobs.records_fetched`
- `sports_sync_jobs.status`
- Normalized event/stat/odds row counts
- Provider mapping counts
- Stored payload field profiles when retained

## Limitations

Discovery V1 does not run a full historical import and does not backfill missing dates.

Historical reach should be expanded only through the existing historical import executor with:

- Explicit date or season scope
- Budget cap
- Checkpoints
- Idempotency
- Quarantine validation
- No production eligibility leakage
