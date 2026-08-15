# NBA-03A Shadow Scheduler Preparation

Status: `NBA_03A_SHADOW_SCHEDULER_PREPARATION_CERTIFIED_READY_FOR_ACTIVATION_REVIEW`

This phase prepares the NBA Current Era Shadow scheduler contract without activating it. No cron entry, environment flag, production route, Official Pick surface, learning path, calibration path, bankroll path, notification path, Historical Replay path, MLB path or production scheduler automation was enabled.

## Existing Scheduler Architecture

Pick Analyzer currently uses Vercel Cron as the primary production scheduler for the protected operating-day endpoint:

- Vercel cron: `/api/cron/operating-day`, schedule `7-57/10 * * * *`
- GitHub Actions: fallback workflow calling the same protected endpoint
- Primary/fallback separation: primary recent-success lease
- Duplicate protection: provider action lock, operating-day unique date, result/prediction upsert guards
- Provider budget: `provider-budget.service.ts`
- Durable evidence: `operating_day_lifecycle_events` and `sports_sync_jobs`

NBA shadow collection should reuse those patterns but must remain a separate mode: `NBA_CURRENT_ERA_SHADOW`.

## Proposed Authority

Future primary authority: Vercel Cron.

Proposed disabled cron expression for activation review: `*/30 * * * *`.

This expression must not be added to production until a separate activation review is explicitly approved. GitHub fallback should not be added for NBA shadow collection until the primary path proves stable.

## Cadence And Budget

Recommended cadence: every 30 minutes only while future NBA events exist inside the monitored pregame window.

Rationale:

- The certified current-data refresh costs about 2 The Odds API calls.
- The Safe Canary price freshness threshold is 30 minutes.
- A 15-minute cadence would often duplicate no-op work.
- No-game windows must suppress provider calls entirely.

Initial policy:

- max provider calls per run: 2
- max runs per hour: 2
- max provider calls per hour: 4
- max runs per day: 24
- max provider calls per day: 48
- SportsDataIO calls: 0
- historical provider calls: 0

If budget is exhausted, the scheduler returns `PROVIDER_BUDGET_EXHAUSTED_NO_OP` and does not call the provider.

## Caps

Initial automated write cap: 5 rows per run.

Manual certification proved 10-row batches are safe, but automation should start smaller to avoid accumulating too many sportsbook variants before settlement evidence exists.

Additional caps:

- max per event per slate: 3
- max per event-market per slate: 2
- max per slate/day: 50

These caps are additive to the existing `NBA_03A_CROSS_EVENT_SHADOW_ACCUMULATION_POLICY_V1` and do not change its deterministic ordering.

## Pipeline

Future scheduler flow:

1. scheduler trigger
2. acquire lock
3. verify scheduler enabled
4. verify `NBA_CURRENT_ERA_SHADOW` mode
5. provider budget check
6. current NBA schedule/odds refresh
7. Safe Canary dry-run
8. exclude existing Current Era logical rows
9. apply `NBA_03A_CROSS_EVENT_SHADOW_ACCUMULATION_POLICY_V1`
10. apply strict per-run cap
11. revalidate selected candidates
12. deterministic Current Era persistence
13. exact readback summary
14. release lock
15. emit runtime audit

No Official Pick evaluation belongs in this pipeline.

## Fail-Closed States

Machine-readable no-op or fail-closed outcomes:

- `DISABLED_NO_OP`
- `LOCK_CONFLICT_NO_OP`
- `PROVIDER_BUDGET_EXHAUSTED_NO_OP`
- `NO_CURRENT_EVENTS_NO_OP`
- `STALE_ODDS_NO_OP`
- `NO_MODEL_MATCH_NO_OP`
- `ALL_CANDIDATES_ALREADY_PERSISTED_NO_OP`
- `PROVIDER_FAILURE_FAIL_CLOSED`

The scheduler must not fall back to SportsDataIO, historical odds, trial evidence or fabricated odds.

## Lock And Audit

Lock key: `nba_current_era_shadow_scheduler`.

The future implementation should use the same protected-runtime lock/ledger pattern used by the operating-day scheduler. Prediction-level idempotency remains required, but it is secondary and must not be the only concurrency control.

Every run should record:

- run ID
- scheduler version
- policy version
- start and finish time
- lock state
- provider calls
- events fetched
- price candidates
- model matches
- selected candidates
- inserted rows
- reused/already-exists rows
- skip reasons
- Current Era count before/after
- isolation result

## Rollback

Kill switch: keep `NBA_CURRENT_ERA_SHADOW_SCHEDULER_ENABLED` unset or set to `false`.

Rollback is config-only and requires no schema change.

## Settlement And Performance

Generation and settlement remain separate.

Current performance readiness: `INSUFFICIENT_CURRENT_ERA_SETTLED_SAMPLE`.

There are 31 pending Current Era Shadow rows and 0 settled rows. No accuracy, ROI, calibration or recommendation claims are valid from this pending sample.

## Activation Gate

Scheduler activation requires a later explicit authorization after:

- scheduler prep validator PASS
- lock/concurrency PASS
- provider budget PASS
- policy cap PASS
- fail-closed PASS
- idempotency PASS
- isolation PASS
- kill switch PASS
- production deployment aligned
- explicit user authorization

Preparation is complete, but activation is not performed in this phase.
