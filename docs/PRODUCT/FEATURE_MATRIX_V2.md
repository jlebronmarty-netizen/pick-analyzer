# Feature Matrix V2

Generated from discovered routes, services, providers, adapters and product modules.

| Feature | Area | Status | Production Ready | Read Only | Experimental | Deprecated | UI | API | Documentation | Depends On | Last Modified |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| docs / HISTORICAL_IMPORT_ORCHESTRATOR_V2 | AI Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-26 |
| docs / PICK_ANALYZER_V1_EVIDENCE_INDEX | AI Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-30 |
| docs / PICK_ANALYZER_V1_PRODUCTION_CERTIFICATION | AI Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-30 |
| /api/ai-bet-finder | API Route | Production Surface | Yes | No | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/ai-bet-finder.service<br>next/server | 2026-07-15 |
| /api/ai-operations/lifecycle | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/services/ai-learning-lifecycle.service<br>next/server | 2026-07-23 |
| /api/ai-performance-center/daily-update | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/server-lazy-diagnostics<br>next/server | 2026-07-23 |
| /api/ai-performance-center | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/server-lazy-diagnostics<br>next/server | 2026-07-23 |
| /api/ai/coach | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/config/sports.config<br>@/services/ai-coach.service<br>next/server | 2026-07-11 |
| /api/ai/copilot/chat | API Route | Experimental | No | No | Yes | No | No | Yes | Yes | @/services/ai-copilot-chat.service<br>next/server | 2026-06-28 |
| /api/ai/copilot | API Route | Experimental | No | Yes | Yes | No | No | Yes | Yes | @/services/ai-copilot.service<br>next/server | 2026-06-28 |
| /api/ai/game-analysis | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/services/ai-game-analysis.service<br>next/server | 2026-06-27 |
| /api/ai/sports-brain | API Route | Production Surface | Yes | No | No | No | No | Yes | Yes | @/config/sports.config<br>@/services/ai-sports-brain.service<br>next/server | 2026-07-10 |
| /api/analytics/charts | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/services/analytics-charts.service<br>next/server | 2026-06-22 |
| /api/analytics/clv | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/services/clv-analytics.service<br>next/server | 2026-06-25 |
| /api/analytics/dashboard | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/services/analytics.service<br>next/server | 2026-06-22 |
| /api/autonomous-daily-ai | API Route | Production Surface | Yes | No | No | No | No | Yes | Yes | @/services/autonomous-daily-ai.service<br>next/server | 2026-07-28 |
| /api/autonomous-daily-operations/daily-report | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/lib/server-lazy-diagnostics<br>next/server | 2026-07-23 |
| /api/autonomous-daily-operations/demo | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/lib/server-lazy-diagnostics<br>next/server | 2026-07-23 |
| /api/autonomous-daily-operations/execute | API Route | Protected | Yes | No | No | No | No | Yes | Yes | @/lib/api-contract<br>@/lib/server-lazy-diagnostics<br>next/server | 2026-07-23 |
| /api/autonomous-daily-operations/health | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/lib/server-lazy-diagnostics<br>next/server | 2026-07-23 |
| /api/autonomous-daily-operations/learning-report | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/lib/server-lazy-diagnostics<br>next/server | 2026-07-23 |
| /api/autonomous-daily-operations/scheduler | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/lib/server-lazy-diagnostics<br>next/server | 2026-07-23 |
| /api/autonomous-daily-operations/simulation | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/lib/server-lazy-diagnostics<br>next/server | 2026-07-23 |
| /api/autonomous-daily-operations/status | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/lib/server-lazy-diagnostics<br>next/server | 2026-07-23 |
| /api/bankroll/manager | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/services/bankroll-manager.service<br>next/server | 2026-06-28 |
| /api/bankroll | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/services/bankroll.service<br>@/services/play-of-the-day.service<br>@/services/portfolio-builder.service<br>next/server | 2026-06-24 |
| /api/basketball/bsn/acquisition | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/basketball/acquisition/bsn-acquisition-engine<br>next/server | 2026-07-23 |
| /api/basketball/bsn/data-coverage | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/basketball/acquisition/bsn-acquisition-engine<br>next/server | 2026-07-23 |
| /api/basketball/bsn/historical-reconstruction | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/basketball/history/bsn-historical-reconstruction<br>next/server | 2026-07-23 |
| /api/basketball/platform | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/config/sports.config<br>@/lib/api-contract<br>@/services/basketball/builders/platform.service<br>next/server | 2026-07-23 |
| /api/best-bets-today | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/best-bets-today.service<br>next/server | 2026-07-17 |
| /api/bsn/admin/validation | API Route | Production Surface | Yes | No | No | No | No | Yes | Yes | @/services/bsn-platform.service<br>next/server | 2026-07-18 |
| /api/bsn/ai-coach | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/services/bsn-platform.service<br>next/server | 2026-07-18 |
| /api/bsn/analytics/readiness | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/services/bsn-platform.service<br>next/server | 2026-07-18 |
| /api/bsn/capabilities | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/services/bsn-platform.service<br>next/server | 2026-07-18 |
| /api/bsn/compare | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/services/bsn-intelligence-engine.service<br>next/server | 2026-07-19 |
| /api/bsn/core-certification | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/lib/server-lazy-diagnostics<br>next/server | 2026-07-23 |
| /api/bsn/current-board | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/services/bsn-platform.service<br>next/server | 2026-07-18 |
| /api/bsn/data-quality | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/services/bsn-platform.service<br>next/server | 2026-07-18 |
| /api/bsn/features | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/services/bsn-intelligence-engine.service<br>next/server | 2026-07-19 |
| /api/bsn/features/validation | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/services/bsn-platform.service<br>next/server | 2026-07-18 |
| /api/bsn/game/[id] | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/services/bsn-shadow-prediction-engine.service<br>next/server | 2026-07-19 |
| /api/bsn/games | API Route | Production Surface | Yes | No | No | No | No | Yes | Yes | @/services/bsn.service<br>next/server | 2026-06-22 |
| /api/bsn/import | API Route | Production Surface | Yes | No | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/bsn-platform.service<br>next/server | 2026-07-18 |
| /api/bsn/intelligence | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/services/bsn-intelligence-engine.service<br>next/server | 2026-07-19 |
| /api/bsn/intelligence/validation | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/services/bsn-intelligence-engine.service<br>next/server | 2026-07-19 |
| /api/bsn/model-maturity/activation-audit | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/server-lazy-diagnostics<br>next/server | 2026-07-23 |
| /api/bsn/model-maturity/backtesting | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/server-lazy-diagnostics<br>next/server | 2026-07-23 |
| /api/bsn/model-maturity/calibration | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/server-lazy-diagnostics<br>next/server | 2026-07-23 |
| /api/bsn/model-maturity/explanations | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/server-lazy-diagnostics<br>next/server | 2026-07-23 |
| /api/bsn/model-maturity/performance | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/server-lazy-diagnostics<br>next/server | 2026-07-23 |
| /api/bsn/model-maturity/readiness | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/server-lazy-diagnostics<br>next/server | 2026-07-23 |
| /api/bsn/model-maturity | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/server-lazy-diagnostics<br>next/server | 2026-07-23 |
| /api/bsn/model-maturity/shadow-market | API Route | Experimental | No | Yes | Yes | No | No | Yes | Yes | @/lib/server-lazy-diagnostics<br>next/server | 2026-07-23 |
| /api/bsn/momentum | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/services/bsn-intelligence-engine.service<br>next/server | 2026-07-19 |
| /api/bsn/operations/readiness | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/services/bsn-platform.service<br>next/server | 2026-07-18 |
| /api/bsn/power-rankings | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/services/bsn-intelligence-engine.service<br>next/server | 2026-07-19 |
| /api/bsn/predictions/preview | API Route | Experimental | No | Yes | Yes | No | No | Yes | Yes | @/services/bsn-shadow-prediction-engine.service<br>next/server | 2026-07-19 |
| /api/bsn/predictions | API Route | Production Surface | Yes | No | No | No | No | Yes | Yes | @/services/bsn-shadow-prediction-engine.service<br>next/server | 2026-07-19 |
| /api/bsn/predictions/validation | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/services/bsn-shadow-prediction-engine.service<br>next/server | 2026-07-19 |
| /api/bsn/results | API Route | Production Surface | Yes | No | No | No | No | Yes | Yes | @/services/bsn.service<br>next/server | 2026-06-22 |
| /api/bsn/seed | API Route | Production Surface | Yes | No | No | No | No | Yes | Yes | @/services/bsn.service<br>next/server | 2026-06-22 |
| /api/bsn/source-quality | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/bsn-platform.service<br>next/server | 2026-07-18 |
| /api/bsn/sources | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/bsn-platform.service<br>next/server | 2026-07-18 |
| /api/bsn/sources/validate | API Route | Production Surface | Yes | No | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/bsn-platform.service<br>next/server | 2026-07-18 |
| /api/bsn/sync | API Route | Production Surface | Yes | No | No | No | No | Yes | Yes | @/services/bsn-platform.service<br>next/server | 2026-07-18 |
| /api/bsn/team/[id] | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/services/bsn-intelligence-engine.service<br>next/server | 2026-07-19 |
| /api/bsn/teams | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/services/bsn.service<br>next/server | 2026-06-22 |
| /api/closing-line/intelligence | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/config/sports.config<br>@/services/closing-line-intelligence.service<br>next/server | 2026-07-28 |
| /api/clv/update | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/services/clv.service<br>next/server | 2026-06-24 |
| /api/cron/capture-predictions | API Route | Protected | Yes | No | No | No | No | Yes | Yes | @/services/prediction-capture.service<br>next/server | 2026-06-22 |
| /api/cron/daily-sync | API Route | Protected | Yes | Yes | No | No | No | Yes | Yes | @/services/daily-pipeline.service<br>next/server | 2026-07-14 |
| /api/cron/master-sync | API Route | Protected | Yes | No | No | No | No | Yes | Yes | @/lib/server-cache<br>@/services/master-sync.service<br>@/services/self-learning-engine.service<br>next/server | 2026-07-08 |
| /api/cron/operating-day | API Route | Protected | Yes | No | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/adaptive-refresh-orchestrator.service<br>@/services/ai-performance-center.service<br>@/services/operating-day-automation.service<br>@/services/operating-day.service | 2026-07-25 |
| /api/current-board | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/best-bets-today.service<br>@/services/current-board.service<br>next/server | 2026-07-18 |
| /api/daily-report/fast | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/services/bankroll.service<br>@/services/daily-report-fast.service<br>next/server | 2026-06-29 |
| /api/daily-report | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/services/bankroll.service<br>@/services/daily-report-fast.service<br>@/services/daily-report.service<br>next/server | 2026-07-18 |
| /api/dashboard/cache/clear | API Route | Production Surface | Yes | No | No | No | No | Yes | Yes | @/lib/server-cache<br>next/server | 2026-07-07 |
| /api/dashboard | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/server-lazy-diagnostics<br>next/server | 2026-07-23 |
| /api/dashboard/today | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/server-lazy-diagnostics<br>next/server | 2026-07-23 |
| /api/data-coverage/expansion-checkpoint2 | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/multi-sport-data-expansion-checkpoint2.service<br>next/server | 2026-07-28 |
| /api/data-coverage/expansion-checkpoint3 | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/multi-sport-data-expansion-checkpoint3.service<br>next/server | 2026-07-28 |
| /api/data-coverage/final-certification | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/multi-sport-data-expansion-final.service<br>next/server | 2026-07-30 |
| /api/data-coverage/health | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/data-coverage-inventory.service<br>next/server | 2026-07-28 |
| /api/data-coverage/inventory | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/data-coverage-inventory.service<br>next/server | 2026-07-28 |
| /api/data-coverage/provider-audit | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/multi-sport-provider-entitlement-audit.service<br>next/server | 2026-07-28 |
| /api/data-foundation/bsn | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/bsn-historical-foundation-v2.service<br>next/server | 2026-07-27 |
| /api/data-foundation/epoch-performance | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/epoch-performance-learning-v2.service<br>next/server | 2026-07-27 |
| /api/data-foundation/epochs | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/prediction-epoch-governance-v2.service<br>next/server | 2026-07-27 |
| /api/data-foundation/feature-rebuild | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/feature-rebuild-plan-v2.service<br>next/server | 2026-07-27 |
| /api/data-foundation/future-predictions | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/future-only-prediction-continuity-v2.service<br>next/server | 2026-07-27 |
| /api/data-foundation/import-orchestrator | API Route | Production Surface | Yes | No | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/data-foundation-import-orchestrator.service<br>next/server | 2026-07-26 |
| /api/data-foundation/legacy-metrics | API Route | Deprecated | No | Yes | No | Yes | No | Yes | Yes | @/lib/api-contract<br>@/services/legacy-prediction-metric-isolation-v2.service<br>next/server | 2026-07-27 |
| /api/data-foundation/mlb | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/mlb-historical-foundation-v2.service<br>next/server | 2026-07-26 |
| /api/data-foundation/nba | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/nba-historical-foundation-v2.service<br>next/server | 2026-07-26 |
| /api/data-foundation/nfl | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/nfl-historical-foundation-v2.service<br>next/server | 2026-07-26 |
| /api/data-foundation/nhl | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/nhl-historical-foundation-v2.service<br>next/server | 2026-07-27 |
| /api/data-foundation/quality | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/data-foundation-quality-v2.service<br>next/server | 2026-07-27 |
| /api/data-foundation/readiness | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/data-foundation-quality-v2.service<br>next/server | 2026-07-27 |
| /api/data-foundation/reconciliation | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/data-foundation-quality-v2.service<br>next/server | 2026-07-27 |
| /api/data-foundation/results-crosswalk | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/multi-sport-results-crosswalk-foundation.service<br>next/server | 2026-07-28 |
| /api/data-foundation/seasons | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/data-foundation-season-governance.service<br>next/server | 2026-07-26 |
| /api/data-foundation/soccer | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/soccer-historical-foundation-v2.service<br>next/server | 2026-07-27 |
| /api/data-foundation/tennis-ufc | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/tennis-ufc-data-readiness-v2.service<br>next/server | 2026-07-27 |
| /api/data-quality/global | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/global-data-quality.service | 2026-07-12 |
| /api/events/[eventId]/identity | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/universal-event-identity.service<br>next/server | 2026-07-21 |
| /api/events/identity/audit | API Route | Protected | Yes | No | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/universal-event-identity.service<br>next/server | 2026-07-28 |
| /api/events/identity/conflicts | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/universal-event-identity.service<br>next/server | 2026-07-21 |
| /api/events/identity/unresolved | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/universal-event-identity.service<br>next/server | 2026-07-21 |
| /api/events/recovery/missing-canonical | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/missing-canonical-events-recovery.service<br>next/server | 2026-07-21 |
| /api/factors/debug | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/services/advanced-factors.service<br>next/server | 2026-06-22 |
| /api/features/registry/lookup | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/multi-sport-feature-registry.service<br>next/server | 2026-07-12 |
| /api/features/registry | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/multi-sport-feature-registry.service<br>next/server | 2026-07-12 |
| /api/features/registry/validation | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/multi-sport-feature-registry.service<br>next/server | 2026-07-12 |
| /api/features/store/definitions | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/config/sports.config<br>@/lib/api-contract<br>@/services/feature-store-core.service<br>@/types/multi-sport<br>next/server | 2026-07-12 |
| /api/features/store | API Route | Production Surface | Yes | No | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/feature-store-core.service<br>@/services/historical-feature-generation.service<br>next/server | 2026-07-14 |
| /api/features/store/validation | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/lib/server-schema-capabilities<br>@/services/feature-store-core.service<br>@/services/historical-feature-generation.service<br>next/server | 2026-07-14 |
| /api/games/[eventId]/intelligence | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/game-intelligence.service<br>next/server | 2026-07-21 |
| /api/head-to-head/recalculate | API Route | Protected | Yes | No | No | No | No | Yes | Yes | @/services/team-matchups-calculator.service<br>next/server | 2026-06-22 |
| /api/hedges | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/services/bankroll.service<br>@/services/hedge-builder.service<br>next/server | 2026-06-24 |
| /api/historical-import/cancel | API Route | Protected | Yes | No | No | No | No | Yes | Yes | @/lib/api-contract<br>@/lib/server-lazy-diagnostics<br>next/server | 2026-07-23 |
| /api/historical-import/execute | API Route | Protected | Yes | No | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/sportsdataio-historical-import-readiness.service<br>@/services/sportsdataio-mlb-historical-import-executor.service<br>@/services/sportsdataio-mlb-prospective-preview.service<br>next/server | 2026-07-23 |
| /api/historical-import/health | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/historical-import-engine.service<br>next/server | 2026-07-12 |
| /api/historical-import/jobs/[jobId] | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/lib/server-lazy-diagnostics<br>next/server | 2026-07-23 |
| /api/historical-import/jobs | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/historical-import-engine.service<br>next/server | 2026-07-12 |
| /api/historical-import/pilot-plan | API Route | Experimental | No | No | Yes | No | No | Yes | Yes | @/lib/api-contract<br>@/lib/server-lazy-diagnostics<br>next/server | 2026-07-23 |
| /api/historical-import/plan | API Route | Production Surface | Yes | No | No | No | No | Yes | Yes | @/lib/api-contract<br>@/lib/server-schema-capabilities<br>@/services/historical-feature-generation.service<br>@/services/historical-import-engine.service<br>next/server | 2026-07-23 |
| /api/historical-import/resume | API Route | Protected | Yes | No | No | No | No | Yes | Yes | @/lib/api-contract<br>@/lib/server-lazy-diagnostics<br>next/server | 2026-07-23 |
| /api/historical-import/validate/[jobId] | API Route | Production Surface | Yes | No | No | No | No | Yes | Yes | @/lib/api-contract<br>@/lib/server-lazy-diagnostics<br>next/server | 2026-07-23 |
| /api/injuries/seed | API Route | Production Surface | Yes | No | No | No | No | Yes | Yes | @/lib/supabase-admin<br>next/server | 2026-06-22 |
| /api/live-bets | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/services/bankroll.service<br>@/services/live-betting.service<br>next/server | 2026-06-25 |
| /api/live-betting | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/services/live-betting-engine.service<br>next/server | 2026-07-09 |
| /api/market-intelligence/movement | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/market-movement-intelligence.service<br>next/server | 2026-07-28 |
| /api/market-intelligence | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/market-intelligence-engine.service<br>next/server | 2026-07-15 |
| /api/market-opportunities/arbitrage | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/market-opportunity-suite.service<br>next/server | 2026-07-15 |
| /api/market-opportunities/best-value | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/best-value-scanner.service<br>next/server | 2026-07-15 |
| /api/market-opportunities/most-likely | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/market-opportunity-suite.service<br>next/server | 2026-07-15 |
| /api/markets/diagnostics | API Route | Experimental | No | Yes | Yes | No | No | Yes | Yes | @/lib/api-contract<br>@/services/universal-market-intelligence.service<br>next/server | 2026-07-24 |
| /api/markets/inventory | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/universal-market-intelligence.service<br>next/server | 2026-07-24 |
| /api/markets/provider-coverage | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/universal-market-intelligence.service<br>next/server | 2026-07-24 |
| /api/markets/readiness | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/universal-market-intelligence.service<br>next/server | 2026-07-24 |
| /api/mlb/ai-coach | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/mlb-ai-coach.service<br>next/server | 2026-07-17 |
| /api/mlb/current-season/data-quality | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/mlb-current-season-data-quality-audit.service<br>next/server | 2026-07-21 |
| /api/mlb/data-quality | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/mlb-data-quality.service<br>next/server | 2026-07-17 |
| /api/mlb/features/model-readiness | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/mlb-feature-model-readiness.service<br>next/server | 2026-07-21 |
| /api/mlb/features/preview | API Route | Experimental | No | Yes | Yes | No | No | Yes | Yes | @/lib/api-contract<br>@/services/mlb-feature-store-integration.service<br>next/server | 2026-07-12 |
| /api/mlb/features/store | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/mlb-feature-store-integration.service<br>next/server | 2026-07-12 |
| /api/mlb/features/validation | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/mlb-feature-store-integration.service<br>next/server | 2026-07-12 |
| /api/mlb/game-intelligence | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/mlb-current-lineup-context.service<br>@/services/mlb-player-projection-engine.service<br>next/server | 2026-07-25 |
| /api/mlb/games-payload-audit | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/mlb-games-payload-audit.service<br>next/server | 2026-07-17 |
| /api/mlb/historical-backfill/player-game-stats | API Route | Protected | Yes | No | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/mlb-current-season-backfill-orchestrator.service<br>next/server | 2026-07-21 |
| /api/mlb/historical-intelligence/retrosheet/features | API Route | Protected | Yes | No | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/retrosheet-historical-feature-store.service<br>next/server | 2026-07-22 |
| /api/mlb/historical-intelligence/retrosheet/game-engine | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/retrosheet-game-reconstruction.service<br>next/server | 2026-07-22 |
| /api/mlb/historical-intelligence/retrosheet/import | API Route | Protected | Yes | No | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/retrosheet-controlled-import.service<br>next/server | 2026-07-22 |
| /api/mlb/historical-intelligence/retrosheet | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/retrosheet-historical-data-lake.service<br>next/server | 2026-07-22 |
| /api/mlb/intelligence/pitcher-bullpen-foundation | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/mlb-model-platform.service<br>next/server | 2026-07-18 |
| /api/mlb/learning-brain | API Route | Protected | Yes | No | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/mlb-learning-brain.service<br>next/server | 2026-07-22 |
| /api/mlb/lineup-context | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/mlb-current-lineup-context.service<br>next/server | 2026-07-24 |
| /api/mlb/market-pipeline/diagnostics | API Route | Experimental | No | Yes | Yes | No | No | Yes | Yes | @/lib/api-contract<br>@/services/mlb-market-pipeline-diagnostics.service<br>next/server | 2026-07-22 |
| /api/mlb/markets/capabilities | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/mlb-market-capability-registry.service<br>next/server | 2026-07-17 |
| /api/mlb/markets/expansion-roadmap | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/lib/server-lazy-diagnostics<br>next/server | 2026-07-23 |
| /api/mlb/markets/first-five | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/services/mlb-first-five-readiness.service<br>next/server | 2026-07-24 |
| /api/mlb/markets/team-totals | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/services/mlb-team-totals-readiness.service<br>next/server | 2026-07-24 |
| /api/mlb/missing-intelligence/health | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/mlb-missing-intelligence.service | 2026-07-18 |
| /api/mlb/model-audit | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/mlb-model-audit.service<br>next/server | 2026-07-21 |
| /api/mlb/operations-center | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/lib/server-lazy-diagnostics<br>next/server | 2026-07-23 |
| /api/mlb/pitchers/[pitcherId]/projection | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/mlb-pitcher-projection-engine.service<br>next/server | 2026-07-26 |
| /api/mlb/pitchers/projections/generate | API Route | Protected | Yes | No | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/mlb-pitcher-projection-engine.service<br>next/server | 2026-07-26 |
| /api/mlb/pitchers/projections/health | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/mlb-pitcher-projection-engine.service<br>next/server | 2026-07-26 |
| /api/mlb/pitchers/projections/preview | API Route | Experimental | No | No | Yes | No | No | Yes | Yes | @/lib/api-contract<br>@/services/mlb-pitcher-projection-engine.service<br>next/server | 2026-07-26 |
| /api/mlb/pitchers/projections | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/mlb-pitcher-projection-engine.service<br>next/server | 2026-07-26 |
| /api/mlb/pitchers/projections/validation | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/mlb-pitcher-projection-engine.service<br>next/server | 2026-07-26 |
| /api/mlb/player-data-excellence | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/mlb-player-data-excellence.service<br>next/server | 2026-07-21 |
| /api/mlb/player-projections/[projectionId] | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/lib/supabase-admin<br>@/services/explainable-intelligence.service<br>@/services/mlb-player-projection-engine.service<br>@/services/projection-evolution.service | 2026-07-25 |
| /api/mlb/player-projections/batters | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/mlb-player-projection-engine.service<br>next/server | 2026-07-24 |
| /api/mlb/player-projections/lifecycle | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/mlb-player-projection-engine.service<br>next/server | 2026-07-24 |
| /api/mlb/player-projections/performance | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/mlb-player-projection-engine.service<br>next/server | 2026-07-24 |
| /api/mlb/player-projections/pitchers | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/mlb-player-projection-engine.service<br>next/server | 2026-07-24 |
| /api/mlb/player-projections/readiness | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/mlb-player-projection-engine.service<br>next/server | 2026-07-24 |
| /api/mlb/player-projections | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/mlb-player-projection-engine.service<br>next/server | 2026-07-24 |
| /api/mlb/player-props/[pitcherId] | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/mlb-player-prop-comparison.service<br>next/server | 2026-07-27 |
| /api/mlb/player-props/foundation | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/mlb-player-props-foundation.service<br>next/server | 2026-07-21 |
| /api/mlb/player-props/generate | API Route | Production Surface | Yes | No | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/mlb-player-prop-comparison.service<br>next/server | 2026-07-27 |
| /api/mlb/player-props/health | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/mlb-player-prop-comparison.service<br>@/services/mlb-player-prop-sync.service<br>next/server | 2026-07-27 |
| /api/mlb/player-props/mapping-diagnostics | API Route | Experimental | No | Yes | Yes | No | No | Yes | Yes | @/lib/api-contract<br>@/services/mlb-player-props-readiness-audit.service<br>next/server | 2026-07-24 |
| /api/mlb/player-props/preview | API Route | Experimental | No | No | Yes | No | No | Yes | Yes | @/lib/api-contract<br>@/services/mlb-player-prop-comparison.service<br>next/server | 2026-07-27 |
| /api/mlb/player-props/provider-audit | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/mlb-player-prop-sync.service<br>@/services/mlb-player-props-readiness-audit.service<br>next/server | 2026-07-26 |
| /api/mlb/player-props/readiness | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/mlb-player-props-readiness-audit.service<br>next/server | 2026-07-24 |
| /api/mlb/player-props | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/mlb-player-prop-comparison.service<br>next/server | 2026-07-27 |
| /api/mlb/player-props/sync | API Route | Protected | Yes | No | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/mlb-player-prop-sync.service<br>@/types/mlb-player-prop-ingestion<br>next/server | 2026-07-27 |
| /api/mlb/player-props/validation | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/mlb-player-prop-comparison.service<br>@/services/mlb-player-prop-sync.service<br>next/server | 2026-07-27 |
| /api/mlb/players/metadata-cache | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/mlb-model-platform.service | 2026-07-18 |
| /api/mlb/players/unresolved-identities | API Route | Protected | Yes | No | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/mlb-unresolved-player-identity.service<br>next/server | 2026-07-21 |
| /api/mlb/predictions/comparison | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/mlb-model-platform.service<br>next/server | 2026-07-18 |
| /api/mlb/predictions/health | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/mlb-prediction-engine.service<br>next/server | 2026-07-12 |
| /api/mlb/predictions/promotion-readiness | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/mlb-model-platform.service<br>next/server | 2026-07-18 |
| /api/mlb/predictions/rollback-plan | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/mlb-model-platform.service<br>next/server | 2026-07-18 |
| /api/mlb/predictions | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/mlb-prediction-engine.service<br>next/server | 2026-07-12 |
| /api/mlb/predictions/shadow-evaluation | API Route | Experimental | No | Yes | Yes | No | No | Yes | Yes | @/lib/api-contract<br>@/services/mlb-model-platform.service<br>next/server | 2026-07-18 |
| /api/mlb/predictions/v6-regeneration | API Route | Protected | Yes | No | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/sportsdataio-mlb-prospective-preview.service<br>next/server | 2026-07-17 |
| /api/mlb/predictions/v7-regeneration | API Route | Protected | Yes | No | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/sportsdataio-mlb-prospective-preview.service<br>next/server | 2026-07-18 |
| /api/mlb/predictions/validation | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/mlb-prediction-engine.service<br>next/server | 2026-07-12 |
| /api/mlb/pregame-starter-evidence | API Route | Protected | Yes | No | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/mlb-pregame-starter-evidence.service<br>next/server | 2026-07-22 |
| /api/mlb/probable-starters | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/mlb-starter-intelligence.service<br>next/server | 2026-07-24 |
| /api/mlb/projected-scores | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/mlb-projected-score.service<br>next/server | 2026-07-22 |
| /api/mlb/projections/health | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/universal-projection-engine.service<br>next/server | 2026-07-20 |
| /api/mlb/projections | API Route | Production Surface | Yes | No | No | No | No | Yes | Yes | @/app/api/projections/route | 2026-07-20 |
| /api/mlb/provider-capabilities/audit | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/mlb-provider-capability-audit.service<br>next/server | 2026-07-17 |
| /api/mlb/provider-verification/games-by-date | API Route | Protected | Yes | No | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/mlb-games-by-date-verification.service<br>next/server | 2026-07-17 |
| /api/mlb/stadiums/metadata-cache | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/mlb-model-platform.service<br>next/server | 2026-07-18 |
| /api/mlb/starter-diagnostics | API Route | Experimental | No | Yes | Yes | No | No | Yes | Yes | @/lib/api-contract<br>@/services/mlb-starter-intelligence.service<br>next/server | 2026-07-24 |
| /api/mlb/starter-history | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/mlb-starter-intelligence.service<br>next/server | 2026-07-24 |
| /api/mlb/starter-intelligence | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/mlb-starter-intelligence.service<br>next/server | 2026-07-24 |
| /api/mlb/starters/health | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/mlb-starter-sync.service<br>next/server | 2026-07-26 |
| /api/mlb/starters | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/mlb-starter-sync.service<br>next/server | 2026-07-26 |
| /api/mlb/starters/sync | API Route | Protected | Yes | No | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/mlb-starter-sync.service<br>next/server | 2026-07-26 |
| /api/mlb/starters/validation | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/mlb-starter-sync.service<br>next/server | 2026-07-26 |
| /api/mlb/temporal-health | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/lib/server-lazy-diagnostics<br>next/server | 2026-07-23 |
| /api/model/autotune | API Route | Production Surface | Yes | No | No | No | No | Yes | Yes | @/services/model-learning.service<br>next/server | 2026-07-07 |
| /api/model/calibration | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/services/model-calibration.service<br>next/server | 2026-06-28 |
| /api/model/intelligence | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/model-segments.service<br>next/server | 2026-07-31 |
| /api/model/learning | API Route | Production Surface | Yes | No | No | No | No | Yes | Yes | @/services/model-learning.service<br>next/server | 2026-06-28 |
| /api/model/metrics | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/model-metrics-framework.service | 2026-07-12 |
| /api/model/rollback/history | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/supabase-admin<br>next/server | 2026-07-07 |
| /api/model/rollback | API Route | Production Surface | Yes | No | No | No | No | Yes | Yes | @/services/model-learning.service<br>next/server | 2026-07-07 |
| /api/model/self-learning | API Route | Production Surface | Yes | No | No | No | No | Yes | Yes | @/services/self-learning-engine.service<br>next/server | 2026-07-08 |
| /api/model/segments | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/model-segments.service<br>next/server | 2026-07-31 |
| /api/model/shadow-calibration | API Route | Experimental | No | Yes | Yes | No | No | Yes | Yes | @/services/historical-shadow-calibration.service<br>next/server | 2026-07-24 |
| /api/model/status | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/services/model-calibration.service<br>@/services/model-learning.service<br>@/services/model-versioning.service<br>next/server | 2026-07-07 |
| /api/model/versions | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/services/model-versioning.service<br>next/server | 2026-07-07 |
| /api/nba/adapter/status | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/services/nba-adapter.service<br>next/server | 2026-07-11 |
| /api/nba/data-health | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/services/nba-data-sync.service<br>next/server | 2026-07-11 |
| /api/nba/data-quality/issues | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/services/nba-data-quality.service<br>next/server | 2026-07-12 |
| /api/nba/data-quality | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/services/nba-data-quality.service<br>next/server | 2026-07-12 |
| /api/nba/features/preview | API Route | Experimental | No | Yes | Yes | No | No | Yes | Yes | @/lib/api-contract<br>@/services/nba-feature-store-integration.service<br>next/server | 2026-07-13 |
| /api/nba/features/store | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/nba-feature-store-integration.service<br>next/server | 2026-07-12 |
| /api/nba/features/validation | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/nba-feature-store-integration.service<br>next/server | 2026-07-13 |
| /api/nba/markets/multi-book | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/services/nba-multi-book-comparison.service<br>next/server | 2026-07-12 |
| /api/nba/markets/steam | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/services/nba-steam-move-detection.service<br>next/server | 2026-07-12 |
| /api/nba/predictions/backtest | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/services/nba-backtesting-calibration.service<br>next/server | 2026-07-12 |
| /api/nba/predictions/backtest/run | API Route | Protected | Yes | No | No | No | No | Yes | Yes | @/services/nba-backtesting-calibration.service<br>next/server | 2026-07-12 |
| /api/nba/predictions/calibration | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/services/nba-backtesting-calibration.service<br>next/server | 2026-07-12 |
| /api/nba/predictions/generate | API Route | Protected | Yes | No | No | No | No | Yes | Yes | @/lib/server-lazy-diagnostics<br>next/server | 2026-07-23 |
| /api/nba/predictions/health | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/server-lazy-diagnostics<br>next/server | 2026-07-23 |
| /api/nba/predictions/model-health | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/server-lazy-diagnostics<br>next/server | 2026-07-23 |
| /api/nba/predictions/performance | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/server-lazy-diagnostics<br>next/server | 2026-07-23 |
| /api/nba/predictions | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/server-lazy-diagnostics<br>next/server | 2026-07-23 |
| /api/nba/predictions/settle/event/[eventId] | API Route | Protected | Yes | No | No | No | No | Yes | Yes | @/lib/server-lazy-diagnostics<br>next/server | 2026-07-23 |
| /api/nba/predictions/settle | API Route | Protected | Yes | No | No | No | No | Yes | Yes | @/lib/server-lazy-diagnostics<br>next/server | 2026-07-23 |
| /api/nba/predictions/settlement-backlog | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/server-lazy-diagnostics<br>next/server | 2026-07-23 |
| /api/nba/predictions/validate | API Route | Protected | Yes | No | No | No | No | Yes | Yes | @/lib/server-lazy-diagnostics<br>next/server | 2026-07-23 |
| /api/nba/reconciliation/plan | API Route | Production Surface | Yes | No | No | No | No | Yes | Yes | @/services/nba-data-quality.service<br>next/server | 2026-07-12 |
| /api/nba/reconciliation/status | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/services/nba-data-quality.service<br>next/server | 2026-07-12 |
| /api/nba/sync/games | API Route | Protected | Yes | No | No | No | No | Yes | Yes | @/services/nba-data-sync.service<br>next/server | 2026-07-11 |
| /api/nba/sync/injuries | API Route | Protected | Yes | No | No | No | No | Yes | Yes | @/services/nba-data-sync.service<br>next/server | 2026-07-11 |
| /api/nba/sync/lineups | API Route | Protected | Yes | No | No | No | No | Yes | Yes | @/services/nba-data-sync.service<br>next/server | 2026-07-11 |
| /api/nba/sync/odds | API Route | Protected | Yes | No | No | No | No | Yes | Yes | @/services/nba-data-sync.service<br>next/server | 2026-07-11 |
| /api/nba/sync/players | API Route | Protected | Yes | No | No | No | No | Yes | Yes | @/services/nba-data-sync.service<br>next/server | 2026-07-11 |
| /api/nba/sync | API Route | Protected | Yes | No | No | No | No | Yes | Yes | @/services/nba-data-sync.service<br>next/server | 2026-07-11 |
| /api/nba/sync/standings | API Route | Protected | Yes | No | No | No | No | Yes | Yes | @/services/nba-data-sync.service<br>next/server | 2026-07-11 |
| /api/nba/sync/stats | API Route | Protected | Yes | No | No | No | No | Yes | Yes | @/services/nba-data-sync.service<br>next/server | 2026-07-11 |
| /api/nba/sync/status | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/services/nba-data-sync.service<br>next/server | 2026-07-11 |
| /api/nba/sync/teams | API Route | Protected | Yes | No | No | No | No | Yes | Yes | @/services/nba-data-sync.service<br>next/server | 2026-07-11 |
| /api/nfl/features/preview | API Route | Experimental | No | Yes | Yes | No | No | Yes | Yes | @/lib/api-contract<br>@/services/nfl-feature-store-integration.service<br>next/server | 2026-07-12 |
| /api/nfl/features/store | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/nfl-feature-store-integration.service<br>next/server | 2026-07-12 |
| /api/nfl/features/validation | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/nfl-feature-store-integration.service<br>next/server | 2026-07-12 |
| /api/nfl/predictions/health | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/nfl-prediction-engine.service<br>next/server | 2026-07-13 |
| /api/nfl/predictions | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/stored-preview-prediction-lifecycle.service<br>next/server | 2026-07-28 |
| /api/nfl/predictions/validation | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/nfl-prediction-engine.service<br>next/server | 2026-07-13 |
| /api/nhl/features/preview | API Route | Experimental | No | Yes | Yes | No | No | Yes | Yes | @/lib/api-contract<br>@/services/nhl-feature-store-integration.service<br>next/server | 2026-07-13 |
| /api/nhl/features/store | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/nhl-feature-store-integration.service<br>next/server | 2026-07-13 |
| /api/nhl/features/validation | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/nhl-feature-store-integration.service<br>next/server | 2026-07-13 |
| /api/nhl/predictions/health | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/nhl-prediction-engine.service<br>next/server | 2026-07-13 |
| /api/nhl/predictions | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/stored-preview-prediction-lifecycle.service<br>next/server | 2026-07-28 |
| /api/nhl/predictions/validation | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/nhl-prediction-engine.service<br>next/server | 2026-07-13 |
| /api/observability/runtime | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/lib/server-lazy-diagnostics | 2026-07-23 |
| /api/odds | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/services/prediction.service<br>next/server | 2026-07-11 |
| /api/operating-day/[operatingDayId]/settle | API Route | Protected | Yes | No | No | No | No | Yes | Yes | @/lib/api-contract<br>@/lib/server-lazy-diagnostics<br>next/server | 2026-07-23 |
| /api/operating-day/automation/status | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/operating-day-automation.service<br>next/server | 2026-07-23 |
| /api/operating-day/execute | API Route | Protected | Yes | No | No | No | No | Yes | Yes | @/lib/api-contract<br>@/lib/server-lazy-diagnostics<br>next/server | 2026-07-23 |
| /api/operating-day/status | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/lib/server-lazy-diagnostics<br>next/server | 2026-07-23 |
| /api/operating-day/validation | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/lib/server-lazy-diagnostics<br>next/server | 2026-07-23 |
| /api/operations/adaptive-refresh | API Route | Protected | Yes | No | No | No | No | Yes | Yes | @/lib/api-contract<br>@/lib/server-lazy-diagnostics<br>next/server | 2026-07-27 |
| /api/operations/adaptive-refresh/status | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/lib/server-lazy-diagnostics<br>next/server | 2026-07-23 |
| /api/operations/change-events | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/lib/server-lazy-diagnostics<br>next/server | 2026-07-23 |
| /api/operations/data-freshness | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/lib/server-lazy-diagnostics<br>next/server | 2026-07-23 |
| /api/operations/health | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/lib/server-lazy-diagnostics<br>next/server | 2026-07-23 |
| /api/operations/mlb-autonomous-operations | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/mlb-autonomous-operations-v1.service<br>next/server | 2026-07-29 |
| /api/operations/odds-change-refresh-readiness | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/prediction-epoch-shadow-readiness.service<br>next/server | 2026-07-28 |
| /api/operations/pregame-odds-refresh-sla | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/prediction-epoch-shadow-readiness.service<br>next/server | 2026-07-28 |
| /api/operations/provider-budget-forecast | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/lib/server-lazy-diagnostics<br>next/server | 2026-07-23 |
| /api/operations/refresh-plan | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/lib/server-lazy-diagnostics<br>next/server | 2026-07-23 |
| /api/operations/settlement-guarantee | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/settlement-guarantee.service<br>next/server | 2026-07-31 |
| /api/operations/status | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/lib/server-lazy-diagnostics<br>next/server | 2026-07-23 |
| /api/operations/validation | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/adaptive-refresh-orchestrator.service<br>@/services/ai-bet-finder.service<br>@/services/bsn-core-certification.service<br>@/services/game-intelligence.service | 2026-07-26 |
| /api/parlays | API Route | Production Surface | Yes | No | No | No | No | Yes | Yes | @/services/bet-slip-optimizer.service<br>@/services/model-only-intelligence.service<br>@/services/parlay-generator.service<br>next/server | 2026-07-22 |
| /api/performance/[sport] | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/server-lazy-diagnostics<br>@/services/performance-product-contract.service<br>next/server | 2026-07-24 |
| /api/performance/daily-update | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/server-lazy-diagnostics<br>next/server | 2026-07-23 |
| /api/performance/evolution | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/services/performance-product-contract.service<br>next/server | 2026-07-24 |
| /api/performance/goals | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/services/performance-product-contract.service<br>next/server | 2026-07-26 |
| /api/performance/history | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/services/performance-scope-v2.service<br>next/server | 2026-07-31 |
| /api/performance/readiness | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/server-lazy-diagnostics<br>next/server | 2026-07-23 |
| /api/performance/report-card | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/services/performance-product-contract.service<br>next/server | 2026-07-24 |
| /api/performance | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/server-lazy-diagnostics<br>@/services/performance-product-contract.service<br>next/server | 2026-07-31 |
| /api/performance/sports | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/services/performance-product-contract.service<br>next/server | 2026-07-24 |
| /api/performance/trust | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/services/performance-product-contract.service<br>next/server | 2026-07-24 |
| /api/performance/validation | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/server-lazy-diagnostics<br>next/server | 2026-07-23 |
| /api/picks/explain | API Route | Production Surface | Yes | No | No | No | No | Yes | Yes | @/services/ai-pick-explainer.service<br>@/services/explainability.service<br>next/server | 2026-07-08 |
| /api/pitchers/seed | API Route | Production Surface | Yes | No | No | No | No | Yes | Yes | @/lib/supabase-admin<br>next/server | 2026-06-22 |
| /api/play-of-the-day | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/services/play-of-the-day.service<br>next/server | 2026-06-24 |
| /api/players/[playerId]/intelligence | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/player-intelligence.service<br>next/server | 2026-07-21 |
| /api/portfolio-intelligence | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/portfolio-intelligence.service<br>@/types/portfolio-intelligence<br>next/server | 2026-07-28 |
| /api/portfolio/ai-v2 | API Route | Production Surface | Yes | No | No | No | No | Yes | Yes | @/config/sports.config<br>@/services/portfolio-ai-v2.service<br>next/server | 2026-07-11 |
| /api/portfolio | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/services/bankroll.service<br>@/services/portfolio-builder.service<br>next/server | 2026-06-24 |
| /api/prediction-engine/v4 | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/services/prediction-engine-v4.service<br>next/server | 2026-07-10 |
| /api/prediction-epoch/activation-readiness | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/prediction-epoch-shadow-readiness.service<br>next/server | 2026-07-28 |
| /api/prediction-epoch/shadow-readiness | API Route | Experimental | No | Yes | Yes | No | No | Yes | Yes | @/lib/api-contract<br>@/services/prediction-epoch-shadow-readiness.service<br>next/server | 2026-07-28 |
| /api/prediction-safety | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/prediction-safety.service | 2026-07-12 |
| /api/prediction-sdk | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/sport-prediction-engine-sdk.service<br>next/server | 2026-07-12 |
| /api/prediction-sdk/validation | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/sport-prediction-engine-sdk.service<br>next/server | 2026-07-12 |
| /api/predictions/by-sport | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/config/sports.config<br>@/services/prediction-history.service<br>@/services/top-picks.service<br>next/server | 2026-07-15 |
| /api/predictions/performance | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/services/prediction-history.service<br>next/server | 2026-06-22 |
| /api/predictions/provenance | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/legacy-prediction-provenance.service<br>next/server | 2026-07-22 |
| /api/predictions/settle/debug | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/supabase<br>next/server | 2026-06-22 |
| /api/predictions/settle | API Route | Protected | Yes | No | No | No | No | Yes | Yes | @/services/clv-analytics.service<br>@/services/model-calibration.service<br>@/services/model-learning.service<br>@/services/prediction-settlement.service<br>@/services/team-stats.service | 2026-07-26 |
| /api/predictions/top | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/services/best-bets-today.service<br>@/services/top-picks.service<br>next/server | 2026-07-17 |
| /api/probability-picks/generate | API Route | Production Surface | Yes | No | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/probability-picks.service<br>next/server | 2026-07-26 |
| /api/probability-picks/parlays | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/probability-picks.service<br>@/types/probability-picks<br>next/server | 2026-07-27 |
| /api/probability-picks/preview | API Route | Experimental | No | No | Yes | No | No | Yes | Yes | @/lib/api-contract<br>@/services/probability-picks.service<br>next/server | 2026-07-26 |
| /api/probability-picks | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/probability-picks.service<br>@/types/probability-picks<br>next/server | 2026-07-27 |
| /api/probability-picks/validation | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/probability-picks.service | 2026-07-26 |
| /api/production-readiness/audit | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/lib/server-lazy-diagnostics<br>next/server | 2026-07-23 |
| /api/projection-evolution | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/projection-evolution.service<br>next/server | 2026-07-25 |
| /api/projections | API Route | Protected | Yes | No | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/universal-projection-engine.service<br>next/server | 2026-07-20 |
| /api/providers/budget/status | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/provider-budget.service<br>next/server | 2026-07-17 |
| /api/providers/capabilities | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/multi-sport-resolution.service<br>@/services/provider-intelligence.service<br>next/server | 2026-07-12 |
| /api/providers/intelligence | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/provider-intelligence.service | 2026-07-12 |
| /api/providers/live-verification | API Route | Protected | Yes | No | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/live-provider-verification.service<br>next/server | 2026-07-20 |
| /api/providers/route-plan | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/provider-intelligence.service<br>next/server | 2026-07-12 |
| /api/providers/sdk | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/provider-adapter-sdk.service<br>next/server | 2026-07-12 |
| /api/providers/sdk/validation | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/provider-adapter-sdk.service<br>next/server | 2026-07-12 |
| /api/providers/sportsdataio/capabilities | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/sportsdataio-runtime-adapter.service<br>next/server | 2026-07-13 |
| /api/providers/sportsdataio/contract | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/sportsdataio-adapter-contract.service<br>next/server | 2026-07-12 |
| /api/providers/sportsdataio/discovery | API Route | Protected | Yes | No | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/sportsdataio-mlb-discovery.service<br>next/server | 2026-07-20 |
| /api/providers/sportsdataio/execution-readiness/validation | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/lib/server-lazy-diagnostics<br>next/server | 2026-07-23 |
| /api/providers/sportsdataio/maximization-audit | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/sportsdataio-subscription-maximization-audit.service<br>next/server | 2026-07-21 |
| /api/providers/sportsdataio/nba/approval-packet | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/lib/server-lazy-diagnostics<br>next/server | 2026-07-23 |
| /api/providers/sportsdataio/nba/blocker-resolution | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/lib/server-lazy-diagnostics<br>next/server | 2026-07-23 |
| /api/providers/sportsdataio/nba/completion-audit | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/lib/server-lazy-diagnostics<br>next/server | 2026-07-23 |
| /api/providers/sportsdataio/nba/completion-evidence | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/lib/server-lazy-diagnostics<br>next/server | 2026-07-23 |
| /api/providers/sportsdataio/nba/contract-audit | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/lib/server-lazy-diagnostics<br>next/server | 2026-07-23 |
| /api/providers/sportsdataio/nba/domain-proof | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/lib/server-lazy-diagnostics<br>next/server | 2026-07-23 |
| /api/providers/sportsdataio/nba/evidence-export | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/lib/server-lazy-diagnostics<br>next/server | 2026-07-23 |
| /api/providers/sportsdataio/nba/external-blockers | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/lib/server-lazy-diagnostics<br>next/server | 2026-07-23 |
| /api/providers/sportsdataio/nba/next-pilot-preflight | API Route | Experimental | No | Yes | Yes | No | No | Yes | Yes | @/lib/api-contract<br>@/lib/server-lazy-diagnostics<br>next/server | 2026-07-23 |
| /api/providers/sportsdataio/nba/objective-audit | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/lib/server-lazy-diagnostics<br>next/server | 2026-07-23 |
| /api/providers/sportsdataio/nba/odds/endpoint-preflight | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/sportsdataio-nba-odds-readiness.service<br>next/server | 2026-07-14 |
| /api/providers/sportsdataio/nba/odds/readiness | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/sportsdataio-nba-odds-readiness.service<br>next/server | 2026-07-13 |
| /api/providers/sportsdataio/nba/player-props/endpoint-preflight | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/sportsdataio-nba-player-props-readiness.service<br>next/server | 2026-07-14 |
| /api/providers/sportsdataio/nba/player-props/readiness | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/sportsdataio-nba-player-props-readiness.service<br>next/server | 2026-07-13 |
| /api/providers/sportsdataio/nba/player-stats/migration-preflight | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/sportsdataio-nba-player-stats-readiness.service<br>next/server | 2026-07-14 |
| /api/providers/sportsdataio/nba/player-stats/readiness | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/sportsdataio-nba-player-stats-readiness.service<br>next/server | 2026-07-13 |
| /api/providers/sportsdataio/nba/production-gate | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/lib/server-lazy-diagnostics<br>next/server | 2026-07-23 |
| /api/providers/sportsdataio/nba/production-usage-exclusion | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/lib/server-lazy-diagnostics<br>next/server | 2026-07-23 |
| /api/providers/sportsdataio/nba/provider-gate | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/lib/server-lazy-diagnostics<br>next/server | 2026-07-23 |
| /api/providers/sportsdataio/nba/readiness | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/lib/server-lazy-diagnostics<br>next/server | 2026-07-23 |
| /api/providers/sportsdataio/nba/safe-next-actions | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/lib/server-lazy-diagnostics<br>next/server | 2026-07-23 |
| /api/providers/sportsdataio/nba/trial-isolation | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/sportsdataio-nba-trial-isolation-audit.service<br>next/server | 2026-07-13 |
| /api/providers/sportsdataio/status | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/sportsdataio-runtime-adapter.service<br>next/server | 2026-07-13 |
| /api/providers/sportsdataio/validation | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/sportsdataio-adapter-contract.service<br>next/server | 2026-07-12 |
| /api/providers/the-odds-api/capability-audit | API Route | Production Surface | Yes | No | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/the-odds-api-capability-audit.service<br>next/server | 2026-07-26 |
| /api/providers/the-odds-api/capability | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/the-odds-api-maximum-utilization.service<br>next/server | 2026-07-28 |
| /api/providers/the-odds-api/catalog | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/the-odds-api-maximum-utilization.service<br>next/server | 2026-07-28 |
| /api/providers/the-odds-api/current-odds | API Route | Production Surface | Yes | No | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/the-odds-api-current-odds-acquisition.service<br>next/server | 2026-07-28 |
| /api/providers/the-odds-api/event-crosswalk | API Route | Production Surface | Yes | No | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/the-odds-api-event-crosswalk.service<br>next/server | 2026-07-26 |
| /api/providers/the-odds-api/pitcher-identity | API Route | Production Surface | Yes | No | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/the-odds-api-pitcher-identity-bridge.service<br>next/server | 2026-07-26 |
| /api/providers/the-odds-api/quota | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/the-odds-api-maximum-utilization.service<br>next/server | 2026-07-28 |
| /api/ratings | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/supabase<br>@/services/rating.service<br>next/server | 2026-06-21 |
| /api/recommendation-pipeline/trace | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/services/recommendation-pipeline-trace.service<br>next/server | 2026-07-23 |
| /api/recommendation-readiness | API Route | Protected | Yes | No | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/day1-recommendation-readiness.service<br>@/services/prospective-official-eligibility-gate.service<br>next/server | 2026-07-16 |
| /api/reconciliation/plan | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/global-data-quality.service | 2026-07-12 |
| /api/results/backfill | API Route | Protected | Yes | No | No | No | No | Yes | Yes | @/config/sports.config<br>@/services/results-sync.service<br>@/services/team-stats-calculator.service<br>next/server | 2026-06-22 |
| /api/results | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | next/server | 2026-06-21 |
| /api/results/sync | API Route | Protected | Yes | No | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/results-sync.service<br>next/server | 2026-07-17 |
| /api/settlement/core | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/settlement-core.service | 2026-07-12 |
| /api/settlement/reconciliation | API Route | Protected | Yes | No | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/settlement-reconciliation.service<br>next/server | 2026-07-23 |
| /api/sharp-money | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/services/sharp-money-intelligence.service<br>next/server | 2026-07-09 |
| /api/simulator/monte-carlo | API Route | Production Surface | Yes | No | No | No | No | Yes | Yes | @/services/monte-carlo-engine.service<br>next/server | 2026-07-09 |
| /api/simulator | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/services/portfolio-simulator.service<br>next/server | 2026-06-24 |
| /api/slate/next/status | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/next-slate.service<br>next/server | 2026-07-17 |
| /api/soccer/features/preview | API Route | Experimental | No | Yes | Yes | No | No | Yes | Yes | @/lib/api-contract<br>@/services/soccer-feature-store-integration.service<br>next/server | 2026-07-13 |
| /api/soccer/features/store | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/soccer-feature-store-integration.service<br>next/server | 2026-07-13 |
| /api/soccer/features/validation | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/soccer-feature-store-integration.service<br>next/server | 2026-07-13 |
| /api/soccer/predictions/health | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/soccer-prediction-engine.service<br>next/server | 2026-07-13 |
| /api/soccer/predictions | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/soccer-prediction-engine.service<br>next/server | 2026-07-13 |
| /api/soccer/predictions/validation | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/soccer-prediction-engine.service<br>next/server | 2026-07-13 |
| /api/sports-analyst/game/[eventId] | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/sports-analyst.service<br>next/server | 2026-07-21 |
| /api/sports/[sport]/events/[eventId] | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/services/multi-sport-query.service<br>@/services/multi-sport-resolution.service<br>next/server | 2026-07-11 |
| /api/sports/[sport]/events | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/services/multi-sport-query.service<br>@/services/multi-sport-resolution.service<br>next/server | 2026-07-11 |
| /api/sports/[sport]/injuries | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/services/multi-sport-query.service<br>@/services/multi-sport-resolution.service<br>next/server | 2026-07-11 |
| /api/sports/[sport]/leagues | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/services/multi-sport-query.service<br>@/services/multi-sport-resolution.service<br>next/server | 2026-07-11 |
| /api/sports/[sport]/lineups | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/services/multi-sport-query.service<br>@/services/multi-sport-resolution.service<br>next/server | 2026-07-11 |
| /api/sports/[sport]/markets | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/services/multi-sport-query.service<br>@/services/multi-sport-resolution.service<br>next/server | 2026-07-11 |
| /api/sports/[sport]/odds | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/services/multi-sport-query.service<br>@/services/multi-sport-resolution.service<br>next/server | 2026-07-11 |
| /api/sports/[sport]/participants | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/services/multi-sport-query.service<br>@/services/multi-sport-resolution.service<br>next/server | 2026-07-11 |
| /api/sports/[sport]/providers | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/services/multi-sport-query.service<br>@/services/multi-sport-resolution.service<br>next/server | 2026-07-11 |
| /api/sports/[sport] | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/services/multi-sport-query.service<br>@/services/multi-sport-resolution.service<br>next/server | 2026-07-11 |
| /api/sports/[sport]/standings | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/services/multi-sport-query.service<br>@/services/multi-sport-resolution.service<br>next/server | 2026-07-11 |
| /api/sports/[sport]/stats | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/services/multi-sport-query.service<br>@/services/multi-sport-resolution.service<br>next/server | 2026-07-11 |
| /api/sports/health | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/services/multi-sport-health.service<br>@/services/multi-sport-validation.service<br>next/server | 2026-07-11 |
| /api/sports | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/services/multi-sport-query.service<br>@/services/multi-sport-validation.service<br>next/server | 2026-07-11 |
| /api/sportsbook-intelligence | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/services/sportsbook-intelligence.service<br>next/server | 2026-06-28 |
| /api/sync/reliability | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/sync-reliability.service | 2026-07-12 |
| /api/system/version | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>fs/promises<br>next/server<br>path | 2026-07-18 |
| /api/team-stats/recalculate | API Route | Protected | Yes | No | No | No | No | Yes | Yes | @/services/team-stats-calculator.service<br>next/server | 2026-06-22 |
| /api/team-stats | API Route | Production Surface | Yes | No | No | No | No | Yes | Yes | @/lib/supabase<br>next/server | 2026-06-21 |
| /api/team-stats/sync | API Route | Protected | Yes | No | No | No | No | Yes | Yes | @/services/mlb-team-stats-sync.service<br>next/server | 2026-06-22 |
| /api/tennis/features/preview | API Route | Experimental | No | Yes | Yes | No | No | Yes | Yes | @/lib/api-contract<br>@/services/tennis-feature-store-integration.service<br>next/server | 2026-07-13 |
| /api/tennis/features/store | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/tennis-feature-store-integration.service<br>next/server | 2026-07-13 |
| /api/tennis/features/validation | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/tennis-feature-store-integration.service<br>next/server | 2026-07-13 |
| /api/tennis/predictions/health | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/tennis-prediction-engine.service<br>next/server | 2026-07-13 |
| /api/tennis/predictions | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/tennis-prediction-engine.service<br>next/server | 2026-07-13 |
| /api/tennis/predictions/validation | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/tennis-prediction-engine.service<br>next/server | 2026-07-13 |
| /api/test-providers | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/services/apis/api-factory<br>next/server | 2026-06-21 |
| /api/ufc/features/preview | API Route | Experimental | No | Yes | Yes | No | No | Yes | Yes | @/lib/api-contract<br>@/services/ufc-feature-store-integration.service<br>next/server | 2026-07-13 |
| /api/ufc/features/store | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/ufc-feature-store-integration.service<br>next/server | 2026-07-13 |
| /api/ufc/features/validation | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/ufc-feature-store-integration.service<br>next/server | 2026-07-13 |
| /api/ufc/predictions/health | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/ufc-prediction-engine.service<br>next/server | 2026-07-13 |
| /api/ufc/predictions | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/ufc-prediction-engine.service<br>next/server | 2026-07-13 |
| /api/ufc/predictions/validation | API Route | Production Surface | Yes | Yes | No | No | No | Yes | Yes | @/lib/api-contract<br>@/services/ufc-prediction-engine.service<br>next/server | 2026-07-13 |
| /api/weather/seed | API Route | Production Surface | Yes | No | No | No | No | Yes | Yes | @/lib/supabase-admin<br>next/server | 2026-06-22 |
| /admin/historical-diagnostics | App Route | Experimental | No | No | Yes | No | Yes | No | Yes | @/services/retrosheet-game-reconstruction.service<br>@/services/retrosheet-historical-feature-store.service<br>next | 2026-07-23 |
| /ai-bet-finder | App Route | Production Surface | Yes | No | No | No | Yes | No | Yes | @/components/market-opportunities/AiBetFinderTool | 2026-07-28 |
| /ai-operations | App Route | Production Surface | Yes | No | No | No | Yes | No | Yes | @/components/dashboard/DashboardSection<br>@/components/dashboard/DashboardShell<br>@/components/product/ProductStatus<br>@/services/ai-learning-lifecycle.service<br>@/services/current-board.service | 2026-07-28 |
| /arbitrage | App Route | Production Surface | Yes | No | No | No | Yes | No | Yes | @/components/market-opportunities/ArbitrageTool | 2026-07-28 |
| /autonomous-daily-ai | App Route | Production Surface | Yes | No | No | No | Yes | No | Yes | @/components/dashboard/DashboardShell<br>@/services/autonomous-daily-ai.service | 2026-07-28 |
| /best-value | App Route | Production Surface | Yes | No | No | No | Yes | No | Yes | @/components/market-opportunities/BestValueTool | 2026-07-28 |
| /betting-workbench | App Route | Production Surface | Yes | No | No | No | Yes | No | Yes | @/components/market-opportunities/BettingWorkbenchTool | 2026-07-28 |
| /closing-line-intelligence | App Route | Production Surface | Yes | No | No | No | Yes | No | Yes | @/components/dashboard/DashboardShell<br>@/services/closing-line-intelligence.service | 2026-07-28 |
| /dashboard | App Route | Production Surface | Yes | No | No | No | Yes | No | Yes | @/components/dashboard/AdvancedEvidenceDisclosure<br>@/components/dashboard/DashboardDeveloperGroups<br>@/components/dashboard/DashboardSection<br>@/components/dashboard/DashboardShell<br>@/components/dashboard/TodayDecisionPanel | 2026-07-31 |
| /data-coverage/[sport] | App Route | Production Surface | Yes | No | No | No | Yes | No | Yes | @/components/dashboard/DashboardSection<br>@/components/dashboard/DashboardShell<br>@/components/product/ProductStatus<br>@/services/data-coverage-inventory.service<br>next/navigation | 2026-07-28 |
| /data-coverage | App Route | Production Surface | Yes | No | No | No | Yes | No | Yes | @/components/dashboard/DashboardSection<br>@/components/dashboard/DashboardShell<br>@/components/product/ProductStatus<br>@/services/data-coverage-inventory.service<br>@/services/multi-sport-data-expansion-checkpoint2.service | 2026-07-31 |
| /game-intelligence/[eventId] | App Route | Production Surface | Yes | No | No | No | Yes | No | Yes | @/components/dashboard/MlbGameIntelligenceDetailClient | 2026-07-24 |
| /game-intelligence | App Route | Production Surface | Yes | No | No | No | Yes | No | Yes | @/components/dashboard/MlbGameIntelligencePageClient | 2026-07-24 |
| /login | App Route | Production Surface | Yes | No | No | No | Yes | No | Yes | @/lib/supabase<br>react | 2026-07-28 |
| /market-intelligence | App Route | Production Surface | Yes | No | No | No | Yes | No | Yes | @/components/dashboard/DashboardShell<br>@/components/product/ProductStatus<br>@/services/market-movement-intelligence.service | 2026-07-28 |
| /mlb-operations | App Route | Production Surface | Yes | No | No | No | Yes | No | Yes | @/services/mlb-operations-center.service<br>next | 2026-07-23 |
| /model | App Route | Production Surface | Yes | No | No | No | Yes | No | Yes | @/components/dashboard/AIModelCenter | 2026-07-28 |
| /most-likely | App Route | Production Surface | Yes | No | No | No | Yes | No | Yes | @/components/market-opportunities/MostLikelyTool | 2026-07-28 |
| / | App Route | Production Surface | Yes | No | No | No | Yes | No | Yes | @/components/home/HomeBettingPlan | 2026-07-31 |
| /performance | App Route | Production Surface | Yes | No | No | No | Yes | No | Yes | @/components/performance/PerformanceProductClient | 2026-07-20 |
| /player-projections/[projectionId] | App Route | Production Surface | Yes | No | No | No | Yes | No | Yes | @/components/dashboard/MlbPlayerProjectionDetailClient | 2026-07-24 |
| /player-projections | App Route | Production Surface | Yes | No | No | No | Yes | No | Yes | @/components/dashboard/MlbPlayerProjectionPageClient | 2026-07-24 |
| /portfolio-intelligence | App Route | Production Surface | Yes | No | No | No | Yes | No | Yes | @/components/dashboard/DashboardShell<br>@/components/product/ProductStatus<br>@/services/portfolio-intelligence.service | 2026-07-28 |
| /probability-picks | App Route | Production Surface | Yes | No | No | No | Yes | No | Yes | @/components/probability-picks/ProbabilityPicksClient | 2026-07-26 |
| /projections | App Route | Production Surface | Yes | No | No | No | Yes | No | Yes | @/components/dashboard/MlbProjectionBoardClient | 2026-07-20 |
| /register | App Route | Production Surface | Yes | No | No | No | Yes | No | Yes | @/lib/supabase<br>react | 2026-07-28 |
| /sports-center/[sport] | App Route | Production Surface | Yes | No | No | No | Yes | No | Yes | @/components/dashboard/DashboardSection<br>@/components/dashboard/DashboardShell<br>@/components/product/ProductStatus<br>@/services/sports-center.service<br>next/navigation | 2026-07-27 |
| /sports-center | App Route | Production Surface | Yes | No | No | No | Yes | No | Yes | @/components/dashboard/DashboardSection<br>@/components/dashboard/DashboardShell<br>@/components/product/ProductStatus<br>@/services/sports-center.service<br>@/types/sports-center | 2026-07-27 |
| .github / workflows / operating-day-refresh | Cron | Scheduled | Yes | No | No | No | No | No | Yes | None detected | 2026-07-25 |
| .github / workflows / production-operating-day-heartbeat | Cron | Scheduled | Yes | No | No | No | No | No | No | None detected | 2026-07-31 |
| .github / workflows / production-operating-day | Cron | Scheduled | Yes | No | No | No | No | No | Yes | None detected | 2026-07-31 |
| scripts / dashboard-navigation-key-smoke | Dashboard | Production Surface | Yes | No | No | No | No | No | No | @playwright/test<br>node:child_process<br>node:util | 2026-07-28 |
| components / dashboard / AdaptiveOperationsPanel | Dashboard | Production Surface | Yes | No | No | No | Yes | No | No | react | 2026-07-20 |
| components / dashboard / AdaptiveWeightsPanel | Dashboard | Production Surface | Yes | No | No | No | Yes | No | No | @/context/DashboardContext | 2026-07-01 |
| components / dashboard / AdvancedEvidenceDisclosure | Dashboard | Production Surface | Yes | No | No | No | Yes | No | No | react | 2026-07-31 |
| components / dashboard / AICoachPanel | Dashboard | Production Surface | Yes | No | No | No | Yes | No | No | @/context/SportContext<br>react | 2026-07-11 |
| components / dashboard / AICommandCenterPanel | Dashboard | Production Surface | Yes | No | No | No | Yes | No | No | @/context/DashboardContext | 2026-07-15 |
| components / dashboard / AICopilotChatPanel | Dashboard | Experimental | No | No | Yes | No | Yes | No | No | react | 2026-06-28 |
| components / dashboard / AICopilotPanel | Dashboard | Experimental | No | No | Yes | No | Yes | No | No | react | 2026-07-19 |
| components / dashboard / AIModelCenter | Dashboard | Production Surface | Yes | No | No | No | Yes | No | No | react | 2026-07-07 |
| components / dashboard / AiPerformanceCenterPanel | Dashboard | Production Surface | Yes | No | No | No | Yes | No | No | react | 2026-07-20 |
| components / dashboard / AiPerformancePreviewCard | Dashboard | Experimental | No | No | Yes | No | Yes | No | No | react | 2026-07-20 |
| components / dashboard / AISportsBrainPanel | Dashboard | Production Surface | Yes | No | No | No | Yes | No | No | @/context/SportContext<br>react | 2026-07-10 |
| components / dashboard / AnalyticsChartsPanel | Dashboard | Production Surface | Yes | No | No | No | Yes | No | No | react | 2026-06-23 |
| components / dashboard / AnalyticsPanel | Dashboard | Production Surface | Yes | No | No | No | Yes | No | No | @/hooks/useAnalyticsDashboard | 2026-06-22 |
| components / dashboard / AutoModelTuningPanel | Dashboard | Production Surface | Yes | No | No | No | Yes | No | No | react | 2026-07-07 |
| components / dashboard / BasketballDataCoveragePanel | Dashboard | Production Surface | Yes | No | No | No | Yes | No | No | react | 2026-07-19 |
| components / dashboard / BetSlipOptimizerPanel | Dashboard | Production Surface | Yes | No | No | No | Yes | No | No | react | 2026-07-15 |
| components / dashboard / BsnIntelligencePanel | Dashboard | Production Surface | Yes | No | No | No | Yes | No | No | react | 2026-07-19 |
| components / dashboard / BsnModelMaturityPanel | Dashboard | Production Surface | Yes | No | No | No | Yes | No | No | react | 2026-07-20 |
| components / dashboard / BsnPredictionPreviewPanel | Dashboard | Experimental | No | No | Yes | No | Yes | No | No | react | 2026-07-19 |
| components / dashboard / ClosingLineIntelligencePanel | Dashboard | Production Surface | Yes | No | No | No | Yes | No | No | @/context/SportContext<br>react | 2026-07-28 |
| components / dashboard / ClvAnalyticsPanel | Dashboard | Production Surface | Yes | No | No | No | Yes | No | No | ./DashboardStatCard<br>react | 2026-06-25 |
| components / dashboard / DailyReportPanel | Dashboard | Production Surface | Yes | No | No | No | Yes | No | No | @/components/dashboard/PickExplanationCard<br>react | 2026-07-18 |
| components / dashboard / DashboardDeveloperGroups | Dashboard | Production Surface | Yes | No | No | No | Yes | No | No | @/components/dashboard/AICoachPanel<br>@/components/dashboard/AICommandCenterPanel<br>@/components/dashboard/AISportsBrainPanel<br>@/components/dashboard/AdaptiveOperationsPanel<br>@/components/dashboard/AdaptiveWeightsPanel | 2026-07-24 |
| components / dashboard / DashboardEliteHeader | Dashboard | Production Surface | Yes | No | No | No | Yes | No | No | None detected | 2026-06-26 |
| components / dashboard / DashboardHeroPanel | Dashboard | Production Surface | Yes | No | No | No | Yes | No | No | @/context/DashboardContext | 2026-07-19 |
| components / dashboard / DashboardKPIBar | Dashboard | Production Surface | Yes | No | No | No | Yes | No | No | @/context/DashboardContext | 2026-06-29 |
| components / dashboard / DashboardProPanel | Dashboard | Production Surface | Yes | No | No | No | Yes | No | No | ./DashboardStatCard<br>react | 2026-06-24 |
| components / dashboard / DashboardQuickStats | Dashboard | Production Surface | Yes | No | No | No | Yes | No | No | @/context/DashboardContext | 2026-07-07 |
| components / dashboard / DashboardSection | Dashboard | Production Surface | Yes | No | No | No | Yes | No | No | None detected | 2026-07-07 |
| components / dashboard / DashboardShell | Dashboard | Production Surface | Yes | No | No | No | Yes | No | No | @/components/dashboard/SportSelector<br>@/components/product/ProductStatus<br>@/context/SportContext<br>next/link<br>next/navigation | 2026-07-31 |
| components / dashboard / DashboardStatCard | Dashboard | Production Surface | Yes | No | No | No | Yes | No | No | None detected | 2026-06-23 |
| components / dashboard / DataFreshnessPreviewCard | Dashboard | Experimental | No | No | Yes | No | Yes | No | No | react | 2026-07-30 |
| components / dashboard / DeveloperDetails | Dashboard | Production Surface | Yes | No | No | No | Yes | No | No | react | 2026-07-19 |
| components / dashboard / FeatureStoreCorePanel | Dashboard | Production Surface | Yes | No | No | No | Yes | No | No | react | 2026-07-15 |
| components / dashboard / GlobalDataQualityPanel | Dashboard | Production Surface | Yes | No | No | No | Yes | No | No | react | 2026-07-12 |
| components / dashboard / HistoricalImportEnginePanel | Dashboard | Production Surface | Yes | No | No | No | Yes | No | No | react | 2026-07-15 |
| components / dashboard / LiveBettingEnginePanel | Dashboard | Production Surface | Yes | No | No | No | Yes | No | No | react | 2026-07-09 |
| components / dashboard / LiveMarketMoversPanel | Dashboard | Production Surface | Yes | No | No | No | Yes | No | No | @/context/DashboardContext | 2026-06-29 |
| components / dashboard / LiveOddsShoppingPanel | Dashboard | Production Surface | Yes | No | No | No | Yes | No | No | react | 2026-06-29 |
| components / dashboard / MarketIntelligenceSummaryPanel | Dashboard | Production Surface | Yes | No | No | No | Yes | No | No | react | 2026-07-19 |
| components / dashboard / MlbFeatureStoreIntegrationPanel | Dashboard | Production Surface | Yes | No | No | No | Yes | No | No | react | 2026-07-12 |
| components / dashboard / MlbGameIntelligenceDetailClient | Dashboard | Production Surface | Yes | No | No | No | Yes | No | No | react | 2026-07-25 |
| components / dashboard / MlbGameIntelligencePageClient | Dashboard | Production Surface | Yes | No | No | No | Yes | No | No | react | 2026-07-25 |
| components / dashboard / MlbGameIntelligencePanel | Dashboard | Production Surface | Yes | No | No | No | Yes | No | No | react | 2026-07-24 |
| components / dashboard / MlbMarketExpansionRoadmapPanel | Dashboard | Production Surface | Yes | No | No | No | Yes | No | No | react | 2026-07-20 |
| components / dashboard / MlbMissingIntelligencePanel | Dashboard | Production Surface | Yes | No | No | No | Yes | No | No | react | 2026-07-18 |
| components / dashboard / MlbPlayerProjectionDetailClient | Dashboard | Production Surface | Yes | No | No | No | Yes | No | No | react | 2026-07-25 |
| components / dashboard / MlbPlayerProjectionPageClient | Dashboard | Production Surface | Yes | No | No | No | Yes | No | No | react | 2026-07-27 |
| components / dashboard / MlbPlayerProjectionsPanel | Dashboard | Production Surface | Yes | No | No | No | Yes | No | No | @/components/product/ProductStatus<br>react | 2026-07-27 |
| components / dashboard / MlbPlayerPropsReadinessPanel | Dashboard | Production Surface | Yes | No | No | No | Yes | No | No | react | 2026-07-24 |
| components / dashboard / MlbPredictionEnginePanel | Dashboard | Production Surface | Yes | No | No | No | Yes | No | No | react | 2026-07-19 |
| components / dashboard / MlbProjectionBoardClient | Dashboard | Production Surface | Yes | No | No | No | Yes | No | No | react | 2026-07-22 |
| components / dashboard / MlbProspectivePreviewPanel | Dashboard | Experimental | No | No | Yes | No | Yes | No | No | react | 2026-07-17 |
| components / dashboard / MlbStarterIntelligencePanel | Dashboard | Production Surface | Yes | No | No | No | Yes | No | No | react | 2026-07-24 |
| components / dashboard / MlbTemporalHealthPanel | Dashboard | Production Surface | Yes | No | No | No | Yes | No | No | react | 2026-07-20 |
| components / dashboard / ModelCalibrationPanel | Dashboard | Production Surface | Yes | No | No | No | Yes | No | No | react | 2026-06-28 |
| components / dashboard / ModelMetricsFrameworkPanel | Dashboard | Production Surface | Yes | No | No | No | Yes | No | No | react | 2026-07-12 |
| components / dashboard / ModelRollbackPanel | Dashboard | Production Surface | Yes | No | No | No | Yes | No | No | react | 2026-07-07 |
| components / dashboard / ModelVersionsPanel | Dashboard | Production Surface | Yes | No | No | No | Yes | No | No | react | 2026-07-07 |
| components / dashboard / MonteCarloSimulatorPanel | Dashboard | Production Surface | Yes | No | No | No | Yes | No | No | react | 2026-07-09 |
| components / dashboard / MultiSportCoveragePanel | Dashboard | Production Surface | Yes | No | No | No | Yes | No | No | @/config/sports.config<br>@/context/SportContext<br>react | 2026-07-11 |
| components / dashboard / MultiSportEnginePanel | Dashboard | Production Surface | Yes | No | No | No | Yes | No | No | @/context/SportContext<br>react | 2026-07-11 |
| components / dashboard / MultiSportFeatureRegistryPanel | Dashboard | Production Surface | Yes | No | No | No | Yes | No | No | react | 2026-07-12 |
| components / dashboard / NbaAdapterPanel | Dashboard | Production Surface | Yes | No | No | No | Yes | No | No | react | 2026-07-11 |
| components / dashboard / NbaBacktestingCalibrationPanel | Dashboard | Production Surface | Yes | No | No | No | Yes | No | No | react | 2026-07-12 |
| components / dashboard / NbaDataQualityPanel | Dashboard | Production Surface | Yes | No | No | No | Yes | No | No | react | 2026-07-12 |
| components / dashboard / NbaDataSyncPanel | Dashboard | Production Surface | Yes | No | No | No | Yes | No | No | react | 2026-07-14 |
| components / dashboard / NbaFeatureStoreIntegrationPanel | Dashboard | Production Surface | Yes | No | No | No | Yes | No | No | react | 2026-07-14 |
| components / dashboard / NbaMultiBookComparisonPanel | Dashboard | Production Surface | Yes | No | No | No | Yes | No | No | react | 2026-07-12 |
| components / dashboard / NbaPredictionEnginePanel | Dashboard | Production Surface | Yes | No | No | No | Yes | No | No | react | 2026-07-13 |
| components / dashboard / NbaSteamMovePanel | Dashboard | Production Surface | Yes | No | No | No | Yes | No | Yes | react | 2026-07-12 |
| components / dashboard / NextSlateStatusPanel | Dashboard | Production Surface | Yes | No | No | No | Yes | No | No | react | 2026-07-17 |
| components / dashboard / NflFeatureStoreIntegrationPanel | Dashboard | Production Surface | Yes | No | No | No | Yes | No | No | react | 2026-07-12 |
| components / dashboard / NflPredictionEnginePanel | Dashboard | Production Surface | Yes | No | No | No | Yes | No | No | react | 2026-07-13 |
| components / dashboard / NhlFeatureStoreIntegrationPanel | Dashboard | Production Surface | Yes | No | No | No | Yes | No | No | react | 2026-07-13 |
| components / dashboard / NhlPredictionEnginePanel | Dashboard | Production Surface | Yes | No | No | No | Yes | No | No | react | 2026-07-13 |
| components / dashboard / OperatingDayPanel | Dashboard | Production Surface | Yes | No | No | No | Yes | No | No | react | 2026-07-17 |
| components / dashboard / OperationsHealthPanel | Dashboard | Production Surface | Yes | No | No | No | Yes | No | No | react | 2026-07-20 |
| components / dashboard / PatternDiscoveryPanel | Dashboard | Production Surface | Yes | No | No | No | Yes | No | No | @/context/DashboardContext | 2026-06-30 |
| components / dashboard / PickExplanationCard | Dashboard | Production Surface | Yes | No | No | No | Yes | No | No | None detected | 2026-07-15 |
| components / dashboard / PlayOfTheDayPanel | Dashboard | Production Surface | Yes | No | No | No | Yes | No | No | react | 2026-07-01 |
| components / dashboard / PortfolioAIV2Panel | Dashboard | Production Surface | Yes | No | No | No | Yes | No | No | @/context/SportContext<br>@/services/portfolio-ai-v2.service<br>react | 2026-07-11 |
| components / dashboard / PortfolioElitePanel | Dashboard | Production Surface | Yes | No | No | No | Yes | No | No | react | 2026-07-01 |
| components / dashboard / PortfolioHeatmapPanel | Dashboard | Production Surface | Yes | No | No | No | Yes | No | No | @/context/DashboardContext | 2026-06-29 |
| components / dashboard / PredictionEngineV4Panel | Dashboard | Production Surface | Yes | No | No | No | Yes | No | No | react | 2026-07-10 |
| components / dashboard / PredictionSafetyPanel | Dashboard | Production Surface | Yes | No | No | No | Yes | No | No | react | 2026-07-12 |
| components / dashboard / ProductionReadinessAuditPanel | Dashboard | Production Surface | Yes | No | No | No | Yes | No | No | react | 2026-07-20 |
| components / dashboard / ProductionTodayPanel | Dashboard | Production Surface | Yes | No | No | No | Yes | No | No | react | 2026-07-18 |
| components / dashboard / ProductTodayPanel | Dashboard | Production Surface | Yes | No | No | No | Yes | No | No | react | 2026-07-22 |
| components / dashboard / ProviderAdapterSdkPanel | Dashboard | Production Surface | Yes | No | No | No | Yes | No | No | react | 2026-07-12 |
| components / dashboard / ProviderIntelligencePanel | Dashboard | Production Surface | Yes | No | No | No | Yes | No | No | react | 2026-07-12 |
| components / dashboard / QuickActionsPanel | Dashboard | Production Surface | Yes | No | No | No | Yes | No | No | @/context/DashboardContext<br>react | 2026-07-07 |
| components / dashboard / RecommendationReadinessPanel | Dashboard | Production Surface | Yes | No | No | No | Yes | No | No | react | 2026-07-16 |
| components / dashboard / RuntimeObservabilityPanel | Dashboard | Production Surface | Yes | No | No | No | Yes | No | No | react | 2026-07-14 |
| components / dashboard / SettlementCorePanel | Dashboard | Production Surface | Yes | No | No | No | Yes | No | No | react | 2026-07-12 |
| components / dashboard / SharpMoneyIntelligencePanel | Dashboard | Production Surface | Yes | No | No | No | Yes | No | No | react | 2026-07-09 |
| components / dashboard / SmartParlaysPanel | Dashboard | Production Surface | Yes | No | No | No | Yes | No | No | react | 2026-06-24 |
| components / dashboard / SoccerFeatureStoreIntegrationPanel | Dashboard | Production Surface | Yes | No | No | No | Yes | No | No | react | 2026-07-13 |
| components / dashboard / SoccerPredictionEnginePanel | Dashboard | Production Surface | Yes | No | No | No | Yes | No | No | react | 2026-07-13 |
| components / dashboard / SportPredictionSdkPanel | Dashboard | Production Surface | Yes | No | No | No | Yes | No | No | react | 2026-07-12 |
| components / dashboard / SportsDataIoContractPanel | Dashboard | Production Surface | Yes | No | No | No | Yes | No | Yes | react | 2026-07-12 |
| components / dashboard / SportsDataIoDiscoveryLabPanel | Dashboard | Production Surface | Yes | No | No | No | Yes | No | No | react | 2026-07-20 |
| components / dashboard / SportSelector | Dashboard | Production Surface | Yes | No | No | No | Yes | No | No | @/config/sports.config<br>@/context/SportContext | 2026-07-25 |
| components / dashboard / SportsList | Dashboard | Production Surface | Yes | No | No | No | Yes | No | No | @/hooks/useSports | 2026-06-21 |
| components / dashboard / SyncReliabilityPanel | Dashboard | Production Surface | Yes | No | No | No | Yes | No | Yes | react | 2026-07-12 |
| components / dashboard / SystemStatusPanel | Dashboard | Production Surface | Yes | No | No | No | Yes | No | No | react | 2026-06-29 |
| components / dashboard / TeamStatsPanel | Dashboard | Production Surface | Yes | No | No | No | Yes | No | No | @/hooks/useTeamStats | 2026-06-21 |
| components / dashboard / TennisFeatureStoreIntegrationPanel | Dashboard | Production Surface | Yes | No | No | No | Yes | No | No | react | 2026-07-13 |
| components / dashboard / TennisPredictionEnginePanel | Dashboard | Production Surface | Yes | No | No | No | Yes | No | No | react | 2026-07-13 |
| components / dashboard / today-ai-decision-presentation | Dashboard | Production Surface | Yes | No | No | No | Yes | No | No | @/components/dashboard/today-opportunity-readiness | 2026-07-31 |
| components / dashboard / today-opportunity-readiness | Dashboard | Production Surface | Yes | No | No | No | Yes | No | No | None detected | 2026-07-31 |
| components / dashboard / TodayDecisionPanel | Dashboard | Production Surface | Yes | No | No | No | Yes | No | No | @/components/dashboard/today-ai-decision-presentation<br>@/components/dashboard/today-opportunity-readiness<br>react | 2026-07-31 |
| components / dashboard / TopPicksPanel | Dashboard | Production Surface | Yes | No | No | No | Yes | No | No | @/components/dashboard/PickExplanationCard<br>react | 2026-07-22 |
| components / dashboard / TopPickWithExplanation | Dashboard | Production Surface | Yes | No | No | No | Yes | No | No | ./PickExplanationCard<br>react | 2026-07-08 |
| components / dashboard / UfcFeatureStoreIntegrationPanel | Dashboard | Production Surface | Yes | No | No | No | Yes | No | No | react | 2026-07-13 |
| components / dashboard / UfcPredictionEnginePanel | Dashboard | Production Surface | Yes | No | No | No | Yes | No | No | react | 2026-07-13 |
| components / dashboard / UniversalMarketCoveragePanel | Dashboard | Production Surface | Yes | No | No | No | Yes | No | No | react | 2026-07-24 |
| components / dashboard / UniversalProjectionEnginePanel | Dashboard | Production Surface | Yes | No | No | No | Yes | No | No | react | 2026-07-21 |
| components / dashboard / UpcomingGames | Dashboard | Production Surface | Yes | No | No | No | Yes | No | No | @/hooks/useUpcomingGames | 2026-06-21 |
| components / dashboard / UserTodayPanel | Dashboard | Production Surface | Yes | No | No | No | Yes | No | No | @/components/dashboard/AiPerformancePreviewCard<br>@/components/dashboard/DataFreshnessPreviewCard<br>react | 2026-07-26 |
| src / context / DashboardContext | Dashboard | Production Surface | Yes | No | No | No | No | No | No | react | 2026-06-29 |
| src / services / dashboard-today.service | Dashboard | Production Surface | Yes | No | No | No | No | No | No | @/lib/supabase-admin<br>@/services/active-event.service<br>@/services/current-board.service<br>@/services/market-intelligence-category.service<br>@/services/mlb-ai-picks-feed.service | 2026-07-26 |
| src / services / dashboard.service | Dashboard | Production Surface | Yes | No | No | No | No | No | No | @/lib/server-cache<br>@/services/adaptive-weight-engine.service<br>@/services/ai-trading-advisor.service<br>@/services/analytics.service<br>@/services/clv-analytics.service | 2026-07-07 |
| docs / AI_INTERNAL_PERFORMANCE_VIEW | Learning Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-20 |
| docs / AI_PERFORMANCE_INTERNAL_VIEW | Learning Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-20 |
| docs / CALIBRATION_STATUS_CONTRACT | Learning Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-20 |
| docs / champion-challenger-policy | Learning Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-22 |
| docs / DAILY_SETTLEMENT_CLOSURE_V1 | Learning Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-23 |
| docs / EPOCH_PERFORMANCE_LEARNING_V2 | Learning Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-27 |
| docs / FEATURE_INTELLIGENCE_V1 | Learning Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-29 |
| docs / first-live-pitcher-outs-shadow-run | Learning Module | Experimental | No | No | Yes | No | No | No | No | None detected | 2026-07-22 |
| docs / LEARNING_EVIDENCE_ACTIVATION_V1 | Learning Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-23 |
| docs / MLB_LIMITATIONS | Learning Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-19 |
| docs / MLB_MARKET_ACTIVATION_GATES | Learning Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-20 |
| docs / MLB_MARKET_DATA_FOUNDATION_V2 | Learning Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-27 |
| docs / MLB_MARKET_TAXONOMY | Learning Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-20 |
| docs / MLB_PITCHER_BACKTEST_READINESS_V1 | Learning Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-26 |
| docs / mlb-ai-coach-v1 | Learning Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-17 |
| docs / mlb-learning-brain-v1 | Learning Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-22 |
| docs / mlb-learning-scheduler | Learning Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-22 |
| docs / mlb-market-capability-registry-v1 | Learning Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-17 |
| docs / mlb-model-distributions-v2 | Learning Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-17 |
| docs / mlb-provider-capability-audit-v1 | Learning Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-17 |
| docs / mlb-starter-refresh-scheduler | Learning Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-22 |
| docs / MODEL_SELECTION_ANALYSIS | Learning Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-29 |
| docs / official-picks-readiness-v1 | Learning Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-15 |
| docs / PICK_ANALYZER_V1_DEFINITION_OF_DONE | Learning Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-29 |
| docs / PICK_ANALYZER_V1_FINAL_VALIDATION_MATRIX | Learning Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-30 |
| docs / PICK_ANALYZER_V1_PHASES | Learning Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-30 |
| docs / PICK_ANALYZER_V1_RELEASE_NOTES | Learning Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-30 |
| docs / pitcher-outs-operations | Learning Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-22 |
| docs / PRODUCT_METRIC_LANGUAGE_V1 | Learning Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-27 |
| docs / PRODUCT_VALUE_ROADMAP_V1 | Learning Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-27 |
| docs / product-audit-v1-ledger | Learning Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-27 |
| docs / RELEASES / RELEASE_01_REVIEW | Learning Module | Internal Dependency | No | No | No | No | No | No | Yes | None detected | 2026-07-31 |
| docs / RELEASES / v1.0-platform-certified | Learning Module | Internal Dependency | No | No | No | No | No | No | Yes | None detected | 2026-07-26 |
| docs / RETROSHEET_HISTORICAL_DATA_LAKE_PHASE_1A | Learning Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-22 |
| docs / SHADOW_LEARNING_VALIDATION_V1 | Learning Module | Experimental | No | No | Yes | No | No | No | No | None detected | 2026-07-23 |
| docs / SPORTSDATAIO_SCRAMBLED_DATA_POLICY | Learning Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-20 |
| docs / THE_ODDS_API_EVENT_CROSSWALK_AND_PROP_SYNC_V1 | Learning Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-26 |
| docs / TRAINING_PRIORITY_MATRIX | Learning Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-29 |
| docs / UNSUPPORTED_MARKET_RECOMMENDATION_POLICY_LOCK_V1 | Learning Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-30 |
| supabase / migrations / 202607190001_ai_performance_snapshots_v1 | Learning Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-20 |
| docs / ADAPTIVE_REFRESH_ARCHITECTURE | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-20 |
| docs / ADAPTIVE_REFRESH_EXECUTION | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-20 |
| docs / ADAPTIVE_REFRESH_POLICY_V1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-29 |
| docs / AI_BRAIN_ARCHITECTURE | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-20 |
| docs / AI_BRIEFING_V2_DAILY_DECISION_ENGINE | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-27 |
| docs / AI_EVOLUTION | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-20 |
| docs / AI_EXPERIENCE_CLOSED_BETA_UX | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-20 |
| docs / AI_GOALS_AND_READINESS | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-20 |
| docs / AI_LEARNING_PIPELINE | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-23 |
| docs / AI_MODEL_STRATEGY_V1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-29 |
| docs / AI_MODEL_STRATEGY_V1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-29 |
| docs / AI_OPERATIONS_CENTER | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-23 |
| docs / AI_PERFORMANCE_CENTER_UI | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-20 |
| docs / AI_PERFORMANCE_PRODUCT_EXPERIENCE | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-20 |
| docs / AI_PERFORMANCE_PUBLIC_VIEW | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-20 |
| docs / AI_PREDICTION_HISTORY_UI | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-20 |
| docs / AI_PREDICTION_HISTORY | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-20 |
| docs / AI_PUBLIC_PERFORMANCE_VIEW | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-20 |
| docs / AI_REPORT_CARD | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-20 |
| docs / AI_TRUST_SCORE | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-20 |
| docs / ai-bet-finder-v1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-16 |
| docs / ai-performance-center-v1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-20 |
| docs / ai-sports-analyst-v2 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-21 |
| docs / analyst-evidence-contract | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-21 |
| docs / ARCHITECTURE | Prediction Module | Internal Dependency | No | No | No | No | No | No | Yes | None detected | 2026-07-27 |
| docs / AUTONOMOUS_DAILY_AI_V1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-28 |
| docs / AUTONOMOUS_DAILY_LIFECYCLE | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-23 |
| docs / AUTONOMOUS_DAILY_SCHEDULER_V1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-23 |
| docs / AUTONOMOUS_EXECUTION_V2 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-27 |
| docs / AUTONOMOUS_EXECUTION | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-23 |
| docs / autonomous-execution-v2 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-27 |
| docs / best-bets-today-v1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-17 |
| docs / best-value-scanner-v1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-20 |
| docs / BSN_COMPLETION_CERTIFICATION_V1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-27 |
| docs / BSN_FOUNDATION_V1_CERTIFICATION | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-21 |
| docs / BSN_HISTORICAL_FOUNDATION_V2 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-27 |
| docs / BSN_WAVE2_CORE_CERTIFICATION | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-21 |
| docs / bsn-data-acquisition-strategy | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-18 |
| docs / bsn-foundation | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-21 |
| docs / bsn-integration-v1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-18 |
| docs / bsn-model-maturity-v1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-20 |
| docs / bsn-prediction-engine-v1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-19 |
| docs / bsn-source-framework-v1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-18 |
| docs / BUILD_MEMORY_OPTIMIZATION_DEPLOYMENT_RECOVERY_V1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-23 |
| docs / BUILD_MEMORY_OPTIMIZATION_V1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-28 |
| docs / BUILD_OOM_ROOT_CAUSE_V2 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-23 |
| docs / build-memory-optimization-v1-baseline | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-28 |
| docs / build-memory-optimization-v1-import-pressure | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-28 |
| docs / build-memory-optimization-v1-phase-a-manifest | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-28 |
| docs / build-memory-optimization-v1-phase-a | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-28 |
| docs / build-memory-optimization-v1-phase-b-external-supabase | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-28 |
| docs / build-memory-optimization-v1-phase-b-final | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-28 |
| docs / build-memory-optimization-v1-phase-b-import-pressure | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-28 |
| docs / build-memory-optimization-v1-phase-b | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-28 |
| docs / build-memory-optimization-v1-phase2-import-pressure | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-29 |
| docs / build-memory-optimization-v1-phase2-repeat | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-29 |
| docs / build-memory-optimization-v1-phase2-route-manifest | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-29 |
| docs / build-memory-optimization-v1-phase2-supabase-externalized | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-29 |
| docs / build-memory-optimization-v1-vercel-prod-cert-v1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-29 |
| docs / CERTIFIED_PREDICTION_EPOCH_MLB_PROMOTION_READINESS_DESIGN_V1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-28 |
| docs / certified-prediction-epoch-mlb-readiness-audit-v1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-28 |
| docs / CLOSED_BETA_READINESS | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-20 |
| docs / CLOSING_LINE_INTELLIGENCE_V1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-28 |
| docs / CORE_PREDICTION_CERTIFICATION_ROADMAP_V1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-28 |
| docs / CORE_V1_CERTIFICATION | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-20 |
| docs / current-board-intelligence-engine-v1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-16 |
| docs / DAILY_AUTONOMY_CERTIFICATION_V1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-29 |
| docs / DAILY_CONTINUITY_V1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-29 |
| docs / DATA_COVERAGE_FORECAST | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-29 |
| docs / DATA_FRESHNESS_POLICY | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-20 |
| docs / data-completion-matrix-v1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-27 |
| docs / day1-recommendation-readiness-v1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-16 |
| docs / DECISION_LOG | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-27 |
| docs / END_TO_END_DATA_FLOW | Prediction Module | Internal Dependency | No | No | No | No | No | No | Yes | None detected | 2026-07-20 |
| docs / end-to-end-prediction-pipeline-v1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-22 |
| docs / event-identity-operations | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-21 |
| docs / event-identity-prevention-gate | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-21 |
| docs / event-linkage-reconciliation | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-21 |
| docs / FEATURE_ANALYSIS_V1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-29 |
| docs / FEATURE_COVERAGE | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-29 |
| docs / FEATURE_LABEL_COVERAGE_RECOVERY_V1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-23 |
| docs / FEATURE_LABEL_EVIDENCE_CONTRACT_V1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-23 |
| docs / FEATURE_LEAKAGE_AUDIT | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-29 |
| docs / FEATURE_REBUILD_PLAN_V2 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-27 |
| docs / feature-store-core-v1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-14 |
| docs / FIRST_MODEL_FEATURE_MANIFEST_V1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-29 |
| docs / first-real-data-validation-plan-v1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-15 |
| docs / FULL_HISTORICAL_REPLAY_PHASE_2B | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-24 |
| docs / FULL_PLATFORM_AUDIT_V1_FINDINGS | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-29 |
| docs / FULL_PLATFORM_AUDIT_V1_REPAIR_PLAN | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-29 |
| docs / FULL_PLATFORM_AUDIT_V1_SYSTEM_MAP | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-29 |
| docs / FULL_PLATFORM_AUDIT_V1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-29 |
| docs / FUTURE_ONLY_PREDICTION_CONTINUITY_V2 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-27 |
| docs / GLOBAL_DATA_QUALITY_RECONCILIATION_V2 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-27 |
| docs / global-data-quality-framework-v1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-12 |
| docs / highest-probability-outcome-v1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-17 |
| docs / HISTORICAL_CALIBRATION_SHADOW_REWEIGHTING_V1 | Prediction Module | Experimental | No | No | Yes | No | No | No | No | None detected | 2026-07-24 |
| docs / HISTORICAL_DATA_COMPLETION_BASELINE_V3 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-27 |
| docs / HISTORICAL_EVIDENCE_EXPANSION_V1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-29 |
| docs / HISTORICAL_EVIDENCE_RECOVERY_V1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-29 |
| docs / HISTORICAL_LEARNING_DATASET_CONTRACT_V1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-29 |
| docs / HISTORICAL_LEARNING_FOUNDATION_V1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-29 |
| docs / HISTORICAL_LEARNING_READINESS_V1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-29 |
| docs / HISTORICAL_REPLAY_IO_READINESS_CONTROLLED_PILOT_V1 | Prediction Module | Experimental | No | No | Yes | No | No | No | No | None detected | 2026-07-24 |
| docs / HISTORICAL_SETTLED_STATUS_RECONCILIATION_V1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-29 |
| docs / HISTORICAL_SPORTS_DATA_COMPLETION_PROGRAM_V1_CERTIFICATION | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-27 |
| docs / HISTORICAL_SPORTS_DATA_FOUNDATION_V2_CERTIFICATION | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-27 |
| docs / historical-feature-generation-orchestrator-v1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-14 |
| docs / historical-feature-snapshot-persistence-v1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-14 |
| docs / historical-feature-trial-lineage-pilot-v1 | Prediction Module | Experimental | No | No | Yes | No | No | No | No | None detected | 2026-07-14 |
| docs / historical-import-engine-core-v1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-14 |
| docs / historical-settled-status-reconciliation-v1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-29 |
| docs / LEARNING_DATASET_GROWTH | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-29 |
| docs / LEGACY_PREDICTION_ARCHIVE_METRIC_ISOLATION_V2 | Prediction Module | Deprecated | No | No | No | Yes | No | No | No | None detected | 2026-07-27 |
| docs / legacy-predictions-v1 | Prediction Module | Deprecated | No | No | No | Yes | No | No | No | None detected | 2026-07-22 |
| docs / LIVE_MULTI_SPORT_DATA_ACQUISITION_V1_FINAL_CERTIFICATION | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-28 |
| docs / LIVE_MULTI_SPORT_DATA_ACQUISITION_V1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-28 |
| docs / LIVE_PROVIDER_VERIFICATION | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-20 |
| docs / live-multi-sport-acquisition-v1-checkpoint-a | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-28 |
| docs / live-multi-sport-acquisition-v1-checkpoint-b-mlb | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-28 |
| docs / live-multi-sport-acquisition-v1-checkpoint-c-nba-nfl | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-28 |
| docs / live-multi-sport-acquisition-v1-final-certification | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-28 |
| docs / LOCAL_HISTORICAL_FEATURE_BACKFILL_V1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-23 |
| docs / MARKET_OUTCOME_COMPLETENESS_PERFORMANCE_CONSISTENCY_V1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-24 |
| docs / market-intelligence-engine-v1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-16 |
| docs / MASTER_PROGRAM / DECISION_CORE | Prediction Module | Internal Dependency | No | No | No | No | No | No | Yes | None detected | 2026-07-31 |
| docs / MASTER_PROGRAM / ENGINEERING_GOVERNANCE | Prediction Module | Internal Dependency | No | No | No | No | No | No | Yes | None detected | 2026-07-31 |
| docs / MASTER_PROGRAM / SPRINT_0_DOCUMENTATION_FOUNDATION | Prediction Module | Internal Dependency | No | No | No | No | No | No | Yes | None detected | 2026-07-31 |
| docs / MASTER_ROADMAP | Prediction Module | Internal Dependency | No | No | No | No | No | No | Yes | None detected | 2026-07-31 |
| docs / missing-canonical-events-recovery-v1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-21 |
| docs / MLB_ADAPTIVE_REFRESH_EXECUTION | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-20 |
| docs / MLB_ARCHITECTURE | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-19 |
| docs / MLB_AUTOMATION | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-20 |
| docs / MLB_AUTONOMOUS_OPERATING_DAY_METRICS_V1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-30 |
| docs / MLB_AUTONOMOUS_OPERATIONS_V1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-30 |
| docs / MLB_BOXSCORE_STAT_COMPLETION_V3 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-27 |
| docs / MLB_DATA_FLOW | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-20 |
| docs / MLB_END_TO_END_DAILY_CLOSURE_V1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-30 |
| docs / MLB_EVENT_RESULT_COMPLETION_V3 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-27 |
| docs / MLB_FEATURES | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-19 |
| docs / MLB_FIRST_AUTONOMOUS_OPERATING_DAY_CERTIFICATION_V1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-30 |
| docs / MLB_FIRST_FIVE_MARKETS_V1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-24 |
| docs / MLB_FRESHNESS_POLICY | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-20 |
| docs / MLB_HISTORICAL_FOUNDATION_V2 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-26 |
| docs / MLB_HISTORICAL_FOUNDATION_V3_CERTIFICATION | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-27 |
| docs / MLB_HISTORICAL_INTELLIGENCE_PROGRAM | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-22 |
| docs / MLB_KNOWN_ISSUES | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-19 |
| docs / MLB_MARKET_EXPANSION_PROGRAM | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-20 |
| docs / MLB_MARKET_EXPANSION_ROADMAP | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-20 |
| docs / MLB_MARKET_MODEL_REQUIREMENTS | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-20 |
| docs / MLB_ODDS_REFRESH_EXECUTION | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-20 |
| docs / MLB_OPERATING_DATE_AND_ACTION_ADVANCEMENT_REPAIR_V1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-20 |
| docs / MLB_OPERATING_DAY_RUNTIME_CERTIFICATION | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-20 |
| docs / MLB_OPERATIONS | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-20 |
| docs / MLB_PLATFORM_COMPLETION | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-19 |
| docs / MLB_PLAYER_PROJECTION_ENGINE_V1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-24 |
| docs / MLB_PLAYER_PROPS_DATA_READINESS_AUDIT_V1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-24 |
| docs / MLB_PLAYER_STARTER_IDENTITY_V3 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-27 |
| docs / MLB_PRODUCTION_CERTIFICATION_CLOSED_BETA_AUDIT | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-20 |
| docs / MLB_PRODUCTION_CERTIFICATION | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-19 |
| docs / MLB_PROJECTION_ENGINE | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-20 |
| docs / MLB_PROJECTION_SETTLEMENT | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-20 |
| docs / MLB_PROJECTION_TEMPORAL_INTEGRITY | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-20 |
| docs / MLB_PROVIDER_STRATEGY | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-19 |
| docs / MLB_RELEASE_NOTES | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-19 |
| docs / MLB_SEASON_COVERAGE_PLAN_V3 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-27 |
| docs / MLB_SLATE_RECOVERY_LIFECYCLE_TRUTH_REPAIR | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-20 |
| docs / MLB_SPORT_EVENTS_STATUS_CONSTRAINT_ROOT_CAUSE_TRACE_V1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-20 |
| docs / MLB_TEAM_TOTALS_V1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-24 |
| docs / MLB_TEMPORAL_TRUTH | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-20 |
| docs / MLB_TODAY_PAGE_END_TO_END_DATA_VISIBILITY_RUNTIME_ALIGNMENT_REPAIR_V1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-20 |
| docs / MLB_USER_MODE_FRESHNESS_PROVIDER_BUDGET_PHASE_1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-20 |
| docs / MLB_WAVE1_COMPLETION_CHANGELOG | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-21 |
| docs / mlb-30-day-validation-scorecard-v1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-14 |
| docs / mlb-automatic-operating-day-v1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-17 |
| docs / mlb-bullpen-pitcher-intelligence-v1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-18 |
| docs / mlb-core-final-certification | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-21 |
| docs / mlb-current-season-backfill | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-21 |
| docs / mlb-daily-operations-v1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-15 |
| docs / mlb-data-quality-certification | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-21 |
| docs / mlb-data-quality-v1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-17 |
| docs / mlb-feature-model-readiness | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-21 |
| docs / mlb-feature-store-integration-v1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-12 |
| docs / mlb-games-payload-field-verification-v1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-17 |
| docs / mlb-historical-recommendation-replay-v1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-15 |
| docs / mlb-intelligence-v2 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-17 |
| docs / mlb-line-movement-expansion-batch-v1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-15 |
| docs / mlb-line-movement-probe-v1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-14 |
| docs / mlb-live-data-refresh-v1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-17 |
| docs / mlb-live-validation-readiness-v1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-14 |
| docs / mlb-market-expansion-v1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-17 |
| docs / mlb-model-audit | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-21 |
| docs / mlb-next-slate-rollover-v1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-17 |
| docs / mlb-odds-coverage-reconciliation-v1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-17 |
| docs / mlb-operating-day-lifecycle-v1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-17 |
| docs / mlb-pitcher-recorded-outs-model | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-21 |
| docs / mlb-player-metadata-cache-v1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-18 |
| docs / mlb-prediction-engine-v1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-15 |
| docs / mlb-prediction-engine-v6-preflight | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-17 |
| docs / mlb-prediction-engine-v7-confidence-v2 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-18 |
| docs / mlb-real-data-validation-batch-v1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-14 |
| docs / mlb-season-coverage-plan-v3 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-27 |
| docs / mlb-starter-weather-stadium-intelligence-v1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-17 |
| docs / mlb-verified-provider-call-path-v1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-17 |
| docs / MODEL_EVOLUTION_ROADMAP | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-29 |
| docs / MODEL_GOVERNANCE_V1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-29 |
| docs / MODEL_PROMOTION_POLICY_V1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-29 |
| docs / model-metrics-framework-v1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-12 |
| docs / most-likely-model-ranking-v1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-22 |
| docs / MULTI_SPORT_CURRENT_PREVIOUS_SEASON_COVERAGE_V1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-29 |
| docs / MULTI_SPORT_DATA_EXPANSION_V1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-28 |
| docs / MULTI_SPORT_PRODUCTION_READINESS_MATRIX_V1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-29 |
| docs / MULTI_SPORT_RESULTS_CROSSWALK_FOUNDATION_V1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-28 |
| docs / MULTI_SPORT_RESULTS_SETTLEMENT_PREVIEW_UNLOCK_V1_FINAL_CERTIFICATION | Prediction Module | Experimental | No | No | Yes | No | No | No | No | None detected | 2026-07-28 |
| docs / multi-sport-engine | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-11 |
| docs / multi-sport-feature-registry-v1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-12 |
| docs / multi-sport-results-crosswalk-foundation-v1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-28 |
| docs / multi-sport-results-settlement-preview-unlock-v1-final-certification | Prediction Module | Experimental | No | No | Yes | No | No | No | No | None detected | 2026-07-28 |
| docs / multi-sport-results-settlement-preview-unlock-v1-ledger | Prediction Module | Experimental | No | No | Yes | No | No | No | No | None detected | 2026-07-28 |
| docs / NBA_BASELINE_CERTIFICATION_V1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-27 |
| docs / NBA_HISTORICAL_FOUNDATION_V2 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-26 |
| docs / NBA_IDENTITY_MARKET_READINESS_V1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-27 |
| docs / NBA_PREVIEW_PREDICTION_LIFECYCLE_V1 | Prediction Module | Experimental | No | No | Yes | No | No | No | No | None detected | 2026-07-28 |
| docs / NBA_RESULT_STAT_COMPLETION_PLAN_V1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-27 |
| docs / nba-backtesting-calibration-v1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-14 |
| docs / nba-data-quality-player-stats-expansion-v1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-13 |
| docs / nba-data-quality-reconciliation-phase-a | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-12 |
| docs / nba-data-sync-v1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-11 |
| docs / nba-feature-store-integration-v1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-12 |
| docs / nba-injury-lineup-confidence-integration-v1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-13 |
| docs / nba-multi-book-comparison-v1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-12 |
| docs / nba-prediction-validation-settlement-v1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-14 |
| docs / nba-preview-prediction-lifecycle-v1 | Prediction Module | Experimental | No | No | Yes | No | No | No | No | None detected | 2026-07-28 |
| docs / nba-stored-lineup-feature-enrichment-v1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-13 |
| docs / nba-trial-validation-batch-v1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-14 |
| docs / NFL_BASELINE_CERTIFICATION_V1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-27 |
| docs / NFL_COMPLETION_PLAN_V1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-27 |
| docs / NFL_HISTORICAL_FOUNDATION_V2 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-27 |
| docs / NFL_NHL_PREVIEW_PREDICTION_LIFECYCLE_V1_FINAL_CERTIFICATION | Prediction Module | Experimental | No | No | Yes | No | No | No | No | None detected | 2026-07-28 |
| docs / NFL_NHL_PREVIEW_PREDICTION_LIFECYCLE_V1 | Prediction Module | Experimental | No | No | Yes | No | No | No | No | None detected | 2026-07-28 |
| docs / NFL_PREVIEW_PREDICTION_LIFECYCLE_V1 | Prediction Module | Experimental | No | No | Yes | No | No | No | No | None detected | 2026-07-28 |
| docs / nfl-feature-store-integration-v1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-12 |
| docs / nfl-prediction-engine-v1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-13 |
| docs / nfl-preview-prediction-lifecycle-v1 | Prediction Module | Experimental | No | No | Yes | No | No | No | No | None detected | 2026-07-28 |
| docs / NHL_BASELINE_AND_COMPLETION_PLAN_V1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-27 |
| docs / NHL_HISTORICAL_FOUNDATION_V2 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-27 |
| docs / NHL_PREVIEW_PREDICTION_LIFECYCLE_V1 | Prediction Module | Experimental | No | No | Yes | No | No | No | No | None detected | 2026-07-28 |
| docs / nhl-feature-store-integration-v1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-13 |
| docs / nhl-prediction-engine-v1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-13 |
| docs / nhl-preview-prediction-lifecycle-v1 | Prediction Module | Experimental | No | No | Yes | No | No | No | No | None detected | 2026-07-28 |
| docs / ODDS_API_EXTRACTION_COMPLETENESS_V1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-29 |
| docs / official-picks-eligibility-audit-v1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-28 |
| docs / operating-day-cron-reliability-v1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-17 |
| docs / OPERATIONAL_READINESS_MULTI_SPORT_AUDIT_V1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | Yes | None detected | 2026-07-29 |
| docs / OPERATIONAL_READINESS_MULTI_SPORT_AUDIT_V1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | Yes | None detected | 2026-07-29 |
| docs / OPERATIONS_RUNBOOK | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-20 |
| docs / PERFORMANCE_API_QUERY_OPTIMIZATION_V1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-28 |
| docs / PERFORMANCE_PRODUCT_MODE_V1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-23 |
| docs / performance-center-integrity | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-21 |
| docs / performance-scope-v2 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-22 |
| docs / performance-timeline-v2 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-22 |
| docs / PICK_ANALYZER_CHANGE_CONTROL_POLICY | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-29 |
| docs / PICK_ANALYZER_FINAL_COMPLETION_PLAN_V1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-30 |
| docs / PICK_ANALYZER_POST_V1_BACKLOG | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-29 |
| docs / PICK_ANALYZER_V1_DEFINITION_OF_DONE_MATRIX | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-30 |
| docs / PICK_ANALYZER_V1_FINAL_CERTIFICATION | Prediction Module | Internal Dependency | No | No | No | No | No | No | Yes | None detected | 2026-07-30 |
| docs / PICK_ANALYZER_V1_FINAL_CERTIFICATION | Prediction Module | Internal Dependency | No | No | No | No | No | No | Yes | None detected | 2026-07-30 |
| docs / PICK_ANALYZER_V1_FINAL_VALIDATION_BUNDLE | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-30 |
| docs / PICK_ANALYZER_V1_PROVIDER_MUTATION_ACCOUNTING | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-30 |
| docs / PICK_ANALYZER_V1_SCOPE | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-30 |
| docs / PICK_ANALYZER_V2_PHASE_A2_ROUTE_RUNTIME_AUDIT | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-31 |
| docs / PICK_ANALYZER_V2_PHASE_A3_SCHEDULER_FRESHNESS_AUDIT | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-31 |
| docs / PICK_ANALYZER_V2_PHASE_A4_UI_STATE_AUDIT | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-31 |
| docs / PICK_ANALYZER_V2_PHASE_A5_API_QUERY_PERFORMANCE_AUDIT | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-31 |
| docs / PICK_ANALYZER_V2_PHASE_A6_BUILD_RELIABILITY_AUDIT | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-31 |
| docs / PICK_ANALYZER_V2_PHASE_B2_TODAY_EXPERIENCE | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-31 |
| docs / PICK_ANALYZER_V2_PHASE_B3_BEST_OPPORTUNITY_READINESS | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-31 |
| docs / PICK_ANALYZER_V2_PHASE_B4_DECISION_DASHBOARD_EXPERIENCE | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-31 |
| docs / PICK_ANALYZER_V2_PHASE_B5_1_MOBILE_OPPORTUNITY_NAVIGATION | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-31 |
| docs / PICK_ANALYZER_V2_PHASE_B5_AI_DECISION_EXPLANATION | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-31 |
| docs / PICK_ANALYZER_V2_PHASE_B6_1_LIVE_FRESHNESS_BUDGET_AUDIT | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-31 |
| docs / PICK_ANALYZER_V2_PHASE_B6_MOBILE_DECISION_EXPERIENCE | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-31 |
| docs / PICK_ANALYZER_V2_PHASE_C1_1_EXTERNAL_SCHEDULER_RECOVERY | Prediction Module | Internal Dependency | No | No | No | No | No | No | Yes | None detected | 2026-07-31 |
| docs / PICK_ANALYZER_V2_PHASE_C1_DAILY_BETTING_AND_SETTLEMENT_GUARANTEE | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-31 |
| docs / pick-analyzer-v2-phase-a2-route-runtime-audit | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-31 |
| docs / pick-analyzer-v2-phase-a3-scheduler-freshness-audit | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-31 |
| docs / pick-analyzer-v2-phase-a4-ui-state-audit | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-31 |
| docs / pick-analyzer-v2-phase-a5-api-query-performance-audit | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-31 |
| docs / pick-analyzer-v2-phase-a6-build-reliability-audit | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-31 |
| docs / pick-analyzer-v2-phase-b2-today-experience | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-31 |
| docs / pick-analyzer-v2-phase-b3-best-opportunity-readiness | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-31 |
| docs / pick-analyzer-v2-phase-b4-decision-dashboard-experience | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-31 |
| docs / pick-analyzer-v2-phase-b5-1-mobile-opportunity-navigation | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-31 |
| docs / pick-analyzer-v2-phase-b5-ai-decision-explanation | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-31 |
| docs / pick-analyzer-v2-phase-b6-1-live-freshness-budget-audit | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-31 |
| docs / pick-analyzer-v2-phase-b6-mobile-decision-experience | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-31 |
| docs / pick-analyzer-v2-phase-c1-1-external-scheduler-recovery | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-31 |
| docs / pick-analyzer-v2-phase-c1-daily-betting-settlement-guarantee | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-31 |
| docs / pick-explanation-experience-v1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-15 |
| docs / pitcher-outs-shadow-model-v1 | Prediction Module | Experimental | No | No | Yes | No | No | No | No | None detected | 2026-07-22 |
| docs / PLATFORM_CONSOLIDATION_DUPLICATION_CLEANUP_V1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-29 |
| docs / PLATFORM_LOCK_POLICY | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-26 |
| docs / PLATFORM_ROLLBACK_RUNBOOK | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-26 |
| docs / platform-consolidation-duplication-cleanup-v1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-29 |
| docs / PLAYER_PROP_MULTI_MARKET_EXPANSION_V1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-27 |
| docs / PORTFOLIO_INTELLIGENCE_V1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-28 |
| docs / PREDICTION_EPOCH_GOVERNANCE_SEEDING_V1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-27 |
| docs / PREDICTION_EPOCH_GOVERNANCE_V2_MIGRATION_REVIEW | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-27 |
| docs / PREDICTION_EPOCH_GOVERNANCE_V2_MIGRATION_RUNBOOK | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-27 |
| docs / PREDICTION_EPOCH_GOVERNANCE_V2 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-27 |
| docs / PREDICTION_EPOCH_MIGRATION_DETECTION_FIX_V1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-27 |
| docs / PREDICTION_EPOCH_SHADOW_READINESS_V1 | Prediction Module | Experimental | No | No | Yes | No | No | No | No | None detected | 2026-07-28 |
| docs / PREDICTION_LIFECYCLE_V2 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-23 |
| docs / prediction-family-and-deduplication | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-22 |
| docs / prediction-provenance | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-22 |
| docs / prediction-safety-framework-v1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-12 |
| docs / prediction-versioning-engine-v1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-18 |
| docs / PREGAME_EXECUTION_RECOVERY_SLATE_PREWARM_V1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-24 |
| docs / PREGAME_REFRESH_LIFECYCLE | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-20 |
| docs / PREGAME_SCHEDULER_COVERAGE_EXECUTION_TIMING_V1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-24 |
| docs / PROBABILITY_PICKS_MULTI_SPORT_AUDIT_V1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-27 |
| docs / PROBABILITY_PICKS_V1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-26 |
| docs / PROBABILITY_PICKS_V2 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-27 |
| docs / PRODUCT_EXPERIENCE_DATA_TRUST_AUDIT_V1_CERTIFICATION | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-27 |
| docs / PRODUCT_NAVIGATION_FRESHNESS_HARDENING_V1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-27 |
| docs / PRODUCT_READINESS_MATRIX_V1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-27 |
| docs / PRODUCT_STABILIZATION_AND_INTELLIGENCE_CONSOLIDATION_V1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-28 |
| docs / product-readiness-matrix-v1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-28 |
| docs / product-route-inventory-v1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-31 |
| docs / product-stabilization-v1-audit | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-28 |
| docs / PRODUCTION_OPERATIONS_PIPELINE | Prediction Module | Internal Dependency | No | No | No | No | No | No | Yes | None detected | 2026-07-20 |
| docs / PRODUCTION_READINESS_AUDIT | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-20 |
| docs / PRODUCTION_REFRESH_INFRASTRUCTURE | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-20 |
| docs / PRODUCTION_REGRESSION_AUDIT_V1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-23 |
| docs / production-data-gate-v1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-15 |
| docs / production-scope | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-22 |
| docs / PROJECT_STATUS | Prediction Module | Internal Dependency | No | No | No | No | No | No | Yes | None detected | 2026-07-31 |
| docs / PROJECTION_FRAMEWORK | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-20 |
| docs / PROJECTION_HISTORY | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-20 |
| docs / PROJECTION_VALIDATION | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-20 |
| docs / prospective-official-eligibility-gate-v1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-16 |
| docs / PUSH_AWARE_OUTCOME_DISTRIBUTION_MARKET_SEMANTICS_V1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-24 |
| docs / RECOMMENDATION_CHANGE_EVENTS | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-20 |
| docs / RECOMMENDATION_PIPELINE_TRACE_V1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-23 |
| docs / recommendation-eligibility-policy-v1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-15 |
| docs / RECOVERY_SUMMARY | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-29 |
| docs / refresh-status-contract | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-22 |
| docs / RELEASE_CANDIDATE_ROUTE_ARTIFACT_CONSISTENCY_V1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-30 |
| docs / RELEASE_CANDIDATE_ROUTE_ARTIFACT_CONSISTENCY_V1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-30 |
| docs / RELEASES / PLATFORM_CERTIFIED_V1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | Yes | None detected | 2026-07-26 |
| docs / RELEASES / RELEASE_01_EXECUTION_PLAN | Prediction Module | Internal Dependency | No | No | No | No | No | No | Yes | None detected | 2026-07-31 |
| docs / RETROSHEET_GAME_ENGINE_PHASE_1B | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-22 |
| docs / RETROSHEET_HISTORICAL_COVERAGE_INTELLIGENCE_PHASE_1_5 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-22 |
| docs / RETROSHEET_HISTORICAL_FEATURE_IDEMPOTENCY_CERTIFICATION | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-24 |
| docs / RETROSHEET_HISTORICAL_FEATURE_PRODUCTION_ISOLATION | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-24 |
| docs / RETROSHEET_HISTORICAL_FEATURE_STORE_PHASE_2A | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-24 |
| docs / runtime-observability-v1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-14 |
| docs / SCHEDULER_RELIABILITY | Prediction Module | Internal Dependency | No | No | No | No | No | No | Yes | None detected | 2026-07-31 |
| docs / SEASON_COMPETITION_GOVERNANCE_V2 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-26 |
| docs / SETTLEMENT_LEARNING_PIPELINE_RECOVERY_V1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-27 |
| docs / SETTLEMENT_RECONCILIATION_ENGINE_V2 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-23 |
| docs / settlement-core-v2 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-14 |
| docs / settlement-reconciliation-v1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-21 |
| docs / settlement-recovery-after-event-import | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-21 |
| docs / shared-sport-prediction-engine-sdk-v1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-12 |
| docs / SIX_HISTORICAL_SETTLEMENT_CONFLICT_RESOLUTION_V1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-29 |
| docs / six-historical-settlement-conflict-resolution-v1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-29 |
| docs / SOCCER_COMPETITION_ACTIVATION_GATE_V1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-28 |
| docs / SOCCER_COMPETITION_COMPLETION_PLAN_V1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-27 |
| docs / SOCCER_HISTORICAL_FOUNDATION_V2 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-27 |
| docs / soccer-competition-activation-gate-v1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-28 |
| docs / soccer-feature-store-integration-v1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-13 |
| docs / soccer-prediction-engine-v1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-13 |
| docs / SPORT_READINESS_FORECAST | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-29 |
| docs / SPORTS_CENTER_V1_PRODUCT_EXPERIENCE | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-27 |
| docs / SPORTS_DATA_COVERAGE_AUDIT_V2 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-26 |
| docs / SPORTS_DATA_SOURCE_REGISTRY_V2 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-27 |
| docs / SPORTS_DATA_WAREHOUSE_V2 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-26 |
| docs / SPORTSDATAIO_ENTITLEMENT_DISCOVERY_AND_SAFE_EXTRACTION | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-21 |
| docs / SPORTSDATAIO_PLAYER_GAME_STATS_ENDPOINT_OPTIMIZATION | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-21 |
| docs / sportsdataio-historical-import-execution-readiness-v1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-14 |
| docs / sportsdataio-nba-depth-lineups-pilot-v1 | Prediction Module | Experimental | No | No | Yes | No | No | No | No | None detected | 2026-07-13 |
| docs / sportsdataio-nba-injuries-pilot-v1 | Prediction Module | Experimental | No | No | Yes | No | No | No | No | None detected | 2026-07-13 |
| docs / sportsdataio-nba-integration-readiness-v1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-14 |
| docs / sportsdataio-nba-observability-integration-v1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-14 |
| docs / sportsdataio-nba-odds-readiness-v1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-14 |
| docs / sportsdataio-nba-pilot-import-v1 | Prediction Module | Experimental | No | No | Yes | No | No | No | No | None detected | 2026-07-13 |
| docs / sportsdataio-nba-pilot-import-v2 | Prediction Module | Experimental | No | No | Yes | No | No | No | No | None detected | 2026-07-13 |
| docs / sportsdataio-nba-player-props-readiness-v1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-14 |
| docs / sportsdataio-nba-player-stats-pilot-v1 | Prediction Module | Experimental | No | No | Yes | No | No | No | No | None detected | 2026-07-14 |
| docs / sportsdataio-nba-player-stats-readiness-v1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-14 |
| docs / sportsdataio-nba-players-pilot-v1 | Prediction Module | Experimental | No | No | Yes | No | No | No | No | None detected | 2026-07-13 |
| docs / sportsdataio-nba-priced-game-odds-pilot-v1 | Prediction Module | Experimental | No | No | Yes | No | No | No | No | None detected | 2026-07-14 |
| docs / sportsdataio-nba-trial-isolation-audit-v1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-13 |
| docs / SUPABASE_DISK_IO_RECOVERY_AUDIT_V1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-24 |
| docs / SYSTEM_HEALTH_POLICY_V1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-29 |
| docs / TENNIS_UFC_DATA_READINESS_V2 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-27 |
| docs / TENNIS_UFC_EVENT_LIFECYCLE_GATE_V1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-28 |
| docs / TENNIS_UFC_EVENT_READINESS_CERTIFICATION_V1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-27 |
| docs / tennis-feature-store-integration-v1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-13 |
| docs / tennis-prediction-engine-v1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-13 |
| docs / tennis-ufc-event-lifecycle-gate-v1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-28 |
| docs / THE_ODDS_API_CURRENT_ODDS_V1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-28 |
| docs / THE_ODDS_API_HISTORICAL_MLB_CORE_IMPORT_V1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | Yes | None detected | 2026-07-28 |
| docs / THE_ODDS_API_MAXIMUM_UTILIZATION_V1_FINAL_CERTIFICATION | Prediction Module | Internal Dependency | No | No | No | No | No | No | Yes | None detected | 2026-07-28 |
| docs / THE_ODDS_API_MAXIMUM_UTILIZATION_V1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | Yes | None detected | 2026-07-28 |
| docs / THE_ODDS_API_PLAYER_PROPS_V1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | Yes | None detected | 2026-07-28 |
| docs / THE_ODDS_API_SCORES_RESULTS_V1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | Yes | None detected | 2026-07-28 |
| docs / the-odds-api-maximum-utilization-v1-checkpoint1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-28 |
| docs / the-odds-api-maximum-utilization-v1-final-certification | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-28 |
| docs / TRAINING_CHECKLIST_V1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-29 |
| docs / TRAINING_DATASET_EXPANSION_V1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-29 |
| docs / TRAINING_DATASET_FEATURE_RECERTIFICATION_V1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-29 |
| docs / TRAINING_DATASET_SPEC_V1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-29 |
| docs / TRAINING_EXPANSION_ROADMAP | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-29 |
| docs / TRAINING_FEATURE_CONTRACT_V1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-29 |
| docs / TRAINING_FORECAST | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-29 |
| docs / TRAINING_PIPELINE_ARCHITECTURE_V1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-29 |
| docs / TRAINING_READINESS_V1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-29 |
| docs / TRAINING_READINESS_V1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-29 |
| docs / TRAINING_SAFE_FEATURE_GOVERNANCE_V1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-29 |
| docs / ufc-feature-store-integration-v1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-13 |
| docs / ufc-prediction-engine-v1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-13 |
| docs / ui-intelligence-integrity-refactor-v1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-21 |
| docs / UNIVERSAL_EVENT_IDENTITY_CROSSWALK_ENGINE_V1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-28 |
| docs / UNIVERSAL_EVENT_IDENTITY_MATERIALIZATION_V1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-28 |
| docs / UNIVERSAL_MARKET_INTELLIGENCE_PLATFORM_V1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-24 |
| docs / UNIVERSAL_PROJECTION_ENGINE | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-20 |
| docs / universal-event-identity-v1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-21 |
| docs / UNSUPPORTED_MARKET_RECOMMENDATION_POLICY_LOCK_V1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-30 |
| docs / user-mode-intelligence-v2 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-22 |
| docs / UX_RECOVERY_V1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-23 |
| docs / VERCEL_BUILD_MEMORY_PRODUCTION_CERTIFICATION_V1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-29 |
| docs / VERCEL_BUILD_MEMORY_RECOVERY_V1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-29 |
| docs / vercel-build-memory-recovery-v1-summary | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-29 |
| docs / WEBPACK_DEPENDENCY_GRAPH_AUDIT_V2 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-23 |
| src / config / sports.config | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-18 |
| src / lib / server-lazy-diagnostics | Prediction Module | Experimental | No | No | Yes | No | No | No | No | @/services/adaptive-refresh-orchestrator.service<br>@/services/ai-performance-center.service<br>@/services/autonomous-daily-operations.service<br>@/services/bsn-core-certification.service<br>@/services/bsn-model-maturity.service | 2026-07-23 |
| src / lib / server-schema-capabilities | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | @supabase/supabase-js | 2026-07-17 |
| src / types / database | Prediction Module | Internal Dependency | No | No | No | No | No | No | Yes | None detected | 2026-06-21 |
| src / types / multi-sport | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | @/config/sports.config | 2026-07-24 |
| src / types / probability-picks | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-27 |
| src / utils / prediction-engine-v2 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-06-21 |
| src / utils / prediction-engine-v3 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | ./prediction-engine-v2<br>@/services/model-adjustments.service | 2026-07-28 |
| src / utils / prediction-engine-v4 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | ./prediction-engine-v3<br>@/services/model-adjustments.service | 2026-07-28 |
| supabase / migrations / 202607110003_nba_prediction_validation_settlement_v1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-12 |
| supabase / migrations / 202607140001_historical_feature_snapshots_v1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-14 |
| supabase / migrations / 202607170001_mlb_operating_day_lifecycle_v1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-17 |
| supabase / migrations / 202607170002_prediction_versioning_engine_v1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-17 |
| supabase / migrations / 202607170003_prediction_versioning_drop_legacy_unique_pick | Prediction Module | Deprecated | No | No | No | Yes | No | No | No | None detected | 2026-07-17 |
| supabase / migrations / 202607190002_universal_projection_history_v1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-20 |
| supabase / migrations / 202607240001_current_board_timeout_recovery_v1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-24 |
| supabase / migrations / 202607240005_universal_market_registry_v1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-24 |
| supabase / migrations / 202607270001_prediction_epoch_governance_v2 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-27 |
| supabase / migrations / 202607270002_prediction_epoch_governance_seed_v1 | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-27 |
| supabase / migrations / 202607280001_prediction_epoch_shadow_readiness_v1 | Prediction Module | Experimental | No | No | Yes | No | No | No | No | None detected | 2026-07-28 |
| migrations / checks / 202607270001_prediction_epoch_governance_v2_postcheck | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-27 |
| migrations / checks / 202607270001_prediction_epoch_governance_v2_precheck | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-27 |
| migrations / checks / 202607270002_prediction_epoch_governance_seed_v1_postcheck | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-27 |
| migrations / checks / 202607270002_prediction_epoch_governance_seed_v1_precheck | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-27 |
| migrations / rollback / 202607270001_prediction_epoch_governance_v2_rollback | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-27 |
| migrations / rollback / 202607270002_prediction_epoch_governance_seed_v1_rollback | Prediction Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-27 |
| docs / PROVIDER_ADAPTER_SDK | Provider | Internal Dependency | No | No | No | No | No | No | Yes | None detected | 2026-07-20 |
| docs / PROVIDER_BUDGET_POLICY_V1 | Provider | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-29 |
| docs / PROVIDER_BUDGET_POLICY | Provider | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-20 |
| docs / PROVIDER_BUDGET_REFRESH_STRATEGY | Provider | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-20 |
| docs / provider-adapter-sdk-v1 | Provider | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-12 |
| docs / provider-intelligence-v1 | Provider | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-12 |
| providers / sportsdataio / CAPABILITY_MATRIX | Provider | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-14 |
| providers / sportsdataio / MLB | Provider | Internal Dependency | No | No | No | No | No | No | Yes | None detected | 2026-07-14 |
| providers / sportsdataio / NBA | Provider | Internal Dependency | No | No | No | No | No | No | Yes | None detected | 2026-07-14 |
| providers / sportsdataio / NFL | Provider | Internal Dependency | No | No | No | No | No | No | Yes | None detected | 2026-07-14 |
| providers / sportsdataio / NHL | Provider | Internal Dependency | No | No | No | No | No | No | Yes | None detected | 2026-07-14 |
| providers / sportsdataio / README | Provider | Internal Dependency | No | No | No | No | No | No | Yes | None detected | 2026-07-14 |
| providers / sportsdataio / SOCCER | Provider | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-14 |
| src / services / provider-adapter-sdk.service | Provider | Internal Dependency | No | No | No | No | No | No | No | @/config/sports.config<br>@/services/multi-sport-normalizers.service<br>@/services/provider-intelligence.service<br>@/types/multi-sport | 2026-07-27 |
| src / services / provider-budget.service | Provider | Internal Dependency | No | No | No | No | No | No | No | @/lib/supabase-admin<br>@/services/provider-time-normalization.service | 2026-07-25 |
| src / services / provider-intelligence.service | Provider | Internal Dependency | No | No | No | No | No | No | No | @/config/sports.config<br>@/services/multi-sport-markets.service<br>@/services/multi-sport-providers.service<br>@/services/multi-sport-registry.service<br>@/types/multi-sport | 2026-07-27 |
| src / services / provider-time-normalization.service | Provider | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-20 |
| src / services / active-event.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/services/mlb-game-lifecycle.service<br>@/services/provider-time-normalization.service | 2026-07-20 |
| src / services / adaptive-refresh-orchestrator.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/config/mlb-operating-day-scheduler<br>@/lib/supabase-admin<br>@/services/active-event.service<br>@/services/canonical-settlement-state.service<br>@/services/current-board.service | 2026-07-31 |
| src / services / adaptive-scoring.service | Service | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-01 |
| src / services / adaptive-weight-engine.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/lib/supabase-admin<br>@/services/production-data-gate.service | 2026-07-14 |
| src / services / advanced-factors.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/lib/supabase-admin | 2026-07-07 |
| src / services / ai-bet-finder.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/lib/supabase-admin<br>@/services/best-value-scanner.service<br>@/services/bet-slip-optimizer.service<br>@/services/current-board.service<br>@/services/market-intelligence-category.service | 2026-07-21 |
| src / services / ai-coach.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/lib/supabase-admin<br>@/services/production-data-gate.service | 2026-07-14 |
| src / services / ai-copilot-chat.service | Service | Experimental | No | No | Yes | No | No | No | No | @/services/ai-copilot.service | 2026-06-28 |
| src / services / ai-copilot.service | Service | Experimental | No | No | Yes | No | No | No | No | @/services/advanced-factors.service<br>@/services/ai-game-analysis.service | 2026-06-28 |
| src / services / ai-game-analysis.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/services/analytics.service<br>@/services/top-picks.service | 2026-06-28 |
| src / services / ai-learning-lifecycle.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/lib/supabase-admin<br>@/services/canonical-settlement-state.service<br>@/services/historical-replay-pilot.service<br>@/services/historical-shadow-calibration.service<br>@/services/mlb-first-five-readiness.service | 2026-07-29 |
| src / services / ai-performance-center.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/config/sports.config<br>@/lib/supabase-admin<br>@/services/bsn-model-maturity.service<br>@/services/current-board.service<br>@/services/feature-store-core.service | 2026-07-26 |
| src / services / ai-pick-explainer.service | Service | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-15 |
| src / services / ai-sports-brain.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/services/top-picks.service | 2026-07-10 |
| src / services / ai-trading-advisor.service | Service | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-06-30 |
| src / services / analysis-explainer.service | Service | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-06-24 |
| src / services / analytics-charts.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/lib/supabase-admin<br>@/services/production-data-gate.service | 2026-07-14 |
| src / services / analytics.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/lib/supabase-admin<br>@/services/production-data-gate.service | 2026-07-14 |
| services / apis / api-factory | Service | Internal Dependency | No | No | No | No | No | No | No | ./api-sports<br>./odds-api | 2026-06-21 |
| services / apis / api-sports | Service | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-06-21 |
| services / apis / odds-api | Service | Internal Dependency | No | No | No | No | No | No | Yes | None detected | 2026-06-21 |
| src / services / autonomous-daily-ai.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/services/adaptive-refresh-orchestrator.service<br>@/services/autonomous-daily-operations.service<br>@/services/provider-budget.service | 2026-07-28 |
| src / services / autonomous-daily-operations.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/lib/supabase-admin<br>@/services/best-bets-today.service<br>@/services/best-value-scanner.service<br>@/services/current-board.service<br>@/services/market-opportunity-suite.service | 2026-07-24 |
| src / services / bankroll-manager.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/services/bankroll.service<br>@/services/play-of-the-day.service<br>@/services/portfolio-builder.service<br>@/services/top-picks.service | 2026-06-28 |
| src / services / bankroll.service | Service | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-06-24 |
| src / services / basketball-source-framework.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/config/sports.config<br>@/services/basketball/connectors/official-bsn-homepage.connector<br>@/types/multi-sport | 2026-07-27 |
| basketball / acquisition / bsn-acquisition-engine | Service | Internal Dependency | No | No | No | No | No | No | No | @/lib/supabase-admin<br>@/services/basketball-source-framework.service<br>@/services/basketball/connectors/official-bsn-homepage.connector<br>@/services/basketball/history/historical-builder<br>@/services/basketball/knowledge/knowledge-layer | 2026-07-20 |
| basketball / builders / platform.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/config/sports.config<br>@/services/basketball-source-framework.service<br>@/services/basketball/contracts/capabilities<br>@/services/basketball/history/historical-builder<br>@/services/basketball/mappers/existing-platform-mapper | 2026-07-19 |
| basketball / connectors / connector-contract | Service | Internal Dependency | No | No | No | No | No | No | No | @/services/basketball/contracts/capabilities<br>@/services/basketball/types/entities | 2026-07-19 |
| basketball / connectors / official-bsn-homepage.connector | Service | Internal Dependency | No | No | No | No | No | No | No | @/services/basketball/contracts/capabilities | 2026-07-19 |
| basketball / contracts / capabilities | Service | Internal Dependency | No | No | No | No | No | No | Yes | @/config/sports.config | 2026-07-19 |
| basketball / history / bsn-historical-reconstruction | Service | Internal Dependency | No | No | No | No | No | No | No | @/lib/supabase-admin<br>@/services/basketball-source-framework.service<br>@/services/basketball/builders/platform.service<br>@/services/basketball/history/historical-builder<br>@/services/basketball/knowledge/knowledge-layer | 2026-07-23 |
| basketball / history / historical-builder | Service | Internal Dependency | No | No | No | No | No | No | No | @/services/basketball-source-framework.service<br>@/services/basketball/contracts/capabilities<br>@/services/basketball/knowledge/knowledge-layer<br>@/services/feature-store-core.service<br>@/services/historical-import-engine.service | 2026-07-19 |
| services / basketball / index | Service | Internal Dependency | No | No | No | No | No | No | Yes | @/services/basketball/acquisition/bsn-acquisition-engine<br>@/services/basketball/builders/platform.service<br>@/services/basketball/history/bsn-historical-reconstruction<br>@/services/basketball/history/historical-builder<br>@/services/basketball/knowledge/knowledge-layer | 2026-07-19 |
| basketball / knowledge / knowledge-layer | Service | Internal Dependency | No | No | No | No | No | No | No | @/services/basketball/types/entities | 2026-07-19 |
| basketball / mappers / existing-platform-mapper | Service | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-19 |
| basketball / metrics / platform-metrics | Service | Internal Dependency | No | No | No | No | No | No | No | @/services/basketball/types/entities | 2026-07-19 |
| basketball / normalizers / canonical | Service | Internal Dependency | No | No | No | No | No | No | Yes | @/config/sports.config<br>@/services/basketball/contracts/capabilities<br>@/services/basketball/types/entities<br>@/services/basketball/validators/data-quality | 2026-07-19 |
| basketball / reconciliation / reconciliation-engine | Service | Internal Dependency | No | No | No | No | No | No | No | @/services/basketball/types/entities<br>@/services/basketball/validators/data-quality | 2026-07-19 |
| basketball / types / entities | Service | Internal Dependency | No | No | No | No | No | No | Yes | @/config/sports.config<br>@/services/basketball/contracts/capabilities | 2026-07-19 |
| basketball / validators / data-quality | Service | Internal Dependency | No | No | No | No | No | No | Yes | @/services/basketball/types/entities | 2026-07-19 |
| src / services / best-bets-today.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/services/current-board.service<br>@/services/market-alignment.service<br>@/services/market-intelligence-category.service<br>@/services/market-semantics.service | 2026-07-24 |
| src / services / best-value-scanner.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/services/current-board.service<br>@/services/explainable-intelligence.service<br>@/services/market-intelligence-category.service<br>@/services/provider-time-normalization.service | 2026-07-25 |
| src / services / bet-slip-optimizer.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/services/recommendation-eligibility-policy.service<br>@/services/top-picks.service | 2026-07-15 |
| src / services / betting-explanation.service | Service | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-06-27 |
| src / services / bsn-core-certification.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/services/bsn-intelligence-engine.service<br>@/services/bsn-model-maturity.service<br>@/services/bsn-platform.service<br>@/services/bsn-shadow-prediction-engine.service<br>@/services/market-alignment.service | 2026-07-24 |
| src / services / bsn-historical-foundation-v2.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/lib/supabase-admin<br>@/services/data-foundation-coverage.service | 2026-07-27 |
| src / services / bsn-intelligence-engine.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/lib/supabase-admin<br>@/services/basketball/builders/platform.service<br>@/services/basketball/history/historical-builder<br>@/services/basketball/knowledge/knowledge-layer<br>@/services/bsn-platform.service | 2026-07-23 |
| src / services / bsn-model-maturity.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/services/basketball/builders/platform.service<br>@/services/basketball/history/historical-builder<br>@/services/bsn-intelligence-engine.service<br>@/services/bsn-shadow-prediction-engine.service<br>@/services/feature-store-core.service | 2026-07-23 |
| src / services / bsn-platform.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/lib/supabase-admin<br>@/services/basketball-source-framework.service | 2026-07-18 |
| src / services / bsn-predictions.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/services/bsn-shadow-prediction-engine.service | 2026-07-19 |
| src / services / bsn-shadow-prediction-engine.service | Service | Experimental | No | No | Yes | No | No | No | No | @/lib/supabase-admin<br>@/services/basketball/builders/platform.service<br>@/services/basketball/history/historical-builder<br>@/services/bsn-intelligence-engine.service<br>@/services/feature-store-core.service | 2026-07-23 |
| src / services / bsn.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/lib/supabase-admin | 2026-06-22 |
| src / services / canonical-settlement-state.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/services/prediction-cutoff-enforcement.service | 2026-07-29 |
| src / services / closing-line-intelligence.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/lib/supabase-admin<br>@/services/market-alignment.service<br>@/services/production-data-gate.service | 2026-07-28 |
| src / services / clv-analytics.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/lib/supabase-admin<br>@/services/production-data-gate.service | 2026-07-14 |
| src / services / clv.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/lib/supabase-admin<br>@/services/production-data-gate.service | 2026-07-14 |
| src / services / correlation.service | Service | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-06-24 |
| src / services / current-board.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/lib/server-schema-capabilities<br>@/lib/supabase-admin<br>@/services/active-event.service<br>@/services/explainable-intelligence.service<br>@/services/market-alignment.service | 2026-07-25 |
| src / services / daily-pipeline.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/config/sports.config<br>@/services/historical-feature-generation.service<br>@/services/nba-data-quality.service<br>@/services/nba-data-sync.service<br>@/services/nba-feature-store-integration.service | 2026-07-14 |
| src / services / data-coverage-inventory.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/services/data-foundation-coverage.service | 2026-07-28 |
| src / services / data-foundation-coverage.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/lib/supabase-admin | 2026-07-26 |
| src / services / data-foundation-import-orchestrator.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/services/historical-import-engine.service | 2026-07-26 |
| src / services / data-foundation-quality-v2.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/services/data-foundation-coverage.service<br>@/services/prediction-epoch-migration-state.service | 2026-07-27 |
| src / services / data-foundation-season-governance.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/config/sports.config | 2026-07-26 |
| src / services / day1-recommendation-readiness.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/services/bet-slip-optimizer.service<br>@/services/current-board.service<br>@/services/recommendation-eligibility-policy.service<br>@/services/top-picks.service | 2026-07-16 |
| src / services / epoch-performance-learning-v2.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/lib/supabase-admin<br>@/services/prediction-epoch-migration-state.service | 2026-07-27 |
| src / services / explainability.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/services/top-picks.service | 2026-06-24 |
| src / services / explainable-intelligence.service | Service | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-25 |
| src / services / exposure.service | Service | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-06-24 |
| src / services / feature-rebuild-plan-v2.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/lib/supabase-admin | 2026-07-27 |
| src / services / feature-store-core.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/config/sports.config<br>@/services/production-data-gate.service<br>@/types/multi-sport | 2026-07-24 |
| src / services / future-only-prediction-continuity-v2.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/lib/supabase-admin<br>@/services/prediction-epoch-migration-state.service | 2026-07-27 |
| src / services / game-intelligence.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/lib/supabase-admin<br>@/services/current-board.service<br>@/services/explainable-intelligence.service<br>@/services/market-intelligence-category.service<br>@/services/mlb-current-lineup-context.service | 2026-07-25 |
| src / services / global-data-quality.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/config/sports.config<br>@/lib/supabase-admin<br>@/services/multi-sport-registry.service<br>@/services/provider-intelligence.service | 2026-07-12 |
| src / services / hedge-builder.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/services/bankroll.service<br>@/services/top-picks.service | 2026-06-24 |
| src / services / historical-feature-generation.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/config/sports.config<br>@/lib/server-schema-capabilities<br>@/lib/supabase-admin<br>@/services/feature-store-core.service<br>@/services/multi-sport-feature-registry.service | 2026-07-27 |
| src / services / historical-import-engine.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/config/sports.config<br>@/lib/server-schema-capabilities<br>@/lib/supabase-admin<br>@/services/historical-feature-generation.service<br>@/services/multi-sport-registry.service | 2026-07-27 |
| src / services / historical-learning-foundation-v1.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/lib/supabase-admin<br>@/services/canonical-settlement-state.service<br>@/services/prediction-cutoff-enforcement.service<br>node:crypto | 2026-07-29 |
| src / services / historical-replay-pilot.service | Service | Experimental | No | No | Yes | No | No | No | No | @/lib/supabase-admin<br>@/services/settlement-core.service<br>crypto | 2026-07-24 |
| src / services / historical-shadow-calibration.service | Service | Experimental | No | No | Yes | No | No | No | No | @/lib/supabase-admin | 2026-07-24 |
| src / services / kelly.service | Service | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-06-24 |
| src / services / legacy-prediction-metric-isolation-v2.service | Service | Deprecated | No | No | No | Yes | No | No | No | @/lib/supabase-admin<br>@/services/prediction-epoch-migration-state.service | 2026-07-27 |
| src / services / legacy-prediction-provenance.service | Service | Deprecated | No | No | No | Yes | No | No | No | @/lib/supabase-admin | 2026-07-22 |
| src / services / live-betting-engine.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/services/top-picks.service | 2026-07-09 |
| src / services / live-betting.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/services/betting-explanation.service<br>@/services/kelly.service<br>@/services/market-intelligence.service<br>@/services/market-movement.service<br>@/services/prediction.service | 2026-06-27 |
| src / services / live-provider-verification.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/config/sportsdataio-endpoint-catalog<br>@/lib/supabase-admin<br>@/services/basketball/connectors/official-bsn-homepage.connector<br>@/services/sportsdataio-discovery-lab-url.service<br>@/services/universal-projection-engine.service | 2026-07-20 |
| src / services / market-alignment.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/services/market-semantics.service | 2026-07-24 |
| src / services / market-intelligence-category.service | Service | Internal Dependency | No | No | No | No | No | No | Yes | @/services/current-board.service | 2026-07-22 |
| src / services / market-intelligence-engine.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/services/best-value-scanner.service<br>@/services/current-board.service<br>@/services/market-intelligence-category.service<br>@/services/market-opportunity-suite.service | 2026-07-20 |
| src / services / market-intelligence.service | Service | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-06-26 |
| src / services / market-movement-intelligence.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/lib/supabase-admin | 2026-07-28 |
| src / services / market-movement.service | Service | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-06-26 |
| src / services / market-opportunity-suite.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/lib/supabase-admin<br>@/services/current-board.service<br>@/services/explainable-intelligence.service<br>@/services/market-intelligence-category.service<br>@/services/market-semantics.service | 2026-07-26 |
| src / services / market-semantics.service | Service | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-24 |
| src / services / master-sync.service | Service | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-11 |
| src / services / missing-canonical-events-recovery.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/lib/supabase-admin | 2026-07-21 |
| src / services / mlb-ai-coach.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/services/best-bets-today.service<br>@/services/current-board.service<br>@/services/market-opportunity-suite.service<br>@/services/mlb-data-quality.service<br>@/services/mlb-games-payload-audit.service | 2026-07-18 |
| src / services / mlb-ai-picks-feed.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/services/current-board.service<br>@/services/explainable-intelligence.service<br>@/services/market-semantics.service<br>@/services/official-pick-experience.service | 2026-07-25 |
| src / services / mlb-autonomous-operations-v1.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/config/mlb-operating-day-scheduler<br>@/services/adaptive-refresh-orchestrator.service<br>@/services/operations-health.service<br>@/services/provider-budget.service | 2026-07-30 |
| src / services / mlb-current-lineup-context.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/lib/supabase-admin<br>@/services/active-event.service<br>@/services/mlb-starter-intelligence.service | 2026-07-24 |
| src / services / mlb-current-season-backfill-orchestrator.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/lib/supabase-admin<br>@/services/provider-budget.service<br>@/services/sportsdataio-mlb-historical-import-executor.service | 2026-07-21 |
| src / services / mlb-current-season-data-quality-audit.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/lib/supabase-admin<br>@/services/mlb-current-season-backfill-orchestrator.service | 2026-07-21 |
| src / services / mlb-data-quality.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/services/current-board.service<br>@/services/mlb-games-payload-audit.service<br>@/services/mlb-missing-intelligence.service<br>@/services/mlb-model-platform.service<br>@/services/mlb-odds-coverage.service | 2026-07-18 |
| src / services / mlb-event-status-mapper.service | Service | Internal Dependency | No | No | No | No | No | No | Yes | None detected | 2026-07-20 |
| src / services / mlb-feature-model-readiness.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/services/mlb-current-season-data-quality-audit.service<br>@/services/mlb-feature-store-integration.service | 2026-07-21 |
| src / services / mlb-feature-store-integration.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/lib/supabase-admin<br>@/services/feature-store-core.service<br>@/services/mlb-starter-weather-stadium-intelligence.service<br>@/services/multi-sport-feature-registry.service | 2026-07-21 |
| src / services / mlb-first-five-readiness.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/lib/supabase-admin<br>@/services/market-semantics.service<br>@/services/mlb-starter-intelligence.service | 2026-07-24 |
| src / services / mlb-freshness-policy.service | Service | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-20 |
| src / services / mlb-game-lifecycle.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/services/provider-time-normalization.service | 2026-07-20 |
| src / services / mlb-games-by-date-verification.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/lib/supabase-admin<br>@/services/provider-budget.service<br>@/services/sportsdataio-discovery-lab-url.service<br>@/types/sportsdataio-mlb<br>crypto | 2026-07-17 |
| src / services / mlb-games-payload-audit.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/lib/supabase-admin<br>@/services/provider-time-normalization.service<br>@/types/sportsdataio-mlb | 2026-07-20 |
| src / services / mlb-historical-foundation-v2.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/lib/supabase-admin<br>@/services/data-foundation-coverage.service | 2026-07-26 |
| src / services / mlb-learning-brain.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/lib/supabase-admin<br>@/services/active-event.service<br>@/services/mlb-projection-integrity.service<br>crypto | 2026-07-22 |
| src / services / mlb-market-capability-registry.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/lib/supabase-admin | 2026-07-24 |
| src / services / mlb-market-expansion-roadmap.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/config/sportsdataio-endpoint-catalog<br>@/services/mlb-odds-coverage.service<br>@/services/production-readiness-audit.service | 2026-07-20 |
| src / services / mlb-market-pipeline-diagnostics.service | Service | Experimental | No | No | Yes | No | No | No | No | @/lib/supabase-admin<br>@/services/current-board.service<br>@/services/provider-time-normalization.service | 2026-07-22 |
| src / services / mlb-missing-intelligence.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/config/sportsdataio-endpoint-catalog<br>@/lib/supabase-admin<br>@/services/mlb-model-platform.service<br>@/services/mlb-starter-weather-stadium-intelligence.service<br>@/services/provider-budget.service | 2026-07-18 |
| src / services / mlb-model-audit.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/lib/supabase-admin<br>@/services/mlb-feature-model-readiness.service | 2026-07-21 |
| src / services / mlb-model-platform.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/lib/server-schema-capabilities<br>@/lib/supabase-admin<br>@/services/mlb-starter-weather-stadium-intelligence.service<br>@/services/provider-time-normalization.service | 2026-07-20 |
| src / services / mlb-odds-coverage.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/lib/supabase-admin<br>@/services/current-board.service<br>@/services/provider-time-normalization.service | 2026-07-20 |
| src / services / mlb-operating-date-resolution.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/lib/supabase-admin<br>@/services/active-event.service<br>@/services/mlb-game-lifecycle.service<br>@/services/provider-time-normalization.service | 2026-07-24 |
| src / services / mlb-operations-center.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/services/autonomous-daily-operations.service<br>@/services/current-board.service<br>@/services/mlb-data-quality.service<br>@/services/mlb-missing-intelligence.service<br>@/services/mlb-prediction-engine.service | 2026-07-18 |
| src / services / mlb-pitcher-feature-builder.service | Service | Internal Dependency | No | No | No | No | No | No | Yes | @/lib/supabase-admin<br>@/types/mlb-pitcher-projections | 2026-07-26 |
| src / services / mlb-pitcher-projection-engine.service | Service | Internal Dependency | No | No | No | No | No | No | Yes | @/lib/supabase-admin<br>@/services/active-event.service<br>@/services/mlb-pitcher-feature-builder.service<br>@/services/mlb-projection-integrity.service<br>@/services/mlb-starter-sync.service | 2026-07-26 |
| src / services / mlb-player-data-excellence.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/lib/supabase-admin<br>@/services/mlb-player-props-foundation.service<br>@/services/mlb-projection-integrity.service | 2026-07-21 |
| src / services / mlb-player-projection-engine.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/lib/supabase-admin<br>@/services/active-event.service<br>@/services/mlb-current-lineup-context.service<br>@/services/universal-projection-engine.service | 2026-07-24 |
| src / services / mlb-player-prop-comparison.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/config/mlb-player-prop-markets<br>@/lib/supabase-admin<br>@/services/mlb-pitcher-projection-engine.service<br>@/types/mlb-pitcher-projections<br>@/types/mlb-player-prop-comparison | 2026-07-27 |
| src / services / mlb-player-prop-sync.service | Service | Internal Dependency | No | No | No | No | No | No | Yes | @/config/mlb-player-prop-markets<br>@/config/sportsdataio-endpoint-catalog<br>@/lib/supabase-admin<br>@/services/mlb-pitcher-projection-engine.service<br>@/services/provider-budget.service | 2026-07-27 |
| src / services / mlb-player-props-foundation.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/config/sportsdataio-endpoint-catalog<br>@/lib/supabase-admin<br>@/services/sportsdataio-runtime-adapter.service | 2026-07-21 |
| src / services / mlb-player-props-readiness-audit.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/lib/supabase-admin | 2026-07-24 |
| src / services / mlb-prediction-engine.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/services/mlb-feature-store-integration.service<br>@/services/sport-prediction-engine-sdk.service | 2026-07-18 |
| src / services / mlb-pregame-starter-evidence.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/lib/supabase-admin<br>@/services/mlb-games-by-date-verification.service<br>@/services/provider-budget.service<br>@/services/provider-time-normalization.service<br>@/services/sportsdataio-runtime-adapter.service | 2026-07-22 |
| src / services / mlb-projected-score.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/services/current-board.service | 2026-07-22 |
| src / services / mlb-projection-integrity.service | Service | Internal Dependency | No | No | No | No | No | No | No | crypto | 2026-07-21 |
| src / services / mlb-provider-capability-audit.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/config/sportsdataio-endpoint-catalog<br>@/services/mlb-data-quality.service<br>@/types/sportsdataio-mlb | 2026-07-17 |
| src / services / mlb-starter-intelligence.service | Service | Internal Dependency | No | No | No | No | No | No | Yes | @/lib/supabase-admin<br>@/services/active-event.service<br>@/services/mlb-starter-weather-stadium-intelligence.service | 2026-07-24 |
| src / services / mlb-starter-sync.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/lib/supabase-admin<br>@/services/active-event.service<br>@/services/mlb-games-by-date-verification.service<br>@/services/provider-budget.service<br>@/types/mlb-starter-assignments | 2026-07-26 |
| src / services / mlb-starter-weather-stadium-intelligence.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/lib/supabase-admin<br>@/services/provider-time-normalization.service | 2026-07-20 |
| src / services / mlb-team-stats-sync.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/lib/supabase | 2026-06-21 |
| src / services / mlb-team-totals-readiness.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/lib/supabase-admin<br>@/services/market-semantics.service | 2026-07-24 |
| src / services / mlb-temporal-health.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/lib/supabase-admin<br>@/services/active-event.service<br>@/services/adaptive-refresh-orchestrator.service<br>@/services/current-board.service<br>@/services/mlb-freshness-policy.service | 2026-07-20 |
| src / services / mlb-unresolved-player-identity.service | Service | Internal Dependency | No | No | No | No | No | No | Yes | @/lib/supabase-admin | 2026-07-21 |
| src / services / model-adjustments.service | Service | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-06-23 |
| src / services / model-backtest.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/lib/supabase-admin<br>@/services/production-data-gate.service | 2026-07-14 |
| src / services / model-calibration.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/lib/supabase-admin<br>@/services/production-data-gate.service | 2026-07-14 |
| src / services / model-learning.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/lib/supabase-admin<br>@/services/model-backtest.service<br>@/services/model-calibration.service<br>@/services/model-versioning.service<br>@/services/production-data-gate.service | 2026-07-14 |
| src / services / model-metrics-framework.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/lib/supabase-admin<br>@/services/production-data-gate.service | 2026-07-14 |
| src / services / model-segments.service | Service | Internal Dependency | No | Yes | No | No | No | No | Yes | @/lib/supabase-admin<br>@/lib/settlement-canonical<br>@/lib/time<br>server-only | 2026-07-31 |
| src / services / model-only-intelligence.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/lib/supabase-admin | 2026-07-23 |
| src / services / model-versioning.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/lib/supabase-admin | 2026-07-07 |
| src / services / monte-carlo-engine.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/services/top-picks.service | 2026-07-09 |
| src / services / multi-sport-adapters.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/config/sports.config<br>@/services/bsn-platform.service<br>@/services/bsn.service<br>@/services/multi-sport-normalizers.service<br>@/services/multi-sport-registry.service | 2026-07-28 |
| src / services / multi-sport-data-expansion-checkpoint2.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/services/data-coverage-inventory.service<br>@/services/historical-import-engine.service<br>@/services/multi-sport-provider-entitlement-audit.service<br>@/services/provider-intelligence.service | 2026-07-28 |
| src / services / multi-sport-data-expansion-checkpoint3.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/services/data-coverage-inventory.service<br>@/services/historical-import-engine.service<br>@/services/multi-sport-provider-entitlement-audit.service<br>@/services/provider-intelligence.service | 2026-07-28 |
| src / services / multi-sport-data-expansion-final.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/services/data-coverage-inventory.service<br>@/services/multi-sport-data-expansion-checkpoint2.service<br>@/services/multi-sport-data-expansion-checkpoint3.service<br>@/services/multi-sport-provider-entitlement-audit.service | 2026-07-30 |
| src / services / multi-sport-feature-registry.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/config/sports.config<br>@/services/feature-store-core.service<br>@/types/multi-sport | 2026-07-27 |
| src / services / multi-sport-health.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/services/multi-sport-adapters.service<br>@/services/multi-sport-providers.service<br>@/services/multi-sport-registry.service<br>@/types/multi-sport | 2026-07-28 |
| src / services / multi-sport-markets.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/config/sports.config<br>@/types/multi-sport | 2026-07-27 |
| src / services / multi-sport-normalizers.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/config/sports.config<br>@/types/multi-sport | 2026-07-27 |
| src / services / multi-sport-provider-entitlement-audit.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/services/multi-sport-providers.service<br>@/services/provider-intelligence.service<br>@/services/sportsdataio-subscription-maximization-audit.service<br>@/services/the-odds-api-capability-audit.service | 2026-07-28 |
| src / services / multi-sport-providers.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/config/sports.config<br>@/types/multi-sport | 2026-07-27 |
| src / services / multi-sport-query.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/config/sports.config<br>@/services/multi-sport-markets.service<br>@/services/multi-sport-providers.service<br>@/services/multi-sport-registry.service<br>@/services/multi-sport-resolution.service | 2026-07-28 |
| src / services / multi-sport-registry.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/config/sports.config<br>@/services/multi-sport-markets.service<br>@/types/multi-sport | 2026-07-27 |
| src / services / multi-sport-resolution.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/config/sports.config<br>@/services/multi-sport-adapters.service<br>@/services/multi-sport-markets.service<br>@/services/multi-sport-providers.service<br>@/services/multi-sport-registry.service | 2026-07-28 |
| src / services / multi-sport-results-crosswalk-foundation.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/config/sports.config<br>@/lib/supabase-admin | 2026-07-28 |
| src / services / multi-sport-validation.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/services/multi-sport-markets.service<br>@/services/multi-sport-providers.service<br>@/services/multi-sport-registry.service | 2026-07-11 |
| src / services / nba-adapter.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/lib/supabase-admin | 2026-07-11 |
| src / services / nba-backtesting-calibration.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/lib/server-schema-capabilities<br>@/lib/supabase-admin<br>@/services/historical-feature-generation.service<br>@/services/nba-prediction-validation.service<br>@/services/production-data-gate.service | 2026-07-14 |
| src / services / nba-data-quality.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/lib/supabase-admin<br>@/services/nba-data-sync.service<br>@/services/nba-prediction-validation.service | 2026-07-14 |
| src / services / nba-data-sync.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/lib/supabase-admin<br>@/services/historical-feature-generation.service<br>@/services/mlb-event-status-mapper.service<br>@/services/multi-sport-health.service<br>@/services/multi-sport-query.service | 2026-07-28 |
| src / services / nba-feature-store-integration.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/lib/supabase-admin<br>@/services/feature-store-core.service<br>@/services/multi-sport-feature-registry.service<br>@/services/nba-injury-lineup-confidence.service | 2026-07-14 |
| src / services / nba-historical-foundation-v2.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/lib/supabase-admin<br>@/services/data-foundation-coverage.service | 2026-07-26 |
| src / services / nba-injury-lineup-confidence.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/lib/supabase-admin<br>@/services/sportsdataio-runtime-adapter.service | 2026-07-13 |
| src / services / nba-multi-book-comparison.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/lib/supabase-admin<br>@/services/nba-data-sync.service<br>@/services/nba-prediction-validation.service | 2026-07-12 |
| src / services / nba-prediction-engine.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/lib/supabase-admin<br>@/services/adaptive-scoring.service<br>@/services/adaptive-weight-engine.service<br>@/services/kelly.service<br>@/services/model-learning.service | 2026-07-13 |
| src / services / nba-prediction-settlement.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/lib/supabase-admin<br>@/services/nba-injury-lineup-confidence.service<br>@/services/nba-prediction-validation.service | 2026-07-14 |
| src / services / nba-prediction-validation.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/lib/supabase-admin<br>@/services/prediction-history.service | 2026-07-13 |
| src / services / nba-steam-move-detection.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/lib/supabase-admin<br>@/services/nba-data-sync.service<br>@/services/nba-prediction-validation.service | 2026-07-12 |
| src / services / next-slate.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/lib/supabase-admin<br>@/services/active-event.service<br>@/services/provider-time-normalization.service | 2026-07-20 |
| src / services / nfl-feature-store-integration.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/lib/supabase-admin<br>@/services/feature-store-core.service<br>@/services/multi-sport-feature-registry.service | 2026-07-12 |
| src / services / nfl-historical-foundation-v2.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/lib/supabase-admin<br>@/services/data-foundation-coverage.service | 2026-07-26 |
| src / services / nfl-prediction-engine.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/services/nfl-feature-store-integration.service<br>@/services/sport-prediction-engine-sdk.service | 2026-07-13 |
| src / services / nhl-feature-store-integration.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/lib/supabase-admin<br>@/services/feature-store-core.service<br>@/services/multi-sport-feature-registry.service | 2026-07-13 |
| src / services / nhl-historical-foundation-v2.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/lib/supabase-admin<br>@/services/data-foundation-coverage.service | 2026-07-27 |
| src / services / nhl-prediction-engine.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/services/nhl-feature-store-integration.service<br>@/services/sport-prediction-engine-sdk.service | 2026-07-13 |
| src / services / odds.service | Service | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-06-26 |
| src / services / official-pick-experience.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/services/current-board.service<br>@/services/market-alignment.service<br>@/services/market-semantics.service<br>@/services/recommendation-eligibility-policy.service<br>@/services/recommendation-explanation.service | 2026-07-24 |
| src / services / operating-day-automation.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/lib/supabase-admin<br>@/services/current-board.service<br>@/services/mlb-game-lifecycle.service<br>@/services/mlb-operating-date-resolution.service<br>@/services/next-slate.service | 2026-07-20 |
| src / services / operating-day.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/lib/supabase-admin<br>@/services/best-value-scanner.service<br>@/services/bet-slip-optimizer.service<br>@/services/current-board.service<br>@/services/day1-recommendation-readiness.service | 2026-07-31 |
| src / services / operations-health.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/config/mlb-operating-day-scheduler<br>@/lib/supabase-admin<br>@/services/active-event.service<br>@/services/adaptive-refresh-orchestrator.service<br>@/services/current-board.service | 2026-07-30 |
| src / services / parlay-generator.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/services/correlation.service<br>@/services/recommendation-eligibility-policy.service<br>@/services/top-picks.service | 2026-07-15 |
| src / services / pattern-discovery.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/lib/supabase-admin<br>@/services/production-data-gate.service | 2026-07-14 |
| src / services / performance-product-contract.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/config/sports.config<br>@/services/performance-scope-v2.service | 2026-07-31 |
| src / services / performance-scope-v2.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/lib/supabase-admin<br>@/services/canonical-settlement-state.service<br>@/services/prediction-cutoff-enforcement.service<br>@/services/pregame-scheduler-coverage.service<br>@/services/provider-time-normalization.service | 2026-07-31 |
| src / services / play-of-the-day.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/services/recommendation-eligibility-policy.service<br>@/services/top-picks.service | 2026-07-15 |
| src / services / player-intelligence.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/lib/supabase-admin<br>@/services/mlb-learning-brain.service | 2026-07-22 |
| src / services / portfolio-ai-v2.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/services/top-picks.service | 2026-07-11 |
| src / services / portfolio-builder.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/services/bankroll.service<br>@/services/correlation.service<br>@/services/exposure.service<br>@/services/portfolio-optimizer.service<br>@/services/portfolio-scoring.service | 2026-07-15 |
| src / services / portfolio-intelligence.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/services/current-board.service<br>@/services/probability-picks.service<br>@/types/portfolio-intelligence<br>@/types/probability-picks<br>crypto | 2026-07-28 |
| src / services / portfolio-optimizer.service | Service | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-06-24 |
| src / services / portfolio-scoring.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/services/exposure.service | 2026-06-24 |
| src / services / portfolio-simulator.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/services/bankroll.service<br>@/services/portfolio-builder.service | 2026-06-24 |
| src / services / prediction-capture.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/config/sports.config<br>@/services/prediction.service | 2026-06-22 |
| src / services / prediction-cutoff-enforcement.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/lib/supabase-admin | 2026-07-24 |
| src / services / prediction-engine-v4.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/services/monte-carlo-engine.service<br>@/services/sharp-money-intelligence.service<br>@/services/top-picks.service | 2026-07-10 |
| src / services / prediction-epoch-governance-v2.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/lib/supabase-admin<br>@/services/prediction-epoch-migration-state.service | 2026-07-27 |
| src / services / prediction-epoch-migration-state.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/lib/supabase-admin | 2026-07-27 |
| src / services / prediction-epoch-shadow-readiness.service | Service | Experimental | No | No | Yes | No | No | No | No | @/lib/supabase-admin<br>@/services/prediction-epoch-migration-state.service | 2026-07-28 |
| src / services / prediction-history.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/lib/supabase-admin<br>@/services/mlb-starter-weather-stadium-intelligence.service<br>@/services/next-slate.service<br>@/services/prediction-cutoff-enforcement.service<br>@/services/production-data-gate.service | 2026-07-24 |
| src / services / prediction-market-intelligence.service | Service | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-06-28 |
| src / services / prediction-safety.service | Service | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-13 |
| src / services / prediction-settlement.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/lib/supabase | 2026-07-26 |
| src / services / prediction.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/lib/supabase<br>@/services/advanced-factors.service<br>@/services/model-learning.service<br>@/services/prediction-history.service<br>@/services/prediction-market-intelligence.service | 2026-06-28 |
| src / services / pregame-scheduler-coverage.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/lib/supabase-admin<br>@/services/mlb-operating-date-resolution.service<br>@/services/prediction-cutoff-enforcement.service<br>@/services/provider-time-normalization.service | 2026-07-24 |
| src / services / probability-picks.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/lib/supabase-admin<br>@/services/mlb-pitcher-projection-engine.service<br>@/types/mlb-pitcher-projections<br>@/types/probability-picks<br>crypto | 2026-07-27 |
| src / services / production-data-gate.service | Service | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-14 |
| src / services / production-readiness-audit.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/lib/supabase-admin<br>@/services/active-event.service<br>@/services/adaptive-refresh-orchestrator.service<br>@/services/ai-performance-center.service<br>@/services/current-board.service | 2026-07-20 |
| src / services / projection-evolution.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/lib/supabase-admin | 2026-07-25 |
| src / services / prospective-official-eligibility-gate.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/lib/supabase-admin<br>@/services/current-board.service<br>@/services/market-alignment.service<br>@/services/market-semantics.service<br>@/services/recommendation-eligibility-policy.service | 2026-07-24 |
| src / services / rating.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/types/database<br>@/utils/team-rating | 2026-06-21 |
| src / services / recommendation-eligibility-policy.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/services/production-data-gate.service | 2026-07-15 |
| src / services / recommendation-explanation.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/services/market-alignment.service<br>@/services/market-semantics.service<br>@/services/recommendation-eligibility-policy.service | 2026-07-24 |
| src / services / recommendation-pipeline-trace.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/lib/supabase-admin<br>@/services/current-board.service<br>@/services/model-only-intelligence.service<br>@/services/prediction-cutoff-enforcement.service<br>@/services/pregame-scheduler-coverage.service | 2026-07-28 |
| src / services / results-sync.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/lib/supabase-admin<br>@/services/mlb-event-status-mapper.service<br>@/services/provider-budget.service<br>@/services/provider-time-normalization.service | 2026-07-30 |
| src / services / retrosheet-controlled-import.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/lib/supabase-admin<br>@/services/retrosheet-game-reconstruction.service<br>@/services/retrosheet-historical-data-lake.service<br>path | 2026-07-22 |
| src / services / retrosheet-game-reconstruction.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/services/retrosheet-historical-data-lake.service<br>crypto<br>fs<br>fs/promises<br>path | 2026-07-22 |
| src / services / retrosheet-historical-data-lake.service | Service | Internal Dependency | No | No | No | No | No | No | No | crypto<br>fs<br>fs/promises<br>path<br>readline | 2026-07-22 |
| src / services / retrosheet-historical-feature-store.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/lib/supabase-admin<br>crypto | 2026-07-24 |
| src / services / risk-grade.service | Service | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-06-24 |
| src / services / runtime-observability.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/lib/supabase-admin<br>@/services/provider-intelligence.service<br>@/services/sportsdataio-historical-import-readiness.service<br>@/services/sportsdataio-nba-integration-readiness.service<br>@/services/sportsdataio-nba-odds-readiness.service | 2026-07-14 |
| src / services / safe-supabase-preflight.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/lib/supabase-admin | 2026-07-14 |
| src / services / self-learning-engine.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/services/model-learning.service<br>@/services/model-versioning.service | 2026-07-08 |
| src / services / settlement-core.service | Service | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-14 |
| src / services / settlement-guarantee.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/lib/supabase-admin<br>@/services/canonical-settlement-state.service<br>@/services/operations-health.service<br>@/services/provider-time-normalization.service | 2026-07-31 |
| src / services / settlement-reconciliation.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/lib/supabase-admin<br>@/services/legacy-prediction-provenance.service<br>@/services/prediction-cutoff-enforcement.service<br>@/services/settlement-core.service | 2026-07-26 |
| src / services / sharp-money-intelligence.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/services/top-picks.service | 2026-07-09 |
| src / services / sharp-money.service | Service | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-06-26 |
| src / services / smart-ranking.service | Service | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-06-24 |
| src / services / soccer-feature-store-integration.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/lib/supabase-admin<br>@/services/feature-store-core.service<br>@/services/multi-sport-feature-registry.service | 2026-07-13 |
| src / services / soccer-historical-foundation-v2.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/lib/supabase-admin<br>@/services/data-foundation-coverage.service<br>@/services/data-foundation-season-governance.service | 2026-07-27 |
| src / services / soccer-prediction-engine.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/services/kelly.service<br>@/services/smart-ranking.service<br>@/services/soccer-feature-store-integration.service<br>@/services/sport-prediction-engine-sdk.service | 2026-07-13 |
| src / services / sport-prediction-engine-sdk.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/services/feature-store-core.service<br>@/services/kelly.service<br>@/services/smart-ranking.service<br>@/types/multi-sport | 2026-07-24 |
| src / services / sport-top-picks.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/services/top-picks.service | 2026-06-24 |
| src / services / sports-analyst.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/services/game-intelligence.service | 2026-07-21 |
| src / services / sports-center.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/config/product-status<br>@/types/sports-center | 2026-07-28 |
| src / services / sports.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/lib/supabase<br>@/types/database | 2026-06-21 |
| src / services / sportsbook-intelligence.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/services/bankroll.service<br>@/services/live-betting.service | 2026-06-28 |
| src / services / sportsdataio-adapter-contract.service | Service | Internal Dependency | No | No | No | No | No | No | Yes | @/services/multi-sport-normalizers.service<br>@/services/provider-adapter-sdk.service<br>@/types/multi-sport | 2026-07-27 |
| src / services / sportsdataio-betting-normalizer.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/services/sync-reliability.service | 2026-07-14 |
| src / services / sportsdataio-discovery-lab-url.service | Service | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-16 |
| src / services / sportsdataio-historical-import-readiness.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/config/sports.config<br>@/lib/supabase-admin<br>@/services/mlb-event-status-mapper.service<br>@/services/nba-data-quality.service<br>@/services/nba-feature-store-integration.service | 2026-07-28 |
| src / services / sportsdataio-mlb-discovery.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/config/sportsdataio-endpoint-catalog<br>@/lib/supabase-admin<br>@/services/mlb-provider-capability-audit.service | 2026-07-20 |
| src / services / sportsdataio-mlb-historical-import-executor.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/lib/supabase-admin<br>@/services/mlb-event-status-mapper.service<br>@/services/provider-budget.service<br>@/services/provider-time-normalization.service<br>@/services/safe-supabase-preflight.service | 2026-07-28 |
| src / services / sportsdataio-mlb-normalization.service | Service | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-14 |
| src / services / sportsdataio-mlb-prospective-preview.service | Service | Experimental | No | No | Yes | No | No | No | No | @/lib/server-schema-capabilities<br>@/lib/supabase-admin<br>@/services/feature-store-core.service<br>@/services/mlb-event-status-mapper.service<br>@/services/mlb-missing-intelligence.service | 2026-07-24 |
| src / services / sportsdataio-nba-integration-readiness.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/services/sportsdataio-nba-odds-readiness.service<br>@/services/sportsdataio-nba-player-props-readiness.service<br>@/services/sportsdataio-nba-player-stats-readiness.service<br>@/services/sportsdataio-runtime-adapter.service | 2026-07-14 |
| src / services / sportsdataio-nba-odds-readiness.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/services/sportsdataio-runtime-adapter.service | 2026-07-13 |
| src / services / sportsdataio-nba-player-props-readiness.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/services/sportsdataio-runtime-adapter.service | 2026-07-13 |
| src / services / sportsdataio-nba-player-stats-readiness.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/services/sportsdataio-runtime-adapter.service | 2026-07-14 |
| src / services / sportsdataio-nba-trial-isolation-audit.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/lib/supabase-admin | 2026-07-14 |
| src / services / sportsdataio-runtime-adapter.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/config/sports.config<br>@/services/multi-sport-normalizers.service<br>@/services/provider-adapter-sdk.service<br>@/services/sportsdataio-adapter-contract.service<br>@/services/sportsdataio-betting-normalizer.service | 2026-07-27 |
| src / services / sportsdataio-subscription-maximization-audit.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/config/sportsdataio-endpoint-catalog<br>@/lib/supabase-admin<br>@/services/provider-budget.service<br>@/services/sportsdataio-runtime-adapter.service | 2026-07-21 |
| src / services / stored-preview-prediction-lifecycle.service | Service | Experimental | No | No | Yes | No | No | No | No | @/lib/supabase-admin<br>@/services/feature-store-core.service<br>@/services/prediction-cutoff-enforcement.service<br>@/services/settlement-reconciliation.service<br>@/services/sport-prediction-engine-sdk.service | 2026-07-28 |
| src / services / sync-reliability.service | Service | Internal Dependency | No | No | No | No | No | No | Yes | None detected | 2026-07-12 |
| src / services / team-matchups-calculator.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/lib/supabase-admin | 2026-06-21 |
| src / services / team-stats-calculator.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/lib/supabase-admin | 2026-06-21 |
| src / services / team-stats.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/lib/supabase<br>@/types/database | 2026-06-21 |
| src / services / tennis-feature-store-integration.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/lib/supabase-admin<br>@/services/feature-store-core.service<br>@/services/multi-sport-feature-registry.service | 2026-07-13 |
| src / services / tennis-prediction-engine.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/services/sport-prediction-engine-sdk.service<br>@/services/tennis-feature-store-integration.service | 2026-07-13 |
| src / services / tennis-ufc-data-readiness-v2.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/lib/supabase-admin<br>@/services/data-foundation-coverage.service | 2026-07-27 |
| src / services / the-odds-api-capability-audit.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/lib/supabase-admin<br>crypto | 2026-07-26 |
| src / services / the-odds-api-current-odds-acquisition.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/config/sports.config<br>@/lib/supabase-admin<br>crypto | 2026-07-28 |
| src / services / the-odds-api-event-crosswalk.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/lib/supabase-admin<br>crypto | 2026-07-26 |
| src / services / the-odds-api-maximum-utilization.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/config/sports.config | 2026-07-28 |
| src / services / the-odds-api-pitcher-identity-bridge.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/lib/supabase-admin<br>@/services/the-odds-api-event-crosswalk.service | 2026-07-26 |
| src / services / top-picks.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/lib/supabase-admin<br>@/services/adaptive-scoring.service<br>@/services/adaptive-weight-engine.service<br>@/services/kelly.service<br>@/services/production-data-gate.service | 2026-07-15 |
| src / services / training-feature-governance-v1.service | Service | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-29 |
| src / services / ufc-feature-store-integration.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/lib/supabase-admin<br>@/services/feature-store-core.service<br>@/services/multi-sport-feature-registry.service | 2026-07-13 |
| src / services / ufc-prediction-engine.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/services/sport-prediction-engine-sdk.service<br>@/services/ufc-feature-store-integration.service | 2026-07-13 |
| src / services / universal-event-identity.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/lib/supabase-admin | 2026-07-28 |
| src / services / universal-market-intelligence.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/lib/supabase-admin<br>@/services/market-semantics.service<br>@/services/mlb-first-five-readiness.service<br>@/services/mlb-market-capability-registry.service<br>@/services/mlb-team-totals-readiness.service | 2026-07-24 |
| src / services / universal-projection-engine.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/lib/supabase-admin<br>@/services/active-event.service<br>@/services/feature-store-core.service<br>@/services/mlb-current-lineup-context.service<br>@/services/mlb-game-lifecycle.service | 2026-07-24 |
| src / services / weight-optimizer.service | Service | Internal Dependency | No | No | No | No | No | No | No | @/lib/supabase-admin<br>@/services/model-learning.service<br>@/services/production-data-gate.service | 2026-07-28 |
| docs / AI_PERFORMANCE_AUTOMATION | Settlement Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-20 |
| docs / FEATURE_ALIAS_MAP_V1 | Settlement Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-29 |
| docs / FEATURE_LEAKAGE_ENFORCEMENT_V1 | Settlement Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-29 |
| docs / MARKET_READINESS_FORECAST | Settlement Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-29 |
| docs / MLB_GAME_LIFECYCLE | Settlement Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-20 |
| docs / MLB_MARKET_DATA_REQUIREMENTS | Settlement Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-20 |
| docs / MLB_MARKET_PROVIDER_MATRIX | Settlement Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-20 |
| docs / MLB_MARKET_RISK_ANALYSIS | Settlement Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-20 |
| docs / MLB_MARKET_SETTLEMENT_REQUIREMENTS | Settlement Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-20 |
| docs / MLB_PLAYER_PROP_MARKET_COMPARISON_V1 | Settlement Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-27 |
| docs / MLB_PROJECTION_RANKING | Settlement Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-20 |
| docs / MLB_PROVIDER_USAGE_OBSERVED_V1 | Settlement Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-30 |
| docs / MLB_REFRESH_CADENCE_OBSERVED_V1 | Settlement Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-30 |
| docs / mlb-player-catalog-completion | Settlement Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-21 |
| docs / mlb-player-prop-readiness | Settlement Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-21 |
| docs / model-promotion-and-rollback | Settlement Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-22 |
| docs / OPERATIONAL_LAUNCH_REPAIR_ROADMAP_V1 | Settlement Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-30 |
| docs / PICK_ANALYZER_V1_POST_RELEASE_OPERATIONS | Settlement Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-30 |
| docs / pitcher-outs-settlement-v1 | Settlement Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-22 |
| docs / player-intelligence-foundation | Settlement Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-21 |
| docs / PRODUCT_ROUTE_INVENTORY_V1 | Settlement Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-31 |
| docs / PRODUCT / README | Settlement Module | Internal Dependency | No | No | No | No | No | No | Yes | None detected | 2026-07-31 |
| docs / settlement-recovery-v1 | Settlement Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-22 |
| docs / SPORTSDATAIO_DISCOVERY_INTEGRATION | Settlement Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-20 |
| docs / SPORTSDATAIO_ENDPOINT_CAPABILITIES | Settlement Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-20 |
| docs / THE_ODDS_API_FREE_TIER_CAPABILITY_AUDIT_V1 | Settlement Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-26 |
| docs / TODAY_DASHBOARD_RELIABILITY | Settlement Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-20 |
| src / config / sportsdataio-endpoint-catalog | Settlement Module | Internal Dependency | No | No | No | No | No | No | No | None detected | 2026-07-17 |
| src / types / sports-center | Settlement Module | Internal Dependency | No | No | No | No | No | No | No | @/config/product-status | 2026-07-27 |
