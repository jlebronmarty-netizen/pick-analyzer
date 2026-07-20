# MLB Projection Temporal Integrity V1

Status: implemented.

Universal Projection Engine V1 is sportsbook-independent and now lifecycle-gated.

## Rules

- Active projections require `PREGAME` or `STARTING_SOON`.
- `projectedAt` must precede canonical game start.
- Post-start/status-unconfirmed games are excluded from active projection generation.
- Actual outcomes do not enter pregame feature construction.
- Projection history remains separate from `prediction_history`.
- Late or post-start projections are invalid for shadow evaluation.

## Implementation

- `src/services/universal-projection-engine.service.ts`
- `src/services/mlb-game-lifecycle.service.ts`
- `src/services/provider-time-normalization.service.ts`

The projection response includes `temporalSafety` with total discovered games, projection-eligible games and excluded games.

## Migration Readiness

`supabase/migrations/202607190002_universal_projection_history_v1.sql` is additive, creates idempotency uniqueness, stores UTC timestamps and does not conflict with `prediction_history`.

Production migration must be verified before claiming durable projection history is active.
