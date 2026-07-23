# Prediction Lifecycle V2

Last updated: 2026-07-23

## Lifecycle Badges

Prediction History and performance views should display explicit settlement badges:

| Badge | Meaning |
| --- | --- |
| `Scheduled` | Event has not started. |
| `Awaiting Result` | Event is not final or persisted final result is not available yet. |
| `Settled Win` | Supported market graded as win from persisted final score. |
| `Settled Loss` | Supported market graded as loss from persisted final score. |
| `Push` | Supported market landed exactly on the line or tied. |
| `Cancelled` | Persisted event status is cancelled, postponed or suspended. |
| `Historical` | Historical-only row excluded from production performance. |
| `Replay` | Replay row excluded from production settlement. |
| `Shadow` | Shadow row tracked outside production performance. |
| `Legacy` | Legacy row lacks canonical event lineage and cannot be safely reconciled. |
| `Unknown` | Identity, result or market evidence is insufficient. |

## Database Compatibility

The exact V2 lifecycle lives in `prediction_history.settlement_details.settlement_reconciliation_v2.lifecycle`.

The older `prediction_history.lifecycle_status` column remains compatible:

| V2 state | DB lifecycle |
| --- | --- |
| `Scheduled`, `AwaitingResult`, `Locked`, `Settling` | `active` |
| `Settled`, `Push` | `settled` |
| `Cancelled`, `Voided` | `void` |
| `Historical`, `Legacy`, `Unknown` | `closed` |
| `Replay`, `Shadow`, `Ignored` | `skipped` |

## Terminal Policy

No finished-game prediction should remain indefinitely Pending after reconciliation. If a persisted final score is available and the market is supported, the row receives a deterministic settlement. If the row cannot be safely graded, it receives a terminal classification with an explicit reason instead of an ambiguous pending display.

## Performance Semantics

Only graded wins and losses contribute to accuracy, Brier and log loss. Pushes and voids are terminal but not correct/incorrect outcomes. Historical, replay, shadow, ignored, legacy and unknown rows are preserved for auditability but excluded from production recommendation performance.

## UI Semantics

Performance timeline now groups by lifecycle:

- Generated
- Settled
- Awaiting Settlement
- Cancelled
- Push
- Historical / Replay

Prediction History displays lifecycle badges instead of plain Pending/Correct/Incorrect labels.

## Production Execution Result

The 2026-07-23 controlled reconciliation classified all previously non-terminal prediction rows into explicit V2 states:

- Legacy: 342
- Ignored: 365
- Awaiting Settlement: 0
- Unknown: 0
- Cancelled: 0
- Push: 0

Rows that lacked persisted final-score evidence were not graded as wins or losses. They received explicit Legacy or Ignored metadata according to the V2 contract.
