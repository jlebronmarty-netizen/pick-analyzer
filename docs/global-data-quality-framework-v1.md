# Global Data Quality Framework V1

Global Data Quality Framework V1 generalizes the NBA Phase A audit pattern into a read-only multi-sport service.

## Scope

- Audit shared Supabase sports tables across all registered sports.
- Detect missing events, missing odds, stale odds, missing scores, stale/running sync jobs, failed sync jobs, prediction/event mismatches and unsettled prediction backlog.
- Summarize coverage by sport.
- Produce a dry-run reconciliation plan without provider calls.
- Integrate with Provider Intelligence V1 for capability-aware planning.
- Preserve existing NBA data quality endpoints.

## Data Sources

The framework reads:

- `sport_events`
- `sports_odds_snapshots`
- `sports_sync_jobs`
- `prediction_history`

It does not write to production data and does not require a migration.

## Severity Levels

Issues use:

- `info`
- `warning`
- `error`
- `critical`

The global status is derived from the highest severity present.

## Coverage

Per sport, the framework reports:

- events
- completed scores
- odds snapshots
- predictions
- settled predictions

When no expected denominator exists, the framework uses a minimum denominator of `1` so empty states remain explicit and typed.

## Dry-Run Reconciliation Planning

`GET /api/reconciliation/plan` returns:

- per-sport estimated provider calls
- quota-impact classification
- selected provider from Provider Intelligence V1
- recommended batch size
- execution order
- blockers
- warnings

The plan is dry-run only and always returns `externalProviderCallsMade: 0`.

## APIs

`GET /api/data-quality/global`

Returns the cross-sport audit.

`GET /api/reconciliation/plan`

Returns the global dry-run reconciliation plan.

## Dashboard

`GlobalDataQualityPanel` appears in the Multi-Sport section and shows:

- sports checked
- issue count
- event, odds and prediction coverage
- dry-run provider call estimates
- top issues and recommendations

## Extension Guidelines

Sport-specific quality rules should be added as extensions that feed into the global issue model. Existing sport-specific endpoints, especially NBA Phase A endpoints, should remain compatible.

Provider-backed execution belongs in a separate approved module and must use capped windows, idempotent writes and explicit quota approval.
