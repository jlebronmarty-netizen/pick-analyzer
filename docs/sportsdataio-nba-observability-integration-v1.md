# SportsDataIO NBA Observability Integration V1

Last updated: 2026-07-13 22:07:57 -04:00

## Scope

SportsDataIO NBA Observability Integration V1 adds SportsDataIO NBA readiness and trial-isolation visibility to the existing runtime observability service.

It uses:

- SportsDataIO NBA Integration Readiness V1
- SportsDataIO NBA Trial Isolation Audit V1
- existing `sports_sync_jobs` and `prediction_history` runtime observability queries

## API Surface

The existing route is extended without creating a new endpoint:

- `GET /api/observability/runtime`

The response now includes a nested `sportsDataIoNba` section with:

- readiness status, blocker count and readiness routes
- readiness-area summaries
- safe next actions status, route, action count, production gate count and closed provider-call allowance
- odds endpoint preflight status, route, endpoint/entitlement gates and capped pilot constraints
- player-props endpoint preflight status, route, endpoint/settlement gates and capped pilot constraints
- player-stats migration preflight status, route, expected columns/indexes and go/no-go gates
- external blocker ledger status, route, owner counts, closed production gate counts and top blocker actions
- readiness evidence export validation status, route, check counts and errors
- production gate audit status, route, check counts and errors
- provider execution gate status, route, allowed-now calls and blocked domains
- external blocker resolution checklist status, route, required evidence counts and zero pre-resolution call allowance
- execution-readiness validation pass counts, guardrail statuses and one-to-many counter fixture
- production usage exclusion audit status, route, checked surfaces and prediction/backtest/training/confidence exclusion flags
- next-pilot approval checklist status, preflight route, owner counts, zero-call generation flag and pre-approval provider-call allowance
- external approval packet status, route, requested approval counts and constraints
- blocked-state audit status, completion-audit route, completion-claim guard and remaining blockers
- domain completion proof ledger status, route, domain proof counts and goal-blocking domains
- completion evidence matrix status, route, proof-gap counts and completion-blocking requirements
- objective audit status, route, remaining-work counts and external blocker summary
- response-shape audit status, contract route, check counts and errors
- surface consistency audit status, contract route, declared surfaces and checks
- trial-isolation totals and prediction leakage counts
- unavailable audit table warnings
- SportsDataIO NBA safety invariants
- provider-call accounting

## Dashboard

`RuntimeObservabilityPanel` renders the SportsDataIO NBA section from the existing runtime route. The canonical readiness source for new NBA readiness consumers is `/api/providers/sportsdataio/nba/readiness`; focused proof, evidence, objective-audit and safe-next-actions routes are compatibility aliases.

The panel surfaces:

- readiness blocker count
- safe next actions route and top safe actions
- odds endpoint preflight route and endpoint/entitlement gates
- player-props endpoint preflight route and endpoint/settlement gates
- player-stats migration preflight route and table/index summary
- external blocker ledger counts, blocker route and top safe actions
- evidence export validation status and route
- production gate audit status and route
- provider execution gate status and route
- external blocker resolution checklist status and route
- execution-readiness validation status
- production usage exclusion audit status and route
- next-pilot approval checklist status and preflight route
- external approval packet route and status
- blocked-state audit status and completion-audit route
- domain completion proof status and route
- completion evidence matrix status and route
- objective audit status and route
- response-shape audit status and contract route
- surface consistency audit status and contract route
- trial row count
- SportsDataIO row count
- isolation issue count
- prediction leakage count
- readiness-area statuses
- audit availability and production-readiness blocking state

`HistoricalImportEnginePanel` now renders one canonical Readiness Summary from `/api/providers/sportsdataio/nba/readiness` and uses the aggregate `nextPilotGatePreflights` data for odds, player-props and player-stats gates, removing separate client fetches to the three domain readiness endpoints.

## Safety

This module makes zero SportsDataIO provider calls, performs no mutations, creates no migration, writes no raw provider payloads and exposes no secrets.

Trial/scrambled rows remain `production_eligible=false`. The observability layer reports blockers, external evidence gaps, safe next actions and route, odds endpoint preflight route, player-props endpoint preflight route, player-stats migration preflight route, evidence-export validation and route, production gate audit status and route, provider execution gate status and route, external blocker resolution checklist state and route, execution-readiness validation state, production usage exclusion state and route, next-pilot approval requirements, next-pilot preflight route, external approval packet handoff state, blocked-state status, domain completion proof state and route, completion evidence proof gaps and route, objective audit status and route, response-shape audit status, surface consistency status and violations only; it does not remediate rows, persist predictions, run backtests, train models or improve production confidence from trial data.

Response-shape and surface-consistency audits now validate the domain completion proof ledger itself, including zero-call generation, handoff-domain coverage, completion-blocking state and zero pre-approval provider-call allowance. They also validate that the readiness evidence export route, production gate route, provider execution gate route, external blocker resolution route, execution-readiness validation, next-pilot preflight route, external approval packet route, completion-audit route, domain completion proof route, completion evidence route, objective audit route, safe next actions route and production usage exclusion route are present, valid, zero-call and exposed across readiness, historical import and runtime observability surfaces while external blockers remain open.

## Validation

`npm.cmd run build` completed with exit code 0 on 2026-07-13 after SportsDataIO NBA Player Props Endpoint Preflight API V1. The build compiled successfully, passed TypeScript and generated 198 static pages.
