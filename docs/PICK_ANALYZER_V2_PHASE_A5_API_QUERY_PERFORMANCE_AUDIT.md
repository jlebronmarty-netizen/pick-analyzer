# Pick Analyzer V2 Phase A5 API Query Performance Audit

Generated: 2026-07-31T00:22:08.121Z
Baseline commit: aff9f9e98f416d429c3d603ffd70139b4a803e4f

## Verdict

PASS - bounded critical API/query performance certified after scoped repair.

## Bounded Scope

Audited core read-heavy product APIs and services only. No local server smoke, provider calls, provider credits, production data mutations, prediction writes, result writes, settlement writes or learning writes were performed.

## Critical-Route Matrix

| Route / Service | Criticality | Data Source | Tables / Views | Query Count | Execution | Selected Columns | Row Bounds | Ordering | Filters | Pagination | Aggregation | Duplicate / N+1 Risk | Cache | Timeout / Failure | Production Latency | Defect | Severity | Repair |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| /api/performance / getPerformanceProductContract -> getPerformanceScopeV2 | P1 core product page API | Supabase read-only | prediction_history, sport_events | 2 plus scheduler coverage helper | scheduler coverage and prediction read in parallel; event read after bounded prediction ids | explicit projection | prediction_history max 2000 default; sport_events batched by unique ids | prediction_history created_at desc | optional sport_key; product eligibility in application | bounded default summary; full history not returned by default | application memory over bounded rows | none proven after compact default repair; bounded batched sport_events in groups of 100; no per-row query | no-store dynamic product API | bounded query count and row cap; route error returns JSON | 4257, 4220, 4227 ms | Default summary route read paginated prediction_history until exhaustion and returned full historyRows. | P1 | Bound prediction_history reads and make full historyRows opt-in for diagnostics/full history route. |
| /api/performance/history / getPerformanceScopeV2 | P2 paginated supporting API | Supabase read-only | prediction_history, sport_events | 2 plus scheduler coverage helper | bounded prediction read then batched event lookup | explicit projection | prediction_history max 5000; response page limit max 100 | prediction_history created_at desc | sport/category/model/status/mode/confidence filters after bounded read | request page/limit with max 100 rows returned | application memory over bounded rows | none proven in route; no per-row DB calls | client fetch no-store | bounded query count and row cap; route error returns JSON | 3586, 3348, 3360 ms | History route depended on the same unbounded scope reader. | P2 | Explicit 5000-row cap plus page limit max 100. |
| /api/dashboard/today / getDashboardToday | P1 core dashboard API | Supabase and stored service summaries | sport_events, prediction_history, sports_odds_snapshots | parallel dependency bundle plus bounded optional fallbacks | independent dependencies in Promise.all; optional follow-up reads timed | explicit projections | current board 100, fallback slate 64, grounded predictions 200, odds snapshots 1000 | start_time or generated_at where relevant | sport, league, operating date, event ids | summary route only | application over bounded current slate | none repaired in A5; no per-row DB calls in audited path | no-store | timed helper around critical and optional dependencies | 4227, 3682, 3562 ms | large payload observed, but query bounds/timeouts already present; no scoped repair made | NONE | none |
| /api/data-coverage/final-certification / multi-sport final certification | P1 operational certification API | stored coverage summaries | stored data coverage inventory | service-managed summary by default | default summary; diagnostics=full opt-in | service managed | summary default; full diagnostics not default | service managed | diagnostics mode | summary default | service | not proven; not proven | dynamic no revalidate | route-level error contract | 23203, 30155, 27769 ms | slow production latency observed, but default route already avoids full diagnostics; no query-level defect proven without DB EXPLAIN | DEFERRED | defer specific optimization until service query evidence is available |
| /api/probability-picks / getProbabilityPicks | P1 pick-discovery API | stored predictions/projections | service managed | service managed | bounded route limit | service managed | limit max 500 | request sort allowlist | sport/market/probability/confidence/quality/freshness/date | bounded summary | service | not proven; not proven | client no-store | route error contract | 5676, 1212, 806 ms | none proven; route limit exists | NONE | none |
| /api/market-opportunities/most-likely / getMostLikelyOpportunities | P1 opportunity API | current board service | service managed | service managed | bounded route limit | service managed | limit max 100 | sort allowlist | mode allowlist | bounded summary | service | not proven; not proven | client no-store | route error contract | 6370, 2012, 1419 ms | none proven; bounded route limit exists | NONE | none |

