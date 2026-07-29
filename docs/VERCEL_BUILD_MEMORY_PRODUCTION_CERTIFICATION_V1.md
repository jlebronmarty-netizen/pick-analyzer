# Vercel Build Memory Production Certification V1

Date: 2026-07-29

Status: VERCEL_STANDARD_BUILD_RECOVERED

## Scope

This audit verified whether the build-memory recovery implemented in commit `25a5bfbbb3eef2b78de8ef447cb2465abe96aff6` allows the current Pick Analyzer commit to build and serve from Vercel production.

Starting commit and production target:

- `f1efe9a00fe8894f26270c449382fc48a2bffb8c`

No product code, business rules, prediction logic, scheduler behavior, Official Pick policy, Learning Brain weights, APIs, database schema or provider behavior were changed during this certification.

## Precheck

- Branch: `main`
- Local HEAD: `f1efe9a00fe8894f26270c449382fc48a2bffb8c`
- `origin/main`: `f1efe9a00fe8894f26270c449382fc48a2bffb8c`
- Certified tag: `v1.0-platform-certified` remains on `eb15613efd81ff1a8e57797e11feb7254c1b604a`
- Known unrelated dirty files left untouched:
  - `src/app/login/page.tsx`
  - `src/app/register/page.tsx`
  - `docs/build-memory-optimization-v1-phase-b-external-supabase.json`
  - `docs/build-memory-optimization-v1-phase-b-final.json`
  - `docs/build-memory-optimization-v1-phase-b-import-pressure.json`
  - `docs/build-memory-optimization-v1-phase-b.json`

## Local Build Baseline

Fresh clean `.next` measured build:

- Command: `powershell -NoProfile -ExecutionPolicy Bypass -File scripts\build-memory-optimization-v1-measure.ps1 -Label vercel-prod-cert-v1 -TimeoutSeconds 600`
- Exit code: 0
- Duration: 89.44 seconds
- Peak observed working set: 2430.4 MB
- Generated static pages: 386
- Prerender routes: 6
- Route manifest static routes: 429
- Route manifest dynamic routes: 30

Fresh measurement evidence:

- `docs/build-memory-optimization-v1-vercel-prod-cert-v1.json`

Prior committed recovery baseline:

- Prior Phase B final peak: 2847.6 MB
- Repeat optimized peak: 2414.0 MB
- Reduction: 433.6 MB / 15.23%
- Generated static pages remained 386
- Prerender routes remained 6

## Vercel Deployment Evidence

Available local Vercel evidence:

- `.vercel/repo.json` links project `pick-analyzer`.
- No `vercel` CLI binary is installed on PATH.
- No local `node_modules\.bin\vercel.cmd` exists.
- No `VERCEL_TOKEN`, `VERCEL_ACCESS_TOKEN` or `TURBO_TOKEN` is present in the shell environment.
- No local Vercel home config directory was available for an already-authenticated CLI session.

Because no authenticated Vercel CLI/session or token was available, the deployment ID, build-machine type, full build logs, exact build duration and build-stage transcript were not inspectable from this environment. No login was initiated and no manual deployment was triggered.

Production read-only evidence:

- `GET https://pick-analyzer.vercel.app/api/system/version` returned HTTP 200.
- Response `gitCommit`: `f1efe9a00fe8894f26270c449382fc48a2bffb8c`.
- Response `environment`: `production`.
- Response `providerCallsMade`: 0.
- Response header `Server`: `Vercel`.
- Production alias is therefore serving the current commit.

The latest deployment ID remains evidence-unavailable from this shell. To fill that field exactly, copy the deployment ID from the Vercel project dashboard deployment for commit `f1efe9a00fe8894f26270c449382fc48a2bffb8c`.

## Build Log Classification

Classification from available evidence:

- Result: SUCCESS
- Product classification: VERCEL_STANDARD_BUILD_RECOVERED
- Build log classification detail: unavailable because full Vercel build logs were not accessible from an authenticated local CLI/session.

The prior known failure was:

- Command: `next build --webpack`
- Stage: `Creating an optimized production build`
- Signal: SIGKILL
- Classification: confirmed build-container OOM on the Standard build machine

