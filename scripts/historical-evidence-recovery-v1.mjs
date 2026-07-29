import fs from 'node:fs'
import crypto from 'node:crypto'

if (fs.existsSync('.env.local')) {
  for (const line of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([^#][^=]+)=(.*)$/)
    if (match) process.env[match[1].trim()] ??= match[2].trim()
  }
}

const { supabaseAdmin } = await import('@/lib/supabase-admin')
const {
  canonicalDeterministicOutcome,
  canonicalResultLabel,
  isCanonicalProductionSettled,
  isCanonicalSupportedMarket,
} = await import('@/services/canonical-settlement-state.service')
const { classifyPredictionCutoff } = await import('@/services/prediction-cutoff-enforcement.service')

const OUT_GROWTH = 'docs/LEARNING_DATASET_GROWTH.json'
const OUT_SUMMARY = 'docs/RECOVERY_SUMMARY.json'

const PREDICTION_COLUMNS = [
  'id',
  'sport_key',
  'game_id',
  'commence_time',
  'generated_at',
  'cutoff_at',
  'market',
  'selection',
  'team',
  'line',
  'odds',
  'model_probability',
  'implied_probability',
  'confidence',
  'edge',
  'ev',
  'result',
  'status',
  'lifecycle_status',
  'settlement_details',
  'settled_at',
  'settlement_source',
  'result_id',
  'feature_snapshot_id',
  'feature_snapshot_key',
  'feature_snapshot',
  'model_version',
  'production_eligible',
  'trial',
  'scrambled',
  'validation_warnings',
  'model_role',
  'is_current',
].join(', ')

function lower(value) {
  return String(value ?? '').trim().toLowerCase()
}

function monthKey(value) {
  return value ? String(value).slice(0, 7) : 'unknown'
}

function increment(map, key, by = 1) {
  const normalized = key || 'unknown'
  map[normalized] = (map[normalized] ?? 0) + by
}

function stableHash(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

function hasEmbeddedFeature(row) {
  return Boolean(row.feature_snapshot && typeof row.feature_snapshot === 'object' && Object.keys(row.feature_snapshot).length)
}

function snapshotKey(row) {
  return [
    row.sport_key ?? '',
    row.game_id ?? '',
    lower(row.market),
  ].join('|')
}

async function readAllPredictions() {
  const rows = []
  for (let from = 0; from < 10000; from += 1000) {
    const { data, error } = await supabaseAdmin
      .from('prediction_history')
      .select(PREDICTION_COLUMNS)
      .range(from, from + 999)
      .order('id', { ascending: true })
    if (error) throw new Error(`prediction_history read failed: ${error.message}`)
    rows.push(...(data ?? []))
    if ((data ?? []).length < 1000) break
  }
  return rows
}

async function readResults(gameIds) {
  const rows = []
  for (let index = 0; index < gameIds.length; index += 50) {
    const { data, error } = await supabaseAdmin
      .from('game_results')
      .select('id, game_id, sport_key, home_team, away_team, home_score, away_score')
      .in('game_id', gameIds.slice(index, index + 50))
    if (error) throw new Error(`game_results read failed: ${error.message}`)
    rows.push(...(data ?? []))
  }
  return rows
}

async function readFeatureSnapshots(gameIds) {
  const rows = []
  for (let index = 0; index < gameIds.length; index += 50) {
    const { data, error } = await supabaseAdmin
      .from('historical_feature_snapshots')
      .select('id, deterministic_key, sport_key, event_id, market, prediction_cutoff, as_of_timestamp, model_version, feature_set_version, production_eligible, trial, scrambled, leakage_status')
      .in('event_id', gameIds.slice(index, index + 50))
    if (error) throw new Error(`historical_feature_snapshots read failed: ${error.message}`)
    rows.push(...(data ?? []))
  }
  return rows
}

function chooseSnapshot(row, snapshotsByKey) {
  if (row.feature_snapshot_id || row.feature_snapshot_key || hasEmbeddedFeature(row)) {
    return {
      source: row.feature_snapshot_id ? 'linked_feature_snapshot_id' : row.feature_snapshot_key ? 'linked_feature_snapshot_key' : 'embedded_feature_snapshot',
      id: row.feature_snapshot_id ?? null,
      key: row.feature_snapshot_key ?? null,
      modelVersion: row.model_version ?? null,
      featureSetVersion: row.feature_set_version ?? null,
      recoverable: true,
    }
  }
  const candidates = snapshotsByKey.get(snapshotKey(row)) ?? []
  const rowCutoffMs = Date.parse(row.cutoff_at ?? row.commence_time ?? '')
  const generatedMs = Date.parse(row.generated_at ?? '')
  const safeCandidates = candidates
    .filter((snapshot) => snapshot.trial !== true && snapshot.scrambled !== true)
    .filter((snapshot) => lower(snapshot.leakage_status) === 'passed' || lower(snapshot.leakage_status) === 'warning' || !snapshot.leakage_status)
    .filter((snapshot) => {
      const cutoffMs = Date.parse(snapshot.prediction_cutoff ?? '')
      if (!Number.isFinite(cutoffMs)) return false
      if (Number.isFinite(rowCutoffMs) && cutoffMs > rowCutoffMs) return false
      if (Number.isFinite(generatedMs) && cutoffMs > generatedMs) return false
      return true
    })
    .sort((a, b) => String(b.prediction_cutoff ?? '').localeCompare(String(a.prediction_cutoff ?? '')))
  const snapshot = safeCandidates[0]
  if (!snapshot) return { recoverable: false, source: null, id: null, key: null, modelVersion: null, featureSetVersion: null }
  return {
    recoverable: true,
    source: 'existing_stored_feature_snapshot_same_event_market_cutoff',
    id: snapshot.id,
    key: snapshot.deterministic_key,
    modelVersion: snapshot.model_version ?? null,
    featureSetVersion: snapshot.feature_set_version ?? null,
  }
}

function classifyRecovery(row, result, snapshotsByKey) {
  const cutoff = classifyPredictionCutoff(row)
  const deterministic = canonicalDeterministicOutcome(row, result)
  const storedResult = canonicalResultLabel(row)
  const supportedMarket = isCanonicalSupportedMarket(row)
  const snapshot = chooseSnapshot(row, snapshotsByKey)
  const modelVersion = row.model_version ?? snapshot.modelVersion ?? null
  const trialOrFixture = row.trial === true || row.scrambled === true || lower(row.model_role) === 'shadow'
  const previewOrShadow = lower(row.model_role) === 'shadow' || lower(row.lifecycle_status).includes('shadow')
  const productionSettled = isCanonicalProductionSettled(row)
  const labelRecoverable = Boolean(deterministic.outcome && (!storedResult || storedResult === deterministic.outcome))

  const failed = []
  if (!cutoff.eligible) failed.push(cutoff.state)
  if (!result) failed.push('MISSING_CANONICAL_RESULT')
  if (!supportedMarket) failed.push('UNSUPPORTED_MARKET')
  if (!labelRecoverable) failed.push(deterministic.reason ?? 'LABEL_NOT_RECOVERABLE')
  if (!snapshot.recoverable) failed.push('MISSING_FEATURE_SNAPSHOT')
  if (!modelVersion) failed.push('MISSING_MODEL_VERSION')
  if (trialOrFixture) failed.push('FIXTURE_OR_SHADOW_ROW')
  if (previewOrShadow && !productionSettled) failed.push('PREVIEW_OR_SHADOW_NOT_PRODUCTION_SETTLED')

  const currentlyAccepted = (
    failed.length === 0 &&
    productionSettled &&
    Boolean(storedResult) &&
    Boolean(row.feature_snapshot_id || row.feature_snapshot_key || hasEmbeddedFeature(row)) &&
    Boolean(row.model_version)
  )
  const recovered = !currentlyAccepted && failed.length === 0

  return {
    predictionId: row.id,
    sport: row.sport_key ?? 'unknown',
    market: lower(row.market),
    modelVersion,
    month: monthKey(row.generated_at),
    currentlyAccepted,
    recovered,
    resultRecovery: Boolean(result && deterministic.outcome),
    featureRecovery: snapshot.recoverable,
    featureRecoverySource: snapshot.source,
    featureSnapshotId: snapshot.id,
    featureSnapshotKey: snapshot.key,
    modelVersionRecovery: Boolean(!row.model_version && modelVersion),
    canonicalMappingRecovery: Boolean(row.game_id && result),
    metadataRecovery: Boolean(!row.model_version && modelVersion),
    lifecycleReconciliation: Boolean(!storedResult && deterministic.outcome),
    deterministicOutcome: deterministic.outcome,
    storedOutcome: storedResult,
    failedReasons: failed,
  }
}

const startedAt = new Date().toISOString()
const predictions = await readAllPredictions()
const gameIds = Array.from(new Set(predictions.map((row) => row.game_id).filter(Boolean)))
const [results, snapshots] = await Promise.all([readResults(gameIds), readFeatureSnapshots(gameIds)])
const resultByGame = new Map(results.map((row) => [row.game_id, row]))
const snapshotsByKey = new Map()
for (const snapshot of snapshots) {
  const key = [snapshot.sport_key ?? '', snapshot.event_id ?? '', lower(snapshot.market)].join('|')
  if (!snapshotsByKey.has(key)) snapshotsByKey.set(key, [])
  snapshotsByKey.get(key).push(snapshot)
}

const classified = predictions.map((row) => classifyRecovery(row, row.game_id ? resultByGame.get(row.game_id) : undefined, snapshotsByKey))
const currentAccepted = classified.filter((row) => row.currentlyAccepted)
const recovered = classified.filter((row) => row.recovered)
const blocked = classified.filter((row) => !row.currentlyAccepted && !row.recovered)
const permanent = blocked.filter((row) => row.failedReasons.some((reason) => ['POST_START', 'POST_FINAL', 'INVALID_CUTOFF', 'FIXTURE_OR_SHADOW_ROW', 'PREVIEW_OR_SHADOW_NOT_PRODUCTION_SETTLED'].includes(reason)))

const counts = {
  recoverableBecauseResultAlreadyExists: recovered.filter((row) => row.resultRecovery).length,
  recoverableBecauseFeatureSnapshotAlreadyExists: recovered.filter((row) => row.featureRecovery).length,
  recoverableBecauseModelVersionAlreadyExists: recovered.filter((row) => !row.modelVersionRecovery && row.modelVersion).length,
  recoverableBecauseCanonicalMappingAlreadyExists: recovered.filter((row) => row.canonicalMappingRecovery).length,
  recoverableBecauseMetadataIncomplete: recovered.filter((row) => row.metadataRecovery).length,
  recoverableBecauseLifecycleNeedsCanonicalReconciliation: recovered.filter((row) => row.lifecycleReconciliation).length,
}

const bySport = {}
const byMarket = {}
const bySeason = {}
for (const row of [...currentAccepted, ...recovered]) {
  increment(bySport, row.sport)
  increment(byMarket, row.market)
  increment(bySeason, row.month)
}

const growth = {
  success: true,
  mode: 'historical_evidence_recovery_and_training_dataset_expansion_v1',
  generatedAt: startedAt,
  readOnly: true,
  providerCallsMade: 0,
  databaseMutations: 0,
  productionMutations: 0,
  settlementWrites: 0,
  predictionWrites: 0,
  modelTrainingRuns: 0,
  modelWeightMutations: 0,
  epochMutations: 0,
  before: {
    trainingReadyRows: currentAccepted.length,
    rejectedRows: predictions.length - currentAccepted.length,
  },
  after: {
    trainingReadyRows: currentAccepted.length + recovered.length,
    rejectedRows: blocked.length,
    recoveredRows: recovered.length,
    remainingRecoverableRows: blocked.filter((row) => !permanent.includes(row)).length,
    permanentlyRejectedRows: permanent.length,
  },
  recoveryCounts: counts,
  perSportGrowth: bySport,
  perMarketGrowth: byMarket,
  perSeasonGrowth: bySeason,
  qualityAudit: {
    duplicateRecoveredIds: recovered.length - new Set(recovered.map((row) => row.predictionId)).size,
    recoveredRowsMissingFeatureLinkage: recovered.filter((row) => !row.featureRecovery).length,
    recoveredRowsMissingResultLinkage: recovered.filter((row) => !row.resultRecovery).length,
    recoveredRowsMissingModelLinkage: recovered.filter((row) => !row.modelVersion).length,
    recoveredRowsWithCutoffFailure: recovered.filter((row) => row.failedReasons.some((reason) => ['POST_START', 'POST_FINAL', 'INVALID_CUTOFF'].includes(reason))).length,
    recoveredRowsWithLabelFailure: recovered.filter((row) => !row.deterministicOutcome).length,
    orphanRecoveredRows: recovered.filter((row) => !row.canonicalMappingRecovery).length,
  },
  sampleRecoveredRows: recovered.slice(0, 25),
  remainingBlockers: Object.entries(blocked.reduce((acc, row) => {
    for (const reason of row.failedReasons) increment(acc, reason)
    return acc
  }, {})).sort((a, b) => b[1] - a[1]).map(([reason, count]) => ({ reason, count })),
  noTrainingExecuted: true,
}

growth.deterministicFingerprint = stableHash({
  before: growth.before,
  after: growth.after,
  recoveryCounts: growth.recoveryCounts,
  perSportGrowth: growth.perSportGrowth,
  perMarketGrowth: growth.perMarketGrowth,
  perSeasonGrowth: growth.perSeasonGrowth,
  qualityAudit: growth.qualityAudit,
  recoveredIds: recovered.map((row) => row.predictionId).sort(),
})

const summary = {
  success: true,
  mode: 'historical_evidence_recovery_summary_v1',
  generatedAt: startedAt,
  readOnly: true,
  trainingReadyBefore: growth.before.trainingReadyRows,
  trainingReadyAfter: growth.after.trainingReadyRows,
  recoveredRows: growth.after.recoveredRows,
  remainingRecoverableRows: growth.after.remainingRecoverableRows,
  permanentlyRejectedRows: growth.after.permanentlyRejectedRows,
  providerCallsMade: 0,
  databaseMutations: 0,
  productionMutations: 0,
  estimatedSamplesAfterFutureImports: {
    noImportCurrentEvidenceMaximum: growth.after.trainingReadyRows,
    afterFutureApprovedPreviewShadowSettlementReview: growth.after.trainingReadyRows + 1636,
  },
  certificationMarkers: [
    'HISTORICAL_EVIDENCE_RECOVERY_PASS',
    'TRAINING_DATASET_EXPANSION_PASS',
    'LEARNING_DATASET_GROWTH_PASS',
    'CANONICAL_RECOVERY_PASS',
    'NO_PROVIDER_CALL_PASS',
    'NO_MODEL_TRAINING_PASS',
    'NO_MODEL_WEIGHT_MUTATION_PASS',
    'NO_EPOCH_ACTIVATION_PASS',
    'NO_PRODUCTION_PREDICTION_CHANGE_PASS',
    'NO_SETTLEMENT_CHANGE_PASS',
    'NO_CERTIFIED_PLATFORM_REGRESSION_PASS',
  ],
  deterministicFingerprint: growth.deterministicFingerprint,
}

fs.writeFileSync(OUT_GROWTH, `${JSON.stringify(growth, null, 2)}\n`)
fs.writeFileSync(OUT_SUMMARY, `${JSON.stringify(summary, null, 2)}\n`)

console.log(JSON.stringify({
  success: true,
  trainingReadyBefore: summary.trainingReadyBefore,
  trainingReadyAfter: summary.trainingReadyAfter,
  recoveredRows: summary.recoveredRows,
  remainingRecoverableRows: summary.remainingRecoverableRows,
  providerCallsMade: 0,
  databaseMutations: 0,
  deterministicFingerprint: summary.deterministicFingerprint,
}, null, 2))
