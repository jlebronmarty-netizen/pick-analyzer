# MLB Automation

Status: Production Stable
Version: MLB Production Complete v1.0.0

## Automation Components

MLB automation is built around:

- Operating-day lifecycle services.
- `/api/operating-day/status`.
- `/api/operating-day/execute`.
- `/api/operating-day/automation/status`.
- `/api/cron/operating-day`.
- Autonomous daily operations status and protected execution surfaces.
- External scheduler fallback documentation.

## Freeze Rules

Automation behavior is frozen for MLB v1.0.0:

- Do not change stage policy.
- Do not weaken unsafe-timing checks.
- Do not auto-promote challenger models.
- Do not auto-change official-pick thresholds.
- Do not settle from incomplete/non-terminal games.
- Do not treat provider quota failures as success.

## Current Strategy

Automation remains conservative:

- Dry-run/status routes are read-only.
- Write execution is protected and confirmation/secret gated.
- Provider calls are budget aware.
- Checkpoints and idempotency prevent duplicate execution.
- Settlement waits for terminal game state.
- Learning remains suggestion/sample-gated.

## Adaptive Operations V1

Adaptive Operations extends this automation with read-only scheduler audit, freshness policy and provider-budget forecasting:

- `/api/operations/status` and `/api/operations/adaptive-refresh/status` report the current plan.
- `/api/operations/data-freshness` reports domain freshness for schedule, odds, results, context, predictions, recommendations and settlement.
- `/api/operations/adaptive-refresh` is plan-only and does not call providers or mutate predictions.
- Execution remains delegated to `/api/cron/operating-day`.

Current Vercel production configuration contains one scheduled cron: `/api/cron/operating-day` at `0 12 * * *` UTC. Adaptive Operations documents the cadence limitation and reports due work without fabricating high-frequency refresh execution.

## Production Validation

Validated production endpoints:

- `/api/operating-day/status`: HTTP 200, success true, providerCallsMade 0.
- `/api/operating-day/automation/status`: HTTP 200, success true, providerCallsMade 0.
- `/api/dashboard?mode=today&includeValidation=true`: HTTP 200, success true, providerCallsMade 0, remoteMutationsMade 0.

Known issue: the full autonomous daily operations composite route can be slow under broad external smoke tests and should be optimized only as a maintenance performance improvement.
# Automation Reliability V1

The production-safe scheduler remains `/api/cron/operating-day` via `vercel.json`.

Adaptive Refresh is now an execution bridge over the existing operating-day service:

- Read-only status remains public.
- `dryRun=false` requires `CRON_SECRET`.
- Provider budget is checked before execution.
- A bounded lock blocks duplicate equivalent runs.
- Results report provider calls and remote mutations.
