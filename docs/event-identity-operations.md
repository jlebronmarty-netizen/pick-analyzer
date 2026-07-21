# Event Identity Operations

Last updated: 2026-07-21

## Read-Only Checks

Use these routes for event identity operations:

- `/api/events/identity/audit`
- `/api/events/identity/unresolved`
- `/api/events/identity/conflicts`
- `/api/events/[eventId]/identity`
- `/api/settlement/reconciliation`
- `/api/operations/validation`

All ordinary reads must report `providerCallsMade=0` and `remoteMutationsMade=0`.

## Current Metrics

- Canonical events: 4,972
- Provider event mappings: 4,972
- Odds event IDs: 1,550
- Result event IDs: 335
- Stat event IDs: 1,518
- Predictions without canonical event in settlement backlog: 342
- Conflicting mappings: 0
- Ambiguous mappings: 0
- Doubleheader review count: 0
- Reschedule review count: 0
- Reconciliation backlog blocked by identity: 342

## Recovery

If a future audit reports exact repair candidates:

1. Review the candidate count and sample evidence.
2. Confirm there are no conflicts, doubleheaders or reschedule ambiguities.
3. Use the protected repair route with `CRON_SECRET`.
4. Verify the second protected run produces zero mutations.
5. Rerun settlement reconciliation before any settlement write.

If evidence is insufficient, leave rows unresolved and import or create exact provider/source mappings through an approved data workflow.
