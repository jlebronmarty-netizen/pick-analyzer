# Master Roadmap

This roadmap is dependency-aware and based on repository inspection. A module is marked completed only when the repository contains service/API/dashboard/persistence evidence and recent verification supports it.

## Dependency Reasoning

The project already has a broad dashboard, core prediction services, multi-sport registry, provider adapters, provider intelligence, global data quality planning, NBA sync, NBA prediction generation, NBA validation/settlement, NBA backtesting/calibration, a read-only NBA data quality planner, stored-odds multi-book comparison, stored-odds steam detection, Feature Store Core, Multi-Sport Feature Registry and a Shared Sport Prediction Engine SDK. The next safest work is provider-independent sport engine architecture, not provider-backed reconciliation or another model rewrite.

Provider-dependent modules such as historical reconciliation execution, injuries, expected lineups and props should wait until reliable provider sources, credentials and quota caps are approved. Sport engines should be built from normalized events, participants, odds and Feature Store snapshots, with real-data validation and historical calibration explicitly pending until actual data exists.

## Completed

### Core Dashboard And API Shell

Status: Completed.

Evidence: `src/app/dashboard/page.tsx`, dashboard panels in `src/components/dashboard`, and 100 API route files under `src/app/api`.

### Multi-Sport Engine

Status: Completed foundation.

Evidence: `docs/multi-sport-engine.md`, `src/config/sports.config.ts`, `src/types/multi-sport.ts`, `src/services/multi-sport-*.service.ts`, `/api/sports/*` routes and dashboard panels.

### Prediction Engine V4 And Shared Intelligence

Status: Completed foundation.

Evidence: `src/utils/prediction-engine-v4.ts`, `src/services/prediction-engine-v4.service.ts`, Kelly, Smart Ranking, Adaptive Scoring, model learning, risk grade, Monte Carlo and portfolio services.

### NBA Data Sync V1

Status: Completed and production-readiness verified for safe incremental behavior.

Evidence: `docs/nba-data-sync-v1.md`, `src/services/nba-data-sync.service.ts`, NBA sync API routes, NBA sync panel and migrations `202607110001` and `202607110002`.

### NBA Prediction Engine V1

Status: Completed architecture and build verified.

Evidence: `src/services/nba-prediction-engine.service.ts`, NBA prediction APIs and `NbaPredictionEnginePanel`. Current provider data may produce zero candidates when no NBA events/odds are available.

### NBA Prediction Validation & Settlement V1

Status: Completed and production-readiness verified for empty/no-op provider state.

Evidence: `docs/nba-prediction-validation-settlement-v1.md`, `src/services/nba-prediction-validation.service.ts`, `src/services/nba-prediction-settlement.service.ts`, NBA validation/settlement/performance/model-health/backlog APIs and migration `202607110003`.

### NBA Backtesting & Calibration V1

Status: Completed and build verified.

Evidence: `docs/nba-backtesting-calibration-v1.md`, `src/services/nba-backtesting-calibration.service.ts`, `/api/nba/predictions/backtest`, `/api/nba/predictions/backtest/run`, `/api/nba/predictions/calibration` and `NbaBacktestingCalibrationPanel`.

### NBA Data Quality And Historical Reconciliation Phase A

Status: Completed and build verified.

Evidence: `docs/nba-data-quality-reconciliation-phase-a.md`, `src/services/nba-data-quality.service.ts`, `/api/nba/data-quality`, `/api/nba/data-quality/issues`, `/api/nba/data-quality/coverage`, `/api/nba/reconciliation/plan`, `/api/nba/reconciliation/status` and `NbaDataQualityPanel`.

### NBA Multi-Book Comparison V1

Status: Completed stored-data architecture and build verified.

Evidence: `docs/nba-multi-book-comparison-v1.md`, `src/services/nba-multi-book-comparison.service.ts`, `/api/nba/markets/multi-book` and `NbaMultiBookComparisonPanel`.

Note: The module returns a typed empty response when no NBA odds snapshots exist. Real best-price opportunity volume depends on future stored odds coverage.

### NBA Steam Move Detection V1

Status: Completed stored-data architecture and build verified.

Evidence: `docs/nba-steam-move-detection-v1.md`, `src/services/nba-steam-move-detection.service.ts`, `/api/nba/markets/steam` and `NbaSteamMovePanel`.

Note: The module returns typed empty or insufficient-history responses when stored NBA odds snapshots are unavailable or too shallow. Real steam signals depend on future repeated stored odds snapshots.

### Provider Intelligence V1

Status: Completed provider-independent architecture and build verified.

Evidence: `docs/provider-intelligence-v1.md`, `src/services/provider-intelligence.service.ts`, `/api/providers/intelligence`, `/api/providers/capabilities`, `/api/providers/route-plan` and `ProviderIntelligencePanel`.

Note: The module uses static registry and environment configuration only. It makes zero provider calls and supports dry-run routing decisions.

### Global Data Quality Framework V1

Status: Completed provider-independent architecture and build verified.

