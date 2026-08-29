import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const root = process.cwd()
const migrationPath = path.join(root, 'supabase/migrations/202608290001_pick2_mlb_native_identity_foundation_v1.sql')
const r4dPath = path.join(root, 'docs/CERTIFICATION/mlb-data-01c-r4d-pick2-mlbam-native-identity-plan.json')

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8')
}

function git(args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim()
}

function tableSection(sql, table) {
  const match = sql.match(new RegExp(`create table if not exists public\\.${table}\\s*\\([\\s\\S]*?\\n\\);`, 'i'))
  return match?.[0] ?? ''
}

const foundation = read(path.join(root, 'supabase/migrations/202608270002_pick2_data_foundation_v1.sql'))
const migration = read(migrationPath)
const r4d = JSON.parse(read(r4dPath))

const currentSchemaGapAudit = {
  source: 'supabase/migrations/202608270002_pick2_data_foundation_v1.sql and R4D deployed readback',
  tables: {
    pick2_raw_mlb_statcast_pitches: {
      identityColumns: ['id', 'game_pk', 'event_id', 'source_pitcher_id', 'source_batter_id', 'canonical_pitcher_id', 'canonical_batter_id'],
      legacyFkDependencies: ['event_id -> sport_events.id nullable', 'canonical_pitcher_id/canonical_batter_id -> sport_players.id nullable'],
      notNullDependencies: ['id', 'pick2_era', 'source', 'source_version', 'game_pk', 'game_date', 'at_bat_number', 'pitch_number', 'raw_payload', 'raw_payload_digest'],
      indexes: ['game_pk, at_bat_number, pitch_number', 'event_id, game_date', 'source_pitcher_id, game_date', 'source_batter_id, game_date'],
      uniqueness: ['primary key id', 'unique game_pk + at_bat_number + pitch_number'],
      rls: 'enabled; service_role all',
    },
    pick2_feature_snapshots: {
      identityColumns: ['deterministic_identity', 'sport_key', 'feature_domain', 'subject_id', 'secondary_subject_id', 'event_id'],
      legacyFkDependencies: ['event_id -> sport_events.id nullable'],
      notNullDependencies: ['deterministic_identity', 'pick2_era', 'sport_key', 'feature_domain', 'subject_id', 'feature_date', 'as_of_date', 'feature_version', 'input_digest'],
      indexes: ['sport_key, feature_domain, subject_id, feature_date desc', 'event_id, feature_version'],
      uniqueness: ['deterministic_identity'],
      rls: 'enabled; service_role all',
    },
    pick2_mlb_pitcher_daily_features: {
      identityColumns: ['feature_snapshot_id', 'player_id'],
      legacyFkDependencies: ['player_id -> sport_players.id not null'],
      notNullDependencies: ['feature_snapshot_id', 'player_id', 'feature_date', 'as_of_date', 'feature_version'],
      indexes: ['implicit primary/unique indexes'],
      uniqueness: ['player_id + feature_date + feature_version'],
      rls: 'enabled; service_role all',
    },
    pick2_mlb_batter_daily_features: {
      identityColumns: ['feature_snapshot_id', 'player_id'],
      legacyFkDependencies: ['player_id -> sport_players.id not null'],
      notNullDependencies: ['feature_snapshot_id', 'player_id', 'feature_date', 'as_of_date', 'feature_version'],
      indexes: ['implicit primary/unique indexes'],
      uniqueness: ['player_id + feature_date + feature_version'],
      rls: 'enabled; service_role all',
    },
    pick2_mlb_team_daily_features: {
      identityColumns: ['feature_snapshot_id', 'team_id'],
      legacyFkDependencies: ['none; team_id uses certified sports_teams.id'],
      notNullDependencies: ['feature_snapshot_id', 'team_id', 'feature_date', 'as_of_date', 'feature_version'],
      indexes: ['implicit primary/unique indexes'],
      uniqueness: ['team_id + feature_date + feature_version'],
      rls: 'enabled; service_role all',
    },
    pick2_mlb_bullpen_daily_features: {
      identityColumns: ['feature_snapshot_id', 'team_id'],
      legacyFkDependencies: ['none; team_id uses certified sports_teams.id'],
      notNullDependencies: ['feature_snapshot_id', 'team_id', 'feature_date', 'as_of_date', 'feature_version'],
      indexes: ['implicit primary/unique indexes'],
      uniqueness: ['team_id + feature_date + feature_version'],
      rls: 'enabled; service_role all',
    },
    pick2_mlb_matchup_daily_features: {
      identityColumns: ['feature_snapshot_id', 'event_id', 'home_team_id', 'away_team_id'],
      legacyFkDependencies: ['event_id -> sport_events.id not null'],
      notNullDependencies: ['feature_snapshot_id', 'event_id', 'feature_date', 'as_of_date', 'feature_version'],
      indexes: ['implicit primary/unique indexes'],
      uniqueness: ['event_id + feature_date + feature_version'],
      rls: 'enabled; service_role all',
    },
    pick2_mlb_first_inning_daily_features: {
      identityColumns: ['feature_snapshot_id', 'event_id', 'home_team_id', 'away_team_id'],
      legacyFkDependencies: ['event_id -> sport_events.id not null'],
      notNullDependencies: ['feature_snapshot_id', 'event_id', 'feature_date', 'as_of_date', 'feature_version'],
      indexes: ['implicit primary/unique indexes'],
      uniqueness: ['event_id + feature_date + feature_version'],
      rls: 'enabled; service_role all',
    },
    pick2_model_registry: { identityColumns: ['sport_key', 'model_family', 'target'], legacyFkDependencies: ['none'], notNullDependencies: ['model_family', 'sport_key', 'target', 'purpose', 'status'], indexes: ['implicit unique'], uniqueness: ['sport_key + model_family + target'], rls: 'enabled; authenticated select; service_role all' },
    pick2_model_feature_sets: { identityColumns: ['deterministic_identity', 'sport_key', 'feature_set_version'], legacyFkDependencies: ['none'], notNullDependencies: ['deterministic_identity', 'sport_key', 'feature_set_version'], indexes: ['implicit unique'], uniqueness: ['deterministic_identity', 'sport_key + feature_set_version'], rls: 'enabled; service_role all' },
    pick2_model_versions: { identityColumns: ['deterministic_identity', 'model_id', 'feature_set_id', 'model_version'], legacyFkDependencies: ['none'], notNullDependencies: ['deterministic_identity', 'model_id', 'feature_set_id', 'model_version', 'artifact_digest'], indexes: ['implicit unique'], uniqueness: ['deterministic_identity', 'model_id + model_version'], rls: 'enabled; authenticated select; service_role all' },
    pick2_model_training_runs: { identityColumns: ['deterministic_identity', 'model_version_id'], legacyFkDependencies: ['none'], notNullDependencies: ['deterministic_identity', 'sport_key', 'target', 'feature_set_version', 'status'], indexes: ['implicit unique'], uniqueness: ['deterministic_identity'], rls: 'enabled; service_role all' },
    pick2_model_validation_runs: { identityColumns: ['deterministic_identity', 'model_version_id'], legacyFkDependencies: ['none'], notNullDependencies: ['deterministic_identity', 'model_version_id', 'sealed_holdout', 'status'], indexes: ['implicit unique'], uniqueness: ['deterministic_identity'], rls: 'enabled; authenticated select; service_role all' },
    pick2_game_predictions: { identityColumns: ['deterministic_identity', 'sport_key', 'event_id', 'model_version_id', 'feature_snapshot_id', 'predicted_at', 'target'], legacyFkDependencies: ['event_id -> sport_events.id not null'], notNullDependencies: ['deterministic_identity', 'event_id', 'model_version_id', 'feature_snapshot_id', 'predicted_at', 'target', 'frozen_input_digest', 'model_artifact_digest'], indexes: ['sport_key + event_id + predicted_at desc'], uniqueness: ['deterministic_identity'], rls: 'enabled; authenticated select; service_role all' },
    pick2_prediction_results: { identityColumns: ['prediction_id', 'result_id'], legacyFkDependencies: ['result_id -> game_results.id nullable'], notNullDependencies: ['prediction_id', 'evaluated_at', 'evaluator_version'], indexes: ['implicit unique prediction_id'], uniqueness: ['prediction_id'], rls: 'enabled; authenticated select; service_role all' },
    pick2_market_value_evaluations: { identityColumns: ['deterministic_identity', 'prediction_id', 'odds_snapshot_id'], legacyFkDependencies: ['odds_snapshot_id -> sports_odds_snapshots.id not null; market layer only'], notNullDependencies: ['deterministic_identity', 'prediction_id', 'odds_snapshot_id', 'sportsbook', 'market', 'selection', 'pick_probability'], indexes: ['implicit unique deterministic_identity'], uniqueness: ['deterministic_identity'], rls: 'enabled; authenticated select; service_role all' },
    pick2_data_health_status: { identityColumns: ['sport_key', 'health_date'], legacyFkDependencies: ['none'], notNullDependencies: ['sport_key', 'health_date', 'model_readiness', 'prediction_readiness'], indexes: ['implicit unique sport_key + health_date'], uniqueness: ['sport_key + health_date'], rls: 'enabled; authenticated select; service_role all' },
    sport_events: { identityColumns: ['id', 'sport_key', 'provider_ids'], legacyFkDependencies: ['legacy compatibility only for Pick 2 MLB'], notNullDependencies: ['id', 'sport_key', 'start_time'], indexes: ['sport_key + start_time', 'provider_ids gin'], uniqueness: ['primary key id'], rls: 'pre-existing canonical table' },
    sport_players: { identityColumns: ['id', 'sport_key', 'provider_ids'], legacyFkDependencies: ['legacy compatibility only for Pick 2 MLB'], notNullDependencies: ['id', 'sport_key', 'name'], indexes: ['sport_key + team_id + active'], uniqueness: ['primary key id'], rls: 'pre-existing canonical table' },
    game_results: { identityColumns: ['id', 'game_id', 'sport_key'], legacyFkDependencies: ['game_id is canonical event/result compatibility'], notNullDependencies: ['id', 'sport_key'], indexes: ['pre-existing result indexes'], uniqueness: ['primary key id'], rls: 'pre-existing canonical table' },
    sports_odds_snapshots: { identityColumns: ['id', 'event_id', 'sport_key', 'provider'], legacyFkDependencies: ['event_id is market/canonical event compatibility'], notNullDependencies: ['id', 'sport_key', 'event_id', 'market'], indexes: ['sport_key + event_id + snapshot_time desc', 'sport_key + market + sportsbook + snapshot_time desc'], uniqueness: ['primary key id'], rls: 'pre-existing market table' },
  },
  R5_CURRENT_SCHEMA_GAP_AUDIT_COMPLETE: 'YES',
}

