# Build OOM Root Cause V2

Date: 2026-07-23

Baseline commit: `83615b7ff4ea8d5c0787d5326712511128836fc8`

## Root Cause

The Vercel failure mode occurred during webpack optimization before the build reached `Compiled successfully`. The proximate root cause was a server compilation graph with many App Router API entries statically importing large diagnostic/readiness services.

The largest source modules are intentionally rich operational services:

- `sportsdataio-historical-import-readiness.service.ts`: 277,991 bytes
- `sportsdataio-mlb-prospective-preview.service.ts`: 150,305 bytes
- `historical-feature-generation.service.ts`: 133,084 bytes
- `sportsdataio-mlb-historical-import-executor.service.ts`: 129,557 bytes
- `sportsdataio-nba-integration-readiness.service.ts`: 115,796 bytes
- `ai-performance-center.service.ts`: 90,137 bytes
- `autonomous-daily-operations.service.ts`: 66,561 bytes
- `adaptive-refresh-orchestrator.service.ts`: 64,567 bytes

The problem was not that these services exist. The problem was repeated top-level route imports that made webpack compile them into many route entry boundaries at once.

## Why V1 Settings Were Not Enough

V1 correctly enabled Next/Webpack memory controls:

- `webpackBuildWorker`
- `webpackMemoryOptimizations`
- `memoryBasedWorkersCount`
- static generation concurrency controls
- disabled parallel server compiles/traces

Those settings reduce worker pressure, but they do not change the dependency graph. V2 changes the graph itself by keeping protected diagnostics available while moving heavy service loads behind request-time server-only dynamic imports.

## Fix Strategy

1. Keep every route, feature and diagnostic endpoint.
2. Keep production behavior unchanged.
3. Do not increase heap as the primary fix.
4. Replace broad static route imports with server-only lazy import boundaries.
5. Replace the basketball subsystem barrel imports with direct concrete imports.
6. Leave protected Prediction Engine, Learning Brain, Current Board, Official Pick and Feature Store logic untouched.

## Implemented Changes

- New server-only loader module: `src/lib/server-lazy-diagnostics.ts`.
- Direct imports for basketball API routes and BSN services instead of the broad `src/services/basketball/index.ts` barrel.
- Dynamic service loaders for:
  - SportsDataIO NBA readiness diagnostics
  - AI Performance Center diagnostics
  - SportsDataIO historical import readiness diagnostics
  - Autonomous daily operations diagnostics
  - Adaptive refresh diagnostics
  - Production readiness audit
  - Runtime observability
  - MLB market expansion roadmap
  - MLB operations center
  - MLB temporal health
  - Operations health

## Product Isolation

The V2 build-memory pass did not modify:

- Prediction probabilities
- Prediction Engine logic
- Learning Brain logic
- Current Board eligibility
- Official Pick policy
- Market pipeline logic
- Historical feature-store code or data
- Replay generation
- Production database rows

Provider calls added: 0

External sports API calls added: 0

Remote mutations added: 0

## Verification

Clean local build after the changes:

- Command: `npm.cmd run build`
- Result: pass
- Webpack compile phase: 23.1s
- TypeScript: 24.5s
- Static generation: 323 routes in 6.1s
- Total duration: 71.3s
- `webpackBuildWorker`: disabled
- Server-side webpack minimization: disabled

Known limitation: local tooling did not expose reliable peak RSS during the Next build. The evidence therefore uses reachable-source graph weight, emitted server output sizes and build completion.

## First Deployment Attempt

Commit `ecaf8842b7570486b874a3c646d6079d10885dc4` was pushed and triggered Vercel deployment `dpl_E58qFWRwXqYxMtMEZgtYVdhD1qgw`. The build machine reported 2 cores and 8 GB RAM, then failed during `Creating an optimized production build ...` with `SIGKILL` and an OOM build-system report.

The post-failure local pass further lazy-loaded dashboard, operating-day core, NBA prediction/settlement and BSN certification/model-maturity route services. This reduced the largest static route-entry graph from about 1.01 MB to about 0.93 MB and removed the dashboard, operating-day core, NBA prediction and BSN model-maturity route groups from the top 20.

The second deployment for commit `cb1fb5b1f1d2d38d0b8e8b5a9f91e59f1335097c` still failed during webpack optimization with the same worker SIGKILL/OOM signature. Because the failing process was the Next build worker, the next local pass disabled `experimental.webpackBuildWorker` while retaining `webpackMemoryOptimizations`, `memoryBasedWorkersCount`, static generation throttles and disabled parallel server compiles/traces.

The third deployment for commit `e4ffcdf5ae45acf2d18cc0142406db4c2befb5cb` still failed during webpack optimization after the worker topology change. The final local pass therefore disabled server-side webpack minimization only, preserving client-side optimization and runtime route behavior.

## Deployment Gate

`DEPLOYMENT_RECOVERY_PASS` is certified by the Vercel deployment that succeeded after server-side webpack minimization was disabled. Production `/api/system/version` reported commit `bcf970a3ab3a79ce8fced345f4948b55e4e1421f` with provider calls 0.