Evidence: `docs/global-data-quality-framework-v1.md`, `src/services/global-data-quality.service.ts`, `/api/data-quality/global`, `/api/reconciliation/plan` and `GlobalDataQualityPanel`.

Note: The module is read-only and dry-run only. It identified stored-state issues and estimated provider calls without executing any provider work.

### API Contract Hardening V1

Status: Completed representative adoption and build verified.

Evidence: `docs/api-contract-hardening-v1.md`, `src/lib/api-contract.ts`, hardened provider intelligence routes, hardened global data quality routes and typed bad-request validation.

Note: This is a gradual adoption layer, not a risky whole-repository route rewrite.

### Runtime Observability V1

Status: Completed read-only aggregation and build verified.

Evidence: `docs/runtime-observability-v1.md`, `src/services/runtime-observability.service.ts`, `/api/observability/runtime` and `RuntimeObservabilityPanel`.

Note: The module uses existing storage only. Persisted request-duration and warning-event history are future additive enhancements.

### Sync Reliability Framework V1

Status: Completed additive framework and build verified.

Evidence: `docs/sync-reliability-framework-v1.md`, `src/services/sync-reliability.service.ts`, `/api/sync/reliability` and `SyncReliabilityPanel`.

Note: The framework is available for incremental adoption. Existing provider-backed sync flows were not mass-rewritten.

### Prediction Safety Framework V1

Status: Completed additive framework and build verified.

Evidence: `docs/prediction-safety-framework-v1.md`, `src/services/prediction-safety.service.ts`, `/api/prediction-safety` and `PredictionSafetyPanel`.

Note: NBA Prediction Validation V1 remains unchanged. The generic safety checks are available for incremental adoption and future sports.

### Settlement Core V2

Status: Completed additive framework and build verified.

Evidence: `docs/settlement-core-v2.md`, `src/services/settlement-core.service.ts`, `/api/settlement/core` and `SettlementCorePanel`.

Note: NBA Prediction Settlement V1 remains unchanged. Shared settlement primitives are available for incremental adoption.

### Model Metrics Framework V1

Status: Completed computed framework and build verified.

Evidence: `docs/model-metrics-framework-v1.md`, `src/services/model-metrics-framework.service.ts`, `/api/model/metrics` and `ModelMetricsFrameworkPanel`.

Note: Metrics are computed from stored `prediction_history`. Persisted metric snapshots are future optional work.

### Historical Import Engine Core V1

Status: Completed provider-independent architecture and build verified.

Evidence: `docs/historical-import-engine-core-v1.md`, `src/services/historical-import-engine.service.ts`, `/api/historical-import/plan`, `/api/historical-import/health`, `/api/historical-import/jobs` and `HistoricalImportEnginePanel`.

Note: The module is dry-run only. It plans season/date-range checkpoints, idempotency, deduplication, provider routing and quota estimates without external provider calls or migrations.

### Provider Adapter SDK V1

Status: Completed provider-independent architecture and build verified.

Evidence: `docs/provider-adapter-sdk-v1.md`, `src/services/provider-adapter-sdk.service.ts`, `/api/providers/sdk`, `/api/providers/sdk/validation` and `ProviderAdapterSdkPanel`.

Note: The module defines provider contracts, capability declarations, auth shape, pagination, rate-limit hints, retry hints, normalization rules and fixture validation without external provider calls.

### SportsDataIO Adapter Contract V1

Status: Completed contract-only architecture and build verified.

Evidence: `docs/sportsdataio-adapter-contract-v1.md`, `src/services/sportsdataio-adapter-contract.service.ts`, `/api/providers/sportsdataio/contract`, `/api/providers/sportsdataio/validation` and `SportsDataIoContractPanel`.

Note: The module maps SportsDataIO-style concepts into Provider Adapter SDK contracts and normalized models. Live calls are disabled, credentials are not required, and validation uses local fixtures only.

### SportsDataIO Historical Import Execution Readiness V1

Status: Completed execution architecture and deterministic validation.

Evidence: `docs/sportsdataio-historical-import-execution-readiness-v1.md`, `src/services/sportsdataio-runtime-adapter.service.ts`, `src/services/sportsdataio-historical-import-readiness.service.ts`, `/api/providers/sportsdataio/status`, `/api/providers/sportsdataio/capabilities`, `/api/historical-import/execute`, `/api/historical-import/resume`, `/api/historical-import/cancel`, `/api/historical-import/jobs/[jobId]`, `/api/historical-import/pilot-plan`, `/api/historical-import/validate/[jobId]` and `HistoricalImportEnginePanel`.

Note: The module prepares server-only SportsDataIO execution architecture with hard caps, dry-run defaults, resume/cancel contracts, validation contracts, pilot planning and dashboard guardrails. The initial 401 on `GamesByDate` was resolved during NBA Pilot Import V1. Completion labels are `EXECUTION_ARCHITECTURE_COMPLETE`, `DETERMINISTIC_VALIDATION_COMPLETE`, `LIVE_PROVIDER_VALIDATION_COMPLETE` and `PILOT_IMPORT_COMPLETE_FOR_APPROVED_TRIAL_SCOPE`.

