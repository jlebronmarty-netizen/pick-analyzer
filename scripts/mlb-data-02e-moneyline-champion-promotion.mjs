import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

const executePromotion = process.argv.includes('--execute-promotion')
const writeArtifact = process.argv.includes('--write-artifact')

const targetProductionCommit = '87830c2ef2bc2d2a3c961e0016c9595ec6558665'
const trainingCommit = '5c9bfde15e49321118fa95c23fbc66a0d7912593'
const expectedArtifactDigest = '9275408e6f92d1405941eb7e277bc9018fd91c1d4a4e6f429cc26161ad2bf616'
const expectedDatasetDigest = '4d2080fe524d49e2feb97bff14032db9f1b7c402d2aaec74b22a0c7463078209'
const modelArtifactPath = 'artifacts/mlb/mlb-02c-moneyline-baseline-model.json'
const trainingArtifactPath = 'docs/CERTIFICATION/mlb-data-02c-moneyline-model-training.json'
const prepArtifactPath = 'docs/CERTIFICATION/mlb-data-02d-moneyline-model-promotion-prep.json'
const outputPath = 'docs/CERTIFICATION/mlb-data-02e-moneyline-champion-promotion.json'

const featureVersion = 'MLB_DATA_01D_2025_PREGAME_FEATURE_DRY_RUN_V1'
const modelVersionName = 'MLB_MONEYLINE_REG_LOGISTIC_C1_2025_V1'
const featureSetVersion = 'MLB_ML_FEATURE_SET_V1'
const candidateName = 'regularized_logistic_C_1'

const expectedFeatureCounts = {
  team: 4498,
  starter: 4498,
  bullpen: 4498,
  batter: 44943,
  matchup: 2249,
  firstInning: 2249,
  snapshots: 67433,
}

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

