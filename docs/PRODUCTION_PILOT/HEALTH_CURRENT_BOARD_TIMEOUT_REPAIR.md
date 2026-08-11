# Health Current Board Timeout Repair

## Verdict

`HEALTH_CURRENT_BOARD_TIMEOUT_REPAIR_LOCAL_PASS`

## Timeout Root Cause

`/api/operations/health` called `getCurrentBoard({ mode: CURRENT, limit: 100 })`
as a required dependency. If the Current Board odds snapshot query timed out,
the whole health endpoint returned HTTP 500.

`/api/operations/settlement-guarantee?includeValidation=true` inherited the same
failure because settlement guarantee called `getOperationsHealth()` before
performing settlement reconciliation.

## Failing Path

`/api/operations/health`

`loadOperationsHealth()`

`getOperationsHealth()`

`getCurrentBoard()`

`readOddsForEvents()`

`sports_odds_snapshots`

The failing query was the Current Board odds snapshot read for current MLB
events. It used sport, event, market, provider-authority, and freshness-window
filters, but health made the full product-board read mandatory.

## Repair

- Health now uses a bounded `safeCurrentBoardHealthSummary()` call:
  - `mode = CURRENT`
  - `limit = 25`
  - `includeMlbContext = false`
  - current authority filtering remains inside Current Board
- If the supplemental board read fails, health returns an explicit
  `CURRENT_BOARD_READ_FAILED` warning/blocker instead of HTTP 500.
- Settlement guarantee catches operations-health failure and continues the
  canonical settlement reconciliation with an explicit operational warning.

## Safety

Exact-line semantics, provider authority filtering, stale fail-closed behavior,
SportsDataIO Stage 3 zero-call suppression, R2 UUID safety, settlement formulas,
learning, Performance scope, HR-03 shadow status, and rollback configuration are
unchanged.

Provider calls from certification: `0`

Production DB mutations from certification: `0`