### SportsDataIO NBA Pilot Import V1

Status: Completed capped live trial import and build verified.

Evidence: `docs/sportsdataio-nba-pilot-import-v1.md`, `src/services/sportsdataio-historical-import-readiness.service.ts`, `/api/historical-import/execute`, `/api/historical-import/jobs`, `/api/nba/data-quality`, `/api/nba/features/preview` and `/api/nba/predictions`.

Note: The module validated SportsDataIO `Teams` and `GamesByDate/2025-DEC-25` with 2 external calls, fetched 35 trial/scrambled records, updated 30 existing NBA team rows with SportsDataIO pilot provenance, inserted 35 provider mappings, inserted 5 trial events, persisted 4 completed scores and recorded sync-job observability. Trial events and mappings are marked `trial=true`, `scrambled=true` and `production_eligible=false`; NBA prediction generation and validation exclude them from production predictions. Completion labels are `EXECUTION_ARCHITECTURE_COMPLETE`, `LIVE_PROVIDER_VALIDATION_COMPLETE`, `PILOT_IMPORT_COMPLETE`, `TRIAL_DATA_ISOLATION_COMPLETE` and `REAL_DATA_RECONCILIATION_PENDING`.

### SportsDataIO NBA Pilot Import V2

Status: Completed capped live trial verification and build verified.

Evidence: `docs/sportsdataio-nba-pilot-import-v2.md`, `src/services/sportsdataio-historical-import-readiness.service.ts`, `/api/historical-import/execute`, `/api/historical-import/jobs`, `/api/nba/data-quality`, `/api/nba/data-quality/coverage` and `/api/nba/features/preview`.

Note: The V2 verification rerun for `2025-DEC-26` used 4 external calls and reached GamesByDate, standings, team season stats and team game stats. It fetched 87 records, normalized 87 records, inserted 18 game-stat rows, updated existing events, standings, team stats and mappings idempotently, skipped 0 records, recorded 0 errors and completed the latest sync job. Trial rows remain `trial=true`, `scrambled=true` and `production_eligible=false`; production prediction queries returned zero trial leaks. Completion labels are `EXECUTION_ARCHITECTURE_COMPLETE`, `LIVE_PROVIDER_VALIDATION_COMPLETE`, `PILOT_IMPORT_COMPLETE`, `TRIAL_DATA_ISOLATION_COMPLETE`, `GAME_STATS_PERSISTENCE_COMPLETE` and `REAL_DATA_RECONCILIATION_PENDING`.

### SportsDataIO NBA Injuries Pilot V1

Status: Completed capped live trial import and build verified.

Evidence: `docs/sportsdataio-nba-injuries-pilot-v1.md`, `src/services/sportsdataio-historical-import-readiness.service.ts`, `/api/historical-import/execute`, `/api/nba/data-quality`, `/api/nba/features/preview` and `/api/nba/predictions/health`.

Note: The successful import execution called `/v3/nba/projections/json/InjuredPlayers` once, fetched 6 trial/scrambled records, normalized 6 injuries, inserted 6 `sport_injuries` rows, inserted 6 injury provider mappings, skipped 0 records, preserved 2 unresolved players and 2 unresolved teams as warnings and recorded 0 row errors. Injury and mapping rows carry `source=sportsdataio`, `trial=true`, `scrambled=true`, `production_eligible=false` and `importModule=sportsdataio_nba_injuries_pilot_v1`. Completion labels are `LIVE_PROVIDER_VALIDATION_COMPLETE`, `INJURY_PERSISTENCE_COMPLETE`, `TRIAL_DATA_ISOLATION_COMPLETE` and `PRODUCTION_CONFIDENCE_LEAKAGE_BLOCKED`.

### NBA Injury and Lineup Confidence Integration V1

Status: Completed provider-independent integration and build verified.

Evidence: `docs/nba-injury-lineup-confidence-integration-v1.md`, `src/services/nba-injury-lineup-confidence.service.ts`, enriched `src/services/nba-feature-store-integration.service.ts`, `src/services/nba-prediction-engine.service.ts`, `src/services/prediction-safety.service.ts`, `src/services/nba-prediction-settlement.service.ts`, `NbaFeatureStoreIntegrationPanel` and `NbaPredictionEnginePanel`.

Note: The module consumes stored `sport_injuries` rows and static provider configuration state only. Trial/scrambled injuries cannot improve production confidence, stale/unresolved rows create warnings and penalties, missing lineups remain explicit unavailable context, no predictions are persisted and no provider calls are made.

### SportsDataIO NBA Players Pilot V1

Status: Completed capped live trial import and build verified.

Evidence: `docs/sportsdataio-nba-players-pilot-v1.md`, `src/services/sportsdataio-historical-import-readiness.service.ts`, `/api/historical-import/execute`, `/api/nba/data-quality`, `/api/nba/features/preview` and `/api/nba/predictions/health`.