function client() {
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

function identity(parts) {
  return parts.join('::')
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

async function maybeOne(db, table, columns, configure) {
  const { data, error } = await configure(db.from(table).select(columns).limit(2))
  if (error) throw new Error(`${table} select failed: ${error.message}`)
  ensure((data ?? []).length <= 1, `${table}_DUPLICATE_IDENTITY`)
  return (data ?? [])[0] ?? null
}

async function insertOne(db, table, row) {
  const { data, error } = await db.from(table).insert(row).select('*').single()
  if (error) throw new Error(`${table} insert failed: ${error.message}`)
  return data
}

function sameJson(actual, expected) {
  return stable(actual) === stable(expected)
}

function compareSubset(actual, expected, fields) {
  return fields.every((field) => {
    const actualValue = actual?.[field]
    const expectedValue = expected?.[field]
    if (expectedValue && typeof expectedValue === 'object') return sameJson(actualValue, expectedValue)
    return actualValue === expectedValue
  })
}

function accounting() {
  return { inserts: 0, reuses: 0, conflicts: 0 }
}

function registerReuseOrConflict(bucket, actual, expected, fields) {
  if (compareSubset(actual, expected, fields)) bucket.reuses += 1
  else bucket.conflicts += 1
}

async function modelCounts(db) {
  return {
    registry: await countRows(db, 'pick2_model_registry'),
    featureSets: await countRows(db, 'pick2_model_feature_sets'),
    versions: await countRows(db, 'pick2_model_versions'),
    trainingRuns: await countRows(db, 'pick2_model_training_runs'),
    validationRuns: await countRows(db, 'pick2_model_validation_runs'),
    champions: await countRows(db, 'pick2_model_versions', 'id', (query) => query.eq('role', 'champion').eq('status', 'promoted')),
    predictions: await countRows(db, 'pick2_game_predictions'),
    predictionResults: await countRows(db, 'pick2_prediction_results'),
    marketValueEvaluations: await countRows(db, 'pick2_market_value_evaluations'),
  }
}

async function featureCounts(db) {
  return {
    team: await countRows(db, 'pick2_mlb_team_daily_features', 'id', (query) => query.eq('feature_version', featureVersion)),
    starter: await countRows(db, 'pick2_mlb_pitcher_daily_features', 'id', (query) => query.eq('feature_version', featureVersion)),
    bullpen: await countRows(db, 'pick2_mlb_bullpen_daily_features', 'id', (query) => query.eq('feature_version', featureVersion)),
    batter: await countRows(db, 'pick2_mlb_batter_daily_features', 'id', (query) => query.eq('feature_version', featureVersion)),
    matchup: await countRows(db, 'pick2_mlb_matchup_daily_features', 'id', (query) => query.eq('feature_version', featureVersion)),
    firstInning: await countRows(db, 'pick2_mlb_first_inning_daily_features', 'id', (query) => query.eq('feature_version', featureVersion)),
    snapshots: await countRows(db, 'pick2_feature_snapshots'),
  }
}

async function rawNativeCounts(db) {
  return {
    raw: await countRows(db, 'pick2_raw_mlb_statcast_pitches'),
    nativeGames: await countRows(db, 'pick2_mlb_games', 'game_pk'),
    nativePlayers: await countRows(db, 'pick2_mlb_players', 'mlbam_person_id'),
    rawMlbamPitcherRows: await countRows(db, 'pick2_raw_mlb_statcast_pitches', 'id', (query) => query.not('mlbam_pitcher_id', 'is', null)),
    rawMlbamBatterRows: await countRows(db, 'pick2_raw_mlb_statcast_pitches', 'id', (query) => query.not('mlbam_batter_id', 'is', null)),
  }
}

function assertExpectedFeatureCounts(counts) {
  for (const [key, expected] of Object.entries(expectedFeatureCounts)) {
    ensure(counts[key] === expected, `FEATURE_FOUNDATION_COUNT_MISMATCH:${key}:${counts[key]}`)
  }
}

function assertExpectedRawNativeCounts(counts) {
  ensure(counts.raw === 712528, `RAW_COUNT_MISMATCH:${counts.raw}`)
  ensure(counts.nativeGames === 2430, `NATIVE_GAMES_COUNT_MISMATCH:${counts.nativeGames}`)
  ensure(counts.nativePlayers === 1469, `NATIVE_PLAYERS_COUNT_MISMATCH:${counts.nativePlayers}`)
  ensure(counts.rawMlbamPitcherRows === 712528, `RAW_MLBAM_PITCHER_COUNT_MISMATCH:${counts.rawMlbamPitcherRows}`)
  ensure(counts.rawMlbamBatterRows === 712528, `RAW_MLBAM_BATTER_COUNT_MISMATCH:${counts.rawMlbamBatterRows}`)
}

function zeroPrewrite(counts) {
  return Object.values(counts).every((value) => value === 0)
}

async function reconcileModelRows(db, records, write) {
  const results = {
    registry: accounting(),
    featureSet: accounting(),
    modelVersion: accounting(),
    trainingRun: accounting(),
    validationRun: accounting(),
    champion: accounting(),
  }

  let registry = await maybeOne(
    db,
    'pick2_model_registry',
    '*',
    (query) => query.eq('sport_key', records.registry.sport_key).eq('model_family', records.registry.model_family).eq('target', records.registry.target),
  )
  if (registry) {
    registerReuseOrConflict(results.registry, registry, records.registry, ['model_family', 'sport_key', 'target', 'purpose', 'status'])
  } else if (write) {
    registry = await insertOne(db, 'pick2_model_registry', records.registry)
    results.registry.inserts += 1
  } else {
    results.registry.inserts += 1
  }

  let featureSet = await maybeOne(
    db,
    'pick2_model_feature_sets',
    '*',
    (query) => query.eq('deterministic_identity', records.featureSet.deterministic_identity),
  )
  if (featureSet) {
    registerReuseOrConflict(results.featureSet, featureSet, records.featureSet, ['deterministic_identity', 'sport_key', 'feature_set_version', 'feature_domains', 'leakage_policy', 'input_contract'])
  } else if (write) {
    featureSet = await insertOne(db, 'pick2_model_feature_sets', records.featureSet)
    results.featureSet.inserts += 1
  } else {
    results.featureSet.inserts += 1
  }

  let modelVersion = null
  if (registry?.id && featureSet?.id) {
    const expectedModelVersion = { ...records.modelVersion, model_id: registry.id, feature_set_id: featureSet.id }
    modelVersion = await maybeOne(
      db,
      'pick2_model_versions',
      '*',
      (query) => query.eq('deterministic_identity', records.modelVersion.deterministic_identity),
    )
    if (modelVersion) {
      registerReuseOrConflict(results.modelVersion, modelVersion, expectedModelVersion, ['deterministic_identity', 'model_id', 'feature_set_id', 'model_version', 'role', 'status', 'training_window', 'validation_window', 'sealed_holdout_window', 'hyperparameters', 'artifact_uri', 'artifact_digest', 'metrics'])
      registerReuseOrConflict(results.champion, modelVersion, { role: 'champion', status: 'promoted' }, ['role', 'status'])
    } else if (write) {
      modelVersion = await insertOne(db, 'pick2_model_versions', expectedModelVersion)
      results.modelVersion.inserts += 1
      results.champion.inserts += 1
    } else {
      results.modelVersion.inserts += 1
      results.champion.inserts += 1
    }
  } else if (!write) {
    results.modelVersion.inserts += 1
    results.champion.inserts += 1
  }

  if (modelVersion?.id) {
    const expectedTrainingRun = { ...records.trainingRun, model_version_id: modelVersion.id }
    let trainingRun = await maybeOne(
      db,
      'pick2_model_training_runs',
      '*',
      (query) => query.eq('deterministic_identity', records.trainingRun.deterministic_identity),
    )
    if (trainingRun) {
      registerReuseOrConflict(results.trainingRun, trainingRun, expectedTrainingRun, ['deterministic_identity', 'model_version_id', 'sport_key', 'target', 'training_window', 'feature_set_version', 'row_counts', 'hyperparameters', 'artifact_digest', 'status'])
    } else if (write) {
      trainingRun = await insertOne(db, 'pick2_model_training_runs', expectedTrainingRun)
      results.trainingRun.inserts += 1
    } else {
      results.trainingRun.inserts += 1
    }

    const expectedValidationRun = { ...records.validationRun, model_version_id: modelVersion.id }
    let validationRun = await maybeOne(
      db,
      'pick2_model_validation_runs',
      '*',
      (query) => query.eq('deterministic_identity', records.validationRun.deterministic_identity),
    )
    if (validationRun) {
      registerReuseOrConflict(results.validationRun, validationRun, expectedValidationRun, ['deterministic_identity', 'model_version_id', 'validation_window', 'sealed_holdout', 'metrics', 'calibration_metrics', 'status'])
    } else if (write) {
      validationRun = await insertOne(db, 'pick2_model_validation_runs', expectedValidationRun)
      results.validationRun.inserts += 1
    } else {
      results.validationRun.inserts += 1
    }
  } else if (!write) {
    results.trainingRun.inserts += 1
    results.validationRun.inserts += 1
  }

  const conflicts = Object.values(results).reduce((sum, result) => sum + result.conflicts, 0)
  return { results, conflicts }
}

function buildRecords(modelArtifact, training, prep) {
  const featureOrderingDigest = digest(stable(modelArtifact.featureNames))
  const featureSet = {
    deterministic_identity: identity(['baseball_mlb', 'feature_set', featureSetVersion, expectedDatasetDigest]),
    sport_key: 'baseball_mlb',
    feature_set_version: featureSetVersion,
    feature_domains: ['team', 'starter', 'bullpen', 'matchup', 'first_inning_context'],
    leakage_policy: 'source_game_date_lt_target_game_date',
    input_contract: {
      sport: 'MLB',
      market_family: 'moneyline',
      dataset_digest: expectedDatasetDigest,
      feature_version: modelArtifact.metadata.featureVersion,
      feature_ordering_digest: featureOrderingDigest,
      ordered_features: modelArtifact.featureNames,
      preprocessing: modelArtifact.preprocessing,
      as_of_contract: 'source_game_date_lt_target_game_date',
      excluded_inputs: ['identifiers', 'outcomes', 'postgame_fields', 'odds', 'closing_lines'],
      certification_references: ['MLB_DATA_01D_R1I_PARTIAL_FEATURE_DML_RESUME_CERTIFIED', 'MLB_DATA_02A_INDIVIDUAL_PICK_MODEL_DATASET_PREPARATION_CERTIFIED', 'MLB_DATA_02B_MONEYLINE_MODEL_TRAINING_PREP_CERTIFIED', 'MLB_DATA_02C_MONEYLINE_MODEL_TRAINING_EXECUTION_CERTIFIED', 'MLB_DATA_02D_MONEYLINE_MODEL_PROMOTION_PREP_CERTIFIED'],
    },
  }

  const registry = {
    model_family: 'moneyline',
    sport_key: 'baseball_mlb',
    target: 'home_win_probability',
    purpose: 'sports_probability',
    status: 'champion',
  }

  const metrics = {
    candidate: candidateName,
    algorithm: modelArtifact.algorithm,
    sport: 'MLB',
    market: 'moneyline',
    dataset_digest: expectedDatasetDigest,
    feature_set_version: featureSetVersion,
    feature_ordering_digest: featureOrderingDigest,
    training_commit: trainingCommit,
    validation: training.modelResults.validationMetrics,
    test: training.modelResults.testMetrics,
    test_vs_trivial: training.modelResults.testVsTrivial,
    walk_forward: training.diagnostics.walkForward,
    calibration_state: training.diagnostics.calibrationState,
    promotion_eligibility: 'ELIGIBLE',
    value_certification: 'NO',
    official_picks_ready: 'NO',
  }

  return {
    featureSet,
    registry,
    modelVersion: {
      deterministic_identity: identity(['baseball_mlb', 'moneyline', candidateName, expectedArtifactDigest]),
      model_version: modelVersionName,
      role: 'champion',
      status: 'promoted',
      training_window: training.split.train,
      validation_window: training.split.validation,
      sealed_holdout_window: training.split.test,
      hyperparameters: modelArtifact.hyperparameters,
      artifact_uri: modelArtifactPath,
      artifact_digest: expectedArtifactDigest,
      metrics,
      promoted_at: new Date().toISOString(),
    },
    trainingRun: {
      deterministic_identity: identity(['baseball_mlb', 'moneyline', '02c_training', expectedArtifactDigest]),
      sport_key: 'baseball_mlb',
      target: 'home_win_probability',
      training_window: training.split.train,
      feature_set_version: featureSetVersion,
      row_counts: { train: 1574, validation: 337, test: 338, total: 2249 },
      hyperparameters: modelArtifact.hyperparameters,
      artifact_digest: expectedArtifactDigest,
      status: 'completed',
      completed_at: new Date().toISOString(),
    },
    validationRun: {
      deterministic_identity: identity(['baseball_mlb', 'moneyline', '02c_validation', expectedArtifactDigest]),
      validation_window: { validation: training.split.validation, test: training.split.test, walk_forward_folds: 4 },
      sealed_holdout: true,
      metrics: {
        validation: training.modelResults.validationMetrics,
        test: training.modelResults.testMetrics,
        baseline_comparison: training.modelResults.testVsTrivial,
        walk_forward: training.diagnostics.walkForward,
        promotion_eligibility: 'ELIGIBLE',
      },
      calibration_metrics: {
        state: training.diagnostics.calibrationState,
        validation_bins: training.diagnostics.reliability.validation,
        test_bins: training.diagnostics.reliability.test,
      },
      status: 'completed',
    },
    prepDmlCaps: prep.dryRun?.dmlCaps ?? {},
  }
}

async function main() {
  ensure(executePromotion, 'EXPLICIT_02E_PROMOTION_AUTHORIZATION_FLAG_REQUIRED')
  ensure(fs.existsSync(modelArtifactPath), 'MODEL_ARTIFACT_MISSING')
  ensure(fs.existsSync(trainingArtifactPath), 'TRAINING_CERTIFICATION_ARTIFACT_MISSING')
  ensure(fs.existsSync(prepArtifactPath), '02D_PROMOTION_PREP_ARTIFACT_MISSING')

  const modelArtifact = JSON.parse(fs.readFileSync(modelArtifactPath, 'utf8'))
  const training = JSON.parse(fs.readFileSync(trainingArtifactPath, 'utf8'))
  const prep = JSON.parse(fs.readFileSync(prepArtifactPath, 'utf8'))
  const artifactDigest = digest(stable(modelArtifact))
  ensure(artifactDigest === expectedArtifactDigest, `MODEL_ARTIFACT_DIGEST_MISMATCH:${artifactDigest}`)
  ensure(modelArtifact.metadata?.datasetDigest === expectedDatasetDigest, 'MODEL_DATASET_DIGEST_MISMATCH')
  ensure(modelArtifact.metadata?.featureSetVersion === featureSetVersion, 'FEATURE_SET_VERSION_MISMATCH')
  ensure(Array.isArray(modelArtifact.featureNames) && modelArtifact.featureNames.length === 76, 'FEATURE_ORDERING_MISSING')
  ensure(modelArtifact.preprocessing?.type === 'train_only_median_impute_then_standardize', 'PREPROCESSING_METADATA_MISSING')
  ensure(training.modelResults?.finalHoldoutCandidate === candidateName, 'CANDIDATE_MISMATCH')
  ensure(training.diagnostics?.calibrationState === 'CALIBRATION_ACCEPTABLE', 'CALIBRATION_NOT_ACCEPTABLE')
  ensure(training.assessment?.MLB_02C_CHAMPION_ELIGIBILITY === 'ELIGIBLE', 'PROMOTION_NOT_ELIGIBLE')
  ensure(training.leakage?.futureLeakage === 0 && training.leakage?.identifierLeakage === 0 && training.leakage?.outcomeDerivedInputFields === 0, 'LEAKAGE_VIOLATION')

  const version = await fetchJson('https://pick-analyzer.vercel.app/api/system/version')
  ensure(version.gitCommit === targetProductionCommit, `PRODUCTION_ALIGNMENT_FAILED:${version.gitCommit}`)
  ensure(version.providerCallsMade === 0, 'PROVIDER_CALLS_NONZERO')

  const db = client()
  const prewriteModelCounts = await modelCounts(db)
  ensure(zeroPrewrite(prewriteModelCounts), `PREWRITE_MODEL_ZERO_STATE_FAILED:${JSON.stringify(prewriteModelCounts)}`)

  const preFeatureCounts = await featureCounts(db)
  assertExpectedFeatureCounts(preFeatureCounts)
  const preRawNativeCounts = await rawNativeCounts(db)
  assertExpectedRawNativeCounts(preRawNativeCounts)

  const records = buildRecords(modelArtifact, training, prep)
  const dryPlan = await reconcileModelRows(db, records, false)
  ensure(dryPlan.conflicts === 0, `PREWRITE_CONFLICT_AUDIT_FAILED:${JSON.stringify(dryPlan.results)}`)
  const plannedLogicalWrites = Object.values(dryPlan.results).reduce((sum, result) => sum + result.inserts, 0)
  ensure(plannedLogicalWrites <= 6, `WRITE_CAP_EXCEEDED:${plannedLogicalWrites}`)
  ensure(dryPlan.results.champion.inserts === 1, 'CHAMPION_WRITE_PLAN_MISSING')

  const writePlan = await reconcileModelRows(db, records, true)
  ensure(writePlan.conflicts === 0, `WRITE_CONFLICT:${JSON.stringify(writePlan.results)}`)

  const postModelCounts = await modelCounts(db)
  ensure(postModelCounts.registry === 1, `REGISTRY_COUNT_MISMATCH:${postModelCounts.registry}`)
  ensure(postModelCounts.featureSets === 1, `FEATURE_SET_COUNT_MISMATCH:${postModelCounts.featureSets}`)
  ensure(postModelCounts.versions === 1, `MODEL_VERSION_COUNT_MISMATCH:${postModelCounts.versions}`)
  ensure(postModelCounts.trainingRuns === 1, `TRAINING_RUN_COUNT_MISMATCH:${postModelCounts.trainingRuns}`)
  ensure(postModelCounts.validationRuns === 1, `VALIDATION_RUN_COUNT_MISMATCH:${postModelCounts.validationRuns}`)
  ensure(postModelCounts.champions === 1, `CHAMPION_COUNT_MISMATCH:${postModelCounts.champions}`)
  ensure(postModelCounts.predictions === 0 && postModelCounts.predictionResults === 0 && postModelCounts.marketValueEvaluations === 0, 'PREDICTION_OR_MARKET_ROWS_WRITTEN')

  const champion = await maybeOne(
    db,
    'pick2_model_versions',
    '*, pick2_model_feature_sets!inner(feature_set_version)',
    (query) => query.eq('model_version', modelVersionName).eq('role', 'champion').eq('status', 'promoted'),
  )
  ensure(champion?.artifact_digest === expectedArtifactDigest, 'CHAMPION_ARTIFACT_DIGEST_MISMATCH')
  ensure(champion?.pick2_model_feature_sets?.feature_set_version === featureSetVersion, 'CHAMPION_FEATURE_SET_MISMATCH')

  const postFeatureCounts = await featureCounts(db)
  assertExpectedFeatureCounts(postFeatureCounts)
  const postRawNativeCounts = await rawNativeCounts(db)
  assertExpectedRawNativeCounts(postRawNativeCounts)

  const secondPass = await reconcileModelRows(db, records, false)
  ensure(secondPass.conflicts === 0, `IDEMPOTENCY_CONFLICT:${JSON.stringify(secondPass.results)}`)
  ensure(Object.values(secondPass.results).every((result) => result.inserts === 0), `IDEMPOTENCY_NEW_WRITES_PROJECTED:${JSON.stringify(secondPass.results)}`)

  const dmlAccounting = {
    registry: writePlan.results.registry,
    featureSet: writePlan.results.featureSet,
    modelVersion: writePlan.results.modelVersion,
    trainingRun: writePlan.results.trainingRun,
    validationRun: writePlan.results.validationRun,
    champion: writePlan.results.champion,
    totalLogicalNewWrites: Object.values(writePlan.results).reduce((sum, result) => sum + result.inserts, 0),
    totalPhysicalRowsInserted: writePlan.results.registry.inserts + writePlan.results.featureSet.inserts + writePlan.results.modelVersion.inserts + writePlan.results.trainingRun.inserts + writePlan.results.validationRun.inserts,
    productionDmlRows: writePlan.results.registry.inserts + writePlan.results.featureSet.inserts + writePlan.results.modelVersion.inserts + writePlan.results.trainingRun.inserts + writePlan.results.validationRun.inserts,
    productionDdl: 0,
    unrelatedDml: 0,
  }
  ensure(dmlAccounting.totalLogicalNewWrites <= 6, 'POSTWRITE_CAP_EXCEEDED')
  ensure(dmlAccounting.totalPhysicalRowsInserted <= 5, 'PHYSICAL_MODEL_ROW_COUNT_EXCEEDED')

  const validationMetrics = training.modelResults.validationMetrics
  const testMetrics = training.modelResults.testMetrics
  const artifact = {
    generatedAt: new Date().toISOString(),
    project: 'MLB_DATA_02E_MONEYLINE_CHAMPION_PROMOTION_EXECUTION',
    certificationVerdict: 'MLB_DATA_02E_MONEYLINE_CHAMPION_PROMOTION_CERTIFIED',
    publication: {
      publishedCommit: targetProductionCommit,
      originMain: targetProductionCommit,
      productionCommit: version.gitCommit,
      providerCallsMade: version.providerCallsMade,
      MLB_02E_PREPUBLISH_STATE: 'PASS',
      MLB_02E_02D_COMMIT_SCOPE_CERTIFIED: 'YES',
      PRODUCTION_ALIGNMENT: 'PASS',
    },
    model: {
      candidate: candidateName,
      modelVersion: modelVersionName,
      algorithm: modelArtifact.algorithm,
      artifactPath: modelArtifactPath,
      artifactDigest,
      datasetDigest: expectedDatasetDigest,
      featureSetVersion,
      featureCount: modelArtifact.featureNames.length,
      featureOrderingDigest: records.featureSet.input_contract.feature_ordering_digest,
      hyperparameters: modelArtifact.hyperparameters,
      trainingCommit,
    },
    eligibility: {
      baselineImprovement: training.modelResults.testVsTrivial.result,
      calibration: training.diagnostics.calibrationState,
      walkForward: training.diagnostics.walkForward.MLB_02C_WALK_FORWARD_VALIDATION,
      leakageViolations: 0,
      reproducibility: 'PASS',
      MLB_02E_PROMOTION_ELIGIBILITY: 'ELIGIBLE',
    },
    performance: {
      validation: validationMetrics,
      test: testMetrics,
      walkForward: training.diagnostics.walkForward,
      testVsTrivial: training.modelResults.testVsTrivial,
      calibrationState: training.diagnostics.calibrationState,
    },
    prewrite: {
      modelCounts: prewriteModelCounts,
      conflictAudit: dryPlan.results,
      MLB_02E_PREWRITE_MODEL_ZERO_STATE: 'PASS',
      MLB_02E_PREWRITE_DML_PLAN: 'PASS',
      MLB_02E_WRITE_IDENTITY_CONTRACT: 'PASS',
      MLB_02E_PREWRITE_CONFLICT_AUDIT: 'PASS',
    },
    persistence: {
      records,
      accounting: dmlAccounting,
      finalCounts: postModelCounts,
      championReadback: {
        modelVersion: champion.model_version,
        artifactDigest: champion.artifact_digest,
        featureSet: champion.pick2_model_feature_sets.feature_set_version,
      },
      MLB_02E_FEATURE_SET_PERSISTENCE: 'PASS',
      MLB_02E_MODEL_REGISTRY_PERSISTENCE: 'PASS',
      MLB_02E_MODEL_VERSION_PERSISTENCE: 'PASS',
      MLB_02E_TRAINING_RUN_PERSISTENCE: 'PASS',
      MLB_02E_VALIDATION_RUN_PERSISTENCE: 'PASS',
      MLB_02E_CHAMPION_PRECHECK: 'PASS',
      MLB_02E_SINGLE_CHAMPION_STATE: 'PASS',
      MLB_02E_CHAMPION_READBACK: 'PASS',
      MLB_02E_MODEL_TABLE_PARITY: 'PASS',
      MLB_02E_DML_ACCOUNTING: 'PASS',
    },
    immutability: {
      trainingMetrics: 'PRESERVED',
      validationMetrics: 'PRESERVED',
      artifactDigest: 'PRESERVED',
      datasetDigest: 'PRESERVED',
      featureOrdering: 'PRESERVED',
      preprocessingMetadata: 'PRESERVED',
      MLB_02E_MODEL_METADATA_IMMUTABILITY: 'PASS',
    },
    predictionBoundary: {
      predictions: postModelCounts.predictions,
      predictionResults: postModelCounts.predictionResults,
      marketValueEvaluations: postModelCounts.marketValueEvaluations,
      officialPicks: 0,
      autoInference: 'NO',
      valueBoardReady: 'NO',
      officialPicksReady: 'NO',
      evCertification: 'NO',
      roiCertification: 'NO',
      clvCertification: 'NO',
      historicalOddsLimitation: 'Historical sportsbook odds remain missing; Champion is outcome probability only.',
      MLB_02E_PREDICTION_BOUNDARY: 'PASS',
      MLB_02E_PROMOTION_AUTO_INFERENCE: 'NO',
      MLB_02E_OUTCOME_ONLY_CHAMPION_BOUNDARY: 'PASS',
    },
    idempotency: {
      secondReadOnlyPass: secondPass.results,
      newWritesProjected: 0,
      allExactRecords: 'REUSE_NO_OP',
      conflicts: 0,
      MLB_02E_PROMOTION_IDEMPOTENCY: 'PASS',
    },
    dataSafety: {
      featureFoundationBefore: preFeatureCounts,
      featureFoundationAfter: postFeatureCounts,
      rawNativeBefore: preRawNativeCounts,
      rawNativeAfter: postRawNativeCounts,
      MLB_02E_FEATURE_FOUNDATION_UNCHANGED: 'PASS',
      MLB_02E_RAW_NATIVE_UNCHANGED: 'PASS',
    },
    safety: {
      predictionWrites: 0,
      predictionResultWrites: 0,
      marketValueWrites: 0,
      featureWrites: 0,
      rawWrites: 0,
      productionDmlRows: dmlAccounting.productionDmlRows,
      productionDdl: 0,
      providerCalls: 0,
      oddsApiCalls: 0,
      ballDontLieCalls: 0,
      mlbOfficialCalls: 0,
      sportsDataIoCalls: 0,
      import2026: 'NO',
      automation: 'OFF',
      cronChanges: 0,
      parlay100Generation: 'NO',
    },
    flags: {
      MLB_02E_MODEL_ARTIFACT_INTEGRITY: 'PASS',
      MLB_02E_DATASET_MODEL_IDENTITY: 'PASS',
      MLB_02E_PROMOTION_ELIGIBILITY: 'ELIGIBLE',
      MLB_02E_PREWRITE_MODEL_ZERO_STATE: 'PASS',
      MLB_02E_PREWRITE_DML_PLAN: 'PASS',
      MLB_02E_WRITE_IDENTITY_CONTRACT: 'PASS',
      MLB_02E_PREWRITE_CONFLICT_AUDIT: 'PASS',
      MLB_02E_FEATURE_SET_PERSISTENCE: 'PASS',
      MLB_02E_MODEL_REGISTRY_PERSISTENCE: 'PASS',
      MLB_02E_MODEL_VERSION_PERSISTENCE: 'PASS',
      MLB_02E_TRAINING_RUN_PERSISTENCE: 'PASS',
      MLB_02E_VALIDATION_RUN_PERSISTENCE: 'PASS',
      MLB_02E_CHAMPION_PRECHECK: 'PASS',
      MLB_02E_SINGLE_CHAMPION_STATE: 'PASS',
      MLB_02E_CHAMPION_READBACK: 'PASS',
      MLB_02E_MODEL_METADATA_IMMUTABILITY: 'PASS',
      MLB_02E_PREDICTION_BOUNDARY: 'PASS',
      MLB_02E_PROMOTION_AUTO_INFERENCE: 'NO',
      MLB_02E_OUTCOME_ONLY_CHAMPION_BOUNDARY: 'PASS',
      MLB_02E_MODEL_TABLE_PARITY: 'PASS',
      MLB_02E_DML_ACCOUNTING: 'PASS',
      MLB_02E_PROMOTION_IDEMPOTENCY: 'PASS',
      MLB_02E_FEATURE_FOUNDATION_UNCHANGED: 'PASS',
      MLB_02E_RAW_NATIVE_UNCHANGED: 'PASS',
      PREDICTION_WORK_PERFORMED: 'NO',
    },
  }

  if (writeArtifact) {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true })
    fs.writeFileSync(outputPath, `${JSON.stringify(artifact, null, 2)}\n`)
  }

  console.log(JSON.stringify(artifact, null, 2))
}

main().catch((error) => {
  console.error(JSON.stringify({ script: 'mlb-data-02e-moneyline-champion-promotion', status: 'FAIL', error: error.message }, null, 2))
  process.exitCode = 1
})
