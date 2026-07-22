# Pitcher Outs Operations

## Read-Only Checks

- `GET /api/mlb/learning-brain`
- `GET /api/mlb/learning-brain?validate=true`
- `GET /api/operations/validation`
- `GET /api/providers/budget/status?includeValidation=true`

## Controlled Execution

`POST /api/mlb/learning-brain` defaults to dry-run. Non-dry execution requires authorization and persists only eligible shadow rows from stored data.

## Current Limitation

If no current pregame starter evidence is available, execution returns `NO_ELIGIBLE_PREGAME_STARTERS` and writes zero rows. This is a PASS-safe condition, not a reason to fabricate projections.
