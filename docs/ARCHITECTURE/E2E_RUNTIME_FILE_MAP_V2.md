# E2E Runtime File Map V2

Status: PI-03 audit artifact

Generated from repository inspection at commit `bf6db22c26d0b2ee5e251921aeb8ef90b153f1ac`.

This map covers runtime-relevant files under `src/app`, `src/services`, `src/lib`, `src/components`, `src/context`, `src/config`, `scripts`, `supabase/migrations`, `.github/workflows`, and `vercel.json`. Generated output, `node_modules`, `.next`, build folders, coverage, and archive material are excluded.

## Responsibility Map

| Area | Primary files | Classification | Production role |
|---|---|---|---|
| Vercel Cron primary scheduler | `vercel.json`, `src/app/api/cron/operating-day/route.ts` | SCHEDULER, OPERATIONS | Primary automated trigger for protected operating-day execution. |
| GitHub fallback scheduler | `.github/workflows/production-operating-day.yml`, `.github/workflows/production-operating-day-heartbeat.yml` | SCHEDULER, OPERATIONS | Fallback and heartbeat evidence. Calls same protected endpoint. |
| Protected operating day orchestration | `src/services/adaptive-refresh-orchestrator.service.ts` | SCHEDULER, OPERATIONS, PROVIDER, SETTLEMENT, LEARNING, PERFORMANCE | Selects the next bounded action, delegates acquisition/result/settlement paths, reports health. |
| Event refresh planning | `src/services/event-refresh-planner.service.ts`, `src/app/api/operations/event-refresh-plan/route.ts` | FRESHNESS, SCHEDULER, OPERATIONS | Builds event-level refresh plans and due-now classifications. |
| Event lifecycle | `src/services/event-lifecycle-state.service.ts`, `src/app/api/operations/event-lifecycle/route.ts` | OPERATIONS, RESULT_IMPORT, SETTLEMENT, LEARNING, PERFORMANCE | Classifies each event state and next observational action. |
| Provider budget | `src/services/provider-budget.service.ts`, `src/app/api/providers/budget/status/route.ts` | PROVIDER, OPERATIONS | Authorizes and reports provider budget usage. |
| SportsDataIO acquisition | `src/services/canonical-acquisition.service.ts`, `src/services/sportsdataio-mlb-normalization.service.ts`, `src/services/sportsdataio-discovery-lab-url.service.ts` | PROVIDER, INGESTION, NORMALIZATION, PERSISTENCE | Fetches GameOddsByDate, normalizes odds, persists `sports_odds_snapshots`. |
| Current Board | `src/services/current-board.service.ts`, `src/app/api/current-board/route.ts` | PRODUCT_API, PREDICTION, FRESHNESS, RANKING, RECOMMENDATION | Canonical current prediction evidence surface joining `prediction_history`, `sport_events`, and `sports_odds_snapshots`. |
| Product freshness SLA | `src/services/product-freshness-sla.service.ts` | FRESHNESS, RECOMMENDATION | Actionability freshness contract based on provider market timestamp, not page/generated time. |
| Market alignment | `src/services/market-alignment.service.ts` | FRESHNESS, RECOMMENDATION, RANKING | Calculates price/probability alignment, EV, edge, display freshness, and market-level reasons. |
| Market semantics | `src/services/market-semantics.service.ts` | RECOMMENDATION, SETTLEMENT | Defines binary/push behavior for moneyline, spread/run line, total. |
| Homepage daily brief | `src/components/home/HomeBettingPlan.tsx`, `src/app/page.tsx`, `src/services/dashboard-today.service.ts`, `src/app/api/dashboard/today/route.ts` | PRODUCT_UI, PRODUCT_API, RECOMMENDATION | Home experience driven by dashboard-today and Current Board-derived evidence. |
| Dashboard | `src/components/dashboard/DashboardShell.tsx`, `src/app/dashboard/page.tsx`, `src/services/dashboard.service.ts`, `src/app/api/dashboard/route.ts` | PRODUCT_UI, PRODUCT_API, OPERATIONS | Product and diagnostic shell. |
| Most Likely | `src/services/market-opportunity-suite.service.ts`, `src/components/market-opportunities/MostLikelyTool.tsx`, `src/app/api/market-opportunities/most-likely/route.ts` | PRODUCT_API, PRODUCT_UI, RANKING | Ranking layer over Current Board candidates. |
| Best Value | `src/services/best-value-scanner.service.ts`, `src/components/market-opportunities/BestValueTool.tsx`, `src/app/api/market-opportunities/best-value/route.ts` | PRODUCT_API, PRODUCT_UI, RANKING | Value filter over Current Board candidates. |
| Betting Workbench / Workspace | `src/app/betting-workbench/page.tsx`, `src/components/market-opportunities/BettingDecisionWorkspace.tsx` | PRODUCT_UI | Consumes Current Board plus user-led wager ledger. Does not mutate model history. |
| Game Intelligence | `src/services/game-intelligence.service.ts`, `src/app/game-intelligence/[eventId]/page.tsx`, `src/app/api/games/[eventId]/intelligence/route.ts` | PRODUCT_API, PRODUCT_UI, DIAGNOSTIC | Event-detail intelligence surface. |
| Performance | `src/services/performance-scope-v2.service.ts`, `src/services/performance-product-contract.service.ts`, `src/services/ai-performance-center.service.ts`, `src/app/api/performance/route.ts`, `src/components/performance/PerformanceProductClient.tsx` | PERFORMANCE, LEARNING, PRODUCT_API, PRODUCT_UI | Current Era production performance and trust. |
| Settlement state | `src/services/canonical-settlement-state.service.ts`, `src/app/api/operations/settlement-guarantee/route.ts` | SETTLEMENT, PERFORMANCE | Read-only guarantee and settlement eligibility classifications. |
| Learning | `src/services/ai-learning-lifecycle.service.ts`, `src/services/epoch-performance-learning-v2.service.ts` | LEARNING, PERFORMANCE | Reads settled production rows for learning evidence; does not alter weights during audit. |
| Prediction epoch runtime | `src/services/prediction-epoch-runtime.service.ts`, `supabase/migrations/202607270001_prediction_epoch_governance_v2.sql` | PREDICTION, PERSISTENCE | Active Current V2 epoch selection. |
| Legacy/prospective prediction paths | `src/services/sportsdataio-mlb-prospective-preview.service.ts`, `src/app/api/mlb/predictions/v6-regeneration/route.ts`, `src/app/api/mlb/predictions/v7-regeneration/route.ts`, historical scripts | LEGACY, DIAGNOSTIC, PREVIEW | Preview/shadow/regeneration paths. Not the product actionability source. |
| User wager ledger | `src/services/user-wager-ledger.service.ts`, `src/app/api/user/wagers/**/route.ts` | PRODUCT_API, PRODUCT_UI | Personal user ledger, separate from model predictions and performance. |

