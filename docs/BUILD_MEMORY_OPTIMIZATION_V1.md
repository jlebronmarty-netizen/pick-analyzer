# Build Memory Optimization V1

Status: Phase A complete, broader optimization paused.

## Objective

Reduce Vercel Standard build memory pressure without changing application behavior, prediction logic, scheduler behavior, Official Picks, Learning Brain, probabilities, APIs, database schema or provider behavior.

The production failure occurs during `Creating an optimized production build`, so this pass measured both static prerender pressure and server bundle pressure.

## Phase A Scope

The following thin page wrappers were inspected before modification:

- `/ai-bet-finder`
- `/arbitrage`
- `/best-value`
- `/betting-workbench`
- `/model`
- `/most-likely`

None of the six routes defines `generateStaticParams`, `generateMetadata`, static `metadata`, build-time `fetch`, route-level cache assumptions or static export behavior. Each route is a wrapper around a client experience or runtime API-backed screen.

Each page now exports only:

```ts
export const dynamic = 'force-dynamic'
```

No `revalidate = 0` was added.

## Measurements

Measurement files:

- `docs/build-memory-optimization-v1-baseline.json`
- `docs/build-memory-optimization-v1-phase-a.json`
- `docs/build-memory-optimization-v1-phase-a-manifest.json`
- `docs/build-memory-optimization-v1-import-pressure.json`

The baseline wrapper had an exit-code capture defect after the build output completed, so `success` is false in the raw baseline JSON even though the build reached the completed route table. The wrapper was corrected before the Phase A build and now records exit code reliably.

| Metric | Baseline | Phase A | Change |
| --- | ---: | ---: | ---: |
| Prerender routes | 12 | 6 | -6 |
| Generated static pages | 392 | 386 | -6 |
| Build duration | 71.08s | 77.83s | +6.75s |
| Peak observed working set | 2629.6 MB | 2715.2 MB | +85.6 MB |
| Route manifest static routes | 425 | 425 | 0 |
| Route manifest dynamic routes | 30 | 30 | 0 |

Remaining static prerender routes after Phase A:

- `/`
- `/_global-error`
- `/_not-found`
- `/favicon.ico`
- `/login`
- `/register`

## Verified Bundle Pressure

Phase A did not materially reduce peak memory. The next verified contributors are server build and trace pressure rather than the six prerendered dashboard/admin wrappers.

Largest generated server files after Phase A:

- `.next/server/chunks/60319.js` - 1,255,831 bytes
- `.next/server/chunks/26218.js` - 876,552 bytes
- `.next/server/chunks/99684.js` - 876,552 bytes
- `.next/server/chunks/3445.js` - 413,704 bytes
- `.next/server/app/dashboard/page.js` - 346,375 bytes
- `.next/server/chunks/73740.js` - 337,304 bytes
- `.next/server/app/performance/page.js` - 219,804 bytes
- `.next/server/app/probability-picks/page.js` - 207,485 bytes
- `.next/server/app/ai-operations/page.js` - 194,927 bytes

Import pressure audit:

- 353 files import server-side services or admin/server-only modules.
- 408 total server-service/admin imports were found across `src/app` and `src/components`.
- Most repeated service imports include `bsn-platform.service`, `multi-sport-resolution.service`, `multi-sport-query.service`, `nba-data-sync.service`, `performance-product-contract.service`, `mlb-player-projection-engine.service`, `mlb-model-platform.service`, `probability-picks.service` and `bankroll.service`.
- `src/app/data-coverage/page.tsx`, `src/app/ai-operations/page.tsx`, and several API routes are notable import fan-in points.

## Phase A Result

Phase A is behavior-safe and reduces static prerender work, but it does not materially reduce peak build memory. Per the approved stop rule, no broader bundle refactor was attempted in this pass.

Deployment is not yet justified from this optimization alone.

## Recommended Next Phase

Investigate server bundle and route-tracing pressure with a focused import-boundary pass:

- inspect the largest numbered server chunks to identify module composition;
- split heavy dashboard server aggregators away from shared layouts and client surfaces where possible;
- replace broad server-service imports in page components with narrower route/API boundaries only when behavior can remain identical;
- audit whether admin/data-coverage pages pull multi-sport provider/sync services into the production build graph unnecessarily;
- keep all prediction, probability, scheduler, provider, Official Pick and Learning Brain behavior unchanged.
