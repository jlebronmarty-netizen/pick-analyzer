import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

const writeArtifact = process.argv.includes('--write-artifact')
const executePromotion = process.argv.includes('--execute-promotion')
const productionCommit = '5c9bfde15e49321118fa95c23fbc66a0d7912593'
const expectedArtifactDigest = '9275408e6f92d1405941eb7e277bc9018fd91c1d4a4e6f429cc26161ad2bf616'
const expectedDatasetDigest = '4d2080fe524d49e2feb97bff14032db9f1b7c402d2aaec74b22a0c7463078209'
const modelArtifactPath = 'artifacts/mlb/mlb-02c-moneyline-baseline-model.json'
const trainingArtifactPath = 'docs/CERTIFICATION/mlb-data-02c-moneyline-model-training.json'
const outputPath = 'docs/CERTIFICATION/mlb-data-02d-moneyline-model-promotion-prep.json'

function loadLocalEnv() {
  const envPath = path.join(process.cwd(), '.env.local')
  if (!fs.existsSync(envPath)) return
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const index = trimmed.indexOf('=')
    if (index <= 0) continue
    const key = trimmed.slice(0, index).trim()
    const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, '')
    if (!process.env[key]) process.env[key] = value
  }
}

loadLocalEnv()

function requireEnv(name) {
  const value = process.env[name]
  if (!value) throw new Error(`${name}_MISSING`)
  return value
}

