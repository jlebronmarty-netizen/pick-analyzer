# OR-01B Scheduler Workflow Ledger Reconciliation

Date: 2026-08-05

Starting commit: `5558ab21908d1a41274170a9f1f78a203dc6b9ea`

## Verdict

`OR_01B_WORKFLOW_LEDGER_RECONCILIATION_CERTIFIED`

OR-01B found a bounded workflow/app-ledger reconciliation defect, repaired it, and captured production proof that a GitHub scheduler success corresponds to durable app-side heartbeat/ledger evidence.

## Findings

- Workflow file: `.github/workflows/production-operating-day.yml`
- Workflow: Production Operating Day Scheduler
- Job: `refresh`
- Step: Call production operating-day scheduler
- Endpoint: `https://pick-analyzer.vercel.app/api/cron/operating-day?dryRun=${DRY_RUN}`
- Branch/commit source: scheduled run uses `main` head SHA.
- Secret name: `CRON_SECRET`
- Dry-run value: scheduled runs use `false`; workflow dispatch defaults to `false`.
- Timeout: GitHub job 6 minutes; curl max time 120 seconds.
- Concurrency: `production-operating-day-writer`, `cancel-in-progress: false`.
- Shell: GitHub hosted Ubuntu default shell with `set -euo pipefail`.

Authenticated logs for runs `30961154690` and `30965570325` were not available from this environment. GitHub log download returned HTTP 403.

## False-Success Defect

The workflow already failed on non-2xx HTTP status, but it did not validate the JSON response body. A transport-level 2xx response could be treated as successful without proving:

- `success === true`;
- non-failure application status;
- top-level request ID;
- adaptive execution invocation ID;
- selected action field;
- app-side scheduler heartbeat evidence for no-write success.

The app route also recorded scheduler heartbeat evidence only for successful dry-run observations. A valid non-dry-run `SUCCESS_NO_CHANGE` could return HTTP 200 while leaving the scheduler-health ledger stale. That is the direct reconciliation defect: transport-level workflow success was not reconciled to app-side scheduler health evidence.

## Repairs

- The workflow now parses the JSON response and exits nonzero when:
  - the response is invalid JSON;
  - `success` is not true;
  - application status is a failure/partial status such as `MISSED_REFRESH`;
  - request ID is missing;
  - adaptive execution ID is missing;
  - `selectedAction` is not present;
  - no-write success lacks scheduler heartbeat evidence.
- The protected route now records a scheduler heartbeat for successful protected writer invocations that produce no product-data mutation.
- The heartbeat metadata includes the adaptive invocation ID and marks the invocation as protected scheduler evidence.
- Live no-product-mutation heartbeat rows now normalize scheduler-only `SKIPPED` / `NOT_DUE` outcomes to `SUCCESS_NO_CHANGE` for cadence health.
- Operations Health now counts durable `scheduler_heartbeat` rows with protected-invocation metadata as successful scheduler evidence, even when an already-persisted row used the pre-normalized `SKIPPED` status.

## Production Proof

- Runtime commit deployed for original repair: `9af43b2d553ef3401883ebb7b8c736c58fc1fef8`.
- Manual workflow run: `31003827953`, trigger `workflow_dispatch`, branch `main`, commit `9af43b2d553ef3401883ebb7b8c736c58fc1fef8`, conclusion `success`.
- Scheduled workflow proof run: `31003990142`, trigger `schedule`, branch `main`, commit `9af43b2d553ef3401883ebb7b8c736c58fc1fef8`, conclusion `success`.
- Matched durable ledger row: `533d8b1e-a420-4c11-934f-02e01f3e8e0f`, action `scheduler_heartbeat`, completed at `2026-08-05T12:03:42.730+00:00`.
- Durable request/invocation ID: `cf420831-ad95-4943-83a7-326d9fdad5d7`.
- Selected action: `midday_refresh`.
- Provider calls: 0.
- Product data mutated: false.
- Database writes: 1 scheduler-owned operational heartbeat row.
- GitHub log download remained unavailable from this environment: HTTP 403.

## Remaining OR-01A Blockers

OR-01B is certified, but OR-01A and MC-08H do not pass yet. Production Operations Health still reported settlement closure `CRITICAL` and Product Readiness `CRITICAL` during final proof because completed prediction rows remain blocked by missing canonical result rows. MC-08H was not rerun.

## Guardrails

- Scheduler cadence unchanged.
- Provider budgets unchanged.
- Prediction, ranking, Official Pick, Rent Play, Moneyline, Smart Parlay, Kelly, settlement, learning, Replay and Current Era behavior unchanged.
- No provider calls were made by validation.
- No data mutations were made by validation.

## Final Gate

Production Pilot Week remains NOT READY until OR-01A passes all operational domains and MC-08H returns Production Ready: YES.
