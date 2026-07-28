# Full Platform Audit V1

Generated: 2026-07-28T23:24:26.519Z

## Program Status

READ_ONLY_AUDIT_COMPLETE. No production data mutations, settlement writes, prediction writes, model-weight changes or provider calls were made by this audit script.

## Repository Inventory

- App pages: 28
- API routes: 428
- Services: 286
- Components: 125
- Config files: 4
- Lib files: 7
- Scripts: 90
- Validation scripts: 32
- Migrations: 28
- Docs: 454
- DB tables referenced in code: 43

## Service Categories

- other: 176
- scheduler: 4
- learning: 8
- performance: 3
- provider: 29
- product: 5
- prediction: 32
- sync: 10
- feature: 14
- identity: 3
- settlement: 2

## Sport Readiness Matrix

| Sport | Key | Events | Results | Odds | Features | Predictions | Settled | State | Blocker |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |
| MLB | baseball_mlb | 4923 | 484 | 53889 | 72635 | 1194 | 944 | Production | None for active MLB core; 67 rows await results |
| NBA | basketball_nba | 14 | 0 | 540 | 47 | 27 | 27 | Shadow/Contract | Provider/data readiness incomplete |
| NFL | americanfootball_nfl | 75 | 0 | 1978 | 776 | 966 | 0 | Preview | Promotion blocked pending final results/settlement/learning certification |
| NHL | icehockey_nhl | 32 | 0 | 426 | 258 | 258 | 0 | Preview | Promotion blocked pending final results/settlement/learning certification |
| Soccer | soccer | 0 | 0 | 260 | 0 | 0 | 0 | Shadow/Contract | Provider/data readiness incomplete |
| BSN | basketball_bsn | 38 | 2 | 0 | 0 | 8 | 0 | Shadow/Contract | Provider/data readiness incomplete |
| Tennis | tennis | 0 | 0 | 0 | 0 | 0 | 0 | Disabled/Unavailable | Provider/data readiness incomplete |
| UFC | mma_mixed_martial_arts | 0 | 0 | 0 | 0 | 0 | 0 | Disabled/Unavailable | Provider/data readiness incomplete |

## End-To-End Pipeline Results

MLB is the only production-grade end-to-end sport. NFL and NHL have preview prediction and feature evidence but remain promotion-blocked until completed games produce canonical results, settlement labels and performance evidence. Other sports have partial contract/shadow data and should not be presented as production prediction sports.

## Dead Or Disconnected Systems

The static import scan found 14 services without direct service-import callers. This is not deletion evidence because scripts, dynamic imports and diagnostic routes can still be valid consumers. These candidates are classified as UNKNOWN until an owner/status pass proves ACTIVE, SHADOW, PREVIEW, EXPERIMENTAL, DEPRECATED, ORPHANED or DEAD.

## Data Integrity Findings

- MLB canonical settlement backlog is now ready 0 / awaiting 67.
- Duplicate MLB game_results by game_id: 0.
- Operating-day settled rows missing required linkage/accounting evidence in sampled scope: 0.
- Result-based settlement counts must remain preferred over legacy status-only counts.

## Business Rule Contradictions

No probability, confidence, Trust, Official Pick policy or settlement scoring formula mutation was made. The main contradiction found is metric-source drift: some surfaces can count settled-like status while canonical performance closure uses deterministic result values.

## Scheduler Findings

Adaptive refresh and operating-day execution remain separate responsibilities. Scheduler-selected action can be `midday_refresh` while direct protected settlement remains available for audited canonical-ready batches. Settlement readiness should use shared `game_results` evidence to avoid future masking or starvation drift.

## Product/API Connection Findings

Major product pages generally route through service-backed APIs, but Performance and learning labels have reporting terminology risks. `/performance` renders quickly while `/api/performance` has slow and variable bounded-response behavior.

## Performance Findings

