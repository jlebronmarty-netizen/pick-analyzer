# Daily Autonomy Certification V1

Date: 2026-07-29

Status: READ-ONLY CERTIFICATION

No provider calls. No production mutation.

## Local Smoke Classification

Certification marker: `LOCAL_SMOKE_HARNESS_UNRELIABLE_ON_WINDOWS`.

Two independent bounded PowerShell wrappers exceeded their hard timeouts. The route itself is not proven defective; prior production and local smoke evidence already showed `/api/system/version` HTTP 200. This certification relies on build, validators, artifact consistency, stored operational evidence and previously certified production smoke for `/api/system/version`, dashboard, performance, operations and product routes. A future smoke-harness repair is out of scope.

| Automation | Route/service | Cadence | Auth | Idempotency | Enabled state |
| --- | --- | --- | --- | --- | --- |
| event/schedule sync | operating-day/historical import/sport sync routes | MLB daily plus manual/import paths | CRON_SECRET for writes | provider calls only in confirmed live mode | idempotent event/provider ids | MLB enabled; non-MLB not production scheduled |
| odds refresh | /api/operations/adaptive-refresh and operating-day execute | adaptive; desired 5-10 min near start not yet certified | CRON_SECRET for writes | provider calls in live mode | deterministic odds snapshots | MLB production path only |
| feature generation | feature store and prediction generation services | on prediction/import execution | protected routes for writes | writes feature snapshots when generation is approved | deterministic_key | MLB + preview sports |
| prediction generation | sport prediction routes/scripts | manual/protected scheduler depending sport | CRON_SECRET where mutating | prediction writes only when confirmed | idempotency keys | MLB production; NFL/NHL preview |
| result sync | /api/results/sync and result scripts | postgame/adaptive/manual | CRON_SECRET for writes | bounded provider calls when confirmed | provider result ids | MLB production path |
| settlement | /api/operating-day/[id]/settle, /api/settlement/* | oldest ready first | CRON_SECRET for writes | no provider unless canonical result path requires | settlement source/version | MLB production |
| learning evidence | ai-learning-lifecycle.service.ts | derived from settled rows | read-only/reporting; writes only via settlement lifecycle | 0 provider calls | prediction/result linkage | evidence accumulates; training disabled |
| Performance refresh | /api/performance* | read-on-demand/daily update route | protected for write updates | 0 provider calls | scoped production rows | available with MLB evidence |
| provider-budget monitoring | provider-budget.service.ts | read on operations calls | read-only status routes | 0 provider calls | budget ledger/config | available |

## Recovery

The MLB loop has idempotent/recoverable pieces for stale odds, late results and settlement backlog. Full multi-sport recovery is not certified because canonical results, settlement and learning loops are not complete for every sport.

Daily operation is currently possible for MLB core workflows only. Automatic model training does not occur; learning evidence is derived from settled prediction rows and future model training requires a separate explicit approval phase.