Note: The successful import execution called `Players` once, fetched 579 trial/scrambled records, normalized 579 players, inserted 579 `sport_players` rows, inserted 579 player provider mappings, skipped 0 records and recorded 0 row errors. Player and mapping rows carry `source=sportsdataio`, `trial=true`, `scrambled=true`, `production_eligible=false` and `importModule=sportsdataio_nba_players_pilot_v1`. The module also hardened Supabase preflight reads by chunking large `.in()` requests. Completion labels are `LIVE_PROVIDER_VALIDATION_COMPLETE`, `PLAYER_MAPPING_PERSISTENCE_COMPLETE`, `TRIAL_DATA_ISOLATION_COMPLETE` and `PROP_AND_LINEUP_USAGE_BLOCKED`.

### SportsDataIO NBA Depth Charts And Starting Lineups Pilot V1

Status: Live endpoint validation complete; persistence blocked by payload-shape normalization.

Evidence: `docs/sportsdataio-nba-depth-lineups-pilot-v1.md`, `src/services/sportsdataio-historical-import-readiness.service.ts`, `src/services/nba-injury-lineup-confidence.service.ts` and `supabase/migrations/202607130001_sport_lineups_depth_charts_v1.sql`.

Note: The guarded execution path is implemented for `/v3/nba/scores/json/DepthCharts` and `/v3/nba/projections/json/StartingLineupsByDate/2025-DEC-26`, with a maximum of 2 external calls, trial isolation, no prediction persistence, no backtesting and no model training. The `sport_lineups` migration is applied remotely and the service now upserts lineup/depth relationship rows by `sport_lineups.id`. The capped live run returned HTTP 200 for both approved endpoints and fetched 39 trial/scrambled records, but current normalizers produced 0 persistable rows and skipped all 39 records. No lineup/depth rows were inserted, no production confidence improved and provider payload-shape follow-up is required before another live execution.

### Feature Store Core V1

Status: Completed computed architecture and build verified.

Evidence: `docs/feature-store-core-v1.md`, `src/services/feature-store-core.service.ts`, `/api/features/store`, `/api/features/store/definitions`, `/api/features/store/validation` and `FeatureStoreCorePanel`.

Note: The module defines versioned feature definitions, computed pre-event snapshots, freshness, provenance, sample size, data quality, cutoff timestamps, invalidation keys and deterministic leakage validation without persistence or provider calls.

### Multi-Sport Feature Registry V1

Status: Completed provider-independent registry and build verified.

Evidence: `docs/multi-sport-feature-registry-v1.md`, `src/services/multi-sport-feature-registry.service.ts`, `/api/features/registry`, `/api/features/registry/lookup`, `/api/features/registry/validation` and `MultiSportFeatureRegistryPanel`.

Note: The module maps feature definitions into sport, market and model-specific feature sets with readiness states and fallback policies. Unsupported sport-specific feature domains remain explicit warnings.

### NBA Feature Store Integration V1

Status: Completed read-only integration and build verified.

Evidence: `docs/nba-feature-store-integration-v1.md`, `src/services/nba-feature-store-integration.service.ts`, `/api/nba/features/store`, `/api/nba/features/preview`, `/api/nba/features/validation` and `NbaFeatureStoreIntegrationPanel`.

Note: The module validates NBA feature-set compatibility with Feature Store Core and existing `prediction_history.feature_snapshot` without changing NBA prediction generation or requiring a migration.

### Shared Sport Prediction Engine SDK V1

Status: Completed provider-independent architecture and deterministic validation verified.

Evidence: `docs/shared-sport-prediction-engine-sdk-v1.md`, `src/services/sport-prediction-engine-sdk.service.ts`, `/api/prediction-sdk`, `/api/prediction-sdk/validation` and `SportPredictionSdkPanel`.

Note: The module defines reusable sport engine strategy, normalized input/output, market capability, probability, fair odds, edge, expected value, confidence, uncertainty, recommendation, explanation, warning, Kelly, Smart Ranking, Monte Carlo, persistence, settlement and model health contracts. Completion labels are `ARCHITECTURE_COMPLETE`, `DETERMINISTIC_VALIDATION_COMPLETE`, `REAL_DATA_VALIDATION_PENDING` and `HISTORICAL_CALIBRATION_PENDING`.

### MLB Feature Store Integration V1

Status: Completed provider-independent integration and build verified.

Evidence: `docs/mlb-feature-store-integration-v1.md`, `src/services/mlb-feature-store-integration.service.ts`, `/api/mlb/features/store`, `/api/mlb/features/preview`, `/api/mlb/features/validation` and `MlbFeatureStoreIntegrationPanel`.

Note: The module validates MLB Feature Store compatibility without provider calls or migrations. The MLB moneyline feature set remains `partial` because probable pitcher, confirmed lineup, weather, park-factor and advanced-stat domains are explicit missing-domain warnings. Completion labels are `ARCHITECTURE_COMPLETE`, `DETERMINISTIC_VALIDATION_COMPLETE`, `REAL_DATA_VALIDATION_PENDING` and `HISTORICAL_CALIBRATION_PENDING`.

### MLB Prediction Engine V1

Status: Completed provider-independent architecture and deterministic validation verified.