## Query Findings

- Performance default summary was the only proven unbounded critical read in the audited scope.
- Dashboard Today, Probability Picks, Most Likely and Best Value already expose bounded route/query behavior where statically provable.
- No audited read-only route directly calls provider adapters or mutation methods.

## Latency Findings

- Before repair, production `/api/performance` returned about 718 KB and took about 4.2 seconds across three reads.
- Production `/api/performance/history?limit=25&page=1` returned about 136 KB and took about 3.4 seconds across three reads.
- Production `/api/data-coverage/final-certification` remained slow, but default route already uses summary mode; no query-level repair was made without DB plan evidence.

## Payload Findings

- Default `/api/performance` carried full `historyRows` although the UI uses `/api/performance/history` for paginated history rows.
- A5 keeps `historyPreview`, `queryDiagnostics` and existing summary fields while returning full `historyRows` only for full diagnostics.

## Timeout Findings

- Dashboard Today already uses `timed` dependency wrappers and degraded section behavior.
- Performance risk was unbounded work and oversized payload. A5 adds deterministic row caps instead of a broad cache or server smoke.

## Cache Findings

- No new cache platform was introduced.
- Audited product APIs remain dynamic/no-store or are consumed with client `cache: 'no-store'`.

## Database / Index Findings

- No speculative migration or index was added.
- Deferred candidate: `prediction_history` optional `sport_key` filter ordered by `created_at desc`, pending authorized EXPLAIN/query-plan evidence.

## Defects By Severity

- P1: /api/performance default product summary - Default performance summary read prediction_history until exhaustion and returned full historyRows even when diagnostics were not requested. Repair: Added bounded prediction_history reads and compact default mode that omits full historyRows unless full diagnostics are requested.
- P2: /api/performance/history supporting API - Paginated history route depended on the same unbounded performance scope reader. Repair: History route now requests an explicit 5000-row read budget and keeps page size capped at 100.

## Before / After Evidence

- Before: `/api/performance` production summary was 717,617 bytes and approximately 4.2 seconds on three bounded reads.
- After local static repair: default performance summary uses `maxPredictionRows: 2000` and `includeHistoryRows: false`; full diagnostics and history route use explicit `5000` row budgets.

## Production Evidence

- /api/dashboard/today: HTTP 200; latency 4227, 3682, 3562 ms; bytes 541124; provider calls 0; mutations 0
- /api/performance: HTTP 200; latency 4257, 4220, 4227 ms; bytes 717617; provider calls 0; mutations 0
- /api/performance/history?limit=25&page=1: HTTP 200; latency 3586, 3348, 3360 ms; bytes 135787; provider calls 0; mutations 0
- /api/operations/health: HTTP 200; latency 6613, 15690, 6924 ms; bytes 747390; provider calls 0; mutations 0
- /api/operations/data-freshness: HTTP 200; latency 5045, 5000, 4996 ms; bytes 10792; provider calls 0; mutations 0
- /api/data-coverage/final-certification: HTTP 200; latency 23203, 30155, 27769 ms; bytes 6802; provider calls 0; mutations 0
- /api/probability-picks: HTTP 200; latency 5676, 1212, 806 ms; bytes 174993; provider calls 0; mutations 0

## Safety Counters

