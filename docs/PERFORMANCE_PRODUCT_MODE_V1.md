# Performance Product Mode V1

Date: 2026-07-23

## Mission

Performance Product Mode is the default user-facing performance contract. It reports only production-evaluable terminal prediction outcomes:

- Win
- Loss
- Push

The default scope excludes Legacy, Ignored, Historical, Replay, Shadow, Cancelled, Voided, test-like, post-start invalid and unresolved rows. Those lifecycle families remain available only through Advanced Settlement/Audit diagnostics.

## Scope

Production metrics now use `productionPerformanceRows` and `productionEvaluableRows` in `ai-performance-center.service.ts`. Missing Settlement V2 metadata is not a reason to hide a row when its canonical deterministic result is Win, Loss or Push and it is not classified as audit-only.

Current certified production scope remains:

- MLB settled: 593
- NBA settled: 27
- Production settled: 620
- Wins: 304
- Losses: 316
- Pushes: 0
- Production accuracy: 49.03%

Historical/Replay rows remain separate from production metrics. The 38 Historical/Replay outcomes are not included in production settled totals.

## Zero-Sample Semantics

Accuracy is nullable. The UI must display `N/A` when eligible settled sample is zero and use the wording:

`No eligible predictions settled in this period.`

Accuracy may display `0%` only when settled Win/Loss sample is greater than zero and wins are zero.

This applies to:

- Today
- Yesterday
- Last 7 Days
- Last 30 Days
- AI Evolution
- per-sport summaries
- shadow rows
- timeline periods
- historical/replay audit views when their eligible sample is zero

## Timeline Contract

Default timeline is product-time-window based:

- Today
- Yesterday
- Last 7 Days
- Last 30 Days
- Season
- Lifetime

Each period reports Generated, Production Settled, Wins, Losses, Pushes and Accuracy or `N/A`. Generated never displays a Win/Loss record.

## Prediction History

`/api/performance/history` defaults to production-evaluable settled rows only. Default history includes Win, Loss and Push; it excludes Legacy, Ignored, Historical, Replay, Shadow, cancelled/voided, test-like and unresolved rows. Ordinary filters still apply for sport, category, lifecycle and confidence.

Root cause of the broken user contract was that the old default history and timeline payloads exposed lifecycle-audit rows first. The history endpoint returned Ignored rows before product rows, and the timeline mixed 620 production settled rows with 38 Historical/Replay rows.

## Advanced Settlement Audit

Advanced diagnostics preserve audit-only lifecycle counts:

- Legacy
- Ignored
- Historical/Replay
- Shadow
- Cancelled/Voided
- Unknown
- Awaiting Settlement
- Reconciliation failures

These counts are diagnostic evidence, not product performance.

## Guardrails

This phase does not change:

- Prediction probabilities
- Prediction Engine logic
- Learning Brain weights
- Official Pick policy
- Current Board eligibility
- Best Value gates
- Settlement outcomes
- Historical feature snapshots
- Historical Replay

Provider calls and external sports API calls remain 0 for this product-mode evaluation path.
