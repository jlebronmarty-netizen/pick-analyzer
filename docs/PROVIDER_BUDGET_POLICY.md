# Provider Budget Policy

Status: Implemented
Version: V1.1

## Budget Source

Provider budget status is read from `provider-budget.service.ts`.

Tracked fields:

- Calls used today
- Calls planned today
- Hard remaining calls
- Estimated remaining calls
- Daily budget
- Soft reserve
- Max calls per action
- Max refresh calls per rolling hour
- Warning threshold percent
- Stop threshold percent
- Last provider call

Default MLB runtime values are bounded: 1500 calls/day, 150-call reserve, 3 calls/action, 12 refresh calls/hour, warning at 80% usage and hard stop at 95% usage.

Environment aliases:

- `MLB_DAILY_CREDIT_BUDGET`, `PROVIDER_DAILY_CREDIT_BUDGET`, `SPORTSDATAIO_DAILY_CALL_BUDGET`
- `MLB_DAILY_CREDIT_RESERVE`, `PROVIDER_DAILY_CREDIT_RESERVE`, `SPORTSDATAIO_SOFT_RESERVE`
- `MLB_MAX_CALLS_PER_ACTION`, `SPORTSDATAIO_MAX_CALLS_PER_ACTION`
- `MLB_MAX_REFRESH_CALLS_PER_HOUR`, `PROVIDER_MAX_REFRESH_CALLS_PER_HOUR`
- `PROVIDER_BUDGET_WARNING_PERCENT`
- `PROVIDER_BUDGET_STOP_PERCENT`

## Execution Priority

When budget is constrained:

1. Game status near start
2. Pregame prices
3. Starters
4. Results for settlement
5. Team/player statistics
6. Diagnostics

Adaptive Refresh refuses provider-backed work when the budget check fails.

Phase 1 runtime certification adds a rolling-hour guard and stop-threshold guard to the existing per-action and soft-reserve checks. Status reads still report `providerCallsMade: 0`.