- CRITICAL: none proven in local validation.
- HIGH: Vercel optimized build OOM remains a deployment blocker.
- HIGH: `/api/performance` has slow and variable bounded-response behavior.
- MEDIUM: import hotspots repeatedly pull current-board, provider-time, feature-store, top-picks and production-data-gate services.
- LOW: 386 static pages are locally buildable but still add deployment pressure.

## Security Findings

No committed secret was identified by the targeted audit scan. Mutation routes and cron/admin routes require a separate auth-hardening pass before any broad exposure changes. This audit made zero provider calls and zero writes.

## Documentation Drift

Docs and scripts still use "learning labels" language in places where the canonical implementation is derived learning evidence from `prediction_history` plus feature evidence. Historical Build Memory and OOM blocker docs remain uncommitted unrelated work and were not touched.

## Duplication Findings

- settlement readiness: 8 candidate files
- result sync: 2 candidate files
- learning labels/evidence: 13 candidate files
- performance aggregation: 9 candidate files
- event identity/crosswalk: 7 candidate files
- sports registries: 28 candidate files
- operating date/timezone: 8 candidate files

## Material Findings

### P1 - /api/performance has slow and variable bounded-response behavior
- Files: src/app/api/performance/route.ts, src/services/ai-performance-center.service.ts
- Evidence: One bounded recovery smoke returned TIMEOUT_OR_FAIL_28 for /api/performance at 45 seconds while /performance rendered 200; the later representative audit smoke returned 200 in 37.2 seconds.
- User impact: Performance data exists, but API consumers can approach or exceed route budgets depending on runtime/database conditions.
- Recommended repair: Profile /api/performance query fan-out; add date/sport bounds, precomputed summaries or shared cached snapshot after audit.
- Regression risk: Medium

### P1 - Vercel optimized build OOM remains unresolved
- Files: next.config.ts, src/app, src/services
- Evidence: Local build passes with 386 static pages; prior Vercel Standard build fails during optimized production build from memory pressure.
- User impact: Automatic deployment after push may fail even when code validation passes.
- Recommended repair: Continue Build Memory Optimization Phase B/C using import graph and route tracing; avoid product behavior changes.
- Regression risk: Medium

### P1 - Historical settled status and deterministic result counts diverge
- Files: prediction_history, src/services/operating-day.service.ts, docs/PROJECT_STATUS.md
- Evidence: Read-only counts show MLB result-based settled 944 while raw settled-like status is higher due older audit rows carrying win/loss/push status without deterministic result.
- User impact: Product surfaces using status instead of result can overstate performance or learning samples.
- Recommended repair: Standardize performance/settlement counts on deterministic result in win/loss/push and document legacy status rows.
- Regression risk: High

### P2 - Learning labels are derived evidence, but several docs/scripts still imply standalone learning label rows
- Files: src/services/ai-learning-lifecycle.service.ts, src/services/data-coverage-inventory.service.ts, scripts/live-multi-sport-acquisition-v1-final-certify.mjs, docs/CORE_PREDICTION_CERTIFICATION_ROADMAP_V1.md
- Evidence: Data coverage says learning labels are derived/evidence-scoped; AI Operations builds a read-only queue from prediction_history; no standalone canonical row count is claimed.
- User impact: Operators may look for a nonexistent learning_labels table or assume label writes are missing.
- Recommended repair: Rename reporting to derived learning evidence unless a dedicated table is approved later.
- Regression risk: Low

### P2 - Settlement readiness exists in multiple services with different evidence boundaries
- Files: src/services/operating-day.service.ts, src/services/adaptive-refresh-orchestrator.service.ts, src/services/settlement-reconciliation.service.ts
- Evidence: Operating-day settlement uses canonical game_results; Settlement Reconciliation V2 stores compatibility lifecycle metadata; adaptive scheduler also classifies backlog for action choice.
- User impact: Small differences can cause scheduler/action mismatch or confusing backlog counts.
- Recommended repair: Extract a shared canonical settlement-readiness helper and keep reconciliation compatibility as a wrapper.
- Regression risk: High

