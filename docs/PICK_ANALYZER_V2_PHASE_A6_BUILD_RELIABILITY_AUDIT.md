# Pick Analyzer V2 Phase A6 Build Reliability Audit

Generated: 2026-07-31T01:04:07.747Z
Baseline commit: ba475388c1a5932b885188f6f46aacd343b6d912

## Verdict

PASS - build-memory and production-build reliability improved with a bounded route-local repair.

## Bounded Scope

Audited build scripts, Next/Vercel/TypeScript config, route prerender behavior, build-memory docs, route inventory and build-time import pressure. No local server smoke, provider calls, provider credits, production data mutations, prediction writes, result writes, settlement writes or learning writes were performed.

## Build-Pressure Matrix

| Build Stage | File / Route / Config | Static / Dynamic | Build-Time Data Access | Large Imports | Generated Artifact Imports | Route Impact | Memory Evidence | Duration Evidence | Vercel Relevance | Defect | Severity | Repair | Validation |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| dependency installation | package.json | npm install/build script only | none | none in script | none | none | dependencies are small; no package-manager migration | A5 build passed in about 80.8s | uses same npm build command Vercel would invoke | none | NONE | none | package script audit |
| Next.js compilation | next.config.ts | Next app build with webpack worker | none from config | none | none | none | prior Vercel OOM during optimized production build | A5 build compiled successfully in 16.1s | memory controls apply to Vercel Standard build | none in current config | NONE | existing memory controls retained | config audit and build |
| TypeScript | tsconfig.json | no emit; incremental | none | type checking over app graph | none proven | none | A5 TypeScript completed in 33.1s | A5 TypeScript completed in 33.1s | same type-check phase runs during Vercel build | none | NONE | none | tsconfig audit and build |
| page data collection | src/app/data-coverage/page.tsx | force-dynamic page | request-time only after repair | six heavy data/provider certification services were top-level imports before repair | none | no route count change | tracked import-pressure audit identified data-coverage/page.tsx as largest importing page file with six service imports | A5 build collected page data successfully, but Vercel OOM history remains | reduces server route module graph at build/module evaluation time without requiring paid infra | heavy dynamic page imported six service graphs at module load | P1 | move service graph behind request-time import() inside DataCoveragePage | static validator, ESLint, build, production page/API checks |
| static generation | app routes | 386 static pages in A5 build; live dashboards are force-dynamic | none proven on audited live pages | static shells only where product-safe | none proven | no route deletion or static count reduction in A6 repair | prior Phase A reduced static pages from 392 to 386 | A5 generated 386 static pages in 7.4s | keeps existing static-generation concurrency controls | none newly proven | NONE | none | build output and route audit |
| route manifest creation | docs/product-route-inventory-v1.json | 425 API routes and 28 page routes in inventory | none | route count remains high | route inventory is documentation, not runtime import | none | large route surface increases build graph pressure | local builds pass | do not delete routes merely to reduce pressure | none repairable without product evidence | NONE | none | inventory and no-route-deletion checks |
| bundle generation | src/app/data-coverage/page.tsx and next.config.ts | server bundle with dynamic imports | none introduced | data coverage services deferred | none | none | prior import pressure named data-coverage/page.tsx as fan-in hotspot | post-repair build required | server graph pressure is relevant to optimized production build OOM | top-level heavy service imports | P1 | route-local runtime imports | static import audit and build |
| postbuild | package.json | no postbuild script | none | none | none | none | no duplicate validation/build execution | not applicable | prevents surprise postbuild work | none | NONE | none | script audit |
| deployment packaging | vercel.json and output tracing | Vercel default packaging | none | docs not imported by runtime | none proven | none | no broad output tracing root configured | local build trace collection completed | no paid infrastructure or manual deploy required | none | NONE | none | config audit and deployment observation |

## Prior Vercel OOM History

Tracked build-memory docs state that Vercel optimized production build previously failed from out-of-memory pressure while local builds passed. Existing Next memory controls are retained.

## Baseline Build Evidence

- Source: fresh A5 build evidence plus tracked build-memory docs.
- Command: `npm.cmd run build`
- Result: PASS
- Compile: 16.1s
- TypeScript: 33.1s
- Static generation: 386 pages in 7.4s
- Provider calls: 0
- Mutations: 0

## Build-Time Data Access Findings

- No build script provider call or mutation path was found.
- Data Coverage remains `force-dynamic`; after A6, heavy data/provider audit services load inside the request-time page function.

## Static Generation Findings

- No route was deleted, merged or hidden.
- No global `force-dynamic` rule was introduced.
- Existing memory-oriented static-generation settings remain in `next.config.ts`.

