# NBA-03A Shadow Scheduler Status Precheck

Status: `NBA_03A_SHADOW_SCHEDULER_STATUS_PRECHECK_CERTIFIED_READY_FOR_PUBLICATION`

## Purpose

The published NBA shadow scheduler route could only report `NBA_CURRENT_ERA_SHADOW_SCHEDULER_ENABLED` while disabled. Once production set the flag to `true`, an authenticated request would enter the real scheduler execution path. That made the activation state unobservable without risking provider calls and prediction writes.

This phase adds a protected read-only status mode to the existing route:

- `/api/cron/nba-current-era-shadow?status=precheck`
- `/api/cron/nba-current-era-shadow?mode=status`

The normal route path remains the scheduler execution path for future Vercel Cron use. The status modes never call current-data sync, provider acquisition, Safe Canary write mode, prediction persistence, active scheduler lock acquisition, or audit job creation.

## Authentication

The status mode reuses the route's existing `CRON_SECRET` protection. Unauthenticated requests fail closed with `401 UNAUTHORIZED`.

## Returned State

The precheck reports:

- scheduler mode, version, and policy version
- scheduler enabled flag name and observed boolean state
- completed canary runs
- canary inserted rows
- review and hard-limit guards
- pending Current Era shadow rows
- pending guard limit and state
- current Current Era shadow count
- read-only scheduler lock status
- per-run write cap
- review-after-runs threshold
- hard max runs
- total canary row cap
- provider budget limits
- machine-readable precheck classification

## Zero-Side-Effect Contract

The precheck reports these counters as zero by construction:

- provider calls
- current-data sync invocations
- prediction writes
- run-counter mutations
- audit job writes
- scheduler lock acquisitions

It does not add the NBA Vercel Cron entry, enable cron, activate continuous operation, or create `CURRENT_ERA_SHADOW` rows.

## Classifications

- `SCHEDULER_PRECHECK_READY`
- `SCHEDULER_PRECHECK_DISABLED`
- `SCHEDULER_PRECHECK_REVIEW_REQUIRED`
- `SCHEDULER_PRECHECK_HARD_LIMIT`
- `SCHEDULER_PRECHECK_PENDING_GUARD`
- `SCHEDULER_PRECHECK_LOCK_ACTIVE`

## Next Step

Publish and deploy this status precheck. After production aligns, call the protected precheck URL to verify `schedulerEnabled=true` and clear canary guards. Only then add the NBA Vercel Cron entry for the already-authorized two-natural-run activation canary.
