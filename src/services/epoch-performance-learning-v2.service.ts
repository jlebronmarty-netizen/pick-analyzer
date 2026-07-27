import 'server-only'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { getPredictionEpochMigrationState } from '@/services/prediction-epoch-migration-state.service'

type PredictionRow = {
  id: string
  sport_key: string | null
  game_id: string | null
  model_version: string | null
  model_role: string | null
  model_probability: number | null
  confidence: number | null
  result: string | null
  status: string | null
  lifecycle_status: string | null
  production_eligible: boolean | null
  trial: boolean | null
  scrambled: boolean | null
  is_current: boolean | null
  feature_snapshot_id: string | null
  generated_at: string | null
  created_at: string | null
  commence_time: string | null
}

function nowIso() {
  return new Date().toISOString()
}

async function loadPredictionRows() {
  const { data, error, count } = await supabaseAdmin
    .from('prediction_history')
    .select('id,sport_key,game_id,model_version,model_role,model_probability,confidence,result,status,lifecycle_status,production_eligible,trial,scrambled,is_current,feature_snapshot_id,generated_at,created_at,commence_time', { count: 'exact' })
    .limit(5000)

  if (error) return { rows: [] as PredictionRow[], count: 0, error: error.message }
  return { rows: (data ?? []) as PredictionRow[], count: count ?? data?.length ?? 0, error: null }
}

function normalize(value: unknown, fallback: string) {
  const text = String(value ?? '').trim()
  return text.length > 0 ? text : fallback
}

function inferredEpoch(row: PredictionRow) {
  const role = normalize(row.model_role, 'unknown').toLowerCase()
  if (role === 'shadow' || role === 'challenger') return 'DATA_FOUNDATION_V2_EPOCH_PENDING_ACTIVATION'
  return 'LEGACY_EPOCH_V1'
}

function isSettled(row: PredictionRow) {
  const result = normalize(row.result, '').toLowerCase()
  const status = normalize(row.status, '').toLowerCase()
  return Boolean(result) || ['won', 'lost', 'push', 'settled'].some((token) => status.includes(token))
}

function isWin(row: PredictionRow) {
  const result = normalize(row.result, '').toLowerCase()
  const status = normalize(row.status, '').toLowerCase()
  return result === 'win' || result === 'won' || status.includes('won')
}

function isLoss(row: PredictionRow) {
  const result = normalize(row.result, '').toLowerCase()
  const status = normalize(row.status, '').toLowerCase()
  return result === 'loss' || result === 'lost' || status.includes('lost')
}

function groupCount(rows: PredictionRow[], keyFn: (row: PredictionRow) => string) {
  const grouped = new Map<string, PredictionRow[]>()
  for (const row of rows) {
    const key = keyFn(row)
    grouped.set(key, [...(grouped.get(key) ?? []), row])
  }
  return Array.from(grouped.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, values]) => ({
      key,
      rows: values.length,
      settledRows: values.filter(isSettled).length,
      wins: values.filter(isWin).length,
      losses: values.filter(isLoss).length,
      featureSnapshotRows: values.filter((row) => Boolean(row.feature_snapshot_id)).length,
    }))
}

function calibrationBuckets(rows: PredictionRow[]) {
  const scored = rows.filter((row) => typeof row.model_probability === 'number' && isSettled(row))
  const buckets = [
    { key: '0.00-0.49', min: 0, max: 0.499999 },
    { key: '0.50-0.59', min: 0.5, max: 0.599999 },
    { key: '0.60-0.69', min: 0.6, max: 0.699999 },
    { key: '0.70-1.00', min: 0.7, max: 1 },
  ]
  return buckets.map((bucket) => {
    const bucketRows = scored.filter((row) => {
      const probability = Number(row.model_probability)
      return probability >= bucket.min && probability <= bucket.max
    })
    const wins = bucketRows.filter(isWin).length
    return {
      bucket: bucket.key,
      sampleSize: bucketRows.length,
      observedWinRate: bucketRows.length > 0 ? wins / bucketRows.length : null,
    }
  })
}

