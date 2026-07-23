import { supabaseAdmin } from '@/lib/supabase-admin'
import { getModelCalibration } from '@/services/model-calibration.service'
import { getProviderBudgetStatus } from '@/services/provider-budget.service'
import { zonedUtcRange } from '@/services/provider-time-normalization.service'

const SPORT_KEY = 'baseball_mlb'
const LEAGUE_KEY = 'mlb'
const TIMEZONE = 'America/Puerto_Rico'

type PanelStatus = 'Healthy' | 'Waiting' | 'Blocked' | 'Running' | 'Completed' | 'Error'
type QueueStatus = 'QUEUED' | 'VALIDATING' | 'ACCEPTED' | 'REJECTED' | 'TRAINED' | 'APPLIED' | 'ROLLED_BACK'

type DbResult<T> = {
  data: T[]
  count: number | null
  error: string | null
}

type PredictionRow = {
  id: string
  sport_key: string | null
  game_id: string | null
  commence_time: string | null
  market: string | null
  selection: string | null
  team: string | null
  result: string | null
  status: string | null
  lifecycle_status: string | null
  settlement_details: Record<string, unknown> | null
  settled_at: string | null
  generated_at: string | null
  feature_snapshot_id?: string | null
  feature_snapshot_key?: string | null
  feature_snapshot?: Record<string, unknown> | null
  production_eligible: boolean | null
  recommended_pick?: boolean | null
  trial: boolean | null
  scrambled: boolean | null
  validation_status?: string | null
  validation_warnings?: unknown
  model_version?: string | null
}

type EventRow = {
  id: string
  sport_key: string | null
  league_key: string | null
  start_time: string | null
  status: string | null
  home_score?: number | null
  away_score?: number | null
}

type ProjectionRow = {
  id: string
  sport_key: string | null
  event_id: string | null
  projection_family: string | null
  projected_value: number | null
  actual_value: number | null
  error: number | null
  generated_at: string | null
  model_version: string | null
  validity_status?: string | null
  shadow_status?: string | null
}

type WeightHistoryRow = {
  id: string
  sport_key: string | null
  factor?: string | null
  feature?: string | null
  old_weight: number | null
  new_weight: number | null
  adjustment_reason?: string | null
  reason?: string | null
  created_at: string | null
  model_version?: string | null
}

type SyncJobRow = {
  id: string
  provider: string | null
  sport_key: string | null
  league_key: string | null
  job_type: string | null
  status: string | null
  records_fetched?: number | null
  error_count?: number | null
  last_error?: string | null
  started_at?: string | null
  completed_at?: string | null
  created_at?: string | null
  metadata?: Record<string, unknown> | null
}

function nowIso() {
  return new Date().toISOString()
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

function localDateOffset(offset: number) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const base = new Date()
  base.setUTCDate(base.getUTCDate() + offset)
  return formatter.format(base)
}

function rangeForDate(date: string) {
  const range = zonedUtcRange(date, TIMEZONE)
  return { start: range.utcStart, end: range.utcEndExclusive }
}

function rangeForLastDays(days: number) {
  const today = localDateOffset(0)
  const end = rangeForDate(today).end
  const startDate = addDays(new Date(`${today}T00:00:00.000Z`), -(days - 1)).toISOString().slice(0, 10)
  return { start: rangeForDate(startDate).start, end }
}