Evidence: `docs/mlb-prediction-engine-v1.md`, `src/services/mlb-prediction-engine.service.ts`, `/api/mlb/predictions`, `/api/mlb/predictions/health`, `/api/mlb/predictions/validation` and `MlbPredictionEnginePanel`.

Note: The module produces deterministic moneyline, spread/run line and total previews through the Shared Sport Prediction Engine SDK. It does not persist picks, consume provider calls or claim production betting readiness. Completion labels are `ARCHITECTURE_COMPLETE`, `DETERMINISTIC_VALIDATION_COMPLETE`, `REAL_DATA_VALIDATION_PENDING` and `HISTORICAL_CALIBRATION_PENDING`.

### NFL Feature Store Integration V1

Status: Completed provider-independent integration and build verified.

Evidence: `docs/nfl-feature-store-integration-v1.md`, `src/services/nfl-feature-store-integration.service.ts`, `/api/nfl/features/store`, `/api/nfl/features/preview`, `/api/nfl/features/validation` and `NflFeatureStoreIntegrationPanel`.

Note: The module validates NFL Feature Store compatibility without provider calls or migrations. The NFL spread feature set remains `partial` because quarterback impact, injury impact, weather and rest/travel domains are explicit missing-domain warnings. Completion labels are `ARCHITECTURE_COMPLETE`, `DETERMINISTIC_VALIDATION_COMPLETE`, `REAL_DATA_VALIDATION_PENDING` and `HISTORICAL_CALIBRATION_PENDING`.

### NFL Prediction Engine V1

Status: Completed provider-independent architecture and deterministic validation verified.

Evidence: `docs/nfl-prediction-engine-v1.md`, `src/services/nfl-prediction-engine.service.ts`, `/api/nfl/predictions`, `/api/nfl/predictions/health`, `/api/nfl/predictions/validation` and `NflPredictionEnginePanel`.

Note: The module produces deterministic moneyline, spread, total and first-half previews through the Shared Sport Prediction Engine SDK. It does not persist picks, consume provider calls or claim production betting readiness. Completion labels are `ARCHITECTURE_COMPLETE`, `DETERMINISTIC_VALIDATION_COMPLETE`, `REAL_DATA_VALIDATION_PENDING` and `HISTORICAL_CALIBRATION_PENDING`.

### Soccer Feature Store Integration V1

Status: Completed provider-independent integration and build verified.

Evidence: `docs/soccer-feature-store-integration-v1.md`, `src/services/soccer-feature-store-integration.service.ts`, `/api/soccer/features/store`, `/api/soccer/features/preview`, `/api/soccer/features/validation` and `SoccerFeatureStoreIntegrationPanel`.

Note: The module validates soccer Feature Store compatibility without provider calls or migrations. The soccer moneyline feature set remains `partial` because draw-aware context, league strength, confirmed lineup and injury domains are explicit missing-domain warnings. Completion labels are `ARCHITECTURE_COMPLETE`, `DETERMINISTIC_VALIDATION_COMPLETE`, `REAL_DATA_VALIDATION_PENDING` and `HISTORICAL_CALIBRATION_PENDING`.

### Soccer Prediction Engine V1

Status: Completed provider-independent architecture and deterministic validation verified.

Evidence: `docs/soccer-prediction-engine-v1.md`, `src/services/soccer-prediction-engine.service.ts`, `/api/soccer/predictions`, `/api/soccer/predictions/health`, `/api/soccer/predictions/validation` and `SoccerPredictionEnginePanel`.

Note: The module produces deterministic 1X2, double chance, draw no bet, totals, BTTS, first-half, qualification and Asian handicap contract previews. It validates three-way probability normalization and no-vig behavior, does not persist picks, consumes zero provider calls and does not claim production betting readiness. Completion labels are `ARCHITECTURE_COMPLETE`, `DETERMINISTIC_VALIDATION_COMPLETE`, `REAL_DATA_VALIDATION_PENDING` and `HISTORICAL_CALIBRATION_PENDING`.

### NHL Feature Store Integration V1

Status: Completed provider-independent integration and build verified.

Evidence: `docs/nhl-feature-store-integration-v1.md`, `src/services/nhl-feature-store-integration.service.ts`, `/api/nhl/features/store`, `/api/nhl/features/preview`, `/api/nhl/features/validation` and `NhlFeatureStoreIntegrationPanel`.

Note: The module validates NHL Feature Store compatibility without provider calls or migrations. The NHL moneyline feature set remains `partial` because starting goalie, goalie form, injury impact, special-teams and rest/travel domains are explicit missing-domain warnings. Completion labels are `ARCHITECTURE_COMPLETE`, `DETERMINISTIC_VALIDATION_COMPLETE`, `REAL_DATA_VALIDATION_PENDING` and `HISTORICAL_CALIBRATION_PENDING`.

### NHL Prediction Engine V1

Status: Completed provider-independent architecture and deterministic validation verified.

Evidence: `docs/nhl-prediction-engine-v1.md`, `src/services/nhl-prediction-engine.service.ts`, `/api/nhl/predictions`, `/api/nhl/predictions/health`, `/api/nhl/predictions/validation` and `NhlPredictionEnginePanel`.

