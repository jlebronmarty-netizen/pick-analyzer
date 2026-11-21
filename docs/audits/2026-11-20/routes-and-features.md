# Entradas y dependencias del repositorio

Base inspeccionada 61ed75d8. Las rutas se derivan del árbol Next.js. El inventario no invoca rutas con efectos secundarios.

## Crons de Vercel

| Ruta | Cron UTC |
|---|---|
| `/api/cron/nba-current-era-shadow` | `*/30 * * * *` |
| `/api/cron/ncaab-daily` | `0 4,10,16,22 * * *` |
| `/api/cron/nhl-free` | `7,37 * * * *` |
| `/api/cron/edge-lab-soccer` | `15,45 * * * *` |
| `/api/cron/edge-lab-sports` | `*/10 * * * *` |
| `/api/cron/ufc-free` | `49 1,5,9,13,17,21 * * *` |
| `/api/cron/free-sports` | `39 1,5,9,13,17,21 * * *` |
| `/api/cron/tennis-source` | `13 0 * * *` |
| `/api/cron/bsn-archive` | `5 0,8,16 * * *` |
| `/api/cron/model-learning-evaluate` | `25 11 * * *` |
| `/api/cron/nba-hoopsapi` | `15 15,21,23 * * *` |
| `/api/cron/nba-decision-freeze` | `35 15,23 * * *` |
| `/api/cron/nba-decision-settle` | `15 12 * * *` |

## Pantallas y endpoints