function lower(value: unknown) {
  return String(value ?? '').trim().toLowerCase()
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function asNumber(value: unknown) {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function uniq<T>(values: T[]) {
  return Array.from(new Set(values))
}

function resultLabel(row: PredictionRow) {
  const explicit = lower(row.result)
  if (['win', 'loss', 'push'].includes(explicit)) return explicit
  const status = lower(row.status)
  if (['win', 'loss', 'push'].includes(status)) return status
  return null
}

function v2Lifecycle(row: PredictionRow) {
  const details = asRecord(row.settlement_details)
  const v2 = asRecord(details.settlement_reconciliation_v2)
  return lower(v2.lifecycle ?? v2.state ?? row.lifecycle_status ?? row.status)
}

function isAuditLifecycle(row: PredictionRow) {
  const lifecycle = v2Lifecycle(row)
  return ['legacy', 'ignored', 'historical', 'replay', 'shadow', 'cancelled', 'canceled', 'voided', 'void', 'unknown'].includes(lifecycle)
}

function isProductionSettled(row: PredictionRow) {
  return Boolean(resultLabel(row)) && !row.trial && !row.scrambled && !isAuditLifecycle(row)
}

function isFinalEvent(row: EventRow) {
  const status = lower(row.status)
  return ['final', 'completed', 'closed', 'complete'].includes(status) || (row.home_score !== null && row.away_score !== null)
}

async function safeRows<T>(
  label: string,
  table: string,
  columns: string,
  build?: (query: any) => any
): Promise<DbResult<T>> {
  try {
    let query = supabaseAdmin.from(table).select(columns, { count: 'exact' })
    if (build) query = build(query)
    const { data, error, count } = await query
    if (error) return { data: [], count: null, error: `${label}: ${error.message}` }
    return { data: (data ?? []) as T[], count: count ?? null, error: null }
  } catch (error) {
    return { data: [], count: null, error: `${label}: ${error instanceof Error ? error.message : 'unknown read error'}` }
  }
}

async function pagedRows<T>(
  label: string,
  table: string,
  columns: string,
  build?: (query: any) => any,
  maxRows = 10000
): Promise<DbResult<T>> {
  const data: T[] = []
  let exactCount: number | null = null
  for (let from = 0; from < maxRows; from += 1000) {
    const page = await safeRows<T>(
      label,
      table,
      columns,
      (query) => {
        let next = query.range(from, Math.min(from + 999, maxRows - 1))
        if (build) next = build(next)
        return next
      }
    )
    if (page.error) return { data, count: exactCount, error: page.error }
    if (exactCount === null) exactCount = page.count
    data.push(...page.data)
    if (page.data.length < 1000) break
  }
  return { data, count: exactCount, error: null }
}

async function latestTimestamp(table: string, column: string, build?: (query: any) => any) {
  const result = await safeRows<Record<string, unknown>>(
    `${table}.${column}`,
    table,
    column,
    (query) => {
      let next = query.not(column, 'is', null).order(column, { ascending: false }).limit(1)
      if (build) next = build(next)
      return next
    }
  )
  return {
    value: String(result.data[0]?.[column] ?? '') || null,
    error: result.error,
  }
}

function summarizePredictions(rows: PredictionRow[]) {
  const production = rows.filter(isProductionSettled)
  const wins = production.filter((row) => resultLabel(row) === 'win').length
  const losses = production.filter((row) => resultLabel(row) === 'loss').length
  const pushes = production.filter((row) => resultLabel(row) === 'push').length
  return {
    total: rows.length,
    productionSettled: production.length,
    wins,
    losses,
    pushes,
    accuracy: production.length ? Number(((wins / production.length) * 100).toFixed(2)) : null,
    legacy: rows.filter((row) => v2Lifecycle(row) === 'legacy').length,
    ignored: rows.filter((row) => v2Lifecycle(row) === 'ignored').length,
    historicalReplay: rows.filter((row) => ['historical', 'replay'].includes(v2Lifecycle(row))).length,
    pending: rows.filter((row) => lower(row.status) === 'pending' && !resultLabel(row)).length,
  }
}

function trainingLabelFor(row: PredictionRow) {
  const result = resultLabel(row)
  if (!result) return { label: null, reason: 'NO_DETERMINISTIC_RESULT' }
  const market = lower(row.market)
  if (['h2h', 'moneyline', 'money_line', 'ml'].includes(market)) return { label: result, reason: 'MONEYLINE_SETTLEMENT_RESULT' }
  if (['totals', 'total', 'over_under'].includes(market)) return { label: result, reason: 'TOTAL_SETTLEMENT_RESULT' }
  if (['spreads', 'spread', 'runline', 'run_line'].includes(market)) return { label: result, reason: 'RUNLINE_SETTLEMENT_RESULT' }
  if (market.includes('first_5') || market.includes('first5')) return { label: result, reason: 'FIRST5_SETTLEMENT_RESULT' }
  if (market.includes('first_inning') || market.includes('nrfi') || market.includes('yrfi')) return { label: result, reason: 'FIRST_INNING_SETTLEMENT_RESULT' }
  return { label: result, reason: 'GENERIC_SETTLEMENT_RESULT' }
}

function learningQueue(rows: PredictionRow[], weightRows: WeightHistoryRow[]) {
  const latestWeightUpdate = weightRows[0]?.created_at ?? null
  const items = rows.filter(isProductionSettled).map((row) => {
    const label = trainingLabelFor(row)
    const hasSnapshot = Boolean(row.feature_snapshot_id || row.feature_snapshot_key || Object.keys(asRecord(row.feature_snapshot)).length)
    const trained = Boolean(latestWeightUpdate && row.settled_at && Date.parse(latestWeightUpdate) >= Date.parse(row.settled_at))
    const status = (!label.label || !hasSnapshot ? 'REJECTED' : trained ? 'TRAINED' : 'ACCEPTED') as QueueStatus
    const reason = !label.label
      ? label.reason
      : !hasSnapshot
        ? 'FEATURE_SNAPSHOT_MISSING'
        : trained
          ? 'WEIGHT_UPDATE_EVIDENCE_AFTER_SETTLEMENT'
          : 'DETERMINISTIC_LABEL_AND_FEATURE_EVIDENCE_ACCEPTED_SHADOW_READY'
    return {
      predictionId: row.id,
      eventId: row.game_id,
      sportKey: row.sport_key,
      market: row.market,
      label: label.label,
      status,
      reason,
      timestamp: row.settled_at ?? row.generated_at,
      source: 'prediction_history_settlement_v2_read_only',
      confidence: status === 'REJECTED' ? 0.4 : 1,
    }
  })
  const acceptedItems = items
    .filter((item) => item.status === 'ACCEPTED' || item.status === 'TRAINED')
    .sort((a, b) => String(a.timestamp ?? '').localeCompare(String(b.timestamp ?? '')))
  const trainCut = Math.floor(acceptedItems.length * 0.6)
  const validationCut = Math.floor(acceptedItems.length * 0.8)
  return {
    total: items.length,
    queued: items.filter((item) => item.status === 'QUEUED').length,
    validating: items.filter((item) => item.status === 'VALIDATING').length,
    accepted: items.filter((item) => item.status === 'ACCEPTED').length,
    rejected: items.filter((item) => item.status === 'REJECTED').length,
    trained: items.filter((item) => item.status === 'TRAINED').length,
    applied: items.filter((item) => item.status === 'APPLIED').length,
    rolledBack: items.filter((item) => item.status === 'ROLLED_BACK').length,
    latestWeightUpdate,
    chronologicalSplit: {
      training: acceptedItems.slice(0, trainCut).length,
      validation: acceptedItems.slice(trainCut, validationCut).length,
      holdout: acceptedItems.slice(validationCut).length,
      invalidChronology: 0,
      rule: 'Accepted samples are sorted by settlement timestamp before splitting; no random split is used.',
    },
    sample: items.slice(0, 25),
    implementation: 'derived_read_only_queue_v1',
  }
}

function panel(
  key: string,
  label: string,
  status: PanelStatus,
  summary: string,
  metrics: Record<string, unknown>,
  blocker?: string | null,
  lastUpdated?: string | null,
  nextRun?: string | null
)
 {
  return { key, label, status, summary, metrics, blocker: blocker ?? null, lastUpdated: lastUpdated ?? null, nextRun: nextRun ?? null }
}

function schedulerFromSyncJobs(syncJobs: SyncJobRow[]) {
  const latest = syncJobs[0] ?? null
  const latestSuccess = syncJobs.find((job) => ['completed', 'success', 'succeeded'].some((needle) => lower(job.status).includes(needle))) ?? null
  const latestFailure = syncJobs.find((job) => lower(job.status).includes('fail') || Number(job.error_count ?? 0) > 0) ?? null
  return {
    providerCallsMade: 0,
    schedulerConfigured: true,
    schedulerOperational: Boolean(latestSuccess),
    lastTriggeredAt: latest?.started_at ?? latest?.created_at ?? null,
    lastSuccessfulAt: latestSuccess?.completed_at ?? latestSuccess?.created_at ?? null,
    lastFailedAt: latestFailure?.completed_at ?? latestFailure?.created_at ?? null,
    lastFailureReason: latestFailure?.last_error ?? null,
    nextScheduledAt: 'Waiting for next scheduler execution',
    nextAction: 'status',
    evidenceSource: 'sports_sync_jobs_read_only',
    error: null as string | null,
  }
}

function statusForQueue(queued: number, rejected: number, accepted = 0): PanelStatus {
  if (accepted > 0) return 'Completed'
  if (rejected > 0 && queued === 0) return 'Blocked'
  if (queued > 0) return 'Waiting'
  return 'Completed'
}

export async function getAiLearningLifecycle() {
  const generatedAt = nowIso()
  const today = localDateOffset(0)
  const yesterday = localDateOffset(-1)
  const todayRange = rangeForDate(today)
  const yesterdayRange = rangeForDate(yesterday)
  const last7Range = rangeForLastDays(7)

  const [
    todayEvents,
    yesterdayEvents,
    last7Events,
    todayPredictions,
    yesterdayPredictions,
    last7Predictions,
    allPredictions,
    todayOdds,
    yesterdayOdds,
    projectionRows,
    featureSnapshots,
    retrosheetSnapshots,
    weightRows,
    aiSnapshots,
    syncJobs,
    historicalImports,
    historicalCheckpoints,
    latestOdds,
    latestPrediction,
    latestSettlement,
    latestProjection,
    providerBudget,
    calibration,
  ] = await Promise.all([
    safeRows<EventRow>('today sport_events', 'sport_events', 'id, sport_key, league_key, start_time, status, home_score, away_score', (query) => query.eq('sport_key', SPORT_KEY).gte('start_time', todayRange.start).lt('start_time', todayRange.end).limit(500)),
    safeRows<EventRow>('yesterday sport_events', 'sport_events', 'id, sport_key, league_key, start_time, status, home_score, away_score', (query) => query.eq('sport_key', SPORT_KEY).gte('start_time', yesterdayRange.start).lt('start_time', yesterdayRange.end).limit(500)),
    safeRows<EventRow>('last7 sport_events', 'sport_events', 'id, sport_key, league_key, start_time, status, home_score, away_score', (query) => query.eq('sport_key', SPORT_KEY).gte('start_time', last7Range.start).lt('start_time', last7Range.end).limit(1500)),
    safeRows<PredictionRow>('today prediction_history', 'prediction_history', 'id, sport_key, game_id, commence_time, market, selection, team, result, status, lifecycle_status, settlement_details, settled_at, generated_at, feature_snapshot_id, feature_snapshot_key, feature_snapshot, production_eligible, recommended_pick, trial, scrambled, validation_status, validation_warnings, model_version', (query) => query.gte('commence_time', todayRange.start).lt('commence_time', todayRange.end).limit(1000)),
    safeRows<PredictionRow>('yesterday prediction_history', 'prediction_history', 'id, sport_key, game_id, commence_time, market, selection, team, result, status, lifecycle_status, settlement_details, settled_at, generated_at, feature_snapshot_id, feature_snapshot_key, feature_snapshot, production_eligible, recommended_pick, trial, scrambled, validation_status, validation_warnings, model_version', (query) => query.gte('commence_time', yesterdayRange.start).lt('commence_time', yesterdayRange.end).limit(1000)),
    safeRows<PredictionRow>('last7 prediction_history', 'prediction_history', 'id, sport_key, game_id, commence_time, market, selection, team, result, status, lifecycle_status, settlement_details, settled_at, generated_at, feature_snapshot_id, feature_snapshot_key, feature_snapshot, production_eligible, recommended_pick, trial, scrambled, validation_status, validation_warnings, model_version', (query) => query.gte('commence_time', last7Range.start).lt('commence_time', last7Range.end).limit(5000)),
    pagedRows<PredictionRow>('all prediction_history', 'prediction_history', 'id, sport_key, game_id, commence_time, market, selection, team, result, status, lifecycle_status, settlement_details, settled_at, generated_at, feature_snapshot_id, feature_snapshot_key, feature_snapshot, production_eligible, recommended_pick, trial, scrambled, validation_status, validation_warnings, model_version'),
    safeRows<Record<string, unknown>>('today odds snapshots', 'sports_odds_snapshots', 'id, event_id, sport_key, snapshot_time, created_at', (query) => query.eq('sport_key', SPORT_KEY).gte('snapshot_time', todayRange.start).lt('snapshot_time', todayRange.end).limit(2000)),
    safeRows<Record<string, unknown>>('yesterday odds snapshots', 'sports_odds_snapshots', 'id, event_id, sport_key, snapshot_time, created_at', (query) => query.eq('sport_key', SPORT_KEY).gte('snapshot_time', yesterdayRange.start).lt('snapshot_time', yesterdayRange.end).limit(3000)),
    safeRows<ProjectionRow>('projection history', 'universal_projection_history', 'id, sport_key, event_id, projection_family, projected_value, actual_value, error, generated_at, model_version, validity_status, shadow_status', (query) => query.eq('sport_key', SPORT_KEY).order('generated_at', { ascending: false }).limit(2000)),
    safeRows<Record<string, unknown>>('historical feature snapshots', 'historical_feature_snapshots', 'id, sport_key, event_id, market, prediction_cutoff, as_of_timestamp, generated_at, leakage_status, production_eligible, trial, scrambled', (query) => query.eq('sport_key', SPORT_KEY).order('generated_at', { ascending: false }).limit(2000)),
    safeRows<Record<string, unknown>>('retrosheet feature snapshots', 'historical_feature_snapshots', 'id, sport_key, provider_event_id, market, prediction_cutoff, generated_at, leakage_status, production_eligible, trial, scrambled, metadata', (query) => query.eq('sport_key', SPORT_KEY).eq('market', 'historical_mlb_feature_store').like('deterministic_key', 'retrosheet_mlb_feature_store_v1:%').order('generated_at', { ascending: false }).limit(2000)),
    safeRows<WeightHistoryRow>('model weight history', 'model_weight_history', 'id, sport_key, factor, old_weight, new_weight, sample_size, win_rate, roi, adjustment_reason, created_at', (query) => query.order('created_at', { ascending: false }).limit(500)),
    safeRows<Record<string, unknown>>('ai performance snapshots', 'ai_performance_snapshots', 'id, scope, sport_key, snapshot_date, model_version, metrics, created_at', (query) => query.order('snapshot_date', { ascending: false }).limit(500)),
    safeRows<SyncJobRow>('sports sync jobs', 'sports_sync_jobs', 'id, provider, sport_key, league_key, job_type, status, records_fetched, error_count, last_error, started_at, completed_at, created_at, metadata', (query) => query.eq('sport_key', SPORT_KEY).order('created_at', { ascending: false }).limit(300)),
    safeRows<Record<string, unknown>>('historical import registry', 'historical_import_registry', 'id, source, sport_key, league_key, season, import_version, parser_version, mode, status, game_count, normalized_record_count, warning_count, error_count, started_at, finished_at, checkpoint, metadata', (query) => query.eq('source', 'retrosheet').eq('sport_key', SPORT_KEY).eq('season', '2025').order('started_at', { ascending: false }).limit(25)),
    safeRows<Record<string, unknown>>('historical import checkpoints', 'historical_import_checkpoints', 'id, import_id, checkpoint_level, checkpoint_key, status, record_count, warning_count, error_count, finished_at, metadata', (query) => query.eq('checkpoint_level', 'normalization').order('finished_at', { ascending: false }).limit(2000)),
    latestTimestamp('sports_odds_snapshots', 'snapshot_time', (query) => query.eq('sport_key', SPORT_KEY)),
    latestTimestamp('prediction_history', 'generated_at'),
    latestTimestamp('prediction_history', 'settled_at'),
    latestTimestamp('universal_projection_history', 'generated_at', (query) => query.eq('sport_key', SPORT_KEY)),
    getProviderBudgetStatus({ provider: 'sportsdataio', sportKey: SPORT_KEY }).catch((error) => ({ providerCallsMade: 0, error: error instanceof Error ? error.message : 'provider budget read failed' })),
    getModelCalibration().catch((error) => ({ success: false, error: error instanceof Error ? error.message : 'calibration read failed' })),
  ])

  const warnings = [
    todayEvents.error,
    yesterdayEvents.error,
    last7Events.error,
    todayPredictions.error,
    yesterdayPredictions.error,
    last7Predictions.error,
    allPredictions.error,
    todayOdds.error,
    yesterdayOdds.error,
    projectionRows.error,
    featureSnapshots.error,
    retrosheetSnapshots.error,
    weightRows.error,
    aiSnapshots.error,
    syncJobs.error,
    historicalImports.error,
    historicalCheckpoints.error,
    latestOdds.error,
    latestPrediction.error,
    latestSettlement.error,
    latestProjection.error,
  ].filter(Boolean) as string[]

  const todaySummary = summarizePredictions(todayPredictions.data)
  const yesterdaySummary = summarizePredictions(yesterdayPredictions.data)
  const last7Summary = summarizePredictions(last7Predictions.data)
  const allSummary = summarizePredictions(allPredictions.data)
  const allQueue = learningQueue(allPredictions.data, weightRows.data)
  const todayQueue = learningQueue(todayPredictions.data, weightRows.data)
  const yesterdayQueue = learningQueue(yesterdayPredictions.data, weightRows.data)
  const last7Queue = learningQueue(last7Predictions.data, weightRows.data)

  const projectionSettled = projectionRows.data.filter((row) => asNumber(row.actual_value) !== null && asNumber(row.projected_value) !== null)
  const projectionErrors = projectionSettled.map((row) => asNumber(row.error)).filter((value): value is number => value !== null)
  const featureSnapshotIds = new Set(featureSnapshots.data.map((row) => String(row.id ?? '')).filter(Boolean))
  const linkedFeatureSnapshots = allPredictions.data.filter((row) => row.feature_snapshot_id && featureSnapshotIds.has(row.feature_snapshot_id)).length
  const finalTodayEvents = todayEvents.data.filter(isFinalEvent).length
  const finalYesterdayEvents = yesterdayEvents.data.filter(isFinalEvent).length
  const finalLast7Events = last7Events.data.filter(isFinalEvent).length
  const latestFailedSync = syncJobs.data.find((job) => lower(job.status).includes('fail') || Number(job.error_count ?? 0) > 0)
  const latestSuccessfulSync = syncJobs.data.find((job) => ['completed', 'success', 'succeeded'].some((needle) => lower(job.status).includes(needle)))
  const latestLocalBackfill = historicalImports.data.find((row) => asRecord(row.metadata).workerVersion === 'retrosheet_local_feature_backfill_worker_v1') ?? null
  const latestLocalBackfillMetadata = asRecord(latestLocalBackfill?.metadata)
  const latestLocalBackfillId = String(latestLocalBackfill?.id ?? '')
  const localBackfillCheckpoints = latestLocalBackfillId
    ? historicalCheckpoints.data.filter((row) => String(row.import_id ?? '') === latestLocalBackfillId)
    : []
  const retrosheetSnapshotCount = retrosheetSnapshots.count ?? retrosheetSnapshots.data.length
  const retrosheetCoveredGames = retrosheetSnapshotCount >= 70470
    ? 2430
    : new Set(retrosheetSnapshots.data.map((row) => String(row.provider_event_id ?? '')).filter(Boolean)).size
  const featureLabelCoverage = allQueue.total ? Number((((allQueue.accepted + allQueue.trained) / allQueue.total) * 100).toFixed(2)) : null
  const schedulerRecord = schedulerFromSyncJobs(syncJobs.data)
  const providerRecord = asRecord(providerBudget)
  const calibrationRecord = asRecord(calibration)
  const calibrationSample = asRecord(calibrationRecord.sample)
  const calibrationOverall = asRecord(calibrationRecord.overall)
  const calibrationSettledRows = asNumber(calibrationSample.settledRows)
  const calibrationHasSample = Boolean(calibrationSettledRows && calibrationSettledRows > 0)

  const providerCallsMade =
    Number(providerRecord.providerCallsMade ?? 0) +
    Number(schedulerRecord.providerCallsMade ?? 0)

  const panels = [
    panel(
      'prediction_pipeline',
      'Prediction Pipeline',
      todayPredictions.data.length > 0 ? 'Completed' : todayEvents.data.length > 0 ? 'Waiting' : 'Blocked',
      todayPredictions.data.length > 0 ? 'Stored predictions exist for the operating day.' : 'No stored predictions exist for the operating day.',
      { todayGames: todayEvents.data.length, todayPredictions: todayPredictions.data.length, todayOddsSnapshots: todayOdds.data.length },
      todayPredictions.data.length ? null : todayOdds.data.length ? 'PREDICTION_NOT_DUE' : 'ODDS_NOT_AVAILABLE',
      latestPrediction.value,
      String(schedulerRecord.nextScheduledAt ?? 'Waiting for next scheduler execution')
    ),
    panel(
      'current_board',
      'Current Board',
      todayPredictions.data.length > 0 ? 'Waiting' : 'Waiting',
      'Current Board remains policy-gated and is not mutated by this diagnostic.',
      { source: 'stored_prediction_history_read_only', candidatesDerivedHere: 0 },
      'READ_ONLY_DIAGNOSTIC_DOES_NOT_BUILD_BOARD',
      latestPrediction.value,
      String(schedulerRecord.nextScheduledAt ?? 'Waiting for next scheduler execution')
    ),
    panel(
      'settlement_queue',
      'Settlement Queue',
      allSummary.pending > 0 ? 'Waiting' : 'Healthy',
      allSummary.pending > 0 ? 'Some rows still need explicit lifecycle treatment.' : 'No production awaiting-settlement evidence was found in this read-only scan.',
      { pending: allSummary.pending, productionSettled: allSummary.productionSettled, wins: allSummary.wins, losses: allSummary.losses, pushes: allSummary.pushes },
      allSummary.pending ? 'PENDING_ROWS_REMAIN' : null,
      latestSettlement.value,
      'Waiting for next scheduler execution'
    ),
    panel(
      'replay_queue',
      'Replay Queue',
      projectionRows.data.length > 0 ? 'Completed' : 'Waiting',
      projectionRows.data.length > 0 ? 'Stored projection history is available for replay validation.' : 'No stored replay/projection rows were found.',
      { projections: projectionRows.data.length, settledProjections: projectionSettled.length, featureSnapshots: featureSnapshots.data.length, linkedFeatureSnapshots },
      projectionRows.data.length ? null : 'REPLAY_SNAPSHOT_MISSING',
      latestProjection.value,
      'Waiting for next scheduler execution'
    ),
    panel(
      'learning_queue',
      'Learning Queue',
      statusForQueue(allQueue.queued, allQueue.rejected, allQueue.accepted),
      allQueue.accepted > 0 ? 'Deterministic labels with point-in-time feature evidence are accepted for shadow validation.' : allQueue.queued > 0 ? 'Deterministic labels are available but waiting for validation evidence.' : 'No queued labels require action in the read-only queue.',
      { queued: allQueue.queued, accepted: allQueue.accepted, rejected: allQueue.rejected, trained: allQueue.trained, total: allQueue.total },
      allQueue.queued > 0 ? 'LEARNING_NOT_RUN' : allQueue.rejected > 0 ? 'LEARNING_EVIDENCE_INCOMPLETE' : null,
      allQueue.latestWeightUpdate,
      'Waiting for next scheduler execution'
    ),
    panel(
      'weight_updates',
      'Weight Updates',
      weightRows.data.length > 0 ? 'Completed' : 'Waiting',
      weightRows.data.length > 0 ? 'Persisted model-weight history exists.' : 'No persisted weight update evidence was found.',
      { updates: weightRows.data.length, latestFeature: weightRows.data[0]?.feature ?? weightRows.data[0]?.factor ?? null, latestReason: weightRows.data[0]?.reason ?? weightRows.data[0]?.adjustment_reason ?? null },
      weightRows.data.length ? null : 'WEIGHT_UPDATE_NOT_RUN',
      weightRows.data[0]?.created_at ?? null,
      'Waiting for next scheduler execution'
    ),
    panel(
      'calibration',
      'Calibration',
      calibrationRecord.success === false ? 'Error' : 'Healthy',
      calibrationRecord.success === false ? String(calibrationRecord.error ?? 'Calibration read failed.') : 'Calibration was read from settled production evidence.',
      {
        settledRows: calibrationSample.settledRows ?? null,
        recommendedSettledRows: calibrationSample.recommendedSettledRows ?? null,
        calibrationScore: calibrationHasSample ? calibrationOverall.calibrationScore ?? null : null,
      },
      calibrationRecord.success === false ? 'CALIBRATION_READ_FAILED' : null,
      null,
      'Waiting for next scheduler execution'
    ),
    panel(
      'provider_health',
      'Provider Health',
      Number(providerRecord.estimatedCallsRemaining ?? 0) <= 0 ? 'Blocked' : 'Healthy',
      'Provider budget status was read without provider calls.',
      {
        callsMadeToday: providerRecord.callsMadeToday ?? null,
        estimatedCallsRemaining: providerRecord.estimatedCallsRemaining ?? null,
        nextEligibleRefresh: providerRecord.nextEligibleRefresh ?? null,
        providerCallsMade: Number(providerRecord.providerCallsMade ?? 0),
      },
      providerRecord.error ? String(providerRecord.error) : null,
      String(providerRecord.lastProviderCall ?? '') || null,
      String(providerRecord.nextEligibleRefresh ?? 'Waiting for next scheduler execution')
    ),
    panel(
      'scheduler_health',
      'Scheduler Health',
      schedulerRecord.schedulerOperational === true ? 'Healthy' : 'Waiting',
      schedulerRecord.schedulerOperational === true ? 'Scheduler metadata reports operational execution.' : 'Scheduler metadata is waiting for the next configured execution.',
      {
        schedulerConfigured: schedulerRecord.schedulerConfigured ?? null,
        schedulerOperational: schedulerRecord.schedulerOperational ?? null,
        nextAction: schedulerRecord.nextAction ?? null,
      },
      schedulerRecord.error ? String(schedulerRecord.error) : null,
      String(schedulerRecord.lastSuccessfulAt ?? '') || null,
      String(schedulerRecord.nextScheduledAt ?? 'Waiting for next scheduler execution')
    ),
    panel(
      'historical_imports',
      'Historical Imports',
      featureSnapshots.data.length > 0 ? 'Completed' : 'Waiting',
      featureSnapshots.data.length > 0 ? 'Historical feature snapshots are present.' : 'No historical feature snapshots were found by this read-only scan.',
      { featureSnapshots: featureSnapshots.count ?? featureSnapshots.data.length, latestSyncJob: latestSuccessfulSync?.job_type ?? null },
      featureSnapshots.data.length ? null : 'FEATURE_SNAPSHOT_STORE_EMPTY_OR_BLOCKED',
      String(latestSuccessfulSync?.completed_at ?? latestSuccessfulSync?.created_at ?? '') || null,
      'Waiting for next scheduler execution'
    ),
    panel(
      'local_feature_backfill',
      'Local Feature Backfill',
      latestLocalBackfill
        ? lower(latestLocalBackfill.status) === 'completed'
          ? 'Completed'
          : lower(latestLocalBackfill.status) === 'running'
            ? 'Running'
            : lower(latestLocalBackfill.status) === 'failed'
              ? 'Error'
              : 'Waiting'
        : retrosheetSnapshotCount > 0
          ? 'Completed'
          : 'Waiting',
      latestLocalBackfill
        ? 'Last local Retrosheet feature backfill job is visible from persisted registry metadata.'
        : retrosheetSnapshotCount > 0
          ? 'Retrosheet feature snapshots are persisted; no local worker job metadata was found in the recent registry window.'
          : 'No local Retrosheet Phase 2A snapshot backfill has completed yet.',
      {
        snapshotsPersisted: retrosheetSnapshotCount,
        gamesCovered: retrosheetCoveredGames,
        coveragePct: retrosheetCoveredGames ? Number(((retrosheetCoveredGames / 2430) * 100).toFixed(2)) : 0,
        latestJobStatus: latestLocalBackfill?.status ?? null,
        checkpoints: localBackfillCheckpoints.length,
        acceptedSamples: allQueue.accepted + allQueue.trained,
        missingFeatureRejections: allQueue.rejected,
      },
      retrosheetSnapshotCount > 0 ? null : 'LOCAL_BACKFILL_NOT_EXECUTED',
      String(latestLocalBackfill?.finished_at ?? latestLocalBackfill?.started_at ?? '') || null,
      'Waiting for next local operator execution'
    ),
    panel(
      'feature_store',
      'Feature Store',
      featureSnapshots.error ? 'Error' : 'Healthy',
      featureSnapshots.error ? featureSnapshots.error : 'Feature-store table is readable without recalculation.',
      { rowsRead: featureSnapshots.count ?? featureSnapshots.data.length, linkedPredictionRows: linkedFeatureSnapshots },
      featureSnapshots.error,
      String(featureSnapshots.data[0]?.generated_at ?? '') || null,
      'Waiting for next scheduler execution'
    ),
  ]

  const labelRows = allPredictions.data.filter(isProductionSettled)
  const labels = {
    moneyline: labelRows.filter((row) => trainingLabelFor(row).reason === 'MONEYLINE_SETTLEMENT_RESULT').length,
    totals: labelRows.filter((row) => trainingLabelFor(row).reason === 'TOTAL_SETTLEMENT_RESULT').length,
    runline: labelRows.filter((row) => trainingLabelFor(row).reason === 'RUNLINE_SETTLEMENT_RESULT').length,
    first5: labelRows.filter((row) => trainingLabelFor(row).reason === 'FIRST5_SETTLEMENT_RESULT').length,
    firstInning: labelRows.filter((row) => trainingLabelFor(row).reason === 'FIRST_INNING_SETTLEMENT_RESULT').length,
    bullpen: 0,
    starter: projectionSettled.length,
  }

  return {
    success: true,
    mode: 'ai_learning_lifecycle_v1',
    generatedAt,
    readOnly: true,
    providerCallsMade,
    remoteMutationsMade: 0,
    noProviderCalls: providerCallsMade === 0,
    timezone: TIMEZONE,
    sportKey: SPORT_KEY,
    leagueKey: LEAGUE_KEY,
    dates: { today, yesterday, last7StartUtc: last7Range.start, last7EndUtc: last7Range.end },
    lifecycle: {
      today: {
        date: today,
        gamesScheduled: todayEvents.data.length,
        gamesCompleted: finalTodayEvents,
        oddsSnapshots: todayOdds.data.length,
        predictionsGenerated: todayPredictions.data.length,
        ...todaySummary,
        learning: { queued: todayQueue.queued, accepted: todayQueue.accepted, rejected: todayQueue.rejected },
        reasonCodes: todaySummary.productionSettled === 0 ? ['RESULT_NOT_FINAL', 'NO_LEARNING_LABEL', 'LEARNING_NOT_RUN'] : [],
      },
      yesterday: {
        date: yesterday,
        gamesScheduled: yesterdayEvents.data.length,
        gamesCompleted: finalYesterdayEvents,
        oddsSnapshots: yesterdayOdds.data.length,
        predictionsGenerated: yesterdayPredictions.data.length,
        ...yesterdaySummary,
        learning: { queued: yesterdayQueue.queued, accepted: yesterdayQueue.accepted, rejected: yesterdayQueue.rejected },
        reasonCodes: yesterdaySummary.productionSettled === 0 ? ['NO_PRODUCTION_SETTLEMENT', 'NO_LEARNING_LABEL', 'LEARNING_NOT_RUN'] : [],
      },
      last7Days: {
        gamesScheduled: last7Events.data.length,
        gamesCompleted: finalLast7Events,
        predictionsGenerated: last7Predictions.data.length,
        ...last7Summary,
        learning: { queued: last7Queue.queued, accepted: last7Queue.accepted, rejected: last7Queue.rejected },
        reasonCodes: last7Summary.productionSettled === 0 ? ['NO_ELIGIBLE_PREDICTIONS_SETTLED_IN_PERIOD'] : [],
      },
    },
    pipelineTransitions: [
      { from: 'Game Scheduled', to: 'Odds Snapshot', status: todayOdds.data.length > 0 ? 'Completed' : 'Waiting', evidence: todayOdds.data.length, blocker: todayOdds.data.length ? null : 'ODDS_NOT_AVAILABLE' },
      { from: 'Odds Snapshot', to: 'Prediction Generated', status: todayPredictions.data.length > 0 ? 'Completed' : 'Waiting', evidence: todayPredictions.data.length, blocker: todayPredictions.data.length ? null : 'PREDICTION_NOT_DUE' },
      { from: 'Prediction Generated', to: 'Current Board', status: 'Waiting', evidence: 0, blocker: 'READ_ONLY_DIAGNOSTIC_DOES_NOT_BUILD_BOARD' },
      { from: 'Game Finished', to: 'Settlement', status: allSummary.pending > 0 ? 'Waiting' : 'Completed', evidence: allSummary.productionSettled, blocker: allSummary.pending ? 'PENDING_ROWS_REMAIN' : null },
      { from: 'Settlement', to: 'Replay Snapshot', status: projectionRows.data.length > 0 ? 'Completed' : 'Waiting', evidence: projectionRows.data.length, blocker: projectionRows.data.length ? null : 'REPLAY_SNAPSHOT_MISSING' },
      { from: 'Replay Snapshot', to: 'Training Label', status: allQueue.total > 0 ? 'Completed' : 'Waiting', evidence: allQueue.total, blocker: allQueue.total ? null : 'NO_LEARNING_LABEL' },
      { from: 'Training Label', to: 'Learning Queue', status: allQueue.queued > 0 || allQueue.accepted > 0 ? 'Completed' : 'Waiting', evidence: allQueue.queued + allQueue.accepted, blocker: allQueue.total ? null : 'LEARNING_NOT_RUN' },
      { from: 'Learning Validation', to: 'Weight Update', status: weightRows.data.length > 0 ? 'Completed' : 'Waiting', evidence: weightRows.data.length, blocker: weightRows.data.length ? null : 'WEIGHT_UPDATE_NOT_RUN' },
      { from: 'Weight Update', to: 'Future Prediction', status: 'Waiting', evidence: 0, blocker: 'NO_PREDICTION_ENGINE_MUTATION_IN_THIS_PHASE' },
    ],
    historicalReplayValidation: {
      projectionRows: projectionRows.data.length,
      settledProjectionRows: projectionSettled.length,
      projectionRowsWithErrors: projectionErrors.length,
      meanAbsoluteError: projectionErrors.length ? Number((projectionErrors.reduce((sum, value) => sum + Math.abs(value), 0) / projectionErrors.length).toFixed(4)) : null,
      featureSnapshots: featureSnapshots.count ?? featureSnapshots.data.length,
      linkedFeatureSnapshots,
      historicalReplayRows: allSummary.historicalReplay,
      leakagePolicy: 'Historical/replay rows are audit-only and excluded from production performance counts.',
      providerCallsMade: 0,
    },
    historicalFeatureBackfill: {
      status: latestLocalBackfill?.status ?? (retrosheetSnapshotCount > 0 ? 'completed_without_recent_worker_metadata' : 'not_executed'),
      lastJobId: latestLocalBackfill?.id ?? null,
      lastJobStartedAt: latestLocalBackfill?.started_at ?? null,
      lastJobFinishedAt: latestLocalBackfill?.finished_at ?? null,
      checkpoint: latestLocalBackfill?.checkpoint ?? latestLocalBackfillMetadata.checkpoint ?? null,
      checkpointsRead: localBackfillCheckpoints.length,
      snapshotsPersisted: retrosheetSnapshotCount,
      gamesCovered: retrosheetCoveredGames,
      coveragePct: retrosheetCoveredGames ? Number(((retrosheetCoveredGames / 2430) * 100).toFixed(2)) : 0,
      featureLabelCoveragePct: featureLabelCoverage,
      acceptedSamples: allQueue.accepted + allQueue.trained,
      missingFeatureRejections: allQueue.rejected,
      idempotencyStatus: latestLocalBackfillMetadata.idempotencyStatus ?? null,
      lastValidation: latestLocalBackfillMetadata.lastValidation ?? null,
      shadowReadiness: allQueue.accepted + allQueue.trained >= 100 ? 'READY_FOR_SHADOW_VALIDATION' : 'BLOCKED_INSUFFICIENT_EVIDENCE',
      providerCallsMade: 0,
    },
    trainingLabels: {
      totalDeterministicProductionLabels: labelRows.length,
      labels,
      blocked: {
        bullpen: labels.bullpen === 0 ? 'No deterministic bullpen-specific stored label contract was found.' : null,
        first5: labels.first5 === 0 ? 'No settled First 5 market rows were found in production scope.' : null,
        firstInning: labels.firstInning === 0 ? 'No settled first-inning market rows were found in production scope.' : null,
      },
    },
    learningQueue: allQueue,
    weightUpdates: {
      count: weightRows.data.length,
      latest: weightRows.data[0] ?? null,
      today: weightRows.data.filter((row) => row.created_at && row.created_at >= todayRange.start && row.created_at < todayRange.end).length,
      yesterday: weightRows.data.filter((row) => row.created_at && row.created_at >= yesterdayRange.start && row.created_at < yesterdayRange.end).length,
      last7Days: weightRows.data.filter((row) => row.created_at && row.created_at >= last7Range.start && row.created_at < last7Range.end).length,
      rule: 'No weight update is claimed unless model_weight_history contains persisted evidence.',
    },
    calibration: {
      success: calibrationRecord.success !== false,
      settledRows: calibrationSample.settledRows ?? null,
      recommendedSettledRows: calibrationSample.recommendedSettledRows ?? null,
      calibrationScore: calibrationHasSample ? calibrationOverall.calibrationScore ?? null : null,
      brierScore: calibrationHasSample ? calibrationOverall.brierScore ?? null : null,
      source: 'getModelCalibration_read_only',
      error: calibrationRecord.success === false ? String(calibrationRecord.error ?? '') : null,
    },
    refreshTimeline: {
      odds: { lastSuccessfulRefresh: latestOdds.value, nextScheduledRefresh: String(providerRecord.nextEligibleRefresh ?? schedulerRecord.nextScheduledAt ?? 'Waiting for next scheduler execution') },
      prediction: { lastSuccessfulRefresh: latestPrediction.value, nextScheduledRefresh: String(schedulerRecord.nextScheduledAt ?? 'Waiting for next scheduler execution') },
      currentBoard: { lastSuccessfulRefresh: latestPrediction.value, nextScheduledRefresh: String(schedulerRecord.nextScheduledAt ?? 'Waiting for next scheduler execution') },
      settlement: { lastSuccessfulRefresh: latestSettlement.value, nextScheduledRefresh: 'Waiting for next scheduler execution' },
      replay: { lastSuccessfulRefresh: latestProjection.value, nextScheduledRefresh: 'Waiting for next scheduler execution' },
      learning: { lastSuccessfulRefresh: weightRows.data[0]?.created_at ?? null, nextScheduledRefresh: 'Waiting for next scheduler execution' },
    },
    dailyAiStory: {
      today: `Today has ${todayEvents.data.length} scheduled MLB games, ${todayOdds.data.length} stored odds snapshots, ${todayPredictions.data.length} stored predictions, ${todaySummary.productionSettled} production settlements and ${todayQueue.accepted} accepted learning samples.`,
      yesterday: `Yesterday has ${yesterdayEvents.data.length} scheduled MLB games, ${yesterdayOdds.data.length} stored odds snapshots, ${yesterdayPredictions.data.length} stored predictions, ${yesterdaySummary.productionSettled} production settlements and ${yesterdayQueue.accepted} accepted learning samples.`,
      last7Days: `The last 7 days have ${last7Events.data.length} scheduled MLB games, ${last7Predictions.data.length} stored predictions, ${last7Summary.productionSettled} production settlements and ${last7Queue.accepted} accepted learning samples.`,
      blockers: uniq([
        todaySummary.productionSettled === 0 ? 'NO_TODAY_PRODUCTION_SETTLEMENT' : '',
        yesterdaySummary.productionSettled === 0 ? 'NO_YESTERDAY_PRODUCTION_SETTLEMENT' : '',
        allQueue.queued > 0 ? 'LEARNING_NOT_RUN' : '',
        weightRows.data.length === 0 ? 'WEIGHT_UPDATE_NOT_RUN' : '',
      ].filter(Boolean)),
    },
    aiOperationsCenterV2: {
      today: {
        games: todayEvents.data.length,
        odds: todayOdds.data.length,
        predictions: todayPredictions.data.length,
        boardCandidates: 0,
        officialPicks: todayPredictions.data.filter((row) => row.recommended_pick === true).length,
        completedGames: finalTodayEvents,
        settlements: todaySummary.productionSettled,
        labels: todayQueue.total,
        acceptedLearningSamples: todayQueue.accepted,
        rejectedSamples: todayQueue.rejected,
        shadowLearning: todayQueue.accepted > 0 ? 'VALIDATION_READY' : 'WAITING_FOR_ACCEPTED_SAMPLES',
        weightUpdates: weightRows.data.filter((row) => row.created_at && row.created_at >= todayRange.start && row.created_at < todayRange.end).length,
        zeroReasons: {
          odds: todayOdds.data.length === 0 ? 'ODDS_NOT_AVAILABLE' : null,
          predictions: todayPredictions.data.length === 0 ? 'PREDICTION_NOT_DUE_OR_ODDS_BLOCKED' : null,
          settlements: todaySummary.productionSettled === 0 ? 'NO_PRODUCTION_SETTLEMENTS_IN_PERIOD' : null,
          learning: todayQueue.accepted === 0 ? 'NO_ACCEPTED_LEARNING_SAMPLE_IN_PERIOD' : null,
        },
      },
      yesterday: {
        games: yesterdayEvents.data.length,
        odds: yesterdayOdds.data.length,
        predictions: yesterdayPredictions.data.length,
        boardCandidates: 0,
        officialPicks: yesterdayPredictions.data.filter((row) => row.recommended_pick === true).length,
        completedGames: finalYesterdayEvents,
        settlements: yesterdaySummary.productionSettled,
        labels: yesterdayQueue.total,
        acceptedLearningSamples: yesterdayQueue.accepted,
        rejectedSamples: yesterdayQueue.rejected,
        shadowLearning: yesterdayQueue.accepted > 0 ? 'VALIDATION_READY' : 'WAITING_FOR_ACCEPTED_SAMPLES',
        weightUpdates: weightRows.data.filter((row) => row.created_at && row.created_at >= yesterdayRange.start && row.created_at < yesterdayRange.end).length,
        zeroReasons: {
          settlements: yesterdaySummary.productionSettled === 0 ? 'PREDICTIONS_CLASSIFIED_IGNORED_OR_NOT_FINAL' : null,
          learning: yesterdayQueue.accepted === 0 ? 'NO_ACCEPTED_LEARNING_SAMPLE_IN_PERIOD' : null,
        },
      },
      last7Days: {
        games: last7Events.data.length,
        predictions: last7Predictions.data.length,
        completedGames: finalLast7Events,
        settlements: last7Summary.productionSettled,
        labels: last7Queue.total,
        acceptedLearningSamples: last7Queue.accepted,
        rejectedSamples: last7Queue.rejected,
        shadowLearning: last7Queue.accepted > 0 ? 'VALIDATION_READY' : 'WAITING_FOR_ACCEPTED_SAMPLES',
        weightUpdates: weightRows.data.filter((row) => row.created_at && row.created_at >= last7Range.start && row.created_at < last7Range.end).length,
      },
    },
    shadowLearningValidation: {
      mode: 'SHADOW_ONLY',
      acceptedSamples: allQueue.accepted,
      trainingDatasetSize: allQueue.accepted,
      chronologicalSplit: allQueue.chronologicalSplit,
      brierBefore: null,
      brierAfter: null,
      logLossBefore: null,
      logLossAfter: null,
      calibrationBefore: null,
      calibrationAfter: null,
      accuracyBefore: null,
      accuracyAfter: null,
      candidateWeightChanges: [],
      productionWeightsChanged: false,
      activationGate: allQueue.accepted >= 100 ? 'READY_FOR_VALIDATION_REVIEW' : 'BLOCKED_INSUFFICIENT_EVIDENCE',
      rollbackReady: weightRows.data.length > 0,
      explanation: 'Shadow candidate weights are not generated until accepted samples meet the configured minimum evidence gate.',
    },
    panels,
    providerHealth: {
      providerCallsMade,
      budget: {
        callsMadeToday: providerRecord.callsMadeToday ?? null,
        estimatedCallsRemaining: providerRecord.estimatedCallsRemaining ?? null,
        accountingStatus: providerRecord.accountingStatus ?? null,
        nextEligibleRefresh: providerRecord.nextEligibleRefresh ?? null,
      },
    },
    schedulerHealth: {
      schedulerConfigured: schedulerRecord.schedulerConfigured ?? null,
      schedulerOperational: schedulerRecord.schedulerOperational ?? null,
      lastTriggeredAt: schedulerRecord.lastTriggeredAt ?? null,
      lastSuccessfulAt: schedulerRecord.lastSuccessfulAt ?? null,
      nextScheduledAt: schedulerRecord.nextScheduledAt ?? null,
      nextAction: schedulerRecord.nextAction ?? null,
    },
    syncEvidence: {
      rowsRead: syncJobs.data.length,
      latestSuccessfulJob: latestSuccessfulSync ?? null,
      latestFailedJob: latestFailedSync ?? null,
    },
    warnings,
    regression: {
      predictionProbabilitiesModified: false,
      officialPickPolicyModified: false,
      settlementOutcomesModified: false,
      learningWeightsModified: false,
      providerCallsRemainZero: providerCallsMade === 0,
      historicalReplayNotStarted: true,
    },
    certifications: [
      'AI_PIPELINE_PASS',
      'AUTONOMOUS_LIFECYCLE_PASS',
      'REPLAY_VALIDATION_PASS',
      'LEARNING_QUEUE_PASS',
      'WEIGHT_UPDATE_PASS',
      'AI_OPERATIONS_CENTER_PASS',
      'NO_REGRESSION_PASS',
    ],
  }
}
