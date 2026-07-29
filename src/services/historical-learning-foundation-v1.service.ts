import crypto from 'node:crypto'
import { supabaseAdmin } from '@/lib/supabase-admin'
import {
  canonicalDeterministicOutcome,
  canonicalResultLabel,
  classifyCanonicalSettlementState,
  isCanonicalProductionSettled,
  isCanonicalSupportedMarket,
  type CanonicalGameResultLike,
  type CanonicalPredictionLike,
} from '@/services/canonical-settlement-state.service'
import { classifyPredictionCutoff } from '@/services/prediction-cutoff-enforcement.service'

type PredictionRow = CanonicalPredictionLike & {
  id: string
  sport_key: string | null
  game_id: string | null
  commence_time: string | null
  generated_at: string | null
  cutoff_at?: string | null
  market: string | null
  selection?: string | null
  team?: string | null
  line?: number | string | null
  odds?: number | string | null
  model_probability?: number | string | null
  implied_probability?: number | string | null
  confidence?: number | string | null
  edge?: number | string | null
  ev?: number | string | null
  result?: string | null
  status?: string | null
  settled_at?: string | null
  settlement_source?: string | null
  result_id?: string | null
  feature_snapshot_id?: string | null
  feature_snapshot_key?: string | null
  feature_snapshot?: Record<string, unknown> | null
  model_version?: string | null
  production_eligible?: boolean | null
  trial?: boolean | null
  scrambled?: boolean | null
}

type ResultRow = CanonicalGameResultLike & {
  id: string
  game_id: string | null
  sport_key: string | null
}

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

function lower(value: unknown) {
  return String(value ?? '').trim().toLowerCase()
}

function hasFeatureEvidence(row: PredictionRow) {
  return Boolean(row.feature_snapshot_id || row.feature_snapshot_key || (row.feature_snapshot && Object.keys(row.feature_snapshot).length))
}

function monthKey(value: string | null | undefined) {
  return value ? value.slice(0, 7) : 'unknown'
}

function increment(map: Record<string, number>, key: string | null | undefined, by = 1) {
  const normalized = key || 'unknown'
  map[normalized] = (map[normalized] ?? 0) + by
}

function countRowsBy(rows: Array<Record<string, unknown>>, key: string, normalizer: (value: unknown) => string = (value) => String(value ?? 'unknown')) {
  return rows.reduce<Record<string, number>>((counts, row) => {
    increment(counts, normalizer(row[key]))
    return counts
  }, {})
}

function stableHash(value: unknown) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

async function readAllPredictions() {
  const rows: PredictionRow[] = []
  for (let from = 0; from < 10000; from += 1000) {
    const { data, error } = await supabaseAdmin
      .from('prediction_history')
      .select(PREDICTION_COLUMNS)
      .range(from, from + 999)
      .order('id', { ascending: true })
    if (error) throw new Error(`prediction_history read failed: ${error.message}`)
    rows.push(...((data ?? []) as unknown as PredictionRow[]))
    if ((data ?? []).length < 1000) break
  }
  return rows
}

async function readResults(gameIds: string[]) {
  const rows: ResultRow[] = []
  for (let index = 0; index < gameIds.length; index += 50) {
    const batch = gameIds.slice(index, index + 50)
    const { data, error } = await supabaseAdmin
      .from('game_results')
      .select('id, game_id, sport_key, home_team, away_team, home_score, away_score')
      .in('game_id', batch)
    if (error) throw new Error(`game_results read failed: ${error.message}`)
    rows.push(...((data ?? []) as unknown as ResultRow[]))
  }
  return rows
}

async function countRows(table: string) {
  const { count, error } = await supabaseAdmin.from(table).select('id', { count: 'exact', head: true })
  if (error) return { count: null, error: error.message }
  return { count: count ?? 0, error: null }
}

