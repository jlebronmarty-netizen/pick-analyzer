# Provider Budget Refresh Strategy V1.1

Adaptive operations reuse `provider-budget.service.ts`.

Budget modes:

- `NORMAL`: estimated remaining calls are healthy.
- `CONSERVATIVE`: remaining calls are at or below 15% of the daily budget.
- `CRITICAL`: two or fewer estimated calls remain.
- `EXHAUSTED`: no estimated calls remain.

The Adaptive Refresh APIs only forecast work and report whether the plan fits the budget. They do not call SportsDataIO. Provider-backed execution remains in the existing Operating Day pipeline, where budget checks and local action locks already exist.

Status reads report `providerCallsMade: 0`.

## MLB Freshness Cadence

The adaptive orchestrator now applies MLB game-day windows without changing Current Board generation:

- No slate: skip wasteful odds polling.
- Early game day: `MLB_ODDS_REFRESH_MINUTES_EARLY`, default 60 minutes.
- Pregame: `MLB_ODDS_REFRESH_MINUTES_PREGAME`, default 15 minutes.
- Final 90 minutes: `MLB_ODDS_REFRESH_MINUTES_NEAR_START`, default 10 minutes.
- Live score/status: `MLB_SCORE_REFRESH_MINUTES_LIVE`, default 5 minutes.
- Postgame results: `MLB_RESULTS_REFRESH_MINUTES_POSTGAME`, default 15 minutes.

Market prices become stale after `freshMinutes * MLB_ODDS_AGING_MULTIPLIER`, default multiplier 2. A market age near 267 minutes is therefore stale during every active MLB betting window and will appear as due/overdue instead of acceptable.

Unsupported lineup data remains `NOT_SUPPORTED` and does not schedule provider work.