Note: The module produces deterministic moneyline, puck line/spread and total previews through the Shared Sport Prediction Engine SDK. It does not persist picks, consume provider calls or claim production betting readiness. Completion labels are `ARCHITECTURE_COMPLETE`, `DETERMINISTIC_VALIDATION_COMPLETE`, `REAL_DATA_VALIDATION_PENDING` and `HISTORICAL_CALIBRATION_PENDING`.

### Tennis Feature Store Integration V1

Status: Completed provider-independent integration and build verified.

Evidence: `docs/tennis-feature-store-integration-v1.md`, `src/services/tennis-feature-store-integration.service.ts`, `/api/tennis/features/store`, `/api/tennis/features/preview`, `/api/tennis/features/validation` and `TennisFeatureStoreIntegrationPanel`.

Note: The module validates tennis Feature Store compatibility without provider calls or migrations. The tennis moneyline feature set remains `partial` because player form, surface, ranking and injury domains are explicit missing-domain warnings. Completion labels are `ARCHITECTURE_COMPLETE`, `DETERMINISTIC_VALIDATION_COMPLETE`, `REAL_DATA_VALIDATION_PENDING` and `HISTORICAL_CALIBRATION_PENDING`.

### Tennis Prediction Engine V1

Status: Completed provider-independent architecture and deterministic validation verified.

Evidence: `docs/tennis-prediction-engine-v1.md`, `src/services/tennis-prediction-engine.service.ts`, `/api/tennis/predictions`, `/api/tennis/predictions/health`, `/api/tennis/predictions/validation` and `TennisPredictionEnginePanel`.

Note: The module produces deterministic match-winner and match-total previews through the Shared Sport Prediction Engine SDK. It does not persist picks, consume provider calls or claim production betting readiness. Completion labels are `ARCHITECTURE_COMPLETE`, `DETERMINISTIC_VALIDATION_COMPLETE`, `REAL_DATA_VALIDATION_PENDING` and `HISTORICAL_CALIBRATION_PENDING`.

### UFC Feature Store Integration V1

Status: Completed provider-independent integration and build verified.

Evidence: `docs/ufc-feature-store-integration-v1.md`, `src/services/ufc-feature-store-integration.service.ts`, `/api/ufc/features/store`, `/api/ufc/features/preview`, `/api/ufc/features/validation` and `UfcFeatureStoreIntegrationPanel`.

Note: The module validates UFC Feature Store compatibility without provider calls or migrations. The UFC moneyline feature set remains `partial` because fighter form, camp, injury, method and weigh-in domains are explicit missing-domain warnings. Completion labels are `ARCHITECTURE_COMPLETE`, `DETERMINISTIC_VALIDATION_COMPLETE`, `REAL_DATA_VALIDATION_PENDING` and `HISTORICAL_CALIBRATION_PENDING`.

### UFC Prediction Engine V1

Status: Completed provider-independent architecture and deterministic validation verified.

Evidence: `docs/ufc-prediction-engine-v1.md`, `src/services/ufc-prediction-engine.service.ts`, `/api/ufc/predictions`, `/api/ufc/predictions/health`, `/api/ufc/predictions/validation` and `UfcPredictionEnginePanel`.

Note: The module produces deterministic fight-winner and method-contract previews through the Shared Sport Prediction Engine SDK. Moneyline is settlement-compatible; method contracts are explicitly not settlement-compatible until combat-specific grading exists. It does not persist picks, consume provider calls or claim production betting readiness. Completion labels are `ARCHITECTURE_COMPLETE`, `DETERMINISTIC_VALIDATION_COMPLETE`, `REAL_DATA_VALIDATION_PENDING` and `HISTORICAL_CALIBRATION_PENDING`.

## Next Modules In Dependency Order

### 1. Provider-Backed NBA Data Quality And Historical Reconciliation Phase B

Status: Blocked until explicit provider/quota/date-window approval.

Objective: Execute capped, provider-backed reconciliation using the Phase A dry-run plan, improving NBA event/result/odds coverage without full historical downloads.

Prerequisites: NBA Data Quality and Historical Reconciliation Phase A, SportsDataIO NBA Pilot Import V1, SportsDataIO NBA Pilot Import V2, provider quota approval, credentials available and capped date windows approved.

Backend scope: Provider-backed incremental reconciliation jobs, small date-window execution, idempotent refreshes, duplicate handling and reconciliation status tracking.

Frontend scope: Extend the data quality dashboard with explicitly authorized execution controls, progress and post-run deltas.

Persistence or migration scope: Additive reconciliation job metadata only if existing `sports_sync_jobs` metadata is insufficient.

APIs: Extend `/api/nba/reconciliation/*` with protected execution endpoints while preserving existing dry-run contracts.

Validation: Use small date ranges first; never run full historical sync without approval; confirm no provider quota overrun.

Build criteria: `npm.cmd run build` exits 0.

Completion criteria: Approved gaps can be refreshed idempotently, data quality improves, and provider calls stay within the approved cap.