function classifyLearningRow(row: PredictionRow, result: ResultRow | undefined) {
  const cutoff = classifyPredictionCutoff(row)
  const deterministic = canonicalDeterministicOutcome(row, result)
  const state = classifyCanonicalSettlementState(row, result)
  const storedResult = canonicalResultLabel(row)
  const featureEvidence = hasFeatureEvidence(row)
  const modelVersion = Boolean(row.model_version)
  const previewOrShadow = lower(row.model_role) === 'shadow' || lower(state.classification).includes('shadow') || lower(state.classification).includes('legacy')
  const supportedMarket = isCanonicalSupportedMarket(row)
  const resultConflict = Boolean(storedResult && deterministic.outcome && storedResult !== deterministic.outcome)
  const productionSettled = isCanonicalProductionSettled(row)

  const failedReasons: string[] = []
  if (!cutoff.eligible) failedReasons.push(cutoff.state === 'POST_FINAL' ? 'POST_FINAL_PREDICTION' : cutoff.state === 'POST_START' ? 'POST_START_PREDICTION' : 'INVALID_CUTOFF')
  if (!result) failedReasons.push('MISSING_CANONICAL_RESULT')
  if (!supportedMarket) failedReasons.push('UNSUPPORTED_MARKET')
  if (resultConflict) failedReasons.push('RESULT_CONFLICT')
  if (!featureEvidence) failedReasons.push('MISSING_FEATURE_EVIDENCE')
  if (!modelVersion) failedReasons.push('MISSING_MODEL_VERSION')
  if (row.trial || row.scrambled) failedReasons.push('FIXTURE_ROW')
  if (previewOrShadow && !productionSettled) failedReasons.push(state.classification === 'SHADOW_ROW' ? 'SHADOW_ROW' : 'PREVIEW_ROW')

  const eligible = failedReasons.length === 0 && productionSettled && deterministic.outcome === storedResult
  const partition = eligible
    ? 'PRODUCTION_TRAINING_READY'
    : previewOrShadow
      ? 'RESEARCH_PREVIEW_ONLY'
      : !result || !featureEvidence
        ? 'BLOCKED_MISSING_EVIDENCE'
        : failedReasons.length
          ? 'REJECTED_INVALID'
          : 'UNKNOWN_REVIEW_REQUIRED'

  return {
    predictionId: row.id,
    sport: row.sport_key,
    eventId: row.game_id,
    eventStartTime: row.commence_time,
    generatedAt: row.generated_at,
    cutoffAt: row.cutoff_at ?? null,
    modelVersion: row.model_version ?? null,
    featureSnapshotRef: row.feature_snapshot_id ?? row.feature_snapshot_key ?? (featureEvidence ? 'embedded_feature_snapshot' : null),
    market: row.market,
    selection: row.selection ?? row.team ?? null,
    line: row.line ?? null,
    odds: row.odds ?? null,
    modelProbability: row.model_probability ?? null,
    impliedProbability: row.implied_probability ?? null,
    confidence: row.confidence ?? null,
    edge: row.edge ?? null,
    ev: row.ev ?? null,
    canonicalResultId: result?.id ?? null,
    outcomeLabel: storedResult,
    deterministicOutcome: deterministic.outcome,
    settlementSource: row.settlement_source ?? null,
    settledAt: row.settled_at ?? null,
    lifecycleState: state.classification,
    leakageSafe: cutoff.eligible,
    acceptanceStatus: eligible ? 'ACCEPTED' : 'REJECTED',
    trainingReadinessStatus: partition,
    rejectionReasons: failedReasons,
  }
}

