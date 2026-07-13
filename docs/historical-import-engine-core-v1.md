# Historical Import Engine Core V1

## Status

Completed as a provider-independent, dry-run planning layer. It does not call external providers, consume quota, mutate production data or require a migration.

## Objective

Create the shared architecture for future historical imports before premium provider data is activated. The engine plans imports over normalized project concepts instead of provider-specific payload fields.

Provider data must flow through:

1. Provider adapter.
2. Normalized domain models.
3. Historical Import Engine checkpoints.
4. Normalized persistence.
5. Feature store and sport prediction engines.

## Implementation

- Service: `src/services/historical-import-engine.service.ts`
- Dashboard panel: `src/components/dashboard/HistoricalImportEnginePanel.tsx`
- Dashboard mount: `src/app/dashboard/page.tsx`
- APIs:
  - `GET /api/historical-import/plan`
  - `POST /api/historical-import/plan`
  - `GET /api/historical-import/health`
  - `GET /api/historical-import/jobs`

## Capabilities

Core V1 supports:

- provider-independent import job plans
- season and date-range scopes
- resumable checkpoint contracts
- retry policy reuse from Sync Reliability Framework V1
- idempotency keys
- dedupe keys
- provider route planning through Provider Intelligence V1
- batching by configurable day windows
- quota estimation
- progress shape for future execution
- partial failure isolation by checkpoint
- import validation
- read-only import health from existing Supabase metadata

## Dry-Run Behavior

All responses force `dryRun: true`.

If a request sends `dryRun: false`, Core V1 returns a warning and still does not execute a provider import. This is intentional because provider-backed historical execution needs explicit quota approval and execution guardrails.

`providerUsage.externalProviderCallsMade` is always `0`.

## Persistence

Core V1 does not add tables and does not write rows. It reads:

- `sports_sync_jobs`
- `provider_entity_mappings`

Future execution can use `sports_sync_jobs.metadata` for simple job state. A dedicated import checkpoint table may be added later if durable resume state needs more structure than existing sync job metadata can safely provide.

## Validation Rules

The planner validates:

- configured `sportKey`
- optional league registration
- supported historical import data types
- season or date-range scope presence
- valid `YYYY-MM-DD` date ranges
- date order
- provider capability route availability

Unsupported provider capabilities return blocked checkpoints and warnings instead of fabricated records.

## Quota Estimation

Estimated provider calls are calculated from planned executable checkpoints. A checkpoint normally represents one provider request for one data type and one date/season batch.

Quota impact is classified as:

- `none`: zero executable checkpoints
- `low`: small internal or low-cost plans
- `medium`: medium-cost provider or moderate call volume
- `high`: high-cost provider or large call volume

These are estimates only. Core V1 never executes the calls.

## Checkpoint Model

Each checkpoint includes:

- scope: `date_range` or `season`
- sport, league and provider
- data type
- season/date window
- status: `planned` or `blocked`
- cursor contract
- idempotency key
- dedupe key
- estimated provider calls
- warnings

The idempotency key combines sport, league, provider, data type, season and date window so execution can be safely retried later.

## Dashboard

The dashboard panel appears in Multi-Sport Coverage and shows:

- import health
- recent sync job metadata
- provider mapping count
- sample NBA dry-run plan
- checkpoint count
- executable vs blocked checkpoints
- quota estimate
- zero provider calls
- warnings

There is no execution button in Core V1.

## Future Execution Phase

A future provider-backed phase should add:

- explicit user-approved provider and quota caps
- protected execution routes
- durable checkpoint persistence if needed
- provider adapter execution through the Provider Adapter SDK
- per-checkpoint writes to normalized tables
- post-run quality delta reporting

That phase must remain incremental and must not run full historical imports without explicit approval.