- `/ai-bet-finder`
- `/ai-operations`
- `/api/admin/mlb-operational-preflight`
- `/api/ai-bet-finder`
- `/api/ai-performance-center`
- `/api/ai/coach`
- `/api/ai/copilot`
- `/api/ai/copilot/chat`
- `/api/ai/sports-brain`
- `/api/analytics/charts`
- `/api/analytics/clv`
- `/api/analytics/dashboard`
- `/api/autonomous-daily-ai`
- `/api/autonomous-daily-operations/daily-report`
- `/api/autonomous-daily-operations/execute`
- `/api/autonomous-daily-operations/health`
- `/api/autonomous-daily-operations/learning-report`
- `/api/autonomous-daily-operations/scheduler`
- `/api/autonomous-daily-operations/status`
- `/api/bankroll`
- `/api/bankroll/manager`
- `/api/basketball/bsn/acquisition`
- `/api/basketball/bsn/data-coverage`
- `/api/basketball/bsn/historical-reconstruction`
- `/api/basketball/platform`
- `/api/best-bets-today`
- `/api/bsn/admin/validation`
- `/api/bsn/ai-coach`
- `/api/bsn/analytics/readiness`
- `/api/bsn/capabilities`
- `/api/bsn/compare`
- `/api/bsn/core-certification`
- `/api/bsn/current-board`
- `/api/bsn/data-quality`
- `/api/bsn/features`
- `/api/bsn/features/validation`
- `/api/bsn/game/[id]`
- `/api/bsn/games`
- `/api/bsn/import`
- `/api/bsn/intelligence`
- `/api/bsn/intelligence/validation`
- `/api/bsn/model-maturity`
- `/api/bsn/model-maturity/activation-audit`
- `/api/bsn/model-maturity/backtesting`
- `/api/bsn/model-maturity/calibration`
- `/api/bsn/model-maturity/explanations`
- `/api/bsn/model-maturity/performance`
- `/api/bsn/model-maturity/readiness`
- `/api/bsn/model-maturity/shadow-market`
- `/api/bsn/momentum`
- `/api/bsn/operations/readiness`
- `/api/bsn/power-rankings`
- `/api/bsn/predictions`
- `/api/bsn/predictions/preview`
- `/api/bsn/predictions/validation`
- `/api/bsn/results`
- `/api/bsn/seed`
- `/api/bsn/source-health`
- `/api/bsn/source-quality`
- `/api/bsn/sources`
- `/api/bsn/sources/validate`
- `/api/bsn/sync`
- `/api/bsn/team/[id]`
- `/api/bsn/teams`
- `/api/closing-line/intelligence`
- `/api/clv/update`
- `/api/consumer/v1/mlb/moneyline-recommendations`
- `/api/consumer/v1/mlb/pitcher-earned-runs`
- `/api/consumer/v1/mlb/pitcher-k-v2`
- `/api/consumer/v1/mlb/player-props`
- `/api/consumer/v1/mlb/results`
- `/api/cron/bsn-archive`
- `/api/cron/capture-predictions`
- `/api/cron/daily-sync`
- `/api/cron/edge-lab-soccer`
- `/api/cron/edge-lab-sports`
- `/api/cron/free-sports`
- `/api/cron/master-sync`
- `/api/cron/mlb-forward-master-ledger`
- `/api/cron/mlb-official-settlement`
- `/api/cron/mlb-operational`
- `/api/cron/mlb-runline-v2-forward`
- `/api/cron/mlb-statcast-daily`
- `/api/cron/model-learning-evaluate`
- `/api/cron/nba-current-era-shadow`
- `/api/cron/nba-decision-freeze`
- `/api/cron/nba-decision-settle`
- `/api/cron/nba-hoopsapi`
- `/api/cron/ncaab-daily`
- `/api/cron/nhl-free`
- `/api/cron/operating-day`
- `/api/cron/tennis-source`
- `/api/cron/ufc-free`
- `/api/current-board`
- `/api/daily-report`
- `/api/daily-report/fast`
- `/api/dashboard`
- `/api/dashboard/cache/clear`
- `/api/dashboard/multisport`
- `/api/dashboard/today`
- `/api/data-coverage/expansion-checkpoint2`
- `/api/data-coverage/expansion-checkpoint3`
- `/api/data-coverage/final-certification`
- `/api/data-coverage/health`
- `/api/data-coverage/inventory`
- `/api/data-coverage/provider-audit`
- `/api/data-foundation/bsn`
- `/api/data-foundation/coverage`
- `/api/data-foundation/epoch-performance`
- `/api/data-foundation/epochs`
- `/api/data-foundation/feature-rebuild`
- `/api/data-foundation/future-predictions`
- `/api/data-foundation/import-orchestrator`
- `/api/data-foundation/legacy-metrics`
- `/api/data-foundation/mlb`
- `/api/data-foundation/nba`
- `/api/data-foundation/nfl`
- `/api/data-foundation/nhl`
- `/api/data-foundation/quality`
- `/api/data-foundation/readiness`
- `/api/data-foundation/reconciliation`
- `/api/data-foundation/results-crosswalk`
- `/api/data-foundation/seasons`
- `/api/data-foundation/soccer`
- `/api/data-foundation/tennis-ufc`
- `/api/data-quality/global`
- `/api/edge-lab`
- `/api/edge-lab/multi`
- `/api/edge-lab/ncaaf`
- `/api/events/[eventId]/identity`
- `/api/events/identity/audit`
- `/api/events/identity/conflicts`
- `/api/events/identity/unresolved`
- `/api/events/recovery/missing-canonical`
- `/api/factors/debug`
- `/api/features/registry`
- `/api/features/registry/lookup`
- `/api/features/registry/validation`
- `/api/features/store`
- `/api/features/store/definitions`
- `/api/features/store/validation`
- `/api/games/[eventId]/intelligence`
- `/api/head-to-head/recalculate`
- `/api/hedges`
- `/api/historical-import/cancel`
- `/api/historical-import/execute`
- `/api/historical-import/health`
- `/api/historical-import/jobs`
- `/api/historical-import/jobs/[jobId]`
- `/api/historical-import/pilot-plan`
- `/api/historical-import/plan`
- `/api/historical-import/resume`
- `/api/historical-import/validate/[jobId]`
- `/api/injuries/seed`
- `/api/live-bets`
- `/api/live-betting`
- `/api/market-data/nba`
- `/api/market-data/nba/archive`
- `/api/market-data/nba/model-report`
- `/api/market-data/nba/model-status`
- `/api/market-data/nba/ops`
- `/api/market-intelligence`
- `/api/market-intelligence/movement`
- `/api/market-opportunities/arbitrage`
- `/api/market-opportunities/best-value`
- `/api/market-opportunities/most-likely`
- `/api/markets/diagnostics`
- `/api/markets/inventory`
- `/api/markets/provider-coverage`
- `/api/markets/readiness`
- `/api/mission-control`
- `/api/mission-control/data-readiness`
- `/api/mlb/ai-coach`
- `/api/mlb/context-lineage`
- `/api/mlb/current-season/data-quality`
- `/api/mlb/daily-history-readiness`
- `/api/mlb/data-quality`
- `/api/mlb/decision-board`
- `/api/mlb/engines`
- `/api/mlb/features/model-readiness`
- `/api/mlb/features/preview`
- `/api/mlb/features/store`
- `/api/mlb/features/validation`
- `/api/mlb/game-intelligence`
- `/api/mlb/games-payload-audit`
- `/api/mlb/historical-backfill/player-game-stats`
- `/api/mlb/historical-intelligence/retrosheet`
- `/api/mlb/historical-intelligence/retrosheet/features`
- `/api/mlb/historical-intelligence/retrosheet/game-engine`
- `/api/mlb/historical-intelligence/retrosheet/import`
- `/api/mlb/intelligence/pitcher-bullpen-foundation`
- `/api/mlb/learning-brain`
- `/api/mlb/learning/readiness`
- `/api/mlb/lineup-context`
- `/api/mlb/market-pipeline/diagnostics`
- `/api/mlb/markets/capabilities`
- `/api/mlb/markets/expansion-roadmap`
- `/api/mlb/markets/first-five`
- `/api/mlb/markets/team-totals`
- `/api/mlb/missing-intelligence/health`
- `/api/mlb/model-audit`
- `/api/mlb/odds/coverage`
- `/api/mlb/operations`
- `/api/mlb/operations-center`
- `/api/mlb/operations/health`
- `/api/mlb/performance`
- `/api/mlb/pitchers/[pitcherId]/projection`
- `/api/mlb/pitchers/projections`
- `/api/mlb/pitchers/projections/generate`
- `/api/mlb/pitchers/projections/health`
- `/api/mlb/pitchers/projections/preview`
- `/api/mlb/pitchers/projections/validation`
- `/api/mlb/player-data-excellence`
- `/api/mlb/player-projections`
- `/api/mlb/player-projections/[projectionId]`
- `/api/mlb/player-projections/batters`
- `/api/mlb/player-projections/lifecycle`
- `/api/mlb/player-projections/performance`
- `/api/mlb/player-projections/pitchers`
- `/api/mlb/player-projections/readiness`
- `/api/mlb/player-props`
- `/api/mlb/player-props/[pitcherId]`
- `/api/mlb/player-props/certification-ledger`
- `/api/mlb/player-props/certification-snapshots`
- `/api/mlb/player-props/foundation`
- `/api/mlb/player-props/generate`
- `/api/mlb/player-props/health`
- `/api/mlb/player-props/mapping-diagnostics`
- `/api/mlb/player-props/preflight`
- `/api/mlb/player-props/preview`
- `/api/mlb/player-props/provider-audit`
- `/api/mlb/player-props/readiness`
- `/api/mlb/player-props/sync`
- `/api/mlb/player-props/validation`
- `/api/mlb/players/metadata-cache`
- `/api/mlb/players/unresolved-identities`
- `/api/mlb/predictions`
- `/api/mlb/predictions/comparison`
- `/api/mlb/predictions/health`
- `/api/mlb/predictions/promotion-readiness`
- `/api/mlb/predictions/rollback-plan`
- `/api/mlb/predictions/shadow-evaluation`
- `/api/mlb/predictions/v6-regeneration`
- `/api/mlb/predictions/v7-regeneration`
- `/api/mlb/predictions/validation`
- `/api/mlb/pregame-starter-evidence`
- `/api/mlb/probable-starters`
- `/api/mlb/projected-scores`
- `/api/mlb/projections`
- `/api/mlb/projections/health`
- `/api/mlb/provider-capabilities/audit`
- `/api/mlb/provider-verification/games-by-date`
- `/api/mlb/research-auth-status`
- `/api/mlb/research-snapshot`
- `/api/mlb/research/approved-props/daily`
- `/api/mlb/research/batter-hits/backtest`
- `/api/mlb/research/batter-total-bases/backtest`
- `/api/mlb/research/game-models/backtest`
- `/api/mlb/research/mcp-health`
- `/api/mlb/research/nrfi/backtest`
- `/api/mlb/research/oddsapi/f5-spread-line-sample`
- `/api/mlb/research/oddsapi/historical-period-discovery`
- `/api/mlb/research/oddsapi/period-spread-line-pilot`
- `/api/mlb/research/oddsapi/period-total-teamtotal-pilot`
- `/api/mlb/research/pitcher-earned-runs/runtime-parity`
- `/api/mlb/research/pitcher-outs/backtest`
- `/api/mlb/research/pitcher-strikeouts/backtest`
- `/api/mlb/research/pitcher-strikeouts/shadow`
- `/api/mlb/research/pitcher-walks/shadow`
- `/api/mlb/stadiums/metadata-cache`
- `/api/mlb/starter-diagnostics`
- `/api/mlb/starter-history`
- `/api/mlb/starter-intelligence`
- `/api/mlb/starters`
- `/api/mlb/starters/health`
- `/api/mlb/starters/sync`
- `/api/mlb/starters/validation`
- `/api/mlb/statcast`
- `/api/mlb/statcast/matchup`
- `/api/mlb/temporal-health`
- `/api/model-learning/overview`
- `/api/model/autotune`
- `/api/model/calibration`
- `/api/model/intelligence`
- `/api/model/learning`
- `/api/model/metrics`
- `/api/model/rollback`
- `/api/model/rollback/history`
- `/api/model/segments`
- `/api/model/self-learning`
- `/api/model/shadow-calibration`
- `/api/model/status`
- `/api/model/versions`
- `/api/nba/adapter/status`
- `/api/nba/data-health`
- `/api/nba/data-quality`
- `/api/nba/data-quality/coverage`
- `/api/nba/data-quality/issues`
- `/api/nba/decision-board`
- `/api/nba/decision-learning`
- `/api/nba/features/preview`
- `/api/nba/features/store`
- `/api/nba/features/validation`
- `/api/nba/goat/audit`
- `/api/nba/goat/props-research`
- `/api/nba/goat/props-shadow-readiness`
- `/api/nba/hoopsapi-preview`
- `/api/nba/learning`
- `/api/nba/markets/multi-book`
- `/api/nba/markets/steam`
- `/api/nba/predictions`
- `/api/nba/predictions/backtest`
- `/api/nba/predictions/backtest/run`
- `/api/nba/predictions/calibration`
- `/api/nba/predictions/generate`
- `/api/nba/predictions/health`
- `/api/nba/predictions/model-health`
- `/api/nba/predictions/performance`
- `/api/nba/predictions/settle`
- `/api/nba/predictions/settle/event/[eventId]`
- `/api/nba/predictions/settlement-backlog`
- `/api/nba/predictions/validate`
- `/api/nba/reconciliation/plan`
- `/api/nba/reconciliation/status`
- `/api/nba/sync`
- `/api/nba/sync/games`
- `/api/nba/sync/injuries`
- `/api/nba/sync/lineups`
- `/api/nba/sync/odds`
- `/api/nba/sync/players`
- `/api/nba/sync/standings`
- `/api/nba/sync/stats`
- `/api/nba/sync/status`
- `/api/nba/sync/teams`
- `/api/ncaab/calibration-shadow`
- `/api/ncaab/learning`
- `/api/ncaab/overview`
- `/api/ncaaf/learning`
- `/api/nfl/features/preview`
- `/api/nfl/features/store`
- `/api/nfl/features/validation`
- `/api/nfl/predictions`
- `/api/nfl/predictions/health`
- `/api/nfl/predictions/validation`
- `/api/nhl/audit`
- `/api/nhl/challenger-research`
- `/api/nhl/espn-goalie-readiness`
- `/api/nhl/exact-circa-market-research`
- `/api/nhl/features/preview`
- `/api/nhl/features/store`
- `/api/nhl/features/validation`
- `/api/nhl/free-main-market-coverage`
- `/api/nhl/frozen-shadow-audit`
- `/api/nhl/late-v6-readiness`
- `/api/nhl/learning`
- `/api/nhl/main-markets-research`
- `/api/nhl/market-goalie-readiness`
- `/api/nhl/overview`
- `/api/nhl/predictions`
- `/api/nhl/predictions/health`
- `/api/nhl/predictions/validation`
- `/api/nhl/special-teams-research`
- `/api/nhl/special-teams-source-probe`
- `/api/observability/runtime`
- `/api/odds`
- `/api/operating-day/[operatingDayId]/settle`
- `/api/operating-day/automation/status`
- `/api/operating-day/execute`
- `/api/operating-day/status`
- `/api/operating-day/validation`
- `/api/operations/adaptive-refresh`
- `/api/operations/adaptive-refresh/status`
- `/api/operations/calibration-shadow`
- `/api/operations/change-events`
- `/api/operations/data-freshness`
- `/api/operations/e2e-integrity`
- `/api/operations/event-lifecycle`
- `/api/operations/event-refresh-plan`
- `/api/operations/health`
- `/api/operations/historical-replay`
- `/api/operations/historical-replay/jobs/[id]`
- `/api/operations/mlb-autonomous-operations`
- `/api/operations/mlb-official-replacement`
- `/api/operations/odds-change-refresh-readiness`
- `/api/operations/odds-primary-authority`
- `/api/operations/odds-shadow-comparison`
- `/api/operations/planner-trace`
- `/api/operations/prediction-coverage`
- `/api/operations/pregame-odds-refresh-sla`
- `/api/operations/provider-budget-forecast`
- `/api/operations/refresh-plan`
- `/api/operations/settlement-guarantee`
- `/api/operations/soccer-ufc-atp`
- `/api/operations/status`
- `/api/operations/validation`
- `/api/parlays`
- `/api/performance`
- `/api/performance/[sport]`
- `/api/performance/daily-update`
- `/api/performance/evolution`
- `/api/performance/goals`
- `/api/performance/history`
- `/api/performance/readiness`
- `/api/performance/report-card`
- `/api/performance/sports`
- `/api/performance/trust`
- `/api/performance/validation`
- `/api/picks/explain`
- `/api/pitchers/seed`
- `/api/play-of-the-day`
- `/api/players/[playerId]/intelligence`
- `/api/portfolio`
- `/api/portfolio-intelligence`
- `/api/portfolio/ai-v2`
- `/api/prediction-engine/v4`
- `/api/prediction-epoch/activation-readiness`
- `/api/prediction-epoch/shadow-readiness`
- `/api/prediction-safety`
- `/api/prediction-sdk`
- `/api/prediction-sdk/validation`
- `/api/predictions/by-sport`
- `/api/predictions/performance`
- `/api/predictions/provenance`
- `/api/predictions/settle`
- `/api/predictions/settle/debug`
- `/api/predictions/top`
- `/api/probability-picks`
- `/api/probability-picks/generate`
- `/api/probability-picks/parlays`
- `/api/probability-picks/preview`
- `/api/probability-picks/validation`
- `/api/production-readiness/audit`
- `/api/projection-evolution`
- `/api/projections`
- `/api/providers/budget/status`
- `/api/providers/capabilities`
- `/api/providers/intelligence`
- `/api/providers/live-verification`
- `/api/providers/route-plan`
- `/api/providers/sdk`
- `/api/providers/sdk/validation`
- `/api/providers/sportsdataio/capabilities`
- `/api/providers/sportsdataio/contract`
- `/api/providers/sportsdataio/discovery`
- `/api/providers/sportsdataio/execution-readiness/validation`
- `/api/providers/sportsdataio/maximization-audit`
- `/api/providers/sportsdataio/nba/approval-packet`
- `/api/providers/sportsdataio/nba/blocker-resolution`
- `/api/providers/sportsdataio/nba/completion-audit`
- `/api/providers/sportsdataio/nba/completion-evidence`
- `/api/providers/sportsdataio/nba/contract-audit`
- `/api/providers/sportsdataio/nba/domain-proof`
- `/api/providers/sportsdataio/nba/evidence-export`
- `/api/providers/sportsdataio/nba/external-blockers`
- `/api/providers/sportsdataio/nba/next-pilot-preflight`
- `/api/providers/sportsdataio/nba/objective-audit`
- `/api/providers/sportsdataio/nba/odds/endpoint-preflight`
- `/api/providers/sportsdataio/nba/odds/readiness`
- `/api/providers/sportsdataio/nba/player-props/endpoint-preflight`
- `/api/providers/sportsdataio/nba/player-props/readiness`
- `/api/providers/sportsdataio/nba/player-stats/migration-preflight`
- `/api/providers/sportsdataio/nba/player-stats/readiness`
- `/api/providers/sportsdataio/nba/production-gate`
- `/api/providers/sportsdataio/nba/production-usage-exclusion`
- `/api/providers/sportsdataio/nba/provider-gate`
- `/api/providers/sportsdataio/nba/readiness`
- `/api/providers/sportsdataio/nba/safe-next-actions`
- `/api/providers/sportsdataio/nba/trial-isolation`
- `/api/providers/sportsdataio/status`
- `/api/providers/sportsdataio/validation`
- `/api/providers/the-odds-api/capability`
- `/api/providers/the-odds-api/capability-audit`
- `/api/providers/the-odds-api/catalog`
- `/api/providers/the-odds-api/coverage`
- `/api/providers/the-odds-api/current-odds`
- `/api/providers/the-odds-api/event-crosswalk`
- `/api/providers/the-odds-api/pitcher-identity`
- `/api/providers/the-odds-api/quota`
- `/api/ratings`
- `/api/recommendation-pipeline/trace`
- `/api/recommendation-readiness`
- `/api/reconciliation/plan`
- `/api/research/mlb/bdl-opening-runline-total-2026-backfill`
- `/api/research/mlb/main-markets-bdl-opening-backfill`
- `/api/research/mlb/main-markets-bdl-opening-probe`
- `/api/research/mlb/ml-opening-consensus-2026-external-backfill`
- `/api/research/pa14/balldontlie-key-status`
- `/api/research/pa14/v2-real-row`
- `/api/results`
- `/api/results/backfill`
- `/api/results/sync`
- `/api/settlement/core`
- `/api/settlement/reconciliation`
- `/api/sharp-money`
- `/api/simulator`
- `/api/simulator/monte-carlo`
- `/api/slate/next/status`
- `/api/soccer/features/preview`
- `/api/soccer/features/store`
- `/api/soccer/features/validation`
- `/api/soccer/learning`
- `/api/soccer/overview`
- `/api/soccer/predictions`
- `/api/soccer/predictions/health`
- `/api/soccer/predictions/validation`
- `/api/sports`
- `/api/sports-analyst/game/[eventId]`
- `/api/sports-shadow/[sport]`
- `/api/sports/[sport]`
- `/api/sports/[sport]/events`
- `/api/sports/[sport]/events/[eventId]`
- `/api/sports/[sport]/injuries`
- `/api/sports/[sport]/leagues`
- `/api/sports/[sport]/lineups`
- `/api/sports/[sport]/markets`
- `/api/sports/[sport]/odds`
- `/api/sports/[sport]/participants`
- `/api/sports/[sport]/providers`
- `/api/sports/[sport]/standings`
- `/api/sports/[sport]/stats`
- `/api/sports/health`
- `/api/sportsbook-intelligence`
- `/api/sync/reliability`
- `/api/system/pick2/r1f-manifest-authority`
- `/api/system/version`
- `/api/table-tennis/learning`
- `/api/table-tennis/overview`
- `/api/team-stats`
- `/api/team-stats/recalculate`
- `/api/team-stats/sync`
- `/api/tennis/features/preview`
- `/api/tennis/features/store`
- `/api/tennis/features/validation`
- `/api/tennis/predictions`
- `/api/tennis/predictions/health`
- `/api/tennis/predictions/validation`
- `/api/tennis/source-health`
- `/api/test-providers`
- `/api/ufc/features/preview`
- `/api/ufc/features/store`
- `/api/ufc/features/validation`
- `/api/ufc/learning`
- `/api/ufc/overview`
- `/api/ufc/predictions`
- `/api/ufc/predictions/health`
- `/api/ufc/predictions/validation`
- `/api/user/session-bridge`
- `/api/user/wagers`
- `/api/user/wagers/[id]`
- `/api/user/wagers/export`
- `/api/user/wagers/summary`
- `/api/weather/seed`
- `/arbitrage`
- `/autonomous-daily-ai`
- `/best-value`
- `/betting-workbench`
- `/closing-line-intelligence`
- `/dashboard`
- `/data-coverage`
- `/data-coverage/[sport]`
- `/data-health`
- `/edge-lab`
- `/game-intelligence`
- `/game-intelligence/[eventId]`
- `/login`
- `/market-intelligence`
- `/mcp`
- `/mission-control`
- `/mlb`
- `/mlb-learning`
- `/mlb-operations`
- `/mlb-value-board`
- `/mlb/overview`
- `/model`
- `/model-lab`
- `/most-likely`
- `/nba`
- `/nba-decision-board`
- `/nba-hoopsapi-preview`
- `/nba-learning`
- `/nba-market-data`
- `/ncaab`
- `/ncaab-learning`
- `/ncaaf`
- `/ncaaf-learning`
- `/nhl`
- `/nhl-learning`
- `/page.tsx`
- `/performance`
- `/player-projections`
- `/player-projections/[projectionId]`
- `/portfolio-intelligence`
- `/probability-picks`
- `/projections`
- `/qualified-plays`
- `/register`
- `/settings`
- `/soccer`
- `/soccer-learning`
- `/sports`
- `/sports-center`
- `/sports-center/[sport]`
- `/sports-shadow/[sport]`
- `/table-tennis`
- `/table-tennis-learning`
- `/today`
- `/ufc`
- `/ufc-learning`