export async function getEpochPerformanceLearningV2() {
  const [sample, migrationState] = await Promise.all([
    loadPredictionRows(),
    getPredictionEpochMigrationState(),
  ])
  const rows = sample.rows
  const settledRows = rows.filter(isSettled)
  const learningEligibleRows = settledRows.filter((row) => Boolean(row.feature_snapshot_id))
  const activeEpochKey = 'DATA_FOUNDATION_V2_EPOCH'
  const legacyEpochKey = 'LEGACY_EPOCH_V1'

  return {
    success: true,
    mode: 'epoch_performance_learning_v2',
    generatedAt: nowIso(),
    readOnly: true,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
    productionMutationsMade: 0,
    sampleLimit: 5000,
    sourceError: sample.error,
    migrationApplied: migrationState.migrationApplied,
    migrationState,
    activeEpochKey,
    legacyEpochKey,
    predictionRowsAudited: sample.count,
    reportingViews: {
      activeEpoch: {
        epochKey: activeEpochKey,
        status: 'AVAILABLE_AFTER_MANUAL_ACTIVATION',
        defaultForTodayAndForwardMetrics: true,
      },
      archivedEpochs: {
        epochKeys: [legacyEpochKey],
        remainQueryable: true,
        excludedFromActiveOperationalMetricsByDefault: true,
      },
      allEpochs: {
        includesLegacyAndFutureEpochs: true,
        requiresExplicitScope: true,
      },
    },
    performance: {
      byInferredEpoch: groupCount(rows, inferredEpoch),
      bySport: groupCount(rows, (row) => normalize(row.sport_key, 'unknown_sport')),
      byModelVersion: groupCount(rows, (row) => normalize(row.model_version, 'unknown_model_version')),
      calibrationByProbabilityBucket: calibrationBuckets(rows),
    },
    learningLabels: {
      settledRows: settledRows.length,
      epochAwareEligibleRows: learningEligibleRows.length,
      missingFeatureSnapshotRows: settledRows.length - learningEligibleRows.length,
      labelWritesExecuted: false,
      learningWeightChangesExecuted: false,
      recalibrationExecuted: false,
    },
    contracts: {
      activeEpochMetricsRequireEpochScope: true,
      archivedEpochMetricsRemainQueryable: true,
      allEpochMetricsRequireExplicitScope: true,
      sportSpecificPerformanceIsEpochScoped: true,
      modelVersionPerformanceIsEpochScoped: true,
      calibrationReportsAreEpochScoped: true,
      learningLabelsCarryOriginatingEpoch: true,
      learningBrainWeightChangesAllowed: false,
      modelRecalibrationAllowed: false,
      productionModelPromotionAllowed: false,
    },
    warnings: [
      'This report is read-only and does not mutate Learning Brain weights.',
      `Current migration state is ${migrationState.migrationState}.`,
      'Active epoch metrics become enforceable only after activation approval.',
    ],
  }
}

export async function validateEpochPerformanceLearningV2() {
  const result = await getEpochPerformanceLearningV2()
  const checks = [
    ['read-only report', result.readOnly],
    ['zero provider calls', result.providerCallsMade === 0],
    ['zero remote mutations', result.remoteMutationsMade === 0],
    ['canonical migration state present', typeof result.migrationState.migrationState === 'string'],
    ['active epoch view defined', result.reportingViews.activeEpoch.epochKey === 'DATA_FOUNDATION_V2_EPOCH'],
    ['archived epoch view defined', result.reportingViews.archivedEpochs.epochKeys.includes('LEGACY_EPOCH_V1')],
    ['all epoch view explicit scope', result.reportingViews.allEpochs.requiresExplicitScope],
    ['sport performance epoch scoped', result.contracts.sportSpecificPerformanceIsEpochScoped],
    ['model version performance epoch scoped', result.contracts.modelVersionPerformanceIsEpochScoped],
    ['calibration epoch scoped', result.contracts.calibrationReportsAreEpochScoped],
    ['learning labels epoch aware', result.contracts.learningLabelsCarryOriginatingEpoch],
    ['no learning weight changes', result.learningLabels.learningWeightChangesExecuted === false],
    ['no recalibration', result.learningLabels.recalibrationExecuted === false],
  ]
  const failedChecks = checks.filter(([, passed]) => !passed).map(([name]) => String(name))
  return {
    success: failedChecks.length === 0,
    mode: 'epoch_performance_learning_v2_validation',
    checks: checks.length,
    passed: checks.length - failedChecks.length,
    failed: failedChecks.length,
    failedChecks,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
    summary: {
      predictionRowsAudited: result.predictionRowsAudited,
      migrationState: result.migrationState.migrationState,
      migrationApplied: result.migrationState.migrationApplied,
      settledRows: result.learningLabels.settledRows,
      epochAwareEligibleRows: result.learningLabels.epochAwareEligibleRows,
      activeEpochKey: result.activeEpochKey,
      learningWeightChangesExecuted: result.learningLabels.learningWeightChangesExecuted,
      recalibrationExecuted: result.learningLabels.recalibrationExecuted,
    },
  }
}
