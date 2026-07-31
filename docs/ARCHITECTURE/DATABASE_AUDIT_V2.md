# Database Audit V2

Generated from Supabase SQL files and static repository references.

## Database Objects

| Type | Name | Defined In | Static Repository Usage |
| --- | --- | --- | --- |
| Table | provider_entity_mappings | supabase/migrations/202607110001_nba_data_sync_v1.sql | scripts/six-historical-settlement-conflict-resolution-v1.mjs<br>scripts/universal-event-identity-materialize-v1.mjs<br>src/services/basketball/acquisition/bsn-acquisition-engine.ts<br>src/services/historical-import-engine.service.ts<br>src/services/mlb-historical-foundation-v2.service.ts<br>src/services/mlb-missing-intelligence.service.ts<br>src/services/mlb-model-platform.service.ts<br>src/services/mlb-player-prop-sync.service.ts<br>src/services/mlb-pregame-starter-evidence.service.ts<br>src/services/mlb-starter-intelligence.service.ts<br>src/services/mlb-starter-sync.service.ts<br>src/services/mlb-unresolved-player-identity.service.ts |
| Table | sports_sync_jobs | supabase/migrations/202607110001_nba_data_sync_v1.sql | src/services/provider-budget.service.ts<br>src/services/daily-report-fast.service.ts<br>scripts/multi-sport-results-crosswalk-foundation-v1.mjs<br>scripts/retrosheet-feature-backfill.mjs<br>scripts/retrosheet-production-isolation-probe.mjs<br>scripts/the-odds-api-historical-mlb-core-import-v1.mjs<br>scripts/the-odds-api-player-props-v1.mjs<br>scripts/the-odds-api-scores-results-v1.mjs<br>src/services/basketball/acquisition/bsn-acquisition-engine.ts<br>src/services/global-data-quality.service.ts<br>src/services/historical-import-engine.service.ts<br>src/services/historical-replay-pilot.service.ts |
| Table | sports_teams | supabase/migrations/202607110001_nba_data_sync_v1.sql | src/services/basketball/acquisition/bsn-acquisition-engine.ts<br>src/services/mlb-missing-intelligence.service.ts<br>src/services/nba-data-quality.service.ts<br>src/services/nba-data-sync.service.ts<br>src/services/sportsdataio-historical-import-readiness.service.ts<br>src/services/sportsdataio-mlb-historical-import-executor.service.ts<br>src/services/sportsdataio-mlb-prospective-preview.service.ts |
| Table | sport_events | supabase/migrations/202607110001_nba_data_sync_v1.sql | src/services/dashboard-today.service.ts<br>docs/FULL_PLATFORM_AUDIT_V1_FINDINGS.json<br>docs/FULL_PLATFORM_AUDIT_V1.md<br>scripts/six-historical-settlement-conflict-resolution-v1.mjs<br>scripts/universal-event-identity-materialize-v1.mjs<br>src/services/adaptive-refresh-orchestrator.service.ts<br>src/services/basketball/acquisition/bsn-acquisition-engine.ts<br>src/services/bsn-platform.service.ts<br>src/services/closing-line-intelligence.service.ts<br>src/services/current-board.service.ts<br>src/services/game-intelligence.service.ts<br>src/services/global-data-quality.service.ts |
| Table | sport_standings | supabase/migrations/202607110001_nba_data_sync_v1.sql | src/services/basketball/acquisition/bsn-acquisition-engine.ts<br>src/services/nba-data-quality.service.ts<br>src/services/nba-data-sync.service.ts<br>src/services/sportsdataio-historical-import-readiness.service.ts<br>src/services/sportsdataio-mlb-historical-import-executor.service.ts |
| Table | sport_game_stats | supabase/migrations/202607110001_nba_data_sync_v1.sql | src/services/nba-data-quality.service.ts<br>src/services/nba-prediction-settlement.service.ts<br>src/services/sportsdataio-historical-import-readiness.service.ts<br>src/services/sportsdataio-mlb-historical-import-executor.service.ts<br>src/services/universal-event-identity.service.ts<br>src/services/universal-projection-engine.service.ts |
| Table | sport_players | supabase/migrations/202607110001_nba_data_sync_v1.sql | src/services/basketball/acquisition/bsn-acquisition-engine.ts<br>src/services/mlb-current-lineup-context.service.ts<br>src/services/mlb-missing-intelligence.service.ts<br>src/services/mlb-model-platform.service.ts<br>src/services/mlb-player-prop-sync.service.ts<br>src/services/mlb-pregame-starter-evidence.service.ts<br>src/services/mlb-starter-intelligence.service.ts<br>src/services/mlb-starter-sync.service.ts<br>src/services/nba-data-quality.service.ts<br>src/services/player-intelligence.service.ts<br>src/services/sportsdataio-historical-import-readiness.service.ts<br>src/services/sportsdataio-mlb-historical-import-executor.service.ts |
| Table | sport_injuries | supabase/migrations/202607110001_nba_data_sync_v1.sql | src/services/mlb-missing-intelligence.service.ts<br>src/services/nba-data-quality.service.ts<br>src/services/nba-injury-lineup-confidence.service.ts<br>src/services/sportsdataio-historical-import-readiness.service.ts |
| Table | sports_odds_snapshots | supabase/migrations/202607110001_nba_data_sync_v1.sql | src/services/dashboard-today.service.ts<br>scripts/multi-sport-unlock-v1-checkpoint-e-soccer.mjs<br>scripts/the-odds-api-historical-mlb-core-import-v1.mjs<br>scripts/the-odds-api-player-props-v1.mjs<br>scripts/universal-event-identity-materialize-v1.mjs<br>src/services/closing-line-intelligence.service.ts<br>src/services/current-board.service.ts<br>src/services/global-data-quality.service.ts<br>src/services/historical-feature-generation.service.ts<br>src/services/market-movement-intelligence.service.ts<br>src/services/market-opportunity-suite.service.ts<br>src/services/mlb-market-pipeline-diagnostics.service.ts |
| Index | provider_entity_mappings_lookup_idx | supabase/migrations/202607110001_nba_data_sync_v1.sql | No static reference found |
| Index | sports_sync_jobs_sport_status_idx | supabase/migrations/202607110001_nba_data_sync_v1.sql | No static reference found |
| Index | sports_teams_provider_idx | supabase/migrations/202607110001_nba_data_sync_v1.sql | No static reference found |
| Index | sport_events_sport_start_idx | supabase/migrations/202607110001_nba_data_sync_v1.sql | No static reference found |
| Index | sport_events_provider_idx | supabase/migrations/202607110001_nba_data_sync_v1.sql | No static reference found |
| Index | sport_standings_sport_season_idx | supabase/migrations/202607110001_nba_data_sync_v1.sql | No static reference found |
| Index | sport_game_stats_team_idx | supabase/migrations/202607110001_nba_data_sync_v1.sql | No static reference found |
| Index | sport_players_team_idx | supabase/migrations/202607110001_nba_data_sync_v1.sql | No static reference found |
| Index | sport_injuries_team_status_idx | supabase/migrations/202607110001_nba_data_sync_v1.sql | No static reference found |
| Index | sports_odds_snapshots_event_idx | supabase/migrations/202607110001_nba_data_sync_v1.sql | No static reference found |
| Index | sports_odds_snapshots_market_idx | supabase/migrations/202607110001_nba_data_sync_v1.sql | No static reference found |
| Index | prediction_history_nba_lifecycle_idx | supabase/migrations/202607110003_nba_prediction_validation_settlement_v1.sql | No static reference found |
| Index | prediction_history_nba_event_market_idx | supabase/migrations/202607110003_nba_prediction_validation_settlement_v1.sql | No static reference found |
| Index | prediction_history_nba_settlement_backlog_idx | supabase/migrations/202607110003_nba_prediction_validation_settlement_v1.sql | No static reference found |
| Table | sport_lineups | supabase/migrations/202607130001_sport_lineups_depth_charts_v1.sql | src/services/game-intelligence.service.ts<br>src/services/historical-feature-generation.service.ts<br>src/services/mlb-current-lineup-context.service.ts<br>src/services/mlb-missing-intelligence.service.ts<br>src/services/mlb-pregame-starter-evidence.service.ts<br>src/services/mlb-starter-intelligence.service.ts<br>src/services/mlb-starter-sync.service.ts<br>src/services/nba-data-quality.service.ts<br>src/services/nba-injury-lineup-confidence.service.ts<br>src/services/player-intelligence.service.ts<br>src/services/sportsdataio-historical-import-readiness.service.ts |
| Index | sport_lineups_event_idx | supabase/migrations/202607130001_sport_lineups_depth_charts_v1.sql | No static reference found |
| Index | sport_lineups_team_idx | supabase/migrations/202607130001_sport_lineups_depth_charts_v1.sql | No static reference found |
| Index | sport_lineups_provider_idx | supabase/migrations/202607130001_sport_lineups_depth_charts_v1.sql | No static reference found |
| Table | sport_player_stats | supabase/migrations/202607130002_sport_player_stats_v1.sql | src/services/historical-feature-generation.service.ts<br>src/services/mlb-current-lineup-context.service.ts<br>src/services/mlb-missing-intelligence.service.ts<br>src/services/mlb-model-platform.service.ts<br>src/services/mlb-player-projection-engine.service.ts<br>src/services/mlb-unresolved-player-identity.service.ts<br>src/services/nba-data-quality.service.ts<br>src/services/nba-feature-store-integration.service.ts<br>src/services/player-intelligence.service.ts<br>src/services/sportsdataio-historical-import-readiness.service.ts<br>src/services/universal-event-identity.service.ts<br>src/services/universal-projection-engine.service.ts |
| Index | sport_player_stats_player_idx | supabase/migrations/202607130002_sport_player_stats_v1.sql | No static reference found |
| Index | sport_player_stats_event_idx | supabase/migrations/202607130002_sport_player_stats_v1.sql | No static reference found |
| Index | sport_player_stats_provider_idx | supabase/migrations/202607130002_sport_player_stats_v1.sql | No static reference found |
| Table | historical_feature_snapshots | supabase/migrations/202607140001_historical_feature_snapshots_v1.sql | scripts/ai-model-strategy-v1.mjs<br>scripts/historical-evidence-recovery-v1.mjs<br>scripts/retrosheet-feature-backfill.mjs<br>scripts/training-safe-feature-governance-v1.mjs<br>src/services/historical-feature-generation.service.ts<br>src/services/historical-replay-pilot.service.ts<br>src/services/prediction-history.service.ts<br>src/services/retrosheet-historical-feature-store.service.ts<br>src/services/sportsdataio-mlb-prospective-preview.service.ts<br>src/services/stored-preview-prediction-lifecycle.service.ts<br>scripts/database-io-readonly-audit.mjs<br>scripts/feature-intelligence-signal-quality-leakage-audit-v1.mjs |
| Index | historical_feature_snapshots_sport_event_idx | supabase/migrations/202607140001_historical_feature_snapshots_v1.sql | No static reference found |
| Index | historical_feature_snapshots_cutoff_idx | supabase/migrations/202607140001_historical_feature_snapshots_v1.sql | No static reference found |
| Index | historical_feature_snapshots_production_idx | supabase/migrations/202607140001_historical_feature_snapshots_v1.sql | No static reference found |
| Index | historical_feature_snapshots_lineage_idx | supabase/migrations/202607140001_historical_feature_snapshots_v1.sql | No static reference found |
| Index | historical_feature_snapshots_values_idx | supabase/migrations/202607140001_historical_feature_snapshots_v1.sql | No static reference found |
| Index | prediction_history_feature_snapshot_idx | supabase/migrations/202607140001_historical_feature_snapshots_v1.sql | No static reference found |
| Index | prediction_history_feature_lineage_idx | supabase/migrations/202607140001_historical_feature_snapshots_v1.sql | No static reference found |
| Index | prediction_history_production_eligibility_idx | supabase/migrations/202607140001_historical_feature_snapshots_v1.sql | No static reference found |
| Trigger | historical_feature_snapshots_immutability_trg | supabase/migrations/202607140001_historical_feature_snapshots_v1.sql | No static reference found |
| RPC | prevent_linked_feature_snapshot_mutation | supabase/migrations/202607140001_historical_feature_snapshots_v1.sql | No static reference found |
| Table | operating_days | supabase/migrations/202607170001_mlb_operating_day_lifecycle_v1.sql | scripts/mlb-canonical-settlement-backlog-closure-v1.mjs<br>src/services/operating-day.service.ts<br>scripts/mlb-operating-day-odds-audit-v1.mjs |
| Table | operating_day_events | supabase/migrations/202607170001_mlb_operating_day_lifecycle_v1.sql | src/services/operating-day.service.ts |
| Table | operating_day_lifecycle_events | supabase/migrations/202607170001_mlb_operating_day_lifecycle_v1.sql | src/services/provider-budget.service.ts<br>src/services/adaptive-refresh-orchestrator.service.ts<br>src/services/operating-day-automation.service.ts<br>src/services/operating-day.service.ts<br>src/services/operations-health.service.ts<br>src/services/pregame-scheduler-coverage.service.ts<br>scripts/mlb-operating-day-odds-audit-v1.mjs |
| Table | operating_day_recommendation_locks | supabase/migrations/202607170001_mlb_operating_day_lifecycle_v1.sql | src/services/operating-day.service.ts |
| Table | operating_day_reports | supabase/migrations/202607170001_mlb_operating_day_lifecycle_v1.sql | src/services/operating-day.service.ts |
| Index | operating_days_lookup_idx | supabase/migrations/202607170001_mlb_operating_day_lifecycle_v1.sql | No static reference found |
| Index | operating_day_events_event_idx | supabase/migrations/202607170001_mlb_operating_day_lifecycle_v1.sql | No static reference found |
| Index | operating_day_lifecycle_events_day_idx | supabase/migrations/202607170001_mlb_operating_day_lifecycle_v1.sql | No static reference found |
| Index | operating_day_recommendation_locks_day_idx | supabase/migrations/202607170001_mlb_operating_day_lifecycle_v1.sql | No static reference found |
| Index | sports_odds_snapshots_operating_day_idx | supabase/migrations/202607170001_mlb_operating_day_lifecycle_v1.sql | No static reference found |
| Index | prediction_history_operating_day_idx | supabase/migrations/202607170001_mlb_operating_day_lifecycle_v1.sql | No static reference found |
| Index | prediction_history_current_version_unique | supabase/migrations/202607170002_prediction_versioning_engine_v1.sql | No static reference found |
| Index | prediction_history_version_lineage_unique | supabase/migrations/202607170002_prediction_versioning_engine_v1.sql | No static reference found |
| Index | prediction_history_versioning_lookup_idx | supabase/migrations/202607170002_prediction_versioning_engine_v1.sql | No static reference found |
| Index | prediction_history_version_lineage_gin_idx | supabase/migrations/202607170002_prediction_versioning_engine_v1.sql | No static reference found |
| Table | ai_performance_snapshots | supabase/migrations/202607190001_ai_performance_snapshots_v1.sql | src/services/ai-performance-center.service.ts<br>scripts/database-io-readonly-audit.mjs |
| Index | ai_performance_snapshots_scope_date_idx | supabase/migrations/202607190001_ai_performance_snapshots_v1.sql | No static reference found |
| Index | ai_performance_snapshots_sport_date_idx | supabase/migrations/202607190001_ai_performance_snapshots_v1.sql | No static reference found |
| Index | ai_performance_snapshots_model_idx | supabase/migrations/202607190001_ai_performance_snapshots_v1.sql | No static reference found |
| Index | ai_performance_snapshots_metrics_idx | supabase/migrations/202607190001_ai_performance_snapshots_v1.sql | No static reference found |
| Table | universal_projection_history | supabase/migrations/202607190002_universal_projection_history_v1.sql | src/app/api/mlb/player-projections/[projectionId]/route.ts<br>src/services/game-intelligence.service.ts<br>src/services/historical-replay-pilot.service.ts<br>src/services/historical-shadow-calibration.service.ts<br>src/services/mlb-learning-brain.service.ts<br>src/services/mlb-player-projection-engine.service.ts<br>src/services/model-only-intelligence.service.ts<br>src/services/player-intelligence.service.ts<br>src/services/projection-evolution.service.ts<br>src/services/universal-projection-engine.service.ts |
| Index | universal_projection_history_sport_generated_idx | supabase/migrations/202607190002_universal_projection_history_v1.sql | No static reference found |
| Index | universal_projection_history_event_idx | supabase/migrations/202607190002_universal_projection_history_v1.sql | No static reference found |
| Index | universal_projection_history_entity_idx | supabase/migrations/202607190002_universal_projection_history_v1.sql | No static reference found |
| Index | universal_projection_history_projection_idx | supabase/migrations/202607190002_universal_projection_history_v1.sql | No static reference found |
| Index | universal_projection_history_model_idx | supabase/migrations/202607190002_universal_projection_history_v1.sql | No static reference found |
| Index | universal_projection_history_rank_idx | supabase/migrations/202607190002_universal_projection_history_v1.sql | No static reference found |
| Index | universal_projection_history_features_idx | supabase/migrations/202607190002_universal_projection_history_v1.sql | No static reference found |
| Index | universal_projection_history_model_idx | supabase/migrations/202607220001_universal_projection_history_schema_alignment.sql | No static reference found |
| Index | universal_projection_history_rank_idx | supabase/migrations/202607220001_universal_projection_history_schema_alignment.sql | No static reference found |
| Table | historical_source_registry | supabase/migrations/202607220002_historical_data_lake_core_v1.sql | No static reference found |
| Table | historical_import_registry | supabase/migrations/202607220002_historical_data_lake_core_v1.sql | scripts/retrosheet-feature-backfill.mjs<br>scripts/retrosheet-finalize-import.mjs<br>src/services/retrosheet-controlled-import.service.ts<br>src/services/retrosheet-historical-feature-store.service.ts<br>scripts/database-io-readonly-audit.mjs |
| Table | historical_raw_records | supabase/migrations/202607220002_historical_data_lake_core_v1.sql | src/services/retrosheet-controlled-import.service.ts |
| Table | historical_import_checkpoints | supabase/migrations/202607220002_historical_data_lake_core_v1.sql | scripts/retrosheet-feature-backfill.mjs<br>src/services/historical-replay-pilot.service.ts<br>src/services/prediction-cutoff-enforcement.service.ts<br>src/services/retrosheet-historical-feature-store.service.ts<br>scripts/database-io-readonly-audit.mjs |
| Table | historical_identity_foundation | supabase/migrations/202607220002_historical_data_lake_core_v1.sql | No static reference found |
| Index | historical_source_registry_checksum_idx | supabase/migrations/202607220002_historical_data_lake_core_v1.sql | No static reference found |
| Index | historical_source_registry_season_idx | supabase/migrations/202607220002_historical_data_lake_core_v1.sql | No static reference found |
| Index | historical_import_registry_status_idx | supabase/migrations/202607220002_historical_data_lake_core_v1.sql | No static reference found |
| Index | historical_raw_records_source_line_idx | supabase/migrations/202607220002_historical_data_lake_core_v1.sql | No static reference found |
| Index | historical_raw_records_game_idx | supabase/migrations/202607220002_historical_data_lake_core_v1.sql | No static reference found |
| Index | historical_import_checkpoints_unique_idx | supabase/migrations/202607220002_historical_data_lake_core_v1.sql | No static reference found |
| Index | historical_identity_foundation_unique_idx | supabase/migrations/202607220002_historical_data_lake_core_v1.sql | No static reference found |
| Table | historical_baseball_games | supabase/migrations/202607220003_retrosheet_game_engine_v1.sql | src/services/historical-replay-pilot.service.ts<br>src/services/mlb-pitcher-feature-builder.service.ts<br>src/services/mlb-starter-sync.service.ts<br>src/services/retrosheet-controlled-import.service.ts<br>scripts/database-io-readonly-audit.mjs |
| Table | historical_baseball_lineups | supabase/migrations/202607220003_retrosheet_game_engine_v1.sql | No static reference found |
| Table | historical_baseball_substitutions | supabase/migrations/202607220003_retrosheet_game_engine_v1.sql | No static reference found |
| Table | historical_baseball_plays | supabase/migrations/202607220003_retrosheet_game_engine_v1.sql | No static reference found |
| Table | historical_baseball_pitcher_appearances | supabase/migrations/202607220003_retrosheet_game_engine_v1.sql | src/services/mlb-pitcher-feature-builder.service.ts<br>src/services/mlb-player-projection-engine.service.ts<br>src/services/mlb-starter-sync.service.ts |
| Table | historical_baseball_batter_appearances | supabase/migrations/202607220003_retrosheet_game_engine_v1.sql | src/services/mlb-player-projection-engine.service.ts |
| Index | historical_baseball_games_date_idx | supabase/migrations/202607220003_retrosheet_game_engine_v1.sql | No static reference found |
| Index | historical_baseball_lineups_game_idx | supabase/migrations/202607220003_retrosheet_game_engine_v1.sql | No static reference found |
| Index | historical_baseball_plays_game_idx | supabase/migrations/202607220003_retrosheet_game_engine_v1.sql | No static reference found |
| Index | prediction_history_current_board_live_idx | supabase/migrations/202607240001_current_board_timeout_recovery_v1.sql | No static reference found |
| Index | sports_odds_snapshots_current_board_event_market_idx | supabase/migrations/202607240001_current_board_timeout_recovery_v1.sql | No static reference found |
| Table | universal_market_registry | supabase/migrations/202607240005_universal_market_registry_v1.sql | No static reference found |
| Index | universal_market_registry_event_idx | supabase/migrations/202607240005_universal_market_registry_v1.sql | No static reference found |
| Index | universal_market_registry_readiness_idx | supabase/migrations/202607240005_universal_market_registry_v1.sql | No static reference found |
| Table | mlb_pitcher_projections | supabase/migrations/202607260001_mlb_pitcher_projections_v1.sql | src/services/mlb-pitcher-projection-engine.service.ts<br>src/services/mlb-player-prop-comparison.service.ts<br>src/services/mlb-player-prop-sync.service.ts |
| Index | mlb_pitcher_projections_event_idx | supabase/migrations/202607260001_mlb_pitcher_projections_v1.sql | No static reference found |
| Index | mlb_pitcher_projections_pitcher_idx | supabase/migrations/202607260001_mlb_pitcher_projections_v1.sql | No static reference found |
| Index | mlb_pitcher_projections_provider_pitcher_generated_idx | supabase/migrations/202607260001_mlb_pitcher_projections_v1.sql | No static reference found |
| Index | mlb_pitcher_projections_generated_idx | supabase/migrations/202607260001_mlb_pitcher_projections_v1.sql | No static reference found |
| Index | mlb_pitcher_projections_event_generated_idx | supabase/migrations/202607260001_mlb_pitcher_projections_v1.sql | No static reference found |
| Index | mlb_pitcher_projections_pitcher_generated_idx | supabase/migrations/202607260001_mlb_pitcher_projections_v1.sql | No static reference found |
| Table | mlb_starter_assignments | supabase/migrations/202607260002_mlb_starter_assignments_v1.sql | src/services/mlb-starter-sync.service.ts |
| Index | mlb_starter_assignments_active_event_team_idx | supabase/migrations/202607260002_mlb_starter_assignments_v1.sql | No static reference found |
| Index | mlb_starter_assignments_active_lookup_idx | supabase/migrations/202607260002_mlb_starter_assignments_v1.sql | No static reference found |
| Index | mlb_starter_assignments_active_event_idx | supabase/migrations/202607260002_mlb_starter_assignments_v1.sql | No static reference found |
| Index | mlb_starter_assignments_event_idx | supabase/migrations/202607260002_mlb_starter_assignments_v1.sql | No static reference found |
| Index | mlb_starter_assignments_pitcher_idx | supabase/migrations/202607260002_mlb_starter_assignments_v1.sql | No static reference found |
| Index | mlb_starter_assignments_provider_pitcher_idx | supabase/migrations/202607260002_mlb_starter_assignments_v1.sql | No static reference found |
| Index | mlb_starter_assignments_historical_pitcher_idx | supabase/migrations/202607260002_mlb_starter_assignments_v1.sql | No static reference found |
| Index | mlb_starter_assignments_source_updated_idx | supabase/migrations/202607260002_mlb_starter_assignments_v1.sql | No static reference found |
| Table | public.prediction_epochs | supabase/migrations/202607270001_prediction_epoch_governance_v2.sql | supabase/migrations/202607270002_prediction_epoch_governance_seed_v1.sql<br>supabase/migrations/checks/202607270001_prediction_epoch_governance_v2_postcheck.sql<br>supabase/migrations/checks/202607270002_prediction_epoch_governance_seed_v1_postcheck.sql<br>supabase/migrations/checks/202607270002_prediction_epoch_governance_seed_v1_precheck.sql<br>supabase/migrations/rollback/202607270001_prediction_epoch_governance_v2_rollback.sql<br>supabase/migrations/rollback/202607270002_prediction_epoch_governance_seed_v1_rollback.sql<br>src/services/prediction-epoch-migration-state.service.ts |
| Index | prediction_epochs_one_active_idx | supabase/migrations/202607270001_prediction_epoch_governance_v2.sql | No static reference found |
| Index | prediction_epochs_status_idx | supabase/migrations/202607270001_prediction_epoch_governance_v2.sql | No static reference found |
| Index | prediction_epochs_created_at_idx | supabase/migrations/202607270001_prediction_epoch_governance_v2.sql | No static reference found |
| Index | prediction_history_epoch_key_idx | supabase/migrations/202607270001_prediction_epoch_governance_v2.sql | No static reference found |
| Index | prediction_history_epoch_id_idx | supabase/migrations/202607270001_prediction_epoch_governance_v2.sql | No static reference found |
| Index | prediction_history_epoch_settlement_idx | supabase/migrations/202607270001_prediction_epoch_governance_v2.sql | No static reference found |
| Index | prediction_history_epoch_performance_idx | supabase/migrations/202607270001_prediction_epoch_governance_v2.sql | No static reference found |
| Index | prediction_history_epoch_learning_idx | supabase/migrations/202607270001_prediction_epoch_governance_v2.sql | No static reference found |
| Policy | prediction_epochs_service_role_all | supabase/migrations/202607270001_prediction_epoch_governance_v2.sql | No static reference found |
| Policy | prediction_epochs_authenticated_select | supabase/migrations/202607270001_prediction_epoch_governance_v2.sql | No static reference found |
| Index | prediction_history_certification_lookup_idx | supabase/migrations/202607280001_prediction_epoch_shadow_readiness_v1.sql | No static reference found |
| Index | prediction_history_certification_metadata_idx | supabase/migrations/202607280001_prediction_epoch_shadow_readiness_v1.sql | No static reference found |

## Highlights

- Objects marked `No static reference found` may still be used dynamically, by Supabase policies, by SQL functions, or by production data workflows.
- This audit does not mutate the database and does not query production.
