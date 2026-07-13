# Runtime Observability V1

Runtime Observability V1 provides a read-only operational health layer for Pick Analyzer.

## Scope

- Aggregate sync job state from `sports_sync_jobs`.
- Aggregate prediction lifecycle and validation state from `prediction_history`.
- Include provider availability from Provider Intelligence V1.
- Report warning and error counts.
- Surface recent sync failures.
- Expose dashboard observability.

## Data Sources

- `sports_sync_jobs`
- `prediction_history`
- Provider Intelligence V1 static registry

The module does not write data and does not require a migration.

## API

`GET /api/observability/runtime`

Returns:

- sync job counts by status, type and sport
- recent sync failures
- prediction counts by sport, result, lifecycle and validation status
- provider status summary
- warning strings
- `externalProviderCallsMade: 0`

The route uses API Contract Hardening V1 and includes `requestId`.

## Dashboard

`RuntimeObservabilityPanel` appears in the Model Center section and shows:

- sync jobs
- failures
- predictions
- pending predictions
- provider calls made
- warnings
- sync status/type breakdown
- unavailable providers

## Persistence Boundary

This V1 module uses existing storage only. If future API-duration, warning-count or request-level observability needs persistence, add an explicit non-destructive migration for an operational events table.

## Future Work

- Persist API request durations.
- Add structured warning events.
- Track circuit breaker state from the Sync Reliability Framework.
- Add per-route error rates.
- Add model-generation duration tracking.