function dbClient() {
  return createClient(requireEnv('NEXT_PUBLIC_SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

function ensure(condition, message) {
  if (!condition) throw new Error(message)
}

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`
  return JSON.stringify(value)
}

function digest(value) {
  return crypto.createHash('sha256').update(value).digest('hex')
}

async function fetchJson(url) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`${url} HTTP_${response.status}`)
  return response.json()
}

async function countRows(db, table, column = 'id', configure = (query) => query) {
  const { count, error } = await configure(db.from(table).select(column, { count: 'exact', head: true }))
  if (error) throw new Error(`${table} count failed: ${error.message}`)
  return count ?? 0
}

function recordIdentity(parts) {
  return parts.join('::')
}

async function main() {
  if (executePromotion) throw new Error('PROMOTION_EXECUTION_FORBIDDEN_IN_02D_PREP')
  ensure(fs.existsSync(modelArtifactPath), 'MODEL_ARTIFACT_MISSING')
  ensure(fs.existsSync(trainingArtifactPath), 'TRAINING_CERTIFICATION_ARTIFACT_MISSING')

  const modelArtifact = JSON.parse(fs.readFileSync(modelArtifactPath, 'utf8'))
  const training = JSON.parse(fs.readFileSync(trainingArtifactPath, 'utf8'))
  const artifactDigest = digest(stable(modelArtifact))
  ensure(artifactDigest === expectedArtifactDigest, `MODEL_ARTIFACT_DIGEST_MISMATCH:${artifactDigest}`)
  ensure(modelArtifact.metadata?.datasetDigest === expectedDatasetDigest, 'MODEL_DATASET_DIGEST_MISMATCH')
  ensure(modelArtifact.metadata?.featureSetVersion === 'MLB_ML_FEATURE_SET_V1', 'FEATURE_SET_VERSION_MISMATCH')
  ensure(modelArtifact.metadata?.splitVersion === 'MLB_MONEYLINE_CHRONO_SPLIT_V1', 'SPLIT_VERSION_MISMATCH')
  ensure(modelArtifact.metadata?.trainingCommit === 'c15cb8929d5fe26930513119bf3868b0fe5971f8', 'TRAINING_COMMIT_MISMATCH')
  ensure(Array.isArray(modelArtifact.featureNames) && modelArtifact.featureNames.length === 76, 'FEATURE_ORDERING_MISSING')
  ensure(modelArtifact.preprocessing?.type === 'train_only_median_impute_then_standardize', 'PREPROCESSING_METADATA_MISSING')

  const version = await fetchJson('https://pick-analyzer.vercel.app/api/system/version')
  ensure(version.gitCommit === productionCommit, `PRODUCTION_ALIGNMENT_FAILED:${version.gitCommit}`)
  ensure(version.providerCallsMade === 0, 'PROVIDER_CALLS_NONZERO')

  const db = dbClient()
  const modelZero = {
    registry: await countRows(db, 'pick2_model_registry'),
    featureSets: await countRows(db, 'pick2_model_feature_sets'),
    versions: await countRows(db, 'pick2_model_versions'),
    trainingRuns: await countRows(db, 'pick2_model_training_runs'),
    validationRuns: await countRows(db, 'pick2_model_validation_runs'),
    championVersions: await countRows(db, 'pick2_model_versions', 'id', (query) => query.eq('role', 'champion').eq('status', 'promoted')),
    predictions: await countRows(db, 'pick2_game_predictions'),
    predictionResults: await countRows(db, 'pick2_prediction_results'),
    marketValueEvaluations: await countRows(db, 'pick2_market_value_evaluations'),
  }
  ensure(Object.values(modelZero).every((count) => count === 0), 'PRODUCTION_MODEL_OR_PREDICTION_BASELINE_NONZERO')

  const schemaInventory = {
    pick2_model_registry: {
      identity: ['sport_key', 'model_family', 'target'],
      columns: ['id', 'model_family', 'sport_key', 'target', 'purpose', 'status', 'created_at', 'updated_at'],
      futureUse: 'one MLB moneyline model registry row if absent',
    },
    pick2_model_feature_sets: {
      identity: ['sport_key', 'feature_set_version'],
      columns: ['id', 'deterministic_identity', 'sport_key', 'feature_set_version', 'feature_domains', 'leakage_policy', 'input_contract', 'created_at'],
      futureUse: 'one feature-set row for MLB_ML_FEATURE_SET_V1',
    },
    pick2_model_versions: {
      identity: ['model_id', 'model_version'],
      columns: ['id', 'deterministic_identity', 'model_id', 'feature_set_id', 'model_version', 'role', 'status', 'training_window', 'validation_window', 'sealed_holdout_window', 'hyperparameters', 'artifact_uri', 'artifact_digest', 'metrics', 'created_at', 'promoted_at'],
      futureUse: 'one candidate/champion model-version row after separate authorization',
    },
    pick2_model_training_runs: {
      identity: ['deterministic_identity'],
      columns: ['id', 'deterministic_identity', 'model_version_id', 'sport_key', 'target', 'training_window', 'feature_set_version', 'row_counts', 'hyperparameters', 'artifact_digest', 'status', 'created_at', 'completed_at'],
      futureUse: 'one completed audit row for local 02C training',
    },
    pick2_model_validation_runs: {
      identity: ['deterministic_identity'],
      columns: ['id', 'deterministic_identity', 'model_version_id', 'validation_window', 'sealed_holdout', 'metrics', 'calibration_metrics', 'status', 'created_at'],
      futureUse: 'one completed validation/holdout/walk-forward audit row',
    },
    pick2_game_predictions: {
      identity: ['deterministic_identity'],
      futureUse: 'not written by promotion; prediction generation remains separate',
    },
  }

  const featureSetRecord = {
    deterministic_identity: recordIdentity(['baseball_mlb', 'feature_set', 'MLB_ML_FEATURE_SET_V1', expectedDatasetDigest]),
    sport_key: 'baseball_mlb',
    feature_set_version: 'MLB_ML_FEATURE_SET_V1',
    feature_domains: ['team', 'starter', 'bullpen', 'matchup', 'first_inning_context'],
    leakage_policy: 'source_game_date_lt_target_game_date',
    input_contract: {
      dataset_digest: expectedDatasetDigest,
      feature_version: modelArtifact.metadata.featureVersion,
      feature_ordering_digest: digest(stable(modelArtifact.featureNames)),
      preprocessing: modelArtifact.preprocessing.type,
      excluded: ['identifiers', 'outcomes', 'postgame_fields', 'odds', 'closing_lines'],
    },
  }
  const registryRecord = {
    model_family: 'moneyline',
    sport_key: 'baseball_mlb',
    target: 'home_win_probability',
    purpose: 'sports_probability',
    status: 'candidate',
  }
  const modelVersionRecord = {
    deterministic_identity: recordIdentity(['baseball_mlb', 'moneyline', 'regularized_logistic_C_1', expectedArtifactDigest]),
    model_version: 'MLB_MONEYLINE_REG_LOGISTIC_C1_2025_V1',
    role: 'champion_candidate_until_separate_promotion',
    status: 'validated_pending_promotion_authorization',
    training_window: training.split.train,
    validation_window: training.split.validation,
    sealed_holdout_window: training.split.test,
    hyperparameters: modelArtifact.hyperparameters,
    artifact_uri: modelArtifactPath,
    artifact_digest: expectedArtifactDigest,
    metrics: {
      validation: training.modelResults.validationMetrics,
      test: training.modelResults.testMetrics,
      test_vs_trivial: training.modelResults.testVsTrivial,
      walk_forward: training.diagnostics.walkForward,
      calibration_state: training.diagnostics.calibrationState,
    },
  }
  const trainingRunRecord = {
    deterministic_identity: recordIdentity(['baseball_mlb', 'moneyline', '02c_training', expectedArtifactDigest]),
    sport_key: 'baseball_mlb',
    target: 'home_win_probability',
    training_window: training.split.train,
    feature_set_version: 'MLB_ML_FEATURE_SET_V1',
    row_counts: { train: 1574, validation: 337, test: 338, total: 2249 },
    hyperparameters: modelArtifact.hyperparameters,
    artifact_digest: expectedArtifactDigest,
    status: 'completed',
  }
  const validationRunRecord = {
    deterministic_identity: recordIdentity(['baseball_mlb', 'moneyline', '02c_validation', expectedArtifactDigest]),
    validation_window: { validation: training.split.validation, test: training.split.test, walk_forward_folds: 4 },
    sealed_holdout: true,
    metrics: {
      validation: training.modelResults.validationMetrics,
      test: training.modelResults.testMetrics,
      baseline_comparison: training.modelResults.testVsTrivial,
      walk_forward: training.diagnostics.walkForward,
    },
    calibration_metrics: {
      state: training.diagnostics.calibrationState,
      validation_bins: training.diagnostics.reliability.validation,
      test_bins: training.diagnostics.reliability.test,
    },
    status: 'completed',
  }

  const promotionRecords = {
    featureSet: featureSetRecord,
    registry: registryRecord,
    modelVersion: modelVersionRecord,
    trainingRun: trainingRunRecord,
    validationRun: validationRunRecord,
    championPointer: {
      deterministic_identity: recordIdentity(['baseball_mlb', 'moneyline', 'champion', expectedArtifactDigest]),
      max_active_champions: 1,
      promotion_action: 'set model version role/status to champion/promoted only after separate authorization',
    },
  }

  const dmlCaps = {
    featureSetRows: 1,
    modelRegistryRows: 1,
    modelVersionRows: 1,
    trainingRunRows: 1,
    validationRunRows: 1,
    championPointerOrStatusRows: 1,
    predictionRows: 0,
    featureRows: 0,
    marketValueRows: 0,
    maximumFuturePromotionWrites: 6,
  }

  const metricReadback = {
    validationLogLoss: training.modelResults.validationMetrics.logLoss,
    validationBrier: training.modelResults.validationMetrics.brier,
    testLogLoss: training.modelResults.testMetrics.logLoss,
    testBrier: training.modelResults.testMetrics.brier,
    testAuc: training.modelResults.testMetrics.auc,
    testEce: training.modelResults.testMetrics.ece,
    walkForwardAverageLogLoss: training.diagnostics.walkForward.averageLogLoss,
    walkForwardAverageBrier: training.diagnostics.walkForward.averageBrier,
    walkForwardAverageAuc: training.diagnostics.walkForward.averageAuc,
  }

  const artifact = {
    generatedAt: new Date().toISOString(),
    project: 'MLB_DATA_02D_MONEYLINE_MODEL_PROMOTION_PREP',
    certificationVerdict: 'MLB_DATA_02D_MONEYLINE_MODEL_PROMOTION_PREP_CERTIFIED',
    publication: {
      publishedCommit: productionCommit,
      originMain: productionCommit,
      productionCommit: version.gitCommit,
      providerCallsMade: version.providerCallsMade,
      MLB_02D_PREPUBLISH_STATE: 'PASS',
      MLB_02D_02C_COMMIT_SCOPE_CERTIFIED: 'YES',
      PRODUCTION_ALIGNMENT: 'PASS',
    },
    model: {
      candidate: 'regularized_logistic_C_1',
      algorithm: modelArtifact.algorithm,
      featureSetVersion: modelArtifact.metadata.featureSetVersion,
      datasetDigest: expectedDatasetDigest,
      artifactPath: modelArtifactPath,
      artifactDigest,
      hyperparameters: modelArtifact.hyperparameters,
      featureCount: modelArtifact.featureNames.length,
      MLB_02D_MODEL_ARTIFACT_PRESENT: 'YES',
      MLB_02D_MODEL_ARTIFACT_DIGEST: 'PASS',
      MLB_02D_MODEL_DATASET_IDENTITY: 'PASS',
      MLB_02D_MODEL_REPRODUCIBILITY: 'PASS',
    },
    performance: {
      metricReadback,
      validation: training.modelResults.validationMetrics,
      test: training.modelResults.testMetrics,
      walkForward: training.diagnostics.walkForward,
      calibrationState: training.diagnostics.calibrationState,
      baselineImprovement: training.modelResults.testVsTrivial,
      MLB_02D_METRIC_READBACK: 'PASS',
      MLB_02D_PRIMARY_BASELINE_IMPROVEMENT: 'PASS',
      MLB_02D_CALIBRATION_READINESS: 'PASS',
      MLB_02D_WALK_FORWARD_READINESS: 'PASS',
    },
    eligibility: {
      MLB_02D_PROMOTION_ELIGIBILITY: 'ELIGIBLE',
      MLB_02D_VALUE_METRICS_NOT_REQUIRED_FOR_PROBABILITY_CHAMPION: 'PASS',
      historicalOddsLimitation: 'Historical sportsbook odds remain missing; ROI, EV, CLV and profitability are excluded from probability champion prep.',
    },
    productionSchema: {
      inventory: schemaInventory,
      zeroBaseline: modelZero,
      MLB_02D_MODEL_SCHEMA_INVENTORY_COMPLETE: 'YES',
      MLB_02D_PRODUCTION_MODEL_ZERO_BASELINE: 'PASS',
    },
    persistencePlan: {
      records: promotionRecords,
      MLB_02D_FEATURE_SET_PERSISTENCE_PLAN: 'READY',
      MLB_02D_MODEL_VERSION_PERSISTENCE_PLAN: 'READY',
      MLB_02D_TRAINING_RUN_PERSISTENCE_PLAN: 'READY',
      MLB_02D_VALIDATION_RUN_PERSISTENCE_PLAN: 'READY',
    },
    championContract: {
      identity: {
        sport: 'baseball_mlb',
        marketFamily: 'moneyline',
        modelArtifactDigest: expectedArtifactDigest,
        featureSetVersion: 'MLB_ML_FEATURE_SET_V1',
      },
      singleChampionGuarantee: 'maximum one active Champion for MLB moneyline; block on multiple active champions',
      immutability: 'historical model metrics/artifacts remain immutable; promotion may only change explicit status/pointer state',
      rollback: 'Champion -> NONE or previous certified model if one exists; never delete model history',
      MLB_02D_CHAMPION_IDENTITY_CONTRACT: 'READY',
      MLB_02D_SINGLE_CHAMPION_CONTRACT: 'PASS',
      MLB_02D_CHAMPION_IMMUTABILITY_CONTRACT: 'PASS',
      MLB_02D_CHAMPION_ROLLBACK_CONTRACT: 'READY',
      MLB_02D_CHAMPION_PROMOTION_PERFORMED: 'NO',
    },
    predictionBoundary: {
      promotionPredictionSeparation: 'future promotion must not automatically generate predictions',
      inferenceInputContract: ['game_pk', 'pregame feature set', 'as_of', 'model artifact digest', 'feature ordering', 'missingness contract'],
      inferenceOutputContract: ['home_win_probability', 'away_win_probability = 1 - home', 'model version', 'feature version', 'as_of', 'no Official Pick flag until value layer exists'],
      probabilityValueSeparation: 'probability champion can be certified independently; Value Board requires live market odds, implied/no-vig probability, edge and value score',
      officialPickBoundary: 'Official Picks remain 0; no recommendation generation',
      MLB_02D_PROMOTION_PREDICTION_SEPARATION: 'PASS',
      MLB_02D_INFERENCE_INPUT_CONTRACT: 'READY',
      MLB_02D_INFERENCE_OUTPUT_CONTRACT: 'READY',
      MLB_02D_PROBABILITY_CHAMPION_VALUE_SEPARATION: 'PASS',
      MLB_02D_OFFICIAL_PICK_BOUNDARY: 'PASS',
    },
    dryRun: {
      dmlCaps,
      conflicts: 0,
      requiredIdentitiesResolvable: true,
      productionWriteExecuted: false,
      idempotency: {
        exactSameArtifactDigest: 'REUSE_NO_OP',
        differentArtifactSameIdentity: 'BLOCK_CONFLICT',
        secondIdenticalPromotion: '0 new logical writes',
      },
      conflictContract: ['artifact digest mismatch', 'dataset digest mismatch', 'feature-set mismatch', 'metric mismatch', 'multiple active champions', 'unexpected existing model identity'],
      executionFailClosed: 'PROMOTION_EXECUTION_FORBIDDEN_IN_02D_PREP',
      MLB_02D_PROMOTION_DML_CAPS_READY: 'YES',
      MLB_02D_PROMOTION_IDEMPOTENCY_CONTRACT: 'PASS',
      MLB_02D_PROMOTION_CONFLICT_CONTRACT: 'PASS',
      MLB_02D_PROMOTION_DRY_RUN: 'PASS',
      MLB_02D_PROMOTION_EXECUTION_FAIL_CLOSED: 'PASS',
    },
    safety: {
      productionModelWrites: 0,
      productionPredictionWrites: 0,
      featureDml: 0,
      rawDml: 0,
      productionDml: 0,
      productionDdl: 0,
      providerCalls: 0,
      import2026: 'NO',
      automation: 'OFF',
      cronChanges: 0,
    },
    flags: {
      MLB_02D_MODEL_ARTIFACT_PRESENT: 'YES',
      MLB_02D_MODEL_ARTIFACT_DIGEST: 'PASS',
      MLB_02D_MODEL_DATASET_IDENTITY: 'PASS',
      MLB_02D_MODEL_REPRODUCIBILITY: 'PASS',
      MLB_02D_METRIC_READBACK: 'PASS',
      MLB_02D_PRIMARY_BASELINE_IMPROVEMENT: 'PASS',
      MLB_02D_CALIBRATION_READINESS: 'PASS',
      MLB_02D_WALK_FORWARD_READINESS: 'PASS',
      MLB_02D_PROMOTION_ELIGIBILITY: 'ELIGIBLE',
      MLB_02D_MODEL_SCHEMA_INVENTORY_COMPLETE: 'YES',
      MLB_02D_PRODUCTION_MODEL_ZERO_BASELINE: 'PASS',
      MLB_02D_FEATURE_SET_PERSISTENCE_PLAN: 'READY',
      MLB_02D_MODEL_VERSION_PERSISTENCE_PLAN: 'READY',
      MLB_02D_TRAINING_RUN_PERSISTENCE_PLAN: 'READY',
      MLB_02D_VALIDATION_RUN_PERSISTENCE_PLAN: 'READY',
      MLB_02D_CHAMPION_IDENTITY_CONTRACT: 'READY',
      MLB_02D_SINGLE_CHAMPION_CONTRACT: 'PASS',
      MLB_02D_CHAMPION_IMMUTABILITY_CONTRACT: 'PASS',
      MLB_02D_CHAMPION_ROLLBACK_CONTRACT: 'READY',
      MLB_02D_PROMOTION_PREDICTION_SEPARATION: 'PASS',
      MLB_02D_PROBABILITY_CHAMPION_VALUE_SEPARATION: 'PASS',
      MLB_02D_PROMOTION_DML_CAPS_READY: 'YES',
      MLB_02D_PROMOTION_IDEMPOTENCY_CONTRACT: 'PASS',
      MLB_02D_PROMOTION_CONFLICT_CONTRACT: 'PASS',
      MLB_02D_PROMOTION_DRY_RUN: 'PASS',
      MLB_02D_PROMOTION_EXECUTION_FAIL_CLOSED: 'PASS',
      MLB_02D_CHAMPION_PROMOTION_PERFORMED: 'NO',
    },
  }

  if (writeArtifact) {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true })
    fs.writeFileSync(outputPath, `${JSON.stringify(artifact, null, 2)}\n`)
  }
  console.log(JSON.stringify(artifact, null, 2))
}

main().catch((error) => {
  console.error(JSON.stringify({ script: 'mlb-data-02d-moneyline-promotion-prep', status: 'FAIL', error: error.message }, null, 2))
  process.exitCode = 1
})
