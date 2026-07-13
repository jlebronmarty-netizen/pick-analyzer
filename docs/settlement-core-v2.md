# Settlement Core V2

Settlement Core V2 adds reusable settlement primitives for common market grading.

## Scope

- moneyline
- spread
- total
- win
- loss
- push
- void
- pending
- overtime policy contract
- period market contract

## Files

- `src/services/settlement-core.service.ts`
- `src/app/api/settlement/core/route.ts`
- `src/components/dashboard/SettlementCorePanel.tsx`

## API

`GET /api/settlement/core`

Returns deterministic local settlement self-tests and primitive readiness. It makes zero provider calls.

## NBA Compatibility

NBA Prediction Settlement V1 remains unchanged. The generic settlement primitives are additive and should be adopted incrementally only where behavior matches existing sport-specific rules.

## Deterministic Validation

The status API checks:

- moneyline win
- spread cover
- total over
- total push
- pending event
- cancelled event void

These are deterministic local examples, not production settlement records.

## Future Work

- Adopt shared primitives in NBA settlement where behavior matches exactly.
- Add period-market helpers for first-half and quarter settlement.
- Add sport-specific overtime policy adapters.
- Use the primitives for future NFL, NHL, soccer, tennis and UFC settlement modules.
