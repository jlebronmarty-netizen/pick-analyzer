# Provider Budget Policy

Status: Implemented
Version: V1

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
- Last provider call

## Execution Priority

When budget is constrained:

1. Game status near start
2. Pregame prices
3. Starters
4. Results for settlement
5. Team/player statistics
6. Diagnostics

Adaptive Refresh refuses provider-backed work when the budget check fails.
