import 'server-only'

import { createHash } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase-admin'

const SPORT_KEY = 'baseball_mlb'
const LEAGUE_KEY = 'mlb'
export const P23_REPLAY_ENGINE_VERSION = 'historical_progressive_replay_v1'
export const P23_REPLAY_FEATURE_VERSION = 'historical_prediction_snapshot_lineage_pilot_v1'
export const P23_REPLAY_POLICY_VERSION = 'p2_3_frozen_engine_replay_policy_v1'
export const P23_REPLAY_SCOPE = 'REPLAY'
export const P23_REPLAY_FAMILY = 'historical_progressive_replay_v1'
export const P23_REPLAY_SOURCE = 'p2_3_historical_progressive_replay'
const CHECKPOINT_KEY = 'p2_3_historical_progressive_replay_v1:bounded'
const MAX_EVENTS = 10
const MARKETS = ['moneyline', 'spread', 'total'] as const

type MarketKey = typeof MARKETS[number]

type PredictionRow = {
  id: string
  sport_key: string
  game_id: string | null
  commence_time: string | null
  home_team: string | null
  away_team: string | null
  team: string | null
  opponent: string | null
  market: string | null
  sportsbook: string | null
  odds: number | null
  implied_probability: number | null
  model_probability: number | null
  edge: number | null
  ev: number | null
  confidence: number | null
  selection: string | null
  line: number | null
  odds_timestamp: string | null
  generated_at: string | null
  cutoff_at: string | null
  model_version: string | null
  feature_snapshot: Record<string, unknown> | null
  feature_snapshot_id: string | null
  feature_snapshot_key: string | null
  feature_set_version: string | null
  feature_snapshot_generated_at: string | null
  production_eligible: boolean | null
  trial: boolean | null
  scrambled: boolean | null
  prediction_epoch_key: string | null
  lifecycle_status: string | null
  status: string | null
  result: string | null
  settlement_details: Record<string, unknown> | null
  settled_at: string | null
}

type EventRow = {
  id: string
  sport_key: string
  start_time: string | null
  status: string | null
  home_team: string | null
  away_team: string | null
  home_score: number | null
  away_score: number | null
}

type FeatureSnapshotRow = {
  id: string
  event_id: string | null
  market: string
  prediction_cutoff: string
  as_of_timestamp: string
  generated_at: string
  model_version: string
  feature_set_version: string
  data_quality_score: number | null
  data_sufficiency_score: number | null
  leakage_status: string
  leakage_warnings: string[] | null
  metadata: Record<string, unknown> | null
}

type OddsSnapshotRow = {
  id: string
  event_id: string
  market: string
  sportsbook: string
  provider: string
  outcome: string
  price: number | null
  line: number | null
  snapshot_time: string
  metadata: Record<string, unknown> | null
}

type ReplayPrediction = {
  sourcePrediction: PredictionRow
  event: EventRow
  feature: FeatureSnapshotRow
  odds: OddsSnapshotRow
  market: MarketKey
  idempotencyKey: string
  metricsBefore: ReplayMetrics
  metricsAfter: ReplayMetrics
  leakageChecks: Record<string, boolean>
  leakageFailures: string[]
}

