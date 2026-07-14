# Runtime Observability V1

Runtime Observability V1 provides a read-only operational health layer for Pick Analyzer.

## Scope

- Aggregate sync job state from `sports_sync_jobs`.
- Aggregate prediction lifecycle and validation state from `prediction_history`.
- Include provider availability from Provider Intelligence V1.
- Include SportsDataIO NBA readiness and trial-isolation observability from zero-call readiness services and stored Supabase audit rows.
- Report warning and error counts.
- Surface recent sync failures.
- Expose dashboard observability.

## Data Sources

- `sports_sync_jobs`
- `prediction_history`
- Provider Intelligence V1 static registry
- SportsDataIO NBA Integration Readiness V1
- SportsDataIO NBA Trial Isolation Audit V1 stored-table scan

The module does not write data and does not require a migration.

## API

`GET /api/observability/runtime`

Returns:

- sync job counts by status, type and sport
- recent sync failures
- prediction counts by sport, result, lifecycle and validation status
- provider status summary
- SportsDataIO NBA readiness blocker counts, readiness routes and safety invariants
- SportsDataIO NBA safe next actions route, action counts, production gate counts and closed provider-call allowance
- SportsDataIO NBA odds endpoint preflight route, endpoint/entitlement gates and capped pilot constraints
- SportsDataIO NBA player-props endpoint preflight route, endpoint/settlement gates and capped pilot constraints
- SportsDataIO NBA player-stats migration preflight route, expected column/index counts and migration go/no-go gates
- SportsDataIO NBA external blocker ledger summary, route, owner counts and closed production gate counts
- SportsDataIO NBA readiness evidence export validation status, route and check counts
- SportsDataIO NBA production gate audit status, route, check counts and errors
- SportsDataIO NBA provider execution gate status, route, allowed-now calls and blocked domains
- SportsDataIO NBA external blocker resolution checklist status, route, required evidence counts and zero pre-resolution call allowance
- SportsDataIO execution-readiness validation pass counts, guardrail statuses and one-to-many counter fixture
- SportsDataIO NBA production usage exclusion audit status, route, checked surfaces and prediction/backtest/training/confidence exclusion flags
- SportsDataIO NBA next-pilot approval checklist status, preflight route, owner counts and zero pre-approval call count
- SportsDataIO NBA external approval packet status, route, requested approval counts and handoff constraints
- SportsDataIO NBA blocked-state audit status, completion-audit route, completion-claim guard and remaining blockers
- SportsDataIO NBA domain completion proof ledger status, route, domain counts and goal-blocking domains
- SportsDataIO NBA completion evidence matrix status, route, proof-gap counts and completion-blocking requirements
- SportsDataIO NBA objective audit status, route, remaining-work counts and external blocker summary
- SportsDataIO NBA readiness response-shape audit status, contract route, check counts and errors
- SportsDataIO NBA surface consistency audit status, contract route, surface counts and checks
- SportsDataIO NBA trial-isolation totals, prediction leakage counts, warnings and errors
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
- SportsDataIO NBA readiness blockers
- SportsDataIO NBA safe next actions and route
- SportsDataIO NBA odds endpoint preflight route and endpoint/entitlement gates
- SportsDataIO NBA player-props endpoint preflight route and endpoint/settlement gates
- SportsDataIO NBA player-stats migration preflight route and table/index summary
- SportsDataIO NBA external blocker ledger and blocker route
- SportsDataIO NBA evidence export validation and route
- SportsDataIO NBA production gate audit and route
- SportsDataIO NBA provider execution gate and route
- SportsDataIO NBA external blocker resolution checklist and route
- SportsDataIO execution-readiness validation
- SportsDataIO NBA production usage exclusion audit and route
- SportsDataIO NBA next-pilot approval checklist and preflight route
- SportsDataIO NBA external approval packet route and status
- SportsDataIO NBA blocked-state audit and completion-audit route
- SportsDataIO NBA domain completion proof ledger and route
- SportsDataIO NBA completion evidence matrix and route
- SportsDataIO NBA objective audit and route
- SportsDataIO NBA response-shape audit and contract route
- SportsDataIO NBA surface consistency audit and contract route
- SportsDataIO NBA trial-isolation and prediction-leakage counts

SportsDataIO NBA observability is displayed inside the existing runtime panel. The safe next actions route, odds endpoint preflight route, player-props endpoint preflight route, player-stats migration preflight route, external blocker ledger and blocker route, evidence export validation and route, production gate audit and route, provider execution gate and route, external blocker resolution checklist and route, execution-readiness validation, production usage exclusion audit and route, next-pilot approval checklist and preflight route, external approval packet route, blocked-state audit, domain completion proof ledger and route, completion evidence matrix and route, objective audit and route, response-shape audit and contract route plus surface consistency audit and contract route are read from zero-call readiness services and rendered as operational state only. It does not add a new provider call, mutation, migration, production prediction path, backtest path, model-training path or production confidence lift.

## Persistence Boundary

This V1 module uses existing storage only. If future API-duration, warning-count or request-level observability needs persistence, add an explicit non-destructive migration for an operational events table.

## Future Work

- Persist API request durations.
- Add structured warning events.
- Track circuit breaker state from the Sync Reliability Framework.
- Add per-route error rates.
- Add model-generation duration tracking.
