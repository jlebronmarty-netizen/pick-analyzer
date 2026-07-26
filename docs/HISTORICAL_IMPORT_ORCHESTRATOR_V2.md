# Historical Import Orchestrator V2

Status: Locally implemented as a wrapper around Historical Import Engine Core.

`GET /api/data-foundation/import-orchestrator` plans historical import orchestration without executing provider transport or persistence. It delegates checkpoint creation, route planning, idempotency and domain manifests to the existing `historical-import-engine.service.ts`.

## Modes

| Mode | Behavior in this autonomous run |
| --- | --- |
| `PLAN_ONLY` | Returns plan, checkpoints, estimated provider calls, retry/dedupe/reconciliation contracts. |
| `DRY_RUN` | Same as plan-only; no provider calls and no mutations. |
| `LOCAL_EXECUTION` | Contract-ready but execution blocked in this run. |
| `MANUAL_PRODUCTION_READY` | Produces runbook-ready blockers; production execution remains manual and unapproved. |

## Contract

The orchestrator supports:

- plan
- dry-run
- checkpoint
- resume
- retry
- idempotency
- dedupe
- quota budget
- provider-call accounting
- mutation accounting
- sport-specific adapter planning
- season/date windows
- validation before persistence
- reconciliation after persistence

## Safety

- Provider calls: 0
- Remote mutations: 0
- Production mutations: 0
- Historical odds execution: not allowed
- Production SQL: not allowed
- Scheduled ingestion: not enabled

## Certification

Local validation:

- `GET /api/data-foundation/import-orchestrator?validate=true`
- `GET /api/data-foundation/import-orchestrator?mode=PLAN_ONLY`
- `npm.cmd run build`
- `git diff --check`

Certification markers:

`HISTORICAL_IMPORT_ORCHESTRATOR_V2_PASS`

`CHECKPOINT_RESUME_PASS`

`IMPORT_IDEMPOTENCY_PASS`
