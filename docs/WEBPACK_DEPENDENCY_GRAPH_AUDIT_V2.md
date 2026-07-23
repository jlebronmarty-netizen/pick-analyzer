# Webpack Dependency Graph Audit V2

Date: 2026-07-23

Baseline commit: `83615b7ff4ea8d5c0787d5326712511128836fc8`

Scope: production build dependency graph only. No provider calls, sports API calls, production data mutations, prediction logic changes, Learning Brain changes, Current Board mutations, Official Pick policy changes, historical feature recalculation, replay generation or route removal were performed.

## Executive Summary

The Vercel OOM symptom occurs during `Creating an optimized production build ...`, before static generation. The dominant risk was therefore the webpack server compilation graph, not page-data collection or static-page generation.

The audit found repeated top-level imports of very large diagnostic and readiness services across many App Router API entries. These imports forced webpack to pull the same large service graphs into many independent route compilation boundaries.

The remediation preserves every route and feature while moving heavy diagnostic/readiness modules behind server-only runtime `import()` loaders in `src/lib/server-lazy-diagnostics.ts`.

## Measured Build Evidence

Baseline clean local build before V2 changes:

- Build command: `npm.cmd run build`
- Result: pass
- Total duration: 84.6s
- Webpack compile phase: 27.8s
- TypeScript: 25.6s
- Static generation: 323 entries in 8.4s

Post-change clean local build after the first V2 pass:

- Build command: `npm.cmd run build`
- Result: pass
- Total duration: 85.8s
- Webpack compile phase: 28.2s
- TypeScript: 25.7s
- Static generation: 323 entries in 8.3s

Post-change clean local build after the second V2 pass:

- Build command: `npm.cmd run build`
- Result: pass
- Total duration: 71.3s
- Webpack compile phase: 23.1s
- TypeScript: 24.5s
- Static generation: 323 entries in 6.1s
- Webpack build worker: disabled after Vercel twice reported the Next build worker being SIGKILLed during webpack optimization.

Interpretation: local wall time stayed effectively flat while route-entry graph weight was reduced. The expected Vercel benefit is lower peak webpack memory pressure, not a large local speedup.

## Source Graph Scan

- Scanned TS/TSX files: 721
- App route/page entry candidates: 353
- Client/server hard violations found: 0 server-only/admin imports from client files
- Client legacy browser-safe service imports found: 2 hooks importing public Supabase-client services
- Type-only service import from client found: 1 erased `import type`
- Circular dependency chains found: 4 existing service-service cycles
- Barrel files with broad exports found: 1 high-risk barrel, `src/services/basketball/index.ts`

## Top 20 Heaviest Entry Graphs Before V2

These are reachable-source weights from a local static import graph scan before the V2 lazy-boundary edits.

| Rank | Approx bytes | Files | Entry |
|---:|---:|---:|---|
| 1 | 1,947,006 | 94 | `src/app/api/mlb/markets/expansion-roadmap/route.ts` |
| 2 | 1,897,077 | 92 | `src/app/api/production-readiness/audit/route.ts` |
| 3 | 1,311,363 | 60 | `src/app/api/observability/runtime/route.ts` |
| 4 | 1,276,391 | 59 | `src/app/api/historical-import/cancel/route.ts` |
| 5 | 1,276,391 | 59 | `src/app/api/historical-import/resume/route.ts` |
| 6 | 1,275,997 | 59 | `src/app/api/historical-import/validate/[jobId]/route.ts` |
| 7 | 1,275,982 | 59 | `src/app/api/historical-import/pilot-plan/route.ts` |
| 8 | 1,275,899 | 59 | `src/app/api/historical-import/jobs/[jobId]/route.ts` |
| 9 | 1,275,709 | 59 | `src/app/api/providers/sportsdataio/execution-readiness/validation/route.ts` |
| 10 | 1,147,134 | 62 | `src/app/api/mlb/operations-center/route.ts` |
| 11 | 1,141,474 | 56 | `src/app/api/operations/health/route.ts` |
| 12 | 1,132,055 | 57 | `src/app/api/mlb/temporal-health/route.ts` |
| 13 | 1,090,186 | 58 | `src/app/api/autonomous-daily-operations/execute/route.ts` |
| 14 | 1,089,817 | 58 | `src/app/api/autonomous-daily-operations/demo/route.ts` |
| 15 | 1,089,607 | 58 | `src/app/api/autonomous-daily-operations/status/route.ts` |
| 16 | 1,089,530 | 58 | `src/app/api/autonomous-daily-operations/daily-report/route.ts` |
| 17 | 1,089,527 | 58 | `src/app/api/autonomous-daily-operations/learning-report/route.ts` |
| 18 | 1,089,522 | 58 | `src/app/api/autonomous-daily-operations/simulation/route.ts` |
| 19 | 1,089,514 | 58 | `src/app/api/autonomous-daily-operations/health/route.ts` |
| 20 | 1,089,386 | 58 | `src/app/api/autonomous-daily-operations/scheduler/route.ts` |

## Top 20 Heaviest Entry Graphs After V2

