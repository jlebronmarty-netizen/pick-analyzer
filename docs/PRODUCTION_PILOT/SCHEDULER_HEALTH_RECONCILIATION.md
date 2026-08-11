# Scheduler Health Reconciliation

## Verdict

`SCHEDULER_HEALTH_RECONCILIATION_LOCAL_PASS`

## Incident

During SDIO-EXIT-05, production had two successful natural Vercel primary
market-refresh executions:

- `2026-08-11T12:07:49Z`
- `2026-08-11T12:17:47Z`

Both were durable Stage 3 The Odds API product-primary acquisitions recorded in
`sports_sync_jobs`. However, `/api/operations/health` reported scheduler
`CRITICAL` using an older lifecycle timestamp of `2026-08-11T11:51:47Z`.

## Root Cause

The health query used `operating_day_lifecycle_events` as its scheduler cadence
source. Stage 3 product-primary acquisition evidence was recorded in
`sports_sync_jobs`, so real primary execution was present but invisible to the
health calculation.

Classification: `HEALTH_QUERY_STALE_SOURCE`

## Repair

Operations health now reconciles two read-only evidence sources:

- `operating_day_lifecycle_events` for protected lifecycle heartbeats.
- `sports_sync_jobs` for successful primary Stage 3 product-primary acquisition
  jobs.

The scheduler cadence still uses the existing interval and grace thresholds.
The repair changes evidence selection, not the definition of late or critical.

## Primary/Fallback Semantics

Vercel primary evidence has precedence for primary scheduler health. GitHub
fallback success or failure remains visible as fallback health evidence, but it
does not falsely mark a healthy primary scheduler as stopped.

Genuine primary missed intervals remain detectable because scheduler age is
still calculated from the latest primary success timestamp against the existing
configured cadence and grace window.

## Safety

No provider authority, Vercel config, scheduler cadence, prediction policy,
settlement, learning, or data-source mode changed.

Provider calls from certification: `0`

Production DB mutations from certification: `0`
