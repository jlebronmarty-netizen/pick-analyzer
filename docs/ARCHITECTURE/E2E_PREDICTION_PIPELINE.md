# E2E Prediction Pipeline

P1.2 maps the current Pick Analyzer pipeline without changing model behavior.

## Canonical Pipeline

EVENT -> MARKET DATA -> FEATURES -> PREDICTION ENGINE -> PREDICTION PERSISTENCE -> PRODUCT SURFACES -> AUTHORITATIVE RESULT -> SETTLEMENT -> LEARNING EVIDENCE -> PERFORMANCE -> MISSION CONTROL

| Stage | Canonical persistence | Primary repository path | Status |
| --- | --- | --- | --- |
| Event discovery | `sport_events` | `src/services/sportsdataio-mlb-prospective-preview.service.ts`, `src/services/dashboard-today.service.ts`, `src/services/current-board.service.ts` | Canonical stored event rows |
| Market data | `sports_odds_snapshots` | `src/services/sportsdataio-mlb-prospective-preview.service.ts`, `src/services/current-board.service.ts` | Canonical stored odds snapshots |
| Features | `feature_snapshots`, `prediction_history.feature_snapshot_id` | `src/services/feature-store-core.service.ts`, sport feature-store services | Partially versioned |
| Prediction engine | `prediction_history.model_version` | `src/services/sport-prediction-engine-sdk.service.ts`, sport-specific prediction engines | Multiple visible engines |
| Prediction persistence | `prediction_history` | `src/services/sportsdataio-mlb-prospective-preview.service.ts`, `src/services/prediction-history.service.ts` | Canonical row store |
| Product surfaces | API response contracts | `src/services/current-board.service.ts`, `src/services/dashboard-today.service.ts`, `src/services/performance-scope-v2.service.ts` | Views over stored rows |
| Results | `game_results`, event scores/status | result sync and settlement services | Canonical result evidence required |
| Settlement | `prediction_history.status/result/settled_at/settlement_details` | `src/services/prediction-settlement.service.ts`, `src/services/settlement-guarantee.service.ts` | Production rows only |
| Learning | settled production prediction evidence | `src/services/model-learning.service.ts`, `src/services/ai-learning-lifecycle.service.ts` | Read after settlement |
| Performance | `prediction_history` production scope | `src/services/performance-scope-v2.service.ts` | Production scope with explicit non-production counts |
| Mission Control | docs and operations APIs | `src/services/mission-control.service.ts`, `docs/MISSION_CONTROL/*` | Operational status layer |

## Prediction-Producing Paths

| Path | File/service | Scope | Persistence | Classification |
| --- | --- | --- | --- | --- |
| MLB prospective preview | `src/services/sportsdataio-mlb-prospective-preview.service.ts` | MLB moneyline/run line/total preview rows | `prediction_history` | Preview/quarantined unless production gate approves |
| Shared sport SDK | `src/services/sport-prediction-engine-sdk.service.ts` | Multi-sport prediction construction | callers persist | Canonical engine utility |
| MLB prediction engine | `src/services/mlb-prediction-engine.service.ts` | MLB preview/validation | preview response | Engine path, not primary Current Board source |
| NBA/NFL/NHL/Soccer/Tennis/UFC engines | `src/services/*-prediction-engine.service.ts` | Sport-specific prediction surfaces | mixed | Parallel sport engines, must remain scope-labeled |
| Stored preview lifecycle | `src/services/stored-preview-prediction-lifecycle.service.ts` | Stored preview rows | `prediction_history` | Shadow/preview isolation |
| Historical replay/backtest paths | historical and release scripts/services | Replay/backtest only | separated artifacts/tables | Not production |

## Surface Reconciliation

| Surface | Route/UI | Canonical prediction source | Notes |
| --- | --- | --- | --- |
| Homepage | `/`, `src/components/home/HomeBettingPlan.tsx` | `/api/dashboard/today` and Current Board-derived selectors | Decision view only |
| Dashboard Today | `/api/dashboard/today` | `getCurrentBoardCached`, event rows, odds coverage | Primary current-day contract |
| Dashboard | `/dashboard` | dashboard services and Today contract | Broader operational UI |
| Current Board | `/api/current-board` | `prediction_history` plus `sports_odds_snapshots` | Canonical market candidate view |
| Most Likely | `/api/market-opportunities/most-likely` | Current Board / market opportunity suite | Specialized ranking view |
| Best Value | `/api/market-opportunities/best-value` | Current Board / best-value scanner | Specialized EV view |
| AI Bet Finder | `/api/ai-bet-finder` | Current Board, opportunity scanners, top picks | Aggregated view, no LLM requirement |
| Betting Workbench | `/betting-workbench` | Current Board candidates plus user ledger | User workflow, not model source |
| Game Intelligence | `/api/games/[eventId]/intelligence` | stored event and prediction evidence | Event drilldown |
| Performance | `/api/performance` | `performance-scope-v2` over `prediction_history` | Production scope with non-production reconciliation |
| MLB Operations | `/mlb-operations` | operations/status/refresh/settlement APIs | Operational view |
| Mission Control | `/api/mission-control` | status docs plus operations APIs | Program control |

No product surface should silently create a separate prediction truth. Specialized views may rank or summarize the canonical persisted rows, but they must label preview, shadow, replay, non-production and production scopes separately.

## P2.1 Supported-Market Coverage

P2.1A supersedes the selection-level wording for production evaluation. Current V2 production prediction coverage is reconciled by canonical event-market prediction, while provider-side selections remain contextual evidence. For the certified eight-game MLB slate, `/api/operations/prediction-coverage` separates 48 provider selections from 24 canonical predictions.

## P2.2A Performance Presentation

Performance presentation uses `performance_presentation_metrics_v1` to avoid treating total analyzed rows as canonical predictions. Current Era defaults show Total Analyzed, Canonical Predictions, Non-production Analysis, Recommendation Eligible and Settled separately. Historical evidence remains separate from Current V2 defaults.

## Policy Boundary

P1.1 proved that 45 valid pregame rows from `2026-08-02` were quarantined preview rows. P1.2 does not retroactively promote them. The unresolved policy question is whether production evaluation should include all valid pregame predictions or only rows that also pass recommendation/production gates.

Current repository evidence supports this finding:

`POLICY_CONFLICT_REQUIRES_HUMAN_APPROVAL`

Changing the answer would alter Performance history and must be handled as a separate approved policy phase.
