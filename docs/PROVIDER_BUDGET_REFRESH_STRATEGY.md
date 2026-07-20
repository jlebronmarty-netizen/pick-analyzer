# Provider Budget Refresh Strategy V1

Adaptive operations reuse `provider-budget.service.ts`.

Budget modes:

- `NORMAL`: estimated remaining calls are healthy.
- `CONSERVATIVE`: remaining calls are at or below 15% of the daily budget.
- `CRITICAL`: two or fewer estimated calls remain.
- `EXHAUSTED`: no estimated calls remain.

The Adaptive Refresh APIs only forecast work and report whether the plan fits the budget. They do not call SportsDataIO. Provider-backed execution remains in the existing Operating Day pipeline, where budget checks and local action locks already exist.

Status reads report `providerCallsMade: 0`.