### 2. Injury Provider Integration

Status: Partially satisfied by SportsDataIO NBA Injuries Pilot V1 and NBA Injury and Lineup Confidence Integration V1; production-eligible injury ingestion remains pending.

Objective: Add a real production-eligible provider-backed injury ingestion path.

Prerequisites: Provider selected, credentials available, production-eligible data contract reviewed.

Backend scope: Provider client, normalizer, sync job and persistence into `sport_injuries`.

Frontend scope: NBA health and prediction panels show injury freshness and coverage.

Persistence or migration scope: Additive columns only if provider fields require them.

APIs: NBA injury sync and health endpoints may be extended.

Validation: Verify no fabricated injuries; unsupported provider states return warnings.

Build criteria: `npm.cmd run build` exits 0.

Completion criteria: Production-eligible injury data can be synced idempotently and used as a feature input without trial-data confidence leakage.

### 3. Expected Lineups

Objective: Integrate real expected/confirmed lineup data for NBA.

Prerequisites: NBA Injury and Lineup Confidence Integration V1 plus exact expected/confirmed lineup provider endpoint and entitlement confirmation.

Backend scope: Lineup provider, normalizer, sync, confidence status and freshness.

Frontend scope: Lineup status in NBA dashboard.

Persistence or migration scope: Use `sport_players` and add lineup table only if needed.

APIs: NBA lineups sync/query endpoints.

Validation: No fake lineups; stale/unavailable lineups produce warnings.

Build criteria: `npm.cmd run build` exits 0.

Completion criteria: Lineup data is auditable and safely consumed by predictions.

### 4. Closing Line Value AI V2

Objective: Upgrade CLV intelligence using settled predictions and odds movement.

Prerequisites: Settlement, multi-book comparison and odds history.

Backend scope: CLV V2 scoring, sportsbook timing analysis and model feedback.

Frontend scope: Enhanced CLV dashboard.

Persistence or migration scope: Additive CLV metadata only if necessary.

APIs: Extend closing-line intelligence APIs.

Validation: Verify against stored opening/closing snapshots.

Build criteria: `npm.cmd run build` exits 0.

Completion criteria: CLV outputs are auditable and integrated with model health.

### 5. NBA Prediction Engine V2

Objective: Improve NBA predictions using calibrated features, quality checks and provider-backed context.

Prerequisites: Backtesting/calibration, data quality, injury/lineup provider readiness and odds quality.

Backend scope: Feature upgrades, calibrated probabilities, market-specific confidence and EV refinement.

Frontend scope: V2 model health and explanation updates.

Persistence or migration scope: Model version metadata only if needed.

APIs: Preserve V1 contracts or version explicitly.

Validation: Compare V2 to V1 without overwriting historical V1 records.

Build criteria: `npm.cmd run build` exits 0.

Completion criteria: V2 demonstrates measurable improvement or clearly documented tradeoffs.

### 6. Prop Bets Engine

Objective: Add player prop predictions only after player, injury and lineup data are real.

Prerequisites: Real player rosters, injuries, lineups and prop odds.

Backend scope: Player feature engineering, prop market normalization and settlement rules.

Frontend scope: Prop dashboard and explanation cards.

Persistence or migration scope: Player prop prediction and settlement metadata if not covered by existing tables.

APIs: Prop prediction and performance endpoints.

Validation: No props without real provider data.

Build criteria: `npm.cmd run build` exits 0.

Completion criteria: Prop predictions are validated, persisted and settleable.

### 7. Same Game Parlays

Objective: Build correlation-aware same-game parlay recommendations.

Prerequisites: Prop engine, market correlation service and settlement coverage.

Backend scope: Correlation model, eligibility rules and EV calculation.

Frontend scope: Same-game parlay builder.

Persistence or migration scope: Parlay legs and recommendation history if needed.

APIs: Same-game parlay endpoints.

Validation: Prevent unsupported or unavailable leg combinations.

Build criteria: `npm.cmd run build` exits 0.

Completion criteria: SGP recommendations are explainable and risk-bounded.

### 8. Portfolio Optimizer V3

Objective: Upgrade portfolio allocation using calibrated NBA performance and cross-market risk.

Prerequisites: Settled predictions, calibration and market performance.

Backend scope: Allocation V3, exposure constraints and scenario simulation.

Frontend scope: Portfolio V3 panel.

Persistence or migration scope: Optional portfolio run history.

APIs: Portfolio V3 endpoint.

Validation: Verify bankroll constraints and no over-allocation.

Build criteria: `npm.cmd run build` exits 0.

Completion criteria: Portfolio outputs are consistent with Kelly/risk services.

### 9. Bankroll AI

Objective: Add adaptive bankroll guidance from settled performance and risk profile.

Prerequisites: Portfolio V3 and performance history.

Backend scope: Bankroll policy, drawdown rules and stake recommendations.

Frontend scope: Bankroll AI panel.

Persistence or migration scope: User bankroll settings if supported.

APIs: Bankroll AI endpoint.

Validation: Conservative defaults and risk bounds.

