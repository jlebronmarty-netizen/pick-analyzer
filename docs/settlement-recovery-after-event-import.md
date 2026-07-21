# Settlement Recovery After Event Import

Last updated: 2026-07-21

## Current State

Settlement remains blocked for the 342 missing-link rows because there are no recovered canonical events.

## Required Sequence

After future source-backed event import:

1. Run `/api/events/recovery/missing-canonical`.
2. Run `/api/events/identity/audit`.
3. Confirm exact event candidates and zero conflicts.
4. Repair prediction event links only through deterministic evidence.
5. Rerun `/api/settlement/reconciliation`.
6. Settle only rows with exact canonical event, official terminal result, supported market and unambiguous selection.

## Performance

Performance scopes must be recalculated only after deterministic settlement. Post-start rows and test/fixture rows remain excluded from qualified pregame performance.
