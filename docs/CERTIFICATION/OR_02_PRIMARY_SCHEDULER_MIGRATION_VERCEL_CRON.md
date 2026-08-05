# OR-02 Primary Scheduler Migration - Vercel Cron

Status: `DEPLOYMENT_PENDING`

Starting commit: `448948450fbf099eae63a49cdb7b9f4d084baae1`

## Human Decision

Vercel Pro is active and Vercel Cron is approved as the primary scheduler.

## Architecture

Primary path:

```text
Vercel Cron
-> GET /api/cron/operating-day
-> Protected Operating Day
-> Adaptive Planner
-> Planner Continuity
-> Mission Control
```

Fallback path:

```text
GitHub Actions
-> POST /api/cron/operating-day?dryRun=false&scheduler=github-fallback
-> primary_scheduler_recent_success_lease
-> same protected endpoint
-> safe exit when Vercel primary is current
```

## Implementation

- `vercel.json` now registers `/api/cron/operating-day` at `7-57/10 * * * *`.
- `GET /api/cron/operating-day` is classified as `VERCEL_OPERATING_DAY_CRON_PRIMARY`.
- GitHub Actions remains scheduled at the same cadence but is classified as `GITHUB_ACTIONS_PRODUCTION_OPERATING_DAY_FALLBACK`.
- GitHub fallback checks recent Vercel primary success evidence before running planner work.
- If Vercel primary evidence is current, GitHub returns `SUCCESS_NO_CHANGE`, makes 0 provider calls, makes 0 remote mutations and reports `PRIMARY_RECENT_SUCCESS_LEASE`.
- Both schedulers use the same protected endpoint, `CRON_SECRET`, adaptive planner, planner continuity caps, provider budget guard and provider action locks.

## Guardrails

- Prediction logic unchanged.
- Official Pick policy unchanged.
- Kelly logic unchanged.
- Settlement rules unchanged.
- Learning weights unchanged.
- Provider budgets unchanged.
- Planner logic unchanged except scheduler-source ownership and fallback lease.
- No second provider writer is introduced.

## Certification Gate

OR-02 cannot reach final PASS until production proves:

1. Three consecutive automatic Vercel primary executions.
2. Scheduler `HEALTHY`.
3. Market Freshness `HEALTHY`.
4. Settlement `HEALTHY`.
5. Product Readiness `HEALTHY`.
6. Operations `HEALTHY`.
7. MC-08H rerun returns Production Ready `YES`.
8. Production Pilot Week is marked `READY` but not started.

## Current Classification

`EXTERNAL_WAIT_VERCEL_PRIMARY_SUSTAINED_PROOF`

Production Pilot Week was not started. MC-03 was not started.