## Duplicate Or Overlapping Responsibilities

| Responsibility | Overlapping files | Classification |
|---|---|---|
| Prediction probability generation | MLB prospective preview, legacy model audit, historical replay, BSN/NBA/NFL/NHL engines | SAFE_LEGACY unless used by production surface; Current Board uses persisted `prediction_history` Current Era rows. |
| Freshness | `current-board.service.ts`, `market-alignment.service.ts`, `product-freshness-sla.service.ts`, `adaptive-refresh-orchestrator.service.ts`, `event-refresh-planner.service.ts` | EXPECTED_DUAL_FRESHNESS_CONTRACT. Display freshness and actionability freshness differ. |
| Performance | `performance-scope-v2`, `performance-product-contract`, `ai-performance-center` | EXPECTED_SCOPE_DIFFERENCE. Product presentation reconciles Current Era production and non-production analysis rows. |
| Market odds | `prediction_history.odds`, `sports_odds_snapshots`, Current Board canonical price | HIGH_LINKAGE_GAP for complement-derived outcomes where opposite price is not rebound. |

## Production-Surface Classification

| Surface | Source API | Source service | Canonical source |
|---|---|---|---|
| Homepage | `/api/dashboard/today` | `dashboard-today.service.ts` | Current Board + model-only fallback sections. |
| Dashboard | `/api/dashboard`, `/api/dashboard/today` | dashboard services | Current Board and operations services. |
| Current Board | `/api/current-board` | `current-board.service.ts` | `prediction_history` current epoch plus `sports_odds_snapshots`. |
| Most Likely | `/api/market-opportunities/most-likely` | `market-opportunity-suite.service.ts` | Current Board candidates. |
| Best Value | `/api/market-opportunities/best-value` | `best-value-scanner.service.ts` | Current Board candidates. |
| Betting Workbench | `/api/current-board` | `current-board.service.ts` | Current Board plus user ledger. |
| Game Intelligence | `/game-intelligence`, `/api/games/[eventId]/intelligence` | `game-intelligence.service.ts` | Event diagnostics plus Current Board lineage. |
| Performance | `/api/performance` | performance services | Current Era production scope over `prediction_history`. |