- Provider calls: 0
- Provider credits: 0
- Database reads: production read-only endpoint observations plus local static file reads
- Database mutations: 0
- Prediction writes: 0
- Result writes: 0
- Settlement writes: 0
- Learning writes: 0

## Remaining Risks

- Static validation cannot prove PostgreSQL planner choices without authorized EXPLAIN access.
- Several operations/data-coverage diagnostic endpoints remain slow but need narrower query evidence before repair.

## Deferred Index Candidates

- prediction_history: optional sport_key filter ordered by created_at desc for performance summary/history. Deferred because No production EXPLAIN access authorized in A5; no speculative migration added.

## Validation Results

- input exists: a2: PASS - docs/PICK_ANALYZER_V2_PHASE_A2_ROUTE_RUNTIME_AUDIT.md
- input exists: a3: PASS - docs/PICK_ANALYZER_V2_PHASE_A3_SCHEDULER_FRESHNESS_AUDIT.md
- input exists: a4: PASS - docs/PICK_ANALYZER_V2_PHASE_A4_UI_STATE_AUDIT.md
- input exists: inventory: PASS - docs/product-route-inventory-v1.json
- input exists: performanceRoute: PASS - src/app/api/performance/route.ts
- input exists: performanceHistoryRoute: PASS - src/app/api/performance/history/route.ts
- input exists: performanceScope: PASS - src/services/performance-scope-v2.service.ts
- input exists: performanceProduct: PASS - src/services/performance-product-contract.service.ts
- input exists: dashboardTodayRoute: PASS - src/app/api/dashboard/today/route.ts
- input exists: dashboardToday: PASS - src/services/dashboard-today.service.ts
- input exists: operationsHealthRoute: PASS - src/app/api/operations/health/route.ts
- input exists: operationsHealth: PASS - src/services/operations-health.service.ts
- input exists: dataCoverageFinalRoute: PASS - src/app/api/data-coverage/final-certification/route.ts
- input exists: dataCoverageHealthRoute: PASS - src/app/api/data-coverage/health/route.ts
- input exists: probabilityRoute: PASS - src/app/api/probability-picks/route.ts
- input exists: mostLikelyRoute: PASS - src/app/api/market-opportunities/most-likely/route.ts
- input exists: bestValueRoute: PASS - src/app/api/market-opportunities/best-value/route.ts
- input exists: currentBoardRoute: PASS - src/app/api/current-board/route.ts
- input exists: sportsHealthRoute: PASS - src/app/api/sports/health/route.ts
- input exists: modelStatusRoute: PASS - src/app/api/model/status/route.ts
- input exists: providerBudgetRoute: PASS - src/app/api/providers/budget/status/route.ts
- A2 route runtime pass marker present: PASS
- A3 scheduler freshness pass marker present: PASS
- A4 UI state pass marker present: PASS
- performance scope defines default row cap: PASS
- performance scope bounds row limit: PASS
- performance scope loop terminates at rowLimit: PASS
- performance scope uses explicit projection: PASS
- performance scope does not select star: PASS
- performance event lookup is batched not per row: PASS
- performance scope can omit full history rows: PASS
- performance scope exposes query diagnostics: PASS
- default performance route uses compact history rows: PASS
- default performance route has lower row cap: PASS
- performance route keeps full diagnostics opt-in: PASS
- performance history route has explicit row cap: PASS
- performance history response remains paginated: PASS
- dashboard today uses timed dependency helper: PASS
- dashboard today critical reads are bounded: PASS
- data coverage final keeps full diagnostics opt-in: PASS
- probability picks route bounds limit: PASS
- most likely route bounds limit: PASS
- best value route bounds limit: PASS
- read-only audited routes do not import provider clients directly: PASS
- read-only audited routes do not call mutation methods directly: PASS
- no speculative migration was added: PASS

## Certification

PICK_ANALYZER_V2_PHASE_A5_API_QUERY_PERFORMANCE_PASS