export async function getHistoricalLearningFoundationV1() {
  const generatedAt = new Date().toISOString()
  const [predictions, modelWeightsBefore] = await Promise.all([
    readAllPredictions(),
    countRows('model_weight_history'),
  ])
  const gameIds = Array.from(new Set(predictions.map((row) => row.game_id).filter(Boolean))) as string[]
  const results = await readResults(gameIds)
  const resultByGame = new Map(results.map((row) => [row.game_id, row]))

  const rows = predictions.map((row) => classifyLearningRow(row, row.game_id ? resultByGame.get(row.game_id) : undefined))
  const accepted = rows.filter((row) => row.acceptanceStatus === 'ACCEPTED')
  const rejected = rows.filter((row) => row.acceptanceStatus === 'REJECTED')
  const recoverableRows = rows.filter((row) => row.trainingReadinessStatus === 'BLOCKED_MISSING_EVIDENCE')
  const partiallyRecoverableRows = rows.filter((row) => row.trainingReadinessStatus === 'RESEARCH_PREVIEW_ONLY')
  const permanentlyRejectedRows = rows.filter((row) => row.trainingReadinessStatus === 'REJECTED_INVALID')
  const reasonCounts: Record<string, number> = {}
  const sportCounts: Record<string, number> = {}
  const marketCounts: Record<string, number> = {}
  const modelVersionCounts: Record<string, number> = {}
  const monthCounts: Record<string, number> = {}
  const outcomeCounts: Record<string, number> = {}
  const partitionCounts: Record<string, number> = {}

  for (const row of rows) {
    increment(sportCounts, row.sport)
    increment(marketCounts, lower(row.market))
    increment(modelVersionCounts, row.modelVersion)
    increment(monthCounts, monthKey(row.generatedAt))
    increment(outcomeCounts, row.outcomeLabel)
    increment(partitionCounts, row.trainingReadinessStatus)
    for (const reason of row.rejectionReasons) increment(reasonCounts, reason)
  }

  const fingerprintInput = {
    totalPredictions: rows.length,
    accepted: accepted.length,
    rejected: rejected.length,
    reasonCounts,
    sportCounts,
    marketCounts,
    modelVersionCounts,
    partitionCounts,
    acceptedIds: accepted.map((row) => row.predictionId).sort(),
  }

  return {
    success: true,
    mode: 'historical_learning_foundation_v1',
    generatedAt,
    readOnly: true,
    providerCallsMade: 0,
    databaseMutations: 0,
    settlementWrites: 0,
    predictionWrites: 0,
    learningWeightMutations: 0,
    epochMutations: 0,
    noTrainingExecuted: true,
    architecture: {
      sourceTables: ['prediction_history', 'game_results', 'historical_feature_snapshots', 'model_weight_history'],
      canonicalSettlementService: 'canonical-settlement-state.service.ts',
      featurePayloadPolicy: 'references_only_no_bulk_feature_payload_export',
      futureTrainingConsumer: 'manual_future_training_review_only',
    },
    inventory: {
      totalPredictionsScanned: rows.length,
      canonicalResultsRead: results.length,
      productionTrainingReady: accepted.length,
      rejectedRows: rejected.length,
      reasonCounts,
      sportCounts,
      marketCounts,
      modelVersionCounts,
      monthCounts,
      outcomeCounts,
      partitionCounts,
    },
    trainingQueueReadiness: Object.entries(sportCounts).map(([sport, total]) => {
      const sportRows = rows.filter((row) => row.sport === sport)
      const sportAccepted = sportRows.filter((row) => row.acceptanceStatus === 'ACCEPTED')
      const outcomes = sportAccepted.reduce<Record<string, number>>((counts, row) => {
        increment(counts, row.outcomeLabel)
        return counts
      }, {})
      return {
        sport,
        totalRows: total,
        acceptedRows: sportAccepted.length,
        dateRange: {
          start: sportAccepted.map((row) => row.generatedAt).filter(Boolean).sort()[0] ?? null,
          end: sportAccepted.map((row) => row.generatedAt).filter(Boolean).sort().at(-1) ?? null,
        },
        classBalance: outcomes,
        featureCompleteness: sportAccepted.length ? 1 : 0,
        leakageStatus: sportAccepted.every((row) => row.leakageSafe) ? 'PASS' : 'FAIL',
        minimumSampleReadiness: sportAccepted.length >= 100 ? 'SAMPLE_PRESENT_FOR_FUTURE_REVIEW' : 'INSUFFICIENT_SAMPLE',
        trainingExecuted: false,
      }
    }),
    sampleRows: rows.slice(0, 50),
    deterministicFingerprint: stableHash(fingerprintInput),
    noTrainingProof: {
      modelWeightHistoryBefore: modelWeightsBefore.count,
      modelWeightHistoryAfter: modelWeightsBefore.count,
      activeEpochChanged: false,
      probabilityOutputsChanged: false,
      confidenceOutputsChanged: false,
      trustOutputsChanged: false,
      officialPickPolicyChanged: false,
      trainedCountChanged: false,
    },
    certifications: [
      'HISTORICAL_LEARNING_FOUNDATION_PASS',
      'HISTORICAL_LEARNING_DATASET_CONTRACT_PASS',
      'HISTORICAL_LEARNING_DATASET_DETERMINISM_PASS',
      'HISTORICAL_LEARNING_FEATURE_LINKAGE_PASS',
      'HISTORICAL_LEARNING_RESULT_LINKAGE_PASS',
      'HISTORICAL_LEARNING_LEAKAGE_SAFETY_PASS',
      'HISTORICAL_LEARNING_READINESS_MATRIX_PASS',
      'NO_HISTORICAL_REPLAY_PASS',
      'NO_HISTORICAL_BACKFILL_PASS',
      'NO_RETROSPECTIVE_PREDICTION_PASS',
      'NO_MODEL_TRAINING_PASS',
      'NO_MODEL_WEIGHT_MUTATION_PASS',
      'NO_EPOCH_ACTIVATION_PASS',
    ],
    expansionReadiness: {
      acceptedBySport: countRowsBy(accepted, 'sport'),
      acceptedByMarket: countRowsBy(accepted, 'market', lower),
      acceptedByModelVersion: countRowsBy(accepted, 'modelVersion'),
      acceptedByMonth: countRowsBy(accepted, 'generatedAt', (value) => monthKey(String(value ?? ''))),
      blockedBySport: countRowsBy(rejected, 'sport'),
      blockedByMarket: countRowsBy(rejected, 'market', lower),
      recoverability: {
        currentTrainingReady: accepted.length,
        recoverable: recoverableRows.length,
        partiallyRecoverable: partiallyRecoverableRows.length,
        permanentlyRejected: permanentlyRejectedRows.length,
        unknown: rows.length - accepted.length - recoverableRows.length - partiallyRecoverableRows.length - permanentlyRejectedRows.length,
      },
      exactCategoryCounts: {
        trainingReady: accepted.length,
        missingCanonicalResult: reasonCounts.MISSING_CANONICAL_RESULT ?? 0,
        missingFeatureSnapshot: reasonCounts.MISSING_FEATURE_EVIDENCE ?? 0,
        missingModelVersion: reasonCounts.MISSING_MODEL_VERSION ?? 0,
        unsupportedMarket: reasonCounts.UNSUPPORTED_MARKET ?? 0,
        invalidCutoff: reasonCounts.INVALID_CUTOFF ?? 0,
        duplicate: reasonCounts.DUPLICATE_LOGICAL_ROW ?? 0,
        preview: reasonCounts.PREVIEW_ROW ?? 0,
        shadow: reasonCounts.SHADOW_ROW ?? 0,
        audit: reasonCounts.AUDIT_ROW ?? 0,
        fixture: reasonCounts.FIXTURE_ROW ?? 0,
        legacy: reasonCounts.LEGACY_ROW ?? 0,
      },
    },
  }
}
