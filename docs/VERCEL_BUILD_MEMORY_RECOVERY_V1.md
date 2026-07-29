# Vercel Build Memory Recovery V1

Date: 2026-07-29

Status: LOCAL OPTIMIZATION COMPLETE

## Mission

Reduce production build memory pressure without changing product behavior, prediction logic, scheduler behavior, Official Pick policy, Learning Brain weights, APIs, database schema or provider behavior.

Manual Vercel deployment was not performed.

## Audit

Known Vercel failure stage:

- `next build --webpack`
- `Creating an optimized production build`
- SIGKILL / OOM on the Standard build machine

Phase A had already reduced prerender routes from 12 to 6, but memory pressure moved to webpack/server bundling and route tracing. Existing Phase B diagnostics showed repeated server bundling of Supabase internals:

- `.next/server/chunks/26218.js` - 876,552 bytes
- `.next/server/chunks/5139.js` - 875,683 bytes

The app imports `@supabase/supabase-js` broadly through `src/lib/supabase-admin.ts` and server services. Bundling that dependency into the server graph duplicated large shared dependency code across route chunks.

## Changes

Changed only `next.config.ts`:

- Added `serverExternalPackages: ['@supabase/supabase-js']`.
- Re-enabled `experimental.webpackBuildWorker`.

These are build-boundary changes only. They do not change runtime API contracts, model formulas, settlement logic, scheduler behavior, provider behavior, database schema or UI semantics.

## Measurements

Baseline evidence from prior Build Memory Phase B:

- Phase B final peak working set: 2847.6 MB
- Generated static pages: 386
- Prerender route count: 6
- Largest server chunks included `26218.js` and `5139.js` at 1,752,235 combined bytes.

After Supabase server externalization:

- Peak working set: 2665.3 MB
- Generated static pages: 386
- Prerender route count: 6
- `26218.js` and `5139.js` no longer appear in the largest server-file list.

After Supabase externalization plus webpack build worker:

- First clean build peak working set: 2453.9 MB
- Repeat clean build peak working set: 2414.0 MB
- Generated static pages: 386
- Prerender route count: 6
- App page routes: 30

Measured reduction from Phase B final:

- 433.6 MB lower peak working set
- 15.23% peak reduction
- 1,752,235 bytes removed from the prior top server chunk list

## Evidence

- `docs/vercel-build-memory-recovery-v1-summary.json`
- `docs/build-memory-optimization-v1-phase2-supabase-externalized.json`
- `docs/build-memory-optimization-v1-phase2-supabase-externalized-worker.json`
- `docs/build-memory-optimization-v1-phase2-repeat.json`
- `docs/build-memory-optimization-v1-phase2-route-manifest.json`
- `docs/build-memory-optimization-v1-phase2-import-pressure.json`
- `scripts/vercel-build-memory-recovery-v1-validate.mjs`

The pre-existing untracked `docs/build-memory-optimization-v1-phase-b*.json` files were reviewed as prior diagnostics. They were not adopted wholesale; the relevant baseline measurements are summarized in the committed Phase 2 summary.

## Certification

Local clean builds passed twice with final settings.

Route and page counts remained stable:

- Generated static pages: 386
- Prerender routes: 6
- App page routes: 30

Safety:

- Provider calls: 0
- Database mutations: 0
- Production mutations: 0
- Manual Vercel deploy: not attempted
- Business-rule changes: none

Vercel Standard build recovery is not proven locally. The optimization is material and push-safe, but only the automatic Vercel build after push can prove the Standard build machine now completes.

## Markers

- VERCEL_BUILD_MEMORY_AUDIT_PASS
- VERCEL_BUILD_MEMORY_OPTIMIZATION_PASS
- BUILD_IMPORT_GRAPH_REDUCTION_PASS
- BUILD_ROUTE_PARITY_PASS
- LOCAL_CLEAN_BUILD_REPEATABILITY_PASS
- NO_PRODUCT_ROUTE_REMOVAL_PASS
- NO_BUSINESS_RULE_CHANGE_PASS