| Rank | Approx bytes | Files | Entry |
|---:|---:|---:|---|
| 1 | 926,631 | 65 | `src/app/api/cron/daily-sync/route.ts` |
| 2 | 920,709 | 50 | `src/app/api/operating-day/automation/status/route.ts` |
| 3 | 796,390 | 48 | `src/app/api/nba/reconciliation/plan/route.ts` |
| 4 | 796,248 | 48 | `src/app/api/nba/reconciliation/status/route.ts` |
| 5 | 796,246 | 48 | `src/app/api/nba/data-quality/coverage/route.ts` |
| 6 | 796,240 | 48 | `src/app/api/nba/data-quality/issues/route.ts` |
| 7 | 796,237 | 48 | `src/app/api/nba/data-quality/route.ts` |
| 8 | 774,843 | 49 | `src/app/api/bsn/predictions/route.ts` |
| 9 | 774,361 | 49 | `src/app/api/bsn/game/[id]/route.ts` |
| 10 | 774,271 | 49 | `src/app/api/bsn/predictions/validation/route.ts` |
| 11 | 774,210 | 49 | `src/app/api/bsn/predictions/preview/route.ts` |
| 12 | 763,324 | 48 | `src/app/api/nba/markets/steam/route.ts` |
| 13 | 763,139 | 48 | `src/app/api/nba/markets/multi-book/route.ts` |
| 14 | 753,821 | 47 | `src/app/api/nba/sync/route.ts` |
| 15 | 753,682 | 47 | `src/app/api/nba/sync/teams/route.ts` |
| 16 | 753,675 | 47 | `src/app/api/nba/sync/lineups/route.ts` |
| 17 | 753,656 | 47 | `src/app/api/nba/sync/standings/route.ts` |
| 18 | 753,656 | 47 | `src/app/api/nba/sync/stats/route.ts` |
| 19 | 753,654 | 47 | `src/app/api/nba/sync/injuries/route.ts` |
| 20 | 753,652 | 47 | `src/app/api/nba/sync/players/route.ts` |

## Boundary Changes Applied

- Replaced broad `@/services/basketball` imports in four basketball API routes and three BSN services with direct concrete module imports.
- Added `src/lib/server-lazy-diagnostics.ts` as a server-only dynamic import boundary.
- Lazy-loaded repeated SportsDataIO NBA readiness diagnostics across 15 API routes.
- Lazy-loaded repeated AI Performance Center diagnostics across 13 API routes.
- Lazy-loaded historical-import readiness routes that previously pulled `sportsdataio-historical-import-readiness.service.ts` into multiple entries.
- Lazy-loaded autonomous daily operations diagnostic routes.
- Lazy-loaded adaptive-refresh operational routes.
- Lazy-loaded production readiness, runtime observability, MLB market expansion roadmap, MLB operations center, MLB temporal health and operations health route services.
- Lazy-loaded dashboard, dashboard today, operating-day core, NBA prediction/settlement and BSN certification/model-maturity route services after the first pushed deployment still OOMed on Vercel.
- Disabled `experimental.webpackBuildWorker` after two Vercel deployments showed the worker process itself being SIGKILLed during webpack optimization. Other V1 memory controls remain enabled.
- Disabled production server-side webpack minimization only; client optimization remains enabled. This targets the failing server route optimization phase without removing routes or changing runtime contracts.

## Circular Dependencies

Existing cycles found by local static scan:

1. `current-board.service.ts` -> `market-intelligence-category.service.ts` -> `current-board.service.ts`
2. `current-board.service.ts` -> `official-pick-experience.service.ts` -> `current-board.service.ts`
3. `current-board.service.ts` -> `mlb-ai-picks-feed.service.ts` -> `current-board.service.ts`
4. `model-learning.service.ts` -> `weight-optimizer.service.ts` -> `model-learning.service.ts`

These cycles were not changed in this pass because they touch protected Current Board, Official Pick and Learning Brain behavior. Recommended future work is to extract shared read-only DTO builders from those cycles without changing policy.

## Largest Built Outputs After V2

Server route/page outputs:

- `.next/server/app/dashboard/page.js`: 112,248 bytes
- `.next/server/app/performance/page.js`: 57,099 bytes
- `.next/server/app/betting-workbench/page.js`: 42,293 bytes
- `.next/server/app/most-likely/page.js`: 42,244 bytes
- `.next/server/app/api/dashboard/route.js`: 37,734 bytes

Client chunks:

- `.next/static/chunks/3794-*.js`: 222,191 bytes
- `.next/static/chunks/4bd1b696-*.js`: 199,865 bytes
- `.next/static/chunks/framework-*.js`: 189,679 bytes
- `.next/static/chunks/9831-*.js`: 170,293 bytes
- `.next/static/chunks/app/dashboard/page-*.js`: 79,454 bytes

## Remaining Optimization Roadmap

1. Extract shared DTO/read-model helpers from the Current Board service cycles.
2. Split dashboard aggregate API composition into smaller request-time loaders.
3. Split operating-day route service imports by read-only status, validation and protected execution branches.
4. Preserve all current Next memory controls from V1 unless Vercel evidence shows a regression.
5. Add a CI-only graph budget script for top route-entry reachable source bytes.

## Certifications

- `WEBPACK_DEPENDENCY_GRAPH_AUDIT_PASS`
- `CLIENT_SERVER_BOUNDARY_PASS`
- `IMPORT_GRAPH_OPTIMIZATION_PASS`
- `BUILD_MEMORY_OPTIMIZATION_V2_PASS`
- `NO_PRODUCT_REGRESSION_PASS`

`DEPLOYMENT_RECOVERY_PASS` requires an observed Vercel deployment reaching Ready. The first pushed V2 deployment for commit `ecaf8842b7570486b874a3c646d6079d10885dc4` and the second deployment for commit `cb1fb5b1f1d2d38d0b8e8b5a9f91e59f1335097c` both failed during webpack optimization with SIGKILL/OOM. A third deployment for commit `e4ffcdf5ae45acf2d18cc0142406db4c2befb5cb` still failed after disabling the webpack build worker. The deployment with server-side webpack minimization disabled reached Vercel success, and production `/api/system/version` reported commit `bcf970a3ab3a79ce8fced345f4948b55e4e1421f`.