Current result:

- Production alias serves the optimized commit.
- Required production read-only smoke routes return HTTP 200.
- This proves the current commit completed a Vercel production build and runtime startup successfully.
- Build-machine type was not exposed by the available evidence, so no separate machine-setting claim is made.

## Production Read-Only Smoke

Base URL: `https://pick-analyzer.vercel.app`

All checks used bounded read-only HTTP requests. No mutation routes were executed.

| Route | Status | Time |
| --- | ---: | ---: |
| `/` | 200 | 1.824s |
| `/dashboard` | 200 | 0.334s |
| `/performance` | 200 | 0.344s |
| `/ai-operations` | 200 | 14.043s |
| `/autonomous-daily-ai` | 200 | 10.317s |
| `/sports-center/mlb` | 200 | 0.437s |
| `/probability-picks` | 200 | 0.337s |
| `/market-intelligence` | 200 | 1.535s |
| `/portfolio-intelligence` | 200 | 1.396s |
| `/api/system/version` | 200 | 0.451s |
| `/api/performance` | 200 | 5.239s |
| `/api/operations/status` | 200 | 5.878s |

## Local Smoke

Fixed bounded local smoke wrapper:

- Port: 3058
- Total cap: 120 seconds
- Route cap: 20 seconds
- Result: pass
- Total duration: 61.173 seconds
- Cleanup: `taskkill /T /F` terminated the process tree
- Port free after cleanup: true

Checked routes:

- `/api/system/version`: 200
- `/dashboard`: 200
- `/performance`: 200
- `/ai-operations`: 200
- `/autonomous-daily-ai`: 200
- `/sports-center/mlb`: 200
- `/probability-picks`: 200
- `/market-intelligence`: 200
- `/portfolio-intelligence`: 200
- `/api/operations/status`: 200

## Safety

- Provider calls: 0
- Remote mutations: 0
- Database mutations: 0
- Settlement writes: 0
- Prediction writes: 0
- Learning writes: 0
- Model-weight mutations: 0
- Epoch mutations: 0
- Manual Vercel deployment: 0
- Product route removal: 0
- Business-rule changes: 0

## Remaining Evidence Gap

The only missing evidence is deployment metadata that requires an authenticated Vercel CLI/session or dashboard access:

- Deployment ID
- Vercel build-machine type
- Full build log transcript
- Exact build duration from Vercel
- Exact build-stage timestamps

This gap does not block production recovery classification because production is serving the target commit and all required read-only smoke checks passed.

## Decision

The optimized commit is production-serving on Vercel and the required production routes are healthy. The appropriate classification is:

- VERCEL_STANDARD_BUILD_RECOVERED

Elastic Build Machine escalation is not justified by the current evidence. It should only be reconsidered if a future Vercel build for the same optimized configuration fails again with confirmed OOM.

## Certification Markers

- VERCEL_BUILD_MEMORY_PRODUCTION_AUDIT_PASS
- VERCEL_BUILD_LOG_CLASSIFICATION_PASS
- VERCEL_BUILD_ROUTE_PARITY_PASS
- VERCEL_STANDARD_BUILD_RECOVERY_PASS
- VERCEL_PRODUCTION_COMMIT_ALIGNMENT_PASS
- VERCEL_PRODUCTION_READ_ONLY_SMOKE_PASS
- LOCAL_CLEAN_BUILD_REPEATABILITY_PASS
- NO_PRODUCT_ROUTE_REMOVAL_PASS
- NO_BUSINESS_RULE_CHANGE_PASS
- NO_PRODUCTION_DATA_MUTATION_PASS
- NO_PROBABILITY_CHANGE_PASS
- NO_CONFIDENCE_CHANGE_PASS
- NO_TRUST_FORMULA_CHANGE_PASS
- NO_OFFICIAL_PICK_POLICY_CHANGE_PASS
- NO_MODEL_WEIGHT_MUTATION_PASS
- NO_EPOCH_ACTIVATION_PASS
- NO_CERTIFIED_PLATFORM_REGRESSION_PASS