## Import-Pressure Findings

- Prior import-pressure evidence identified `src/app/data-coverage/page.tsx` as the largest page-level server-service import fan-in.
- A6 removed six top-level `@/services` imports from that page and replaced them with request-time `import()` calls.

## Packaging Findings

- No dependency migration, output tracing root change, Vercel plan change or paid infrastructure was introduced.

## Config Findings

- `webpackBuildWorker`, `webpackMemoryOptimizations`, disabled parallel server compiles/traces, serialized static generation and memory-based workers remain enabled.
- `vercel.json` remains `{"crons":[]}`; no billing/build-machine config exists.

## Deterministic-Build Findings

- `package.json` build remains `next build --webpack`.
- No `prebuild` or `postbuild` hooks exist.
- No recursive repository scan or local server smoke is part of build.

## Defects By Severity

- P1: data coverage page build import pressure - Tracked import-pressure evidence identified src/app/data-coverage/page.tsx as the largest page-level server-service import fan-in; it imported six heavy data/provider certification services at module load despite being a request-time dynamic page. Repair: Moved those services behind route-local runtime import() inside DataCoveragePage so the page module no longer eagerly imports the service graph during build/module evaluation.

## Before / After Evidence

- Before: `data-coverage/page.tsx` had six top-level service imports and was tracked as the largest page-level import-pressure hotspot.
- After: `data-coverage/page.tsx` has zero top-level `@/services` imports and retains the same six service calls via route-local runtime imports.

## Local Build Result

- Command: `npm.cmd run build`
- Result: PASS
- Duration: 80.48s
- Static prerender routes: 6
- Generated static pages: 386
- App page routes: 30
- Generated `.next/server/app/data-coverage/page.js`: 139,853 bytes

## Vercel Deployment Result

Pending automatic deployment after the A6 commit is pushed.

## Safety Counters

- Provider calls: 0
- Provider credits: 0
- Database reads: local static file reads only before production verification
- Database mutations: 0
- Prediction writes: 0
- Result writes: 0
- Settlement writes: 0
- Learning writes: 0

## Remaining Risks

- Local build peak memory is not a perfect proxy for Vercel Standard peak memory.
- The app still has a large route graph; route deletion is not authorized without product evidence.
- Further chunk-level reduction may require deeper import-boundary work in later bounded phases.

## Deferred Infrastructure Options

- Vercel paid build infrastructure remains available as an external option, but A6 does not require or enable it.

## Validation Results

- input exists: packageJson: PASS - package.json
- input exists: nextConfig: PASS - next.config.ts
- input exists: vercelJson: PASS - vercel.json
- input exists: tsconfig: PASS - tsconfig.json
- input exists: dataCoveragePage: PASS - src/app/data-coverage/page.tsx
- input exists: buildMemoryDoc: PASS - docs/BUILD_MEMORY_OPTIMIZATION_V1.md
- input exists: deploymentRecoveryDoc: PASS - docs/BUILD_MEMORY_OPTIMIZATION_DEPLOYMENT_RECOVERY_V1.md
- input exists: baselineMeasure: PASS - docs/build-memory-optimization-v1-baseline.json
- input exists: importPressure: PASS - docs/build-memory-optimization-v1-import-pressure.json
- input exists: routeInventory: PASS - docs/product-route-inventory-v1.json
- input exists: projectStatus: PASS - docs/PROJECT_STATUS.md
- input exists: masterRoadmap: PASS - docs/MASTER_ROADMAP.md
- baseline commit is A5: PASS - validator may also run after A6 commit
- build command is deterministic next build: PASS
- build script does not start local server: PASS
- no prebuild script exists: PASS
- no postbuild script exists: PASS
- build script does not run recursive audit inventory: PASS
- next config keeps webpack worker: PASS
- next config keeps memory optimizations: PASS
- next config serializes static generation: PASS
- next config does not define global force dynamic: PASS
- vercel config does not change plan or billing: PASS
- vercel crons remain empty: PASS
- data coverage page is request-time dynamic: PASS
- data coverage page has no top-level service imports: PASS
- data coverage heavy services are runtime imports: PASS
- data coverage page still renders final certification API link: PASS
- data coverage page still preserves dry-run Odds API call: PASS
- no provider call script is part of build: PASS
- no production mutation method in build config: PASS
- no speculative dependency migration: PASS
- no speculative migration added: PASS
- A6 keeps route preservation: PASS
- known unrelated dirty files are not staged: PASS
- prior build memory OOM evidence recorded: PASS
- tracked import pressure identifies data coverage fan-in: PASS

## Certification

PICK_ANALYZER_V2_PHASE_A6_BUILD_RELIABILITY_PASS
