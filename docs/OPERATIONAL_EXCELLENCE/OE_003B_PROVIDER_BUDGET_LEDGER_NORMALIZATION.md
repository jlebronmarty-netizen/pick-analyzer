# OE-003B Provider Budget Ledger Normalization

Status: IMPLEMENTED PENDING PRODUCTION CERTIFICATION

Starting commit: `6583627facfad84e0502d9c570b59b1bf7f73140`

## Scope

OE-003B normalizes provider-budget evidence and dry-run authorization contracts. It prepares later event-level refresh planning, but does not implement that planner and does not increase provider cadence.

No prediction formula, probability, confidence, edge, EV, Official Pick policy, settlement rule, learning rule, provider mapping, provider subscription, scheduler cadence, refresh cadence, sport certification, market certification or result-import behavior changed.

## Canonical Implementation

The canonical implementation remains `src/services/provider-budget.service.ts`. No parallel ledger was created.

Current persistence is sufficient for this phase:

- `operating_day_lifecycle_events.provider_calls_made`
- `operating_day_lifecycle_events.provider_calls_planned`
- `sports_sync_jobs.metadata.externalCallsUsed`
- `sports_sync_jobs.metadata.checkpoint.providerCallsUsed`

No schema migration was required because OE-003B adds normalized read contracts over existing app-ledger evidence.

## Budget Contract

`/api/providers/budget/status` now exposes additive `canonicalBudget` and `providerPools` objects.

Canonical fields include:

- `providerId`
- `providerDisplayName`
- `sportKey`
- `coveredSports`
- `periodType`
- `periodStart`
- `periodEnd`
- `resetAt`
- `resetSemantics`
- `limit`
- `used`
- `remaining`
- `protectedReserve`
- `usableRemaining`
- `unitType`
- `evidenceLevel`
- `evidenceSource`
- `observedAt`
- `status`
- `reasonCodes`
- `largestConsumer`
- `estimatedCurrentPeriodUsage`
- `estimatedNextActionCost`
- `canExecuteNextAction`
- `humanInterventionRequired`

Unknown quota evidence remains `null` or `UNKNOWN`. It is not coerced to zero.

## Provider Pools

| Provider | Unit Type | Evidence | Reset | Reserve | Authorization Source |
| --- | --- | --- | --- | --- | --- |
| SportsDataIO | `HTTP_REQUEST` | allowance/reset configured-only, app-ledger usage read from production tables | `CONFIGURED_ONLY_LOCAL_DAY` | 150 configured calls | exact SportsDataIO pool only |
| The Odds API | `CREDIT` | current balance/reset unknown unless proven by headers or stored evidence | `UNKNOWN_NOT_RECHECKED` | 2000 configured credits | exact The Odds API pool only |
| BSN | `UNKNOWN` | official page, CSV/manual, or future-provider source-specific paths | source-specific | unknown | exact BSN/source pool only |

SportsDataIO and The Odds API are never combined for authorization. Aggregate displays are observational only.

## Cost Model

Endpoint/action cost evidence is normalized as dry-run metadata:

- SportsDataIO slate/event discovery, odds refresh, roster sync, results sync and historical import expose HTTP request estimates with `CONFIGURED_ONLY` evidence.
- The Odds API sport/event odds, scores/results, markets, regions, bookmakers and historical-like actions expose request estimates and unknown/variable credit cost unless an explicit estimate is supplied.
- BSN source classes remain unknown/source-specific.

The contract distinguishes `requestCountEstimate` from `quotaUnitEstimate`.

## Authorization

`authorizeProviderBudget` returns:

- `ALLOW`
- `ALLOW_WITH_WARNING`
- `DENY_RESERVE_PROTECTED`
- `DENY_EXHAUSTED`
- `DENY_UNKNOWN_COST`
- `DENY_UNKNOWN_BUDGET`
- `DRY_RUN_ONLY`

Unknown cost or unknown budget fails closed for live authorization. Dry-run forecasts remain allowed and make zero provider calls.

## Dry-Run Forecast API

The existing `/api/operations/provider-budget-forecast` route now accepts:

- `provider`
- `sportKey`
- `action`
- `eventCount`
- `markets`
- `regions`
- `bookmakers`
- `expectedCadenceMinutes`
- `timeWindowMinutes`
- `estimatedCost`

It returns estimated HTTP requests, estimated quota units, evidence level, current usable remaining, expected remaining after action, reserve impact, authorization result, warnings and unknown-cost factors.

The route is read-only and reports `providerCallsMade: 0`, `providerCreditsConsumed: 0` and `remoteMutationsMade: 0`.

## API Integration

Updated surfaces:

- `/api/providers/budget/status`
- `/api/operations/provider-budget-forecast`
- `/api/operations/health`
- `/api/operations/adaptive-refresh/status`
- `/api/operations/data-freshness`
- `/api/operations/mlb-autonomous-operations`
- `/mlb-operations`

Legacy fields such as `callsMadeToday`, `estimatedCallsRemaining`, `hardRemaining`, `providerBudgets.sportsdataio` and `healthDomain` remain available.

## Safety

- Provider calls introduced: 0.
- Provider credits consumed by implementation: 0.
- Database mutations introduced: 0.
- Prediction writes introduced: 0.
- Settlement writes introduced: 0.
- Learning writes introduced: 0.
- Scheduler cadence changed: false.
- Refresh cadence changed: false.
- Official Pick policy changed: false.
