# Runtime Dependency Graph

Generated from static imports, route files, workflow files and database references.

## Page To API To Service To Repository To Database

| Surface | Route | Imports / Services | Database References |
| --- | --- | --- | --- |
| src/app/api/ai-bet-finder/route.ts | /api/ai-bet-finder | @/lib/api-contract<br>@/services/ai-bet-finder.service<br>next/server | None detected |
| src/app/api/ai-operations/lifecycle/route.ts | /api/ai-operations/lifecycle | @/services/ai-learning-lifecycle.service<br>next/server | None detected |
| src/app/api/ai-performance-center/daily-update/route.ts | /api/ai-performance-center/daily-update | @/lib/server-lazy-diagnostics<br>next/server | None detected |
| src/app/api/ai-performance-center/route.ts | /api/ai-performance-center | @/lib/server-lazy-diagnostics<br>next/server | None detected |
| src/app/api/ai/coach/route.ts | /api/ai/coach | @/config/sports.config<br>@/services/ai-coach.service<br>next/server | None detected |
| src/app/api/ai/copilot/chat/route.ts | /api/ai/copilot/chat | @/services/ai-copilot-chat.service<br>next/server | None detected |
| src/app/api/ai/copilot/route.ts | /api/ai/copilot | @/services/ai-copilot.service<br>next/server | None detected |
| src/app/api/ai/game-analysis/route.ts | /api/ai/game-analysis | @/services/ai-game-analysis.service<br>next/server | None detected |
| src/app/api/ai/sports-brain/route.ts | /api/ai/sports-brain | @/config/sports.config<br>@/services/ai-sports-brain.service<br>next/server | None detected |
| src/app/api/analytics/charts/route.ts | /api/analytics/charts | @/services/analytics-charts.service<br>next/server | None detected |
| src/app/api/analytics/clv/route.ts | /api/analytics/clv | @/services/clv-analytics.service<br>next/server | None detected |
| src/app/api/analytics/dashboard/route.ts | /api/analytics/dashboard | @/services/analytics.service<br>next/server | None detected |
| src/app/api/autonomous-daily-ai/route.ts | /api/autonomous-daily-ai | @/services/autonomous-daily-ai.service<br>next/server | None detected |
| src/app/api/autonomous-daily-operations/daily-report/route.ts | /api/autonomous-daily-operations/daily-report | @/lib/api-contract<br>@/lib/server-lazy-diagnostics<br>next/server | None detected |
| src/app/api/autonomous-daily-operations/demo/route.ts | /api/autonomous-daily-operations/demo | @/lib/api-contract<br>@/lib/server-lazy-diagnostics<br>next/server | None detected |
| src/app/api/autonomous-daily-operations/execute/route.ts | /api/autonomous-daily-operations/execute | @/lib/api-contract<br>@/lib/server-lazy-diagnostics<br>next/server | None detected |
| src/app/api/autonomous-daily-operations/health/route.ts | /api/autonomous-daily-operations/health | @/lib/api-contract<br>@/lib/server-lazy-diagnostics<br>next/server | None detected |
| src/app/api/autonomous-daily-operations/learning-report/route.ts | /api/autonomous-daily-operations/learning-report | @/lib/api-contract<br>@/lib/server-lazy-diagnostics<br>next/server | None detected |
| src/app/api/autonomous-daily-operations/scheduler/route.ts | /api/autonomous-daily-operations/scheduler | @/lib/api-contract<br>@/lib/server-lazy-diagnostics<br>next/server | None detected |
| src/app/api/autonomous-daily-operations/simulation/route.ts | /api/autonomous-daily-operations/simulation | @/lib/api-contract<br>@/lib/server-lazy-diagnostics<br>next/server | None detected |
| src/app/api/autonomous-daily-operations/status/route.ts | /api/autonomous-daily-operations/status | @/lib/api-contract<br>@/lib/server-lazy-diagnostics<br>next/server | None detected |
| src/app/api/bankroll/manager/route.ts | /api/bankroll/manager | @/services/bankroll-manager.service<br>next/server | None detected |
| src/app/api/bankroll/route.ts | /api/bankroll | @/services/bankroll.service<br>@/services/play-of-the-day.service<br>@/services/portfolio-builder.service<br>next/server | None detected |
| src/app/api/basketball/bsn/acquisition/route.ts | /api/basketball/bsn/acquisition | @/lib/api-contract<br>@/services/basketball/acquisition/bsn-acquisition-engine<br>next/server | None detected |
| src/app/api/basketball/bsn/data-coverage/route.ts | /api/basketball/bsn/data-coverage | @/lib/api-contract<br>@/services/basketball/acquisition/bsn-acquisition-engine<br>next/server | None detected |
| src/app/api/basketball/bsn/historical-reconstruction/route.ts | /api/basketball/bsn/historical-reconstruction | @/lib/api-contract<br>@/services/basketball/history/bsn-historical-reconstruction<br>next/server | None detected |
| src/app/api/basketball/platform/route.ts | /api/basketball/platform | @/config/sports.config<br>@/lib/api-contract<br>@/services/basketball/builders/platform.service<br>next/server | None detected |
| src/app/api/best-bets-today/route.ts | /api/best-bets-today | @/lib/api-contract<br>@/services/best-bets-today.service<br>next/server | None detected |
| src/app/api/bsn/admin/validation/route.ts | /api/bsn/admin/validation | @/services/bsn-platform.service<br>next/server | None detected |
| src/app/api/bsn/ai-coach/route.ts | /api/bsn/ai-coach | @/services/bsn-platform.service<br>next/server | None detected |
| src/app/api/bsn/analytics/readiness/route.ts | /api/bsn/analytics/readiness | @/services/bsn-platform.service<br>next/server | None detected |
| src/app/api/bsn/capabilities/route.ts | /api/bsn/capabilities | @/services/bsn-platform.service<br>next/server | None detected |
| src/app/api/bsn/compare/route.ts | /api/bsn/compare | @/services/bsn-intelligence-engine.service<br>next/server | None detected |
| src/app/api/bsn/core-certification/route.ts | /api/bsn/core-certification | @/lib/api-contract<br>@/lib/server-lazy-diagnostics<br>next/server | None detected |
| src/app/api/bsn/current-board/route.ts | /api/bsn/current-board | @/services/bsn-platform.service<br>next/server | None detected |
| src/app/api/bsn/data-quality/route.ts | /api/bsn/data-quality | @/services/bsn-platform.service<br>next/server | None detected |
| src/app/api/bsn/features/route.ts | /api/bsn/features | @/services/bsn-intelligence-engine.service<br>next/server | None detected |
| src/app/api/bsn/features/validation/route.ts | /api/bsn/features/validation | @/services/bsn-platform.service<br>next/server | None detected |
| src/app/api/bsn/game/[id]/route.ts | /api/bsn/game/[id] | @/services/bsn-shadow-prediction-engine.service<br>next/server | None detected |
| src/app/api/bsn/games/route.ts | /api/bsn/games | @/services/bsn.service<br>next/server | None detected |
| src/app/api/bsn/import/route.ts | /api/bsn/import | @/lib/api-contract<br>@/services/bsn-platform.service<br>next/server | None detected |
| src/app/api/bsn/intelligence/route.ts | /api/bsn/intelligence | @/services/bsn-intelligence-engine.service<br>next/server | None detected |
| src/app/api/bsn/intelligence/validation/route.ts | /api/bsn/intelligence/validation | @/services/bsn-intelligence-engine.service<br>next/server | None detected |
| src/app/api/bsn/model-maturity/activation-audit/route.ts | /api/bsn/model-maturity/activation-audit | @/lib/server-lazy-diagnostics<br>next/server | None detected |
| src/app/api/bsn/model-maturity/backtesting/route.ts | /api/bsn/model-maturity/backtesting | @/lib/server-lazy-diagnostics<br>next/server | None detected |
| src/app/api/bsn/model-maturity/calibration/route.ts | /api/bsn/model-maturity/calibration | @/lib/server-lazy-diagnostics<br>next/server | None detected |
| src/app/api/bsn/model-maturity/explanations/route.ts | /api/bsn/model-maturity/explanations | @/lib/server-lazy-diagnostics<br>next/server | None detected |
| src/app/api/bsn/model-maturity/performance/route.ts | /api/bsn/model-maturity/performance | @/lib/server-lazy-diagnostics<br>next/server | None detected |
| src/app/api/bsn/model-maturity/readiness/route.ts | /api/bsn/model-maturity/readiness | @/lib/server-lazy-diagnostics<br>next/server | None detected |
| src/app/api/bsn/model-maturity/route.ts | /api/bsn/model-maturity | @/lib/server-lazy-diagnostics<br>next/server | None detected |
| src/app/api/bsn/model-maturity/shadow-market/route.ts | /api/bsn/model-maturity/shadow-market | @/lib/server-lazy-diagnostics<br>next/server | None detected |
| src/app/api/bsn/momentum/route.ts | /api/bsn/momentum | @/services/bsn-intelligence-engine.service<br>next/server | None detected |
| src/app/api/bsn/operations/readiness/route.ts | /api/bsn/operations/readiness | @/services/bsn-platform.service<br>next/server | None detected |
| src/app/api/bsn/power-rankings/route.ts | /api/bsn/power-rankings | @/services/bsn-intelligence-engine.service<br>next/server | None detected |
| src/app/api/bsn/predictions/preview/route.ts | /api/bsn/predictions/preview | @/services/bsn-shadow-prediction-engine.service<br>next/server | None detected |
| src/app/api/bsn/predictions/route.ts | /api/bsn/predictions | @/services/bsn-shadow-prediction-engine.service<br>next/server | None detected |
| src/app/api/bsn/predictions/validation/route.ts | /api/bsn/predictions/validation | @/services/bsn-shadow-prediction-engine.service<br>next/server | None detected |
| src/app/api/bsn/results/route.ts | /api/bsn/results | @/services/bsn.service<br>next/server | None detected |
| src/app/api/bsn/seed/route.ts | /api/bsn/seed | @/services/bsn.service<br>next/server | None detected |
| src/app/api/bsn/source-quality/route.ts | /api/bsn/source-quality | @/lib/api-contract<br>@/services/bsn-platform.service<br>next/server | None detected |
| src/app/api/bsn/sources/route.ts | /api/bsn/sources | @/lib/api-contract<br>@/services/bsn-platform.service<br>next/server | None detected |
| src/app/api/bsn/sources/validate/route.ts | /api/bsn/sources/validate | @/lib/api-contract<br>@/services/bsn-platform.service<br>next/server | None detected |
| src/app/api/bsn/sync/route.ts | /api/bsn/sync | @/services/bsn-platform.service<br>next/server | None detected |
| src/app/api/bsn/team/[id]/route.ts | /api/bsn/team/[id] | @/services/bsn-intelligence-engine.service<br>next/server | None detected |
| src/app/api/bsn/teams/route.ts | /api/bsn/teams | @/services/bsn.service<br>next/server | None detected |
| src/app/api/closing-line/intelligence/route.ts | /api/closing-line/intelligence | @/config/sports.config<br>@/services/closing-line-intelligence.service<br>next/server | None detected |
| src/app/api/clv/update/route.ts | /api/clv/update | @/services/clv.service<br>next/server | None detected |
| src/app/api/cron/capture-predictions/route.ts | /api/cron/capture-predictions | @/services/prediction-capture.service<br>next/server | None detected |
| src/app/api/cron/daily-sync/route.ts | /api/cron/daily-sync | @/services/daily-pipeline.service<br>next/server | None detected |
| src/app/api/cron/master-sync/route.ts | /api/cron/master-sync | @/lib/server-cache<br>@/services/master-sync.service<br>@/services/self-learning-engine.service<br>next/server | None detected |
| src/app/api/cron/operating-day/route.ts | /api/cron/operating-day | @/lib/api-contract<br>@/services/adaptive-refresh-orchestrator.service<br>@/services/ai-performance-center.service<br>@/services/operating-day-automation.service<br>@/services/operating-day.service<br>next/server | None detected |
| src/app/api/current-board/route.ts | /api/current-board | @/lib/api-contract<br>@/services/best-bets-today.service<br>@/services/current-board.service<br>next/server | None detected |
| src/app/api/daily-report/fast/route.ts | /api/daily-report/fast | @/services/bankroll.service<br>@/services/daily-report-fast.service<br>next/server | None detected |
| src/app/api/daily-report/route.ts | /api/daily-report | @/services/bankroll.service<br>@/services/daily-report-fast.service<br>@/services/daily-report.service<br>next/server | None detected |
| src/app/api/dashboard/cache/clear/route.ts | /api/dashboard/cache/clear | @/lib/server-cache<br>next/server | None detected |
| src/app/api/dashboard/route.ts | /api/dashboard | @/lib/server-lazy-diagnostics<br>next/server | None detected |
| src/app/api/dashboard/today/route.ts | /api/dashboard/today | @/lib/server-lazy-diagnostics<br>next/server | None detected |
| src/app/api/data-coverage/expansion-checkpoint2/route.ts | /api/data-coverage/expansion-checkpoint2 | @/lib/api-contract<br>@/services/multi-sport-data-expansion-checkpoint2.service<br>next/server | None detected |
| src/app/api/data-coverage/expansion-checkpoint3/route.ts | /api/data-coverage/expansion-checkpoint3 | @/lib/api-contract<br>@/services/multi-sport-data-expansion-checkpoint3.service<br>next/server | None detected |
| src/app/api/data-coverage/final-certification/route.ts | /api/data-coverage/final-certification | @/lib/api-contract<br>@/services/multi-sport-data-expansion-final.service<br>next/server | None detected |
| src/app/api/data-coverage/health/route.ts | /api/data-coverage/health | @/lib/api-contract<br>@/services/data-coverage-inventory.service<br>next/server | None detected |
| src/app/api/data-coverage/inventory/route.ts | /api/data-coverage/inventory | @/lib/api-contract<br>@/services/data-coverage-inventory.service<br>next/server | None detected |
| src/app/api/data-coverage/provider-audit/route.ts | /api/data-coverage/provider-audit | @/lib/api-contract<br>@/services/multi-sport-provider-entitlement-audit.service<br>next/server | None detected |
| src/app/api/data-foundation/bsn/route.ts | /api/data-foundation/bsn | @/lib/api-contract<br>@/services/bsn-historical-foundation-v2.service<br>next/server | None detected |
| src/app/api/data-foundation/epoch-performance/route.ts | /api/data-foundation/epoch-performance | @/lib/api-contract<br>@/services/epoch-performance-learning-v2.service<br>next/server | None detected |
| src/app/api/data-foundation/epochs/route.ts | /api/data-foundation/epochs | @/lib/api-contract<br>@/services/prediction-epoch-governance-v2.service<br>next/server | None detected |
| src/app/api/data-foundation/feature-rebuild/route.ts | /api/data-foundation/feature-rebuild | @/lib/api-contract<br>@/services/feature-rebuild-plan-v2.service<br>next/server | None detected |
| src/app/api/data-foundation/future-predictions/route.ts | /api/data-foundation/future-predictions | @/lib/api-contract<br>@/services/future-only-prediction-continuity-v2.service<br>next/server | None detected |
| src/app/api/data-foundation/import-orchestrator/route.ts | /api/data-foundation/import-orchestrator | @/lib/api-contract<br>@/services/data-foundation-import-orchestrator.service<br>next/server | None detected |
| src/app/api/data-foundation/legacy-metrics/route.ts | /api/data-foundation/legacy-metrics | @/lib/api-contract<br>@/services/legacy-prediction-metric-isolation-v2.service<br>next/server | None detected |
| src/app/api/data-foundation/mlb/route.ts | /api/data-foundation/mlb | @/lib/api-contract<br>@/services/mlb-historical-foundation-v2.service<br>next/server | None detected |
| src/app/api/data-foundation/nba/route.ts | /api/data-foundation/nba | @/lib/api-contract<br>@/services/nba-historical-foundation-v2.service<br>next/server | None detected |
| src/app/api/data-foundation/nfl/route.ts | /api/data-foundation/nfl | @/lib/api-contract<br>@/services/nfl-historical-foundation-v2.service<br>next/server | None detected |
| src/app/api/data-foundation/nhl/route.ts | /api/data-foundation/nhl | @/lib/api-contract<br>@/services/nhl-historical-foundation-v2.service<br>next/server | None detected |
| src/app/api/data-foundation/quality/route.ts | /api/data-foundation/quality | @/lib/api-contract<br>@/services/data-foundation-quality-v2.service<br>next/server | None detected |
| src/app/api/data-foundation/readiness/route.ts | /api/data-foundation/readiness | @/lib/api-contract<br>@/services/data-foundation-quality-v2.service<br>next/server | None detected |
| src/app/api/data-foundation/reconciliation/route.ts | /api/data-foundation/reconciliation | @/lib/api-contract<br>@/services/data-foundation-quality-v2.service<br>next/server | None detected |
| src/app/api/data-foundation/results-crosswalk/route.ts | /api/data-foundation/results-crosswalk | @/lib/api-contract<br>@/services/multi-sport-results-crosswalk-foundation.service<br>next/server | None detected |
| src/app/api/data-foundation/seasons/route.ts | /api/data-foundation/seasons | @/lib/api-contract<br>@/services/data-foundation-season-governance.service<br>next/server | None detected |
| src/app/api/data-foundation/soccer/route.ts | /api/data-foundation/soccer | @/lib/api-contract<br>@/services/soccer-historical-foundation-v2.service<br>next/server | None detected |
| src/app/api/data-foundation/tennis-ufc/route.ts | /api/data-foundation/tennis-ufc | @/lib/api-contract<br>@/services/tennis-ufc-data-readiness-v2.service<br>next/server | None detected |
| src/app/api/data-quality/global/route.ts | /api/data-quality/global | @/lib/api-contract<br>@/services/global-data-quality.service | None detected |
| src/app/api/events/[eventId]/identity/route.ts | /api/events/[eventId]/identity | @/lib/api-contract<br>@/services/universal-event-identity.service<br>next/server | None detected |
| src/app/api/events/identity/audit/route.ts | /api/events/identity/audit | @/lib/api-contract<br>@/services/universal-event-identity.service<br>next/server | None detected |
| src/app/api/events/identity/conflicts/route.ts | /api/events/identity/conflicts | @/lib/api-contract<br>@/services/universal-event-identity.service<br>next/server | None detected |
| src/app/api/events/identity/unresolved/route.ts | /api/events/identity/unresolved | @/lib/api-contract<br>@/services/universal-event-identity.service<br>next/server | None detected |
| src/app/api/events/recovery/missing-canonical/route.ts | /api/events/recovery/missing-canonical | @/lib/api-contract<br>@/services/missing-canonical-events-recovery.service<br>next/server | None detected |
| src/app/api/factors/debug/route.ts | /api/factors/debug | @/services/advanced-factors.service<br>next/server | None detected |
| src/app/api/features/registry/lookup/route.ts | /api/features/registry/lookup | @/lib/api-contract<br>@/services/multi-sport-feature-registry.service<br>next/server | None detected |
| src/app/api/features/registry/route.ts | /api/features/registry | @/lib/api-contract<br>@/services/multi-sport-feature-registry.service<br>next/server | None detected |
| src/app/api/features/registry/validation/route.ts | /api/features/registry/validation | @/lib/api-contract<br>@/services/multi-sport-feature-registry.service<br>next/server | None detected |
| src/app/api/features/store/definitions/route.ts | /api/features/store/definitions | @/config/sports.config<br>@/lib/api-contract<br>@/services/feature-store-core.service<br>@/types/multi-sport<br>next/server | None detected |
| src/app/api/features/store/route.ts | /api/features/store | @/lib/api-contract<br>@/services/feature-store-core.service<br>@/services/historical-feature-generation.service<br>next/server | None detected |
| src/app/api/features/store/validation/route.ts | /api/features/store/validation | @/lib/api-contract<br>@/lib/server-schema-capabilities<br>@/services/feature-store-core.service<br>@/services/historical-feature-generation.service<br>next/server | None detected |
| src/app/api/games/[eventId]/intelligence/route.ts | /api/games/[eventId]/intelligence | @/lib/api-contract<br>@/services/game-intelligence.service<br>next/server | None detected |
| src/app/api/head-to-head/recalculate/route.ts | /api/head-to-head/recalculate | @/services/team-matchups-calculator.service<br>next/server | None detected |
| src/app/api/hedges/route.ts | /api/hedges | @/services/bankroll.service<br>@/services/hedge-builder.service<br>next/server | None detected |
| src/app/api/historical-import/cancel/route.ts | /api/historical-import/cancel | @/lib/api-contract<br>@/lib/server-lazy-diagnostics<br>next/server | None detected |
| src/app/api/historical-import/execute/route.ts | /api/historical-import/execute | @/lib/api-contract<br>@/services/sportsdataio-historical-import-readiness.service<br>@/services/sportsdataio-mlb-historical-import-executor.service<br>@/services/sportsdataio-mlb-prospective-preview.service<br>next/server | None detected |
| src/app/api/historical-import/health/route.ts | /api/historical-import/health | @/lib/api-contract<br>@/services/historical-import-engine.service<br>next/server | None detected |
| src/app/api/historical-import/jobs/[jobId]/route.ts | /api/historical-import/jobs/[jobId] | @/lib/api-contract<br>@/lib/server-lazy-diagnostics<br>next/server | None detected |
| src/app/api/historical-import/jobs/route.ts | /api/historical-import/jobs | @/lib/api-contract<br>@/services/historical-import-engine.service<br>next/server | None detected |
| src/app/api/historical-import/pilot-plan/route.ts | /api/historical-import/pilot-plan | @/lib/api-contract<br>@/lib/server-lazy-diagnostics<br>next/server | None detected |
| src/app/api/historical-import/plan/route.ts | /api/historical-import/plan | @/lib/api-contract<br>@/lib/server-schema-capabilities<br>@/services/historical-feature-generation.service<br>@/services/historical-import-engine.service<br>next/server | None detected |
| src/app/api/historical-import/resume/route.ts | /api/historical-import/resume | @/lib/api-contract<br>@/lib/server-lazy-diagnostics<br>next/server | None detected |
| src/app/api/historical-import/validate/[jobId]/route.ts | /api/historical-import/validate/[jobId] | @/lib/api-contract<br>@/lib/server-lazy-diagnostics<br>next/server | None detected |
| src/app/api/injuries/seed/route.ts | /api/injuries/seed | @/lib/supabase-admin<br>next/server | injuries |
| src/app/api/live-bets/route.ts | /api/live-bets | @/services/bankroll.service<br>@/services/live-betting.service<br>next/server | None detected |
| src/app/api/live-betting/route.ts | /api/live-betting | @/services/live-betting-engine.service<br>next/server | None detected |
| src/app/api/market-intelligence/movement/route.ts | /api/market-intelligence/movement | @/lib/api-contract<br>@/services/market-movement-intelligence.service<br>next/server | None detected |
| src/app/api/market-intelligence/route.ts | /api/market-intelligence | @/lib/api-contract<br>@/services/market-intelligence-engine.service<br>next/server | None detected |
| src/app/api/market-opportunities/arbitrage/route.ts | /api/market-opportunities/arbitrage | @/lib/api-contract<br>@/services/market-opportunity-suite.service<br>next/server | None detected |
| src/app/api/market-opportunities/best-value/route.ts | /api/market-opportunities/best-value | @/lib/api-contract<br>@/services/best-value-scanner.service<br>next/server | None detected |
| src/app/api/market-opportunities/most-likely/route.ts | /api/market-opportunities/most-likely | @/lib/api-contract<br>@/services/market-opportunity-suite.service<br>next/server | None detected |
| src/app/api/markets/diagnostics/route.ts | /api/markets/diagnostics | @/lib/api-contract<br>@/services/universal-market-intelligence.service<br>next/server | None detected |
| src/app/api/markets/inventory/route.ts | /api/markets/inventory | @/lib/api-contract<br>@/services/universal-market-intelligence.service<br>next/server | None detected |
| src/app/api/markets/provider-coverage/route.ts | /api/markets/provider-coverage | @/lib/api-contract<br>@/services/universal-market-intelligence.service<br>next/server | None detected |
| src/app/api/markets/readiness/route.ts | /api/markets/readiness | @/lib/api-contract<br>@/services/universal-market-intelligence.service<br>next/server | None detected |
| src/app/api/mlb/ai-coach/route.ts | /api/mlb/ai-coach | @/lib/api-contract<br>@/services/mlb-ai-coach.service<br>next/server | None detected |
| src/app/api/mlb/current-season/data-quality/route.ts | /api/mlb/current-season/data-quality | @/lib/api-contract<br>@/services/mlb-current-season-data-quality-audit.service<br>next/server | None detected |
| src/app/api/mlb/data-quality/route.ts | /api/mlb/data-quality | @/lib/api-contract<br>@/services/mlb-data-quality.service<br>next/server | None detected |
| src/app/api/mlb/features/model-readiness/route.ts | /api/mlb/features/model-readiness | @/lib/api-contract<br>@/services/mlb-feature-model-readiness.service<br>next/server | None detected |
| src/app/api/mlb/features/preview/route.ts | /api/mlb/features/preview | @/lib/api-contract<br>@/services/mlb-feature-store-integration.service<br>next/server | None detected |
| src/app/api/mlb/features/store/route.ts | /api/mlb/features/store | @/lib/api-contract<br>@/services/mlb-feature-store-integration.service<br>next/server | None detected |
| src/app/api/mlb/features/validation/route.ts | /api/mlb/features/validation | @/lib/api-contract<br>@/services/mlb-feature-store-integration.service<br>next/server | None detected |
| src/app/api/mlb/game-intelligence/route.ts | /api/mlb/game-intelligence | @/lib/api-contract<br>@/services/mlb-current-lineup-context.service<br>@/services/mlb-player-projection-engine.service<br>next/server | None detected |
| src/app/api/mlb/games-payload-audit/route.ts | /api/mlb/games-payload-audit | @/lib/api-contract<br>@/services/mlb-games-payload-audit.service<br>next/server | None detected |
| src/app/api/mlb/historical-backfill/player-game-stats/route.ts | /api/mlb/historical-backfill/player-game-stats | @/lib/api-contract<br>@/services/mlb-current-season-backfill-orchestrator.service<br>next/server | None detected |
| src/app/api/mlb/historical-intelligence/retrosheet/features/route.ts | /api/mlb/historical-intelligence/retrosheet/features | @/lib/api-contract<br>@/services/retrosheet-historical-feature-store.service<br>next/server | None detected |
| src/app/api/mlb/historical-intelligence/retrosheet/game-engine/route.ts | /api/mlb/historical-intelligence/retrosheet/game-engine | @/lib/api-contract<br>@/services/retrosheet-game-reconstruction.service<br>next/server | None detected |
| src/app/api/mlb/historical-intelligence/retrosheet/import/route.ts | /api/mlb/historical-intelligence/retrosheet/import | @/lib/api-contract<br>@/services/retrosheet-controlled-import.service<br>next/server | None detected |
| src/app/api/mlb/historical-intelligence/retrosheet/route.ts | /api/mlb/historical-intelligence/retrosheet | @/lib/api-contract<br>@/services/retrosheet-historical-data-lake.service<br>next/server | None detected |
| src/app/api/mlb/intelligence/pitcher-bullpen-foundation/route.ts | /api/mlb/intelligence/pitcher-bullpen-foundation | @/lib/api-contract<br>@/services/mlb-model-platform.service<br>next/server | None detected |
| src/app/api/mlb/learning-brain/route.ts | /api/mlb/learning-brain | @/lib/api-contract<br>@/services/mlb-learning-brain.service<br>next/server | None detected |
| src/app/api/mlb/lineup-context/route.ts | /api/mlb/lineup-context | @/lib/api-contract<br>@/services/mlb-current-lineup-context.service<br>next/server | None detected |
| src/app/api/mlb/market-pipeline/diagnostics/route.ts | /api/mlb/market-pipeline/diagnostics | @/lib/api-contract<br>@/services/mlb-market-pipeline-diagnostics.service<br>next/server | None detected |
| src/app/api/mlb/markets/capabilities/route.ts | /api/mlb/markets/capabilities | @/lib/api-contract<br>@/services/mlb-market-capability-registry.service<br>next/server | None detected |
| src/app/api/mlb/markets/expansion-roadmap/route.ts | /api/mlb/markets/expansion-roadmap | @/lib/api-contract<br>@/lib/server-lazy-diagnostics<br>next/server | None detected |
| src/app/api/mlb/markets/first-five/route.ts | /api/mlb/markets/first-five | @/services/mlb-first-five-readiness.service<br>next/server | None detected |
| src/app/api/mlb/markets/team-totals/route.ts | /api/mlb/markets/team-totals | @/services/mlb-team-totals-readiness.service<br>next/server | None detected |
| src/app/api/mlb/missing-intelligence/health/route.ts | /api/mlb/missing-intelligence/health | @/lib/api-contract<br>@/services/mlb-missing-intelligence.service | None detected |
| src/app/api/mlb/model-audit/route.ts | /api/mlb/model-audit | @/lib/api-contract<br>@/services/mlb-model-audit.service<br>next/server | None detected |
| src/app/api/mlb/operations-center/route.ts | /api/mlb/operations-center | @/lib/api-contract<br>@/lib/server-lazy-diagnostics<br>next/server | None detected |
| src/app/api/mlb/pitchers/[pitcherId]/projection/route.ts | /api/mlb/pitchers/[pitcherId]/projection | @/lib/api-contract<br>@/services/mlb-pitcher-projection-engine.service<br>next/server | None detected |
| src/app/api/mlb/pitchers/projections/generate/route.ts | /api/mlb/pitchers/projections/generate | @/lib/api-contract<br>@/services/mlb-pitcher-projection-engine.service<br>next/server | None detected |
| src/app/api/mlb/pitchers/projections/health/route.ts | /api/mlb/pitchers/projections/health | @/lib/api-contract<br>@/services/mlb-pitcher-projection-engine.service<br>next/server | None detected |
| src/app/api/mlb/pitchers/projections/preview/route.ts | /api/mlb/pitchers/projections/preview | @/lib/api-contract<br>@/services/mlb-pitcher-projection-engine.service<br>next/server | None detected |
| src/app/api/mlb/pitchers/projections/route.ts | /api/mlb/pitchers/projections | @/lib/api-contract<br>@/services/mlb-pitcher-projection-engine.service<br>next/server | None detected |
| src/app/api/mlb/pitchers/projections/validation/route.ts | /api/mlb/pitchers/projections/validation | @/lib/api-contract<br>@/services/mlb-pitcher-projection-engine.service<br>next/server | None detected |
| src/app/api/mlb/player-data-excellence/route.ts | /api/mlb/player-data-excellence | @/lib/api-contract<br>@/services/mlb-player-data-excellence.service<br>next/server | None detected |
| src/app/api/mlb/player-projections/[projectionId]/route.ts | /api/mlb/player-projections/[projectionId] | @/lib/api-contract<br>@/lib/supabase-admin<br>@/services/explainable-intelligence.service<br>@/services/mlb-player-projection-engine.service<br>@/services/projection-evolution.service<br>next/server | universal_projection_history |
| src/app/api/mlb/player-projections/batters/route.ts | /api/mlb/player-projections/batters | @/lib/api-contract<br>@/services/mlb-player-projection-engine.service<br>next/server | None detected |
| src/app/api/mlb/player-projections/lifecycle/route.ts | /api/mlb/player-projections/lifecycle | @/lib/api-contract<br>@/services/mlb-player-projection-engine.service<br>next/server | None detected |
| src/app/api/mlb/player-projections/performance/route.ts | /api/mlb/player-projections/performance | @/lib/api-contract<br>@/services/mlb-player-projection-engine.service<br>next/server | None detected |
| src/app/api/mlb/player-projections/pitchers/route.ts | /api/mlb/player-projections/pitchers | @/lib/api-contract<br>@/services/mlb-player-projection-engine.service<br>next/server | None detected |
| src/app/api/mlb/player-projections/readiness/route.ts | /api/mlb/player-projections/readiness | @/lib/api-contract<br>@/services/mlb-player-projection-engine.service<br>next/server | None detected |
| src/app/api/mlb/player-projections/route.ts | /api/mlb/player-projections | @/lib/api-contract<br>@/services/mlb-player-projection-engine.service<br>next/server | None detected |
| src/app/api/mlb/player-props/[pitcherId]/route.ts | /api/mlb/player-props/[pitcherId] | @/lib/api-contract<br>@/services/mlb-player-prop-comparison.service<br>next/server | None detected |
| src/app/api/mlb/player-props/foundation/route.ts | /api/mlb/player-props/foundation | @/lib/api-contract<br>@/services/mlb-player-props-foundation.service<br>next/server | None detected |
| src/app/api/mlb/player-props/generate/route.ts | /api/mlb/player-props/generate | @/lib/api-contract<br>@/services/mlb-player-prop-comparison.service<br>next/server | None detected |
| src/app/api/mlb/player-props/health/route.ts | /api/mlb/player-props/health | @/lib/api-contract<br>@/services/mlb-player-prop-comparison.service<br>@/services/mlb-player-prop-sync.service<br>next/server | None detected |
| src/app/api/mlb/player-props/mapping-diagnostics/route.ts | /api/mlb/player-props/mapping-diagnostics | @/lib/api-contract<br>@/services/mlb-player-props-readiness-audit.service<br>next/server | None detected |
| src/app/api/mlb/player-props/preview/route.ts | /api/mlb/player-props/preview | @/lib/api-contract<br>@/services/mlb-player-prop-comparison.service<br>next/server | None detected |
| src/app/api/mlb/player-props/provider-audit/route.ts | /api/mlb/player-props/provider-audit | @/lib/api-contract<br>@/services/mlb-player-prop-sync.service<br>@/services/mlb-player-props-readiness-audit.service<br>next/server | None detected |
| src/app/api/mlb/player-props/readiness/route.ts | /api/mlb/player-props/readiness | @/lib/api-contract<br>@/services/mlb-player-props-readiness-audit.service<br>next/server | None detected |
| src/app/api/mlb/player-props/route.ts | /api/mlb/player-props | @/lib/api-contract<br>@/services/mlb-player-prop-comparison.service<br>next/server | None detected |
| src/app/api/mlb/player-props/sync/route.ts | /api/mlb/player-props/sync | @/lib/api-contract<br>@/services/mlb-player-prop-sync.service<br>@/types/mlb-player-prop-ingestion<br>next/server | None detected |
| src/app/api/mlb/player-props/validation/route.ts | /api/mlb/player-props/validation | @/lib/api-contract<br>@/services/mlb-player-prop-comparison.service<br>@/services/mlb-player-prop-sync.service<br>next/server | None detected |
| src/app/api/mlb/players/metadata-cache/route.ts | /api/mlb/players/metadata-cache | @/lib/api-contract<br>@/services/mlb-model-platform.service | None detected |
| src/app/api/mlb/players/unresolved-identities/route.ts | /api/mlb/players/unresolved-identities | @/lib/api-contract<br>@/services/mlb-unresolved-player-identity.service<br>next/server | None detected |
| src/app/api/mlb/predictions/comparison/route.ts | /api/mlb/predictions/comparison | @/lib/api-contract<br>@/services/mlb-model-platform.service<br>next/server | None detected |
| src/app/api/mlb/predictions/health/route.ts | /api/mlb/predictions/health | @/lib/api-contract<br>@/services/mlb-prediction-engine.service<br>next/server | None detected |
| src/app/api/mlb/predictions/promotion-readiness/route.ts | /api/mlb/predictions/promotion-readiness | @/lib/api-contract<br>@/services/mlb-model-platform.service<br>next/server | None detected |
| src/app/api/mlb/predictions/rollback-plan/route.ts | /api/mlb/predictions/rollback-plan | @/lib/api-contract<br>@/services/mlb-model-platform.service<br>next/server | None detected |
| src/app/api/mlb/predictions/route.ts | /api/mlb/predictions | @/lib/api-contract<br>@/services/mlb-prediction-engine.service<br>next/server | None detected |
| src/app/api/mlb/predictions/shadow-evaluation/route.ts | /api/mlb/predictions/shadow-evaluation | @/lib/api-contract<br>@/services/mlb-model-platform.service<br>next/server | None detected |
| src/app/api/mlb/predictions/v6-regeneration/route.ts | /api/mlb/predictions/v6-regeneration | @/lib/api-contract<br>@/services/sportsdataio-mlb-prospective-preview.service<br>next/server | None detected |
| src/app/api/mlb/predictions/v7-regeneration/route.ts | /api/mlb/predictions/v7-regeneration | @/lib/api-contract<br>@/services/sportsdataio-mlb-prospective-preview.service<br>next/server | None detected |
| src/app/api/mlb/predictions/validation/route.ts | /api/mlb/predictions/validation | @/lib/api-contract<br>@/services/mlb-prediction-engine.service<br>next/server | None detected |
| src/app/api/mlb/pregame-starter-evidence/route.ts | /api/mlb/pregame-starter-evidence | @/lib/api-contract<br>@/services/mlb-pregame-starter-evidence.service<br>next/server | None detected |
| src/app/api/mlb/probable-starters/route.ts | /api/mlb/probable-starters | @/lib/api-contract<br>@/services/mlb-starter-intelligence.service<br>next/server | None detected |
| src/app/api/mlb/projected-scores/route.ts | /api/mlb/projected-scores | @/lib/api-contract<br>@/services/mlb-projected-score.service<br>next/server | None detected |
| src/app/api/mlb/projections/health/route.ts | /api/mlb/projections/health | @/lib/api-contract<br>@/services/universal-projection-engine.service<br>next/server | None detected |
| src/app/api/mlb/projections/route.ts | /api/mlb/projections | @/app/api/projections/route | None detected |
| src/app/api/mlb/provider-capabilities/audit/route.ts | /api/mlb/provider-capabilities/audit | @/lib/api-contract<br>@/services/mlb-provider-capability-audit.service<br>next/server | None detected |
| src/app/api/mlb/provider-verification/games-by-date/route.ts | /api/mlb/provider-verification/games-by-date | @/lib/api-contract<br>@/services/mlb-games-by-date-verification.service<br>next/server | None detected |
| src/app/api/mlb/stadiums/metadata-cache/route.ts | /api/mlb/stadiums/metadata-cache | @/lib/api-contract<br>@/services/mlb-model-platform.service<br>next/server | None detected |
| src/app/api/mlb/starter-diagnostics/route.ts | /api/mlb/starter-diagnostics | @/lib/api-contract<br>@/services/mlb-starter-intelligence.service<br>next/server | None detected |
| src/app/api/mlb/starter-history/route.ts | /api/mlb/starter-history | @/lib/api-contract<br>@/services/mlb-starter-intelligence.service<br>next/server | None detected |
| src/app/api/mlb/starter-intelligence/route.ts | /api/mlb/starter-intelligence | @/lib/api-contract<br>@/services/mlb-starter-intelligence.service<br>next/server | None detected |
| src/app/api/mlb/starters/health/route.ts | /api/mlb/starters/health | @/lib/api-contract<br>@/services/mlb-starter-sync.service<br>next/server | None detected |
| src/app/api/mlb/starters/route.ts | /api/mlb/starters | @/lib/api-contract<br>@/services/mlb-starter-sync.service<br>next/server | None detected |
| src/app/api/mlb/starters/sync/route.ts | /api/mlb/starters/sync | @/lib/api-contract<br>@/services/mlb-starter-sync.service<br>next/server | None detected |
| src/app/api/mlb/starters/validation/route.ts | /api/mlb/starters/validation | @/lib/api-contract<br>@/services/mlb-starter-sync.service<br>next/server | None detected |
| src/app/api/mlb/temporal-health/route.ts | /api/mlb/temporal-health | @/lib/api-contract<br>@/lib/server-lazy-diagnostics<br>next/server | None detected |
| src/app/api/model/autotune/route.ts | /api/model/autotune | @/services/model-learning.service<br>next/server | None detected |
| src/app/api/model/calibration/route.ts | /api/model/calibration | @/services/model-calibration.service<br>next/server | None detected |
| src/app/api/model/learning/route.ts | /api/model/learning | @/services/model-learning.service<br>next/server | None detected |
| src/app/api/model/metrics/route.ts | /api/model/metrics | @/lib/api-contract<br>@/services/model-metrics-framework.service | None detected |
| src/app/api/model/rollback/history/route.ts | /api/model/rollback/history | @/lib/supabase-admin<br>next/server | model_versions |
| src/app/api/model/rollback/route.ts | /api/model/rollback | @/services/model-learning.service<br>next/server | None detected |
| src/app/api/model/self-learning/route.ts | /api/model/self-learning | @/services/self-learning-engine.service<br>next/server | None detected |
| src/app/api/model/shadow-calibration/route.ts | /api/model/shadow-calibration | @/services/historical-shadow-calibration.service<br>next/server | None detected |
| src/app/api/model/status/route.ts | /api/model/status | @/services/model-calibration.service<br>@/services/model-learning.service<br>@/services/model-versioning.service<br>next/server | None detected |
| src/app/api/model/versions/route.ts | /api/model/versions | @/services/model-versioning.service<br>next/server | None detected |
| src/app/api/nba/adapter/status/route.ts | /api/nba/adapter/status | @/services/nba-adapter.service<br>next/server | None detected |
| src/app/api/nba/data-health/route.ts | /api/nba/data-health | @/services/nba-data-sync.service<br>next/server | None detected |
| src/app/api/nba/data-quality/issues/route.ts | /api/nba/data-quality/issues | @/services/nba-data-quality.service<br>next/server | None detected |
| src/app/api/nba/data-quality/route.ts | /api/nba/data-quality | @/services/nba-data-quality.service<br>next/server | None detected |
| src/app/api/nba/features/preview/route.ts | /api/nba/features/preview | @/lib/api-contract<br>@/services/nba-feature-store-integration.service<br>next/server | None detected |
| src/app/api/nba/features/store/route.ts | /api/nba/features/store | @/lib/api-contract<br>@/services/nba-feature-store-integration.service<br>next/server | None detected |
| src/app/api/nba/features/validation/route.ts | /api/nba/features/validation | @/lib/api-contract<br>@/services/nba-feature-store-integration.service<br>next/server | None detected |
| src/app/api/nba/markets/multi-book/route.ts | /api/nba/markets/multi-book | @/services/nba-multi-book-comparison.service<br>next/server | None detected |
| src/app/api/nba/markets/steam/route.ts | /api/nba/markets/steam | @/services/nba-steam-move-detection.service<br>next/server | None detected |
| src/app/api/nba/predictions/backtest/route.ts | /api/nba/predictions/backtest | @/services/nba-backtesting-calibration.service<br>next/server | None detected |
| src/app/api/nba/predictions/backtest/run/route.ts | /api/nba/predictions/backtest/run | @/services/nba-backtesting-calibration.service<br>next/server | None detected |
| src/app/api/nba/predictions/calibration/route.ts | /api/nba/predictions/calibration | @/services/nba-backtesting-calibration.service<br>next/server | None detected |
| src/app/api/nba/predictions/generate/route.ts | /api/nba/predictions/generate | @/lib/server-lazy-diagnostics<br>next/server | None detected |
| src/app/api/nba/predictions/health/route.ts | /api/nba/predictions/health | @/lib/server-lazy-diagnostics<br>next/server | None detected |
| src/app/api/nba/predictions/model-health/route.ts | /api/nba/predictions/model-health | @/lib/server-lazy-diagnostics<br>next/server | None detected |
| src/app/api/nba/predictions/performance/route.ts | /api/nba/predictions/performance | @/lib/server-lazy-diagnostics<br>next/server | None detected |
| src/app/api/nba/predictions/route.ts | /api/nba/predictions | @/lib/server-lazy-diagnostics<br>next/server | None detected |
| src/app/api/nba/predictions/settle/event/[eventId]/route.ts | /api/nba/predictions/settle/event/[eventId] | @/lib/server-lazy-diagnostics<br>next/server | None detected |
| src/app/api/nba/predictions/settle/route.ts | /api/nba/predictions/settle | @/lib/server-lazy-diagnostics<br>next/server | None detected |
| src/app/api/nba/predictions/settlement-backlog/route.ts | /api/nba/predictions/settlement-backlog | @/lib/server-lazy-diagnostics<br>next/server | None detected |
| src/app/api/nba/predictions/validate/route.ts | /api/nba/predictions/validate | @/lib/server-lazy-diagnostics<br>next/server | None detected |
| src/app/api/nba/reconciliation/plan/route.ts | /api/nba/reconciliation/plan | @/services/nba-data-quality.service<br>next/server | None detected |
| src/app/api/nba/reconciliation/status/route.ts | /api/nba/reconciliation/status | @/services/nba-data-quality.service<br>next/server | None detected |
| src/app/api/nba/sync/games/route.ts | /api/nba/sync/games | @/services/nba-data-sync.service<br>next/server | None detected |
| src/app/api/nba/sync/injuries/route.ts | /api/nba/sync/injuries | @/services/nba-data-sync.service<br>next/server | None detected |
| src/app/api/nba/sync/lineups/route.ts | /api/nba/sync/lineups | @/services/nba-data-sync.service<br>next/server | None detected |
| src/app/api/nba/sync/odds/route.ts | /api/nba/sync/odds | @/services/nba-data-sync.service<br>next/server | None detected |
| src/app/api/nba/sync/players/route.ts | /api/nba/sync/players | @/services/nba-data-sync.service<br>next/server | None detected |
| src/app/api/nba/sync/route.ts | /api/nba/sync | @/services/nba-data-sync.service<br>next/server | None detected |
| src/app/api/nba/sync/standings/route.ts | /api/nba/sync/standings | @/services/nba-data-sync.service<br>next/server | None detected |
| src/app/api/nba/sync/stats/route.ts | /api/nba/sync/stats | @/services/nba-data-sync.service<br>next/server | None detected |
| src/app/api/nba/sync/status/route.ts | /api/nba/sync/status | @/services/nba-data-sync.service<br>next/server | None detected |
| src/app/api/nba/sync/teams/route.ts | /api/nba/sync/teams | @/services/nba-data-sync.service<br>next/server | None detected |
| src/app/api/nfl/features/preview/route.ts | /api/nfl/features/preview | @/lib/api-contract<br>@/services/nfl-feature-store-integration.service<br>next/server | None detected |
| src/app/api/nfl/features/store/route.ts | /api/nfl/features/store | @/lib/api-contract<br>@/services/nfl-feature-store-integration.service<br>next/server | None detected |
| src/app/api/nfl/features/validation/route.ts | /api/nfl/features/validation | @/lib/api-contract<br>@/services/nfl-feature-store-integration.service<br>next/server | None detected |
| src/app/api/nfl/predictions/health/route.ts | /api/nfl/predictions/health | @/lib/api-contract<br>@/services/nfl-prediction-engine.service<br>next/server | None detected |
| src/app/api/nfl/predictions/route.ts | /api/nfl/predictions | @/lib/api-contract<br>@/services/stored-preview-prediction-lifecycle.service<br>next/server | None detected |
| src/app/api/nfl/predictions/validation/route.ts | /api/nfl/predictions/validation | @/lib/api-contract<br>@/services/nfl-prediction-engine.service<br>next/server | None detected |
| src/app/api/nhl/features/preview/route.ts | /api/nhl/features/preview | @/lib/api-contract<br>@/services/nhl-feature-store-integration.service<br>next/server | None detected |
| src/app/api/nhl/features/store/route.ts | /api/nhl/features/store | @/lib/api-contract<br>@/services/nhl-feature-store-integration.service<br>next/server | None detected |
| src/app/api/nhl/features/validation/route.ts | /api/nhl/features/validation | @/lib/api-contract<br>@/services/nhl-feature-store-integration.service<br>next/server | None detected |
| src/app/api/nhl/predictions/health/route.ts | /api/nhl/predictions/health | @/lib/api-contract<br>@/services/nhl-prediction-engine.service<br>next/server | None detected |
| src/app/api/nhl/predictions/route.ts | /api/nhl/predictions | @/lib/api-contract<br>@/services/stored-preview-prediction-lifecycle.service<br>next/server | None detected |
| src/app/api/nhl/predictions/validation/route.ts | /api/nhl/predictions/validation | @/lib/api-contract<br>@/services/nhl-prediction-engine.service<br>next/server | None detected |
| src/app/api/observability/runtime/route.ts | /api/observability/runtime | @/lib/api-contract<br>@/lib/server-lazy-diagnostics | None detected |
| src/app/api/odds/route.ts | /api/odds | @/services/prediction.service<br>next/server | None detected |
| src/app/api/operating-day/[operatingDayId]/settle/route.ts | /api/operating-day/[operatingDayId]/settle | @/lib/api-contract<br>@/lib/server-lazy-diagnostics<br>next/server | None detected |
| src/app/api/operating-day/automation/status/route.ts | /api/operating-day/automation/status | @/lib/api-contract<br>@/services/operating-day-automation.service<br>next/server | None detected |
| src/app/api/operating-day/execute/route.ts | /api/operating-day/execute | @/lib/api-contract<br>@/lib/server-lazy-diagnostics<br>next/server | None detected |
| src/app/api/operating-day/status/route.ts | /api/operating-day/status | @/lib/api-contract<br>@/lib/server-lazy-diagnostics<br>next/server | None detected |
| src/app/api/operating-day/validation/route.ts | /api/operating-day/validation | @/lib/api-contract<br>@/lib/server-lazy-diagnostics<br>next/server | None detected |
| src/app/api/operations/adaptive-refresh/route.ts | /api/operations/adaptive-refresh | @/lib/api-contract<br>@/lib/server-lazy-diagnostics<br>next/server | None detected |
| src/app/api/operations/adaptive-refresh/status/route.ts | /api/operations/adaptive-refresh/status | @/lib/api-contract<br>@/lib/server-lazy-diagnostics<br>next/server | None detected |
| src/app/api/operations/change-events/route.ts | /api/operations/change-events | @/lib/api-contract<br>@/lib/server-lazy-diagnostics<br>next/server | None detected |
| src/app/api/operations/data-freshness/route.ts | /api/operations/data-freshness | @/lib/api-contract<br>@/lib/server-lazy-diagnostics<br>next/server | None detected |
| src/app/api/operations/health/route.ts | /api/operations/health | @/lib/api-contract<br>@/lib/server-lazy-diagnostics<br>next/server | None detected |
| src/app/api/operations/mlb-autonomous-operations/route.ts | /api/operations/mlb-autonomous-operations | @/lib/api-contract<br>@/services/mlb-autonomous-operations-v1.service<br>next/server | None detected |
| src/app/api/operations/odds-change-refresh-readiness/route.ts | /api/operations/odds-change-refresh-readiness | @/lib/api-contract<br>@/services/prediction-epoch-shadow-readiness.service<br>next/server | None detected |
| src/app/api/operations/pregame-odds-refresh-sla/route.ts | /api/operations/pregame-odds-refresh-sla | @/lib/api-contract<br>@/services/prediction-epoch-shadow-readiness.service<br>next/server | None detected |
| src/app/api/operations/provider-budget-forecast/route.ts | /api/operations/provider-budget-forecast | @/lib/api-contract<br>@/lib/server-lazy-diagnostics<br>next/server | None detected |
| src/app/api/operations/refresh-plan/route.ts | /api/operations/refresh-plan | @/lib/api-contract<br>@/lib/server-lazy-diagnostics<br>next/server | None detected |
| src/app/api/operations/settlement-guarantee/route.ts | /api/operations/settlement-guarantee | @/lib/api-contract<br>@/services/settlement-guarantee.service<br>next/server | None detected |
| src/app/api/operations/status/route.ts | /api/operations/status | @/lib/api-contract<br>@/lib/server-lazy-diagnostics<br>next/server | None detected |
| src/app/api/operations/validation/route.ts | /api/operations/validation | @/lib/api-contract<br>@/services/adaptive-refresh-orchestrator.service<br>@/services/ai-bet-finder.service<br>@/services/bsn-core-certification.service<br>@/services/game-intelligence.service<br>@/services/legacy-prediction-provenance.service<br>@/services/market-alignment.service<br>@/services/market-intelligence-category.service<br>@/services/missing-canonical-events-recovery.service<br>@/services/mlb-ai-picks-feed.service | None detected |
| src/app/api/parlays/route.ts | /api/parlays | @/services/bet-slip-optimizer.service<br>@/services/model-only-intelligence.service<br>@/services/parlay-generator.service<br>next/server | None detected |
| src/app/api/performance/[sport]/route.ts | /api/performance/[sport] | @/lib/server-lazy-diagnostics<br>@/services/performance-product-contract.service<br>next/server | None detected |
| src/app/api/performance/daily-update/route.ts | /api/performance/daily-update | @/lib/server-lazy-diagnostics<br>next/server | None detected |
| src/app/api/performance/evolution/route.ts | /api/performance/evolution | @/services/performance-product-contract.service<br>next/server | None detected |
| src/app/api/performance/goals/route.ts | /api/performance/goals | @/services/performance-product-contract.service<br>next/server | None detected |
| src/app/api/performance/history/route.ts | /api/performance/history | @/services/performance-scope-v2.service<br>next/server | None detected |
| src/app/api/performance/readiness/route.ts | /api/performance/readiness | @/lib/server-lazy-diagnostics<br>next/server | None detected |
| src/app/api/performance/report-card/route.ts | /api/performance/report-card | @/services/performance-product-contract.service<br>next/server | None detected |
| src/app/api/performance/route.ts | /api/performance | @/lib/server-lazy-diagnostics<br>@/services/performance-product-contract.service<br>next/server | cutoff |
| src/app/api/performance/sports/route.ts | /api/performance/sports | @/services/performance-product-contract.service<br>next/server | None detected |
| src/app/api/performance/trust/route.ts | /api/performance/trust | @/services/performance-product-contract.service<br>next/server | None detected |
| src/app/api/performance/validation/route.ts | /api/performance/validation | @/lib/server-lazy-diagnostics<br>next/server | None detected |
| src/app/api/picks/explain/route.ts | /api/picks/explain | @/services/ai-pick-explainer.service<br>@/services/explainability.service<br>next/server | None detected |
| src/app/api/pitchers/seed/route.ts | /api/pitchers/seed | @/lib/supabase-admin<br>next/server | pitcher_stats |
| src/app/api/play-of-the-day/route.ts | /api/play-of-the-day | @/services/play-of-the-day.service<br>next/server | None detected |
| src/app/api/players/[playerId]/intelligence/route.ts | /api/players/[playerId]/intelligence | @/lib/api-contract<br>@/services/player-intelligence.service<br>next/server | None detected |
| src/app/api/portfolio-intelligence/route.ts | /api/portfolio-intelligence | @/lib/api-contract<br>@/services/portfolio-intelligence.service<br>@/types/portfolio-intelligence<br>next/server | None detected |
| src/app/api/portfolio/ai-v2/route.ts | /api/portfolio/ai-v2 | @/config/sports.config<br>@/services/portfolio-ai-v2.service<br>next/server | None detected |
| src/app/api/portfolio/route.ts | /api/portfolio | @/services/bankroll.service<br>@/services/portfolio-builder.service<br>next/server | None detected |
| src/app/api/prediction-engine/v4/route.ts | /api/prediction-engine/v4 | @/services/prediction-engine-v4.service<br>next/server | None detected |
| src/app/api/prediction-epoch/activation-readiness/route.ts | /api/prediction-epoch/activation-readiness | @/lib/api-contract<br>@/services/prediction-epoch-shadow-readiness.service<br>next/server | None detected |
| src/app/api/prediction-epoch/shadow-readiness/route.ts | /api/prediction-epoch/shadow-readiness | @/lib/api-contract<br>@/services/prediction-epoch-shadow-readiness.service<br>next/server | None detected |
| src/app/api/prediction-safety/route.ts | /api/prediction-safety | @/lib/api-contract<br>@/services/prediction-safety.service | None detected |
| src/app/api/prediction-sdk/route.ts | /api/prediction-sdk | @/lib/api-contract<br>@/services/sport-prediction-engine-sdk.service<br>next/server | None detected |
| src/app/api/prediction-sdk/validation/route.ts | /api/prediction-sdk/validation | @/lib/api-contract<br>@/services/sport-prediction-engine-sdk.service<br>next/server | None detected |
| src/app/api/predictions/by-sport/route.ts | /api/predictions/by-sport | @/config/sports.config<br>@/services/prediction-history.service<br>@/services/top-picks.service<br>next/server | None detected |
| src/app/api/predictions/performance/route.ts | /api/predictions/performance | @/services/prediction-history.service<br>next/server | None detected |
| src/app/api/predictions/provenance/route.ts | /api/predictions/provenance | @/lib/api-contract<br>@/services/legacy-prediction-provenance.service<br>next/server | None detected |
| src/app/api/predictions/settle/debug/route.ts | /api/predictions/settle/debug | @/lib/supabase<br>next/server | game_results<br>prediction_history |
| src/app/api/predictions/settle/route.ts | /api/predictions/settle | @/services/clv-analytics.service<br>@/services/model-calibration.service<br>@/services/model-learning.service<br>@/services/prediction-settlement.service<br>@/services/team-stats.service<br>next/server | None detected |
| src/app/api/predictions/top/route.ts | /api/predictions/top | @/services/best-bets-today.service<br>@/services/top-picks.service<br>next/server | None detected |
| src/app/api/probability-picks/generate/route.ts | /api/probability-picks/generate | @/lib/api-contract<br>@/services/probability-picks.service<br>next/server | None detected |
| src/app/api/probability-picks/parlays/route.ts | /api/probability-picks/parlays | @/lib/api-contract<br>@/services/probability-picks.service<br>@/types/probability-picks<br>next/server | None detected |
| src/app/api/probability-picks/preview/route.ts | /api/probability-picks/preview | @/lib/api-contract<br>@/services/probability-picks.service<br>next/server | None detected |
| src/app/api/probability-picks/route.ts | /api/probability-picks | @/lib/api-contract<br>@/services/probability-picks.service<br>@/types/probability-picks<br>next/server | None detected |
| src/app/api/probability-picks/validation/route.ts | /api/probability-picks/validation | @/lib/api-contract<br>@/services/probability-picks.service | None detected |
| src/app/api/production-readiness/audit/route.ts | /api/production-readiness/audit | @/lib/api-contract<br>@/lib/server-lazy-diagnostics<br>next/server | None detected |
| src/app/api/projection-evolution/route.ts | /api/projection-evolution | @/lib/api-contract<br>@/services/projection-evolution.service<br>next/server | None detected |
| src/app/api/projections/route.ts | /api/projections | @/lib/api-contract<br>@/services/universal-projection-engine.service<br>next/server | None detected |
| src/app/api/providers/budget/status/route.ts | /api/providers/budget/status | @/lib/api-contract<br>@/services/provider-budget.service<br>next/server | None detected |
| src/app/api/providers/capabilities/route.ts | /api/providers/capabilities | @/lib/api-contract<br>@/services/multi-sport-resolution.service<br>@/services/provider-intelligence.service<br>next/server | None detected |
| src/app/api/providers/intelligence/route.ts | /api/providers/intelligence | @/lib/api-contract<br>@/services/provider-intelligence.service | None detected |
| src/app/api/providers/live-verification/route.ts | /api/providers/live-verification | @/lib/api-contract<br>@/services/live-provider-verification.service<br>next/server | None detected |
| src/app/api/providers/route-plan/route.ts | /api/providers/route-plan | @/lib/api-contract<br>@/services/provider-intelligence.service<br>next/server | None detected |
| src/app/api/providers/sdk/route.ts | /api/providers/sdk | @/lib/api-contract<br>@/services/provider-adapter-sdk.service<br>next/server | None detected |
| src/app/api/providers/sdk/validation/route.ts | /api/providers/sdk/validation | @/lib/api-contract<br>@/services/provider-adapter-sdk.service<br>next/server | None detected |
| src/app/api/providers/sportsdataio/capabilities/route.ts | /api/providers/sportsdataio/capabilities | @/lib/api-contract<br>@/services/sportsdataio-runtime-adapter.service<br>next/server | None detected |
| src/app/api/providers/sportsdataio/contract/route.ts | /api/providers/sportsdataio/contract | @/lib/api-contract<br>@/services/sportsdataio-adapter-contract.service<br>next/server | None detected |
| src/app/api/providers/sportsdataio/discovery/route.ts | /api/providers/sportsdataio/discovery | @/lib/api-contract<br>@/services/sportsdataio-mlb-discovery.service<br>next/server | None detected |
| src/app/api/providers/sportsdataio/execution-readiness/validation/route.ts | /api/providers/sportsdataio/execution-readiness/validation | @/lib/api-contract<br>@/lib/server-lazy-diagnostics<br>next/server | None detected |
| src/app/api/providers/sportsdataio/maximization-audit/route.ts | /api/providers/sportsdataio/maximization-audit | @/lib/api-contract<br>@/services/sportsdataio-subscription-maximization-audit.service<br>next/server | None detected |
| src/app/api/providers/sportsdataio/nba/approval-packet/route.ts | /api/providers/sportsdataio/nba/approval-packet | @/lib/api-contract<br>@/lib/server-lazy-diagnostics<br>next/server | None detected |
| src/app/api/providers/sportsdataio/nba/blocker-resolution/route.ts | /api/providers/sportsdataio/nba/blocker-resolution | @/lib/api-contract<br>@/lib/server-lazy-diagnostics<br>next/server | None detected |
| src/app/api/providers/sportsdataio/nba/completion-audit/route.ts | /api/providers/sportsdataio/nba/completion-audit | @/lib/api-contract<br>@/lib/server-lazy-diagnostics<br>next/server | None detected |
| src/app/api/providers/sportsdataio/nba/completion-evidence/route.ts | /api/providers/sportsdataio/nba/completion-evidence | @/lib/api-contract<br>@/lib/server-lazy-diagnostics<br>next/server | None detected |
| src/app/api/providers/sportsdataio/nba/contract-audit/route.ts | /api/providers/sportsdataio/nba/contract-audit | @/lib/api-contract<br>@/lib/server-lazy-diagnostics<br>next/server | None detected |
| src/app/api/providers/sportsdataio/nba/domain-proof/route.ts | /api/providers/sportsdataio/nba/domain-proof | @/lib/api-contract<br>@/lib/server-lazy-diagnostics<br>next/server | None detected |
| src/app/api/providers/sportsdataio/nba/evidence-export/route.ts | /api/providers/sportsdataio/nba/evidence-export | @/lib/api-contract<br>@/lib/server-lazy-diagnostics<br>next/server | None detected |
| src/app/api/providers/sportsdataio/nba/external-blockers/route.ts | /api/providers/sportsdataio/nba/external-blockers | @/lib/api-contract<br>@/lib/server-lazy-diagnostics<br>next/server | None detected |
| src/app/api/providers/sportsdataio/nba/next-pilot-preflight/route.ts | /api/providers/sportsdataio/nba/next-pilot-preflight | @/lib/api-contract<br>@/lib/server-lazy-diagnostics<br>next/server | None detected |
| src/app/api/providers/sportsdataio/nba/objective-audit/route.ts | /api/providers/sportsdataio/nba/objective-audit | @/lib/api-contract<br>@/lib/server-lazy-diagnostics<br>next/server | None detected |
| src/app/api/providers/sportsdataio/nba/odds/endpoint-preflight/route.ts | /api/providers/sportsdataio/nba/odds/endpoint-preflight | @/lib/api-contract<br>@/services/sportsdataio-nba-odds-readiness.service<br>next/server | None detected |
| src/app/api/providers/sportsdataio/nba/odds/readiness/route.ts | /api/providers/sportsdataio/nba/odds/readiness | @/lib/api-contract<br>@/services/sportsdataio-nba-odds-readiness.service<br>next/server | None detected |
| src/app/api/providers/sportsdataio/nba/player-props/endpoint-preflight/route.ts | /api/providers/sportsdataio/nba/player-props/endpoint-preflight | @/lib/api-contract<br>@/services/sportsdataio-nba-player-props-readiness.service<br>next/server | None detected |
| src/app/api/providers/sportsdataio/nba/player-props/readiness/route.ts | /api/providers/sportsdataio/nba/player-props/readiness | @/lib/api-contract<br>@/services/sportsdataio-nba-player-props-readiness.service<br>next/server | None detected |
| src/app/api/providers/sportsdataio/nba/player-stats/migration-preflight/route.ts | /api/providers/sportsdataio/nba/player-stats/migration-preflight | @/lib/api-contract<br>@/services/sportsdataio-nba-player-stats-readiness.service<br>next/server | None detected |
| src/app/api/providers/sportsdataio/nba/player-stats/readiness/route.ts | /api/providers/sportsdataio/nba/player-stats/readiness | @/lib/api-contract<br>@/services/sportsdataio-nba-player-stats-readiness.service<br>next/server | None detected |
| src/app/api/providers/sportsdataio/nba/production-gate/route.ts | /api/providers/sportsdataio/nba/production-gate | @/lib/api-contract<br>@/lib/server-lazy-diagnostics<br>next/server | None detected |
| src/app/api/providers/sportsdataio/nba/production-usage-exclusion/route.ts | /api/providers/sportsdataio/nba/production-usage-exclusion | @/lib/api-contract<br>@/lib/server-lazy-diagnostics<br>next/server | None detected |
| src/app/api/providers/sportsdataio/nba/provider-gate/route.ts | /api/providers/sportsdataio/nba/provider-gate | @/lib/api-contract<br>@/lib/server-lazy-diagnostics<br>next/server | None detected |
| src/app/api/providers/sportsdataio/nba/readiness/route.ts | /api/providers/sportsdataio/nba/readiness | @/lib/api-contract<br>@/lib/server-lazy-diagnostics<br>next/server | None detected |
| src/app/api/providers/sportsdataio/nba/safe-next-actions/route.ts | /api/providers/sportsdataio/nba/safe-next-actions | @/lib/api-contract<br>@/lib/server-lazy-diagnostics<br>next/server | None detected |
| src/app/api/providers/sportsdataio/nba/trial-isolation/route.ts | /api/providers/sportsdataio/nba/trial-isolation | @/lib/api-contract<br>@/services/sportsdataio-nba-trial-isolation-audit.service<br>next/server | None detected |
| src/app/api/providers/sportsdataio/status/route.ts | /api/providers/sportsdataio/status | @/lib/api-contract<br>@/services/sportsdataio-runtime-adapter.service<br>next/server | None detected |
| src/app/api/providers/sportsdataio/validation/route.ts | /api/providers/sportsdataio/validation | @/lib/api-contract<br>@/services/sportsdataio-adapter-contract.service<br>next/server | None detected |
| src/app/api/providers/the-odds-api/capability-audit/route.ts | /api/providers/the-odds-api/capability-audit | @/lib/api-contract<br>@/services/the-odds-api-capability-audit.service<br>next/server | None detected |
| src/app/api/providers/the-odds-api/capability/route.ts | /api/providers/the-odds-api/capability | @/lib/api-contract<br>@/services/the-odds-api-maximum-utilization.service<br>next/server | None detected |
| src/app/api/providers/the-odds-api/catalog/route.ts | /api/providers/the-odds-api/catalog | @/lib/api-contract<br>@/services/the-odds-api-maximum-utilization.service<br>next/server | None detected |
| src/app/api/providers/the-odds-api/current-odds/route.ts | /api/providers/the-odds-api/current-odds | @/lib/api-contract<br>@/services/the-odds-api-current-odds-acquisition.service<br>next/server | None detected |
| src/app/api/providers/the-odds-api/event-crosswalk/route.ts | /api/providers/the-odds-api/event-crosswalk | @/lib/api-contract<br>@/services/the-odds-api-event-crosswalk.service<br>next/server | None detected |
| src/app/api/providers/the-odds-api/pitcher-identity/route.ts | /api/providers/the-odds-api/pitcher-identity | @/lib/api-contract<br>@/services/the-odds-api-pitcher-identity-bridge.service<br>next/server | None detected |
| src/app/api/providers/the-odds-api/quota/route.ts | /api/providers/the-odds-api/quota | @/lib/api-contract<br>@/services/the-odds-api-maximum-utilization.service<br>next/server | None detected |
| src/app/api/ratings/route.ts | /api/ratings | @/lib/supabase<br>@/services/rating.service<br>next/server | team_stats |
| src/app/api/recommendation-pipeline/trace/route.ts | /api/recommendation-pipeline/trace | @/services/recommendation-pipeline-trace.service<br>next/server | None detected |
| src/app/api/recommendation-readiness/route.ts | /api/recommendation-readiness | @/lib/api-contract<br>@/services/day1-recommendation-readiness.service<br>@/services/prospective-official-eligibility-gate.service<br>next/server | None detected |
| src/app/api/reconciliation/plan/route.ts | /api/reconciliation/plan | @/lib/api-contract<br>@/services/global-data-quality.service | None detected |
| src/app/api/results/backfill/route.ts | /api/results/backfill | @/config/sports.config<br>@/services/results-sync.service<br>@/services/team-stats-calculator.service<br>next/server | None detected |
| src/app/api/results/route.ts | /api/results | next/server | None detected |
| src/app/api/results/sync/route.ts | /api/results/sync | @/lib/api-contract<br>@/services/results-sync.service<br>next/server | None detected |
| src/app/api/settlement/core/route.ts | /api/settlement/core | @/lib/api-contract<br>@/services/settlement-core.service | None detected |
| src/app/api/settlement/reconciliation/route.ts | /api/settlement/reconciliation | @/lib/api-contract<br>@/services/settlement-reconciliation.service<br>next/server | None detected |
| src/app/api/sharp-money/route.ts | /api/sharp-money | @/services/sharp-money-intelligence.service<br>next/server | None detected |
| src/app/api/simulator/monte-carlo/route.ts | /api/simulator/monte-carlo | @/services/monte-carlo-engine.service<br>next/server | None detected |
| src/app/api/simulator/route.ts | /api/simulator | @/services/portfolio-simulator.service<br>next/server | None detected |
| src/app/api/slate/next/status/route.ts | /api/slate/next/status | @/lib/api-contract<br>@/services/next-slate.service<br>next/server | None detected |
| src/app/api/soccer/features/preview/route.ts | /api/soccer/features/preview | @/lib/api-contract<br>@/services/soccer-feature-store-integration.service<br>next/server | None detected |
| src/app/api/soccer/features/store/route.ts | /api/soccer/features/store | @/lib/api-contract<br>@/services/soccer-feature-store-integration.service<br>next/server | None detected |
| src/app/api/soccer/features/validation/route.ts | /api/soccer/features/validation | @/lib/api-contract<br>@/services/soccer-feature-store-integration.service<br>next/server | None detected |
| src/app/api/soccer/predictions/health/route.ts | /api/soccer/predictions/health | @/lib/api-contract<br>@/services/soccer-prediction-engine.service<br>next/server | None detected |
| src/app/api/soccer/predictions/route.ts | /api/soccer/predictions | @/lib/api-contract<br>@/services/soccer-prediction-engine.service<br>next/server | None detected |
| src/app/api/soccer/predictions/validation/route.ts | /api/soccer/predictions/validation | @/lib/api-contract<br>@/services/soccer-prediction-engine.service<br>next/server | None detected |
| src/app/api/sports-analyst/game/[eventId]/route.ts | /api/sports-analyst/game/[eventId] | @/lib/api-contract<br>@/services/sports-analyst.service<br>next/server | None detected |
| src/app/api/sports/[sport]/events/[eventId]/route.ts | /api/sports/[sport]/events/[eventId] | @/services/multi-sport-query.service<br>@/services/multi-sport-resolution.service<br>next/server | None detected |
| src/app/api/sports/[sport]/events/route.ts | /api/sports/[sport]/events | @/services/multi-sport-query.service<br>@/services/multi-sport-resolution.service<br>next/server | None detected |
| src/app/api/sports/[sport]/injuries/route.ts | /api/sports/[sport]/injuries | @/services/multi-sport-query.service<br>@/services/multi-sport-resolution.service<br>next/server | None detected |
| src/app/api/sports/[sport]/leagues/route.ts | /api/sports/[sport]/leagues | @/services/multi-sport-query.service<br>@/services/multi-sport-resolution.service<br>next/server | None detected |
| src/app/api/sports/[sport]/lineups/route.ts | /api/sports/[sport]/lineups | @/services/multi-sport-query.service<br>@/services/multi-sport-resolution.service<br>next/server | None detected |
| src/app/api/sports/[sport]/markets/route.ts | /api/sports/[sport]/markets | @/services/multi-sport-query.service<br>@/services/multi-sport-resolution.service<br>next/server | None detected |
| src/app/api/sports/[sport]/odds/route.ts | /api/sports/[sport]/odds | @/services/multi-sport-query.service<br>@/services/multi-sport-resolution.service<br>next/server | None detected |
| src/app/api/sports/[sport]/participants/route.ts | /api/sports/[sport]/participants | @/services/multi-sport-query.service<br>@/services/multi-sport-resolution.service<br>next/server | None detected |
| src/app/api/sports/[sport]/providers/route.ts | /api/sports/[sport]/providers | @/services/multi-sport-query.service<br>@/services/multi-sport-resolution.service<br>next/server | None detected |
| src/app/api/sports/[sport]/route.ts | /api/sports/[sport] | @/services/multi-sport-query.service<br>@/services/multi-sport-resolution.service<br>next/server | None detected |
| src/app/api/sports/[sport]/standings/route.ts | /api/sports/[sport]/standings | @/services/multi-sport-query.service<br>@/services/multi-sport-resolution.service<br>next/server | None detected |
| src/app/api/sports/[sport]/stats/route.ts | /api/sports/[sport]/stats | @/services/multi-sport-query.service<br>@/services/multi-sport-resolution.service<br>next/server | None detected |
| src/app/api/sports/health/route.ts | /api/sports/health | @/services/multi-sport-health.service<br>@/services/multi-sport-validation.service<br>next/server | None detected |
| src/app/api/sports/route.ts | /api/sports | @/services/multi-sport-query.service<br>@/services/multi-sport-validation.service<br>next/server | None detected |
| src/app/api/sportsbook-intelligence/route.ts | /api/sportsbook-intelligence | @/services/sportsbook-intelligence.service<br>next/server | None detected |
| src/app/api/sync/reliability/route.ts | /api/sync/reliability | @/lib/api-contract<br>@/services/sync-reliability.service | None detected |
| src/app/api/system/version/route.ts | /api/system/version | @/lib/api-contract<br>fs/promises<br>next/server<br>path | None detected |
| src/app/api/team-stats/recalculate/route.ts | /api/team-stats/recalculate | @/services/team-stats-calculator.service<br>next/server | None detected |
| src/app/api/team-stats/route.ts | /api/team-stats | @/lib/supabase<br>next/server | team_stats |
| src/app/api/team-stats/sync/route.ts | /api/team-stats/sync | @/services/mlb-team-stats-sync.service<br>next/server | None detected |
| src/app/api/tennis/features/preview/route.ts | /api/tennis/features/preview | @/lib/api-contract<br>@/services/tennis-feature-store-integration.service<br>next/server | None detected |
| src/app/api/tennis/features/store/route.ts | /api/tennis/features/store | @/lib/api-contract<br>@/services/tennis-feature-store-integration.service<br>next/server | None detected |
| src/app/api/tennis/features/validation/route.ts | /api/tennis/features/validation | @/lib/api-contract<br>@/services/tennis-feature-store-integration.service<br>next/server | None detected |
| src/app/api/tennis/predictions/health/route.ts | /api/tennis/predictions/health | @/lib/api-contract<br>@/services/tennis-prediction-engine.service<br>next/server | None detected |
| src/app/api/tennis/predictions/route.ts | /api/tennis/predictions | @/lib/api-contract<br>@/services/tennis-prediction-engine.service<br>next/server | None detected |
| src/app/api/tennis/predictions/validation/route.ts | /api/tennis/predictions/validation | @/lib/api-contract<br>@/services/tennis-prediction-engine.service<br>next/server | None detected |
| src/app/api/test-providers/route.ts | /api/test-providers | @/services/apis/api-factory<br>next/server | None detected |
| src/app/api/ufc/features/preview/route.ts | /api/ufc/features/preview | @/lib/api-contract<br>@/services/ufc-feature-store-integration.service<br>next/server | None detected |
| src/app/api/ufc/features/store/route.ts | /api/ufc/features/store | @/lib/api-contract<br>@/services/ufc-feature-store-integration.service<br>next/server | None detected |
| src/app/api/ufc/features/validation/route.ts | /api/ufc/features/validation | @/lib/api-contract<br>@/services/ufc-feature-store-integration.service<br>next/server | None detected |
| src/app/api/ufc/predictions/health/route.ts | /api/ufc/predictions/health | @/lib/api-contract<br>@/services/ufc-prediction-engine.service<br>next/server | None detected |
| src/app/api/ufc/predictions/route.ts | /api/ufc/predictions | @/lib/api-contract<br>@/services/ufc-prediction-engine.service<br>next/server | None detected |
| src/app/api/ufc/predictions/validation/route.ts | /api/ufc/predictions/validation | @/lib/api-contract<br>@/services/ufc-prediction-engine.service<br>next/server | None detected |
| src/app/api/weather/seed/route.ts | /api/weather/seed | @/lib/supabase-admin<br>next/server | weather_impacts |
| src/app/admin/historical-diagnostics/page.tsx | /admin/historical-diagnostics | @/services/retrosheet-game-reconstruction.service<br>@/services/retrosheet-historical-feature-store.service<br>next | None detected |
| src/app/ai-bet-finder/page.tsx | /ai-bet-finder | @/components/market-opportunities/AiBetFinderTool | None detected |
| src/app/ai-operations/page.tsx | /ai-operations | @/components/dashboard/DashboardSection<br>@/components/dashboard/DashboardShell<br>@/components/product/ProductStatus<br>@/services/ai-learning-lifecycle.service<br>@/services/current-board.service<br>@/services/performance-product-contract.service<br>@/services/probability-picks.service<br>@/types/probability-picks | settled<br>sports<br>stored |
| src/app/arbitrage/page.tsx | /arbitrage | @/components/market-opportunities/ArbitrageTool | None detected |
| src/app/autonomous-daily-ai/page.tsx | /autonomous-daily-ai | @/components/dashboard/DashboardShell<br>@/services/autonomous-daily-ai.service | None detected |
| src/app/best-value/page.tsx | /best-value | @/components/market-opportunities/BestValueTool | None detected |
| src/app/betting-workbench/page.tsx | /betting-workbench | @/components/market-opportunities/BettingWorkbenchTool | None detected |
| src/app/closing-line-intelligence/page.tsx | /closing-line-intelligence | @/components/dashboard/DashboardShell<br>@/services/closing-line-intelligence.service | None detected |
| src/app/dashboard/page.tsx | /dashboard | @/components/dashboard/AdvancedEvidenceDisclosure<br>@/components/dashboard/DashboardDeveloperGroups<br>@/components/dashboard/DashboardSection<br>@/components/dashboard/DashboardShell<br>@/components/dashboard/TodayDecisionPanel | None detected |
| src/app/data-coverage/[sport]/page.tsx | /data-coverage/[sport] | @/components/dashboard/DashboardSection<br>@/components/dashboard/DashboardShell<br>@/components/product/ProductStatus<br>@/services/data-coverage-inventory.service<br>next/navigation | this |
| src/app/data-coverage/page.tsx | /data-coverage | @/components/dashboard/DashboardSection<br>@/components/dashboard/DashboardShell<br>@/components/product/ProductStatus<br>@/services/data-coverage-inventory.service<br>@/services/multi-sport-data-expansion-checkpoint2.service<br>@/services/multi-sport-data-expansion-checkpoint3.service<br>@/services/multi-sport-data-expansion-final.service<br>@/services/multi-sport-provider-entitlement-audit.service<br>@/services/the-odds-api-maximum-utilization.service | this |
| src/app/game-intelligence/[eventId]/page.tsx | /game-intelligence/[eventId] | @/components/dashboard/MlbGameIntelligenceDetailClient | None detected |
| src/app/game-intelligence/page.tsx | /game-intelligence | @/components/dashboard/MlbGameIntelligencePageClient | None detected |
| src/app/login/page.tsx | /login | @/lib/supabase<br>react | None detected |
| src/app/market-intelligence/page.tsx | /market-intelligence | @/components/dashboard/DashboardShell<br>@/components/product/ProductStatus<br>@/services/market-movement-intelligence.service | sports_odds_snapshots.<br>stored<br>true |
| src/app/mlb-operations/page.tsx | /mlb-operations | @/services/mlb-operations-center.service<br>next | None detected |
| src/app/model/page.tsx | /model | @/components/dashboard/AIModelCenter | None detected |
| src/app/most-likely/page.tsx | /most-likely | @/components/market-opportunities/MostLikelyTool | None detected |
| src/app/page.tsx | / | @/components/home/HomeBettingPlan | None detected |
| src/app/performance/page.tsx | /performance | @/components/performance/PerformanceProductClient | None detected |
| src/app/player-projections/[projectionId]/page.tsx | /player-projections/[projectionId] | @/components/dashboard/MlbPlayerProjectionDetailClient | None detected |
| src/app/player-projections/page.tsx | /player-projections | @/components/dashboard/MlbPlayerProjectionPageClient | None detected |
| src/app/portfolio-intelligence/page.tsx | /portfolio-intelligence | @/components/dashboard/DashboardShell<br>@/components/product/ProductStatus<br>@/services/portfolio-intelligence.service | None detected |
| src/app/probability-picks/page.tsx | /probability-picks | @/components/probability-picks/ProbabilityPicksClient | None detected |
| src/app/projections/page.tsx | /projections | @/components/dashboard/MlbProjectionBoardClient | None detected |
| src/app/register/page.tsx | /register | @/lib/supabase<br>react | profiles |
| src/app/sports-center/[sport]/page.tsx | /sports-center/[sport] | @/components/dashboard/DashboardSection<br>@/components/dashboard/DashboardShell<br>@/components/product/ProductStatus<br>@/services/sports-center.service<br>next/navigation | None detected |
| src/app/sports-center/page.tsx | /sports-center | @/components/dashboard/DashboardSection<br>@/components/dashboard/DashboardShell<br>@/components/product/ProductStatus<br>@/services/sports-center.service<br>@/types/sports-center | None detected |
| src/app/layout.tsx | / | @/context/DashboardContext<br>next | None detected |

## Scheduler To Worker To Provider

| Scheduler / Worker | Dependencies | Provider Signals | Status |
| --- | --- | --- | --- |
| docs/HISTORICAL_IMPORT_ORCHESTRATOR_V2.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/PICK_ANALYZER_V1_EVIDENCE_INDEX.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| src/app/api/autonomous-daily-operations/execute/route.ts | @/lib/api-contract<br>@/lib/server-lazy-diagnostics<br>next/server | Provider or protected endpoint reference detected | Protected |
| src/app/api/autonomous-daily-operations/scheduler/route.ts | @/lib/api-contract<br>@/lib/server-lazy-diagnostics<br>next/server | Provider or protected endpoint reference detected | Production Surface |
| src/app/api/cron/capture-predictions/route.ts | @/services/prediction-capture.service<br>next/server | No provider reference detected | Protected |
| src/app/api/cron/daily-sync/route.ts | @/services/daily-pipeline.service<br>next/server | Provider or protected endpoint reference detected | Protected |
| src/app/api/cron/master-sync/route.ts | @/lib/server-cache<br>@/services/master-sync.service<br>@/services/self-learning-engine.service<br>next/server | No provider reference detected | Protected |
| src/app/api/cron/operating-day/route.ts | @/lib/api-contract<br>@/services/adaptive-refresh-orchestrator.service<br>@/services/ai-performance-center.service<br>@/services/operating-day-automation.service<br>@/services/operating-day.service<br>next/server | Provider or protected endpoint reference detected | Protected |
| src/app/api/dashboard/route.ts | @/lib/server-lazy-diagnostics<br>next/server | Provider or protected endpoint reference detected | Production Surface |
| src/app/api/events/identity/audit/route.ts | @/lib/api-contract<br>@/services/universal-event-identity.service<br>next/server | Provider or protected endpoint reference detected | Protected |
| src/app/api/head-to-head/recalculate/route.ts | @/services/team-matchups-calculator.service<br>next/server | No provider reference detected | Protected |
| src/app/api/historical-import/cancel/route.ts | @/lib/api-contract<br>@/lib/server-lazy-diagnostics<br>next/server | Provider or protected endpoint reference detected | Protected |
| src/app/api/historical-import/execute/route.ts | @/lib/api-contract<br>@/services/sportsdataio-historical-import-readiness.service<br>@/services/sportsdataio-mlb-historical-import-executor.service<br>@/services/sportsdataio-mlb-prospective-preview.service<br>next/server | Provider or protected endpoint reference detected | Protected |
| src/app/api/historical-import/resume/route.ts | @/lib/api-contract<br>@/lib/server-lazy-diagnostics<br>next/server | Provider or protected endpoint reference detected | Protected |
| src/app/api/mlb/historical-backfill/player-game-stats/route.ts | @/lib/api-contract<br>@/services/mlb-current-season-backfill-orchestrator.service<br>next/server | Provider or protected endpoint reference detected | Protected |
| src/app/api/mlb/historical-intelligence/retrosheet/features/route.ts | @/lib/api-contract<br>@/services/retrosheet-historical-feature-store.service<br>next/server | Provider or protected endpoint reference detected | Protected |
| src/app/api/mlb/historical-intelligence/retrosheet/import/route.ts | @/lib/api-contract<br>@/services/retrosheet-controlled-import.service<br>next/server | Provider or protected endpoint reference detected | Protected |
| src/app/api/mlb/learning-brain/route.ts | @/lib/api-contract<br>@/services/mlb-learning-brain.service<br>next/server | Provider or protected endpoint reference detected | Protected |
| src/app/api/mlb/pitchers/projections/generate/route.ts | @/lib/api-contract<br>@/services/mlb-pitcher-projection-engine.service<br>next/server | Provider or protected endpoint reference detected | Protected |
| src/app/api/mlb/player-props/sync/route.ts | @/lib/api-contract<br>@/services/mlb-player-prop-sync.service<br>@/types/mlb-player-prop-ingestion<br>next/server | Provider or protected endpoint reference detected | Protected |
| src/app/api/mlb/players/unresolved-identities/route.ts | @/lib/api-contract<br>@/services/mlb-unresolved-player-identity.service<br>next/server | Provider or protected endpoint reference detected | Protected |
| src/app/api/mlb/predictions/v6-regeneration/route.ts | @/lib/api-contract<br>@/services/sportsdataio-mlb-prospective-preview.service<br>next/server | Provider or protected endpoint reference detected | Protected |
| src/app/api/mlb/predictions/v7-regeneration/route.ts | @/lib/api-contract<br>@/services/sportsdataio-mlb-prospective-preview.service<br>next/server | Provider or protected endpoint reference detected | Protected |
| src/app/api/mlb/pregame-starter-evidence/route.ts | @/lib/api-contract<br>@/services/mlb-pregame-starter-evidence.service<br>next/server | Provider or protected endpoint reference detected | Protected |
| src/app/api/mlb/provider-verification/games-by-date/route.ts | @/lib/api-contract<br>@/services/mlb-games-by-date-verification.service<br>next/server | Provider or protected endpoint reference detected | Protected |
| src/app/api/mlb/starters/sync/route.ts | @/lib/api-contract<br>@/services/mlb-starter-sync.service<br>next/server | Provider or protected endpoint reference detected | Protected |
| src/app/api/nba/predictions/backtest/run/route.ts | @/services/nba-backtesting-calibration.service<br>next/server | No provider reference detected | Protected |
| src/app/api/nba/predictions/generate/route.ts | @/lib/server-lazy-diagnostics<br>next/server | No provider reference detected | Protected |
| src/app/api/nba/predictions/settle/event/[eventId]/route.ts | @/lib/server-lazy-diagnostics<br>next/server | No provider reference detected | Protected |
| src/app/api/nba/predictions/settle/route.ts | @/lib/server-lazy-diagnostics<br>next/server | No provider reference detected | Protected |
| src/app/api/nba/predictions/validate/route.ts | @/lib/server-lazy-diagnostics<br>next/server | Provider or protected endpoint reference detected | Protected |
| src/app/api/nba/sync/games/route.ts | @/services/nba-data-sync.service<br>next/server | No provider reference detected | Protected |
| src/app/api/nba/sync/injuries/route.ts | @/services/nba-data-sync.service<br>next/server | No provider reference detected | Protected |
| src/app/api/nba/sync/lineups/route.ts | @/services/nba-data-sync.service<br>next/server | No provider reference detected | Protected |
| src/app/api/nba/sync/odds/route.ts | @/services/nba-data-sync.service<br>next/server | Provider or protected endpoint reference detected | Protected |
| src/app/api/nba/sync/players/route.ts | @/services/nba-data-sync.service<br>next/server | No provider reference detected | Protected |
| src/app/api/nba/sync/route.ts | @/services/nba-data-sync.service<br>next/server | No provider reference detected | Protected |
| src/app/api/nba/sync/standings/route.ts | @/services/nba-data-sync.service<br>next/server | No provider reference detected | Protected |
| src/app/api/nba/sync/stats/route.ts | @/services/nba-data-sync.service<br>next/server | No provider reference detected | Protected |
| src/app/api/nba/sync/teams/route.ts | @/services/nba-data-sync.service<br>next/server | No provider reference detected | Protected |
| src/app/api/operating-day/[operatingDayId]/settle/route.ts | @/lib/api-contract<br>@/lib/server-lazy-diagnostics<br>next/server | Provider or protected endpoint reference detected | Protected |
| src/app/api/operating-day/execute/route.ts | @/lib/api-contract<br>@/lib/server-lazy-diagnostics<br>next/server | Provider or protected endpoint reference detected | Protected |
| src/app/api/operations/adaptive-refresh/route.ts | @/lib/api-contract<br>@/lib/server-lazy-diagnostics<br>next/server | Provider or protected endpoint reference detected | Protected |
| src/app/api/performance/history/route.ts | @/services/performance-scope-v2.service<br>next/server | Provider or protected endpoint reference detected | Production Surface |
| src/app/api/predictions/settle/route.ts | @/services/clv-analytics.service<br>@/services/model-calibration.service<br>@/services/model-learning.service<br>@/services/prediction-settlement.service<br>@/services/team-stats.service<br>next/server | No provider reference detected | Protected |
| src/app/api/projections/route.ts | @/lib/api-contract<br>@/services/universal-projection-engine.service<br>next/server | Provider or protected endpoint reference detected | Protected |
| src/app/api/providers/live-verification/route.ts | @/lib/api-contract<br>@/services/live-provider-verification.service<br>next/server | Provider or protected endpoint reference detected | Protected |
| src/app/api/providers/sportsdataio/discovery/route.ts | @/lib/api-contract<br>@/services/sportsdataio-mlb-discovery.service<br>next/server | Provider or protected endpoint reference detected | Protected |
| src/app/api/recommendation-readiness/route.ts | @/lib/api-contract<br>@/services/day1-recommendation-readiness.service<br>@/services/prospective-official-eligibility-gate.service<br>next/server | Provider or protected endpoint reference detected | Protected |
| src/app/api/results/backfill/route.ts | @/config/sports.config<br>@/services/results-sync.service<br>@/services/team-stats-calculator.service<br>next/server | Provider or protected endpoint reference detected | Protected |
| src/app/api/results/sync/route.ts | @/lib/api-contract<br>@/services/results-sync.service<br>next/server | Provider or protected endpoint reference detected | Protected |
| src/app/api/settlement/reconciliation/route.ts | @/lib/api-contract<br>@/services/settlement-reconciliation.service<br>next/server | Provider or protected endpoint reference detected | Protected |
| src/app/api/team-stats/recalculate/route.ts | @/services/team-stats-calculator.service<br>next/server | No provider reference detected | Protected |
| src/app/api/team-stats/sync/route.ts | @/services/mlb-team-stats-sync.service<br>next/server | No provider reference detected | Protected |
| src/app/ai-operations/page.tsx | @/components/dashboard/DashboardSection<br>@/components/dashboard/DashboardShell<br>@/components/product/ProductStatus<br>@/services/ai-learning-lifecycle.service<br>@/services/current-board.service<br>@/services/performance-product-contract.service<br>@/services/probability-picks.service<br>@/types/probability-picks | Provider or protected endpoint reference detected | Production Surface |
| src/app/autonomous-daily-ai/page.tsx | @/components/dashboard/DashboardShell<br>@/services/autonomous-daily-ai.service | Provider or protected endpoint reference detected | Production Surface |
| src/app/data-coverage/page.tsx | @/components/dashboard/DashboardSection<br>@/components/dashboard/DashboardShell<br>@/components/product/ProductStatus<br>@/services/data-coverage-inventory.service<br>@/services/multi-sport-data-expansion-checkpoint2.service<br>@/services/multi-sport-data-expansion-checkpoint3.service<br>@/services/multi-sport-data-expansion-final.service<br>@/services/multi-sport-provider-entitlement-audit.service<br>@/services/the-odds-api-maximum-utilization.service | Provider or protected endpoint reference detected | Production Surface |
| src/app/mlb-operations/page.tsx | @/services/mlb-operations-center.service<br>next | Provider or protected endpoint reference detected | Production Surface |
| src/components/market-opportunities/BettingWorkbenchTool.tsx | react | Provider or protected endpoint reference detected | Internal Dependency |
| .github/workflows/operating-day-refresh.yml | None detected | Provider or protected endpoint reference detected | Scheduled |
| .github/workflows/production-operating-day-heartbeat.yml | None detected | Provider or protected endpoint reference detected | Scheduled |
| .github/workflows/production-operating-day.yml | None detected | Provider or protected endpoint reference detected | Scheduled |
| src/components/dashboard/AdaptiveOperationsPanel.tsx | react | Provider or protected endpoint reference detected | Production Surface |
| src/components/dashboard/BsnPredictionPreviewPanel.tsx | react | Provider or protected endpoint reference detected | Experimental |
| src/components/dashboard/DataFreshnessPreviewCard.tsx | react | Provider or protected endpoint reference detected | Experimental |
| src/components/dashboard/HistoricalImportEnginePanel.tsx | react | Provider or protected endpoint reference detected | Production Surface |
| src/components/dashboard/MlbGameIntelligencePageClient.tsx | react | Provider or protected endpoint reference detected | Production Surface |
| src/components/dashboard/MlbPredictionEnginePanel.tsx | react | Provider or protected endpoint reference detected | Production Surface |
| src/components/dashboard/MlbProjectionBoardClient.tsx | react | Provider or protected endpoint reference detected | Production Surface |
| src/components/dashboard/MlbProspectivePreviewPanel.tsx | react | Provider or protected endpoint reference detected | Experimental |
| src/components/dashboard/MultiSportEnginePanel.tsx | @/context/SportContext<br>react | Provider or protected endpoint reference detected | Production Surface |
| src/components/dashboard/NbaPredictionEnginePanel.tsx | react | Provider or protected endpoint reference detected | Production Surface |
| src/components/dashboard/NextSlateStatusPanel.tsx | react | Provider or protected endpoint reference detected | Production Surface |
| src/components/dashboard/OperationsHealthPanel.tsx | react | Provider or protected endpoint reference detected | Production Surface |
| src/components/dashboard/ProductionTodayPanel.tsx | react | Provider or protected endpoint reference detected | Production Surface |
| src/components/dashboard/ProductTodayPanel.tsx | react | Provider or protected endpoint reference detected | Production Surface |
| src/components/dashboard/QuickActionsPanel.tsx | @/context/DashboardContext<br>react | Provider or protected endpoint reference detected | Production Surface |
| src/components/dashboard/today-opportunity-readiness.ts | None detected | Provider or protected endpoint reference detected | Production Surface |
| src/components/dashboard/TopPicksPanel.tsx | @/components/dashboard/PickExplanationCard<br>react | Provider or protected endpoint reference detected | Production Surface |
| src/components/dashboard/UserTodayPanel.tsx | @/components/dashboard/AiPerformancePreviewCard<br>@/components/dashboard/DataFreshnessPreviewCard<br>react | Provider or protected endpoint reference detected | Production Surface |
| src/services/dashboard-today.service.ts | @/lib/supabase-admin<br>@/services/active-event.service<br>@/services/current-board.service<br>@/services/market-intelligence-category.service<br>@/services/mlb-ai-picks-feed.service<br>@/services/mlb-game-lifecycle.service<br>@/services/mlb-odds-coverage.service<br>@/services/mlb-operating-date-resolution.service<br>@/services/mlb-projected-score.service<br>@/services/model-only-intelligence.service | Provider or protected endpoint reference detected | Production Surface |
| docs/MLB_FEATURE_STORE.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/FEATURE_INTELLIGENCE_V1.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/MLB_MARKET_DATA_FOUNDATION_V2.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/mlb-learning-brain-v1.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/mlb-learning-scheduler.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/mlb-model-distributions-v2.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/mlb-provider-capability-audit-v1.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/mlb-starter-refresh-scheduler.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/PICK_ANALYZER_V1_FINAL_VALIDATION_MATRIX.json | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/RELEASES/v1.0-platform-certified.json | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/THE_ODDS_API_EVENT_CROSSWALK_AND_PROP_SYNC_V1.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/ADAPTIVE_REFRESH_ARCHITECTURE.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/ADAPTIVE_REFRESH_EXECUTION.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/ADAPTIVE_REFRESH_POLICY_V1.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/AI_LEARNING_PIPELINE.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/AI_MODEL_STRATEGY_V1.json | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/AI_OPERATIONS_CENTER.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/ARCHITECTURE.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/AUTONOMOUS_DAILY_AI_V1.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/AUTONOMOUS_DAILY_LIFECYCLE.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/AUTONOMOUS_DAILY_SCHEDULER_V1.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/AUTONOMOUS_EXECUTION_V2.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/AUTONOMOUS_EXECUTION.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/autonomous-execution-v2.json | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/BSN_COMPLETION_CERTIFICATION_V1.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/BSN_FOUNDATION_V1_CERTIFICATION.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/BSN_HISTORICAL_FOUNDATION_V2.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/BSN_WAVE2_CORE_CERTIFICATION.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/bsn-data-acquisition-strategy.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/bsn-foundation.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/bsn-integration-v1.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/bsn-prediction-engine-v1.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/bsn-source-framework-v1.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/BUILD_MEMORY_OPTIMIZATION_DEPLOYMENT_RECOVERY_V1.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/BUILD_MEMORY_OPTIMIZATION_V1.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/build-memory-optimization-v1-import-pressure.json | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/build-memory-optimization-v1-phase-b-import-pressure.json | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/build-memory-optimization-v1-phase2-import-pressure.json | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/CERTIFIED_PREDICTION_EPOCH_MLB_PROMOTION_READINESS_DESIGN_V1.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/CLOSED_BETA_READINESS.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/CORE_PREDICTION_CERTIFICATION_ROADMAP_V1.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/CORE_V1_CERTIFICATION.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/DAILY_AUTONOMY_CERTIFICATION_V1.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/DAILY_CONTINUITY_V1.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/DATA_FRESHNESS_POLICY.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/day1-recommendation-readiness-v1.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/DECISION_LOG.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/END_TO_END_DATA_FLOW.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/end-to-end-prediction-pipeline-v1.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/event-identity-operations.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/FEATURE_ANALYSIS_V1.md | None detected | No provider reference detected | Internal Dependency |
| docs/FEATURE_COVERAGE.json | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/FIRST_MODEL_FEATURE_MANIFEST_V1.json | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/FULL_HISTORICAL_REPLAY_PHASE_2B.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/FULL_PLATFORM_AUDIT_V1_FINDINGS.json | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/FULL_PLATFORM_AUDIT_V1_REPAIR_PLAN.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/FULL_PLATFORM_AUDIT_V1_SYSTEM_MAP.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/FULL_PLATFORM_AUDIT_V1.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/FUTURE_ONLY_PREDICTION_CONTINUITY_V2.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/HISTORICAL_DATA_COMPLETION_BASELINE_V3.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/HISTORICAL_REPLAY_IO_READINESS_CONTROLLED_PILOT_V1.md | None detected | No provider reference detected | Experimental |
| docs/HISTORICAL_SETTLED_STATUS_RECONCILIATION_V1.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/HISTORICAL_SPORTS_DATA_COMPLETION_PROGRAM_V1_CERTIFICATION.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/HISTORICAL_SPORTS_DATA_FOUNDATION_V2_CERTIFICATION.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/historical-settled-status-reconciliation-v1.json | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/LIVE_MULTI_SPORT_DATA_ACQUISITION_V1_FINAL_CERTIFICATION.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/LIVE_PROVIDER_VERIFICATION.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/live-multi-sport-acquisition-v1-checkpoint-a.json | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/live-multi-sport-acquisition-v1-checkpoint-b-mlb.json | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/live-multi-sport-acquisition-v1-checkpoint-c-nba-nfl.json | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/live-multi-sport-acquisition-v1-final-certification.json | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/MASTER_ROADMAP.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/missing-canonical-events-recovery-v1.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/MLB_ADAPTIVE_REFRESH_EXECUTION.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/MLB_ARCHITECTURE.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/MLB_AUTOMATION.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/MLB_AUTONOMOUS_OPERATING_DAY_METRICS_V1.json | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/MLB_AUTONOMOUS_OPERATIONS_V1.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/MLB_DATA_FLOW.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/MLB_END_TO_END_DAILY_CLOSURE_V1.json | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/MLB_EVENT_RESULT_COMPLETION_V3.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/MLB_FIRST_AUTONOMOUS_OPERATING_DAY_CERTIFICATION_V1.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/MLB_FRESHNESS_POLICY.md | None detected | No provider reference detected | Internal Dependency |
| docs/MLB_HISTORICAL_FOUNDATION_V3_CERTIFICATION.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/MLB_KNOWN_ISSUES.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/MLB_OPERATING_DATE_AND_ACTION_ADVANCEMENT_REPAIR_V1.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/MLB_OPERATING_DAY_RUNTIME_CERTIFICATION.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/MLB_OPERATIONS.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/MLB_PLAYER_PROPS_DATA_READINESS_AUDIT_V1.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/MLB_PRODUCTION_CERTIFICATION_CLOSED_BETA_AUDIT.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/MLB_PROVIDER_STRATEGY.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/MLB_SEASON_COVERAGE_PLAN_V3.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/MLB_SLATE_RECOVERY_LIFECYCLE_TRUTH_REPAIR.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/MLB_SPORT_EVENTS_STATUS_CONSTRAINT_ROOT_CAUSE_TRACE_V1.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/MLB_USER_MODE_FRESHNESS_PROVIDER_BUDGET_PHASE_1.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/mlb-automatic-operating-day-v1.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/mlb-core-final-certification.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/mlb-current-season-backfill.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/mlb-daily-operations-v1.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/mlb-data-quality-certification.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/mlb-data-quality-v1.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/mlb-feature-model-readiness.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/mlb-historical-recommendation-replay-v1.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/mlb-intelligence-v2.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/mlb-line-movement-expansion-batch-v1.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/mlb-line-movement-probe-v1.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/mlb-live-data-refresh-v1.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/mlb-live-validation-readiness-v1.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/mlb-model-audit.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/mlb-next-slate-rollover-v1.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/mlb-odds-coverage-reconciliation-v1.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/mlb-operating-day-lifecycle-v1.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/mlb-prediction-engine-v6-preflight.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/mlb-season-coverage-plan-v3.json | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/mlb-verified-provider-call-path-v1.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/MULTI_SPORT_PRODUCTION_READINESS_MATRIX_V1.json | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/MULTI_SPORT_RESULTS_SETTLEMENT_PREVIEW_UNLOCK_V1_FINAL_CERTIFICATION.md | None detected | Provider or protected endpoint reference detected | Experimental |
| docs/multi-sport-engine.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/multi-sport-results-settlement-preview-unlock-v1-final-certification.json | None detected | Provider or protected endpoint reference detected | Experimental |
| docs/multi-sport-results-settlement-preview-unlock-v1-ledger.json | None detected | Provider or protected endpoint reference detected | Experimental |
| docs/NBA_BASELINE_CERTIFICATION_V1.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/NBA_HISTORICAL_FOUNDATION_V2.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/NBA_IDENTITY_MARKET_READINESS_V1.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/NBA_RESULT_STAT_COMPLETION_PLAN_V1.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/nba-backtesting-calibration-v1.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/nba-data-sync-v1.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/nba-prediction-validation-settlement-v1.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/NFL_BASELINE_CERTIFICATION_V1.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/NFL_COMPLETION_PLAN_V1.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/NFL_HISTORICAL_FOUNDATION_V2.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/NFL_NHL_PREVIEW_PREDICTION_LIFECYCLE_V1_FINAL_CERTIFICATION.md | None detected | Provider or protected endpoint reference detected | Experimental |
| docs/NFL_NHL_PREVIEW_PREDICTION_LIFECYCLE_V1.md | None detected | Provider or protected endpoint reference detected | Experimental |
| docs/NFL_PREVIEW_PREDICTION_LIFECYCLE_V1.md | None detected | Provider or protected endpoint reference detected | Experimental |
| docs/nfl-preview-prediction-lifecycle-v1.json | None detected | Provider or protected endpoint reference detected | Experimental |
| docs/NHL_BASELINE_AND_COMPLETION_PLAN_V1.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/NHL_HISTORICAL_FOUNDATION_V2.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/NHL_PREVIEW_PREDICTION_LIFECYCLE_V1.md | None detected | Provider or protected endpoint reference detected | Experimental |
| docs/nhl-preview-prediction-lifecycle-v1.json | None detected | Provider or protected endpoint reference detected | Experimental |
| docs/ODDS_API_EXTRACTION_COMPLETENESS_V1.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/operating-day-cron-reliability-v1.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/OPERATIONAL_READINESS_MULTI_SPORT_AUDIT_V1.json | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/OPERATIONAL_READINESS_MULTI_SPORT_AUDIT_V1.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/OPERATIONS_RUNBOOK.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/PERFORMANCE_API_QUERY_OPTIMIZATION_V1.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/PICK_ANALYZER_CHANGE_CONTROL_POLICY.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/PICK_ANALYZER_FINAL_COMPLETION_PLAN_V1.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/PICK_ANALYZER_POST_V1_BACKLOG.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/PICK_ANALYZER_V1_DEFINITION_OF_DONE_MATRIX.json | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/PICK_ANALYZER_V1_FINAL_CERTIFICATION.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/PICK_ANALYZER_V1_FINAL_VALIDATION_BUNDLE.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/PICK_ANALYZER_V1_SCOPE.json | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/PICK_ANALYZER_V2_PHASE_A3_SCHEDULER_FRESHNESS_AUDIT.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/PICK_ANALYZER_V2_PHASE_A4_UI_STATE_AUDIT.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/PICK_ANALYZER_V2_PHASE_A5_API_QUERY_PERFORMANCE_AUDIT.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/PICK_ANALYZER_V2_PHASE_A6_BUILD_RELIABILITY_AUDIT.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/PICK_ANALYZER_V2_PHASE_B2_TODAY_EXPERIENCE.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/PICK_ANALYZER_V2_PHASE_B3_BEST_OPPORTUNITY_READINESS.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/PICK_ANALYZER_V2_PHASE_B4_DECISION_DASHBOARD_EXPERIENCE.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/PICK_ANALYZER_V2_PHASE_B5_1_MOBILE_OPPORTUNITY_NAVIGATION.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/PICK_ANALYZER_V2_PHASE_B5_AI_DECISION_EXPLANATION.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/PICK_ANALYZER_V2_PHASE_B6_1_LIVE_FRESHNESS_BUDGET_AUDIT.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/PICK_ANALYZER_V2_PHASE_C1_1_EXTERNAL_SCHEDULER_RECOVERY.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/PICK_ANALYZER_V2_PHASE_C1_DAILY_BETTING_AND_SETTLEMENT_GUARANTEE.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/pick-analyzer-v2-phase-a3-scheduler-freshness-audit.json | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/pick-analyzer-v2-phase-a4-ui-state-audit.json | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/pick-analyzer-v2-phase-a5-api-query-performance-audit.json | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/pick-analyzer-v2-phase-a6-build-reliability-audit.json | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/pick-analyzer-v2-phase-b6-1-live-freshness-budget-audit.json | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/pick-analyzer-v2-phase-c1-1-external-scheduler-recovery.json | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/pick-analyzer-v2-phase-c1-daily-betting-settlement-guarantee.json | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/PLATFORM_CONSOLIDATION_DUPLICATION_CLEANUP_V1.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/PLATFORM_LOCK_POLICY.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/PLATFORM_ROLLBACK_RUNBOOK.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/PLAYER_PROP_MULTI_MARKET_EXPANSION_V1.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/PREDICTION_EPOCH_GOVERNANCE_SEEDING_V1.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/PREDICTION_EPOCH_GOVERNANCE_V2_MIGRATION_REVIEW.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/PREDICTION_EPOCH_GOVERNANCE_V2_MIGRATION_RUNBOOK.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/PREDICTION_EPOCH_MIGRATION_DETECTION_FIX_V1.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/PREDICTION_EPOCH_SHADOW_READINESS_V1.md | None detected | Provider or protected endpoint reference detected | Experimental |
| docs/PREDICTION_LIFECYCLE_V2.md | None detected | No provider reference detected | Internal Dependency |
| docs/PREGAME_EXECUTION_RECOVERY_SLATE_PREWARM_V1.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/PREGAME_REFRESH_LIFECYCLE.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/PREGAME_SCHEDULER_COVERAGE_EXECUTION_TIMING_V1.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/PROBABILITY_PICKS_MULTI_SPORT_AUDIT_V1.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/PROBABILITY_PICKS_V1.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/PROBABILITY_PICKS_V2.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/PRODUCT_EXPERIENCE_DATA_TRUST_AUDIT_V1_CERTIFICATION.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/PRODUCT_NAVIGATION_FRESHNESS_HARDENING_V1.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/product-route-inventory-v1.json | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/product-stabilization-v1-audit.json | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/PRODUCTION_OPERATIONS_PIPELINE.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/PRODUCTION_READINESS_AUDIT.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/PRODUCTION_REFRESH_INFRASTRUCTURE.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/PROJECT_STATUS.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/PUSH_AWARE_OUTCOME_DISTRIBUTION_MARKET_SEMANTICS_V1.md | None detected | No provider reference detected | Internal Dependency |
| docs/RECOMMENDATION_PIPELINE_TRACE_V1.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/refresh-status-contract.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/RELEASES/PLATFORM_CERTIFIED_V1.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/RETROSHEET_HISTORICAL_COVERAGE_INTELLIGENCE_PHASE_1_5.md | None detected | No provider reference detected | Internal Dependency |
| docs/SCHEDULER_RELIABILITY.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/SETTLEMENT_LEARNING_PIPELINE_RECOVERY_V1.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/SETTLEMENT_RECONCILIATION_ENGINE_V2.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/settlement-reconciliation-v1.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/SOCCER_COMPETITION_ACTIVATION_GATE_V1.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/SOCCER_COMPETITION_COMPLETION_PLAN_V1.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/soccer-competition-activation-gate-v1.json | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/SPORTS_CENTER_V1_PRODUCT_EXPERIENCE.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/SPORTS_DATA_SOURCE_REGISTRY_V2.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/SPORTS_DATA_WAREHOUSE_V2.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/SPORTSDATAIO_ENTITLEMENT_DISCOVERY_AND_SAFE_EXTRACTION.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/SPORTSDATAIO_PLAYER_GAME_STATS_ENDPOINT_OPTIMIZATION.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/sportsdataio-historical-import-execution-readiness-v1.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/sportsdataio-nba-pilot-import-v1.md | None detected | Provider or protected endpoint reference detected | Experimental |
| docs/SUPABASE_DISK_IO_RECOVERY_AUDIT_V1.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/SYSTEM_HEALTH_POLICY_V1.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/TENNIS_UFC_EVENT_LIFECYCLE_GATE_V1.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/TENNIS_UFC_EVENT_READINESS_CERTIFICATION_V1.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/tennis-ufc-event-lifecycle-gate-v1.json | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/THE_ODDS_API_CURRENT_ODDS_V1.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/THE_ODDS_API_HISTORICAL_MLB_CORE_IMPORT_V1.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/THE_ODDS_API_MAXIMUM_UTILIZATION_V1_FINAL_CERTIFICATION.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/THE_ODDS_API_MAXIMUM_UTILIZATION_V1.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/THE_ODDS_API_PLAYER_PROPS_V1.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/TRAINING_DATASET_FEATURE_RECERTIFICATION_V1.json | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/ui-intelligence-integrity-refactor-v1.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/UNIVERSAL_EVENT_IDENTITY_MATERIALIZATION_V1.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/universal-event-identity-v1.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/VERCEL_BUILD_MEMORY_PRODUCTION_CERTIFICATION_V1.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/VERCEL_BUILD_MEMORY_RECOVERY_V1.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/vercel-build-memory-recovery-v1-summary.json | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/WEBPACK_DEPENDENCY_GRAPH_AUDIT_V2.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| src/types/multi-sport.ts | @/config/sports.config | Provider or protected endpoint reference detected | Internal Dependency |
| supabase/migrations/202607270001_prediction_epoch_governance_v2.sql | None detected | No provider reference detected | Internal Dependency |
| supabase/migrations/202607270002_prediction_epoch_governance_seed_v1.sql | None detected | No provider reference detected | Internal Dependency |
| docs/PROVIDER_ADAPTER_SDK.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/PROVIDER_BUDGET_POLICY_V1.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/PROVIDER_BUDGET_REFRESH_STRATEGY.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/provider-adapter-sdk-v1.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/provider-intelligence-v1.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| src/services/provider-adapter-sdk.service.ts | @/config/sports.config<br>@/services/multi-sport-normalizers.service<br>@/services/provider-intelligence.service<br>@/types/multi-sport | Provider or protected endpoint reference detected | Internal Dependency |
| src/services/provider-intelligence.service.ts | @/config/sports.config<br>@/services/multi-sport-markets.service<br>@/services/multi-sport-providers.service<br>@/services/multi-sport-registry.service<br>@/types/multi-sport | Provider or protected endpoint reference detected | Internal Dependency |
| src/services/daily-report-fast.service.ts | @/lib/supabase-admin<br>@/services/analysis-explainer.service<br>@/services/clv-analytics.service<br>@/services/current-board.service<br>@/services/model-calibration.service<br>@/services/model-learning.service<br>@/services/production-data-gate.service<br>@/services/top-picks.service | Provider or protected endpoint reference detected | Internal Dependency |
| src/services/daily-report.service.ts | @/services/analysis-explainer.service<br>@/services/bankroll-manager.service<br>@/services/clv-analytics.service<br>@/services/model-calibration.service<br>@/services/model-learning.service<br>@/services/portfolio-builder.service<br>@/services/production-data-gate.service<br>@/services/sportsbook-intelligence.service<br>@/services/top-picks.service | Provider or protected endpoint reference detected | Internal Dependency |
| scripts/ai-model-strategy-v1.mjs | @/lib/supabase-admin<br>node:crypto<br>node:fs | Provider or protected endpoint reference detected | Operational Tool |
| scripts/historical-completion-v1-a1-baseline.mjs | @supabase/supabase-js<br>node:fs | Provider or protected endpoint reference detected | Operational Tool |
| scripts/historical-settled-status-reconciliation-v1.mjs | ../src/lib/supabase-admin.ts<br>../src/services/canonical-settlement-state.service.ts<br>node:fs | Provider or protected endpoint reference detected | Operational Tool |
| scripts/live-multi-sport-acquisition-v1-checkpoint-a.mjs | @/services/data-coverage-inventory.service<br>@/services/multi-sport-data-expansion-final.service<br>@/services/multi-sport-provider-entitlement-audit.service<br>@/services/provider-budget.service<br>node:fs<br>node:path | Provider or protected endpoint reference detected | Operational Tool |
| scripts/live-multi-sport-acquisition-v1-checkpoint-b-mlb.mjs | @/services/data-coverage-inventory.service<br>@/services/provider-budget.service<br>@/services/sportsdataio-mlb-historical-import-executor.service<br>node:fs<br>node:path | Provider or protected endpoint reference detected | Operational Tool |
| scripts/live-multi-sport-acquisition-v1-checkpoint-c-nba-nfl.mjs | @/services/data-coverage-inventory.service<br>@/services/provider-budget.service<br>@/services/sportsdataio-historical-import-readiness.service<br>node:fs<br>node:path | Provider or protected endpoint reference detected | Operational Tool |
| scripts/mlb-canonical-settlement-backlog-closure-v1.mjs | @/lib/supabase-admin<br>@/services/ai-learning-lifecycle.service<br>@/services/operating-day.service<br>node:fs | Provider or protected endpoint reference detected | Operational Tool |
| scripts/mlb-operating-day-product-state-v1.mjs | ../src/services/adaptive-refresh-orchestrator.service.ts<br>../src/services/autonomous-daily-operations.service.ts<br>../src/services/current-board.service.ts<br>../src/services/dashboard-today.service.ts<br>../src/services/recommendation-pipeline-trace.service.ts<br>node:fs | Provider or protected endpoint reference detected | Operational Tool |
| scripts/multi-sport-unlock-v1-checkpoint-c-nfl.mjs | ../src/services/multi-sport-results-crosswalk-foundation.service.ts<br>../src/services/nfl-prediction-engine.service.ts<br>@supabase/supabase-js<br>node:child_process<br>node:fs<br>node:path | Provider or protected endpoint reference detected | Operational Tool |
| scripts/multi-sport-unlock-v1-checkpoint-d-nhl.mjs | ../src/services/multi-sport-results-crosswalk-foundation.service.ts<br>../src/services/nhl-prediction-engine.service.ts<br>@supabase/supabase-js<br>node:child_process<br>node:fs<br>node:path | Provider or protected endpoint reference detected | Operational Tool |
| scripts/multi-sport-unlock-v1-checkpoint-e-soccer.mjs | ../src/services/multi-sport-results-crosswalk-foundation.service.ts<br>../src/services/soccer-feature-store-integration.service.ts<br>../src/services/soccer-prediction-engine.service.ts<br>@supabase/supabase-js<br>node:child_process<br>node:fs<br>node:path | Provider or protected endpoint reference detected | Operational Tool |
| scripts/multi-sport-unlock-v1-checkpoint-f-tennis-ufc.mjs | ../src/services/multi-sport-results-crosswalk-foundation.service.ts<br>../src/services/tennis-feature-store-integration.service.ts<br>../src/services/tennis-prediction-engine.service.ts<br>../src/services/ufc-feature-store-integration.service.ts<br>../src/services/ufc-prediction-engine.service.ts<br>@supabase/supabase-js<br>node:child_process<br>node:fs<br>node:path | Provider or protected endpoint reference detected | Operational Tool |
| scripts/retrosheet-import-client.mjs | fs | Provider or protected endpoint reference detected | Operational Tool |
| scripts/the-odds-api-current-odds-v1.mjs | ../src/services/the-odds-api-current-odds-acquisition.service.ts<br>node:child_process<br>node:fs<br>node:path | Provider or protected endpoint reference detected | Operational Tool |
| scripts/the-odds-api-historical-mlb-core-import-v1.mjs | @supabase/supabase-js<br>node:child_process<br>node:crypto<br>node:fs<br>node:path | Provider or protected endpoint reference detected | Operational Tool |
| scripts/the-odds-api-maximum-utilization-v1-checkpoint1.mjs | ../src/services/the-odds-api-maximum-utilization.service.ts<br>node:child_process<br>node:fs<br>node:path | Provider or protected endpoint reference detected | Operational Tool |
| scripts/the-odds-api-player-props-v1.mjs | @supabase/supabase-js<br>node:child_process<br>node:crypto<br>node:fs<br>node:path | Provider or protected endpoint reference detected | Operational Tool |
| scripts/universal-event-identity-materialize-v1.mjs | @supabase/supabase-js<br>node:crypto<br>node:fs | Provider or protected endpoint reference detected | Operational Tool |
| src/services/adaptive-refresh-orchestrator.service.ts | @/config/mlb-operating-day-scheduler<br>@/lib/supabase-admin<br>@/services/active-event.service<br>@/services/canonical-settlement-state.service<br>@/services/current-board.service<br>@/services/dashboard-today.service<br>@/services/mlb-operating-date-resolution.service<br>@/services/next-slate.service<br>@/services/operating-day-automation.service<br>@/services/operating-day.service | Provider or protected endpoint reference detected | Internal Dependency |
| src/services/ai-bet-finder.service.ts | @/lib/supabase-admin<br>@/services/best-value-scanner.service<br>@/services/bet-slip-optimizer.service<br>@/services/current-board.service<br>@/services/market-intelligence-category.service<br>@/services/market-opportunity-suite.service<br>@/services/provider-time-normalization.service<br>@/services/top-picks.service | Provider or protected endpoint reference detected | Internal Dependency |
| src/services/ai-learning-lifecycle.service.ts | @/lib/supabase-admin<br>@/services/canonical-settlement-state.service<br>@/services/historical-replay-pilot.service<br>@/services/historical-shadow-calibration.service<br>@/services/mlb-first-five-readiness.service<br>@/services/mlb-player-projection-engine.service<br>@/services/mlb-player-props-readiness-audit.service<br>@/services/mlb-starter-intelligence.service<br>@/services/mlb-team-totals-readiness.service<br>@/services/model-calibration.service | Provider or protected endpoint reference detected | Internal Dependency |
| src/services/ai-performance-center.service.ts | @/config/sports.config<br>@/lib/supabase-admin<br>@/services/bsn-model-maturity.service<br>@/services/current-board.service<br>@/services/feature-store-core.service<br>@/services/model-calibration.service<br>@/services/sport-prediction-engine-sdk.service<br>@/services/universal-projection-engine.service | Provider or protected endpoint reference detected | Internal Dependency |
| src/services/autonomous-daily-ai.service.ts | @/services/adaptive-refresh-orchestrator.service<br>@/services/autonomous-daily-operations.service<br>@/services/provider-budget.service | Provider or protected endpoint reference detected | Internal Dependency |
| src/services/autonomous-daily-operations.service.ts | @/lib/supabase-admin<br>@/services/best-bets-today.service<br>@/services/best-value-scanner.service<br>@/services/current-board.service<br>@/services/market-opportunity-suite.service<br>@/services/market-semantics.service<br>@/services/mlb-ai-coach.service<br>@/services/mlb-data-quality.service<br>@/services/mlb-model-platform.service<br>@/services/model-calibration.service | Provider or protected endpoint reference detected | Internal Dependency |
| src/services/basketball-source-framework.service.ts | @/config/sports.config<br>@/services/basketball/connectors/official-bsn-homepage.connector<br>@/types/multi-sport | Provider or protected endpoint reference detected | Internal Dependency |
| src/services/basketball/acquisition/bsn-acquisition-engine.ts | @/lib/supabase-admin<br>@/services/basketball-source-framework.service<br>@/services/basketball/connectors/official-bsn-homepage.connector<br>@/services/basketball/history/historical-builder<br>@/services/basketball/knowledge/knowledge-layer<br>@/services/basketball/normalizers/canonical<br>@/services/basketball/reconciliation/reconciliation-engine<br>@/services/feature-store-core.service<br>@/services/historical-import-engine.service<br>@/services/mlb-event-status-mapper.service | Provider or protected endpoint reference detected | Internal Dependency |
| src/services/basketball/connectors/official-bsn-homepage.connector.ts | @/services/basketball/contracts/capabilities | Provider or protected endpoint reference detected | Internal Dependency |
| src/services/basketball/contracts/capabilities.ts | @/config/sports.config | Provider or protected endpoint reference detected | Internal Dependency |
| src/services/basketball/history/bsn-historical-reconstruction.ts | @/lib/supabase-admin<br>@/services/basketball-source-framework.service<br>@/services/basketball/builders/platform.service<br>@/services/basketball/history/historical-builder<br>@/services/basketball/knowledge/knowledge-layer<br>@/services/bsn-platform.service<br>@/services/feature-store-core.service<br>@/services/sport-prediction-engine-sdk.service | Provider or protected endpoint reference detected | Internal Dependency |
| src/services/basketball/normalizers/canonical.ts | @/config/sports.config<br>@/services/basketball/contracts/capabilities<br>@/services/basketball/types/entities<br>@/services/basketball/validators/data-quality | Provider or protected endpoint reference detected | Internal Dependency |
| src/services/basketball/reconciliation/reconciliation-engine.ts | @/services/basketball/types/entities<br>@/services/basketball/validators/data-quality | No provider reference detected | Internal Dependency |
| src/services/basketball/types/entities.ts | @/config/sports.config<br>@/services/basketball/contracts/capabilities | Provider or protected endpoint reference detected | Internal Dependency |
| src/services/best-bets-today.service.ts | @/services/current-board.service<br>@/services/market-alignment.service<br>@/services/market-intelligence-category.service<br>@/services/market-semantics.service | Provider or protected endpoint reference detected | Internal Dependency |
| src/services/best-value-scanner.service.ts | @/services/current-board.service<br>@/services/explainable-intelligence.service<br>@/services/market-intelligence-category.service<br>@/services/provider-time-normalization.service | Provider or protected endpoint reference detected | Internal Dependency |
| src/services/bsn-core-certification.service.ts | @/services/bsn-intelligence-engine.service<br>@/services/bsn-model-maturity.service<br>@/services/bsn-platform.service<br>@/services/bsn-shadow-prediction-engine.service<br>@/services/market-alignment.service<br>@/services/market-semantics.service<br>@/services/mlb-ai-picks-feed.service<br>@/services/official-pick-experience.service<br>@/services/recommendation-explanation.service<br>@/services/sport-prediction-engine-sdk.service | Provider or protected endpoint reference detected | Internal Dependency |
| src/services/bsn-historical-foundation-v2.service.ts | @/lib/supabase-admin<br>@/services/data-foundation-coverage.service | Provider or protected endpoint reference detected | Internal Dependency |
| src/services/bsn-platform.service.ts | @/lib/supabase-admin<br>@/services/basketball-source-framework.service | Provider or protected endpoint reference detected | Internal Dependency |
| src/services/bsn-shadow-prediction-engine.service.ts | @/lib/supabase-admin<br>@/services/basketball/builders/platform.service<br>@/services/basketball/history/historical-builder<br>@/services/bsn-intelligence-engine.service<br>@/services/feature-store-core.service<br>@/services/sport-prediction-engine-sdk.service | Provider or protected endpoint reference detected | Experimental |
| src/services/bsn.service.ts | @/lib/supabase-admin | Provider or protected endpoint reference detected | Internal Dependency |
| src/services/canonical-settlement-state.service.ts | @/services/prediction-cutoff-enforcement.service | Provider or protected endpoint reference detected | Internal Dependency |
| src/services/current-board.service.ts | @/lib/server-schema-capabilities<br>@/lib/supabase-admin<br>@/services/active-event.service<br>@/services/explainable-intelligence.service<br>@/services/market-alignment.service<br>@/services/market-intelligence-category.service<br>@/services/market-semantics.service<br>@/services/mlb-ai-picks-feed.service<br>@/services/mlb-current-lineup-context.service<br>@/services/mlb-starter-weather-stadium-intelligence.service | Provider or protected endpoint reference detected | Internal Dependency |
| src/services/daily-pipeline.service.ts | @/config/sports.config<br>@/services/historical-feature-generation.service<br>@/services/nba-data-quality.service<br>@/services/nba-data-sync.service<br>@/services/nba-feature-store-integration.service<br>@/services/nba-prediction-engine.service<br>@/services/nba-prediction-settlement.service<br>@/services/prediction-history.service<br>@/services/results-sync.service<br>@/services/sync-reliability.service | Provider or protected endpoint reference detected | Internal Dependency |
| src/services/data-coverage-inventory.service.ts | @/services/data-foundation-coverage.service | Provider or protected endpoint reference detected | Internal Dependency |
| src/services/data-foundation-import-orchestrator.service.ts | @/services/historical-import-engine.service | Provider or protected endpoint reference detected | Internal Dependency |
| src/services/day1-recommendation-readiness.service.ts | @/services/bet-slip-optimizer.service<br>@/services/current-board.service<br>@/services/recommendation-eligibility-policy.service<br>@/services/top-picks.service | Provider or protected endpoint reference detected | Internal Dependency |
| src/services/feature-store-core.service.ts | @/config/sports.config<br>@/services/production-data-gate.service<br>@/types/multi-sport | Provider or protected endpoint reference detected | Internal Dependency |
| src/services/future-only-prediction-continuity-v2.service.ts | @/lib/supabase-admin<br>@/services/prediction-epoch-migration-state.service | Provider or protected endpoint reference detected | Internal Dependency |
| src/services/global-data-quality.service.ts | @/config/sports.config<br>@/lib/supabase-admin<br>@/services/multi-sport-registry.service<br>@/services/provider-intelligence.service | Provider or protected endpoint reference detected | Internal Dependency |
| src/services/historical-feature-generation.service.ts | @/config/sports.config<br>@/lib/server-schema-capabilities<br>@/lib/supabase-admin<br>@/services/feature-store-core.service<br>@/services/multi-sport-feature-registry.service<br>@/services/nba-prediction-settlement.service<br>@/services/settlement-core.service<br>@/services/sport-prediction-engine-sdk.service<br>@/types/multi-sport | Provider or protected endpoint reference detected | Internal Dependency |
| src/services/historical-import-engine.service.ts | @/config/sports.config<br>@/lib/server-schema-capabilities<br>@/lib/supabase-admin<br>@/services/historical-feature-generation.service<br>@/services/multi-sport-registry.service<br>@/services/provider-intelligence.service<br>@/services/sync-reliability.service | Provider or protected endpoint reference detected | Internal Dependency |
| src/services/historical-replay-pilot.service.ts | @/lib/supabase-admin<br>@/services/settlement-core.service<br>crypto | Provider or protected endpoint reference detected | Experimental |
| src/services/live-provider-verification.service.ts | @/config/sportsdataio-endpoint-catalog<br>@/lib/supabase-admin<br>@/services/basketball/connectors/official-bsn-homepage.connector<br>@/services/sportsdataio-discovery-lab-url.service<br>@/services/universal-projection-engine.service | Provider or protected endpoint reference detected | Internal Dependency |
| src/services/market-intelligence-engine.service.ts | @/services/best-value-scanner.service<br>@/services/current-board.service<br>@/services/market-intelligence-category.service<br>@/services/market-opportunity-suite.service | Provider or protected endpoint reference detected | Internal Dependency |
| src/services/market-opportunity-suite.service.ts | @/lib/supabase-admin<br>@/services/current-board.service<br>@/services/explainable-intelligence.service<br>@/services/market-intelligence-category.service<br>@/services/market-semantics.service<br>@/services/model-only-intelligence.service<br>@/services/provider-time-normalization.service | Provider or protected endpoint reference detected | Internal Dependency |
| src/services/master-sync.service.ts | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| src/services/missing-canonical-events-recovery.service.ts | @/lib/supabase-admin | Provider or protected endpoint reference detected | Internal Dependency |
| src/services/mlb-ai-coach.service.ts | @/services/best-bets-today.service<br>@/services/current-board.service<br>@/services/market-opportunity-suite.service<br>@/services/mlb-data-quality.service<br>@/services/mlb-games-payload-audit.service<br>@/services/mlb-missing-intelligence.service<br>@/services/mlb-model-platform.service<br>@/services/mlb-provider-capability-audit.service<br>@/services/mlb-starter-weather-stadium-intelligence.service | Provider or protected endpoint reference detected | Internal Dependency |
| src/services/mlb-ai-picks-feed.service.ts | @/services/current-board.service<br>@/services/explainable-intelligence.service<br>@/services/market-semantics.service<br>@/services/official-pick-experience.service | Provider or protected endpoint reference detected | Internal Dependency |
| src/services/mlb-autonomous-operations-v1.service.ts | @/config/mlb-operating-day-scheduler<br>@/services/adaptive-refresh-orchestrator.service<br>@/services/operations-health.service<br>@/services/provider-budget.service | Provider or protected endpoint reference detected | Internal Dependency |
| src/services/mlb-current-lineup-context.service.ts | @/lib/supabase-admin<br>@/services/active-event.service<br>@/services/mlb-starter-intelligence.service | Provider or protected endpoint reference detected | Internal Dependency |
| src/services/mlb-current-season-data-quality-audit.service.ts | @/lib/supabase-admin<br>@/services/mlb-current-season-backfill-orchestrator.service | Provider or protected endpoint reference detected | Internal Dependency |
| src/services/mlb-data-quality.service.ts | @/services/current-board.service<br>@/services/mlb-games-payload-audit.service<br>@/services/mlb-missing-intelligence.service<br>@/services/mlb-model-platform.service<br>@/services/mlb-odds-coverage.service<br>@/services/mlb-starter-weather-stadium-intelligence.service | Provider or protected endpoint reference detected | Internal Dependency |
| src/services/mlb-event-status-mapper.service.ts | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| src/services/mlb-feature-model-readiness.service.ts | @/services/mlb-current-season-data-quality-audit.service<br>@/services/mlb-feature-store-integration.service | Provider or protected endpoint reference detected | Internal Dependency |
| src/services/mlb-first-five-readiness.service.ts | @/lib/supabase-admin<br>@/services/market-semantics.service<br>@/services/mlb-starter-intelligence.service | Provider or protected endpoint reference detected | Internal Dependency |
| src/services/mlb-freshness-policy.service.ts | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| src/services/mlb-game-lifecycle.service.ts | @/services/provider-time-normalization.service | Provider or protected endpoint reference detected | Internal Dependency |
| src/services/mlb-games-payload-audit.service.ts | @/lib/supabase-admin<br>@/services/provider-time-normalization.service<br>@/types/sportsdataio-mlb | Provider or protected endpoint reference detected | Internal Dependency |
| src/services/mlb-historical-foundation-v2.service.ts | @/lib/supabase-admin<br>@/services/data-foundation-coverage.service | Provider or protected endpoint reference detected | Internal Dependency |
| src/services/mlb-learning-brain.service.ts | @/lib/supabase-admin<br>@/services/active-event.service<br>@/services/mlb-projection-integrity.service<br>crypto | Provider or protected endpoint reference detected | Internal Dependency |
| src/services/mlb-market-expansion-roadmap.service.ts | @/config/sportsdataio-endpoint-catalog<br>@/services/mlb-odds-coverage.service<br>@/services/production-readiness-audit.service | Provider or protected endpoint reference detected | Internal Dependency |
| src/services/mlb-market-pipeline-diagnostics.service.ts | @/lib/supabase-admin<br>@/services/current-board.service<br>@/services/provider-time-normalization.service | Provider or protected endpoint reference detected | Experimental |
| src/services/mlb-missing-intelligence.service.ts | @/config/sportsdataio-endpoint-catalog<br>@/lib/supabase-admin<br>@/services/mlb-model-platform.service<br>@/services/mlb-starter-weather-stadium-intelligence.service<br>@/services/provider-budget.service<br>@/services/sportsdataio-discovery-lab-url.service | Provider or protected endpoint reference detected | Internal Dependency |
| src/services/mlb-odds-coverage.service.ts | @/lib/supabase-admin<br>@/services/current-board.service<br>@/services/provider-time-normalization.service | Provider or protected endpoint reference detected | Internal Dependency |
| src/services/mlb-operating-date-resolution.service.ts | @/lib/supabase-admin<br>@/services/active-event.service<br>@/services/mlb-game-lifecycle.service<br>@/services/provider-time-normalization.service | Provider or protected endpoint reference detected | Internal Dependency |
| src/services/mlb-operations-center.service.ts | @/services/autonomous-daily-operations.service<br>@/services/current-board.service<br>@/services/mlb-data-quality.service<br>@/services/mlb-missing-intelligence.service<br>@/services/mlb-prediction-engine.service<br>@/services/operating-day-automation.service<br>@/services/operating-day.service<br>@/services/provider-budget.service | Provider or protected endpoint reference detected | Internal Dependency |
| src/services/mlb-player-projection-engine.service.ts | @/lib/supabase-admin<br>@/services/active-event.service<br>@/services/mlb-current-lineup-context.service<br>@/services/universal-projection-engine.service | Provider or protected endpoint reference detected | Internal Dependency |
| src/services/mlb-player-prop-sync.service.ts | @/config/mlb-player-prop-markets<br>@/config/sportsdataio-endpoint-catalog<br>@/lib/supabase-admin<br>@/services/mlb-pitcher-projection-engine.service<br>@/services/provider-budget.service<br>@/services/the-odds-api-event-crosswalk.service<br>@/services/the-odds-api-pitcher-identity-bridge.service<br>@/types/mlb-player-prop-ingestion<br>crypto | Provider or protected endpoint reference detected | Internal Dependency |
| src/services/mlb-player-props-foundation.service.ts | @/config/sportsdataio-endpoint-catalog<br>@/lib/supabase-admin<br>@/services/sportsdataio-runtime-adapter.service | Provider or protected endpoint reference detected | Internal Dependency |
| src/services/mlb-player-props-readiness-audit.service.ts | @/lib/supabase-admin | Provider or protected endpoint reference detected | Internal Dependency |
| src/services/mlb-projected-score.service.ts | @/services/current-board.service | Provider or protected endpoint reference detected | Internal Dependency |
| src/services/mlb-provider-capability-audit.service.ts | @/config/sportsdataio-endpoint-catalog<br>@/services/mlb-data-quality.service<br>@/types/sportsdataio-mlb | Provider or protected endpoint reference detected | Internal Dependency |
| src/services/mlb-starter-intelligence.service.ts | @/lib/supabase-admin<br>@/services/active-event.service<br>@/services/mlb-starter-weather-stadium-intelligence.service | Provider or protected endpoint reference detected | Internal Dependency |
| src/services/mlb-starter-weather-stadium-intelligence.service.ts | @/lib/supabase-admin<br>@/services/provider-time-normalization.service | Provider or protected endpoint reference detected | Internal Dependency |
| src/services/mlb-team-totals-readiness.service.ts | @/lib/supabase-admin<br>@/services/market-semantics.service | Provider or protected endpoint reference detected | Internal Dependency |
| src/services/mlb-temporal-health.service.ts | @/lib/supabase-admin<br>@/services/active-event.service<br>@/services/adaptive-refresh-orchestrator.service<br>@/services/current-board.service<br>@/services/mlb-freshness-policy.service<br>@/services/mlb-game-lifecycle.service<br>@/services/provider-time-normalization.service<br>@/services/universal-projection-engine.service | Provider or protected endpoint reference detected | Internal Dependency |
| src/services/model-only-intelligence.service.ts | @/lib/supabase-admin | Provider or protected endpoint reference detected | Internal Dependency |
| src/services/multi-sport-adapters.service.ts | @/config/sports.config<br>@/services/bsn-platform.service<br>@/services/bsn.service<br>@/services/multi-sport-normalizers.service<br>@/services/multi-sport-registry.service<br>@/services/nba-adapter.service<br>@/types/multi-sport | Provider or protected endpoint reference detected | Internal Dependency |
| src/services/multi-sport-data-expansion-checkpoint2.service.ts | @/services/data-coverage-inventory.service<br>@/services/historical-import-engine.service<br>@/services/multi-sport-provider-entitlement-audit.service<br>@/services/provider-intelligence.service | Provider or protected endpoint reference detected | Internal Dependency |
| src/services/multi-sport-data-expansion-checkpoint3.service.ts | @/services/data-coverage-inventory.service<br>@/services/historical-import-engine.service<br>@/services/multi-sport-provider-entitlement-audit.service<br>@/services/provider-intelligence.service | Provider or protected endpoint reference detected | Internal Dependency |
| src/services/multi-sport-data-expansion-final.service.ts | @/services/data-coverage-inventory.service<br>@/services/multi-sport-data-expansion-checkpoint2.service<br>@/services/multi-sport-data-expansion-checkpoint3.service<br>@/services/multi-sport-provider-entitlement-audit.service | Provider or protected endpoint reference detected | Internal Dependency |
| src/services/multi-sport-feature-registry.service.ts | @/config/sports.config<br>@/services/feature-store-core.service<br>@/types/multi-sport | Provider or protected endpoint reference detected | Internal Dependency |
| src/services/multi-sport-normalizers.service.ts | @/config/sports.config<br>@/types/multi-sport | Provider or protected endpoint reference detected | Internal Dependency |
| src/services/multi-sport-provider-entitlement-audit.service.ts | @/services/multi-sport-providers.service<br>@/services/provider-intelligence.service<br>@/services/sportsdataio-subscription-maximization-audit.service<br>@/services/the-odds-api-capability-audit.service | Provider or protected endpoint reference detected | Internal Dependency |
| src/services/multi-sport-providers.service.ts | @/config/sports.config<br>@/types/multi-sport | Provider or protected endpoint reference detected | Internal Dependency |
| src/services/multi-sport-query.service.ts | @/config/sports.config<br>@/services/multi-sport-markets.service<br>@/services/multi-sport-providers.service<br>@/services/multi-sport-registry.service<br>@/services/multi-sport-resolution.service<br>@/types/multi-sport | Provider or protected endpoint reference detected | Internal Dependency |
| src/services/nba-data-quality.service.ts | @/lib/supabase-admin<br>@/services/nba-data-sync.service<br>@/services/nba-prediction-validation.service | Provider or protected endpoint reference detected | Internal Dependency |
| src/services/nba-data-sync.service.ts | @/lib/supabase-admin<br>@/services/historical-feature-generation.service<br>@/services/mlb-event-status-mapper.service<br>@/services/multi-sport-health.service<br>@/services/multi-sport-query.service<br>@/services/results-sync.service<br>@/types/multi-sport | Provider or protected endpoint reference detected | Internal Dependency |
| src/services/nba-historical-foundation-v2.service.ts | @/lib/supabase-admin<br>@/services/data-foundation-coverage.service | Provider or protected endpoint reference detected | Internal Dependency |
| src/services/nba-prediction-engine.service.ts | @/lib/supabase-admin<br>@/services/adaptive-scoring.service<br>@/services/adaptive-weight-engine.service<br>@/services/kelly.service<br>@/services/model-learning.service<br>@/services/nba-data-sync.service<br>@/services/nba-injury-lineup-confidence.service<br>@/services/nba-prediction-validation.service<br>@/services/prediction-history.service<br>@/services/risk-grade.service | Provider or protected endpoint reference detected | Internal Dependency |
| src/services/next-slate.service.ts | @/lib/supabase-admin<br>@/services/active-event.service<br>@/services/provider-time-normalization.service | Provider or protected endpoint reference detected | Internal Dependency |
| src/services/nfl-historical-foundation-v2.service.ts | @/lib/supabase-admin<br>@/services/data-foundation-coverage.service | Provider or protected endpoint reference detected | Internal Dependency |
| src/services/nhl-historical-foundation-v2.service.ts | @/lib/supabase-admin<br>@/services/data-foundation-coverage.service | Provider or protected endpoint reference detected | Internal Dependency |
| src/services/official-pick-experience.service.ts | @/services/current-board.service<br>@/services/market-alignment.service<br>@/services/market-semantics.service<br>@/services/recommendation-eligibility-policy.service<br>@/services/recommendation-explanation.service | Provider or protected endpoint reference detected | Internal Dependency |
| src/services/operating-day-automation.service.ts | @/lib/supabase-admin<br>@/services/current-board.service<br>@/services/mlb-game-lifecycle.service<br>@/services/mlb-operating-date-resolution.service<br>@/services/next-slate.service<br>@/services/operating-day.service<br>@/services/provider-budget.service<br>@/services/provider-time-normalization.service | Provider or protected endpoint reference detected | Internal Dependency |
| src/services/operating-day.service.ts | @/lib/supabase-admin<br>@/services/best-value-scanner.service<br>@/services/bet-slip-optimizer.service<br>@/services/current-board.service<br>@/services/day1-recommendation-readiness.service<br>@/services/market-intelligence-engine.service<br>@/services/market-opportunity-suite.service<br>@/services/mlb-event-status-mapper.service<br>@/services/mlb-operating-date-resolution.service<br>@/services/model-calibration.service | Provider or protected endpoint reference detected | Internal Dependency |
| src/services/operations-health.service.ts | @/config/mlb-operating-day-scheduler<br>@/lib/supabase-admin<br>@/services/active-event.service<br>@/services/adaptive-refresh-orchestrator.service<br>@/services/current-board.service<br>@/services/mlb-game-lifecycle.service<br>@/services/provider-budget.service<br>@/services/provider-time-normalization.service<br>@/services/universal-projection-engine.service | Provider or protected endpoint reference detected | Internal Dependency |
| src/services/performance-scope-v2.service.ts | @/lib/supabase-admin<br>@/services/canonical-settlement-state.service<br>@/services/prediction-cutoff-enforcement.service<br>@/services/pregame-scheduler-coverage.service<br>@/services/provider-time-normalization.service | Provider or protected endpoint reference detected | Internal Dependency |
| src/services/prediction-epoch-shadow-readiness.service.ts | @/lib/supabase-admin<br>@/services/prediction-epoch-migration-state.service | Provider or protected endpoint reference detected | Experimental |
| src/services/prediction-history.service.ts | @/lib/supabase-admin<br>@/services/mlb-starter-weather-stadium-intelligence.service<br>@/services/next-slate.service<br>@/services/prediction-cutoff-enforcement.service<br>@/services/production-data-gate.service<br>@/services/recommendation-eligibility-policy.service | Provider or protected endpoint reference detected | Internal Dependency |
| src/services/prediction-safety.service.ts | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| src/services/pregame-scheduler-coverage.service.ts | @/lib/supabase-admin<br>@/services/mlb-operating-date-resolution.service<br>@/services/prediction-cutoff-enforcement.service<br>@/services/provider-time-normalization.service | Provider or protected endpoint reference detected | Internal Dependency |
| src/services/production-readiness-audit.service.ts | @/lib/supabase-admin<br>@/services/active-event.service<br>@/services/adaptive-refresh-orchestrator.service<br>@/services/ai-performance-center.service<br>@/services/current-board.service<br>@/services/dashboard-today.service<br>@/services/market-intelligence-category.service<br>@/services/mlb-market-capability-registry.service<br>@/services/top-picks.service | Provider or protected endpoint reference detected | Internal Dependency |
| src/services/prospective-official-eligibility-gate.service.ts | @/lib/supabase-admin<br>@/services/current-board.service<br>@/services/market-alignment.service<br>@/services/market-semantics.service<br>@/services/recommendation-eligibility-policy.service | Provider or protected endpoint reference detected | Internal Dependency |
| src/services/recommendation-pipeline-trace.service.ts | @/lib/supabase-admin<br>@/services/current-board.service<br>@/services/model-only-intelligence.service<br>@/services/prediction-cutoff-enforcement.service<br>@/services/pregame-scheduler-coverage.service<br>@/services/provider-time-normalization.service | Provider or protected endpoint reference detected | Internal Dependency |
| src/services/results-sync.service.ts | @/lib/supabase-admin<br>@/services/mlb-event-status-mapper.service<br>@/services/provider-budget.service<br>@/services/provider-time-normalization.service | Provider or protected endpoint reference detected | Internal Dependency |
| src/services/retrosheet-historical-feature-store.service.ts | @/lib/supabase-admin<br>crypto | Provider or protected endpoint reference detected | Internal Dependency |
| src/services/settlement-core.service.ts | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| src/services/settlement-guarantee.service.ts | @/lib/supabase-admin<br>@/services/canonical-settlement-state.service<br>@/services/operations-health.service<br>@/services/provider-time-normalization.service | Provider or protected endpoint reference detected | Internal Dependency |
| src/services/settlement-reconciliation.service.ts | @/lib/supabase-admin<br>@/services/legacy-prediction-provenance.service<br>@/services/prediction-cutoff-enforcement.service<br>@/services/settlement-core.service | Provider or protected endpoint reference detected | Internal Dependency |
| src/services/sportsdataio-adapter-contract.service.ts | @/services/multi-sport-normalizers.service<br>@/services/provider-adapter-sdk.service<br>@/types/multi-sport | Provider or protected endpoint reference detected | Internal Dependency |
| src/services/sportsdataio-historical-import-readiness.service.ts | @/config/sports.config<br>@/lib/supabase-admin<br>@/services/mlb-event-status-mapper.service<br>@/services/nba-data-quality.service<br>@/services/nba-feature-store-integration.service<br>@/services/nba-injury-lineup-confidence.service<br>@/services/nba-multi-book-comparison.service<br>@/services/nba-steam-move-detection.service<br>@/services/safe-supabase-preflight.service<br>@/services/sportsdataio-betting-normalizer.service | Provider or protected endpoint reference detected | Internal Dependency |
| src/services/sportsdataio-mlb-discovery.service.ts | @/config/sportsdataio-endpoint-catalog<br>@/lib/supabase-admin<br>@/services/mlb-provider-capability-audit.service | Provider or protected endpoint reference detected | Internal Dependency |
| src/services/sportsdataio-mlb-historical-import-executor.service.ts | @/lib/supabase-admin<br>@/services/mlb-event-status-mapper.service<br>@/services/provider-budget.service<br>@/services/provider-time-normalization.service<br>@/services/safe-supabase-preflight.service<br>@/services/sportsdataio-discovery-lab-url.service<br>@/services/sportsdataio-mlb-normalization.service<br>@/services/sync-reliability.service | Provider or protected endpoint reference detected | Internal Dependency |
| src/services/sportsdataio-mlb-prospective-preview.service.ts | @/lib/server-schema-capabilities<br>@/lib/supabase-admin<br>@/services/feature-store-core.service<br>@/services/mlb-event-status-mapper.service<br>@/services/mlb-missing-intelligence.service<br>@/services/mlb-starter-weather-stadium-intelligence.service<br>@/services/prediction-cutoff-enforcement.service<br>@/services/provider-time-normalization.service<br>@/services/recommendation-eligibility-policy.service<br>@/services/sport-prediction-engine-sdk.service | Provider or protected endpoint reference detected | Experimental |
| src/services/sportsdataio-runtime-adapter.service.ts | @/config/sports.config<br>@/services/multi-sport-normalizers.service<br>@/services/provider-adapter-sdk.service<br>@/services/sportsdataio-adapter-contract.service<br>@/services/sportsdataio-betting-normalizer.service<br>@/services/sync-reliability.service<br>@/types/multi-sport | Provider or protected endpoint reference detected | Internal Dependency |
| src/services/sportsdataio-subscription-maximization-audit.service.ts | @/config/sportsdataio-endpoint-catalog<br>@/lib/supabase-admin<br>@/services/provider-budget.service<br>@/services/sportsdataio-runtime-adapter.service | Provider or protected endpoint reference detected | Internal Dependency |
| src/services/stored-preview-prediction-lifecycle.service.ts | @/lib/supabase-admin<br>@/services/feature-store-core.service<br>@/services/prediction-cutoff-enforcement.service<br>@/services/settlement-reconciliation.service<br>@/services/sport-prediction-engine-sdk.service<br>@/types/multi-sport<br>crypto | Provider or protected endpoint reference detected | Experimental |
| src/services/the-odds-api-event-crosswalk.service.ts | @/lib/supabase-admin<br>crypto | Provider or protected endpoint reference detected | Internal Dependency |
| src/services/the-odds-api-pitcher-identity-bridge.service.ts | @/lib/supabase-admin<br>@/services/the-odds-api-event-crosswalk.service | Provider or protected endpoint reference detected | Internal Dependency |
| src/services/training-feature-governance-v1.service.ts | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| src/services/universal-event-identity.service.ts | @/lib/supabase-admin | Provider or protected endpoint reference detected | Internal Dependency |
| src/services/universal-projection-engine.service.ts | @/lib/supabase-admin<br>@/services/active-event.service<br>@/services/feature-store-core.service<br>@/services/mlb-current-lineup-context.service<br>@/services/mlb-game-lifecycle.service<br>@/services/mlb-projection-integrity.service<br>@/services/mlb-starter-intelligence.service<br>@/services/mlb-starter-weather-stadium-intelligence.service<br>@/services/sport-prediction-engine-sdk.service | Provider or protected endpoint reference detected | Internal Dependency |
| docs/FEATURE_ALIAS_MAP_V1.json | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/MLB_GAME_LIFECYCLE.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/MLB_MARKET_DATA_REQUIREMENTS.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/MLB_PLAYER_PROP_MARKET_COMPARISON_V1.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/MLB_PROVIDER_USAGE_OBSERVED_V1.json | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/MLB_REFRESH_CADENCE_OBSERVED_V1.json | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/mlb-player-catalog-completion.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/OPERATIONAL_LAUNCH_REPAIR_ROADMAP_V1.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/PICK_ANALYZER_V1_POST_RELEASE_OPERATIONS.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/SPORTSDATAIO_DISCOVERY_INTEGRATION.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/THE_ODDS_API_FREE_TIER_CAPABILITY_AUDIT_V1.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| src/config/sportsdataio-endpoint-catalog.ts | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/api-contract-hardening-v1.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/ARCHITECTURE/README.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/bsn-data-source-inventory.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/CERTIFICATION/README.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/event-identity-evidence-contract.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/event-import-recovery-contract.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/FEATURE_PRIORITY_MATRIX.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/FEATURE_SIGNAL_MATRIX.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/MLB_CANONICAL_EVENT_STATUS_STALE_SLATE_TEMPORAL_REPAIR_V1.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/MLB_HISTORICAL_IMPORT_DURABILITY_AND_OBSERVABILITY.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/MLB_PITCHER_DATA_AUDIT_V1.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/MLB_PITCHER_PROJECTION_ENGINE_V1.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/MLB_PLAYER_PROP_INGESTION_V1.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/MLB_RUNTIME_ACTIVATION_COMPLETION.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/MLB_STARTER_SYNC_V1.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/mlb-auto-player-discovery.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/PICK_ANALYZER_V1_LIMITATIONS.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/RELEASES/RELEASE_01_BACKLOG.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/SPORTSDATAIO_MLB_DATA_MAXIMIZATION_BUDGET_FIX_AND_CONTROLLED_EXTRACTION.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/SPORTSDATAIO_SUBSCRIPTION_MAXIMIZATION_AUDIT.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/sportsdataio-adapter-contract-v1.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/THE_ODDS_API_PITCHER_IDENTITY_BRIDGE_V1.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| docs/vercel-deployment-recovery.md | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| src/config/mlb-operating-day-scheduler.ts | None detected | No provider reference detected | Internal Dependency |
| supabase/migrations/202607110001_nba_data_sync_v1.sql | None detected | Provider or protected endpoint reference detected | Internal Dependency |
| scripts/autonomous-daily-ai-v1-validate.mjs | node:fs | Provider or protected endpoint reference detected | Operational Tool |
| scripts/feature-intelligence-signal-quality-leakage-audit-v1.mjs | @/lib/supabase-admin<br>node:crypto<br>node:fs | Provider or protected endpoint reference detected | Operational Tool |
| scripts/full-platform-audit-v1.mjs | @/lib/supabase-admin<br>node:fs<br>node:path | Provider or protected endpoint reference detected | Operational Tool |
| scripts/historical-completion-v1-b1-mlb-plan-validate.mjs | node:fs | Provider or protected endpoint reference detected | Operational Tool |
| scripts/historical-completion-v1-c2-nba-result-stat-plan-validate.mjs | node:fs | Provider or protected endpoint reference detected | Operational Tool |
| scripts/historical-completion-v1-f1-soccer-competition-plan-validate.mjs | node:fs | Provider or protected endpoint reference detected | Operational Tool |
| scripts/historical-settled-status-reconciliation-v1-validate.mjs | node:fs | Provider or protected endpoint reference detected | Operational Tool |
| scripts/live-multi-sport-acquisition-v1-final-certify.mjs | @/services/data-coverage-inventory.service<br>@/services/multi-sport-data-expansion-final.service<br>node:fs<br>node:path | Provider or protected endpoint reference detected | Operational Tool |
| scripts/mlb-autonomous-operations-v1-validate.mjs | node:fs | Provider or protected endpoint reference detected | Operational Tool |
| scripts/mlb-july29-terminal-recovery-v1-validate.mjs | node:fs | Provider or protected endpoint reference detected | Operational Tool |
| scripts/mlb-operating-day-odds-audit-v1.mjs | @supabase/supabase-js<br>node:fs | Provider or protected endpoint reference detected | Operational Tool |
| scripts/multi-sport-unlock-v1-final-certify.mjs | ../src/services/settlement-core.service.ts<br>@supabase/supabase-js<br>node:child_process<br>node:fs<br>node:path | Provider or protected endpoint reference detected | Operational Tool |
| scripts/operational-readiness-multisport-audit-v1.mjs | @/lib/supabase-admin<br>node:crypto<br>node:fs | Provider or protected endpoint reference detected | Operational Tool |
| scripts/performance-api-query-optimization-v1-validate.mjs | node:fs | Provider or protected endpoint reference detected | Operational Tool |
| scripts/pick-analyzer-v2-phase-a3-scheduler-freshness-validate.mjs | node:child_process<br>node:fs<br>node:path | Provider or protected endpoint reference detected | Operational Tool |
| scripts/pick-analyzer-v2-phase-a4-ui-state-validate.mjs | node:child_process<br>node:fs<br>node:path | Provider or protected endpoint reference detected | Operational Tool |
| scripts/pick-analyzer-v2-phase-a5-api-query-performance-validate.mjs | node:child_process<br>node:fs<br>node:path | Provider or protected endpoint reference detected | Operational Tool |
| scripts/pick-analyzer-v2-phase-a6-build-reliability-validate.mjs | @/services/data-coverage-inventory.service<br>@/services/multi-sport-data-expansion-checkpoint2.service<br>@/services/multi-sport-data-expansion-checkpoint3.service<br>@/services/multi-sport-data-expansion-final.service<br>@/services/multi-sport-provider-entitlement-audit.service<br>@/services/the-odds-api-maximum-utilization.service<br>node:child_process<br>node:fs<br>node:path | Provider or protected endpoint reference detected | Operational Tool |
| scripts/pick-analyzer-v2-phase-b2-today-experience-validate.mjs | node:child_process<br>node:fs<br>node:path | Provider or protected endpoint reference detected | Operational Tool |
| scripts/pick-analyzer-v2-phase-b3-best-opportunity-readiness-validate.mjs | node:child_process<br>node:fs<br>node:path | Provider or protected endpoint reference detected | Operational Tool |
| scripts/pick-analyzer-v2-phase-b4-decision-dashboard-experience-validate.mjs | node:child_process<br>node:fs<br>node:path | Provider or protected endpoint reference detected | Operational Tool |
| scripts/pick-analyzer-v2-phase-b5-1-mobile-opportunity-navigation-validate.mjs | node:child_process<br>node:fs<br>node:path | Provider or protected endpoint reference detected | Operational Tool |
| scripts/pick-analyzer-v2-phase-b5-ai-decision-explanation-validate.mjs | node:child_process<br>node:fs<br>node:path | Provider or protected endpoint reference detected | Operational Tool |
| scripts/pick-analyzer-v2-phase-b6-1-live-freshness-budget-validate.mjs | node:child_process<br>node:fs<br>node:path | Provider or protected endpoint reference detected | Operational Tool |
| scripts/pick-analyzer-v2-phase-b6-mobile-decision-experience-validate.mjs | node:child_process<br>node:fs<br>node:path | Provider or protected endpoint reference detected | Operational Tool |
| scripts/pick-analyzer-v2-phase-c1-1-external-scheduler-recovery-validate.mjs | @/services/operations-health.service<br>node:fs<br>node:path | Provider or protected endpoint reference detected | Operational Tool |
| scripts/pick-analyzer-v2-phase-c1-daily-betting-settlement-validate.mjs | node:child_process<br>node:fs<br>node:path | Provider or protected endpoint reference detected | Operational Tool |
| scripts/prediction-epoch-shadow-readiness-v1-validate.mjs | @/services/prediction-epoch-shadow-readiness.service<br>node:fs | Provider or protected endpoint reference detected | Experimental |
| scripts/probability-picks-v2-validate.mjs | node:child_process<br>node:fs<br>node:path | Provider or protected endpoint reference detected | Operational Tool |
| scripts/product-audit-v1-final-certify.mjs | node:child_process<br>node:fs | Provider or protected endpoint reference detected | Operational Tool |
| scripts/product-audit-v1-route-inventory.mjs | node:child_process<br>node:fs<br>node:path | Provider or protected endpoint reference detected | Operational Tool |
| scripts/product-stabilization-v1-audit.mjs | node:child_process<br>node:fs<br>node:path | Provider or protected endpoint reference detected | Operational Tool |
| scripts/release01-product-runtime-audit-generate.mjs | node:fs<br>node:path | Provider or protected endpoint reference detected | Operational Tool |
| scripts/release01-product-runtime-audit-validate.mjs | node:fs<br>node:path | Provider or protected endpoint reference detected | Operational Tool |
| scripts/scheduler-health-alignment-v1-validate.mjs | node:fs | No provider reference detected | Operational Tool |
| scripts/settlement-learning-pipeline-recovery-v1-validate.mjs | node:fs | Provider or protected endpoint reference detected | Operational Tool |

## Prediction To Persistence To Dashboard To Settlement To Learning

| Pipeline Area | File | Dependencies | Database References |
| --- | --- | --- | --- |
| AI Module | docs/PICK_ANALYZER_V1_EVIDENCE_INDEX.md | None detected | None detected |
| AI Module | docs/PICK_ANALYZER_V1_PRODUCTION_CERTIFICATION.json | None detected | None detected |
| API Route | src/app/api/ai-operations/lifecycle/route.ts | @/services/ai-learning-lifecycle.service<br>next/server | None detected |
| API Route | src/app/api/ai-performance-center/daily-update/route.ts | @/lib/server-lazy-diagnostics<br>next/server | None detected |
| API Route | src/app/api/ai-performance-center/route.ts | @/lib/server-lazy-diagnostics<br>next/server | None detected |
| API Route | src/app/api/analytics/dashboard/route.ts | @/services/analytics.service<br>next/server | None detected |
| API Route | src/app/api/autonomous-daily-operations/daily-report/route.ts | @/lib/api-contract<br>@/lib/server-lazy-diagnostics<br>next/server | None detected |
| API Route | src/app/api/autonomous-daily-operations/demo/route.ts | @/lib/api-contract<br>@/lib/server-lazy-diagnostics<br>next/server | None detected |
| API Route | src/app/api/autonomous-daily-operations/learning-report/route.ts | @/lib/api-contract<br>@/lib/server-lazy-diagnostics<br>next/server | None detected |
| API Route | src/app/api/basketball/bsn/data-coverage/route.ts | @/lib/api-contract<br>@/services/basketball/acquisition/bsn-acquisition-engine<br>next/server | None detected |
| API Route | src/app/api/bsn/features/route.ts | @/services/bsn-intelligence-engine.service<br>next/server | None detected |
| API Route | src/app/api/bsn/features/validation/route.ts | @/services/bsn-platform.service<br>next/server | None detected |
| API Route | src/app/api/bsn/game/[id]/route.ts | @/services/bsn-shadow-prediction-engine.service<br>next/server | None detected |
| API Route | src/app/api/bsn/model-maturity/calibration/route.ts | @/lib/server-lazy-diagnostics<br>next/server | None detected |
| API Route | src/app/api/bsn/model-maturity/performance/route.ts | @/lib/server-lazy-diagnostics<br>next/server | None detected |
| API Route | src/app/api/bsn/predictions/preview/route.ts | @/services/bsn-shadow-prediction-engine.service<br>next/server | None detected |
| API Route | src/app/api/bsn/predictions/route.ts | @/services/bsn-shadow-prediction-engine.service<br>next/server | None detected |
| API Route | src/app/api/bsn/predictions/validation/route.ts | @/services/bsn-shadow-prediction-engine.service<br>next/server | None detected |
| API Route | src/app/api/cron/capture-predictions/route.ts | @/services/prediction-capture.service<br>next/server | None detected |
| API Route | src/app/api/cron/master-sync/route.ts | @/lib/server-cache<br>@/services/master-sync.service<br>@/services/self-learning-engine.service<br>next/server | None detected |
| API Route | src/app/api/cron/operating-day/route.ts | @/lib/api-contract<br>@/services/adaptive-refresh-orchestrator.service<br>@/services/ai-performance-center.service<br>@/services/operating-day-automation.service<br>@/services/operating-day.service<br>next/server | None detected |
| API Route | src/app/api/dashboard/cache/clear/route.ts | @/lib/server-cache<br>next/server | None detected |
| API Route | src/app/api/dashboard/route.ts | @/lib/server-lazy-diagnostics<br>next/server | None detected |
| API Route | src/app/api/dashboard/today/route.ts | @/lib/server-lazy-diagnostics<br>next/server | None detected |
| API Route | src/app/api/data-coverage/health/route.ts | @/lib/api-contract<br>@/services/data-coverage-inventory.service<br>next/server | None detected |
| API Route | src/app/api/data-foundation/epoch-performance/route.ts | @/lib/api-contract<br>@/services/epoch-performance-learning-v2.service<br>next/server | None detected |
| API Route | src/app/api/data-foundation/epochs/route.ts | @/lib/api-contract<br>@/services/prediction-epoch-governance-v2.service<br>next/server | None detected |
| API Route | src/app/api/data-foundation/feature-rebuild/route.ts | @/lib/api-contract<br>@/services/feature-rebuild-plan-v2.service<br>next/server | None detected |
| API Route | src/app/api/data-foundation/future-predictions/route.ts | @/lib/api-contract<br>@/services/future-only-prediction-continuity-v2.service<br>next/server | None detected |
| API Route | src/app/api/data-foundation/legacy-metrics/route.ts | @/lib/api-contract<br>@/services/legacy-prediction-metric-isolation-v2.service<br>next/server | None detected |
| API Route | src/app/api/factors/debug/route.ts | @/services/advanced-factors.service<br>next/server | None detected |
| API Route | src/app/api/features/registry/lookup/route.ts | @/lib/api-contract<br>@/services/multi-sport-feature-registry.service<br>next/server | None detected |
| API Route | src/app/api/features/registry/route.ts | @/lib/api-contract<br>@/services/multi-sport-feature-registry.service<br>next/server | None detected |
| API Route | src/app/api/features/registry/validation/route.ts | @/lib/api-contract<br>@/services/multi-sport-feature-registry.service<br>next/server | None detected |
| API Route | src/app/api/features/store/definitions/route.ts | @/config/sports.config<br>@/lib/api-contract<br>@/services/feature-store-core.service<br>@/types/multi-sport<br>next/server | None detected |
| API Route | src/app/api/features/store/route.ts | @/lib/api-contract<br>@/services/feature-store-core.service<br>@/services/historical-feature-generation.service<br>next/server | None detected |
| API Route | src/app/api/features/store/validation/route.ts | @/lib/api-contract<br>@/lib/server-schema-capabilities<br>@/services/feature-store-core.service<br>@/services/historical-feature-generation.service<br>next/server | None detected |
| API Route | src/app/api/historical-import/plan/route.ts | @/lib/api-contract<br>@/lib/server-schema-capabilities<br>@/services/historical-feature-generation.service<br>@/services/historical-import-engine.service<br>next/server | None detected |
| API Route | src/app/api/mlb/features/model-readiness/route.ts | @/lib/api-contract<br>@/services/mlb-feature-model-readiness.service<br>next/server | None detected |
| API Route | src/app/api/mlb/features/preview/route.ts | @/lib/api-contract<br>@/services/mlb-feature-store-integration.service<br>next/server | None detected |
| API Route | src/app/api/mlb/features/store/route.ts | @/lib/api-contract<br>@/services/mlb-feature-store-integration.service<br>next/server | None detected |
| API Route | src/app/api/mlb/features/validation/route.ts | @/lib/api-contract<br>@/services/mlb-feature-store-integration.service<br>next/server | None detected |
| API Route | src/app/api/mlb/historical-intelligence/retrosheet/features/route.ts | @/lib/api-contract<br>@/services/retrosheet-historical-feature-store.service<br>next/server | None detected |
| API Route | src/app/api/mlb/learning-brain/route.ts | @/lib/api-contract<br>@/services/mlb-learning-brain.service<br>next/server | None detected |
| API Route | src/app/api/mlb/player-projections/[projectionId]/route.ts | @/lib/api-contract<br>@/lib/supabase-admin<br>@/services/explainable-intelligence.service<br>@/services/mlb-player-projection-engine.service<br>@/services/projection-evolution.service<br>next/server | universal_projection_history |
| API Route | src/app/api/mlb/player-projections/performance/route.ts | @/lib/api-contract<br>@/services/mlb-player-projection-engine.service<br>next/server | None detected |
| API Route | src/app/api/mlb/predictions/comparison/route.ts | @/lib/api-contract<br>@/services/mlb-model-platform.service<br>next/server | None detected |
| API Route | src/app/api/mlb/predictions/health/route.ts | @/lib/api-contract<br>@/services/mlb-prediction-engine.service<br>next/server | None detected |
| API Route | src/app/api/mlb/predictions/promotion-readiness/route.ts | @/lib/api-contract<br>@/services/mlb-model-platform.service<br>next/server | None detected |
| API Route | src/app/api/mlb/predictions/rollback-plan/route.ts | @/lib/api-contract<br>@/services/mlb-model-platform.service<br>next/server | None detected |
| API Route | src/app/api/mlb/predictions/route.ts | @/lib/api-contract<br>@/services/mlb-prediction-engine.service<br>next/server | None detected |
| API Route | src/app/api/mlb/predictions/shadow-evaluation/route.ts | @/lib/api-contract<br>@/services/mlb-model-platform.service<br>next/server | None detected |
| API Route | src/app/api/mlb/predictions/v6-regeneration/route.ts | @/lib/api-contract<br>@/services/sportsdataio-mlb-prospective-preview.service<br>next/server | None detected |
| API Route | src/app/api/mlb/predictions/v7-regeneration/route.ts | @/lib/api-contract<br>@/services/sportsdataio-mlb-prospective-preview.service<br>next/server | None detected |
| API Route | src/app/api/mlb/predictions/validation/route.ts | @/lib/api-contract<br>@/services/mlb-prediction-engine.service<br>next/server | None detected |
| API Route | src/app/api/mlb/projections/health/route.ts | @/lib/api-contract<br>@/services/universal-projection-engine.service<br>next/server | None detected |
| API Route | src/app/api/model/autotune/route.ts | @/services/model-learning.service<br>next/server | None detected |
| API Route | src/app/api/model/calibration/route.ts | @/services/model-calibration.service<br>next/server | None detected |
| API Route | src/app/api/model/learning/route.ts | @/services/model-learning.service<br>next/server | None detected |
| API Route | src/app/api/model/rollback/route.ts | @/services/model-learning.service<br>next/server | None detected |
| API Route | src/app/api/model/self-learning/route.ts | @/services/self-learning-engine.service<br>next/server | None detected |
| API Route | src/app/api/model/shadow-calibration/route.ts | @/services/historical-shadow-calibration.service<br>next/server | None detected |
| API Route | src/app/api/model/status/route.ts | @/services/model-calibration.service<br>@/services/model-learning.service<br>@/services/model-versioning.service<br>next/server | None detected |
| API Route | src/app/api/nba/features/preview/route.ts | @/lib/api-contract<br>@/services/nba-feature-store-integration.service<br>next/server | None detected |
| API Route | src/app/api/nba/features/store/route.ts | @/lib/api-contract<br>@/services/nba-feature-store-integration.service<br>next/server | None detected |
| API Route | src/app/api/nba/features/validation/route.ts | @/lib/api-contract<br>@/services/nba-feature-store-integration.service<br>next/server | None detected |
| API Route | src/app/api/nba/predictions/backtest/route.ts | @/services/nba-backtesting-calibration.service<br>next/server | None detected |
| API Route | src/app/api/nba/predictions/backtest/run/route.ts | @/services/nba-backtesting-calibration.service<br>next/server | None detected |
| API Route | src/app/api/nba/predictions/calibration/route.ts | @/services/nba-backtesting-calibration.service<br>next/server | None detected |
| API Route | src/app/api/nba/predictions/generate/route.ts | @/lib/server-lazy-diagnostics<br>next/server | None detected |
| API Route | src/app/api/nba/predictions/health/route.ts | @/lib/server-lazy-diagnostics<br>next/server | None detected |
| API Route | src/app/api/nba/predictions/model-health/route.ts | @/lib/server-lazy-diagnostics<br>next/server | None detected |
| API Route | src/app/api/nba/predictions/performance/route.ts | @/lib/server-lazy-diagnostics<br>next/server | None detected |
| API Route | src/app/api/nba/predictions/route.ts | @/lib/server-lazy-diagnostics<br>next/server | None detected |
| API Route | src/app/api/nba/predictions/settle/event/[eventId]/route.ts | @/lib/server-lazy-diagnostics<br>next/server | None detected |
| API Route | src/app/api/nba/predictions/settle/route.ts | @/lib/server-lazy-diagnostics<br>next/server | None detected |
| API Route | src/app/api/nba/predictions/settlement-backlog/route.ts | @/lib/server-lazy-diagnostics<br>next/server | None detected |
| API Route | src/app/api/nba/predictions/validate/route.ts | @/lib/server-lazy-diagnostics<br>next/server | None detected |
| API Route | src/app/api/nfl/features/preview/route.ts | @/lib/api-contract<br>@/services/nfl-feature-store-integration.service<br>next/server | None detected |
| API Route | src/app/api/nfl/features/store/route.ts | @/lib/api-contract<br>@/services/nfl-feature-store-integration.service<br>next/server | None detected |
| API Route | src/app/api/nfl/features/validation/route.ts | @/lib/api-contract<br>@/services/nfl-feature-store-integration.service<br>next/server | None detected |
| API Route | src/app/api/nfl/predictions/health/route.ts | @/lib/api-contract<br>@/services/nfl-prediction-engine.service<br>next/server | None detected |
| API Route | src/app/api/nfl/predictions/route.ts | @/lib/api-contract<br>@/services/stored-preview-prediction-lifecycle.service<br>next/server | None detected |
| API Route | src/app/api/nfl/predictions/validation/route.ts | @/lib/api-contract<br>@/services/nfl-prediction-engine.service<br>next/server | None detected |
| API Route | src/app/api/nhl/features/preview/route.ts | @/lib/api-contract<br>@/services/nhl-feature-store-integration.service<br>next/server | None detected |
| API Route | src/app/api/nhl/features/store/route.ts | @/lib/api-contract<br>@/services/nhl-feature-store-integration.service<br>next/server | None detected |
| API Route | src/app/api/nhl/features/validation/route.ts | @/lib/api-contract<br>@/services/nhl-feature-store-integration.service<br>next/server | None detected |
| API Route | src/app/api/nhl/predictions/health/route.ts | @/lib/api-contract<br>@/services/nhl-prediction-engine.service<br>next/server | None detected |
| API Route | src/app/api/nhl/predictions/route.ts | @/lib/api-contract<br>@/services/stored-preview-prediction-lifecycle.service<br>next/server | None detected |
| API Route | src/app/api/nhl/predictions/validation/route.ts | @/lib/api-contract<br>@/services/nhl-prediction-engine.service<br>next/server | None detected |
| API Route | src/app/api/odds/route.ts | @/services/prediction.service<br>next/server | None detected |
| API Route | src/app/api/operating-day/[operatingDayId]/settle/route.ts | @/lib/api-contract<br>@/lib/server-lazy-diagnostics<br>next/server | None detected |
| API Route | src/app/api/operations/odds-change-refresh-readiness/route.ts | @/lib/api-contract<br>@/services/prediction-epoch-shadow-readiness.service<br>next/server | None detected |
| API Route | src/app/api/operations/pregame-odds-refresh-sla/route.ts | @/lib/api-contract<br>@/services/prediction-epoch-shadow-readiness.service<br>next/server | None detected |
| API Route | src/app/api/operations/settlement-guarantee/route.ts | @/lib/api-contract<br>@/services/settlement-guarantee.service<br>next/server | None detected |
| API Route | src/app/api/operations/validation/route.ts | @/lib/api-contract<br>@/services/adaptive-refresh-orchestrator.service<br>@/services/ai-bet-finder.service<br>@/services/bsn-core-certification.service<br>@/services/game-intelligence.service<br>@/services/legacy-prediction-provenance.service<br>@/services/market-alignment.service<br>@/services/market-intelligence-category.service | None detected |
| API Route | src/app/api/performance/[sport]/route.ts | @/lib/server-lazy-diagnostics<br>@/services/performance-product-contract.service<br>next/server | None detected |
| API Route | src/app/api/performance/daily-update/route.ts | @/lib/server-lazy-diagnostics<br>next/server | None detected |
| API Route | src/app/api/performance/evolution/route.ts | @/services/performance-product-contract.service<br>next/server | None detected |
| API Route | src/app/api/performance/goals/route.ts | @/services/performance-product-contract.service<br>next/server | None detected |
| API Route | src/app/api/performance/history/route.ts | @/services/performance-scope-v2.service<br>next/server | None detected |
| API Route | src/app/api/performance/readiness/route.ts | @/lib/server-lazy-diagnostics<br>next/server | None detected |
| API Route | src/app/api/performance/report-card/route.ts | @/services/performance-product-contract.service<br>next/server | None detected |
| API Route | src/app/api/performance/route.ts | @/lib/server-lazy-diagnostics<br>@/services/performance-product-contract.service<br>next/server | cutoff |
| API Route | src/app/api/performance/sports/route.ts | @/services/performance-product-contract.service<br>next/server | None detected |
| API Route | src/app/api/performance/trust/route.ts | @/services/performance-product-contract.service<br>next/server | None detected |
| API Route | src/app/api/performance/validation/route.ts | @/lib/server-lazy-diagnostics<br>next/server | None detected |
| API Route | src/app/api/prediction-engine/v4/route.ts | @/services/prediction-engine-v4.service<br>next/server | None detected |
| API Route | src/app/api/prediction-epoch/activation-readiness/route.ts | @/lib/api-contract<br>@/services/prediction-epoch-shadow-readiness.service<br>next/server | None detected |
| API Route | src/app/api/prediction-epoch/shadow-readiness/route.ts | @/lib/api-contract<br>@/services/prediction-epoch-shadow-readiness.service<br>next/server | None detected |
| API Route | src/app/api/prediction-safety/route.ts | @/lib/api-contract<br>@/services/prediction-safety.service | None detected |
| API Route | src/app/api/prediction-sdk/route.ts | @/lib/api-contract<br>@/services/sport-prediction-engine-sdk.service<br>next/server | None detected |
| API Route | src/app/api/prediction-sdk/validation/route.ts | @/lib/api-contract<br>@/services/sport-prediction-engine-sdk.service<br>next/server | None detected |
| API Route | src/app/api/predictions/by-sport/route.ts | @/config/sports.config<br>@/services/prediction-history.service<br>@/services/top-picks.service<br>next/server | None detected |
| API Route | src/app/api/predictions/performance/route.ts | @/services/prediction-history.service<br>next/server | None detected |
| API Route | src/app/api/predictions/provenance/route.ts | @/lib/api-contract<br>@/services/legacy-prediction-provenance.service<br>next/server | None detected |
| API Route | src/app/api/predictions/settle/debug/route.ts | @/lib/supabase<br>next/server | game_results<br>prediction_history |
| API Route | src/app/api/predictions/settle/route.ts | @/services/clv-analytics.service<br>@/services/model-calibration.service<br>@/services/model-learning.service<br>@/services/prediction-settlement.service<br>@/services/team-stats.service<br>next/server | None detected |
| API Route | src/app/api/predictions/top/route.ts | @/services/best-bets-today.service<br>@/services/top-picks.service<br>next/server | None detected |
| API Route | src/app/api/providers/sportsdataio/nba/approval-packet/route.ts | @/lib/api-contract<br>@/lib/server-lazy-diagnostics<br>next/server | None detected |
| API Route | src/app/api/providers/sportsdataio/nba/blocker-resolution/route.ts | @/lib/api-contract<br>@/lib/server-lazy-diagnostics<br>next/server | None detected |
| API Route | src/app/api/providers/sportsdataio/nba/evidence-export/route.ts | @/lib/api-contract<br>@/lib/server-lazy-diagnostics<br>next/server | None detected |
| API Route | src/app/api/providers/sportsdataio/nba/external-blockers/route.ts | @/lib/api-contract<br>@/lib/server-lazy-diagnostics<br>next/server | None detected |
| API Route | src/app/api/providers/sportsdataio/nba/next-pilot-preflight/route.ts | @/lib/api-contract<br>@/lib/server-lazy-diagnostics<br>next/server | None detected |
| API Route | src/app/api/providers/sportsdataio/nba/odds/endpoint-preflight/route.ts | @/lib/api-contract<br>@/services/sportsdataio-nba-odds-readiness.service<br>next/server | None detected |
| API Route | src/app/api/providers/sportsdataio/nba/player-props/endpoint-preflight/route.ts | @/lib/api-contract<br>@/services/sportsdataio-nba-player-props-readiness.service<br>next/server | None detected |
| API Route | src/app/api/providers/sportsdataio/nba/production-gate/route.ts | @/lib/api-contract<br>@/lib/server-lazy-diagnostics<br>next/server | None detected |
| API Route | src/app/api/providers/sportsdataio/nba/production-usage-exclusion/route.ts | @/lib/api-contract<br>@/lib/server-lazy-diagnostics<br>next/server | None detected |
| API Route | src/app/api/providers/sportsdataio/nba/provider-gate/route.ts | @/lib/api-contract<br>@/lib/server-lazy-diagnostics<br>next/server | None detected |
| API Route | src/app/api/providers/sportsdataio/nba/safe-next-actions/route.ts | @/lib/api-contract<br>@/lib/server-lazy-diagnostics<br>next/server | None detected |
| API Route | src/app/api/recommendation-readiness/route.ts | @/lib/api-contract<br>@/services/day1-recommendation-readiness.service<br>@/services/prospective-official-eligibility-gate.service<br>next/server | None detected |
| API Route | src/app/api/settlement/core/route.ts | @/lib/api-contract<br>@/services/settlement-core.service | None detected |
| API Route | src/app/api/settlement/reconciliation/route.ts | @/lib/api-contract<br>@/services/settlement-reconciliation.service<br>next/server | None detected |
| API Route | src/app/api/soccer/features/preview/route.ts | @/lib/api-contract<br>@/services/soccer-feature-store-integration.service<br>next/server | None detected |
| API Route | src/app/api/soccer/features/store/route.ts | @/lib/api-contract<br>@/services/soccer-feature-store-integration.service<br>next/server | None detected |
| API Route | src/app/api/soccer/features/validation/route.ts | @/lib/api-contract<br>@/services/soccer-feature-store-integration.service<br>next/server | None detected |
| API Route | src/app/api/soccer/predictions/health/route.ts | @/lib/api-contract<br>@/services/soccer-prediction-engine.service<br>next/server | None detected |
| API Route | src/app/api/soccer/predictions/route.ts | @/lib/api-contract<br>@/services/soccer-prediction-engine.service<br>next/server | None detected |
| API Route | src/app/api/soccer/predictions/validation/route.ts | @/lib/api-contract<br>@/services/soccer-prediction-engine.service<br>next/server | None detected |
| API Route | src/app/api/tennis/features/preview/route.ts | @/lib/api-contract<br>@/services/tennis-feature-store-integration.service<br>next/server | None detected |
| API Route | src/app/api/tennis/features/store/route.ts | @/lib/api-contract<br>@/services/tennis-feature-store-integration.service<br>next/server | None detected |
| API Route | src/app/api/tennis/features/validation/route.ts | @/lib/api-contract<br>@/services/tennis-feature-store-integration.service<br>next/server | None detected |
| API Route | src/app/api/tennis/predictions/health/route.ts | @/lib/api-contract<br>@/services/tennis-prediction-engine.service<br>next/server | None detected |
| API Route | src/app/api/tennis/predictions/route.ts | @/lib/api-contract<br>@/services/tennis-prediction-engine.service<br>next/server | None detected |
| API Route | src/app/api/tennis/predictions/validation/route.ts | @/lib/api-contract<br>@/services/tennis-prediction-engine.service<br>next/server | None detected |
| API Route | src/app/api/ufc/features/preview/route.ts | @/lib/api-contract<br>@/services/ufc-feature-store-integration.service<br>next/server | None detected |
| API Route | src/app/api/ufc/features/store/route.ts | @/lib/api-contract<br>@/services/ufc-feature-store-integration.service<br>next/server | None detected |
| API Route | src/app/api/ufc/features/validation/route.ts | @/lib/api-contract<br>@/services/ufc-feature-store-integration.service<br>next/server | None detected |
| API Route | src/app/api/ufc/predictions/health/route.ts | @/lib/api-contract<br>@/services/ufc-prediction-engine.service<br>next/server | None detected |
| API Route | src/app/api/ufc/predictions/route.ts | @/lib/api-contract<br>@/services/ufc-prediction-engine.service<br>next/server | None detected |
| API Route | src/app/api/ufc/predictions/validation/route.ts | @/lib/api-contract<br>@/services/ufc-prediction-engine.service<br>next/server | None detected |
| App Route | src/app/admin/historical-diagnostics/page.tsx | @/services/retrosheet-game-reconstruction.service<br>@/services/retrosheet-historical-feature-store.service<br>next | None detected |
| App Route | src/app/ai-operations/page.tsx | @/components/dashboard/DashboardSection<br>@/components/dashboard/DashboardShell<br>@/components/product/ProductStatus<br>@/services/ai-learning-lifecycle.service<br>@/services/current-board.service<br>@/services/performance-product-contract.service<br>@/services/probability-picks.service<br>@/types/probability-picks | settled<br>sports<br>stored |
| App Route | src/app/autonomous-daily-ai/page.tsx | @/components/dashboard/DashboardShell<br>@/services/autonomous-daily-ai.service | None detected |
| App Route | src/app/closing-line-intelligence/page.tsx | @/components/dashboard/DashboardShell<br>@/services/closing-line-intelligence.service | None detected |
| App Route | src/app/dashboard/page.tsx | @/components/dashboard/AdvancedEvidenceDisclosure<br>@/components/dashboard/DashboardDeveloperGroups<br>@/components/dashboard/DashboardSection<br>@/components/dashboard/DashboardShell<br>@/components/dashboard/TodayDecisionPanel | None detected |
| App Route | src/app/data-coverage/[sport]/page.tsx | @/components/dashboard/DashboardSection<br>@/components/dashboard/DashboardShell<br>@/components/product/ProductStatus<br>@/services/data-coverage-inventory.service<br>next/navigation | this |
| App Route | src/app/data-coverage/page.tsx | @/components/dashboard/DashboardSection<br>@/components/dashboard/DashboardShell<br>@/components/product/ProductStatus<br>@/services/data-coverage-inventory.service<br>@/services/multi-sport-data-expansion-checkpoint2.service<br>@/services/multi-sport-data-expansion-checkpoint3.service<br>@/services/multi-sport-data-expansion-final.service<br>@/services/multi-sport-provider-entitlement-audit.service | this |
| App Route | src/app/game-intelligence/[eventId]/page.tsx | @/components/dashboard/MlbGameIntelligenceDetailClient | None detected |
| App Route | src/app/game-intelligence/page.tsx | @/components/dashboard/MlbGameIntelligencePageClient | None detected |
| App Route | src/app/login/page.tsx | @/lib/supabase<br>react | None detected |
| App Route | src/app/market-intelligence/page.tsx | @/components/dashboard/DashboardShell<br>@/components/product/ProductStatus<br>@/services/market-movement-intelligence.service | sports_odds_snapshots.<br>stored<br>true |
| App Route | src/app/mlb-operations/page.tsx | @/services/mlb-operations-center.service<br>next | None detected |
| App Route | src/app/model/page.tsx | @/components/dashboard/AIModelCenter | None detected |
| App Route | src/app/performance/page.tsx | @/components/performance/PerformanceProductClient | None detected |
| App Route | src/app/player-projections/[projectionId]/page.tsx | @/components/dashboard/MlbPlayerProjectionDetailClient | None detected |
| App Route | src/app/player-projections/page.tsx | @/components/dashboard/MlbPlayerProjectionPageClient | None detected |
| App Route | src/app/portfolio-intelligence/page.tsx | @/components/dashboard/DashboardShell<br>@/components/product/ProductStatus<br>@/services/portfolio-intelligence.service | None detected |
| App Route | src/app/projections/page.tsx | @/components/dashboard/MlbProjectionBoardClient | None detected |
| App Route | src/app/sports-center/[sport]/page.tsx | @/components/dashboard/DashboardSection<br>@/components/dashboard/DashboardShell<br>@/components/product/ProductStatus<br>@/services/sports-center.service<br>next/navigation | None detected |
| App Route | src/app/sports-center/page.tsx | @/components/dashboard/DashboardSection<br>@/components/dashboard/DashboardShell<br>@/components/product/ProductStatus<br>@/services/sports-center.service<br>@/types/sports-center | None detected |
| Component | src/components/home/HomeBettingPlan.tsx | react | existing<br>stored |
| Component | src/components/market-opportunities/AiBetFinderTool.tsx | react | None detected |
| Component | src/components/market-opportunities/ArbitrageTool.tsx | react | None detected |
| Component | src/components/market-opportunities/BestValueTool.tsx | react | None detected |
| Component | src/components/market-opportunities/BettingWorkbenchTool.tsx | react | Compare |
| Component | src/components/market-opportunities/MostLikelyTool.tsx | react | None detected |
| Component | src/components/performance/PerformanceClient.tsx | react | None detected |
| Component | src/components/performance/PerformanceProductClient.tsx | @/components/product/ProductStatus<br>react | None detected |
| Component | src/components/probability-picks/ProbabilityPicksClient.tsx | @/components/product/ProductStatus<br>@/types/probability-picks<br>react | existing<br>qualified<br>rankings |
| Dashboard | scripts/dashboard-navigation-key-smoke.mjs | @playwright/test<br>node:child_process<br>node:util | None detected |
| Dashboard | src/components/dashboard/AdaptiveOperationsPanel.tsx | react | None detected |
| Dashboard | src/components/dashboard/AdaptiveWeightsPanel.tsx | @/context/DashboardContext | None detected |
| Dashboard | src/components/dashboard/AdvancedEvidenceDisclosure.tsx | react | None detected |
| Dashboard | src/components/dashboard/AICoachPanel.tsx | @/context/SportContext<br>react | None detected |
| Dashboard | src/components/dashboard/AICommandCenterPanel.tsx | @/context/DashboardContext | None detected |
| Dashboard | src/components/dashboard/AICopilotChatPanel.tsx | react | None detected |
| Dashboard | src/components/dashboard/AICopilotPanel.tsx | react | None detected |
| Dashboard | src/components/dashboard/AIModelCenter.tsx | react | None detected |
| Dashboard | src/components/dashboard/AiPerformanceCenterPanel.tsx | react | None detected |
| Dashboard | src/components/dashboard/AiPerformancePreviewCard.tsx | react | None detected |
| Dashboard | src/components/dashboard/AISportsBrainPanel.tsx | @/context/SportContext<br>react | None detected |
| Dashboard | src/components/dashboard/AnalyticsChartsPanel.tsx | react | None detected |
| Dashboard | src/components/dashboard/AnalyticsPanel.tsx | @/hooks/useAnalyticsDashboard | None detected |
| Dashboard | src/components/dashboard/AutoModelTuningPanel.tsx | react | None detected |
| Dashboard | src/components/dashboard/BasketballDataCoveragePanel.tsx | react | None detected |
| Dashboard | src/components/dashboard/BetSlipOptimizerPanel.tsx | react | None detected |
| Dashboard | src/components/dashboard/BsnIntelligencePanel.tsx | react | stored |
| Dashboard | src/components/dashboard/BsnModelMaturityPanel.tsx | react | None detected |
| Dashboard | src/components/dashboard/BsnPredictionPreviewPanel.tsx | react | stored |
| Dashboard | src/components/dashboard/ClosingLineIntelligencePanel.tsx | @/context/SportContext<br>react | None detected |
| Dashboard | src/components/dashboard/ClvAnalyticsPanel.tsx | ./DashboardStatCard<br>react | None detected |
| Dashboard | src/components/dashboard/DailyReportPanel.tsx | @/components/dashboard/PickExplanationCard<br>react | None detected |
| Dashboard | src/components/dashboard/DashboardDeveloperGroups.tsx | @/components/dashboard/AICoachPanel<br>@/components/dashboard/AICommandCenterPanel<br>@/components/dashboard/AISportsBrainPanel<br>@/components/dashboard/AdaptiveOperationsPanel<br>@/components/dashboard/AdaptiveWeightsPanel<br>@/components/dashboard/AiPerformanceCenterPanel<br>@/components/dashboard/AutoModelTuningPanel<br>@/components/dashboard/BasketballDataCoveragePanel | None detected |
| Dashboard | src/components/dashboard/DashboardEliteHeader.tsx | None detected | None detected |
| Dashboard | src/components/dashboard/DashboardHeroPanel.tsx | @/context/DashboardContext | None detected |
| Dashboard | src/components/dashboard/DashboardKPIBar.tsx | @/context/DashboardContext | None detected |
| Dashboard | src/components/dashboard/DashboardProPanel.tsx | ./DashboardStatCard<br>react | None detected |
| Dashboard | src/components/dashboard/DashboardQuickStats.tsx | @/context/DashboardContext | None detected |
| Dashboard | src/components/dashboard/DashboardSection.tsx | None detected | None detected |
| Dashboard | src/components/dashboard/DashboardShell.tsx | @/components/dashboard/SportSelector<br>@/components/product/ProductStatus<br>@/context/SportContext<br>next/link<br>next/navigation<br>react | None detected |
| Dashboard | src/components/dashboard/DashboardStatCard.tsx | None detected | None detected |
| Dashboard | src/components/dashboard/DataFreshnessPreviewCard.tsx | react | None detected |
| Dashboard | src/components/dashboard/DeveloperDetails.tsx | react | None detected |
| Dashboard | src/components/dashboard/FeatureStoreCorePanel.tsx | react | None detected |
| Dashboard | src/components/dashboard/GlobalDataQualityPanel.tsx | react | None detected |
| Dashboard | src/components/dashboard/HistoricalImportEnginePanel.tsx | react | readiness. |
| Dashboard | src/components/dashboard/LiveBettingEnginePanel.tsx | react | current |
| Dashboard | src/components/dashboard/LiveMarketMoversPanel.tsx | @/context/DashboardContext | None detected |
| Dashboard | src/components/dashboard/LiveOddsShoppingPanel.tsx | react | None detected |
| Dashboard | src/components/dashboard/MarketIntelligenceSummaryPanel.tsx | react | None detected |
| Dashboard | src/components/dashboard/MlbFeatureStoreIntegrationPanel.tsx | react | None detected |
| Dashboard | src/components/dashboard/MlbGameIntelligenceDetailClient.tsx | react | model |
| Dashboard | src/components/dashboard/MlbGameIntelligencePageClient.tsx | react | None detected |
| Dashboard | src/components/dashboard/MlbGameIntelligencePanel.tsx | react | None detected |
| Dashboard | src/components/dashboard/MlbMarketExpansionRoadmapPanel.tsx | react | None detected |
| Dashboard | src/components/dashboard/MlbMissingIntelligencePanel.tsx | react | Player.Status |
| Dashboard | src/components/dashboard/MlbPlayerProjectionDetailClient.tsx | react | stored |
| Dashboard | src/components/dashboard/MlbPlayerProjectionPageClient.tsx | react | None detected |
| Dashboard | src/components/dashboard/MlbPlayerProjectionsPanel.tsx | @/components/product/ProductStatus<br>react | sportsbook |
| Dashboard | src/components/dashboard/MlbPlayerPropsReadinessPanel.tsx | react | None detected |
| Dashboard | src/components/dashboard/MlbPredictionEnginePanel.tsx | react | completed<br>snapshot<br>the |
| Dashboard | src/components/dashboard/MlbProjectionBoardClient.tsx | react | None detected |
| Dashboard | src/components/dashboard/MlbProspectivePreviewPanel.tsx | react | home<br>the |
| Dashboard | src/components/dashboard/MlbStarterIntelligencePanel.tsx | react | stored |
| Dashboard | src/components/dashboard/MlbTemporalHealthPanel.tsx | react | None detected |
| Dashboard | src/components/dashboard/ModelCalibrationPanel.tsx | react | None detected |
| Dashboard | src/components/dashboard/ModelMetricsFrameworkPanel.tsx | react | stored |
| Dashboard | src/components/dashboard/ModelRollbackPanel.tsx | react | None detected |
| Dashboard | src/components/dashboard/ModelVersionsPanel.tsx | react | None detected |
| Dashboard | src/components/dashboard/MonteCarloSimulatorPanel.tsx | react | None detected |
| Dashboard | src/components/dashboard/MultiSportCoveragePanel.tsx | @/config/sports.config<br>@/context/SportContext<br>react | None detected |
| Dashboard | src/components/dashboard/MultiSportEnginePanel.tsx | @/context/SportContext<br>react | None detected |
| Dashboard | src/components/dashboard/MultiSportFeatureRegistryPanel.tsx | react | None detected |
| Dashboard | src/components/dashboard/NbaAdapterPanel.tsx | react | None detected |
| Dashboard | src/components/dashboard/NbaBacktestingCalibrationPanel.tsx | react | None detected |
| Dashboard | src/components/dashboard/NbaDataQualityPanel.tsx | react | None detected |
| Dashboard | src/components/dashboard/NbaDataSyncPanel.tsx | react | None detected |
| Dashboard | src/components/dashboard/NbaFeatureStoreIntegrationPanel.tsx | react | None detected |
| Dashboard | src/components/dashboard/NbaMultiBookComparisonPanel.tsx | react | None detected |
| Dashboard | src/components/dashboard/NbaPredictionEnginePanel.tsx | react | None detected |
| Dashboard | src/components/dashboard/NbaSteamMovePanel.tsx | react | None detected |
| Dashboard | src/components/dashboard/NextSlateStatusPanel.tsx | react | stored |
| Dashboard | src/components/dashboard/NflFeatureStoreIntegrationPanel.tsx | react | None detected |
| Dashboard | src/components/dashboard/NflPredictionEnginePanel.tsx | react | None detected |
| Dashboard | src/components/dashboard/NhlFeatureStoreIntegrationPanel.tsx | react | None detected |
| Dashboard | src/components/dashboard/NhlPredictionEnginePanel.tsx | react | None detected |
| Dashboard | src/components/dashboard/OperatingDayPanel.tsx | react | None detected |
| Dashboard | src/components/dashboard/OperationsHealthPanel.tsx | react | stored |
| Dashboard | src/components/dashboard/PatternDiscoveryPanel.tsx | @/context/DashboardContext | None detected |
| Dashboard | src/components/dashboard/PickExplanationCard.tsx | None detected | None detected |
| Dashboard | src/components/dashboard/PlayOfTheDayPanel.tsx | react | None detected |
| Dashboard | src/components/dashboard/PortfolioAIV2Panel.tsx | @/context/SportContext<br>@/services/portfolio-ai-v2.service<br>react | None detected |
| Dashboard | src/components/dashboard/PortfolioElitePanel.tsx | react | None detected |
| Dashboard | src/components/dashboard/PortfolioHeatmapPanel.tsx | @/context/DashboardContext | None detected |
| Dashboard | src/components/dashboard/PredictionEngineV4Panel.tsx | react | None detected |
| Dashboard | src/components/dashboard/PredictionSafetyPanel.tsx | react | None detected |
| Dashboard | src/components/dashboard/ProductionReadinessAuditPanel.tsx | react | None detected |
| Dashboard | src/components/dashboard/ProductionTodayPanel.tsx | react | model |
| Dashboard | src/components/dashboard/ProductTodayPanel.tsx | react | betting<br>stored<br>the |
| Dashboard | src/components/dashboard/ProviderAdapterSdkPanel.tsx | react | None detected |
| Dashboard | src/components/dashboard/ProviderIntelligencePanel.tsx | react | None detected |
| Dashboard | src/components/dashboard/QuickActionsPanel.tsx | @/context/DashboardContext<br>react | one |
| Dashboard | src/components/dashboard/RecommendationReadinessPanel.tsx | react | Current |
| Dashboard | src/components/dashboard/RuntimeObservabilityPanel.tsx | react | stored |
| Dashboard | src/components/dashboard/SettlementCorePanel.tsx | react | None detected |
| Dashboard | src/components/dashboard/SharpMoneyIntelligencePanel.tsx | react | None detected |
| Dashboard | src/components/dashboard/SmartParlaysPanel.tsx | react | Smart |
| Dashboard | src/components/dashboard/SoccerFeatureStoreIntegrationPanel.tsx | react | None detected |
| Dashboard | src/components/dashboard/SoccerPredictionEnginePanel.tsx | react | None detected |
| Dashboard | src/components/dashboard/SportPredictionSdkPanel.tsx | react | None detected |
| Dashboard | src/components/dashboard/SportsDataIoContractPanel.tsx | react | None detected |
| Dashboard | src/components/dashboard/SportsDataIoDiscoveryLabPanel.tsx | react | None detected |
| Dashboard | src/components/dashboard/SportSelector.tsx | @/config/sports.config<br>@/context/SportContext | None detected |
| Dashboard | src/components/dashboard/SportsList.tsx | @/hooks/useSports | None detected |
| Dashboard | src/components/dashboard/SyncReliabilityPanel.tsx | react | None detected |
| Dashboard | src/components/dashboard/SystemStatusPanel.tsx | react | None detected |
| Dashboard | src/components/dashboard/TeamStatsPanel.tsx | @/hooks/useTeamStats | None detected |
| Dashboard | src/components/dashboard/TennisFeatureStoreIntegrationPanel.tsx | react | None detected |
| Dashboard | src/components/dashboard/TennisPredictionEnginePanel.tsx | react | None detected |
| Dashboard | src/components/dashboard/today-ai-decision-presentation.ts | @/components/dashboard/today-opportunity-readiness | exposed<br>review |
| Dashboard | src/components/dashboard/today-opportunity-readiness.ts | None detected | stored<br>the |
| Dashboard | src/components/dashboard/TodayDecisionPanel.tsx | @/components/dashboard/today-ai-decision-presentation<br>@/components/dashboard/today-opportunity-readiness<br>react | existing<br>the |
| Dashboard | src/components/dashboard/TopPicksPanel.tsx | @/components/dashboard/PickExplanationCard<br>react | the |
| Dashboard | src/components/dashboard/TopPickWithExplanation.tsx | ./PickExplanationCard<br>react | None detected |
| Dashboard | src/components/dashboard/UfcFeatureStoreIntegrationPanel.tsx | react | None detected |
| Dashboard | src/components/dashboard/UfcPredictionEnginePanel.tsx | react | None detected |
| Dashboard | src/components/dashboard/UniversalMarketCoveragePanel.tsx | react | None detected |
| Dashboard | src/components/dashboard/UniversalProjectionEnginePanel.tsx | react | prediction |
| Dashboard | src/components/dashboard/UpcomingGames.tsx | @/hooks/useUpcomingGames | None detected |
| Dashboard | src/components/dashboard/UserTodayPanel.tsx | @/components/dashboard/AiPerformancePreviewCard<br>@/components/dashboard/DataFreshnessPreviewCard<br>react | an<br>neutral<br>stored<br>the |
| Dashboard | src/context/DashboardContext.tsx | react | None detected |
| Dashboard | src/services/dashboard-today.service.ts | @/lib/supabase-admin<br>@/services/active-event.service<br>@/services/current-board.service<br>@/services/market-intelligence-category.service<br>@/services/mlb-ai-picks-feed.service<br>@/services/mlb-game-lifecycle.service<br>@/services/mlb-odds-coverage.service<br>@/services/mlb-operating-date-resolution.service | current<br>event<br>lineup<br>market<br>official<br>prediction_history<br>sport_events<br>sports_odds_snapshots |
| Dashboard | src/services/dashboard.service.ts | @/lib/server-cache<br>@/services/adaptive-weight-engine.service<br>@/services/ai-trading-advisor.service<br>@/services/analytics.service<br>@/services/clv-analytics.service<br>@/services/daily-report-fast.service<br>@/services/model-calibration.service<br>@/services/pattern-discovery.service | None detected |
| Feature Store | docs/MLB_FEATURE_STORE.md | None detected | None detected |
| Hook | src/hooks/useAnalyticsDashboard.ts | react | None detected |
| Hook | src/hooks/useUpcomingGames.ts | react | None detected |
| Layout | src/app/layout.tsx | @/context/DashboardContext<br>next | None detected |
| Learning Module | docs/AI_INTERNAL_PERFORMANCE_VIEW.md | None detected | None detected |
| Learning Module | docs/AI_PERFORMANCE_INTERNAL_VIEW.md | None detected | None detected |
| Learning Module | docs/CALIBRATION_STATUS_CONTRACT.md | None detected | None detected |
| Learning Module | docs/champion-challenger-policy.md | None detected | immutable<br>leakage<br>model |
| Learning Module | docs/DAILY_SETTLEMENT_CLOSURE_V1.md | None detected | being<br>reversal. |
| Learning Module | docs/EPOCH_PERFORMANCE_LEARNING_V2.md | None detected | settled |
| Learning Module | docs/FEATURE_INTELLIGENCE_V1.md | None detected | model |
| Learning Module | docs/first-live-pitcher-outs-shadow-run.md | None detected | None detected |
| Learning Module | docs/LEARNING_EVIDENCE_ACTIVATION_V1.md | None detected | None detected |
| Learning Module | docs/MLB_LIMITATIONS.md | None detected | None detected |
| Learning Module | docs/MLB_MARKET_ACTIVATION_GATES.md | None detected | None detected |
| Learning Module | docs/MLB_MARKET_DATA_FOUNDATION_V2.md | None detected | prior |
| Learning Module | docs/MLB_MARKET_TAXONOMY.md | None detected | None detected |
| Learning Module | docs/MLB_PITCHER_BACKTEST_READINESS_V1.md | None detected | None detected |
| Learning Module | docs/mlb-ai-coach-v1.md | None detected | None detected |
| Learning Module | docs/mlb-learning-brain-v1.md | None detected | pitcher<br>stored<br>trusted |
| Learning Module | docs/mlb-learning-scheduler.md | None detected | None detected |
| Learning Module | docs/mlb-market-capability-registry-v1.md | None detected | at |
| Learning Module | docs/mlb-model-distributions-v2.md | None detected | probability |
| Learning Module | docs/mlb-provider-capability-audit-v1.md | None detected | None detected |
| Learning Module | docs/mlb-starter-refresh-scheduler.md | None detected | None detected |
| Learning Module | docs/MODEL_SELECTION_ANALYSIS.md | None detected | None detected |
| Learning Module | docs/official-picks-readiness-v1.md | None detected | None detected |
| Learning Module | docs/PICK_ANALYZER_V1_DEFINITION_OF_DONE.md | None detected | pregame |
| Learning Module | docs/PICK_ANALYZER_V1_FINAL_VALIDATION_MATRIX.json | None detected | available |
| Learning Module | docs/PICK_ANALYZER_V1_PHASES.json | None detected | None detected |
| Learning Module | docs/PICK_ANALYZER_V1_RELEASE_NOTES.md | None detected | None detected |
| Learning Module | docs/pitcher-outs-operations.md | None detected | stored |
| Learning Module | docs/PRODUCT_METRIC_LANGUAGE_V1.md | None detected | high<br>projection<br>trust |
| Learning Module | docs/PRODUCT_VALUE_ROADMAP_V1.md | None detected | Operations |
| Learning Module | docs/product-audit-v1-ledger.json | None detected | None detected |
| Learning Module | docs/RELEASES/RELEASE_01_REVIEW.md | None detected | an |
| Learning Module | docs/RELEASES/v1.0-platform-certified.json | None detected | None detected |
| Learning Module | docs/RETROSHEET_HISTORICAL_DATA_LAKE_PHASE_1A.md | None detected | normalized |
| Learning Module | docs/SHADOW_LEARNING_VALIDATION_V1.md | None detected | None detected |
| Learning Module | docs/SPORTSDATAIO_SCRAMBLED_DATA_POLICY.md | None detected | None detected |
| Learning Module | docs/THE_ODDS_API_EVENT_CROSSWALK_AND_PROP_SYNC_V1.md | None detected | The<br>persistence. |
| Learning Module | docs/TRAINING_PRIORITY_MATRIX.md | None detected | None detected |
| Learning Module | docs/UNSUPPORTED_MARKET_RECOMMENDATION_POLICY_LOCK_V1.json | None detected | None detected |
| Learning Module | supabase/migrations/202607190001_ai_performance_snapshots_v1.sql | None detected | None detected |
| Prediction Module | docs/ADAPTIVE_REFRESH_ARCHITECTURE.md | None detected | None detected |
| Prediction Module | docs/ADAPTIVE_REFRESH_EXECUTION.md | None detected | the |
| Prediction Module | docs/ADAPTIVE_REFRESH_POLICY_V1.md | None detected | None detected |
| Prediction Module | docs/AI_BRAIN_ARCHITECTURE.md | None detected | None detected |
| Prediction Module | docs/AI_BRIEFING_V2_DAILY_DECISION_ENGINE.md | None detected | Probability |
| Prediction Module | docs/AI_EVOLUTION.md | None detected | None detected |
| Prediction Module | docs/AI_EXPERIENCE_CLOSED_BETA_UX.md | None detected | None detected |
| Prediction Module | docs/AI_GOALS_AND_READINESS.md | None detected | None detected |
| Prediction Module | docs/AI_LEARNING_PIPELINE.md | None detected | deterministic<br>settled |
| Prediction Module | docs/AI_MODEL_STRATEGY_V1.json | None detected | None detected |
| Prediction Module | docs/AI_MODEL_STRATEGY_V1.md | None detected | better |
| Prediction Module | docs/AI_OPERATIONS_CENTER.md | None detected | stored |
| Prediction Module | docs/AI_PERFORMANCE_CENTER_UI.md | None detected | existing |
| Prediction Module | docs/AI_PERFORMANCE_PRODUCT_EXPERIENCE.md | None detected | None detected |
| Prediction Module | docs/AI_PERFORMANCE_PUBLIC_VIEW.md | None detected | None detected |
| Prediction Module | docs/AI_PREDICTION_HISTORY_UI.md | None detected | the |
| Prediction Module | docs/AI_PREDICTION_HISTORY.md | None detected | stored |
| Prediction Module | docs/AI_PUBLIC_PERFORMANCE_VIEW.md | None detected | None detected |
| Prediction Module | docs/AI_REPORT_CARD.md | None detected | None detected |
| Prediction Module | docs/AI_TRUST_SCORE.md | None detected | history |
| Prediction Module | docs/ai-bet-finder-v1.md | None detected | stored |
| Prediction Module | docs/ai-performance-center-v1.md | None detected | None detected |
| Prediction Module | docs/ai-sports-analyst-v2.md | None detected | None detected |
| Prediction Module | docs/analyst-evidence-contract.md | None detected | American<br>consensus<br>model<br>stale |
| Prediction Module | docs/ARCHITECTURE.md | None detected | Best<br>Historical<br>SportsDataIO<br>actionable<br>already<br>array<br>enterprise<br>environment |
| Prediction Module | docs/AUTONOMOUS_DAILY_AI_V1.md | None detected | validation. |
| Prediction Module | docs/AUTONOMOUS_DAILY_LIFECYCLE.md | None detected | stored |
| Prediction Module | docs/AUTONOMOUS_DAILY_SCHEDULER_V1.md | None detected | None detected |
| Prediction Module | docs/AUTONOMOUS_EXECUTION_V2.md | None detected | production |
| Prediction Module | docs/AUTONOMOUS_EXECUTION.md | None detected | model |
| Prediction Module | docs/autonomous-execution-v2.json | None detected | None detected |
| Prediction Module | docs/best-bets-today-v1.md | None detected | stored<br>the<br>this |
| Prediction Module | docs/best-value-scanner-v1.md | None detected | the |
| Prediction Module | docs/BSN_COMPLETION_CERTIFICATION_V1.md | None detected | None detected |
| Prediction Module | docs/BSN_FOUNDATION_V1_CERTIFICATION.md | None detected | official<br>stored |
| Prediction Module | docs/BSN_HISTORICAL_FOUNDATION_V2.md | None detected | None detected |
| Prediction Module | docs/BSN_WAVE2_CORE_CERTIFICATION.md | None detected | None detected |
| Prediction Module | docs/bsn-data-acquisition-strategy.md | None detected | BSN<br>an<br>operator<br>quarters<br>team<br>verified |
| Prediction Module | docs/bsn-foundation.md | None detected | production |
| Prediction Module | docs/bsn-integration-v1.md | None detected | None detected |
| Prediction Module | docs/bsn-model-maturity-v1.md | None detected | None detected |
| Prediction Module | docs/bsn-prediction-engine-v1.md | None detected | None detected |
| Prediction Module | docs/bsn-source-framework-v1.md | None detected | multiple |
| Prediction Module | docs/BUILD_MEMORY_OPTIMIZATION_DEPLOYMENT_RECOVERY_V1.md | None detected | serializing |
| Prediction Module | docs/BUILD_MEMORY_OPTIMIZATION_V1.md | None detected | shared<br>this |
| Prediction Module | docs/BUILD_OOM_ROOT_CAUSE_V2.md | None detected | about<br>the |
| Prediction Module | docs/build-memory-optimization-v1-baseline.json | None detected | None detected |
| Prediction Module | docs/build-memory-optimization-v1-import-pressure.json | None detected | None detected |
| Prediction Module | docs/build-memory-optimization-v1-phase-a-manifest.json | None detected | None detected |
| Prediction Module | docs/build-memory-optimization-v1-phase-a.json | None detected | None detected |
| Prediction Module | docs/build-memory-optimization-v1-phase-b-external-supabase.json | None detected | None detected |
| Prediction Module | docs/build-memory-optimization-v1-phase-b-final.json | None detected | None detected |
| Prediction Module | docs/build-memory-optimization-v1-phase-b-import-pressure.json | None detected | None detected |
| Prediction Module | docs/build-memory-optimization-v1-phase-b.json | None detected | None detected |
| Prediction Module | docs/build-memory-optimization-v1-phase2-import-pressure.json | None detected | None detected |
| Prediction Module | docs/build-memory-optimization-v1-phase2-repeat.json | None detected | None detected |
| Prediction Module | docs/build-memory-optimization-v1-phase2-route-manifest.json | None detected | None detected |
| Prediction Module | docs/build-memory-optimization-v1-phase2-supabase-externalized.json | None detected | None detected |
| Prediction Module | docs/build-memory-optimization-v1-vercel-prod-cert-v1.json | None detected | None detected |
| Prediction Module | docs/CERTIFIED_PREDICTION_EPOCH_MLB_PROMOTION_READINESS_DESIGN_V1.md | None detected | calibration<br>certified<br>information<br>quarantined<br>settled<br>the<br>this |
| Prediction Module | docs/certified-prediction-epoch-mlb-readiness-audit-v1.json | None detected | None detected |
| Prediction Module | docs/CLOSED_BETA_READINESS.md | None detected | stored |
| Prediction Module | docs/CLOSING_LINE_INTELLIGENCE_V1.md | None detected | prediction |
| Prediction Module | docs/CORE_PREDICTION_CERTIFICATION_ROADMAP_V1.md | None detected | certified<br>current<br>existing |
| Prediction Module | docs/CORE_V1_CERTIFICATION.md | None detected | not<br>stored |
| Prediction Module | docs/current-board-intelligence-engine-v1.md | None detected | official |
| Prediction Module | docs/DAILY_AUTONOMY_CERTIFICATION_V1.md | None detected | settled |
| Prediction Module | docs/DAILY_CONTINUITY_V1.md | None detected | stored |
| Prediction Module | docs/DATA_COVERAGE_FORECAST.json | None detected | None detected |
| Prediction Module | docs/DATA_FRESHNESS_POLICY.md | None detected | None detected |
| Prediction Module | docs/data-completion-matrix-v1.json | None detected | None detected |
| Prediction Module | docs/day1-recommendation-readiness-v1.md | None detected | stored |
| Prediction Module | docs/DECISION_LOG.md | None detected | MLB<br>NBA<br>active<br>authenticated<br>becoming<br>both<br>code<br>deterministic |
| Prediction Module | docs/END_TO_END_DATA_FLOW.md | None detected | None detected |
| Prediction Module | docs/end-to-end-prediction-pipeline-v1.md | None detected | stored |
| Prediction Module | docs/event-identity-operations.md | None detected | None detected |
| Prediction Module | docs/event-identity-prevention-gate.md | None detected | None detected |
| Prediction Module | docs/event-linkage-reconciliation.md | None detected | None detected |
| Prediction Module | docs/FEATURE_ANALYSIS_V1.md | None detected | None detected |
| Prediction Module | docs/FEATURE_COVERAGE.json | None detected | model |
| Prediction Module | docs/FEATURE_LABEL_COVERAGE_RECOVERY_V1.md | None detected | None detected |
| Prediction Module | docs/FEATURE_LABEL_EVIDENCE_CONTRACT_V1.md | None detected | Production |
| Prediction Module | docs/FEATURE_LEAKAGE_AUDIT.md | None detected | None detected |
| Prediction Module | docs/FEATURE_REBUILD_PLAN_V2.md | None detected | None detected |
| Prediction Module | docs/feature-store-core-v1.md | None detected | None detected |
| Prediction Module | docs/FIRST_MODEL_FEATURE_MANIFEST_V1.json | None detected | None detected |
| Prediction Module | docs/first-real-data-validation-plan-v1.md | None detected | Today<br>final<br>the<br>trial |
| Prediction Module | docs/FULL_HISTORICAL_REPLAY_PHASE_2B.md | None detected | stored |
| Prediction Module | docs/FULL_PLATFORM_AUDIT_V1_FINDINGS.json | None detected | memory<br>prediction_history<br>sport_events |
| Prediction Module | docs/FULL_PLATFORM_AUDIT_V1_REPAIR_PLAN.md | None detected | standalone<br>the |
| Prediction Module | docs/FULL_PLATFORM_AUDIT_V1_SYSTEM_MAP.md | None detected | None detected |
| Prediction Module | docs/FULL_PLATFORM_AUDIT_V1.md | None detected | memory<br>prediction_history<br>sport_events |
| Prediction Module | docs/FUTURE_ONLY_PREDICTION_CONTINUITY_V2.md | None detected | None detected |
| Prediction Module | docs/GLOBAL_DATA_QUALITY_RECONCILIATION_V2.md | None detected | prior |
| Prediction Module | docs/global-data-quality-framework-v1.md | None detected | Provider<br>the |
| Prediction Module | docs/highest-probability-outcome-v1.md | None detected | Official<br>distinct<br>the |
| Prediction Module | docs/HISTORICAL_CALIBRATION_SHADOW_REWEIGHTING_V1.md | None detected | None detected |
| Prediction Module | docs/HISTORICAL_DATA_COMPLETION_BASELINE_V3.md | None detected | required |
| Prediction Module | docs/HISTORICAL_EVIDENCE_EXPANSION_V1.md | None detected | current |
| Prediction Module | docs/HISTORICAL_EVIDENCE_RECOVERY_V1.md | None detected | None detected |
| Prediction Module | docs/HISTORICAL_LEARNING_DATASET_CONTRACT_V1.md | None detected | None detected |
| Prediction Module | docs/HISTORICAL_LEARNING_FOUNDATION_V1.md | None detected | existing |
| Prediction Module | docs/HISTORICAL_LEARNING_READINESS_V1.json | None detected | None detected |
| Prediction Module | docs/HISTORICAL_REPLAY_IO_READINESS_CONTROLLED_PILOT_V1.md | None detected | None detected |
| Prediction Module | docs/HISTORICAL_SETTLED_STATUS_RECONCILIATION_V1.md | None detected | Production<br>production |
| Prediction Module | docs/HISTORICAL_SPORTS_DATA_COMPLETION_PROGRAM_V1_CERTIFICATION.md | None detected | None detected |
| Prediction Module | docs/HISTORICAL_SPORTS_DATA_FOUNDATION_V2_CERTIFICATION.md | None detected | Phase |
| Prediction Module | docs/historical-feature-generation-orchestrator-v1.md | None detected | existing<br>promotion<br>real |
| Prediction Module | docs/historical-feature-snapshot-persistence-v1.md | None detected | None detected |
| Prediction Module | docs/historical-feature-trial-lineage-pilot-v1.md | None detected | None detected |
| Prediction Module | docs/historical-import-engine-core-v1.md | None detected | Historical<br>Sync<br>existing<br>planned |
| Prediction Module | docs/historical-settled-status-reconciliation-v1.json | None detected | None detected |
| Prediction Module | docs/LEARNING_DATASET_GROWTH.json | None detected | None detected |
| Prediction Module | docs/LEGACY_PREDICTION_ARCHIVE_METRIC_ISOLATION_V2.md | None detected | None detected |
| Prediction Module | docs/legacy-predictions-v1.md | None detected | The<br>production |
| Prediction Module | docs/LIVE_MULTI_SPORT_DATA_ACQUISITION_V1_FINAL_CERTIFICATION.md | None detected | None detected |
| Prediction Module | docs/LIVE_MULTI_SPORT_DATA_ACQUISITION_V1.md | None detected | None detected |
| Prediction Module | docs/LIVE_PROVIDER_VERIFICATION.md | None detected | None detected |
| Prediction Module | docs/live-multi-sport-acquisition-v1-checkpoint-a.json | None detected | None detected |
| Prediction Module | docs/live-multi-sport-acquisition-v1-checkpoint-b-mlb.json | None detected | None detected |
| Prediction Module | docs/live-multi-sport-acquisition-v1-checkpoint-c-nba-nfl.json | None detected | None detected |
| Prediction Module | docs/live-multi-sport-acquisition-v1-final-certification.json | None detected | None detected |
| Prediction Module | docs/LOCAL_HISTORICAL_FEATURE_BACKFILL_V1.md | None detected | None detected |
| Prediction Module | docs/MARKET_OUTCOME_COMPLETENESS_PERFORMANCE_CONSISTENCY_V1.md | None detected | absolute<br>aligned<br>missing<br>simultaneously<br>the |
| Prediction Module | docs/market-intelligence-engine-v1.md | None detected | None detected |
| Prediction Module | docs/MASTER_PROGRAM/DECISION_CORE.md | None detected | None detected |
| Prediction Module | docs/MASTER_PROGRAM/ENGINEERING_GOVERNANCE.md | None detected | None detected |
| Prediction Module | docs/MASTER_PROGRAM/SPRINT_0_DOCUMENTATION_FOUNDATION.md | None detected | None detected |
| Prediction Module | docs/MASTER_ROADMAP.md | None detected | Advanced<br>Best<br>Full<br>MARKET<br>MLB<br>Production<br>about<br>accuracy |
| Prediction Module | docs/missing-canonical-events-recovery-v1.md | None detected | None detected |
| Prediction Module | docs/MLB_ADAPTIVE_REFRESH_EXECUTION.md | None detected | status |
| Prediction Module | docs/MLB_ARCHITECTURE.md | None detected | None detected |
| Prediction Module | docs/MLB_AUTOMATION.md | None detected | incomplete |
| Prediction Module | docs/MLB_AUTONOMOUS_OPERATING_DAY_METRICS_V1.json | None detected | None detected |
| Prediction Module | docs/MLB_AUTONOMOUS_OPERATIONS_V1.md | None detected | stored |
| Prediction Module | docs/MLB_BOXSCORE_STAT_COMPLETION_V3.md | None detected | name<br>stored |
| Prediction Module | docs/MLB_DATA_FLOW.md | None detected | current |
| Prediction Module | docs/MLB_END_TO_END_DAILY_CLOSURE_V1.json | None detected | None detected |
| Prediction Module | docs/MLB_EVENT_RESULT_COMPLETION_V3.md | None detected | None detected |
| Prediction Module | docs/MLB_FEATURES.md | None detected | verified |
| Prediction Module | docs/MLB_FIRST_AUTONOMOUS_OPERATING_DAY_CERTIFICATION_V1.md | None detected | settled<br>the |
| Prediction Module | docs/MLB_FIRST_FIVE_MARKETS_V1.md | None detected | Retrosheet |
| Prediction Module | docs/MLB_FRESHNESS_POLICY.md | None detected | normalized |
| Prediction Module | docs/MLB_HISTORICAL_FOUNDATION_V2.md | None detected | None detected |
| Prediction Module | docs/MLB_HISTORICAL_FOUNDATION_V3_CERTIFICATION.md | None detected | None detected |
| Prediction Module | docs/MLB_HISTORICAL_INTELLIGENCE_PROGRAM.md | None detected | None detected |
| Prediction Module | docs/MLB_KNOWN_ISSUES.md | None detected | scheduled |
| Prediction Module | docs/MLB_MARKET_EXPANSION_PROGRAM.md | None detected | SportsDataIO<br>current<br>existing<br>final<br>full<br>game |
| Prediction Module | docs/MLB_MARKET_EXPANSION_ROADMAP.md | None detected | existing<br>full |
| Prediction Module | docs/MLB_MARKET_MODEL_REQUIREMENTS.md | None detected | None detected |
| Prediction Module | docs/MLB_ODDS_REFRESH_EXECUTION.md | None detected | None detected |
| Prediction Module | docs/MLB_OPERATING_DATE_AND_ACTION_ADVANCEMENT_REPAIR_V1.md | None detected | events<br>persisted<br>successful |
| Prediction Module | docs/MLB_OPERATING_DAY_RUNTIME_CERTIFICATION.md | None detected | MLB<br>legitimate<br>the<br>this |
| Prediction Module | docs/MLB_OPERATIONS.md | None detected | SportsDataIO |
| Prediction Module | docs/MLB_PLATFORM_COMPLETION.md | None detected | None detected |
| Prediction Module | docs/MLB_PLAYER_PROJECTION_ENGINE_V1.md | None detected | bounded |
| Prediction Module | docs/MLB_PLAYER_PROPS_DATA_READINESS_AUDIT_V1.md | None detected | Current |
| Prediction Module | docs/MLB_PLAYER_STARTER_IDENTITY_V3.md | None detected | final<br>prior |
| Prediction Module | docs/MLB_PRODUCTION_CERTIFICATION_CLOSED_BETA_AUDIT.md | None detected | Official<br>informational |
| Prediction Module | docs/MLB_PRODUCTION_CERTIFICATION.md | None detected | None detected |
| Prediction Module | docs/MLB_PROJECTION_ENGINE.md | None detected | Top<br>the |
| Prediction Module | docs/MLB_PROJECTION_SETTLEMENT.md | None detected | betting |
| Prediction Module | docs/MLB_PROJECTION_TEMPORAL_INTEGRITY.md | None detected | active |
| Prediction Module | docs/MLB_PROVIDER_STRATEGY.md | None detected | accessible<br>recommendation |
| Prediction Module | docs/MLB_RELEASE_NOTES.md | None detected | None detected |
| Prediction Module | docs/MLB_SEASON_COVERAGE_PLAN_V3.md | None detected | stored |
| Prediction Module | docs/MLB_SLATE_RECOVERY_LIFECYCLE_TRUTH_REPAIR.md | None detected | the |
| Prediction Module | docs/MLB_SPORT_EVENTS_STATUS_CONSTRAINT_ROOT_CAUSE_TRACE_V1.md | None detected | shared<br>the |
| Prediction Module | docs/MLB_TEAM_TOTALS_V1.md | None detected | None detected |
| Prediction Module | docs/MLB_TEMPORAL_TRUTH.md | None detected | an<br>canonical |
| Prediction Module | docs/MLB_TODAY_PAGE_END_TO_END_DATA_VISIBILITY_RUNTIME_ALIGNMENT_REPAIR_V1.md | None detected | canonical<br>extending<br>stored<br>the<br>this |
| Prediction Module | docs/MLB_USER_MODE_FRESHNESS_PROVIDER_BUDGET_PHASE_1.md | None detected | candidate<br>defaults. |
| Prediction Module | docs/MLB_WAVE1_COMPLETION_CHANGELOG.md | None detected | existing |
| Prediction Module | docs/mlb-30-day-validation-scorecard-v1.md | None detected | None detected |
| Prediction Module | docs/mlb-automatic-operating-day-v1.md | None detected | None detected |
| Prediction Module | docs/mlb-bullpen-pitcher-intelligence-v1.md | None detected | None detected |
| Prediction Module | docs/mlb-core-final-certification.md | None detected | model |
| Prediction Module | docs/mlb-current-season-backfill.md | None detected | None detected |
| Prediction Module | docs/mlb-daily-operations-v1.md | None detected | the |
| Prediction Module | docs/mlb-data-quality-certification.md | None detected | None detected |
| Prediction Module | docs/mlb-data-quality-v1.md | None detected | stored |
| Prediction Module | docs/mlb-feature-model-readiness.md | None detected | backtesting<br>pregame |
| Prediction Module | docs/mlb-feature-store-integration-v1.md | None detected | None detected |
| Prediction Module | docs/mlb-games-payload-field-verification-v1.md | None detected | populated<br>the |
| Prediction Module | docs/mlb-historical-recommendation-replay-v1.md | None detected | linked |
| Prediction Module | docs/mlb-intelligence-v2.md | None detected | None detected |
| Prediction Module | docs/mlb-line-movement-expansion-batch-v1.md | None detected | this |
| Prediction Module | docs/mlb-line-movement-probe-v1.md | None detected | None detected |
| Prediction Module | docs/mlb-live-data-refresh-v1.md | None detected | operating |
| Prediction Module | docs/mlb-live-validation-readiness-v1.md | None detected | persisted |
| Prediction Module | docs/mlb-market-expansion-v1.md | None detected | odds |
| Prediction Module | docs/mlb-model-audit.md | None detected | None detected |
| Prediction Module | docs/mlb-next-slate-rollover-v1.md | None detected | remaining<br>today |
| Prediction Module | docs/mlb-odds-coverage-reconciliation-v1.md | None detected | None detected |
| Prediction Module | docs/mlb-operating-day-lifecycle-v1.md | None detected | outcome<br>valid |
| Prediction Module | docs/mlb-pitcher-recorded-outs-model.md | None detected | prediction<br>trusted |
| Prediction Module | docs/mlb-player-metadata-cache-v1.md | None detected | None detected |
| Prediction Module | docs/mlb-prediction-engine-v1.md | None detected | the |
| Prediction Module | docs/mlb-prediction-engine-v6-preflight.md | None detected | probability<br>projected |
| Prediction Module | docs/mlb-prediction-engine-v7-confidence-v2.md | None detected | stored |
| Prediction Module | docs/mlb-real-data-validation-batch-v1.md | None detected | GameId |
| Prediction Module | docs/mlb-season-coverage-plan-v3.json | None detected | None detected |
| Prediction Module | docs/mlb-starter-weather-stadium-intelligence-v1.md | None detected | GamesByDate<br>the<br>wind |
| Prediction Module | docs/mlb-verified-provider-call-path-v1.md | None detected | this |
| Prediction Module | docs/MODEL_EVOLUTION_ROADMAP.md | None detected | None detected |
| Prediction Module | docs/MODEL_GOVERNANCE_V1.md | None detected | None detected |
| Prediction Module | docs/MODEL_PROMOTION_POLICY_V1.md | None detected | trial |
| Prediction Module | docs/model-metrics-framework-v1.md | None detected | None detected |
| Prediction Module | docs/most-likely-model-ranking-v1.md | None detected | None detected |
| Prediction Module | docs/MULTI_SPORT_CURRENT_PREVIOUS_SEASON_COVERAGE_V1.json | None detected | None detected |
| Prediction Module | docs/MULTI_SPORT_DATA_EXPANSION_V1.md | None detected | this |
| Prediction Module | docs/MULTI_SPORT_PRODUCTION_READINESS_MATRIX_V1.json | None detected | None detected |
| Prediction Module | docs/MULTI_SPORT_RESULTS_CROSSWALK_FOUNDATION_V1.md | None detected | Preview |
| Prediction Module | docs/MULTI_SPORT_RESULTS_SETTLEMENT_PREVIEW_UNLOCK_V1_FINAL_CERTIFICATION.md | None detected | None detected |
| Prediction Module | docs/multi-sport-engine.md | None detected | None detected |
| Prediction Module | docs/multi-sport-feature-registry-v1.md | None detected | None detected |
| Prediction Module | docs/multi-sport-results-crosswalk-foundation-v1.json | None detected | None detected |
| Prediction Module | docs/multi-sport-results-settlement-preview-unlock-v1-final-certification.json | None detected | market |
| Prediction Module | docs/multi-sport-results-settlement-preview-unlock-v1-ledger.json | None detected | None detected |
| Prediction Module | docs/NBA_BASELINE_CERTIFICATION_V1.md | None detected | partial |
| Prediction Module | docs/NBA_HISTORICAL_FOUNDATION_V2.md | None detected | None detected |
| Prediction Module | docs/NBA_IDENTITY_MARKET_READINESS_V1.md | None detected | None detected |
| Prediction Module | docs/NBA_PREVIEW_PREDICTION_LIFECYCLE_V1.md | None detected | Production |
| Prediction Module | docs/NBA_RESULT_STAT_COMPLETION_PLAN_V1.md | None detected | None detected |
| Prediction Module | docs/nba-backtesting-calibration-v1.md | None detected | Historical<br>corrected<br>existing<br>production<br>settled<br>stored |
| Prediction Module | docs/nba-data-quality-player-stats-expansion-v1.md | None detected | None detected |
| Prediction Module | docs/nba-data-quality-reconciliation-phase-a.md | None detected | stored |
| Prediction Module | docs/nba-data-sync-v1.md | None detected | odds<br>results |
| Prediction Module | docs/nba-feature-store-integration-v1.md | None detected | None detected |
| Prediction Module | docs/nba-injury-lineup-confidence-integration-v1.md | None detected | feature |
| Prediction Module | docs/nba-multi-book-comparison-v1.md | None detected | NBA<br>average<br>the |
| Prediction Module | docs/nba-prediction-validation-settlement-v1.md | None detected | None detected |
| Prediction Module | docs/nba-preview-prediction-lifecycle-v1.json | None detected | Production |
| Prediction Module | docs/nba-stored-lineup-feature-enrichment-v1.md | None detected | production |
| Prediction Module | docs/nba-trial-validation-batch-v1.md | None detected | production |
| Prediction Module | docs/NFL_BASELINE_CERTIFICATION_V1.md | None detected | None detected |
| Prediction Module | docs/NFL_COMPLETION_PLAN_V1.md | None detected | None detected |
| Prediction Module | docs/NFL_HISTORICAL_FOUNDATION_V2.md | None detected | None detected |
| Prediction Module | docs/NFL_NHL_PREVIEW_PREDICTION_LIFECYCLE_V1_FINAL_CERTIFICATION.md | None detected | None detected |
| Prediction Module | docs/NFL_NHL_PREVIEW_PREDICTION_LIFECYCLE_V1.md | None detected | None detected |
| Prediction Module | docs/NFL_PREVIEW_PREDICTION_LIFECYCLE_V1.md | None detected | Preview |
| Prediction Module | docs/nfl-feature-store-integration-v1.md | None detected | None detected |
| Prediction Module | docs/nfl-prediction-engine-v1.md | None detected | None detected |
| Prediction Module | docs/nfl-preview-prediction-lifecycle-v1.json | None detected | None detected |
| Prediction Module | docs/NHL_BASELINE_AND_COMPLETION_PLAN_V1.md | None detected | production |
| Prediction Module | docs/NHL_HISTORICAL_FOUNDATION_V2.md | None detected | None detected |
| Prediction Module | docs/NHL_PREVIEW_PREDICTION_LIFECYCLE_V1.md | None detected | Preview |
| Prediction Module | docs/nhl-feature-store-integration-v1.md | None detected | None detected |
| Prediction Module | docs/nhl-prediction-engine-v1.md | None detected | the |
| Prediction Module | docs/nhl-preview-prediction-lifecycle-v1.json | None detected | None detected |
| Prediction Module | docs/ODDS_API_EXTRACTION_COMPLETENESS_V1.md | None detected | None detected |
| Prediction Module | docs/official-picks-eligibility-audit-v1.json | None detected | feature<br>settled |
| Prediction Module | docs/operating-day-cron-reliability-v1.md | None detected | stored |
| Prediction Module | docs/OPERATIONAL_READINESS_MULTI_SPORT_AUDIT_V1.json | None detected | production<br>settled |
| Prediction Module | docs/OPERATIONAL_READINESS_MULTI_SPORT_AUDIT_V1.md | None detected | None detected |
| Prediction Module | docs/OPERATIONS_RUNBOOK.md | None detected | stored |
| Prediction Module | docs/PERFORMANCE_API_QUERY_OPTIMIZATION_V1.md | None detected | the |
| Prediction Module | docs/PERFORMANCE_PRODUCT_MODE_V1.md | None detected | production |
| Prediction Module | docs/performance-center-integrity.md | None detected | None detected |
| Prediction Module | docs/performance-scope-v2.md | None detected | None detected |
| Prediction Module | docs/performance-timeline-v2.md | None detected | None detected |
| Prediction Module | docs/PICK_ANALYZER_CHANGE_CONTROL_POLICY.md | None detected | None detected |
| Prediction Module | docs/PICK_ANALYZER_FINAL_COMPLETION_PLAN_V1.md | None detected | being<br>canonical<br>pregame<br>preview |
| Prediction Module | docs/PICK_ANALYZER_POST_V1_BACKLOG.md | None detected | None detected |
| Prediction Module | docs/PICK_ANALYZER_V1_DEFINITION_OF_DONE_MATRIX.json | None detected | pregame |
| Prediction Module | docs/PICK_ANALYZER_V1_FINAL_CERTIFICATION.json | None detected | recommendations. |
| Prediction Module | docs/PICK_ANALYZER_V1_FINAL_CERTIFICATION.md | None detected | recommendations. |
| Prediction Module | docs/PICK_ANALYZER_V1_FINAL_VALIDATION_BUNDLE.md | None detected | None detected |
| Prediction Module | docs/PICK_ANALYZER_V1_PROVIDER_MUTATION_ACCOUNTING.json | None detected | None detected |
| Prediction Module | docs/PICK_ANALYZER_V1_SCOPE.json | None detected | None detected |
| Prediction Module | docs/PICK_ANALYZER_V2_PHASE_A2_ROUTE_RUNTIME_AUDIT.md | None detected | product |
| Prediction Module | docs/PICK_ANALYZER_V2_PHASE_A3_SCHEDULER_FRESHNESS_AUDIT.md | None detected | NOT_AVAILABLE<br>active<br>last |
| Prediction Module | docs/PICK_ANALYZER_V2_PHASE_A4_UI_STATE_AUDIT.md | None detected | API<br>data<br>failures.<br>production<br>recommendation |
| Prediction Module | docs/PICK_ANALYZER_V2_PHASE_A5_API_QUERY_PERFORMANCE_AUDIT.md | None detected | None detected |
| Prediction Module | docs/PICK_ANALYZER_V2_PHASE_A6_BUILD_RELIABILITY_AUDIT.md | None detected | config<br>out<br>that |
| Prediction Module | docs/PICK_ANALYZER_V2_PHASE_B2_TODAY_EXPERIENCE.md | None detected | None detected |
| Prediction Module | docs/PICK_ANALYZER_V2_PHASE_B3_BEST_OPPORTUNITY_READINESS.md | None detected | normalized<br>the |
| Prediction Module | docs/PICK_ANALYZER_V2_PHASE_B4_DECISION_DASHBOARD_EXPERIENCE.md | None detected | None detected |
| Prediction Module | docs/PICK_ANALYZER_V2_PHASE_B5_1_MOBILE_OPPORTUNITY_NAVIGATION.md | None detected | the |
| Prediction Module | docs/PICK_ANALYZER_V2_PHASE_B5_AI_DECISION_EXPLANATION.md | None detected | Conviction |
| Prediction Module | docs/PICK_ANALYZER_V2_PHASE_B6_1_LIVE_FRESHNESS_BUDGET_AUDIT.md | None detected | repo |
| Prediction Module | docs/PICK_ANALYZER_V2_PHASE_B6_MOBILE_DECISION_EXPERIENCE.md | None detected | None detected |
| Prediction Module | docs/PICK_ANALYZER_V2_PHASE_C1_1_EXTERNAL_SCHEDULER_RECOVERY.md | None detected | C1<br>the |
| Prediction Module | docs/PICK_ANALYZER_V2_PHASE_C1_DAILY_BETTING_AND_SETTLEMENT_GUARANTEE.md | None detected | existing<br>prospective<br>settled |
| Prediction Module | docs/pick-analyzer-v2-phase-a2-route-runtime-audit.json | None detected | missing<br>product |
| Prediction Module | docs/pick-analyzer-v2-phase-a3-scheduler-freshness-audit.json | None detected | NOT_AVAILABLE<br>active<br>last |
| Prediction Module | docs/pick-analyzer-v2-phase-a4-ui-state-audit.json | None detected | API<br>data<br>failures.<br>production<br>recommendation |
| Prediction Module | docs/pick-analyzer-v2-phase-a5-api-query-performance-audit.json | None detected | None detected |
| Prediction Module | docs/pick-analyzer-v2-phase-a6-build-reliability-audit.json | None detected | config<br>memory |
| Prediction Module | docs/pick-analyzer-v2-phase-b2-today-experience.json | None detected | None detected |
| Prediction Module | docs/pick-analyzer-v2-phase-b3-best-opportunity-readiness.json | None detected | normalized<br>the |
| Prediction Module | docs/pick-analyzer-v2-phase-b4-decision-dashboard-experience.json | None detected | None detected |
| Prediction Module | docs/pick-analyzer-v2-phase-b5-1-mobile-opportunity-navigation.json | None detected | None detected |
| Prediction Module | docs/pick-analyzer-v2-phase-b5-ai-decision-explanation.json | None detected | None detected |
| Prediction Module | docs/pick-analyzer-v2-phase-b6-1-live-freshness-budget-audit.json | None detected | market<br>page |
| Prediction Module | docs/pick-analyzer-v2-phase-b6-mobile-decision-experience.json | None detected | None detected |
| Prediction Module | docs/pick-analyzer-v2-phase-c1-1-external-scheduler-recovery.json | None detected | None detected |
| Prediction Module | docs/pick-analyzer-v2-phase-c1-daily-betting-settlement-guarantee.json | None detected | None detected |
| Prediction Module | docs/pick-explanation-experience-v1.md | None detected | None detected |
| Prediction Module | docs/pitcher-outs-shadow-model-v1.md | None detected | None detected |
| Prediction Module | docs/PLATFORM_CONSOLIDATION_DUPLICATION_CLEANUP_V1.md | None detected | the |
| Prediction Module | docs/PLATFORM_LOCK_POLICY.md | None detected | None detected |
| Prediction Module | docs/PLATFORM_ROLLBACK_RUNBOOK.md | None detected | None detected |
| Prediction Module | docs/platform-consolidation-duplication-cleanup-v1.json | None detected | None detected |
| Prediction Module | docs/PLAYER_PROP_MULTI_MARKET_EXPANSION_V1.md | None detected | None detected |
| Prediction Module | docs/PORTFOLIO_INTELLIGENCE_V1.md | None detected | None detected |
| Prediction Module | docs/PREDICTION_EPOCH_GOVERNANCE_SEEDING_V1.md | None detected | this |
| Prediction Module | docs/PREDICTION_EPOCH_GOVERNANCE_V2_MIGRATION_REVIEW.md | None detected | deployment |
| Prediction Module | docs/PREDICTION_EPOCH_GOVERNANCE_V2_MIGRATION_RUNBOOK.md | None detected | the |
| Prediction Module | docs/PREDICTION_EPOCH_GOVERNANCE_V2.md | None detected | None detected |
| Prediction Module | docs/PREDICTION_EPOCH_MIGRATION_DETECTION_FIX_V1.md | None detected | migration |
| Prediction Module | docs/PREDICTION_EPOCH_SHADOW_READINESS_V1.md | None detected | this |
| Prediction Module | docs/PREDICTION_LIFECYCLE_V2.md | None detected | persisted<br>production |
| Prediction Module | docs/prediction-family-and-deduplication.md | None detected | None detected |
| Prediction Module | docs/prediction-provenance.md | None detected | row<br>the |
| Prediction Module | docs/prediction-safety-framework-v1.md | None detected | None detected |
| Prediction Module | docs/prediction-versioning-engine-v1.md | None detected | None detected |
| Prediction Module | docs/PREGAME_EXECUTION_RECOVERY_SLATE_PREWARM_V1.md | None detected | None detected |
| Prediction Module | docs/PREGAME_REFRESH_LIFECYCLE.md | None detected | None detected |
| Prediction Module | docs/PREGAME_SCHEDULER_COVERAGE_EXECUTION_TIMING_V1.md | None detected | persisted<br>the |
| Prediction Module | docs/PROBABILITY_PICKS_MULTI_SPORT_AUDIT_V1.md | None detected | an |
| Prediction Module | docs/PROBABILITY_PICKS_V1.md | None detected | None detected |
| Prediction Module | docs/PROBABILITY_PICKS_V2.md | None detected | existing |
| Prediction Module | docs/PRODUCT_EXPERIENCE_DATA_TRUST_AUDIT_V1_CERTIFICATION.md | None detected | normal |
| Prediction Module | docs/PRODUCT_NAVIGATION_FRESHNESS_HARDENING_V1.md | None detected | None detected |
| Prediction Module | docs/PRODUCT_READINESS_MATRIX_V1.md | None detected | normal<br>operator |
| Prediction Module | docs/PRODUCT_STABILIZATION_AND_INTELLIGENCE_CONSOLIDATION_V1.md | None detected | None detected |
| Prediction Module | docs/product-readiness-matrix-v1.json | None detected | Operations<br>primary |
| Prediction Module | docs/product-route-inventory-v1.json | None detected | Current |
| Prediction Module | docs/product-stabilization-v1-audit.json | None detected | the |
| Prediction Module | docs/PRODUCTION_OPERATIONS_PIPELINE.md | None detected | stored |
| Prediction Module | docs/PRODUCTION_READINESS_AUDIT.md | None detected | None detected |
| Prediction Module | docs/PRODUCTION_REFRESH_INFRASTRUCTURE.md | None detected | None detected |
| Prediction Module | docs/PRODUCTION_REGRESSION_AUDIT_V1.md | None detected | legacy<br>stored |
| Prediction Module | docs/production-data-gate-v1.md | None detected | Day<br>improving<br>top |
| Prediction Module | docs/production-scope.md | None detected | production |
| Prediction Module | docs/PROJECT_STATUS.md | None detected | BSN<br>Best<br>Current<br>Dashboard<br>Game<br>MLB<br>Most<br>Official |
| Prediction Module | docs/PROJECTION_FRAMEWORK.md | None detected | None detected |
| Prediction Module | docs/PROJECTION_HISTORY.md | None detected | betting |
| Prediction Module | docs/PROJECTION_VALIDATION.md | None detected | None detected |
| Prediction Module | docs/prospective-official-eligibility-gate-v1.md | None detected | real |
| Prediction Module | docs/PUSH_AWARE_OUTCOME_DISTRIBUTION_MARKET_SEMANTICS_V1.md | None detected | accuracy<br>actionable<br>win |
| Prediction Module | docs/RECOMMENDATION_CHANGE_EVENTS.md | None detected | None detected |
| Prediction Module | docs/RECOMMENDATION_PIPELINE_TRACE_V1.md | None detected | persisted |
| Prediction Module | docs/recommendation-eligibility-policy-v1.md | None detected | None detected |
| Prediction Module | docs/RECOVERY_SUMMARY.json | None detected | None detected |
| Prediction Module | docs/refresh-status-contract.md | None detected | None detected |
| Prediction Module | docs/RELEASE_CANDIDATE_ROUTE_ARTIFACT_CONSISTENCY_V1.json | None detected | None detected |
| Prediction Module | docs/RELEASE_CANDIDATE_ROUTE_ARTIFACT_CONSISTENCY_V1.md | None detected | None detected |
| Prediction Module | docs/RELEASES/PLATFORM_CERTIFIED_V1.md | None detected | deterministic<br>market<br>recommendations |
| Prediction Module | docs/RELEASES/RELEASE_01_EXECUTION_PLAN.md | None detected | an |
| Prediction Module | docs/RETROSHEET_GAME_ENGINE_PHASE_1B.md | None detected | Retrosheet<br>reconstructed |
| Prediction Module | docs/RETROSHEET_HISTORICAL_COVERAGE_INTELLIGENCE_PHASE_1_5.md | None detected | PA<br>current<br>defense<br>final<br>historical<br>learning<br>persisted<br>single |
| Prediction Module | docs/RETROSHEET_HISTORICAL_FEATURE_IDEMPOTENCY_CERTIFICATION.md | None detected | persisted |
| Prediction Module | docs/RETROSHEET_HISTORICAL_FEATURE_PRODUCTION_ISOLATION.md | None detected | None detected |
| Prediction Module | docs/RETROSHEET_HISTORICAL_FEATURE_STORE_PHASE_2A.md | None detected | Phase<br>running<br>starter<br>team<br>the |
| Prediction Module | docs/runtime-observability-v1.md | None detected | Provider<br>the<br>zero |
| Prediction Module | docs/SCHEDULER_RELIABILITY.md | None detected | the |
| Prediction Module | docs/SEASON_COMPETITION_GOVERNANCE_V2.md | None detected | None detected |
| Prediction Module | docs/SETTLEMENT_LEARNING_PIPELINE_RECOVERY_V1.md | None detected | completed |
| Prediction Module | docs/SETTLEMENT_RECONCILIATION_ENGINE_V2.md | None detected | remaining<br>the |
| Prediction Module | docs/settlement-core-v2.md | None detected | None detected |
| Prediction Module | docs/settlement-reconciliation-v1.md | None detected | None detected |
| Prediction Module | docs/settlement-recovery-after-event-import.md | None detected | qualified |
| Prediction Module | docs/shared-sport-prediction-engine-sdk-v1.md | None detected | None detected |
| Prediction Module | docs/SIX_HISTORICAL_SETTLEMENT_CONFLICT_RESOLUTION_V1.md | None detected | earlier<br>the |
| Prediction Module | docs/six-historical-settlement-conflict-resolution-v1.json | None detected | None detected |
| Prediction Module | docs/SOCCER_COMPETITION_ACTIVATION_GATE_V1.md | None detected | Preview |
| Prediction Module | docs/SOCCER_COMPETITION_COMPLETION_PLAN_V1.md | None detected | None detected |
| Prediction Module | docs/SOCCER_HISTORICAL_FOUNDATION_V2.md | None detected | existing |
| Prediction Module | docs/soccer-competition-activation-gate-v1.json | None detected | match |
| Prediction Module | docs/soccer-feature-store-integration-v1.md | None detected | None detected |
| Prediction Module | docs/soccer-prediction-engine-v1.md | None detected | match<br>normalized<br>total |
| Prediction Module | docs/SPORT_READINESS_FORECAST.md | None detected | normal |
| Prediction Module | docs/SPORTS_CENTER_V1_PRODUCT_EXPERIENCE.md | None detected | None detected |
| Prediction Module | docs/SPORTS_DATA_COVERAGE_AUDIT_V2.md | None detected | bounded |
| Prediction Module | docs/SPORTS_DATA_SOURCE_REGISTRY_V2.md | None detected | source |
| Prediction Module | docs/SPORTS_DATA_WAREHOUSE_V2.md | None detected | production |
| Prediction Module | docs/SPORTSDATAIO_ENTITLEMENT_DISCOVERY_AND_SAFE_EXTRACTION.md | None detected | None detected |
| Prediction Module | docs/SPORTSDATAIO_PLAYER_GAME_STATS_ENDPOINT_OPTIMIZATION.md | None detected | None detected |
| Prediction Module | docs/sportsdataio-historical-import-execution-readiness-v1.md | None detected | local<br>prediction |
| Prediction Module | docs/sportsdataio-nba-depth-lineups-pilot-v1.md | None detected | game<br>home<br>lineup<br>production |
| Prediction Module | docs/sportsdataio-nba-injuries-pilot-v1.md | None detected | the |
| Prediction Module | docs/sportsdataio-nba-integration-readiness-v1.md | None detected | local<br>the |
| Prediction Module | docs/sportsdataio-nba-observability-integration-v1.md | None detected | the<br>trial |
| Prediction Module | docs/sportsdataio-nba-odds-readiness-v1.md | None detected | normalized<br>production<br>trial |
| Prediction Module | docs/sportsdataio-nba-pilot-import-v1.md | None detected | None detected |
| Prediction Module | docs/sportsdataio-nba-pilot-import-v2.md | None detected | production |
| Prediction Module | docs/sportsdataio-nba-player-props-readiness-v1.md | None detected | production<br>trial |
| Prediction Module | docs/sportsdataio-nba-player-stats-pilot-v1.md | None detected | endpoint<br>local<br>provider |
| Prediction Module | docs/sportsdataio-nba-player-stats-readiness-v1.md | None detected | fixture<br>information_schema.columns<br>information_schema.role_table_grants<br>pg_indexes |
| Prediction Module | docs/sportsdataio-nba-players-pilot-v1.md | None detected | None detected |
| Prediction Module | docs/sportsdataio-nba-priced-game-odds-pilot-v1.md | None detected | None detected |
| Prediction Module | docs/sportsdataio-nba-trial-isolation-audit-v1.md | None detected | None detected |
| Prediction Module | docs/SUPABASE_DISK_IO_RECOVERY_AUDIT_V1.md | None detected | completed<br>the |
| Prediction Module | docs/SYSTEM_HEALTH_POLICY_V1.md | None detected | adaptive |
| Prediction Module | docs/TENNIS_UFC_DATA_READINESS_V2.md | None detected | None detected |
| Prediction Module | docs/TENNIS_UFC_EVENT_LIFECYCLE_GATE_V1.md | None detected | Preview |
| Prediction Module | docs/TENNIS_UFC_EVENT_READINESS_CERTIFICATION_V1.md | None detected | None detected |
| Prediction Module | docs/tennis-feature-store-integration-v1.md | None detected | None detected |
| Prediction Module | docs/tennis-prediction-engine-v1.md | None detected | the |
| Prediction Module | docs/tennis-ufc-event-lifecycle-gate-v1.json | None detected | None detected |
| Prediction Module | docs/THE_ODDS_API_CURRENT_ODDS_V1.md | None detected | None detected |
| Prediction Module | docs/THE_ODDS_API_HISTORICAL_MLB_CORE_IMPORT_V1.md | None detected | None detected |
| Prediction Module | docs/THE_ODDS_API_MAXIMUM_UTILIZATION_V1_FINAL_CERTIFICATION.md | None detected | The<br>pregame<br>provider |
| Prediction Module | docs/THE_ODDS_API_MAXIMUM_UTILIZATION_V1.md | None detected | None detected |
| Prediction Module | docs/THE_ODDS_API_PLAYER_PROPS_V1.md | None detected | None detected |
| Prediction Module | docs/THE_ODDS_API_SCORES_RESULTS_V1.md | None detected | None detected |
| Prediction Module | docs/the-odds-api-maximum-utilization-v1-checkpoint1.json | None detected | None detected |
| Prediction Module | docs/the-odds-api-maximum-utilization-v1-final-certification.json | None detected | None detected |
| Prediction Module | docs/TRAINING_CHECKLIST_V1.md | None detected | model |
| Prediction Module | docs/TRAINING_DATASET_EXPANSION_V1.md | None detected | None detected |
| Prediction Module | docs/TRAINING_DATASET_FEATURE_RECERTIFICATION_V1.json | None detected | None detected |
| Prediction Module | docs/TRAINING_DATASET_SPEC_V1.md | None detected | None detected |
| Prediction Module | docs/TRAINING_EXPANSION_ROADMAP.md | None detected | current |
| Prediction Module | docs/TRAINING_FEATURE_CONTRACT_V1.md | None detected | None detected |
| Prediction Module | docs/TRAINING_FORECAST.json | None detected | None detected |
| Prediction Module | docs/TRAINING_PIPELINE_ARCHITECTURE_V1.md | None detected | authoritative<br>settled<br>shadow |
| Prediction Module | docs/TRAINING_READINESS_V1.json | None detected | production |
| Prediction Module | docs/TRAINING_READINESS_V1.md | None detected | Historical |
| Prediction Module | docs/TRAINING_SAFE_FEATURE_GOVERNANCE_V1.md | None detected | None detected |
| Prediction Module | docs/ufc-feature-store-integration-v1.md | None detected | None detected |
| Prediction Module | docs/ufc-prediction-engine-v1.md | None detected | None detected |
| Prediction Module | docs/ui-intelligence-integrity-refactor-v1.md | None detected | None detected |
| Prediction Module | docs/UNIVERSAL_EVENT_IDENTITY_CROSSWALK_ENGINE_V1.md | None detected | None detected |
| Prediction Module | docs/UNIVERSAL_EVENT_IDENTITY_MATERIALIZATION_V1.md | None detected | already |
| Prediction Module | docs/UNIVERSAL_MARKET_INTELLIGENCE_PLATFORM_V1.md | None detected | None detected |
| Prediction Module | docs/UNIVERSAL_PROJECTION_ENGINE.md | None detected | betting<br>user |
| Prediction Module | docs/universal-event-identity-v1.md | None detected | current |
| Prediction Module | docs/UNSUPPORTED_MARKET_RECOMMENDATION_POLICY_LOCK_V1.md | None detected | Official |
| Prediction Module | docs/user-mode-intelligence-v2.md | None detected | None detected |
| Prediction Module | docs/UX_RECOVERY_V1.md | None detected | V2 |
| Prediction Module | docs/VERCEL_BUILD_MEMORY_PRODUCTION_CERTIFICATION_V1.md | None detected | Vercel<br>an<br>available<br>the<br>this |
| Prediction Module | docs/VERCEL_BUILD_MEMORY_RECOVERY_V1.md | None detected | Phase<br>prior<br>the |
| Prediction Module | docs/vercel-build-memory-recovery-v1-summary.json | None detected | None detected |
| Prediction Module | docs/WEBPACK_DEPENDENCY_GRAPH_AUDIT_V2.md | None detected | V1<br>client<br>the<br>those |
| Prediction Module | src/config/sports.config.ts | None detected | None detected |
| Prediction Module | src/lib/server-lazy-diagnostics.ts | @/services/adaptive-refresh-orchestrator.service<br>@/services/ai-performance-center.service<br>@/services/autonomous-daily-operations.service<br>@/services/bsn-core-certification.service<br>@/services/bsn-model-maturity.service<br>@/services/dashboard-today.service<br>@/services/dashboard.service<br>@/services/mlb-market-expansion-roadmap.service | None detected |
| Prediction Module | src/lib/server-schema-capabilities.ts | @supabase/supabase-js | None detected |
| Prediction Module | src/types/database.ts | None detected | None detected |
| Prediction Module | src/types/multi-sport.ts | @/config/sports.config | None detected |
| Prediction Module | src/types/probability-picks.ts | None detected | None detected |
| Prediction Module | src/utils/prediction-engine-v2.ts | None detected | None detected |
| Prediction Module | src/utils/prediction-engine-v3.ts | ./prediction-engine-v2<br>@/services/model-adjustments.service | None detected |
| Prediction Module | src/utils/prediction-engine-v4.ts | ./prediction-engine-v3<br>@/services/model-adjustments.service | None detected |
| Prediction Module | supabase/migrations/202607110003_nba_prediction_validation_settlement_v1.sql | None detected | pg_constraint |
| Prediction Module | supabase/migrations/202607140001_historical_feature_snapshots_v1.sql | None detected | new.as_of_timestamp<br>new.deterministic_key<br>new.event_id<br>new.feature_lineage<br>new.feature_set_version<br>new.feature_values<br>new.league_key<br>new.leakage_status |
| Prediction Module | supabase/migrations/202607170001_mlb_operating_day_lifecycle_v1.sql | None detected | None detected |
| Prediction Module | supabase/migrations/202607170002_prediction_versioning_engine_v1.sql | None detected | pg_constraint |
| Prediction Module | supabase/migrations/202607170003_prediction_versioning_drop_legacy_unique_pick.sql | None detected | pg_constraint |
| Prediction Module | supabase/migrations/202607190002_universal_projection_history_v1.sql | None detected | None detected |
| Prediction Module | supabase/migrations/202607240001_current_board_timeout_recovery_v1.sql | None detected | None detected |
| Prediction Module | supabase/migrations/202607240005_universal_market_registry_v1.sql | None detected | None detected |
| Prediction Module | supabase/migrations/202607270001_prediction_epoch_governance_v2.sql | None detected | information_schema.tables<br>pg_constraint<br>pg_policies |
| Prediction Module | supabase/migrations/202607270002_prediction_epoch_governance_seed_v1.sql | None detected | information_schema.columns<br>public.prediction_epochs<br>public.prediction_history |
| Prediction Module | supabase/migrations/202607280001_prediction_epoch_shadow_readiness_v1.sql | None detected | pg_constraint |
| Prediction Module | supabase/migrations/checks/202607270001_prediction_epoch_governance_v2_postcheck.sql | None detected | checks<br>information_schema.columns<br>pg_class<br>pg_constraint<br>pg_indexes<br>pg_policies<br>public.historical_feature_snapshots<br>public.prediction_epochs |
| Prediction Module | supabase/migrations/checks/202607270001_prediction_epoch_governance_v2_precheck.sql | None detected | checks<br>duplicate_candidates<br>information_schema.columns<br>inventory<br>pg_namespace<br>pg_proc<br>prediction_columns<br>public.historical_feature_snapshots |
| Prediction Module | supabase/migrations/checks/202607270002_prediction_epoch_governance_seed_v1_postcheck.sql | None detected | checks<br>public.historical_feature_snapshots<br>public.prediction_epochs<br>public.prediction_history<br>public.sports_sync_jobs<br>row_counts |
| Prediction Module | supabase/migrations/checks/202607270002_prediction_epoch_governance_seed_v1_precheck.sql | None detected | canonical_conflicts<br>checks<br>information_schema.columns<br>public.historical_feature_snapshots<br>public.prediction_epochs<br>public.prediction_history<br>public.sports_sync_jobs<br>row_counts |
| Prediction Module | supabase/migrations/rollback/202607270001_prediction_epoch_governance_v2_rollback.sql | None detected | information_schema.columns<br>public.prediction_epochs<br>public.prediction_history |
| Prediction Module | supabase/migrations/rollback/202607270002_prediction_epoch_governance_seed_v1_rollback.sql | None detected | public.prediction_epochs<br>public.prediction_history |
| Provider | docs/PROVIDER_BUDGET_POLICY_V1.md | None detected | None detected |
| Provider | docs/PROVIDER_BUDGET_POLICY.md | None detected | None detected |
| Provider | docs/provider-adapter-sdk-v1.md | None detected | None detected |
| Provider | docs/provider-intelligence-v1.md | None detected | being<br>configured<br>live<br>the |
| Provider | docs/providers/sportsdataio/CAPABILITY_MATRIX.md | None detected | None detected |
| Provider | docs/providers/sportsdataio/MLB.md | None detected | provider |
| Provider | src/services/provider-adapter-sdk.service.ts | @/config/sports.config<br>@/services/multi-sport-normalizers.service<br>@/services/provider-intelligence.service<br>@/types/multi-sport | None detected |
| Provider | src/services/provider-intelligence.service.ts | @/config/sports.config<br>@/services/multi-sport-markets.service<br>@/services/multi-sport-providers.service<br>@/services/multi-sport-registry.service<br>@/types/multi-sport | None detected |
| Repository | src/services/daily-report-fast.service.ts | @/lib/supabase-admin<br>@/services/analysis-explainer.service<br>@/services/clv-analytics.service<br>@/services/current-board.service<br>@/services/model-calibration.service<br>@/services/model-learning.service<br>@/services/production-data-gate.service<br>@/services/top-picks.service | saved<br>sports_sync_jobs |
| Repository | src/services/daily-report.service.ts | @/services/analysis-explainer.service<br>@/services/bankroll-manager.service<br>@/services/clv-analytics.service<br>@/services/model-calibration.service<br>@/services/model-learning.service<br>@/services/portfolio-builder.service<br>@/services/production-data-gate.service<br>@/services/sportsbook-intelligence.service | None detected |
| Script | scripts/ai-model-strategy-v1.mjs | @/lib/supabase-admin<br>node:crypto<br>node:fs | historical_feature_snapshots<br>prediction_history |
| Script | scripts/historical-completion-v1-a1-baseline.mjs | @supabase/supabase-js<br>node:fs | required |
| Script | scripts/historical-completion-v1-a2-matrix.mjs | @supabase/supabase-js<br>node:fs | None detected |
| Script | scripts/historical-evidence-expansion-v1.mjs | node:crypto<br>node:fs | None detected |
| Script | scripts/historical-evidence-recovery-v1.mjs | @/lib/supabase-admin<br>@/services/canonical-settlement-state.service<br>@/services/prediction-cutoff-enforcement.service<br>node:crypto<br>node:fs | game_results<br>historical_feature_snapshots<br>prediction_history |
| Script | scripts/historical-learning-foundation-v1.mjs | ../src/services/historical-learning-foundation-v1.service.ts<br>node:fs | None detected |
| Script | scripts/historical-settled-status-reconciliation-v1.mjs | ../src/lib/supabase-admin.ts<br>../src/services/canonical-settlement-state.service.ts<br>node:fs | game_results |
| Script | scripts/historical-shadow-calibration.mjs | ../src/services/historical-shadow-calibration.service.ts<br>node:fs | None detected |
| Script | scripts/historical-training-readiness-v1.mjs | node:crypto<br>node:fs | production |
| Script | scripts/live-multi-sport-acquisition-v1-checkpoint-a.mjs | @/services/data-coverage-inventory.service<br>@/services/multi-sport-data-expansion-final.service<br>@/services/multi-sport-provider-entitlement-audit.service<br>@/services/provider-budget.service<br>node:fs<br>node:path | None detected |
| Script | scripts/live-multi-sport-acquisition-v1-checkpoint-b-mlb.mjs | @/services/data-coverage-inventory.service<br>@/services/provider-budget.service<br>@/services/sportsdataio-mlb-historical-import-executor.service<br>node:fs<br>node:path | None detected |
| Script | scripts/live-multi-sport-acquisition-v1-checkpoint-c-nba-nfl.mjs | @/services/data-coverage-inventory.service<br>@/services/provider-budget.service<br>@/services/sportsdataio-historical-import-readiness.service<br>node:fs<br>node:path | None detected |
| Script | scripts/mlb-canonical-settlement-backlog-closure-v1.mjs | @/lib/supabase-admin<br>@/services/ai-learning-lifecycle.service<br>@/services/operating-day.service<br>node:fs | game_results<br>immutable<br>operating_days<br>prediction_history |
| Script | scripts/mlb-operating-day-product-state-v1.mjs | ../src/services/adaptive-refresh-orchestrator.service.ts<br>../src/services/autonomous-daily-operations.service.ts<br>../src/services/current-board.service.ts<br>../src/services/dashboard-today.service.ts<br>../src/services/recommendation-pipeline-trace.service.ts<br>node:fs | None detected |
| Script | scripts/mlb-operating-day-recovery-smoke.mjs | node:child_process<br>node:util | None detected |
| Script | scripts/multi-sport-results-crosswalk-foundation-v1.mjs | @supabase/supabase-js<br>node:child_process<br>node:fs<br>node:path | Preview<br>game_results<br>sports_sync_jobs |
| Script | scripts/multi-sport-unlock-v1-checkpoint-b-nba.mjs | ../src/services/multi-sport-results-crosswalk-foundation.service.ts<br>../src/services/nba-prediction-engine.service.ts<br>../src/services/nba-prediction-settlement.service.ts<br>@supabase/supabase-js<br>node:child_process<br>node:fs<br>node:path | Production |
| Script | scripts/multi-sport-unlock-v1-checkpoint-c-nfl.mjs | ../src/services/multi-sport-results-crosswalk-foundation.service.ts<br>../src/services/nfl-prediction-engine.service.ts<br>@supabase/supabase-js<br>node:child_process<br>node:fs<br>node:path | Preview |
| Script | scripts/multi-sport-unlock-v1-checkpoint-d-nhl.mjs | ../src/services/multi-sport-results-crosswalk-foundation.service.ts<br>../src/services/nhl-prediction-engine.service.ts<br>@supabase/supabase-js<br>node:child_process<br>node:fs<br>node:path | Preview |
| Script | scripts/multi-sport-unlock-v1-checkpoint-e-soccer.mjs | ../src/services/multi-sport-results-crosswalk-foundation.service.ts<br>../src/services/soccer-feature-store-integration.service.ts<br>../src/services/soccer-prediction-engine.service.ts<br>@supabase/supabase-js<br>node:child_process<br>node:fs<br>node:path | Preview<br>sports_odds_snapshots |
| Script | scripts/multi-sport-unlock-v1-checkpoint-f-tennis-ufc.mjs | ../src/services/multi-sport-results-crosswalk-foundation.service.ts<br>../src/services/tennis-feature-store-integration.service.ts<br>../src/services/tennis-prediction-engine.service.ts<br>../src/services/ufc-feature-store-integration.service.ts<br>../src/services/ufc-prediction-engine.service.ts<br>@supabase/supabase-js<br>node:child_process<br>node:fs | Preview |
| Script | scripts/platform-consolidation-duplication-cleanup-v1.mjs | node:fs<br>node:path | None detected |
| Script | scripts/prediction-epoch-governance-seed-v1-fixtures.mjs | node:fs | public |
| Script | scripts/product-navigation-freshness-v1-smoke.mjs | None detected | None detected |
| Script | scripts/retrosheet-feature-backfill.mjs | ../src/lib/supabase-admin.ts<br>../src/services/retrosheet-historical-feature-store.service.ts<br>node:crypto<br>node:fs<br>node:os<br>node:process | historical_feature_snapshots<br>historical_import_checkpoints<br>historical_import_registry<br>sports_sync_jobs |
| Script | scripts/retrosheet-production-isolation-probe.mjs | @supabase/supabase-js<br>fs | sports_sync_jobs |
| Script | scripts/six-historical-settlement-conflict-resolution-v1.mjs | ../src/lib/supabase-admin.ts<br>../src/services/canonical-settlement-state.service.ts<br>node:fs | game_results<br>prediction_history<br>provider_entity_mappings<br>sport_events |
| Script | scripts/the-odds-api-current-odds-v1.mjs | ../src/services/the-odds-api-current-odds-acquisition.service.ts<br>node:child_process<br>node:fs<br>node:path | None detected |
| Script | scripts/the-odds-api-historical-mlb-core-import-v1.mjs | @supabase/supabase-js<br>node:child_process<br>node:crypto<br>node:fs<br>node:path | sports_odds_snapshots<br>sports_sync_jobs |
| Script | scripts/the-odds-api-market-history-materialization-v1.mjs | @supabase/supabase-js<br>node:child_process<br>node:fs<br>node:path | stored |
| Script | scripts/the-odds-api-maximum-utilization-v1-checkpoint1.mjs | ../src/services/the-odds-api-maximum-utilization.service.ts<br>node:child_process<br>node:fs<br>node:path | None detected |
| Script | scripts/the-odds-api-player-props-v1.mjs | @supabase/supabase-js<br>node:child_process<br>node:crypto<br>node:fs<br>node:path | sports_odds_snapshots<br>sports_sync_jobs |
| Script | scripts/the-odds-api-scores-results-v1.mjs | @supabase/supabase-js<br>node:child_process<br>node:fs<br>node:path | game_results<br>sports_sync_jobs<br>weaker |
| Script | scripts/training-safe-feature-governance-v1.mjs | @/lib/supabase-admin<br>@/services/training-feature-governance-v1.service<br>node:crypto<br>node:fs | historical_feature_snapshots<br>model<br>prediction_history |
| Service | src/services/adaptive-refresh-orchestrator.service.ts | @/config/mlb-operating-day-scheduler<br>@/lib/supabase-admin<br>@/services/active-event.service<br>@/services/canonical-settlement-state.service<br>@/services/current-board.service<br>@/services/dashboard-today.service<br>@/services/mlb-operating-date-resolution.service<br>@/services/next-slate.service | completed<br>game_results<br>operating_day_lifecycle_events<br>prediction_history<br>sport_events<br>stored |
| Service | src/services/adaptive-weight-engine.service.ts | @/lib/supabase-admin<br>@/services/production-data-gate.service | prediction_history |
| Service | src/services/advanced-factors.service.ts | @/lib/supabase-admin | injuries<br>pitcher_stats<br>weather_impacts |
| Service | src/services/ai-bet-finder.service.ts | @/lib/supabase-admin<br>@/services/best-value-scanner.service<br>@/services/bet-slip-optimizer.service<br>@/services/current-board.service<br>@/services/market-intelligence-category.service<br>@/services/market-opportunity-suite.service<br>@/services/provider-time-normalization.service<br>@/services/top-picks.service | current<br>informational<br>prediction_history<br>stored |
| Service | src/services/ai-coach.service.ts | @/lib/supabase-admin<br>@/services/production-data-gate.service | prediction_history |
| Service | src/services/ai-copilot-chat.service.ts | @/services/ai-copilot.service | the |
| Service | src/services/ai-copilot.service.ts | @/services/advanced-factors.service<br>@/services/ai-game-analysis.service | the |
| Service | src/services/ai-game-analysis.service.ts | @/services/analytics.service<br>@/services/top-picks.service | None detected |
| Service | src/services/ai-learning-lifecycle.service.ts | @/lib/supabase-admin<br>@/services/canonical-settlement-state.service<br>@/services/historical-replay-pilot.service<br>@/services/historical-shadow-calibration.service<br>@/services/mlb-first-five-readiness.service<br>@/services/mlb-player-projection-engine.service<br>@/services/mlb-player-props-readiness-audit.service<br>@/services/mlb-starter-intelligence.service | persisted<br>production<br>replay<br>settled<br>stored |
| Service | src/services/ai-performance-center.service.ts | @/config/sports.config<br>@/lib/supabase-admin<br>@/services/bsn-model-maturity.service<br>@/services/current-board.service<br>@/services/feature-store-core.service<br>@/services/model-calibration.service<br>@/services/sport-prediction-engine-sdk.service<br>@/services/universal-projection-engine.service | MLB<br>ai_performance_snapshots<br>measured<br>prediction_history<br>stored |
| Service | src/services/ai-pick-explainer.service.ts | None detected | None detected |
| Service | src/services/ai-trading-advisor.service.ts | None detected | None detected |
| Service | src/services/analytics-charts.service.ts | @/lib/supabase-admin<br>@/services/production-data-gate.service | prediction_history |
| Service | src/services/analytics.service.ts | @/lib/supabase-admin<br>@/services/production-data-gate.service | prediction_history |
| Service | src/services/autonomous-daily-ai.service.ts | @/services/adaptive-refresh-orchestrator.service<br>@/services/autonomous-daily-operations.service<br>@/services/provider-budget.service | None detected |
| Service | src/services/autonomous-daily-operations.service.ts | @/lib/supabase-admin<br>@/services/best-bets-today.service<br>@/services/best-value-scanner.service<br>@/services/current-board.service<br>@/services/market-opportunity-suite.service<br>@/services/market-semantics.service<br>@/services/mlb-ai-coach.service<br>@/services/mlb-data-quality.service | prediction_history<br>settled |
| Service | src/services/basketball-source-framework.service.ts | @/config/sports.config<br>@/services/basketball/connectors/official-bsn-homepage.connector<br>@/types/multi-sport | None detected |
| Service | src/services/basketball/acquisition/bsn-acquisition-engine.ts | @/lib/supabase-admin<br>@/services/basketball-source-framework.service<br>@/services/basketball/connectors/official-bsn-homepage.connector<br>@/services/basketball/history/historical-builder<br>@/services/basketball/knowledge/knowledge-layer<br>@/services/basketball/normalizers/canonical<br>@/services/basketball/reconciliation/reconciliation-engine<br>@/services/feature-store-core.service | provider_entity_mappings<br>sport_events<br>sport_players<br>sport_standings<br>sports_sync_jobs<br>sports_teams<br>the |
| Service | src/services/basketball/builders/platform.service.ts | @/config/sports.config<br>@/services/basketball-source-framework.service<br>@/services/basketball/contracts/capabilities<br>@/services/basketball/history/historical-builder<br>@/services/basketball/mappers/existing-platform-mapper<br>@/services/basketball/metrics/platform-metrics<br>@/services/basketball/normalizers/canonical<br>@/services/basketball/reconciliation/reconciliation-engine | None detected |
| Service | src/services/basketball/history/bsn-historical-reconstruction.ts | @/lib/supabase-admin<br>@/services/basketball-source-framework.service<br>@/services/basketball/builders/platform.service<br>@/services/basketball/history/historical-builder<br>@/services/basketball/knowledge/knowledge-layer<br>@/services/bsn-platform.service<br>@/services/feature-store-core.service<br>@/services/sport-prediction-engine-sdk.service | None detected |
| Service | src/services/basketball/history/historical-builder.ts | @/services/basketball-source-framework.service<br>@/services/basketball/contracts/capabilities<br>@/services/basketball/knowledge/knowledge-layer<br>@/services/feature-store-core.service<br>@/services/historical-import-engine.service<br>@/services/sport-prediction-engine-sdk.service | None detected |
| Service | src/services/basketball/index.ts | @/services/basketball/acquisition/bsn-acquisition-engine<br>@/services/basketball/builders/platform.service<br>@/services/basketball/history/bsn-historical-reconstruction<br>@/services/basketball/history/historical-builder<br>@/services/basketball/knowledge/knowledge-layer<br>@/services/basketball/normalizers/canonical<br>@/services/basketball/reconciliation/reconciliation-engine | None detected |
| Service | src/services/basketball/knowledge/knowledge-layer.ts | @/services/basketball/types/entities | None detected |
| Service | src/services/basketball/mappers/existing-platform-mapper.ts | None detected | None detected |
| Service | src/services/best-bets-today.service.ts | @/services/current-board.service<br>@/services/market-alignment.service<br>@/services/market-intelligence-category.service<br>@/services/market-semantics.service | stored |
| Service | src/services/best-value-scanner.service.ts | @/services/current-board.service<br>@/services/explainable-intelligence.service<br>@/services/market-intelligence-category.service<br>@/services/provider-time-normalization.service | None detected |
| Service | src/services/bet-slip-optimizer.service.ts | @/services/recommendation-eligibility-policy.service<br>@/services/top-picks.service | None detected |
| Service | src/services/bsn-core-certification.service.ts | @/services/bsn-intelligence-engine.service<br>@/services/bsn-model-maturity.service<br>@/services/bsn-platform.service<br>@/services/bsn-shadow-prediction-engine.service<br>@/services/market-alignment.service<br>@/services/market-semantics.service<br>@/services/mlb-ai-picks-feed.service<br>@/services/official-pick-experience.service | None detected |
| Service | src/services/bsn-historical-foundation-v2.service.ts | @/lib/supabase-admin<br>@/services/data-foundation-coverage.service | None detected |
| Service | src/services/bsn-intelligence-engine.service.ts | @/lib/supabase-admin<br>@/services/basketball/builders/platform.service<br>@/services/basketball/history/historical-builder<br>@/services/basketball/knowledge/knowledge-layer<br>@/services/bsn-platform.service<br>@/services/feature-store-core.service<br>@/services/sport-prediction-engine-sdk.service | None detected |
| Service | src/services/bsn-model-maturity.service.ts | @/services/basketball/builders/platform.service<br>@/services/basketball/history/historical-builder<br>@/services/bsn-intelligence-engine.service<br>@/services/bsn-shadow-prediction-engine.service<br>@/services/feature-store-core.service<br>@/services/sport-prediction-engine-sdk.service | None detected |
| Service | src/services/bsn-platform.service.ts | @/lib/supabase-admin<br>@/services/basketball-source-framework.service | last<br>sport_events<br>stage<br>team<br>venue |
| Service | src/services/bsn-predictions.service.ts | @/services/bsn-shadow-prediction-engine.service | None detected |
| Service | src/services/bsn-shadow-prediction-engine.service.ts | @/lib/supabase-admin<br>@/services/basketball/builders/platform.service<br>@/services/basketball/history/historical-builder<br>@/services/bsn-intelligence-engine.service<br>@/services/feature-store-core.service<br>@/services/sport-prediction-engine-sdk.service | None detected |
| Service | src/services/canonical-settlement-state.service.ts | @/services/prediction-cutoff-enforcement.service | None detected |
| Service | src/services/closing-line-intelligence.service.ts | @/lib/supabase-admin<br>@/services/market-alignment.service<br>@/services/production-data-gate.service | prediction_history<br>sport_events<br>sports_odds_snapshots |
| Service | src/services/clv-analytics.service.ts | @/lib/supabase-admin<br>@/services/production-data-gate.service | prediction_history |
| Service | src/services/clv.service.ts | @/lib/supabase-admin<br>@/services/production-data-gate.service | prediction_history |
| Service | src/services/current-board.service.ts | @/lib/server-schema-capabilities<br>@/lib/supabase-admin<br>@/services/active-event.service<br>@/services/explainable-intelligence.service<br>@/services/market-alignment.service<br>@/services/market-intelligence-category.service<br>@/services/market-semantics.service<br>@/services/mlb-ai-picks-feed.service | official<br>prediction_history<br>sport_events<br>sports_odds_snapshots<br>stored |
| Service | src/services/daily-pipeline.service.ts | @/config/sports.config<br>@/services/historical-feature-generation.service<br>@/services/nba-data-quality.service<br>@/services/nba-data-sync.service<br>@/services/nba-feature-store-integration.service<br>@/services/nba-prediction-engine.service<br>@/services/nba-prediction-settlement.service<br>@/services/prediction-history.service | Player.Status<br>persisted |
| Service | src/services/data-coverage-inventory.service.ts | @/services/data-foundation-coverage.service | prediction<br>settled<br>stored |
| Service | src/services/data-foundation-coverage.service.ts | @/lib/supabase-admin | None detected |
| Service | src/services/data-foundation-quality-v2.service.ts | @/services/data-foundation-coverage.service<br>@/services/prediction-epoch-migration-state.service | None detected |
| Service | src/services/data-foundation-season-governance.service.ts | @/config/sports.config | None detected |
| Service | src/services/day1-recommendation-readiness.service.ts | @/services/bet-slip-optimizer.service<br>@/services/current-board.service<br>@/services/recommendation-eligibility-policy.service<br>@/services/top-picks.service | currently |
| Service | src/services/epoch-performance-learning-v2.service.ts | @/lib/supabase-admin<br>@/services/prediction-epoch-migration-state.service | prediction_history |
| Service | src/services/explainable-intelligence.service.ts | None detected | None detected |
| Service | src/services/feature-rebuild-plan-v2.service.ts | @/lib/supabase-admin | None detected |
| Service | src/services/feature-store-core.service.ts | @/config/sports.config<br>@/services/production-data-gate.service<br>@/types/multi-sport | completed<br>normalized<br>pre<br>pregame<br>the |
| Service | src/services/future-only-prediction-continuity-v2.service.ts | @/lib/supabase-admin<br>@/services/prediction-epoch-migration-state.service | prediction_history |
| Service | src/services/game-intelligence.service.ts | @/lib/supabase-admin<br>@/services/current-board.service<br>@/services/explainable-intelligence.service<br>@/services/market-intelligence-category.service<br>@/services/mlb-current-lineup-context.service<br>@/services/mlb-player-projection-engine.service<br>@/services/mlb-starter-intelligence.service<br>@/services/projection-evolution.service | sport_events<br>sport_lineups<br>stored<br>universal_projection_history |
| Service | src/services/global-data-quality.service.ts | @/config/sports.config<br>@/lib/supabase-admin<br>@/services/multi-sport-registry.service<br>@/services/provider-intelligence.service | prediction_history<br>sport_events<br>sports_odds_snapshots<br>sports_sync_jobs |
| Service | src/services/historical-feature-generation.service.ts | @/config/sports.config<br>@/lib/server-schema-capabilities<br>@/lib/supabase-admin<br>@/services/feature-store-core.service<br>@/services/multi-sport-feature-registry.service<br>@/services/nba-prediction-settlement.service<br>@/services/settlement-core.service<br>@/services/sport-prediction-engine-sdk.service | feature<br>historical_feature_snapshots<br>prediction_history<br>sport_events<br>sport_lineups<br>sport_player_stats<br>sports_odds_snapshots<br>the |
| Service | src/services/historical-import-engine.service.ts | @/config/sports.config<br>@/lib/server-schema-capabilities<br>@/lib/supabase-admin<br>@/services/historical-feature-generation.service<br>@/services/multi-sport-registry.service<br>@/services/provider-intelligence.service<br>@/services/sync-reliability.service | Discovery<br>provider_entity_mappings<br>sports_sync_jobs<br>the<br>this<br>trial<br>while |
| Service | src/services/historical-learning-foundation-v1.service.ts | @/lib/supabase-admin<br>@/services/canonical-settlement-state.service<br>@/services/prediction-cutoff-enforcement.service<br>node:crypto | game_results<br>prediction_history |
| Service | src/services/historical-replay-pilot.service.ts | @/lib/supabase-admin<br>@/services/settlement-core.service<br>crypto | historical<br>historical_baseball_games<br>historical_feature_snapshots<br>historical_import_checkpoints<br>production<br>sports_sync_jobs<br>stored<br>universal_projection_history |
| Service | src/services/historical-shadow-calibration.service.ts | @/lib/supabase-admin | universal_projection_history |
| Service | src/services/legacy-prediction-metric-isolation-v2.service.ts | @/lib/supabase-admin<br>@/services/prediction-epoch-migration-state.service | active<br>prediction_history |
| Service | src/services/legacy-prediction-provenance.service.ts | @/lib/supabase-admin | prediction_history<br>production<br>sport_events |
| Service | src/services/live-betting.service.ts | @/services/betting-explanation.service<br>@/services/kelly.service<br>@/services/market-intelligence.service<br>@/services/market-movement.service<br>@/services/prediction.service<br>@/services/risk-grade.service<br>@/services/sharp-money.service | None detected |
| Service | src/services/live-provider-verification.service.ts | @/config/sportsdataio-endpoint-catalog<br>@/lib/supabase-admin<br>@/services/basketball/connectors/official-bsn-homepage.connector<br>@/services/sportsdataio-discovery-lab-url.service<br>@/services/universal-projection-engine.service | sports_sync_jobs |
| Service | src/services/market-alignment.service.ts | @/services/market-semantics.service | None detected |
| Service | src/services/market-intelligence-category.service.ts | @/services/current-board.service | None detected |
| Service | src/services/market-intelligence-engine.service.ts | @/services/best-value-scanner.service<br>@/services/current-board.service<br>@/services/market-intelligence-category.service<br>@/services/market-opportunity-suite.service | official |
| Service | src/services/market-opportunity-suite.service.ts | @/lib/supabase-admin<br>@/services/current-board.service<br>@/services/explainable-intelligence.service<br>@/services/market-intelligence-category.service<br>@/services/market-semantics.service<br>@/services/model-only-intelligence.service<br>@/services/provider-time-normalization.service | sport_events<br>sports_odds_snapshots<br>stored<br>the<br>this |
| Service | src/services/master-sync.service.ts | None detected | None detected |
| Service | src/services/missing-canonical-events-recovery.service.ts | @/lib/supabase-admin | None detected |
| Service | src/services/mlb-ai-coach.service.ts | @/services/best-bets-today.service<br>@/services/current-board.service<br>@/services/market-opportunity-suite.service<br>@/services/mlb-data-quality.service<br>@/services/mlb-games-payload-audit.service<br>@/services/mlb-missing-intelligence.service<br>@/services/mlb-model-platform.service<br>@/services/mlb-provider-capability-audit.service | current<br>pitching<br>populated<br>the |
| Service | src/services/mlb-ai-picks-feed.service.ts | @/services/current-board.service<br>@/services/explainable-intelligence.service<br>@/services/market-semantics.service<br>@/services/official-pick-experience.service | an<br>current |
| Service | src/services/mlb-autonomous-operations-v1.service.ts | @/config/mlb-operating-day-scheduler<br>@/services/adaptive-refresh-orchestrator.service<br>@/services/operations-health.service<br>@/services/provider-budget.service | prediction<br>settled<br>sport_events<br>stored |
| Service | src/services/mlb-current-season-data-quality-audit.service.ts | @/lib/supabase-admin<br>@/services/mlb-current-season-backfill-orchestrator.service | None detected |
| Service | src/services/mlb-data-quality.service.ts | @/services/current-board.service<br>@/services/mlb-games-payload-audit.service<br>@/services/mlb-missing-intelligence.service<br>@/services/mlb-model-platform.service<br>@/services/mlb-odds-coverage.service<br>@/services/mlb-starter-weather-stadium-intelligence.service | None detected |
| Service | src/services/mlb-feature-model-readiness.service.ts | @/services/mlb-current-season-data-quality-audit.service<br>@/services/mlb-feature-store-integration.service | backtesting<br>high<br>model |
| Service | src/services/mlb-feature-store-integration.service.ts | @/lib/supabase-admin<br>@/services/feature-store-core.service<br>@/services/mlb-starter-weather-stadium-intelligence.service<br>@/services/multi-sport-feature-registry.service | prediction_history |
| Service | src/services/mlb-first-five-readiness.service.ts | @/lib/supabase-admin<br>@/services/market-semantics.service<br>@/services/mlb-starter-intelligence.service | None detected |
| Service | src/services/mlb-freshness-policy.service.ts | None detected | stored |
| Service | src/services/mlb-game-lifecycle.service.ts | @/services/provider-time-normalization.service | elapsed<br>live |
| Service | src/services/mlb-historical-foundation-v2.service.ts | @/lib/supabase-admin<br>@/services/data-foundation-coverage.service | different<br>provider_entity_mappings<br>sport_events |
| Service | src/services/mlb-learning-brain.service.ts | @/lib/supabase-admin<br>@/services/active-event.service<br>@/services/mlb-projection-integrity.service<br>crypto | stored<br>universal_projection_history |
| Service | src/services/mlb-market-capability-registry.service.ts | @/lib/supabase-admin | sport_events |
| Service | src/services/mlb-market-expansion-roadmap.service.ts | @/config/sportsdataio-endpoint-catalog<br>@/services/mlb-odds-coverage.service<br>@/services/production-readiness-audit.service | existing<br>full<br>official<br>provider |
| Service | src/services/mlb-market-pipeline-diagnostics.service.ts | @/lib/supabase-admin<br>@/services/current-board.service<br>@/services/provider-time-normalization.service | prediction_history<br>sport_events<br>sports_odds_snapshots |
| Service | src/services/mlb-missing-intelligence.service.ts | @/config/sportsdataio-endpoint-catalog<br>@/lib/supabase-admin<br>@/services/mlb-model-platform.service<br>@/services/mlb-starter-weather-stadium-intelligence.service<br>@/services/provider-budget.service<br>@/services/sportsdataio-discovery-lab-url.service | Player.Status.<br>provider_entity_mappings<br>season<br>sport_injuries<br>sport_lineups<br>sport_player_stats<br>sport_players<br>sports_sync_jobs |
| Service | src/services/mlb-model-audit.service.ts | @/lib/supabase-admin<br>@/services/mlb-feature-model-readiness.service | prediction_history |
| Service | src/services/mlb-model-platform.service.ts | @/lib/server-schema-capabilities<br>@/lib/supabase-admin<br>@/services/mlb-starter-weather-stadium-intelligence.service<br>@/services/provider-time-normalization.service | cached<br>prediction_history<br>provider_entity_mappings<br>source<br>sport_player_stats<br>sport_players |
| Service | src/services/mlb-odds-coverage.service.ts | @/lib/supabase-admin<br>@/services/current-board.service<br>@/services/provider-time-normalization.service | prediction_history<br>sport_events<br>sports_odds_snapshots<br>sports_sync_jobs |
| Service | src/services/mlb-operating-date-resolution.service.ts | @/lib/supabase-admin<br>@/services/active-event.service<br>@/services/mlb-game-lifecycle.service<br>@/services/provider-time-normalization.service | sport_events |
| Service | src/services/mlb-operations-center.service.ts | @/services/autonomous-daily-operations.service<br>@/services/current-board.service<br>@/services/mlb-data-quality.service<br>@/services/mlb-missing-intelligence.service<br>@/services/mlb-prediction-engine.service<br>@/services/operating-day-automation.service<br>@/services/operating-day.service<br>@/services/provider-budget.service | SportsDataIO<br>production |
| Service | src/services/mlb-pitcher-feature-builder.service.ts | @/lib/supabase-admin<br>@/types/mlb-pitcher-projections | historical_baseball_games<br>historical_baseball_pitcher_appearances |
| Service | src/services/mlb-pitcher-projection-engine.service.ts | @/lib/supabase-admin<br>@/services/active-event.service<br>@/services/mlb-pitcher-feature-builder.service<br>@/services/mlb-projection-integrity.service<br>@/services/mlb-starter-sync.service<br>@/types/mlb-pitcher-projections | mlb_pitcher_projections<br>sport_events |
| Service | src/services/mlb-player-data-excellence.service.ts | @/lib/supabase-admin<br>@/services/mlb-player-props-foundation.service<br>@/services/mlb-projection-integrity.service | final<br>over |
| Service | src/services/mlb-player-projection-engine.service.ts | @/lib/supabase-admin<br>@/services/active-event.service<br>@/services/mlb-current-lineup-context.service<br>@/services/universal-projection-engine.service | bounded<br>historical_baseball_batter_appearances<br>historical_baseball_pitcher_appearances<br>sport_player_stats<br>starter<br>stored<br>universal_projection_history |
| Service | src/services/mlb-player-prop-comparison.service.ts | @/config/mlb-player-prop-markets<br>@/lib/supabase-admin<br>@/services/mlb-pitcher-projection-engine.service<br>@/types/mlb-pitcher-projections<br>@/types/mlb-player-prop-comparison<br>crypto | comparison<br>mlb_pitcher_projections<br>probability<br>sports_odds_snapshots |
| Service | src/services/mlb-player-prop-sync.service.ts | @/config/mlb-player-prop-markets<br>@/config/sportsdataio-endpoint-catalog<br>@/lib/supabase-admin<br>@/services/mlb-pitcher-projection-engine.service<br>@/services/provider-budget.service<br>@/services/the-odds-api-event-crosswalk.service<br>@/services/the-odds-api-pitcher-identity-bridge.service<br>@/types/mlb-player-prop-ingestion | mlb_pitcher_projections<br>provider_entity_mappings<br>sport_events<br>sport_players<br>sports_odds_snapshots<br>stored<br>the |
| Service | src/services/mlb-player-props-foundation.service.ts | @/config/sportsdataio-endpoint-catalog<br>@/lib/supabase-admin<br>@/services/sportsdataio-runtime-adapter.service | sports_odds_snapshots |
| Service | src/services/mlb-player-props-readiness-audit.service.ts | @/lib/supabase-admin | hit |
| Service | src/services/mlb-prediction-engine.service.ts | @/services/mlb-feature-store-integration.service<br>@/services/sport-prediction-engine-sdk.service | None detected |
| Service | src/services/mlb-projected-score.service.ts | @/services/current-board.service | stored |
| Service | src/services/mlb-projection-integrity.service.ts | crypto | None detected |
| Service | src/services/mlb-provider-capability-audit.service.ts | @/config/sportsdataio-endpoint-catalog<br>@/services/mlb-data-quality.service<br>@/types/sportsdataio-mlb | Discovery |
| Service | src/services/mlb-starter-weather-stadium-intelligence.service.ts | @/lib/supabase-admin<br>@/services/provider-time-normalization.service | sport_events<br>sports_sync_jobs |
| Service | src/services/mlb-team-totals-readiness.service.ts | @/lib/supabase-admin<br>@/services/market-semantics.service | None detected |
| Service | src/services/mlb-temporal-health.service.ts | @/lib/supabase-admin<br>@/services/active-event.service<br>@/services/adaptive-refresh-orchestrator.service<br>@/services/current-board.service<br>@/services/mlb-freshness-policy.service<br>@/services/mlb-game-lifecycle.service<br>@/services/provider-time-normalization.service<br>@/services/universal-projection-engine.service | prediction_history<br>sport_events<br>this |
| Service | src/services/model-backtest.service.ts | @/lib/supabase-admin<br>@/services/production-data-gate.service | prediction_history |
| Service | src/services/model-calibration.service.ts | @/lib/supabase-admin<br>@/services/production-data-gate.service | prediction_history |
| Service | src/services/model-learning.service.ts | @/lib/supabase-admin<br>@/services/model-backtest.service<br>@/services/model-calibration.service<br>@/services/model-versioning.service<br>@/services/production-data-gate.service<br>@/services/weight-optimizer.service | model_versions<br>model_weight_history<br>model_weights<br>prediction_history |
| Service | src/services/model-metrics-framework.service.ts | @/lib/supabase-admin<br>@/services/production-data-gate.service | prediction_history |
| Service | src/services/model-only-intelligence.service.ts | @/lib/supabase-admin | prediction_history<br>sport_events<br>universal_projection_history |
| Service | src/services/model-versioning.service.ts | @/lib/supabase-admin | model_versions |
| Service | src/services/multi-sport-adapters.service.ts | @/config/sports.config<br>@/services/bsn-platform.service<br>@/services/bsn.service<br>@/services/multi-sport-normalizers.service<br>@/services/multi-sport-registry.service<br>@/services/nba-adapter.service<br>@/types/multi-sport | None detected |
| Service | src/services/multi-sport-data-expansion-checkpoint2.service.ts | @/services/data-coverage-inventory.service<br>@/services/historical-import-engine.service<br>@/services/multi-sport-provider-entitlement-audit.service<br>@/services/provider-intelligence.service | dry |
| Service | src/services/multi-sport-data-expansion-checkpoint3.service.ts | @/services/data-coverage-inventory.service<br>@/services/historical-import-engine.service<br>@/services/multi-sport-provider-entitlement-audit.service<br>@/services/provider-intelligence.service | None detected |
| Service | src/services/multi-sport-data-expansion-final.service.ts | @/services/data-coverage-inventory.service<br>@/services/multi-sport-data-expansion-checkpoint2.service<br>@/services/multi-sport-data-expansion-checkpoint3.service<br>@/services/multi-sport-provider-entitlement-audit.service | this |
| Service | src/services/multi-sport-feature-registry.service.ts | @/config/sports.config<br>@/services/feature-store-core.service<br>@/types/multi-sport | None detected |
| Service | src/services/multi-sport-provider-entitlement-audit.service.ts | @/services/multi-sport-providers.service<br>@/services/provider-intelligence.service<br>@/services/sportsdataio-subscription-maximization-audit.service<br>@/services/the-odds-api-capability-audit.service | static |
| Service | src/services/multi-sport-providers.service.ts | @/config/sports.config<br>@/types/multi-sport | None detected |
| Service | src/services/multi-sport-resolution.service.ts | @/config/sports.config<br>@/services/multi-sport-adapters.service<br>@/services/multi-sport-markets.service<br>@/services/multi-sport-providers.service<br>@/services/multi-sport-registry.service | None detected |
| Service | src/services/multi-sport-results-crosswalk-foundation.service.ts | @/config/sports.config<br>@/lib/supabase-admin | None detected |
| Service | src/services/nba-adapter.service.ts | @/lib/supabase-admin | prediction_history<br>team_stats |
| Service | src/services/nba-backtesting-calibration.service.ts | @/lib/server-schema-capabilities<br>@/lib/supabase-admin<br>@/services/historical-feature-generation.service<br>@/services/nba-prediction-validation.service<br>@/services/production-data-gate.service | prediction_history<br>production |
| Service | src/services/nba-data-quality.service.ts | @/lib/supabase-admin<br>@/services/nba-data-sync.service<br>@/services/nba-prediction-validation.service | confidence<br>game_results<br>prediction<br>prediction_history<br>provider_entity_mappings<br>sport_events<br>sport_game_stats<br>sport_injuries |
| Service | src/services/nba-data-sync.service.ts | @/lib/supabase-admin<br>@/services/historical-feature-generation.service<br>@/services/mlb-event-status-mapper.service<br>@/services/multi-sport-health.service<br>@/services/multi-sport-query.service<br>@/services/results-sync.service<br>@/types/multi-sport | game_results<br>prediction<br>sport_events<br>sport_standings<br>sports_odds_snapshots<br>sports_sync_jobs<br>sports_teams<br>stored |
| Service | src/services/nba-feature-store-integration.service.ts | @/lib/supabase-admin<br>@/services/feature-store-core.service<br>@/services/multi-sport-feature-registry.service<br>@/services/nba-injury-lineup-confidence.service | prediction_history<br>sport_player_stats |
| Service | src/services/nba-historical-foundation-v2.service.ts | @/lib/supabase-admin<br>@/services/data-foundation-coverage.service | prediction_history<br>production |
| Service | src/services/nba-injury-lineup-confidence.service.ts | @/lib/supabase-admin<br>@/services/sportsdataio-runtime-adapter.service | production<br>sport_injuries<br>sport_lineups |
| Service | src/services/nba-multi-book-comparison.service.ts | @/lib/supabase-admin<br>@/services/nba-data-sync.service<br>@/services/nba-prediction-validation.service | sport_events<br>sports_odds_snapshots |
| Service | src/services/nba-prediction-engine.service.ts | @/lib/supabase-admin<br>@/services/adaptive-scoring.service<br>@/services/adaptive-weight-engine.service<br>@/services/kelly.service<br>@/services/model-learning.service<br>@/services/nba-data-sync.service<br>@/services/nba-injury-lineup-confidence.service<br>@/services/nba-prediction-validation.service | prediction_history<br>sport_events<br>sports_odds_snapshots<br>team_stats |
| Service | src/services/nba-prediction-settlement.service.ts | @/lib/supabase-admin<br>@/services/nba-injury-lineup-confidence.service<br>@/services/nba-prediction-validation.service | prediction_history<br>sport_events<br>sport_game_stats |
| Service | src/services/nba-prediction-validation.service.ts | @/lib/supabase-admin<br>@/services/prediction-history.service | prediction_history<br>sport_events |
| Service | src/services/nba-steam-move-detection.service.ts | @/lib/supabase-admin<br>@/services/nba-data-sync.service<br>@/services/nba-prediction-validation.service | sport_events<br>sports_odds_snapshots |
| Service | src/services/next-slate.service.ts | @/lib/supabase-admin<br>@/services/active-event.service<br>@/services/provider-time-normalization.service | prediction_history<br>sport_events<br>sports_odds_snapshots |
| Service | src/services/nfl-feature-store-integration.service.ts | @/lib/supabase-admin<br>@/services/feature-store-core.service<br>@/services/multi-sport-feature-registry.service | None detected |
| Service | src/services/nfl-historical-foundation-v2.service.ts | @/lib/supabase-admin<br>@/services/data-foundation-coverage.service | prediction_history<br>sport_events |
| Service | src/services/nfl-prediction-engine.service.ts | @/services/nfl-feature-store-integration.service<br>@/services/sport-prediction-engine-sdk.service | None detected |
| Service | src/services/nhl-feature-store-integration.service.ts | @/lib/supabase-admin<br>@/services/feature-store-core.service<br>@/services/multi-sport-feature-registry.service | None detected |
| Service | src/services/nhl-historical-foundation-v2.service.ts | @/lib/supabase-admin<br>@/services/data-foundation-coverage.service | prediction_history<br>sport_events |
| Service | src/services/nhl-prediction-engine.service.ts | @/services/nhl-feature-store-integration.service<br>@/services/sport-prediction-engine-sdk.service | None detected |
| Service | src/services/official-pick-experience.service.ts | @/services/current-board.service<br>@/services/market-alignment.service<br>@/services/market-semantics.service<br>@/services/recommendation-eligibility-policy.service<br>@/services/recommendation-explanation.service | None detected |
| Service | src/services/operating-day-automation.service.ts | @/lib/supabase-admin<br>@/services/current-board.service<br>@/services/mlb-game-lifecycle.service<br>@/services/mlb-operating-date-resolution.service<br>@/services/next-slate.service<br>@/services/operating-day.service<br>@/services/provider-budget.service<br>@/services/provider-time-normalization.service | operating_day_lifecycle_events<br>sport_events |
| Service | src/services/operating-day.service.ts | @/lib/supabase-admin<br>@/services/best-value-scanner.service<br>@/services/bet-slip-optimizer.service<br>@/services/current-board.service<br>@/services/day1-recommendation-readiness.service<br>@/services/market-intelligence-engine.service<br>@/services/market-opportunity-suite.service<br>@/services/mlb-event-status-mapper.service | decision<br>game_results<br>operating_day_events<br>operating_day_lifecycle_events<br>operating_day_recommendation_locks<br>operating_day_reports<br>operating_days<br>prediction_history |
| Service | src/services/operations-health.service.ts | @/config/mlb-operating-day-scheduler<br>@/lib/supabase-admin<br>@/services/active-event.service<br>@/services/adaptive-refresh-orchestrator.service<br>@/services/current-board.service<br>@/services/mlb-game-lifecycle.service<br>@/services/provider-budget.service<br>@/services/provider-time-normalization.service | operating_day_lifecycle_events<br>prediction_history<br>sport_events |
| Service | src/services/pattern-discovery.service.ts | @/lib/supabase-admin<br>@/services/production-data-gate.service | prediction_history |
| Service | src/services/performance-product-contract.service.ts | @/config/sports.config<br>@/services/performance-scope-v2.service | absolute<br>performance_scope_v2<br>production<br>the |
| Service | src/services/performance-scope-v2.service.ts | @/lib/supabase-admin<br>@/services/canonical-settlement-state.service<br>@/services/prediction-cutoff-enforcement.service<br>@/services/pregame-scheduler-coverage.service<br>@/services/provider-time-normalization.service | accuracy<br>brier<br>prediction_history<br>sport_events |
| Service | src/services/player-intelligence.service.ts | @/lib/supabase-admin<br>@/services/mlb-learning-brain.service | sport_lineups<br>sport_player_stats<br>sport_players<br>universal_projection_history |
| Service | src/services/portfolio-intelligence.service.ts | @/services/current-board.service<br>@/services/probability-picks.service<br>@/types/portfolio-intelligence<br>@/types/probability-picks<br>crypto | None detected |
| Service | src/services/prediction-capture.service.ts | @/config/sports.config<br>@/services/prediction.service | None detected |
| Service | src/services/prediction-cutoff-enforcement.service.ts | @/lib/supabase-admin | historical_import_checkpoints<br>prediction_history<br>sport_events<br>sports_sync_jobs |
| Service | src/services/prediction-engine-v4.service.ts | @/services/monte-carlo-engine.service<br>@/services/sharp-money-intelligence.service<br>@/services/top-picks.service | None detected |
| Service | src/services/prediction-epoch-governance-v2.service.ts | @/lib/supabase-admin<br>@/services/prediction-epoch-migration-state.service | prediction_history |
| Service | src/services/prediction-epoch-migration-state.service.ts | @/lib/supabase-admin | prediction_epochs<br>prediction_history<br>read |
| Service | src/services/prediction-epoch-shadow-readiness.service.ts | @/lib/supabase-admin<br>@/services/prediction-epoch-migration-state.service | prediction_history<br>sport_events |
| Service | src/services/prediction-history.service.ts | @/lib/supabase-admin<br>@/services/mlb-starter-weather-stadium-intelligence.service<br>@/services/next-slate.service<br>@/services/prediction-cutoff-enforcement.service<br>@/services/production-data-gate.service<br>@/services/recommendation-eligibility-policy.service | game_results<br>historical_feature_snapshots<br>linked<br>prediction_history<br>sport_events |
| Service | src/services/prediction-market-intelligence.service.ts | None detected | None detected |
| Service | src/services/prediction-safety.service.ts | None detected | production |
| Service | src/services/prediction-settlement.service.ts | @/lib/supabase | game_results<br>prediction_history |
| Service | src/services/prediction.service.ts | @/lib/supabase<br>@/services/advanced-factors.service<br>@/services/model-learning.service<br>@/services/prediction-history.service<br>@/services/prediction-market-intelligence.service<br>@/utils/prediction-engine-v4 | team_matchups<br>team_stats |
| Service | src/services/pregame-scheduler-coverage.service.ts | @/lib/supabase-admin<br>@/services/mlb-operating-date-resolution.service<br>@/services/prediction-cutoff-enforcement.service<br>@/services/provider-time-normalization.service | operating_day_lifecycle_events<br>prediction_history<br>sport_events<br>sports_odds_snapshots<br>sports_sync_jobs |
| Service | src/services/probability-picks.service.ts | @/lib/supabase-admin<br>@/services/mlb-pitcher-projection-engine.service<br>@/types/mlb-pitcher-projections<br>@/types/probability-picks<br>crypto | prediction_history<br>ranking |
| Service | src/services/production-data-gate.service.ts | None detected | None detected |
| Service | src/services/production-readiness-audit.service.ts | @/lib/supabase-admin<br>@/services/active-event.service<br>@/services/adaptive-refresh-orchestrator.service<br>@/services/ai-performance-center.service<br>@/services/current-board.service<br>@/services/dashboard-today.service<br>@/services/market-intelligence-category.service<br>@/services/mlb-market-capability-registry.service | AI<br>prediction_history<br>sport_events<br>sports_odds_snapshots |
| Service | src/services/projection-evolution.service.ts | @/lib/supabase-admin | prediction_history<br>sport_events<br>universal_projection_history |
| Service | src/services/prospective-official-eligibility-gate.service.ts | @/lib/supabase-admin<br>@/services/current-board.service<br>@/services/market-alignment.service<br>@/services/market-semantics.service<br>@/services/recommendation-eligibility-policy.service | prediction_history |
| Service | src/services/recommendation-eligibility-policy.service.ts | @/services/production-data-gate.service | None detected |
| Service | src/services/recommendation-explanation.service.ts | @/services/market-alignment.service<br>@/services/market-semantics.service<br>@/services/recommendation-eligibility-policy.service | the |
| Service | src/services/recommendation-pipeline-trace.service.ts | @/lib/supabase-admin<br>@/services/current-board.service<br>@/services/model-only-intelligence.service<br>@/services/prediction-cutoff-enforcement.service<br>@/services/pregame-scheduler-coverage.service<br>@/services/provider-time-normalization.service | prediction_history<br>sport_events<br>sports_odds_snapshots |
| Service | src/services/retrosheet-historical-data-lake.service.ts | crypto<br>fs<br>fs/promises<br>path<br>readline | Retrosheet<br>request |
| Service | src/services/retrosheet-historical-feature-store.service.ts | @/lib/supabase-admin<br>crypto | completed<br>historical_feature_snapshots<br>historical_import_checkpoints<br>historical_import_registry<br>sports_sync_jobs |
| Service | src/services/runtime-observability.service.ts | @/lib/supabase-admin<br>@/services/provider-intelligence.service<br>@/services/sportsdataio-historical-import-readiness.service<br>@/services/sportsdataio-nba-integration-readiness.service<br>@/services/sportsdataio-nba-odds-readiness.service<br>@/services/sportsdataio-nba-player-props-readiness.service<br>@/services/sportsdataio-nba-player-stats-readiness.service<br>@/services/sportsdataio-nba-trial-isolation-audit.service | prediction_history<br>sports_sync_jobs |
| Service | src/services/self-learning-engine.service.ts | @/services/model-learning.service<br>@/services/model-versioning.service | None detected |
| Service | src/services/settlement-core.service.ts | None detected | market |
| Service | src/services/settlement-guarantee.service.ts | @/lib/supabase-admin<br>@/services/canonical-settlement-state.service<br>@/services/operations-health.service<br>@/services/provider-time-normalization.service | game_results<br>prediction_history<br>sport_events |
| Service | src/services/settlement-reconciliation.service.ts | @/lib/supabase-admin<br>@/services/legacy-prediction-provenance.service<br>@/services/prediction-cutoff-enforcement.service<br>@/services/settlement-core.service | prediction_history<br>production<br>sport_events |
| Service | src/services/soccer-feature-store-integration.service.ts | @/lib/supabase-admin<br>@/services/feature-store-core.service<br>@/services/multi-sport-feature-registry.service | None detected |
| Service | src/services/soccer-historical-foundation-v2.service.ts | @/lib/supabase-admin<br>@/services/data-foundation-coverage.service<br>@/services/data-foundation-season-governance.service | prediction_history |
| Service | src/services/soccer-prediction-engine.service.ts | @/services/kelly.service<br>@/services/smart-ranking.service<br>@/services/soccer-feature-store-integration.service<br>@/services/sport-prediction-engine-sdk.service | match<br>normalized<br>total |
| Service | src/services/sport-prediction-engine-sdk.service.ts | @/services/feature-store-core.service<br>@/services/kelly.service<br>@/services/smart-ranking.service<br>@/types/multi-sport | None detected |
| Service | src/services/sports-analyst.service.ts | @/services/game-intelligence.service | stored |
| Service | src/services/sports-center.service.ts | @/config/product-status<br>@/types/sports-center | production<br>this |
| Service | src/services/sportsdataio-adapter-contract.service.ts | @/services/multi-sport-normalizers.service<br>@/services/provider-adapter-sdk.service<br>@/types/multi-sport | None detected |
| Service | src/services/sportsdataio-historical-import-readiness.service.ts | @/config/sports.config<br>@/lib/supabase-admin<br>@/services/mlb-event-status-mapper.service<br>@/services/nba-data-quality.service<br>@/services/nba-feature-store-integration.service<br>@/services/nba-injury-lineup-confidence.service<br>@/services/nba-multi-book-comparison.service<br>@/services/nba-steam-move-detection.service | GameOddsByDate.<br>deterministic<br>fetched<br>provider_entity_mappings<br>sport_events<br>sport_game_stats<br>sport_injuries<br>sport_lineups |
| Service | src/services/sportsdataio-mlb-discovery.service.ts | @/config/sportsdataio-endpoint-catalog<br>@/lib/supabase-admin<br>@/services/mlb-provider-capability-audit.service | Discovery<br>diagnosis<br>sports_sync_jobs |
| Service | src/services/sportsdataio-mlb-historical-import-executor.service.ts | @/lib/supabase-admin<br>@/services/mlb-event-status-mapper.service<br>@/services/provider-budget.service<br>@/services/provider-time-normalization.service<br>@/services/safe-supabase-preflight.service<br>@/services/sportsdataio-discovery-lab-url.service<br>@/services/sportsdataio-mlb-normalization.service<br>@/services/sync-reliability.service | active<br>non<br>provider_entity_mappings<br>sport_events<br>sport_game_stats<br>sport_players<br>sport_standings<br>sports_sync_jobs |
| Service | src/services/sportsdataio-mlb-normalization.service.ts | None detected | None detected |
| Service | src/services/sportsdataio-mlb-prospective-preview.service.ts | @/lib/server-schema-capabilities<br>@/lib/supabase-admin<br>@/services/feature-store-core.service<br>@/services/mlb-event-status-mapper.service<br>@/services/mlb-missing-intelligence.service<br>@/services/mlb-starter-weather-stadium-intelligence.service<br>@/services/prediction-cutoff-enforcement.service<br>@/services/provider-time-normalization.service | Player.Status.<br>completed<br>historical_feature_snapshots<br>prediction_history<br>provider_entity_mappings<br>sport_events<br>sports_odds_snapshots<br>sports_sync_jobs |
| Service | src/services/sportsdataio-nba-integration-readiness.service.ts | @/services/sportsdataio-nba-odds-readiness.service<br>@/services/sportsdataio-nba-player-props-readiness.service<br>@/services/sportsdataio-nba-player-stats-readiness.service<br>@/services/sportsdataio-runtime-adapter.service | SportsDataIO<br>authenticated<br>confidence<br>improving<br>production<br>trial |
| Service | src/services/sportsdataio-nba-odds-readiness.service.ts | @/services/sportsdataio-runtime-adapter.service | trial |
| Service | src/services/sportsdataio-nba-player-props-readiness.service.ts | @/services/sportsdataio-runtime-adapter.service | core<br>trial |
| Service | src/services/sportsdataio-nba-player-stats-readiness.service.ts | @/services/sportsdataio-runtime-adapter.service | information_schema.columns<br>information_schema.role_table_grants<br>pg_indexes |
| Service | src/services/sportsdataio-nba-trial-isolation-audit.service.ts | @/lib/supabase-admin | prediction_history |
| Service | src/services/sportsdataio-runtime-adapter.service.ts | @/config/sports.config<br>@/services/multi-sport-normalizers.service<br>@/services/provider-adapter-sdk.service<br>@/services/sportsdataio-adapter-contract.service<br>@/services/sportsdataio-betting-normalizer.service<br>@/services/sync-reliability.service<br>@/types/multi-sport | None detected |
| Service | src/services/sportsdataio-subscription-maximization-audit.service.ts | @/config/sportsdataio-endpoint-catalog<br>@/lib/supabase-admin<br>@/services/provider-budget.service<br>@/services/sportsdataio-runtime-adapter.service | None detected |
| Service | src/services/stored-preview-prediction-lifecycle.service.ts | @/lib/supabase-admin<br>@/services/feature-store-core.service<br>@/services/prediction-cutoff-enforcement.service<br>@/services/settlement-reconciliation.service<br>@/services/sport-prediction-engine-sdk.service<br>@/types/multi-sport<br>crypto | historical_feature_snapshots<br>prediction_history<br>sport_events<br>sports_odds_snapshots |
| Service | src/services/tennis-feature-store-integration.service.ts | @/lib/supabase-admin<br>@/services/feature-store-core.service<br>@/services/multi-sport-feature-registry.service | None detected |
| Service | src/services/tennis-prediction-engine.service.ts | @/services/sport-prediction-engine-sdk.service<br>@/services/tennis-feature-store-integration.service | None detected |
| Service | src/services/tennis-ufc-data-readiness-v2.service.ts | @/lib/supabase-admin<br>@/services/data-foundation-coverage.service | prediction_history |
| Service | src/services/the-odds-api-maximum-utilization.service.ts | @/config/sports.config | None detected |
| Service | src/services/top-picks.service.ts | @/lib/supabase-admin<br>@/services/adaptive-scoring.service<br>@/services/adaptive-weight-engine.service<br>@/services/kelly.service<br>@/services/production-data-gate.service<br>@/services/recommendation-eligibility-policy.service<br>@/services/risk-grade.service<br>@/services/smart-ranking.service | prediction_history |
| Service | src/services/training-feature-governance-v1.service.ts | None detected | feature<br>model<br>that |
| Service | src/services/ufc-feature-store-integration.service.ts | @/lib/supabase-admin<br>@/services/feature-store-core.service<br>@/services/multi-sport-feature-registry.service | None detected |
| Service | src/services/ufc-prediction-engine.service.ts | @/services/sport-prediction-engine-sdk.service<br>@/services/ufc-feature-store-integration.service | None detected |
| Service | src/services/universal-event-identity.service.ts | @/lib/supabase-admin | game_results<br>prediction_history<br>provider_entity_mappings<br>sport_events<br>sport_game_stats<br>sport_player_stats<br>sports_odds_snapshots |
| Service | src/services/universal-market-intelligence.service.ts | @/lib/supabase-admin<br>@/services/market-semantics.service<br>@/services/mlb-first-five-readiness.service<br>@/services/mlb-market-capability-registry.service<br>@/services/mlb-team-totals-readiness.service | None detected |
| Service | src/services/universal-projection-engine.service.ts | @/lib/supabase-admin<br>@/services/active-event.service<br>@/services/feature-store-core.service<br>@/services/mlb-current-lineup-context.service<br>@/services/mlb-game-lifecycle.service<br>@/services/mlb-projection-integrity.service<br>@/services/mlb-starter-intelligence.service<br>@/services/mlb-starter-weather-stadium-intelligence.service | sport_events<br>sport_game_stats<br>sport_player_stats<br>sport_players<br>stored<br>universal_projection_history |
| Service | src/services/weight-optimizer.service.ts | @/lib/supabase-admin<br>@/services/model-learning.service<br>@/services/production-data-gate.service | prediction_history |
| Settlement Module | docs/AI_PERFORMANCE_AUTOMATION.md | None detected | None detected |
| Settlement Module | docs/FEATURE_ALIAS_MAP_V1.json | None detected | feature<br>that |
| Settlement Module | docs/FEATURE_LEAKAGE_ENFORCEMENT_V1.md | None detected | model |
| Settlement Module | docs/MARKET_READINESS_FORECAST.md | None detected | None detected |
| Settlement Module | docs/MLB_GAME_LIFECYCLE.md | None detected | analysis |
| Settlement Module | docs/MLB_MARKET_DATA_REQUIREMENTS.md | None detected | None detected |
| Settlement Module | docs/MLB_MARKET_PROVIDER_MATRIX.md | None detected | None detected |
| Settlement Module | docs/MLB_MARKET_RISK_ANALYSIS.md | None detected | None detected |
| Settlement Module | docs/MLB_MARKET_SETTLEMENT_REQUIREMENTS.md | None detected | None detected |
| Settlement Module | docs/MLB_PLAYER_PROP_MARKET_COMPARISON_V1.md | None detected | None detected |
| Settlement Module | docs/MLB_PROJECTION_RANKING.md | None detected | projected |
| Settlement Module | docs/MLB_PROVIDER_USAGE_OBSERVED_V1.json | None detected | None detected |
| Settlement Module | docs/MLB_REFRESH_CADENCE_OBSERVED_V1.json | None detected | None detected |
| Settlement Module | docs/mlb-player-catalog-completion.md | None detected | trusted |
| Settlement Module | docs/mlb-player-prop-readiness.md | None detected | None detected |
| Settlement Module | docs/OPERATIONAL_LAUNCH_REPAIR_ROADMAP_V1.md | None detected | None detected |
| Settlement Module | docs/PICK_ANALYZER_V1_POST_RELEASE_OPERATIONS.md | None detected | None detected |
| Settlement Module | docs/pitcher-outs-settlement-v1.md | None detected | trusted |
| Settlement Module | docs/player-intelligence-foundation.md | None detected | None detected |
| Settlement Module | docs/PRODUCT_ROUTE_INVENTORY_V1.md | None detected | None detected |
| Settlement Module | docs/PRODUCT/README.md | None detected | None detected |
| Settlement Module | docs/settlement-recovery-v1.md | None detected | None detected |
| Settlement Module | docs/SPORTSDATAIO_DISCOVERY_INTEGRATION.md | None detected | injury |
| Settlement Module | docs/SPORTSDATAIO_ENDPOINT_CAPABILITIES.md | None detected | validation |
| Settlement Module | docs/THE_ODDS_API_FREE_TIER_CAPABILITY_AUDIT_V1.md | None detected | provider |
| Settlement Module | docs/TODAY_DASHBOARD_RELIABILITY.md | None detected | None detected |
| Settlement Module | src/config/sportsdataio-endpoint-catalog.ts | None detected | Discovery<br>first<br>provider<br>validation |
| Settlement Module | src/types/sports-center.ts | @/config/product-status | None detected |
| Utility | docs/CACHE_INVALIDATION.md | None detected | None detected |
| Utility | docs/FEATURE_PRIORITY_MATRIX.md | None detected | None detected |
| Utility | docs/FEATURE_SIGNAL_MATRIX.md | None detected | domain |
| Utility | docs/HISTORICAL_FEATURE_BACKFILL_IDEMPOTENCY.md | None detected | None detected |
| Utility | docs/HISTORICAL_FEATURE_BACKFILL_OPERATIONS.md | None detected | None detected |
| Utility | docs/MASTER_PROGRAM/RELEASE_METHODOLOGY.md | None detected | None detected |
| Utility | docs/MLB_CANONICAL_EVENT_STATUS_STALE_SLATE_TEMPORAL_REPAIR_V1.md | None detected | metadata<br>monopolizing |
| Utility | docs/MLB_DATA_ACQUISITION_COMPLETION.md | None detected | None detected |
| Utility | docs/MLB_PITCHER_DATA_AUDIT_V1.md | None detected | historical<br>runs |
| Utility | docs/MLB_PITCHER_PROJECTION_ENGINE_V1.md | None detected | sport |
| Utility | docs/MLB_PITCHER_PROJECTION_MODEL_V1.md | None detected | any |
| Utility | docs/MLB_RELEASE_METADATA.json | None detected | None detected |
| Utility | docs/nba-steam-move-detection-v1.md | None detected | None detected |
| Utility | docs/pitcher-outs-feature-contract.md | None detected | stored |
| Utility | docs/RELEASES/RELEASE_01_PROGRESS.md | None detected | None detected |
| Utility | docs/RETROSHEET_HISTORICAL_FEATURE_IMPORT_2025.md | None detected | None detected |
| Utility | docs/RETROSHEET_HISTORICAL_FEATURE_LEAKAGE_CERTIFICATION.md | None detected | None detected |
| Utility | docs/SPORTSDATAIO_FIELD_QUALITY.md | None detected | retained |
| Utility | docs/sportsdataio-adapter-contract-v1.md | None detected | None detected |
| Utility | docs/sync-reliability-framework-v1.md | None detected | None detected |
| Utility | docs/THE_ODDS_API_MARKET_HISTORY_MATERIALIZATION_V1.md | None detected | stored |
| Utility | docs/vercel-deployment-recovery.md | None detected | the |
| Utility | src/types/mlb-pitcher-projections.ts | None detected | None detected |
| Utility | supabase/migrations/202607260001_mlb_pitcher_projections_v1.sql | None detected | None detected |
| Validation Module | scripts/ai-briefing-v2-validate.mjs | node:child_process<br>node:fs<br>node:path | None detected |
| Validation Module | scripts/ai-model-strategy-v1-validate.mjs | node:fs | None detected |
| Validation Module | scripts/autonomous-daily-ai-v1-validate.mjs | node:fs | None detected |
| Validation Module | scripts/canonical-result-ingestion-recovery-v1-validate.mjs | node:fs | settlement |
| Validation Module | scripts/certified-prediction-epoch-mlb-readiness-audit-v1.mjs | @/lib/supabase-admin<br>node:fs<br>node:path | None detected |
| Validation Module | scripts/database-io-readonly-audit.mjs | @supabase/supabase-js<br>node:fs<br>node:perf_hooks | ai_performance_snapshots<br>historical_baseball_games<br>historical_feature_snapshots<br>historical_import_checkpoints<br>historical_import_registry<br>model_weight_history<br>prediction_history<br>sports_sync_jobs |
| Validation Module | scripts/feature-intelligence-signal-quality-leakage-audit-v1-validate.mjs | node:fs | None detected |
| Validation Module | scripts/feature-intelligence-signal-quality-leakage-audit-v1.mjs | @/lib/supabase-admin<br>node:crypto<br>node:fs | domain<br>historical_feature_snapshots<br>model<br>pregame |
| Validation Module | scripts/full-platform-audit-v1.mjs | @/lib/supabase-admin<br>node:fs<br>node:path | memory<br>prediction_history<br>sport_events |
| Validation Module | scripts/historical-completion-v1-b2-mlb-events-validate.mjs | node:fs | None detected |
| Validation Module | scripts/historical-completion-v1-b3-mlb-stats-validate.mjs | node:fs | None detected |
| Validation Module | scripts/historical-completion-v1-b6-mlb-foundation-certify.mjs | node:fs | None detected |
| Validation Module | scripts/historical-completion-v1-c1-nba-baseline-certify.mjs | node:fs | None detected |
| Validation Module | scripts/historical-completion-v1-c2-nba-result-stat-plan-validate.mjs | node:fs | None detected |
| Validation Module | scripts/historical-completion-v1-c3-nba-identity-market-validate.mjs | node:fs | None detected |
| Validation Module | scripts/historical-completion-v1-d1-nfl-baseline-certify.mjs | node:fs | None detected |
| Validation Module | scripts/historical-completion-v1-d2-nfl-completion-plan-validate.mjs | node:fs | None detected |
| Validation Module | scripts/historical-completion-v1-e1-nhl-baseline-plan-validate.mjs | node:fs | production |
| Validation Module | scripts/historical-completion-v1-f1-soccer-competition-plan-validate.mjs | node:fs | None detected |
| Validation Module | scripts/historical-completion-v1-g1-bsn-completion-certify.mjs | node:fs | None detected |
| Validation Module | scripts/historical-completion-v1-h1-tennis-ufc-readiness-validate.mjs | node:fs | None detected |
| Validation Module | scripts/historical-completion-v1-i1-final-certify.mjs | node:child_process<br>node:fs | None detected |
| Validation Module | scripts/historical-evidence-expansion-v1-validate.mjs | node:fs | None detected |
| Validation Module | scripts/historical-evidence-recovery-v1-validate.mjs | node:fs | None detected |
| Validation Module | scripts/historical-learning-foundation-v1-validate.mjs | node:fs | None detected |
| Validation Module | scripts/historical-settled-status-reconciliation-v1-validate.mjs | node:fs | None detected |
| Validation Module | scripts/historical-training-readiness-v1-validate.mjs | node:fs | None detected |
| Validation Module | scripts/live-multi-sport-acquisition-v1-final-certify.mjs | @/services/data-coverage-inventory.service<br>@/services/multi-sport-data-expansion-final.service<br>node:fs<br>node:path | None detected |
| Validation Module | scripts/mlb-autonomous-operations-v1-validate.mjs | node:fs | None detected |
| Validation Module | scripts/mlb-july29-terminal-recovery-v1-validate.mjs | node:fs | None detected |
| Validation Module | scripts/mlb-operating-day-odds-audit-v1.mjs | @supabase/supabase-js<br>node:fs | historical_feature_snapshots<br>operating_day_lifecycle_events<br>operating_days<br>prediction_history<br>sport_events<br>sports_odds_snapshots<br>sports_sync_jobs |
| Validation Module | scripts/mlb-operating-day-recovery-v1-validate.mjs | node:fs | production |
| Validation Module | scripts/mlb-result-evidence-reconciliation-v1-validate.mjs | ../src/services/adaptive-refresh-orchestrator.service.ts<br>node:fs | game_results |
| Validation Module | scripts/multi-sport-data-expansion-v1-phase1-validate.mjs | node:fs | None detected |
| Validation Module | scripts/multi-sport-unlock-v1-final-certify.mjs | ../src/services/settlement-core.service.ts<br>@supabase/supabase-js<br>node:child_process<br>node:fs<br>node:path | None detected |
| Validation Module | scripts/nfl-nhl-preview-lifecycle-v1-validate.mjs | ../src/services/stored-preview-prediction-lifecycle.service.ts | None detected |
| Validation Module | scripts/official-picks-eligibility-audit-v1.mjs | @/lib/supabase-admin<br>@/services/production-data-gate.service<br>@/services/recommendation-eligibility-policy.service<br>@/services/risk-grade.service<br>node:fs<br>node:path | prediction_history<br>settled |
| Validation Module | scripts/operational-readiness-multisport-audit-v1-validate.mjs | node:fs | None detected |
| Validation Module | scripts/operational-readiness-multisport-audit-v1.mjs | @/lib/supabase-admin<br>node:crypto<br>node:fs | production<br>settled |
| Validation Module | scripts/performance-api-query-optimization-v1-validate.mjs | node:fs | None detected |
| Validation Module | scripts/pick-analyzer-v1-final-validation-bundle-validate.mjs | node:fs | None detected |
| Validation Module | scripts/pick-analyzer-v2-phase-a2-route-runtime-validate.mjs | node:child_process<br>node:fs<br>node:path | missing<br>product<br>src |
| Validation Module | scripts/pick-analyzer-v2-phase-a3-scheduler-freshness-validate.mjs | node:child_process<br>node:fs<br>node:path | NOT_AVAILABLE<br>active<br>last |
| Validation Module | scripts/pick-analyzer-v2-phase-a4-ui-state-validate.mjs | node:child_process<br>node:fs<br>node:path | API<br>data<br>failures.<br>production<br>recommendation |
| Validation Module | scripts/pick-analyzer-v2-phase-a5-api-query-performance-validate.mjs | node:child_process<br>node:fs<br>node:path | None detected |
| Validation Module | scripts/pick-analyzer-v2-phase-a6-build-reliability-validate.mjs | @/services/data-coverage-inventory.service<br>@/services/multi-sport-data-expansion-checkpoint2.service<br>@/services/multi-sport-data-expansion-checkpoint3.service<br>@/services/multi-sport-data-expansion-final.service<br>@/services/multi-sport-provider-entitlement-audit.service<br>@/services/the-odds-api-maximum-utilization.service<br>node:child_process<br>node:fs | config<br>memory<br>out<br>that |
| Validation Module | scripts/pick-analyzer-v2-phase-b2-today-experience-validate.mjs | node:child_process<br>node:fs<br>node:path | None detected |
| Validation Module | scripts/pick-analyzer-v2-phase-b3-best-opportunity-readiness-validate.mjs | node:child_process<br>node:fs<br>node:path | None detected |
| Validation Module | scripts/pick-analyzer-v2-phase-b4-decision-dashboard-experience-validate.mjs | node:child_process<br>node:fs<br>node:path | None detected |
| Validation Module | scripts/pick-analyzer-v2-phase-b5-1-mobile-opportunity-navigation-validate.mjs | node:child_process<br>node:fs<br>node:path | None detected |
| Validation Module | scripts/pick-analyzer-v2-phase-b5-ai-decision-explanation-validate.mjs | node:child_process<br>node:fs<br>node:path | None detected |
| Validation Module | scripts/pick-analyzer-v2-phase-b6-1-live-freshness-budget-validate.mjs | node:child_process<br>node:fs<br>node:path | None detected |
| Validation Module | scripts/pick-analyzer-v2-phase-b6-mobile-decision-experience-validate.mjs | node:child_process<br>node:fs<br>node:path | None detected |
| Validation Module | scripts/pick-analyzer-v2-phase-c1-1-external-scheduler-recovery-validate.mjs | @/services/operations-health.service<br>node:fs<br>node:path | None detected |
| Validation Module | scripts/pick-analyzer-v2-phase-c1-daily-betting-settlement-validate.mjs | node:child_process<br>node:fs<br>node:path | None detected |
| Validation Module | scripts/prediction-epoch-shadow-readiness-v1-validate.mjs | @/services/prediction-epoch-shadow-readiness.service<br>node:fs | None detected |
| Validation Module | scripts/probability-picks-v2-validate.mjs | node:child_process<br>node:fs<br>node:path | None detected |
| Validation Module | scripts/product-audit-v1-final-certify.mjs | node:child_process<br>node:fs | None detected |
| Validation Module | scripts/product-audit-v1-probability-picks-validate.mjs | node:fs | None detected |
| Validation Module | scripts/product-audit-v1-route-inventory.mjs | node:child_process<br>node:fs<br>node:path | Current |
| Validation Module | scripts/product-navigation-freshness-v1-validate.mjs | node:child_process<br>node:fs<br>node:path | None detected |
| Validation Module | scripts/product-stabilization-v1-audit.mjs | node:child_process<br>node:fs<br>node:path | the |
| Validation Module | scripts/protected-canonical-mlb-settlement-v1-validate.mjs | node:fs | settlement |
| Validation Module | scripts/release-candidate-route-artifact-consistency-v1-validate.mjs | node:fs | None detected |
| Validation Module | scripts/release01-product-runtime-audit-generate.mjs | node:fs<br>node:path | API<br>Supabase<br>discovered<br>repository<br>static |
| Validation Module | scripts/release01-product-runtime-audit-validate.mjs | node:fs<br>node:path | None detected |
| Validation Module | scripts/settlement-learning-pipeline-recovery-v1-validate.mjs | node:fs | None detected |
| Validation Module | scripts/six-historical-settlement-conflict-resolution-v1-validate.mjs | node:fs | None detected |
| Validation Module | scripts/sports-center-v1-validate.mjs | node:fs<br>node:path | None detected |
| Validation Module | scripts/sprint0-docs-foundation-validate.mjs | node:fs<br>node:path | None detected |
| Validation Module | scripts/training-safe-feature-governance-v1-validate.mjs | ../src/services/training-feature-governance-v1.service.ts<br>node:fs | None detected |
| Validation Module | scripts/unsupported-market-recommendation-policy-lock-v1-validate.mjs | node:fs | None detected |
| Worker | docs/build-memory-optimization-v1-phase2-supabase-externalized-worker.json | None detected | None detected |