### P2 - Large number of unlinked or low-discoverability pages/routes
- Files: src/app/admin/historical-diagnostics/page.tsx, src/app/data-coverage/[sport]/page.tsx, src/app/game-intelligence/[eventId]/page.tsx, src/app/login/page.tsx, src/app/player-projections/[projectionId]/page.tsx, src/app/register/page.tsx, src/app/sports-center/[sport]/page.tsx
- Evidence: 7 pages were not found in the sampled navigation text.
- User impact: Features may exist but be hard to discover, or dead pages may appear maintained.
- Recommended repair: Perform navigation ownership pass; classify each page as ACTIVE, ADMIN, EXPERIMENTAL or DEPRECATED before deletion.
- Regression risk: Low

### P2 - Service responsibility duplication hotspots require consolidation plan
- Files: src/services/adaptive-refresh-orchestrator.service.ts, src/services/basketball/reconciliation/reconciliation-engine.ts, src/services/nba-prediction-settlement.service.ts, src/services/multi-sport-results-crosswalk-foundation.service.ts, src/services/results-sync.service.ts, scripts/autonomous-daily-ai-v1-validate.mjs, scripts/full-platform-audit-v1.mjs, scripts/live-multi-sport-acquisition-v1-checkpoint-a.mjs
- Evidence: settlement readiness: 8; result sync: 2; learning labels/evidence: 13; performance aggregation: 9; event identity/crosswalk: 7; sports registries: 28; operating date/timezone: 8
- User impact: Duplicate responsibility increases bug-fix drift across product pages, scheduler, and APIs.
- Recommended repair: Consolidate only after per-call-site contract review; start with settlement readiness and performance aggregation.
- Regression risk: Medium

### P3 - Unused-service scan has many false-positive candidates that need owner classification
- Files: src/services/apis/api-sports.ts, src/services/apis/odds-api.ts, src/services/basketball/connectors/connector-contract.ts, src/services/basketball/index.ts, src/services/bsn-core-certification.service.ts, src/services/bsn-predictions.service.ts, src/services/dashboard.service.ts, src/services/mlb-market-expansion-roadmap.service.ts
- Evidence: 14 service files were not reached by simple static service import matching.
- User impact: Some may be script-only, dynamic-imported, or dead; static count is not deletion evidence.
- Recommended repair: Add owner/status front matter or registry comments for ACTIVE/SHADOW/PREVIEW/DEPRECATED services.
- Regression risk: Low

### P3 - MLB unresolved settlement backlog remains evidence-blocked
- Files: game_results, prediction_history
- Evidence: {"pending":67,"ready":0,"awaiting":67,"resultReadError":null}
- User impact: 67 MLB predictions remain pending until canonical result evidence exists.
- Recommended repair: Continue canonical result ingestion recovery only; do not infer from sport_events alone.
- Regression risk: Low

## P0 Findings

- None proven by this read-only audit.

## P1 Findings

- `/api/performance` has slow and variable bounded-response behavior.
- Vercel optimized build OOM remains unresolved.
- Historical settled status and deterministic result counts diverge.

## P2 Findings

- Learning labels are derived evidence, but several docs/scripts still imply standalone learning label rows.
- Settlement readiness exists in multiple services with different evidence boundaries.
- Large number of unlinked or low-discoverability pages/routes.
- Service responsibility duplication hotspots require consolidation plan.

## P3 Findings

- Unused-service scan has many false-positive candidates that need owner classification.
- MLB unresolved settlement backlog remains evidence-blocked.

## Validation Evidence

- Static route inventory: generated.
- Import graph hotspot scan: generated.
- Read-only database audit: passed.
- Provider calls: 0
- Remote mutations: 0
- Expected follow-up validation: npm build, ESLint, diff check, secret scan, bounded smoke.

## Remaining Blockers

- Vercel build OOM remains a deployment blocker independent of this audit.
- /api/performance is slow/variable and should remain a performance repair target even though the representative audit smoke returned 200 inside 45s.
- 67 MLB predictions await canonical result evidence.
- Broader cleanup requires phased repair, not ad hoc deletion.
