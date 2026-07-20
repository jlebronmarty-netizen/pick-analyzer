# MLB Game Lifecycle V1

Status: implemented.

Lifecycle is separate from analysis eligibility.

## States

- `SCHEDULED`
- `PREGAME`
- `STARTING_SOON`
- `LIVE`
- `STATUS_UNCONFIRMED`
- `DELAYED`
- `SUSPENDED`
- `POSTPONED`
- `CANCELED`
- `FINAL`
- `UNKNOWN`

## Priority

1. Fresh official provider status.
2. Fresh stored official status.
3. Conservative time-based inference.
4. `UNKNOWN`.

Time alone never infers `FINAL`, `CANCELED` or `POSTPONED`. Time alone also does not mark a game `LIVE` indefinitely. The maximum time-based live-adjacent window is 20 minutes after canonical start, and the state remains `STATUS_UNCONFIRMED` unless provider status is fresh.

## Eligibility

- `PREGAME + READY`
- `PREGAME + DATA_AGING`
- `LIVE + LOCKED`
- `FINAL + SETTLEMENT_PENDING`
- `POSTPONED + LOCKED`
- `UNKNOWN + STATUS_UNCONFIRMED`

Started games cannot enter new Current Board or Official Pick evaluation.

## Implementation

- `src/services/mlb-game-lifecycle.service.ts`
- `src/services/active-event.service.ts`
- `src/services/current-board.service.ts`
- `src/services/next-slate.service.ts`
- `src/services/dashboard-today.service.ts`

Current Board and next-slate gating now use canonical MLB lifecycle rather than raw `new Date(start_time)` plus raw status.
