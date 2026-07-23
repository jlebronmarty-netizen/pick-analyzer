# Daily Settlement Closure V1

Status: implemented as Settlement V2 repair and protected execution workflow.

## Root Cause

Settlement V2 treated every `validation_status='skipped'` row as `test_or_fixture_data`. The July 22, 2026 MLB rows were policy-skipped model rows, not synthetic rows. Their warnings were calibration maturity and non-positive EV warnings. They were therefore terminally classified as `Ignored`, preventing otherwise deterministic pregame rows from being settled.

## Repair

The settlement classifier now treats only explicit trial, scrambled, fixture, quarantine or synthetic evidence as test-like. Misclassified `Ignored/test_or_fixture_data` rows can be reopened only when they are not real test fixtures. Settled, void and closed rows remain protected from reversal.

Final-score detection now accepts persisted terminal event statuses `completed`, `final`, `closed` and `complete` when home and away scores are present.

## Execution Contract

Use existing `/api/settlement/reconciliation` modes:

- `DRY_RUN`
- `RANGE`
- `FULL_RECONCILIATION`
- `VALIDATE_ONLY`

All settlement uses persisted `sport_events` scores only. No provider calls or score inference are allowed.
