# OE-003A Scheduler Health Semantics

Status: IMPLEMENTED PENDING PRODUCTION CERTIFICATION

Starting commit: `a91c434e0035517d80c147537ff38bc1ef6d371d`

## Scope

OE-003A implements the first bounded package from OE-003: separated operational health semantics. The change is semantic and observational. It does not implement the event-level refresh planner, provider budget ledger normalization, new scheduler cadence, or product freshness SLA enforcement.

No prediction formula, probability, confidence, edge, EV, Official Pick policy, settlement rule, learning rule, provider mapping, provider limit, scheduler cron, market certification, sport certification, or result-import behavior changed.

## Contract Inventory

| Source | Current field | Evidence | Classification | Consumer |
| --- | --- | --- | --- | --- |
| `operations-health.service.ts` | `scheduler.schedulerRunning`, `missedSchedulerIntervals`, `schedulerCadenceStatus` | protected lifecycle invocation timestamps | Scheduler Execution | `/api/operations/health`, dashboard health panel, settlement guarantee |
| `operations-health.service.ts` | `refreshOperations.providerStatus` | provider budget state only after OE-003A | Provider Budget | dashboard health panel |
| `operations-health.service.ts` | `freshness`, `currentBoard.dataFreshness` | stored market timestamps | Market Freshness | dashboard health panel, Morning checklist |
| `settlement-guarantee.service.ts` | `readyForSettlementRows`, `silentPendingRows`, `schedulerHealth` | prediction/result/event rows plus scheduler domain | Settlement Closure | `/api/operations/settlement-guarantee` |
| `provider-budget.service.ts` | `healthDomain`, provider pools | provider-specific app ledger and configured reserve | Provider Budget | `/api/providers/budget/status` |
| `adaptive-refresh-orchestrator.service.ts` | `healthDomains.marketFreshness/providerBudget/settlementClosure` | existing freshness and budget evidence | Market/Provider/Settlement | adaptive refresh and data freshness APIs |
| `mlb-operations-center.service.ts` | `healthSemantics` | canonical operations health domains | Product Readiness | `/mlb-operations` |
| `OperationsHealthPanel.tsx` | separated domain cards | `/api/operations/health` | Product Readiness | dashboard |

## Canonical Domains

`/api/operations/health` now exposes:

- `healthDomains.schedulerExecution`
- `healthDomains.marketFreshness`
- `healthDomains.providerBudget`
- `healthDomains.settlementClosure`
- `healthDomains.productReadiness`
- `healthDomains.overall`

Every domain includes:

- `status`
- `summary`
- `reasonCodes`
- `observedAt`
- `sourceTimestamps`
- `evidence`
- `blockers`
- `warnings`
- `nextExpectedAction`
- `humanInterventionRequired`

Overall status is derived transparently from domain severity. No arbitrary new numeric score was added.

## Separation Rules

- Scheduler execution health uses protected invocation evidence, cadence, missed intervals, failure rows and expected scheduler windows.
- Scheduler execution health does not read `odds_not_current`, market timestamps, Official Pick count, provider completeness or settlement row count.
- Market freshness uses stored odds/provider timestamps and Current Board freshness evidence.
- Market freshness does not fall back to scheduler invocation time, page fetch time, API `generatedAt` or unrelated prediction generation time.
- Provider budget health uses provider-specific budget evidence and keeps SportsDataIO, The Odds API and BSN source classes separate.
- Settlement closure can be healthy even if market odds are stale.
- Product readiness identifies its limiting domain instead of hiding the reason in a blended status.

## Compatibility

Existing fields are preserved:

- `scheduler.schedulerRunning`
- `scheduler.missedSchedulerIntervals`
- `scheduler.schedulerCadenceStatus`
- `refreshOperations.providerStatus`
- `providerBudgets.sportsdataio`
- `componentHealth`
- `freshness`
- `currentBoard`
- `readinessScore`

OE-003A adds fields but does not remove legacy consumers.

## API Integration

Updated APIs and services:

- `/api/operations/health`: canonical full five-domain contract.
- `/api/operations/adaptive-refresh/status`: additive `healthDomains` for market/provider/settlement evidence.
- `/api/operations/data-freshness`: additive freshness domain summaries.
- `/api/operations/settlement-guarantee`: additive independent domain summary and canonical domain evidence.
- `/api/operations/mlb-autonomous-operations`: additive `healthDomains` from operations health.
- `/api/providers/budget/status`: additive provider-specific `healthDomain`.
- `/mlb-operations`: visible separated operational health domain strip.

`/api/dashboard/today` already exposes Today and market readiness fields and was not changed to avoid introducing a circular operations-health dependency into the adaptive refresh path.

## Expected Example

The intended behavior is now representable:

- Scheduler Execution: `HEALTHY`
- Market Freshness: `DEGRADED`
- Provider Budget: `HEALTHY`
- Settlement Closure: `HEALTHY`
- Product Readiness: `DEGRADED`
- Reason: product readiness is limited by market freshness.

## Safety

- Provider calls introduced: 0.
- Provider credits consumed by implementation: 0.
- Database mutations introduced: 0.
- Prediction writes introduced: 0.
- Settlement writes introduced: 0.
- Learning writes introduced: 0.
- Scheduler cadence changed: false.
- Official Pick policy changed: false.
