# Pregame Scheduler Coverage & Execution Timing V1

Status: Implemented as a read-only operational validation layer.

## Scope

This phase validates scheduler timing and pregame coverage from persisted evidence only. It does not modify prediction probabilities, Official Pick policy, Learning Brain weights, Historical Feature Store data, settlement outcomes, Current Board policy, Historical Replay or Historical Feature Backfill Phase 2A.

## Scheduler Timing

| Scheduler | Frequency | Timezone | Route | Notes |
| --- | --- | --- | --- | --- |
| Vercel Operating Day Cron | Daily, `0 12 * * *` | UTC; operating day resolves America/Puerto_Rico | `/api/cron/operating-day` | Safe hosting-compatible baseline cron. |
| GitHub Production Operating Day Runtime | `7,22,37,52 * * * *` | UTC | `/api/cron/operating-day?dryRun=false` | Four protected calls per hour into the same adaptive operating-day route. |
| GitHub Production Operating Day Heartbeat | `14,44 * * * *` | UTC | `/api/cron/operating-day?dryRun=false` | Secondary heartbeat caller with the same concurrency group. |
| Manual legacy cron routes | Manual only | Route-specific | `/api/cron/daily-sync`, `/api/cron/master-sync`, `/api/cron/capture-predictions` | Retained as manual fallback only. |

The observed average execution duration from persisted lifecycle/job evidence is about `0.08` minutes.

## Coverage Evidence

Read-only validation on 2026-07-24 reported:

- Today: 5 scheduled games, 5 predicted games, 0 valid pregame games, 5 skipped/rejected games, 0% valid-pregame coverage.
- Today rejection reasons: 4 `GAME_ALREADY_STARTED`, 1 `INVALID_CUTOFF`.
- Today average prediction lead time before cutoff: `-211.11` minutes, meaning persisted predictions landed after cutoff on average.
- Yesterday: 17 scheduled games, 17 predicted games, 3 valid pregame games, 14 skipped/rejected games, 17.65% valid-pregame coverage.
- Yesterday rejection reasons: 14 `GAME_ALREADY_STARTED`, 3 `VALID_PREGAME`.

This phase intentionally does not hide the failure state: future operating-day readiness is not certified until scheduled runtime evidence shows valid pregame coverage before cutoff.

## Retry And Idempotency

Retries reuse the existing protected `/api/cron/operating-day` route. The route delegates to Adaptive Refresh and the Operating Day executor, preserving:

- Provider budget guard.
- Refresh-window guard.
- Provider action lock.
- Existing persistence idempotency keys.
- Shared cutoff classifier.

Persisted duplicate scan results:

- Today duplicate idempotency keys: 0.
- Today duplicate current prediction identities: 0.
- Yesterday duplicate idempotency keys: 0.
- Yesterday duplicate current prediction identities: 0.

## Product Surfaces

The new read-only contract is exposed through:

- `pregame-scheduler-coverage.service.ts`
- `/api/recommendation-pipeline/trace`
- `/api/performance/history`
- Dashboard Today's Story and Current AI Pipeline
- AI Operations Scheduler Coverage panel

Provider calls and remote mutations from the validation read model: 0.
