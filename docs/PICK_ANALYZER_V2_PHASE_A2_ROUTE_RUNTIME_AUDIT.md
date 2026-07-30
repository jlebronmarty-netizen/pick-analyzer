# Pick Analyzer V2 Phase A2 Route Runtime Audit

Generated: 2026-07-30T22:51:37.187Z
Baseline commit: 048b6dbf812f6c6968c10f991572f657d685c9a8

## Verdict

PASS - scoped route/runtime integrity certified with no local server smoke.

## Scope

Bounded static and build-backed route/runtime audit for active and navigation-linked product routes, core API support routes, shared dashboard/product route utilities and generated A1 route inventory. No local server smoke was run.

## Counts

- Page routes reviewed: 22
- API routes reviewed: 48
- Navigation targets reviewed: 20
- Files scanned by bounded validator: 1137

## Defects

| Severity | Route | Defect | Repair |
| --- | --- | --- | --- |
| P2 | `/dashboard#model-center` | Dashboard navigation previously pointed Model Health at a missing #model-center hash target. | Model Health now links to the existing /dashboard#advanced-details section. |

## Route Matrix

| Route | Type | Navigation | Criticality | Validation Method | Result | Defect Found | Repair Made |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `/` | page | linked-or-entry | core-product | static file existence, server/client boundary scan, build | PASS | None | None |
| `/dashboard` | page | linked-or-entry | core-product | static file existence, server/client boundary scan, build | PASS | None | Model Health navigation now targets existing advanced-details section. |
| `/sports-center` | page | linked-or-entry | core-product | static file existence, server/client boundary scan, build | PASS | None | None |
| `/ai-operations` | page | linked-or-entry | core-product | static file existence, server/client boundary scan, build | PASS | None | None |
| `/data-coverage` | page | linked-or-entry | core-product | static file existence, server/client boundary scan, build | PASS | None | None |
| `/probability-picks` | page | linked-or-entry | core-product | static file existence, server/client boundary scan, build | PASS | None | None |
| `/most-likely` | page | linked-or-entry | core-product | static file existence, server/client boundary scan, build | PASS | None | None |
| `/best-value` | page | linked-or-entry | core-product | static file existence, server/client boundary scan, build | PASS | None | None |
| `/performance` | page | linked-or-entry | core-product | static file existence, server/client boundary scan, build | PASS | None | None |
| `/model` | page | active-inventory | core-product | static file existence, server/client boundary scan, build | PASS | None | None |
| `/mlb-operations` | page | linked-or-entry | core-product | static file existence, server/client boundary scan, build | PASS | None | None |
| `/autonomous-daily-ai` | page | linked-or-entry | core-product | static file existence, server/client boundary scan, build | PASS | None | None |
| `/portfolio-intelligence` | page | linked-or-entry | core-product | static file existence, server/client boundary scan, build | PASS | None | None |
| `/market-intelligence` | page | linked-or-entry | core-product | static file existence, server/client boundary scan, build | PASS | None | None |
| `/closing-line-intelligence` | page | linked-or-entry | core-product | static file existence, server/client boundary scan, build | PASS | None | None |
| `/betting-workbench` | page | linked-or-entry | core-product | static file existence, server/client boundary scan, build | PASS | None | None |
| `/player-projections` | page | linked-or-entry | core-product | static file existence, server/client boundary scan, build | PASS | None | None |
| `/game-intelligence` | page | linked-or-entry | core-product | static file existence, server/client boundary scan, build | PASS | None | None |
| `/projections` | page | linked-or-entry | core-product | static file existence, server/client boundary scan, build | PASS | None | None |
| `/arbitrage` | page | linked-or-entry | core-product | static file existence, server/client boundary scan, build | PASS | None | None |
| `/ai-bet-finder` | page | linked-or-entry | core-product | static file existence, server/client boundary scan, build | PASS | None | None |
| `/admin/historical-diagnostics` | page | active-inventory | core-product | static file existence, server/client boundary scan, build | PASS | None | None |
| `/api/dashboard` | API | supporting-api | core-support | static route handler contract scan and build | PASS | None | None |
| `/api/dashboard/today` | API | supporting-api | core-support | static route handler contract scan and build | PASS | None | None |
| `/api/system/version` | API | supporting-api | core-support | static route handler contract scan and build | PASS | None | None |
| `/api/probability-picks` | API | supporting-api | core-support | static route handler contract scan and build | PASS | None | None |
| `/api/probability-picks/parlays` | API | supporting-api | core-support | static route handler contract scan and build | PASS | None | None |
| `/api/probability-picks/validation` | API | supporting-api | core-support | static route handler contract scan and build | PASS | None | None |
| `/api/current-board` | API | supporting-api | core-support | static route handler contract scan and build | PASS | None | None |
| `/api/market-opportunities/most-likely` | API | supporting-api | core-support | static route handler contract scan and build | PASS | None | None |
| `/api/market-opportunities/best-value` | API | supporting-api | core-support | static route handler contract scan and build | PASS | None | None |
| `/api/market-opportunities/arbitrage` | API | supporting-api | core-support | static route handler contract scan and build | PASS | None | None |
| `/api/performance` | API | supporting-api | core-support | static route handler contract scan and build | PASS | None | None |
| `/api/performance/trust` | API | supporting-api | core-support | static route handler contract scan and build | PASS | None | None |
| `/api/performance/readiness` | API | supporting-api | core-support | static route handler contract scan and build | PASS | None | None |
| `/api/performance/validation` | API | supporting-api | core-support | static route handler contract scan and build | PASS | None | None |
| `/api/model/status` | API | supporting-api | core-support | static route handler contract scan and build | PASS | None | None |
| `/api/model/versions` | API | supporting-api | core-support | static route handler contract scan and build | PASS | None | None |
| `/api/model/metrics` | API | supporting-api | core-support | static route handler contract scan and build | PASS | None | None |
| `/api/ai-operations/lifecycle` | API | supporting-api | core-support | static route handler contract scan and build | PASS | None | None |
| `/api/autonomous-daily-operations/status` | API | supporting-api | core-support | static route handler contract scan and build | PASS | None | None |
| `/api/operations/status` | API | supporting-api | core-support | static route handler contract scan and build | PASS | None | None |
| `/api/operations/health` | API | supporting-api | core-support | static route handler contract scan and build | PASS | None | None |
| `/api/operations/validation` | API | supporting-api | core-support | static route handler contract scan and build | PASS | None | None |
| `/api/operations/data-freshness` | API | supporting-api | core-support | static route handler contract scan and build | PASS | None | None |
| `/api/operations/refresh-plan` | API | supporting-api | core-support | static route handler contract scan and build | PASS | None | None |
| `/api/mlb/operations-center` | API | supporting-api | core-support | static route handler contract scan and build | PASS | None | None |
| `/api/mlb/starters/health` | API | supporting-api | core-support | static route handler contract scan and build | PASS | None | None |
| `/api/mlb/player-props/health` | API | supporting-api | core-support | static route handler contract scan and build | PASS | None | None |
| `/api/providers/capabilities` | API | supporting-api | core-support | static route handler contract scan and build | PASS | None | None |
| `/api/providers/intelligence` | API | supporting-api | core-support | static route handler contract scan and build | PASS | None | None |
| `/api/providers/route-plan` | API | supporting-api | core-support | static route handler contract scan and build | PASS | None | None |
| `/api/providers/budget/status` | API | supporting-api | core-support | static route handler contract scan and build | PASS | None | None |
| `/api/providers/sdk` | API | supporting-api | core-support | static route handler contract scan and build | PASS | None | None |
| `/api/providers/sdk/validation` | API | supporting-api | core-support | static route handler contract scan and build | PASS | None | None |
| `/api/providers/sportsdataio/status` | API | supporting-api | core-support | static route handler contract scan and build | PASS | None | None |
| `/api/providers/sportsdataio/capabilities` | API | supporting-api | core-support | static route handler contract scan and build | PASS | None | None |
| `/api/providers/sportsdataio/contract` | API | supporting-api | core-support | static route handler contract scan and build | PASS | None | None |
| `/api/providers/sportsdataio/validation` | API | supporting-api | core-support | static route handler contract scan and build | PASS | None | None |
| `/api/providers/the-odds-api/capability` | API | supporting-api | core-support | static route handler contract scan and build | PASS | None | None |
| `/api/providers/the-odds-api/coverage` | API | supporting-api | core-support | static route handler contract scan and build | PASS | None | None |
| `/api/providers/the-odds-api/quota` | API | supporting-api | core-support | static route handler contract scan and build | PASS | None | None |
| `/api/data-coverage/final-certification` | API | supporting-api | core-support | static route handler contract scan and build | PASS | None | None |
| `/api/data-coverage/health` | API | supporting-api | core-support | static route handler contract scan and build | PASS | None | None |
| `/api/data-coverage/inventory` | API | supporting-api | core-support | static route handler contract scan and build | PASS | None | None |
| `/api/data-coverage/provider-audit` | API | supporting-api | core-support | static route handler contract scan and build | PASS | None | None |
| `/api/production-readiness/audit` | API | supporting-api | core-support | static route handler contract scan and build | PASS | None | None |
| `/api/recommendation-readiness` | API | supporting-api | core-support | static route handler contract scan and build | PASS | None | None |
| `/api/historical-import/health` | API | supporting-api | core-support | static route handler contract scan and build | PASS | None | None |
| `/api/data-foundation/readiness` | API | supporting-api | core-support | static route handler contract scan and build | PASS | None | None |