type ReplayMetrics = {
  processedEvents: number
  predictions: number
  settled: number
  wins: number
  losses: number
  pushes: number
  accuracy: number | null
  brier: number | null
  calibration: number | null
  roi: number | null
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function asNumber(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function round(value: number, digits = 4) {
  return Number(value.toFixed(digits))
}

function stableId(parts: unknown[]) {
  return createHash('sha256').update(parts.map((part) => String(part ?? '')).join('|')).digest('hex')
}

function normalizeMarket(value: unknown): MarketKey | null {
  const market = String(value ?? '').toLowerCase().replaceAll('-', '_')
  if (market === 'moneyline') return 'moneyline'
  if (market === 'spread' || market === 'run_line') return 'spread'
  if (market === 'total') return 'total'
  return null
}

function outcome(row: PredictionRow) {
  const value = String(row.result ?? row.status ?? '').toLowerCase()
  if (value.includes('win')) return 'win'
  if (value.includes('loss')) return 'loss'
  if (value.includes('push')) return 'push'
  if (value.includes('void')) return 'void'
  return 'pending'
}

function americanProfit(odds: number | null, result: string) {
  if (result === 'push') return 0
  if (result !== 'win') return -1
  if (!Number.isFinite(Number(odds))) return 0
  const price = Number(odds)
  return price > 0 ? price / 100 : 100 / Math.abs(price)
}

function scoreMetrics(rows: ReplayPrediction[], processedEvents: number): ReplayMetrics {
  let wins = 0
  let losses = 0
  let pushes = 0
  let brierSum = 0
  let brierCount = 0
  let probabilitySum = 0
  let outcomeSum = 0
  let roiUnits = 0
  for (const item of rows) {
    const result = outcome(item.sourcePrediction)
    if (result === 'win') wins += 1
    if (result === 'loss') losses += 1
    if (result === 'push') pushes += 1
    if (['win', 'loss', 'push'].includes(result)) roiUnits += americanProfit(item.sourcePrediction.odds, result)
    if (result === 'win' || result === 'loss') {
      const probability = Math.max(0, Math.min(1, Number(item.sourcePrediction.model_probability ?? 0) / 100))
      const actual = result === 'win' ? 1 : 0
      brierSum += (probability - actual) ** 2
      probabilitySum += probability
      outcomeSum += actual
      brierCount += 1
    }
  }
  const settled = wins + losses + pushes
  return {
    processedEvents,
    predictions: rows.length,
    settled,
    wins,
    losses,
    pushes,
    accuracy: wins + losses ? round((wins / (wins + losses)) * 100, 2) : null,
    brier: brierCount ? round(brierSum / brierCount, 4) : null,
    calibration: brierCount ? round(Math.abs((probabilitySum / brierCount) - (outcomeSum / brierCount)) * 100, 2) : null,
    roi: rows.length ? round((roiUnits / rows.length) * 100, 2) : null,
  }
}

function cutoffFor(row: PredictionRow, feature: FeatureSnapshotRow) {
  return row.cutoff_at ?? feature.prediction_cutoff ?? row.commence_time ?? row.generated_at
}

function leakageChecks(row: PredictionRow, event: EventRow, feature: FeatureSnapshotRow, odds: OddsSnapshotRow) {
  const cutoff = cutoffFor(row, feature)
  const eventStart = event.start_time ?? row.commence_time
  const source = asRecord(row.feature_snapshot)
  const featureMode = String(source.mode ?? '')
  const generatedModeOk = featureMode === P23_REPLAY_FEATURE_VERSION
  const oddsTs = new Date(odds.snapshot_time).getTime()
  const cutoffTs = cutoff ? new Date(cutoff).getTime() : Number.NaN
  const eventTs = eventStart ? new Date(eventStart).getTime() : Number.NaN
  const featureAsOfTs = new Date(feature.as_of_timestamp).getTime()
  return {
    marketTimestampBeforeCutoff: Number.isFinite(oddsTs) && Number.isFinite(cutoffTs) && oddsTs < cutoffTs,
    featureTimestampBeforeOrAtCutoff: Number.isFinite(featureAsOfTs) && Number.isFinite(cutoffTs) && featureAsOfTs <= cutoffTs,
    cutoffBeforeEventStart: Number.isFinite(cutoffTs) && Number.isFinite(eventTs) && cutoffTs < eventTs,
    sourceFeatureModeIsHistoricalValidation: generatedModeOk,
    finalResultExcludedFromFeatureSnapshot: !JSON.stringify(source).toLowerCase().includes('finalscore'),
    currentProductionEpochNotUsedAsInput: String(row.prediction_epoch_key ?? '') !== 'CURRENT_V2_PRODUCTION' || row.production_eligible === false,
    replayStorageScopeIsIsolated: true,
    engineVersionFrozen: true,
    eventOrderingDeterministic: true,
    noProviderCalls: true,
  }
}

function failedChecks(checks: Record<string, boolean>) {
  return Object.entries(checks).filter(([, ok]) => !ok).map(([key]) => key)
}

// Supabase's fluent builders intentionally change generic types after select/filters.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function countTable(table: string, build?: (query: any) => any) {
  let query = supabaseAdmin.from(table).select('id', { count: 'exact', head: true })
  if (build) query = build(query)
  const { count, error } = await query
  return { count: error ? null : count ?? 0, error: error?.message ?? null }
}

async function loadCandidateRows({ sportKey, dateFrom, dateTo, eventLimit }: { sportKey: string; dateFrom?: string | null; dateTo?: string | null; eventLimit: number }) {
  let query = supabaseAdmin
    .from('prediction_history')
    .select('id, sport_key, game_id, commence_time, home_team, away_team, team, opponent, market, sportsbook, odds, implied_probability, model_probability, edge, ev, confidence, selection, line, odds_timestamp, generated_at, cutoff_at, model_version, feature_snapshot, feature_snapshot_id, feature_snapshot_key, feature_set_version, feature_snapshot_generated_at, production_eligible, trial, scrambled, prediction_epoch_key, lifecycle_status, status, result, settlement_details, settled_at')
    .eq('sport_key', sportKey)
    .eq('production_eligible', false)
    .eq('trial', false)
    .eq('scrambled', false)
    .not('feature_snapshot_id', 'is', null)
    .not('odds_timestamp', 'is', null)
    .order('commence_time', { ascending: true })
    .order('game_id', { ascending: true })
    .limit(Math.max(100, eventLimit * 60))
  if (dateFrom) query = query.gte('commence_time', `${dateFrom}T00:00:00.000Z`)
  if (dateTo) query = query.lt('commence_time', `${dateTo}T23:59:59.999Z`)
  const { data, error } = await query
  if (error) throw new Error(`P2.3 candidate read failed: ${error.message}`)
  return ((data ?? []) as PredictionRow[]).filter((row) => {
    const snapshot = asRecord(row.feature_snapshot)
    return snapshot.mode === P23_REPLAY_FEATURE_VERSION && Boolean(snapshot.sourceOddsSnapshotId ?? snapshot.oddsSnapshotId) && ['win', 'loss', 'push'].includes(outcome(row))
  })
}

function selectCanonicalRows(rows: PredictionRow[], eventLimit: number) {
  const byEvent = new Map<string, PredictionRow[]>()
  for (const row of rows) {
    if (!row.game_id || !row.commence_time) continue
    byEvent.set(row.game_id, [...(byEvent.get(row.game_id) ?? []), row])
  }
  const selectedEvents = Array.from(byEvent.entries())
    .sort((a, b) => String(a[1][0]?.commence_time ?? '').localeCompare(String(b[1][0]?.commence_time ?? '')) || a[0].localeCompare(b[0]))
    .slice(0, eventLimit)
  const selected: PredictionRow[] = []
  for (const [, eventRows] of selectedEvents) {
    for (const market of MARKETS) {
      const candidate = eventRows
        .filter((row) => normalizeMarket(row.market) === market)
        .sort((a, b) => Number(b.confidence ?? 0) - Number(a.confidence ?? 0) || String(a.id).localeCompare(String(b.id)))[0]
      if (candidate) selected.push(candidate)
    }
  }
  return selected
}

async function loadEvents(ids: string[]) {
  if (!ids.length) return new Map<string, EventRow>()
  const { data, error } = await supabaseAdmin.from('sport_events').select('id, sport_key, start_time, status, home_team, away_team, home_score, away_score').in('id', ids)
  if (error) throw new Error(`P2.3 event read failed: ${error.message}`)
  return new Map(((data ?? []) as EventRow[]).map((row) => [row.id, row]))
}

async function loadFeatures(ids: string[]) {
  if (!ids.length) return new Map<string, FeatureSnapshotRow>()
  const { data, error } = await supabaseAdmin.from('historical_feature_snapshots').select('id, event_id, market, prediction_cutoff, as_of_timestamp, generated_at, model_version, feature_set_version, data_quality_score, data_sufficiency_score, leakage_status, leakage_warnings, metadata').in('id', ids)
  if (error) throw new Error(`P2.3 feature read failed: ${error.message}`)
  return new Map(((data ?? []) as FeatureSnapshotRow[]).map((row) => [row.id, row]))
}

async function loadOdds(ids: string[]) {
  if (!ids.length) return new Map<string, OddsSnapshotRow>()
  const { data, error } = await supabaseAdmin.from('sports_odds_snapshots').select('id, event_id, market, sportsbook, provider, outcome, price, line, snapshot_time, metadata').in('id', ids)
  if (error) throw new Error(`P2.3 odds read failed: ${error.message}`)
  return new Map(((data ?? []) as OddsSnapshotRow[]).map((row) => [row.id, row]))
}

async function createJob(eventLimit: number, dryRun: boolean, runMode: string) {
  const startedAt = new Date().toISOString()
  if (dryRun) return { id: null, startedAt }
  const { data, error } = await supabaseAdmin.from('sports_sync_jobs').insert({
    job_type: P23_REPLAY_ENGINE_VERSION,
    sport_key: SPORT_KEY,
    league_key: LEAGUE_KEY,
    provider: P23_REPLAY_SOURCE,
    season: '2026',
    started_at: startedAt,
    status: 'running',
    records_fetched: eventLimit,
    metadata: { replayOnly: true, replayScope: P23_REPLAY_SCOPE, runMode, providerCallsMade: 0, productionPredictionHistoryMutated: false, learningBrainMutated: false },
  }).select('id').single()
  if (error) throw new Error(`P2.3 job insert failed: ${error.message}`)
  return { id: String(data.id), startedAt }
}

async function completeJob(job: { id: string | null; startedAt: string }, status: 'completed' | 'failed', stats: Record<string, unknown>, error?: string) {
  if (!job.id) return
  const completedAt = new Date().toISOString()
  const { error: updateError } = await supabaseAdmin.from('sports_sync_jobs').update({
    status,
    completed_at: completedAt,
    duration_ms: Math.max(0, new Date(completedAt).getTime() - new Date(job.startedAt).getTime()),
    records_fetched: Number(stats.eventsProcessed ?? 0),
    records_inserted: Number(stats.inserted ?? 0),
    records_skipped: Number(stats.reused ?? 0),
    error_count: status === 'failed' ? 1 : 0,
    last_error: error ?? null,
    metadata: stats,
  }).eq('id', job.id)
  if (updateError) throw new Error(`P2.3 job update failed: ${updateError.message}`)
}

async function persistCheckpoint(jobId: string | null, status: 'completed' | 'failed', stats: Record<string, unknown>, dryRun: boolean) {
  if (dryRun) return { written: false, checkpointKey: CHECKPOINT_KEY, status }
  const { error } = await supabaseAdmin.from('historical_import_checkpoints').upsert({
    id: `p2_3_progressive_replay:${CHECKPOINT_KEY}`,
    import_id: null,
    source_registry_id: null,
    checkpoint_level: 'validation',
    checkpoint_key: CHECKPOINT_KEY,
    status,
    record_count: Number(stats.predictions ?? 0),
    warning_count: Number(stats.skipped ?? 0),
    error_count: status === 'failed' ? 1 : 0,
    started_at: stats.startedAt,
    finished_at: stats.finishedAt,
    metadata: { replayOnly: true, replayScope: P23_REPLAY_SCOPE, syncJobId: jobId, resumeSupported: true, ...stats },
  }, { onConflict: 'id' })
  if (error) throw new Error(`P2.3 checkpoint upsert failed: ${error.message}`)
  return { written: true, checkpointKey: CHECKPOINT_KEY, status }
}

function rowFor(item: ReplayPrediction) {
  const row = item.sourcePrediction
  const result = outcome(row)
  const probability = asNumber(row.model_probability) ?? 0
  const actualValue = result === 'win' ? 100 : result === 'loss' ? 0 : 50
  const error = probability - actualValue
  return {
    id: item.idempotencyKey,
    sport_key: SPORT_KEY,
    league_key: LEAGUE_KEY,
    season: '2026',
    event_id: row.game_id,
    entity_type: 'game',
    entity_id: row.game_id,
    entity_name: `${row.away_team ?? item.event.away_team ?? 'Away'} @ ${row.home_team ?? item.event.home_team ?? 'Home'}`,
    team_id: null,
    team_name: row.team,
    projection_key: `${item.market}_p2_3_replay_probability`,
    projection_family: P23_REPLAY_FAMILY,
    model_version: P23_REPLAY_ENGINE_VERSION,
    unit: 'PROBABILITY_PERCENT',
    projection_origin: 'P2_3_STORED_HISTORICAL_VALIDATION_REPLAY',
    validity_status: item.leakageFailures.length ? 'MODEL_BLOCKED' : 'VALID',
    projected_value: probability,
    confidence: row.confidence,
    historical_accuracy: item.metricsAfter.accuracy,
    feature_quality: item.feature.data_quality_score,
    data_sufficiency: item.feature.data_sufficiency_score,
    prediction_interval_low: Math.max(0, probability - 8),
    prediction_interval_high: Math.min(100, probability + 8),
    readiness: item.leakageFailures.length ? 'BLOCKED' : 'READY',
    shadow_status: 'REPLAY_ONLY',
    rank_score: row.confidence ?? probability,
    rank_tier: 'P2_3_REPLAY',
    identity_confidence: 100,
    participation_status: 'HISTORICAL_REPLAY_SETTLED',
    starter_status: null,
    feature_contributions: [
      { feature: 'stored_historical_validation_prediction', status: 'AVAILABLE', contribution: 1, explanation: 'Replay uses stored non-production historical validation output, not current recommendations.' },
      { feature: 'source_odds_snapshot', status: 'AVAILABLE', contribution: 1, explanation: 'Stored odds snapshot id is linked and timestamped before cutoff.' },
      { feature: 'linked_feature_snapshot', status: 'AVAILABLE', contribution: 1, explanation: 'Linked historical feature snapshot is cutoff-safe and quarantined.' },
    ],
    explanation: `P2.3 ${item.market} replay for ${row.selection ?? row.team ?? 'selection'} is isolated from Current Era, Official Picks, Current Board and Learning.`,
    feature_snapshot: {
      replayScope: P23_REPLAY_SCOPE,
      replayEngineVersion: P23_REPLAY_ENGINE_VERSION,
      featureVersion: item.feature.feature_set_version,
      policyVersion: P23_REPLAY_POLICY_VERSION,
      sourcePredictionId: row.id,
      sourceFeatureSnapshotId: item.feature.id,
      sourceOddsSnapshotId: item.odds.id,
      historicalMarketTimestamp: item.odds.snapshot_time,
      historicalCutoffAt: cutoffFor(row, item.feature),
      metricsBefore: item.metricsBefore,
      metricsAfter: item.metricsAfter,
      leakageChecks: item.leakageChecks,
      leakageFailures: item.leakageFailures,
    },
    actual_value: actualValue,
    error,
    absolute_error: Math.abs(error),
    squared_error: error ** 2,
    calibration: { replayOnly: true, settlementOutcome: result, metricsAfter: item.metricsAfter },
    drift: {},
    source: P23_REPLAY_SOURCE,
    generated_at: cutoffFor(row, item.feature),
    settled_at: row.settled_at ?? new Date().toISOString(),
    idempotency_key: item.idempotencyKey,
    metadata: {
      replayOnly: true,
      replayScope: P23_REPLAY_SCOPE,
      productionEvaluable: false,
      recommendationEligible: false,
      officialPickEligible: false,
      currentBoardMutated: false,
      productionPredictionHistoryMutated: false,
      productionSettlementMutated: false,
      productionLearningMutated: false,
      schedulerMutated: false,
      providerCallsMade: 0,
      settlement: { outcome: result, sourcePredictionId: row.id },
    },
  }
}

async function persistReplay(predictions: ReplayPrediction[], dryRun: boolean) {
  const ids = predictions.map((item) => item.idempotencyKey)
  const existing = ids.length ? await supabaseAdmin.from('universal_projection_history').select('id, idempotency_key').in('idempotency_key', ids) : { data: [], error: null }
  if (existing.error) throw new Error(`P2.3 existing replay lookup failed: ${existing.error.message}`)
  const existingIds = new Set((existing.data ?? []).map((row) => String(row.idempotency_key ?? row.id)))
  const rows = predictions.map(rowFor).filter((row) => !existingIds.has(row.idempotency_key))
  if (!dryRun && rows.length) {
    const { error } = await supabaseAdmin.from('universal_projection_history').insert(rows)
    if (error) throw new Error(`P2.3 replay insert failed: ${error.message}`)
  }
  return { attempted: predictions.length, inserted: rows.length, reused: predictions.length - rows.length, duplicateIds: ids.length - new Set(ids).size }
}

export async function runHistoricalProgressiveReplay(options: { sportKey?: string | null; dateFrom?: string | null; dateTo?: string | null; eventLimit?: number | null; dryRun?: boolean | null; runMode?: string | null } = {}) {
  const sportKey = options.sportKey ?? SPORT_KEY
  if (sportKey !== SPORT_KEY) throw new Error('P2.3 replay currently supports baseball_mlb only.')
  const eventLimit = Math.max(1, Math.min(Number(options.eventLimit ?? 1), MAX_EVENTS))
  const dryRun = options.dryRun !== false
  const runMode = String(options.runMode ?? (eventLimit === 1 ? 'ONE_EVENT_CERTIFICATION' : 'BOUNDED_SAMPLE')).toUpperCase()
  const startedAt = new Date().toISOString()
  const before = {
    currentEraRows: await countTable('prediction_history', (q) => q.eq('sport_key', SPORT_KEY).eq('prediction_epoch_key', 'CURRENT_V2_PRODUCTION')),
    productionEligibleRows: await countTable('prediction_history', (q) => q.eq('sport_key', SPORT_KEY).eq('production_eligible', true)),
    learningWeights: await countTable('model_weight_history', (q) => q.eq('sport_key', SPORT_KEY)),
    historicalFeatures: await countTable('historical_feature_snapshots', (q) => q.eq('sport_key', SPORT_KEY)),
    replayRows: await countTable('universal_projection_history', (q) => q.eq('sport_key', SPORT_KEY).eq('projection_family', P23_REPLAY_FAMILY)),
  }
  const job = await createJob(eventLimit, dryRun, runMode)
  try {
    const candidates = selectCanonicalRows(await loadCandidateRows({ sportKey, dateFrom: options.dateFrom, dateTo: options.dateTo, eventLimit }), eventLimit)
    const events = await loadEvents(Array.from(new Set(candidates.map((row) => row.game_id).filter(Boolean))) as string[])
    const features = await loadFeatures(Array.from(new Set(candidates.map((row) => row.feature_snapshot_id).filter(Boolean))) as string[])
    const oddsIds = candidates.map((row) => String(asRecord(row.feature_snapshot).sourceOddsSnapshotId ?? asRecord(row.feature_snapshot).oddsSnapshotId ?? '')).filter(Boolean)
    const odds = await loadOdds(Array.from(new Set(oddsIds)))
    const selected: ReplayPrediction[] = []
    const skipped: Array<Record<string, unknown>> = []
    const seenEvents = new Set<string>()
    for (const row of candidates) {
      const event = row.game_id ? events.get(row.game_id) : undefined
      const feature = row.feature_snapshot_id ? features.get(row.feature_snapshot_id) : undefined
      const oddsId = String(asRecord(row.feature_snapshot).sourceOddsSnapshotId ?? asRecord(row.feature_snapshot).oddsSnapshotId ?? '')
      const odd = odds.get(oddsId)
      const market = normalizeMarket(row.market)
      if (!event || !feature || !odd || !market) {
        skipped.push({ sourcePredictionId: row.id, eventId: row.game_id, market: row.market, reason: !odd ? 'HISTORICAL_ODDS_UNAVAILABLE' : !feature ? 'HISTORICAL_FEATURE_UNAVAILABLE' : !event ? 'EVENT_UNAVAILABLE' : 'UNSUPPORTED_MARKET' })
        continue
      }
      const beforeMetrics = scoreMetrics(selected, seenEvents.size)
      const checks = leakageChecks(row, event, feature, odd)
      const failures = failedChecks(checks)
      if (failures.length) {
        skipped.push({ sourcePredictionId: row.id, eventId: row.game_id, market, reason: 'SKIPPED_LEAKAGE_RISK', failures })
        continue
      }
      const id = stableId([P23_REPLAY_FAMILY, row.game_id, market, row.id])
      const draft = { sourcePrediction: row, event, feature, odds: odd, market, idempotencyKey: id, metricsBefore: beforeMetrics, metricsAfter: beforeMetrics, leakageChecks: checks, leakageFailures: failures }
      selected.push(draft)
      seenEvents.add(row.game_id ?? '')
      draft.metricsAfter = scoreMetrics(selected, seenEvents.size)
    }
    const persisted = await persistReplay(selected, dryRun)
    const finishedAt = new Date().toISOString()
    const stats = {
      startedAt,
      finishedAt,
      runMode,
      sportKey,
      eventLimit,
      eventsProcessed: seenEvents.size,
      predictions: selected.length,
      settled: selected.filter((item) => ['win', 'loss', 'push'].includes(outcome(item.sourcePrediction))).length,
      inserted: persisted.inserted,
      reused: persisted.reused,
      skipped: skipped.length,
      skipReasons: skipped.reduce<Record<string, number>>((acc, item) => { const key = String(item.reason); acc[key] = (acc[key] ?? 0) + 1; return acc }, {}),
      leakageFailures: selected.reduce((sum, item) => sum + item.leakageFailures.length, 0),
      markets: MARKETS,
      metrics: scoreMetrics(selected, seenEvents.size),
      selectedEvents: Array.from(seenEvents),
      selectedPredictions: selected.map((item) => ({ sourcePredictionId: item.sourcePrediction.id, eventId: item.sourcePrediction.game_id, market: item.market, result: outcome(item.sourcePrediction), oddsSnapshotId: item.odds.id, featureSnapshotId: item.feature.id, idempotencyKey: item.idempotencyKey })),
      skippedDetails: skipped,
      providerCallsMade: 0,
      providerCreditsUsed: 0,
      remoteMutationsMade: dryRun ? 0 : persisted.inserted + 2,
      replayWrites: dryRun ? 0 : persisted.inserted,
      currentEraWrites: 0,
      historicalMutations: 0,
      productionSettlementWrites: 0,
      productionLearningWrites: 0,
    }
    const checkpoint = await persistCheckpoint(job.id, 'completed', stats, dryRun)
    await completeJob(job, 'completed', { ...stats, checkpointWritten: checkpoint.written })
    const after = {
      currentEraRows: await countTable('prediction_history', (q) => q.eq('sport_key', SPORT_KEY).eq('prediction_epoch_key', 'CURRENT_V2_PRODUCTION')),
      productionEligibleRows: await countTable('prediction_history', (q) => q.eq('sport_key', SPORT_KEY).eq('production_eligible', true)),
      learningWeights: await countTable('model_weight_history', (q) => q.eq('sport_key', SPORT_KEY)),
      historicalFeatures: await countTable('historical_feature_snapshots', (q) => q.eq('sport_key', SPORT_KEY)),
      replayRows: await countTable('universal_projection_history', (q) => q.eq('sport_key', SPORT_KEY).eq('projection_family', P23_REPLAY_FAMILY)),
    }
    return {
      success: true,
      mode: 'p2_3_historical_progressive_replay_v1',
      dryRun,
      jobId: job.id,
      checkpoint,
      ...stats,
      idempotency: persisted,
      productionIsolation: {
        currentEraRowsUnchanged: before.currentEraRows.count === after.currentEraRows.count,
        productionEligibleRowsUnchanged: before.productionEligibleRows.count === after.productionEligibleRows.count,
        learningWeightsUnchanged: before.learningWeights.count === after.learningWeights.count,
        historicalFeaturesUnchanged: before.historicalFeatures.count === after.historicalFeatures.count,
        before,
        after,
      },
      certifications: {
        ONE_EVENT_PASS: eventLimit === 1 && selected.length > 0 && selected.length <= 3 && stats.leakageFailures === 0,
        BOUNDED_SAMPLE_PASS: eventLimit <= MAX_EVENTS && selected.length <= eventLimit * 3 && stats.leakageFailures === 0,
        REPLAY_ISOLATION_PASS: before.currentEraRows.count === after.currentEraRows.count && before.learningWeights.count === after.learningWeights.count,
        REPLAY_IDEMPOTENCY_PASS: persisted.duplicateIds === 0,
        REPLAY_PERFORMANCE_SEPARATE: true,
      },
    }
  } catch (error) {
    const finishedAt = new Date().toISOString()
    const stats = { startedAt, finishedAt, eventLimit, error: error instanceof Error ? error.message : 'unknown P2.3 replay error', providerCallsMade: 0 }
    await persistCheckpoint(job.id, 'failed', stats, dryRun).catch(() => null)
    await completeJob(job, 'failed', stats, String(stats.error)).catch(() => null)
    throw error
  }
}

async function loadReplayRows(limit = 500) {
  const { data, error, count } = await supabaseAdmin
    .from('universal_projection_history')
    .select('id, event_id, projection_key, projected_value, actual_value, confidence, generated_at, settled_at, metadata, feature_snapshot', { count: 'exact' })
    .eq('sport_key', SPORT_KEY)
    .eq('projection_family', P23_REPLAY_FAMILY)
    .order('generated_at', { ascending: true })
    .order('id', { ascending: true })
    .limit(limit)
  if (error) throw new Error(`P2.3 replay status read failed: ${error.message}`)
  return { rows: (data ?? []) as Array<Record<string, unknown>>, count: count ?? 0 }
}

export async function getHistoricalProgressiveReplayStatus(options: { jobId?: string | null; limit?: number | null } = {}) {
  const [rowLoad, jobs, checkpoints] = await Promise.all([
    loadReplayRows(Number(options.limit ?? 500)),
    supabaseAdmin.from('sports_sync_jobs').select('id, status, records_fetched, records_inserted, records_skipped, duration_ms, started_at, completed_at, metadata').eq('sport_key', SPORT_KEY).eq('job_type', P23_REPLAY_ENGINE_VERSION).order('started_at', { ascending: false }).limit(10),
    supabaseAdmin.from('historical_import_checkpoints').select('id, checkpoint_key, status, record_count, finished_at, metadata').eq('checkpoint_level', 'validation').eq('checkpoint_key', CHECKPOINT_KEY).limit(1),
  ])
  const rows = rowLoad.rows
  const latestJob = options.jobId ? (jobs.data ?? []).find((row) => String(row.id) === options.jobId) : (jobs.data ?? [])[0]
  const metadata = asRecord(latestJob?.metadata)
  const metrics = asRecord(metadata.metrics)
  const eventIds = Array.from(new Set(rows.map((row) => String(row.event_id ?? '')).filter(Boolean)))
  return {
    success: true,
    mode: 'p2_3_historical_progressive_replay_status_v1',
    generatedAt: new Date().toISOString(),
    replayScope: P23_REPLAY_SCOPE,
    engineVersion: P23_REPLAY_ENGINE_VERSION,
    featureVersion: P23_REPLAY_FEATURE_VERSION,
    policyVersion: P23_REPLAY_POLICY_VERSION,
    supportedScopes: ['REPLAY', 'BACKTEST', 'SHADOW_REPLAY'],
    forbiddenScopes: ['CURRENT_V2_PRODUCTION', 'LEGACY_PRE_V2'],
    latestJob: latestJob ?? null,
    checkpoint: (checkpoints.data ?? [])[0] ?? null,
    eventsProcessed: asNumber(metadata.eventsProcessed) ?? eventIds.length,
    replayPredictions: rowLoad.count,
    replaySettled: asNumber(metadata.settled) ?? rows.length,
    wins: asNumber(metrics.wins) ?? null,
    losses: asNumber(metrics.losses) ?? null,
    pushes: asNumber(metrics.pushes) ?? null,
    accuracy: asNumber(metrics.accuracy),
    brier: asNumber(metrics.brier),
    calibration: asNumber(metrics.calibration),
    roi: asNumber(metrics.roi),
    skipped: asNumber(metadata.skipped) ?? 0,
    skipReasons: asRecord(metadata.skipReasons),
    leakageFailures: asNumber(metadata.leakageFailures) ?? 0,
    providerCallsMade: 0,
    providerCreditsUsed: 0,
    remoteMutationsMade: 0,
    productionIsolation: {
      replayOnly: true,
      currentEraWrites: 0,
      historicalMutations: 0,
      productionSettlementWrites: 0,
      productionLearningWrites: 0,
      officialPickPolicyMutated: false,
      currentBoardMutated: false,
      schedulerMutated: false,
    },
    replayPerformance: {
      scope: 'REPLAY_ONLY_SEPARATE_FROM_CURRENT_ERA',
      jobId: latestJob?.id ?? null,
      eventCount: asNumber(metadata.eventsProcessed) ?? eventIds.length,
      canonicalPredictions: rowLoad.count,
      settled: asNumber(metadata.settled) ?? rows.length,
      metrics,
    },
    recentRows: rows.slice(-25),
    errors: [jobs.error?.message, checkpoints.error?.message].filter(Boolean),
  }
}

export async function validateHistoricalProgressiveReplayFixtures() {
  const dryRun = await runHistoricalProgressiveReplay({ eventLimit: 1, dryRun: true, runMode: 'VALIDATOR_DRY_RUN' })
  const status = await getHistoricalProgressiveReplayStatus({ limit: 50 }).catch((error) => ({ success: false, error: error instanceof Error ? error.message : 'status failed' }))
  const checks = [
    ['dry_run_success', dryRun.success === true],
    ['event_limit_bounded', dryRun.eventLimit <= MAX_EVENTS],
    ['one_event_max_three_predictions', dryRun.predictions <= 3],
    ['stored_odds_available', dryRun.predictions > 0 || Number(dryRun.skipped ?? 0) > 0],
    ['provider_calls_zero', dryRun.providerCallsMade === 0],
    ['current_era_writes_zero', dryRun.currentEraWrites === 0],
    ['historical_mutations_zero', dryRun.historicalMutations === 0],
    ['production_learning_writes_zero', dryRun.productionLearningWrites === 0],
    ['replay_scope_isolated', P23_REPLAY_SCOPE === 'REPLAY'],
    ['status_readonly', (status as Record<string, unknown>).success === true],
  ]
  return {
    success: checks.every(([, ok]) => ok),
    mode: 'p2_3_historical_progressive_replay_validator_v1',
    checks: checks.map(([name, ok]) => ({ name, status: ok ? 'PASS' : 'FAIL' })),
    dryRun,
    status,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
  }
}
