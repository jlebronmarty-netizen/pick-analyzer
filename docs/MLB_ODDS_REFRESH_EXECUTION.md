# MLB Odds Refresh Execution

Status: Repaired
Version: V1
Last updated: 2026-07-19

## Root Cause

A due adaptive `midday_refresh` delegated to the existing operating-day executor without preserving provider-backed refresh intent. The SportsDataIO preview path then accepted a completed `operating_day_odds_capture` checkpoint as reusable and skipped `GameOddsByDate`, so a legitimately due odds refresh could return with `providerCallsMade=0`, `providerChecked=false` and no mutations.

## Repair

The adaptive executor now passes `forceRefresh=true` when a provider-backed due domain is selected. `executeOperatingDay(midday_refresh)` forwards that flag to the existing SportsDataIO MLB prospective preview service. The preview service bypasses only the odds checkpoint for forced provider-backed execution, calls the canonical SportsDataIO `GameOddsByDate` endpoint, normalizes through the existing MLB odds normalizer, persists through `sports_odds_snapshots`, and returns explicit provider-check evidence.

No prediction formulas, recommendation thresholds, Current Board policy, champion state, V7 state, Projection Integrity, settlement or learning logic changed.

## Result Contract

Provider-backed odds refresh evidence includes:

- `providerCheckRequired`
- `providerCheckAttempted`
- `providerCheckCompleted`
- `provider`
- `endpoint`
- `callsMade`
- `responseTimestamp`
- `sourceLatestTimestamp`
- `rowsReceived`
- `snapshotsCompared`
- `changesDetected`
- `rowsInserted`
- `rowsUpdated`
- `rowsSkipped`
- `downstreamRebuildRequired`
- `failureReason`

`SUCCESS_NO_CHANGE` is valid only after `providerCheckCompleted=true`. If required provider work is not attempted, the adaptive result remains `MISSED_REFRESH`.

## Freshness

Operational freshness separates `lastProviderCheckAt`, `lastProviderSuccessAt`, `lastOddsChangeAt`, `latestSourceTimestamp`, `ageSinceProviderCheckMinutes` and `ageSinceMarketChangeMinutes`. A successful no-change provider check can make odds operationally current without pretending a price changed.