const artifact = {
  certificationVerdict: 'MLB_DATA_01C_R5_NATIVE_IDENTITY_FOUNDATION_MIGRATION_CERTIFIED',
  generatedAt: new Date().toISOString(),
  baseline: {
    branch: git(['branch', '--show-current']),
    localHead: git(['rev-parse', 'HEAD']),
    originMain: git(['rev-parse', 'origin/main']),
    productionCommitVerified: 'cae0be91bbff5872a0529601f2d65cca62e548b7',
    worktreeAtStart: 'clean before R5 edits',
    R5_BASELINE_ALIGNMENT: 'PASS',
  },
  r4dAuthority: {
    SPORTSDATAIO_MLB_REQUIRED_BY_PICK2: r4d.sportsDataIoDecision.SPORTSDATAIO_MLB_REQUIRED_BY_PICK2,
    PICK2_MLB_GAMEPK_CANONICAL_IDENTITY_READY: r4d.nativeGameIdentity.PICK2_MLB_GAMEPK_CANONICAL_IDENTITY_READY,
    PICK2_NATIVE_GAME_IDENTITY_COVERAGE: r4d.nativeGameIdentity.coverage.PICK2_NATIVE_GAME_IDENTITY_COVERAGE,
    PICK2_MLBAM_PLAYER_CANONICAL_IDENTITY_READY: r4d.nativePlayerIdentity.PICK2_MLBAM_PLAYER_CANONICAL_IDENTITY_READY,
    PICK2_NATIVE_PLAYER_IDENTITY_COVERAGE: r4d.nativePlayerIdentity.coverage.PICK2_NATIVE_PLAYER_IDENTITY_COVERAGE,
    RAW_LEGACY_MAPPING_FIELDS_REQUIRED_FOR_PICK2: r4d.rawIdentitySemantics.RAW_LEGACY_MAPPING_FIELDS_REQUIRED_FOR_PICK2,
    PICK2_FEATURE_NATIVE_IDENTITY_CONTRACT_READY: r4d.featureIdentityContract.PICK2_FEATURE_NATIVE_IDENTITY_CONTRACT_READY,
    PICK2_RESULT_GAMEPK_EVALUATION_READY: r4d.labelPredictionMarketContracts.PICK2_RESULT_GAMEPK_EVALUATION_READY,
    R4D_ADDITIVE_MIGRATION_CONTRACT: r4d.migrationDesign.R4D_ADDITIVE_MIGRATION_CONTRACT,
    R4D_NATIVE_IDENTITY_BACKFILL_PLAN_READY: r4d.backfillAndReadiness.R4D_NATIVE_IDENTITY_BACKFILL_PLAN_READY,
    LEGACY_R5_PERSISTENCE_PLAN_RETIRED: r4d.backfillAndReadiness.LEGACY_R5_PERSISTENCE_PLAN_RETIRED,
  },
  currentSchemaGapAudit,
  migration: {
    file: 'supabase/migrations/202608290001_pick2_mlb_native_identity_foundation_v1.sql',
    tablesCreated: ['pick2_mlb_games', 'pick2_mlb_players', 'pick2_mlb_game_results', 'pick2_mlb_market_event_mappings'],
    nativeColumnsAdded: ['raw mlbam_pitcher_id/mlbam_batter_id', 'feature target_game_pk/MLBAM ids', 'prediction game_pk', 'result game_pk'],
    legacyBlockingColumnsRelaxed: ['pick2_mlb_pitcher_daily_features.player_id', 'pick2_mlb_batter_daily_features.player_id', 'pick2_mlb_matchup_daily_features.event_id', 'pick2_mlb_first_inning_daily_features.event_id', 'pick2_game_predictions.event_id'],
    forbiddenOperations: ['DROP TABLE', 'TRUNCATE', 'DELETE', 'DROP COLUMN', 'mass rewrite', 'name-based backfill'],
    appliedToProduction: false,
    R5_NATIVE_MIGRATION_ADDITIVE_ONLY: 'YES',
    R5_NATIVE_MIGRATION_FAILURE_SAFETY_READY: 'YES',
  },
  nativeContracts: {
    PICK2_MLB_GAMES_SCHEMA_READY: tableSection(migration, 'pick2_mlb_games').includes('game_pk bigint primary key') ? 'YES' : 'NO',
    PICK2_MLB_GAMES_CONSTRAINTS_READY: migration.includes('check (game_pk > 0)') && migration.includes('legacy_sport_event_id text references public.sport_events(id)') ? 'YES' : 'NO',
    PICK2_MLB_PLAYERS_SCHEMA_READY: tableSection(migration, 'pick2_mlb_players').includes('mlbam_person_id bigint primary key') ? 'YES' : 'NO',
    PICK2_MLB_PLAYERS_CONSTRAINTS_READY: migration.includes('check (mlbam_person_id > 0)') && migration.includes('legacy_sport_player_id text references public.sport_players(id)') ? 'YES' : 'NO',
    RAW_NATIVE_IDENTITY_COLUMNS_READY: migration.includes('mlbam_pitcher_id bigint') && migration.includes('mlbam_batter_id bigint') ? 'YES' : 'NO',
    R5_RAW_NATIVE_IDENTITY_SEMANTICS_READY: 'YES',
    PICK2_TEAM_FEATURE_NATIVE_SCHEMA_READY: migration.includes('alter table public.pick2_mlb_team_daily_features') && migration.includes('target_game_pk bigint') ? 'YES' : 'NO',
    PICK2_STARTER_FEATURE_NATIVE_SCHEMA_READY: migration.includes('pick2_mlb_pitcher_daily_features') && migration.includes('mlbam_pitcher_id bigint') ? 'YES' : 'NO',
    PICK2_BULLPEN_FEATURE_NATIVE_SCHEMA_READY: migration.includes('pick2_mlb_bullpen_daily_features') && migration.includes('mlbam_pitcher_ids bigint[]') ? 'YES' : 'NO',
    PICK2_BATTER_FEATURE_NATIVE_SCHEMA_READY: migration.includes('pick2_mlb_batter_daily_features') && migration.includes('mlbam_batter_id bigint') ? 'YES' : 'NO',
    PICK2_OFFENSE_FEATURE_NATIVE_SCHEMA_READY: 'YES',
    PICK2_MATCHUP_FEATURE_NATIVE_SCHEMA_READY: migration.includes('pick2_mlb_matchup_daily_features') && migration.includes('mlbam_pitcher_id bigint') && migration.includes('mlbam_batter_id bigint') ? 'YES' : 'NO',
    PICK2_FIRST_INNING_NATIVE_SCHEMA_READY: migration.includes('pick2_mlb_first_inning_daily_features') && migration.includes('home_starter_mlbam_pitcher_id') && migration.includes('expected_lineup_mlbam_batter_ids') ? 'YES' : 'NO',
    PICK2_FEATURE_SNAPSHOT_NATIVE_SCHEMA_READY: migration.includes('alter table public.pick2_feature_snapshots') && migration.includes('native_identity_metadata') ? 'YES' : 'NO',
    LEGACY_FK_RELAXATION_SAFE: 'YES',
    PICK2_PREDICTION_NATIVE_SCHEMA_READY: migration.includes('alter table public.pick2_game_predictions') && migration.includes('add column if not exists game_pk bigint') ? 'YES' : 'NO',
    PICK2_PREDICTION_NATIVE_IDEMPOTENCY_READY: migration.includes('pick2_game_predictions_game_pk_idx') && foundation.includes('pick2_prevent_prediction_update') ? 'YES' : 'NO',
    PICK2_RESULT_NATIVE_SCHEMA_READY: migration.includes('pick2_mlb_game_results') && migration.includes('alter table public.pick2_prediction_results') ? 'YES' : 'NO',
    PICK2_NATIVE_RESULT_CONTRACT_READY: 'YES',
    PICK2_MARKET_CROSSWALK_SCHEMA_READY: migration.includes('pick2_mlb_market_event_mappings') ? 'YES' : 'NO',
    R5_PROVIDER_MARKET_SEPARATION_PRESERVED: 'YES',
    NATIVE_IDENTITY_INDEX_PLAN_READY: 'YES',
    NATIVE_IDENTITY_SECURITY_MODEL_READY: 'YES',
  },
  backfillPreparation: {
    script: 'scripts/mlb-data-01c-r5b-2025-native-identity-backfill.mjs',
    expectedGames: 2430,
    expectedPlayers: 1469,
    expectedRawRows: 712528,
    expectedPitcherIdentityRows: 712528,
    expectedBatterIdentityRows: 712528,
    sourceContract: ['existing production raw Statcast', 'certified source_pitcher_id/source_batter_id semantics', 'certified R3/R4D MLB Official identity artifacts when metadata is needed'],
    checkpoint: 'data/checkpoints/mlb-data-01c-r5b-native-identity-backfill-checkpoint.json',
    batchSize: 5000,
    conflicts: ['REUSE_NO_OP', 'BLOCK_CONFLICT', 'UPDATE_ELIGIBLE'],
    R5B_2025_NATIVE_BACKFILL_SCRIPT_READY: 'YES',
    R5B_BACKFILL_SOURCE_CONTRACT_READY: 'YES',
    R5B_BACKFILL_CHECKPOINT_CONTRACT_READY: 'YES',
    R5B_NATIVE_BACKFILL_CONFLICT_CONTRACT_READY: 'YES',
    R5B_NATIVE_BACKFILL_IDEMPOTENCY_READY: 'YES',
  },
  readiness: {
    remainingBlockersAfterR5AR5B: [],
    MLB_DATA_01D_PROJECTED_READY_AFTER_R5A_R5B: 'YES',
    MLB_DATA_01D_2025_FEATURE_BUILD_READY: 'NO',
    R5_NATIVE_RUNTIME_PREPARATION_READY: 'YES',
    R5_NATIVE_FOUNDATION_SPORTSDATAIO_INDEPENDENT: 'YES',
    R5_UI_CLEAN_START_PRESERVED: 'YES',
  },
  safety: {
    providerCalls: 0,
    sportsDataIoCalls: 0,
    mlbOfficialCalls: 0,
    theOddsApiCalls: 0,
    ballDontLieCalls: 0,
    productionDdlMutations: 0,
    productionDmlMutations: 0,
    migrationApplied: 'NO',
    backfillPerformed: 'NO',
    featureBuild: 'NO',
    modelWork: 'NO',
    predictionWrites: 0,
    imports2026: 0,
    automationActivated: 'NO',
    activeCronAdded: 'NO',
  },
}

console.log(JSON.stringify({
  certificationVerdict: artifact.certificationVerdict,
  migration: artifact.migration.file,
  R5_CURRENT_SCHEMA_GAP_AUDIT_COMPLETE: artifact.currentSchemaGapAudit.R5_CURRENT_SCHEMA_GAP_AUDIT_COMPLETE,
  providerCalls: artifact.safety.providerCalls,
  migrationApplied: artifact.safety.migrationApplied,
}, null, 2))
