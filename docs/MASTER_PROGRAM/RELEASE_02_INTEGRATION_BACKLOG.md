# Release 02 Integration Backlog

Status: CERTIFICATION BACKLOG

Release 02 converts the Release 01 inventory into a bounded product-integration backlog. It does not create new product features, alter prediction math, change official-pick policy, change learning weights, call paid providers, mutate production data, or redesign architecture.

Baseline artifacts:

- [Product Inventory V2](../PRODUCT/PRODUCT_INVENTORY_V2.md)
- [Runtime Dependency Graph](../ARCHITECTURE/RUNTIME_DEPENDENCY_GRAPH.md)
- [Feature Matrix V2](../PRODUCT/FEATURE_MATRIX_V2.md)
- [Route Audit V2](../PRODUCT/ROUTE_AUDIT_V2.md)
- [Database Audit V2](../ARCHITECTURE/DATABASE_AUDIT_V2.md)
- [Prediction Pipeline Audit](../PRODUCT/PREDICTION_PIPELINE_AUDIT.md)
- [Documentation Validation](../CERTIFICATION/DOCUMENTATION_VALIDATION.md)
- [Runtime Health](../CERTIFICATION/RUNTIME_HEALTH.md)

## Scope Decision

No P0 or P1 runtime defect was proven by the repository evidence reviewed in Release 02. The repository already contains canonical services for cutoff enforcement, pregame coverage accounting, Today product state, current-board presentation, settlement guarantee, learning eligibility and performance scoping.

Release 02 therefore closes as product-integration certification and documentation. Runtime code was not changed.

## Backlog

| Priority | Item | Evidence | Affected Files / Routes / Services | User-Visible Symptom | Runtime Impact | Reproduction Method | Acceptance Criteria | Release 02 Scope |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P2 | Production verification requires live environment evidence after deployment. | Release 02 validation is repository-local and static; no local HTTP server was started. | `/api/system/version`, `/api/dashboard/today`, `/api/current-board`, `/api/operations/settlement-guarantee`, `/api/performance` | Product may be locally certified before production deployment is observed. | Deployment visibility, not application logic. | Push certified commit, then poll read-only production routes. | Production serves the Release 02 commit and read-only routes return valid responses with zero provider calls and zero mutations. | Certification follow-up after push/deploy only. |
| P2 | Durable missed-opportunity representation remains diagnostic-first. | [DATABASE_AUDIT_V2.md](../ARCHITECTURE/DATABASE_AUDIT_V2.md) and `src/services/data-coverage-inventory.service.ts` disclose `missed_pipeline_opportunities` as diagnostic-only until canonical records exist. | `src/services/pregame-scheduler-coverage.service.ts`, `src/services/data-coverage-inventory.service.ts`, operating-day diagnostics | A missed pregame window is visible as scheduler coverage/rejection reason rather than a first-class opportunity row. | No retrospective prediction risk; analytics may need a durable missed-opportunity table later. | Inspect pregame coverage output and data coverage inventory. | Every unpredicted event has a persisted or diagnostic reason; no post-start prediction is fabricated. | Documented; no migration in Release 02 because existing diagnostic representation is safe. |
| P2 | Live-state certification depends on canonical Today/current-board contracts staying aligned. | `src/services/dashboard-today.service.ts` uses `/api/dashboard/today`, current-board summaries, scheduler coverage and learning summaries. | `/api/dashboard/today`, `/api/current-board`, `src/components/home/HomeBettingPlan.tsx` | Stale or empty product cards should explain why rather than implying completed evaluation. | User trust and product coherence. | Run Release 02 validator and route-level read-only checks after deployment. | Loading, empty, stale and blocked states map to canonical reasons. | In scope as documentation/validator; no runtime defect proven. |
| P3 | Circular import candidates should remain monitored. | Release 01 found four candidates; Release 02 verified the back edges are `import type`. | `current-board.service.ts`, `market-intelligence-category.service.ts`, `official-pick-experience.service.ts`, `mlb-ai-picks-feed.service.ts`, `model-learning.service.ts`, `weight-optimizer.service.ts` | None currently proven. | Type-only imports are erased and do not create runtime initialization cycles. | Run `node scripts/release02-product-integration-validate.mjs`. | Validator confirms all four candidate back edges remain type-only. | Closed as verified non-defect. |
| P3 | Static orphan/dead utility candidates require manual proof before deletion. | [RUNTIME_HEALTH.md](../CERTIFICATION/RUNTIME_HEALTH.md) lists candidates using static inbound-import heuristics only. | Multiple utilities and services. | None necessarily; false positives likely. | Cleanup risk if removed without proof. | Manual usage trace and build/test after each bounded cleanup. | Only delete with direct proof of no runtime, script or dynamic usage. | Out of scope. |

## Required Before Release 03

- Complete production read-only certification if Release 02 is pushed and auto-deployed.
- Keep missed-opportunity persistence as a design candidate, not a rushed migration.

## Can Move To V2 Backlog

- First-class missed-opportunity table if diagnostics become insufficient.
- Cleanup of verified dead utilities.
- Optional dependency-inversion cleanup for type-only circular candidates.