## Lectores que mencionan estadísticas históricas

Índice estático. La coincidencia de texto señala dónde inspeccionar la transformación, no una certificación del algoritmo.

| Archivo | Indicadores en el código |
|---|---|
| `src/lib/edge-lab/engines.mjs` | local/visitante |
| `src/lib/edge-lab/tt-odd-even-temporal-audit.mjs` | calibración/holdout |
| `src/lib/nba/decision-archived-final-core.mjs` | minutos |
| `src/lib/nba/decision-board-core.mjs` | L5, L10, período, minutos |
| `src/lib/nba/decision-learning-core.mjs` | L5, L10, calibración/holdout, minutos |
| `src/lib/nba/decision-preference-core.mjs` | L5, L10, minutos |
| `src/lib/nba/goat-calibration-core.mjs` | calibración/holdout |
| `src/lib/nba/goat-props-shadow-core.mjs` | L5, calibración/holdout |
| `src/lib/nba/goat-team-stats-core.mjs` | local/visitante |
| `src/lib/ncaab-prospective-calibration-evaluation.mjs` | calibración/holdout |
| `src/lib/nhl-challenger-freeze-core.mjs` | calibración/holdout |
| `src/lib/nhl-challenger-poisson-core.mjs` | calibración/holdout |
| `src/lib/nhl-late-v6-core.mjs` | calibración/holdout |
| `src/lib/nhl-main-markets-research-core.mjs` | L5, calibración/holdout |
| `src/lib/nhl-v6-prospective-validation.mjs` | calibración/holdout |
| `src/services/ai-learning-lifecycle.service.ts` | calibración/holdout |
| `src/services/autonomous-daily-operations.service.ts` | calibración/holdout |
| `src/services/basketball-source-framework.service.ts` | ritmo/eficiencia |
| `src/services/explainable-intelligence.service.ts` | calibración/holdout |
| `src/services/historical-feature-generation.service.ts` | calibración/holdout |
| `src/services/historical-shadow-calibration.service.ts` | calibración/holdout |
| `src/services/mlb-04c-chat-method-research-scorecard.service.ts` | L5, L10 |
| `src/services/mlb-04d-forward-research-ledger-result-evaluation.service.ts` | L3 |
| `src/services/mlb-ai-coach.service.ts` | titular |
| `src/services/mlb-approved-additional-prop-parity.service.ts` | calibración/holdout |
| `src/services/mlb-approved-prop-daily-evaluation.service.ts` | calibración/holdout |
| `src/services/mlb-batter-hits-backtest.service.ts` | L10, calibración/holdout |
| `src/services/mlb-batter-total-bases-backtest.service.ts` | L10, calibración/holdout |
| `src/services/mlb-calibration-shadow-v1.service.ts` | calibración/holdout |
| `src/services/mlb-causal-learning-readiness.service.ts` | calibración/holdout |
| `src/services/mlb-context-lineage.service.ts` | L5, L10 |
| `src/services/mlb-exact-line-forward-shadow.service.ts` | L5 |
| `src/services/mlb-game-models-backtest-v2.service.ts` | calibración/holdout |
| `src/services/mlb-game-models-backtest.service.ts` | calibración/holdout |
| `src/services/mlb-learning-brain.service.ts` | L5, L10 |
| `src/services/mlb-missing-intelligence.service.ts` | titular |
| `src/services/mlb-model-platform.service.ts` | descanso/viaje |
| `src/services/mlb-moneyline-forward-freeze.service.ts` | L5, L10 |
| `src/services/mlb-nrfi-backtest.service.ts` | calibración/holdout |
| `src/services/mlb-pitcher-outs-backtest.service.ts` | L5, calibración/holdout |
| `src/services/mlb-pitcher-strikeout-backtest.service.ts` | calibración/holdout |
| `src/services/mlb-pitcher-win-forward-numeric.service.ts` | L5, L10, descanso/viaje |
| `src/services/mlb-player-projection-engine.service.ts` | calibración/holdout |
| `src/services/mlb-provider-capability-audit.service.ts` | titular |
| `src/services/mlb-runline-home-p15-alt-forward-freeze.service.ts` | L5 |
| `src/services/mlb-team-stats-sync.service.ts` | L5, L10 |
| `src/services/multisport-learning-evaluator.service.ts` | calibración/holdout |
| `src/services/multisport-learning-overview.service.ts` | calibración/holdout |
| `src/services/nba-adapter.service.ts` | ritmo/eficiencia, descanso/viaje |
| `src/services/nba-causal-learning.service.ts` | calibración/holdout |
| `src/services/nba-causal-v3-matchup.service.ts` | ritmo/eficiencia |
| `src/services/nba-decision-board.service.ts` | minutos |
| `src/services/nba-decision-learning.service.ts` | minutos |
| `src/services/nba-goat-props-shadow-readiness.service.ts` | calibración/holdout |
| `src/services/nba-goat-research-capture.service.ts` | minutos |
| `src/services/nba-prediction-settlement.service.ts` | período |
| `src/services/ncaab-causal-learning.service.ts` | calibración/holdout |
| `src/services/ncaaf-causal-learning.service.ts` | calibración/holdout |
| `src/services/nfl-balldontlie-historical-readiness.service.ts` | calibración/holdout |
| `src/services/nhl-causal-learning.service.ts` | calibración/holdout |
| `src/services/nhl-challenger-frozen-ledger-audit.service.ts` | calibración/holdout |
| `src/services/nhl-late-v6-readiness.service.ts` | calibración/holdout |
| `src/services/nhl-main-markets-research.service.ts` | calibración/holdout |
| `src/services/nhl-poisson-challenger-audit.service.ts` | calibración/holdout |
| `src/services/player-intelligence.service.ts` | L5, L10 |
| `src/services/prospective-official-eligibility-gate.service.ts` | calibración/holdout |
| `src/services/recommendation-eligibility-policy.service.ts` | calibración/holdout |
| `src/services/retrosheet-historical-feature-store.service.ts` | L5, L10, L20 |
| `src/services/soccer-causal-learning.service.ts` | calibración/holdout |
| `src/services/sportsdataio-historical-import-readiness.service.ts` | titular |
| `src/services/sportsdataio-mlb-discovery.service.ts` | titular |
| `src/services/sportsdataio-mlb-prospective-preview.service.ts` | L5, L10, local/visitante, descanso/viaje |
| `src/services/team-stats-calculator.service.ts` | L5, L10 |
| `src/services/tt-causal-learning.service.ts` | calibración/holdout |
| `src/services/ufc-causal-learning.service.ts` | calibración/holdout |

## Archivos históricos versionados por directorio

Conteo de archivos rastreados en la base auditada.

- `data/` · 1 archivos
- `research/` · 82 archivos
- `artifacts/` · 99 archivos
- `contracts/` · 18 archivos
- `config/` · 1 archivos
- `supabase/migrations/` · 141 archivos
- `.github/workflows/` · 88 archivos