## Routes Not Fully Testable

- `/api/providers/*`: Provider-backed capability routes were statically contract-validated only; no provider calls or credit-consuming probes were made.
- `/api/data-coverage/*`: Routes can depend on stored operational data; A2 validates route existence and JSON handler contracts without database mutation.
- `/api/performance/*`: Historical performance completeness depends on stored settled rows; A2 validates contracts and build safety only.

## Safety Counters

- Provider calls: 0
- Provider credits: 0
- Database mutations: 0
- Prediction writes: 0
- Settlement writes: 0
- Learning writes: 0

## Validation Results

- Phase A1 inventory certification present: PASS
- Phase A1 smoke classified as Windows harness unreliable: PASS
- No local server lifecycle in A2 validator: PASS
- navigation target exists: /ai-bet-finder: PASS
- navigation target exists: /ai-operations: PASS
- navigation target exists: /arbitrage: PASS
- navigation target exists: /autonomous-daily-ai: PASS
- navigation target exists: /best-value: PASS
- navigation target exists: /betting-workbench: PASS
- navigation target exists: /closing-line-intelligence: PASS
- navigation target exists: /dashboard: PASS
- navigation target exists: /dashboard#advanced-details: PASS
- navigation target exists: /data-coverage: PASS
- navigation target exists: /game-intelligence: PASS
- navigation target exists: /market-intelligence: PASS
- navigation target exists: /mlb-operations: PASS
- navigation target exists: /most-likely: PASS
- navigation target exists: /performance: PASS
- navigation target exists: /player-projections: PASS
- navigation target exists: /portfolio-intelligence: PASS
- navigation target exists: /probability-picks: PASS
- navigation target exists: /projections: PASS
- navigation target exists: /sports-center: PASS
- dashboard advanced-details target exists: PASS
- dashboard today target exists: PASS
- stale model-center hash removed from product nav: PASS
- no local server lifecycle in scoped APIs: PASS
- scoped APIs avoid unsafe bare request.json parsing: PASS

## Remaining A2 Risks

- Static validation plus production build cannot prove every database-backed route latency without invoking deployed or local HTTP handlers.
- Provider-backed routes remain contract-validated only because A2 forbids provider calls.
- No local server smoke was run because the Windows smoke harness is classified unreliable.

## Certification

PICK_ANALYZER_V2_PHASE_A2_ROUTE_RUNTIME_PASS
