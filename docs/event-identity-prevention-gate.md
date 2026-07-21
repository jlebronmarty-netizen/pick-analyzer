# Event Identity Prevention Gate

Last updated: 2026-07-21

## Purpose

Future production-eligible predictions must not be persisted against unimported canonical events.

## Implementation

`savePredictionHistory` now checks rows requesting `production_eligible=true` against `sport_events.id` before upsert.

When a requested production row references a missing canonical event:

- `production_eligible` is downgraded to `false`
- `validation_status` becomes `blocked_by_event_identity_required`
- `validation_warnings` includes `EVENT_IDENTITY_REQUIRED`

The gate does not block shadow, test or explicitly non-production rows. Those workflows remain available but classified.

## Policy

Future production prediction jobs should follow this order:

1. Import or resolve canonical event.
2. Verify event identity.
3. Generate prediction.
4. Persist prediction.
5. Attach market.
6. Evaluate recommendation.

This preserves recommendation integrity without deleting or rewriting existing history.
