# Refresh Status Contract

Canonical refresh status fields:

- `domain`
- `jobName`
- `state`
- `lastAttemptAt`
- `lastSuccessAt`
- `lastFailureAt`
- `nextScheduledAt`
- `recordsRead`
- `recordsWritten`
- `providerCalls`
- `blockerCode`
- `blockerMessage`
- `freshnessMinutes`

Domains: schedule, events, probable starters, odds, market snapshots, feature snapshots, model predictions, current board, recommendations, shadow projections, results, settlement, performance, learning.

User Mode should show the nearest relevant upcoming action, not only the next daily cron.

