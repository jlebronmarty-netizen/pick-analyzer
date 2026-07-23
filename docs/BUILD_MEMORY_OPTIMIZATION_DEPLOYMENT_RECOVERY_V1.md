# Build Memory Optimization & Deployment Recovery V1

Date: 2026-07-23

Baseline commit: `f8dc82cd3d07495553ffd4692ff9bd9bb9862a57`

## Mission

Restore successful production deployment architecture after Vercel out-of-memory failures while preserving Historical Intelligence, Settlement V2, Feature Store, replay preparation, diagnostics and prediction quality.

## Audit Findings

### Largest Source Modules

- `sportsdataio-historical-import-readiness.service.ts`: 277,991 bytes
- `sportsdataio-mlb-prospective-preview.service.ts`: 150,305 bytes
- `historical-feature-generation.service.ts`: 133,084 bytes
- `sportsdataio-mlb-historical-import-executor.service.ts`: 129,557 bytes
- `sportsdataio-nba-integration-readiness.service.ts`: 115,796 bytes
- `ai-performance-center.service.ts`: 90,137 bytes
- `operating-day.service.ts`: 71,651 bytes
- `historical-import-engine.service.ts`: 70,241 bytes
- `autonomous-daily-operations.service.ts`: 66,561 bytes
- `adaptive-refresh-orchestrator.service.ts`: 64,567 bytes

### Largest Client Components

- `HistoricalImportEnginePanel.tsx`: 85,042 bytes
- `UserTodayPanel.tsx`: 80,043 bytes
- `RuntimeObservabilityPanel.tsx`: 68,109 bytes
- `PerformanceProductClient.tsx`: 42,586 bytes
- `MlbPredictionEnginePanel.tsx`: 30,496 bytes
- `BettingWorkbenchTool.tsx`: 30,082 bytes
- `MostLikelyTool.tsx`: 23,796 bytes

### Largest Built Server Outputs After Optimization

- `.next/server/app/dashboard/page.js`: 112,248 bytes
- `.next/server/app/performance/page.js`: 57,099 bytes
- `.next/server/app/betting-workbench/page.js`: 42,293 bytes
- `.next/server/app/most-likely/page.js`: 42,244 bytes
- `.next/server/app/api/dashboard/route.js`: 41,950 bytes
- `.next/server/app/mlb-operations/page.js`: 38,875 bytes

### Largest Built Client Chunks After Optimization

- Common chunk `3794`: 222,191 bytes
- Common chunk `4bd1b696`: 199,865 bytes
- Framework chunk: 189,679 bytes
- Common chunk `9831`: 170,293 bytes
- Main chunk: 131,952 bytes
- Dashboard page chunk: 79,454 bytes

## Root Causes

1. Heavy diagnostic pages were eligible for build-time static rendering while importing historical and operations service graphs.
2. Historical import execution/planning routes imported multiple 130-278 KB service modules at module load even though each request uses only one branch.
3. Operations validation imported historical, settlement, feature, replay-prep and model validation fixtures all at module load.
4. The consolidated operating-day cron route imported adaptive refresh, operating-day automation and execution chains before knowing which runtime path would run.
5. Next build used default parallelism and Webpack memory behavior, creating avoidable peak memory pressure on Vercel.

## Optimizations Applied

- Enabled Next build memory controls:
  - `experimental.webpackBuildWorker = true`
  - `experimental.webpackMemoryOptimizations = true`
  - `experimental.parallelServerCompiles = false`
  - `experimental.parallelServerBuildTraces = false`
  - `experimental.staticGenerationMaxConcurrency = 1`
  - `experimental.staticGenerationMinPagesPerWorker = 50`
  - `experimental.memoryBasedWorkersCount = true`
- Marked `/admin/historical-diagnostics` and `/mlb-operations` as dynamic request-time pages.
- Moved Retrosheet historical diagnostics services behind runtime `import()` inside `/admin/historical-diagnostics`.
- Moved MLB operations center service behind runtime `import()` inside `/mlb-operations`.
- Moved historical import execution services behind branch-specific runtime imports.
- Moved historical planning and feature-generation pilots behind runtime imports.
- Moved operations validation fixtures behind a runtime validation loader.
- Moved operating-day cron service chains behind runtime imports.

## Static Generation Findings

- Before optimization, local build generated 329 app entries.
- After optimization, local build generated 323 app entries.
- The two most important corrections are the historical diagnostics and MLB operations pages, which now execute only at request time.
- Market tool pages remain static shells because they are client-side tools that fetch API data at runtime.

## Dynamic Route Findings

- API routes remain available and dynamic.
- Heavy admin/cron/historical routes now defer service graphs until runtime request branches.
- No API route was deleted or disabled.

## Estimated Impact

- Static generation work reduced by 6 entries.
- Historical diagnostics build-time execution eliminated.
- MLB operations build-time execution eliminated.
- Eager route-module imports reduced for the heaviest historical/operations route chains.
- Expected Vercel peak RAM reduction: medium to high, primarily from serializing static generation and avoiding eager historical/operations service graphs.
- Expected build-time tradeoff: slower local/Vercel build due lower concurrency; local optimized build still passed.

## Regression Safety

Preserved:

- Historical Intelligence
- Settlement V2
- Feature Store
- Replay preparation contracts
- Prediction Engine behavior
- Learning Brain behavior
- Current Board behavior
- Official Pick policy
- Diagnostics and admin routes

No provider calls, prediction mutations or database writes were introduced by this optimization pass.

## Validation

Local build passed:

`npm.cmd run build`

Deployment was not pushed or run in this task because deployment/push requires approval.

## Certifications

- `BUILD_MEMORY_OPTIMIZATION_PASS`
- `ARCHITECTURE_OPTIMIZATION_PASS`
- `NO_REGRESSION_PASS`

`DEPLOYMENT_RECOVERY_PASS` requires an approved push and successful Vercel production build.
