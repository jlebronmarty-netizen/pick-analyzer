# Event Linkage Reconciliation

Last updated: 2026-07-21

Event linkage reconciliation is dry-run first and uses `universal_event_identity_v1`.

## Workflow

1. Run `GET /api/settlement/reconciliation` to identify rows blocked by exact event identity.
2. Run `GET /api/events/identity/audit` to classify missing event links.
3. Confirm exact repairs are backed by one unique canonical event and deterministic evidence.
4. Apply protected repair only when the expected mutation count is non-zero and reviewed.
5. Rerun repair; the second run must produce zero mutations.
6. Rerun settlement reconciliation.
7. Settle only through the existing settlement engine when final result and market identity are proven.

## Current Production Result

The current production audit found 342 missing event-link rows and 0 safe deterministic repairs.

All 342 are `EVENT_NOT_IMPORTED`, so no `prediction_history`, `provider_entity_mappings`, settlement or performance mutation was performed.

## Safety

The reconciliation layer does not mutate prediction probabilities, confidence, odds, line, market, generated time, feature snapshots, model version, recommendation state or official pick status.