Build criteria: `npm.cmd run build` exits 0.

Completion criteria: Guidance is explainable and never exceeds configured constraints.

### 10. Arbitrage Finder

Objective: Detect cross-book arbitrage from multi-book odds.

Prerequisites: Multi-book comparison with fresh odds.

Backend scope: Arbitrage scanner and stale odds guardrails.

Frontend scope: Arbitrage opportunities panel.

Persistence or migration scope: Optional opportunity snapshots.

APIs: Arbitrage endpoint.

Validation: Verify math, freshness and bookmaker coverage.

Build criteria: `npm.cmd run build` exits 0.

Completion criteria: Only real, fresh odds produce opportunities.

### 11. NBA Complete

Objective: Declare NBA production-complete after sync, predictions, validation, settlement, calibration, injury/lineup context and dashboards are reliable.

Prerequisites: NBA modules above.

Backend scope: Hardening and monitoring.

Frontend scope: Final NBA dashboard polish.

Persistence or migration scope: None unless hardening requires additive metadata.

APIs: Stable NBA API contracts.

Validation: Full smoke suite with real available data.

Build criteria: `npm.cmd run build` exits 0.

Completion criteria: NBA can run daily without manual intervention except provider outages.

### 12. NFL Complete

Objective: Apply the proven NBA pattern to NFL.

Prerequisites: NBA complete and multi-sport abstractions validated.

Backend scope: NFL sync, features, prediction, validation and settlement.

Frontend scope: NFL dashboard surfaces.

Persistence or migration scope: Reuse generic sports tables where possible.

APIs: NFL or generic sports endpoints.

Validation: Provider-backed NFL smoke tests.

Build criteria: `npm.cmd run build` exits 0.

Completion criteria: NFL has production-ready sync-to-settlement flow.

### 13. Soccer Complete

Objective: Add soccer league-specific prediction and settlement support.

Prerequisites: Provider league selection and soccer market definitions.

Backend scope: Soccer sync, draw-aware markets, xG or provider-backed features.

Frontend scope: Soccer dashboard.

Persistence or migration scope: Reuse generic tables where possible.

APIs: Soccer endpoints through multi-sport routes.

Validation: Draw/no-draw settlement and market-specific checks.

Build criteria: `npm.cmd run build` exits 0.

Completion criteria: Soccer coverage is league-aware and settleable.

### 14. NHL Complete

Objective: Add NHL prediction and settlement support.

Prerequisites: Multi-sport pattern and hockey-specific feature source.

Backend scope: NHL sync, goalie/context features and settlement.

Frontend scope: NHL dashboard.

Persistence or migration scope: Reuse generic tables where possible.

APIs: NHL endpoints through multi-sport routes.

Validation: Hockey market settlement and provider freshness.

Build criteria: `npm.cmd run build` exits 0.

Completion criteria: NHL has production-ready sync-to-settlement flow.

### 15. Tennis

Objective: Add tennis match prediction support.

Prerequisites: Individual-participant adapter readiness.

Backend scope: Player-form features, tournament events and match settlement.

Frontend scope: Tennis dashboard.

Persistence or migration scope: Player/participant records as needed.

APIs: Tennis endpoints through multi-sport routes.

Validation: Individual participant settlement and tournament status handling.

Build criteria: `npm.cmd run build` exits 0.

Completion criteria: Tennis predictions are provider-backed and settleable.

### 16. UFC

Objective: Add UFC fight prediction support.

Prerequisites: Fighter data provider and event-based schedule support.

Backend scope: Fighter records, market settlement and event health.

Frontend scope: UFC dashboard.

Persistence or migration scope: Fighter metadata if needed.

APIs: UFC endpoints through multi-sport routes.

Validation: Event/fight settlement and method market guardrails.

Build criteria: `npm.cmd run build` exits 0.

Completion criteria: UFC predictions are provider-backed and settleable.

### 17. Live Betting AI

Objective: Add live betting intelligence only after pregame pipelines are reliable.

Prerequisites: Stable odds feeds, model calibration, bankroll constraints and settlement.

Backend scope: Live odds ingestion, momentum, cash-out and hedge intelligence.

Frontend scope: Live betting panel hardening.

Persistence or migration scope: Live snapshots if needed.

APIs: Live betting endpoints.

Validation: Strict stale data and latency warnings.

Build criteria: `npm.cmd run build` exits 0.

Completion criteria: Live recommendations are latency-aware and risk-bounded.

### 18. Prediction Engine V5

Objective: Upgrade the general prediction engine after sport-specific calibration exists.

Prerequisites: Settled/calibrated data across multiple sports.

Backend scope: Cross-sport model improvements and versioned comparison to V4.

Frontend scope: Model center V5 comparison and rollout controls.

Persistence or migration scope: Model version metadata and rollout history if needed.

APIs: Versioned prediction endpoint or backwards-compatible V4 extension.

Validation: Backtest, calibration, rollback and A/B comparison.

Build criteria: `npm.cmd run build` exits 0.

Completion criteria: V5 is demonstrably better or safely feature-flagged.
