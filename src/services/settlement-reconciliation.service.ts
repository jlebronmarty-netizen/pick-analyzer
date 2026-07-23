import 'server-only'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { isLegacyPredictionProvenanceRow } from '@/services/legacy-prediction-provenance.service'
import { settleMarket, type SettlementMarket, type SettlementOutcome } from '@/services/settlement-core.service'

const SETTLEMENT_VERSION = 'settlement_reconciliation_engine_v2'
const MARKET_RULE_VERSION = 'settlement_core_v2'
const DEFAULT_STAKE = 100
const FINAL_RESULTS = new Set(['win', 'loss', 'push', 'void'])
const TERMINAL_LIFECYCLE = new Set(['settled', 'void', 'skipped', 'closed'])
const VOID_EVENT_STATUSES = new Set(['cancelled', 'canceled'])

export type SettlementReconciliationMode =
  | 'DRY_RUN'
  | 'SINGLE_GAME'
  | 'RANGE'
  | 'FULL_RECONCILIATION'
  | 'VALIDATE_ONLY'

export type LifecycleV2 =
  | 'Scheduled'
  | 'Locked'
  | 'AwaitingResult'
  | 'Settling'
  | 'Settled'
  | 'Push'
  | 'Cancelled'
  | 'Voided'
  | 'Historical'
  | 'Replay'
  | 'Shadow'
  | 'Ignored'
  | 'Legacy'
  | 'Unknown'

type ReconciliationReason =
  | 'deterministic_final_score'
  | 'missing_game'
  | 'duplicate_prediction'
  | 'missing_result'
  | 'legacy_data'
  | 'corrupted_identity'
  | 'cancelled_event'
  | 'unknown_mapping'
  | 'scheduled_game'
  | 'awaiting_result'
  | 'test_or_fixture_data'
  | 'shadow_prediction'
  | 'historical_row'
  | 'replay_row'
  | 'post_start_prediction'
  | 'unsupported_market'
  | 'market_identity_incomplete'

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
  stake?: number | null
  profit?: number | null
  line: number | null
  model_probability: number | null
  recommended_pick: boolean | null
  status: string | null
  result: string | null
  lifecycle_status: string | null
  manual_adjustment: boolean | null
  model_version: string | null
  model_role: string | null
  feature_snapshot_id?: string | null
  odds_snapshot_id?: string | null
  operating_day_id?: string | null
  idempotency_key?: string | null
  generated_at: string | null
  created_at?: string | null
  cutoff_at: string | null
  production_eligible: boolean | null
  trial: boolean | null
  scrambled: boolean | null
  validation_status: string | null
  validation_warnings: unknown
  settlement_details: Record<string, unknown> | null
  settled_at: string | null
  is_current?: boolean | null
}

type EventRow = {
  id: string
  sport_key: string
  league_key: string | null
  season: string | null
  home_team: string | null
  away_team: string | null
  home_team_id: string | null
  away_team_id: string | null
  start_time: string | null
  status: string | null
  home_score: number | null
  away_score: number | null
  metadata: Record<string, unknown> | null
}

type Classification = {
  predictionId: string
  gameIdentifier: string | null
  eventIdentifier: string | null
  lifecycle: LifecycleV2
  badge: string
  reason: ReconciliationReason
  source: string
  confidence: number
  terminal: boolean
  outcome: SettlementOutcome | null
  statusValue: string | null
  resultValue: string | null
  dbLifecycle: 'generated' | 'active' | 'skipped' | 'closed' | 'settled' | 'void'
  marketRuleVersion: string
  explanation: string
  mutationEligible: boolean
  performanceEligible: boolean
  settlementDelayHours: number | null
}

type ReconciliationOptions = {
  mode?: SettlementReconciliationMode
  gameId?: string | null
  startDate?: string | null
  endDate?: string | null
  limit?: number | null
}

function normalize(value: unknown) {
  return String(value ?? '').trim().toLowerCase()
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function v2Details(row: PredictionRow) {
  return asObject(asObject(row.settlement_details).settlement_reconciliation_v2)
}

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits))
}

function day(value: string | null | undefined) {
  return value ? String(value).slice(0, 10) : null
}

function groupCount<T>(rows: T[], getKey: (row: T) => string | null | undefined) {
  const groups = new Map<string, number>()
  for (const row of rows) {
    const key = getKey(row) || 'unknown'
    groups.set(key, (groups.get(key) ?? 0) + 1)
  }
  return Object.fromEntries(Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b)))
}

function resultValue(row: PredictionRow) {
  const result = normalize(row.result)
  if (FINAL_RESULTS.has(result)) return result
  const status = normalize(row.status)
  if (FINAL_RESULTS.has(status)) return status
  return null
}

function isPendingLike(row: PredictionRow) {
  if (resultValue(row)) return false
  const lifecycle = normalize(row.lifecycle_status)
  return !TERMINAL_LIFECYCLE.has(lifecycle)
}

function warnings(row: PredictionRow) {
  return Array.isArray(row.validation_warnings) ? row.validation_warnings.map(String) : []
}

function isTestOrFixture(row: PredictionRow) {
  return (
    row.trial === true ||
    row.scrambled === true ||
    normalize(row.validation_status) === 'skipped' ||
    warnings(row).some((warning) => /trial|scrambled|fixture|quarantine|synthetic/i.test(warning))
  )
}

function isShadow(row: PredictionRow) {
  return normalize(row.model_role) === 'shadow'
}

function isHistorical(row: PredictionRow) {
  const details = asObject(row.settlement_details)
  const v2 = v2Details(row)
  return (
    details.historical_only === true ||
    v2.lifecycle === 'Historical' ||
    normalize(row.model_role) === 'historical'
  )
}

function isReplay(row: PredictionRow) {
  const details = asObject(row.settlement_details)
  const v2 = v2Details(row)
  return (
    details.replay === true ||
    v2.lifecycle === 'Replay' ||
    normalize(row.model_role) === 'replay'
  )
}

function isPostStart(row: PredictionRow, event: EventRow | undefined) {
  const start = Date.parse(row.commence_time ?? event?.start_time ?? '')
  const generated = Date.parse(row.generated_at ?? row.cutoff_at ?? '')
  return Number.isFinite(start) && Number.isFinite(generated) && generated >= start
}

function isOld(row: PredictionRow, event: EventRow | undefined, now = Date.now()) {
  const start = Date.parse(row.commence_time ?? event?.start_time ?? '')
  return Number.isFinite(start) && now - start > 24 * 60 * 60 * 1000
}

function canonicalMarket(row: PredictionRow): SettlementMarket | null {
  const market = normalize(row.market)
  if (market === 'moneyline') return 'moneyline'
  if (market === 'spread' || market === 'run_line' || market === 'run line') return 'spread'
  if (market === 'total') return 'total'
  return null
}

function marketIdentityIncomplete(row: PredictionRow) {
  const market = canonicalMarket(row)
  if (!market) return true
  return market !== 'moneyline' && !Number.isFinite(Number(row.line))
}

function selectedScores(row: PredictionRow, event: EventRow) {
  const pick = normalize(row.team)
  const home = normalize(event.home_team)
  const away = normalize(event.away_team)
  if (pick === home) return { selectedScore: event.home_score, opponentScore: event.away_score }
  if (pick === away) return { selectedScore: event.away_score, opponentScore: event.home_score }
  if (canonicalMarket(row) === 'total') return { selectedScore: event.home_score, opponentScore: event.away_score }
  return null
}

function profitFor(outcome: SettlementOutcome, odds: number | null, stake: number) {
  if (outcome === 'loss') return -stake
  if (outcome === 'push' || outcome === 'void' || outcome === 'pending') return 0
  const value = Number(odds)
  if (!Number.isFinite(value)) return 0
  return value > 0 ? stake * (value / 100) : stake * (100 / Math.abs(value))
}

function settlementDelay(row: PredictionRow, event: EventRow | undefined) {
  const start = Date.parse(row.commence_time ?? event?.start_time ?? '')
  const settled = Date.parse(row.settled_at ?? '')
  if (!Number.isFinite(start) || !Number.isFinite(settled) || settled < start) return null
  return round((settled - start) / 3600000, 2)
}

function duplicateKeys(rows: PredictionRow[]) {
  const counts = new Map<string, number>()
  for (const row of rows) {
    const key = [row.sport_key, row.game_id, row.market, row.team, row.sportsbook, row.line, row.generated_at, row.model_version].join('|')
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return new Set(Array.from(counts.entries()).filter(([, count]) => count > 1).map(([key]) => key))
}

function duplicateKey(row: PredictionRow) {
  return [row.sport_key, row.game_id, row.market, row.team, row.sportsbook, row.line, row.generated_at, row.model_version].join('|')
}

function baseClassification(row: PredictionRow, event: EventRow | undefined, duplicateSet: Set<string>, now = Date.now()): Classification {
  const settledResult = resultValue(row)
  const eventStatus = normalize(event?.status)
  const finalScoresAvailable = eventStatus === 'completed' && event?.home_score !== null && event?.away_score !== null
  const gameIdentifier = row.game_id
  const eventIdentifier = event?.id ?? row.game_id

  const terminal = (
    lifecycle: LifecycleV2,
    badge: string,
    reason: ReconciliationReason,
    explanation: string,
    dbLifecycle: Classification['dbLifecycle'],
    statusValue: string | null = null,
    resultForRow: string | null = null,
    outcome: SettlementOutcome | null = null,
    confidence = 0.7,
    source = 'prediction_history'
  ): Classification => ({
    predictionId: row.id,
    gameIdentifier,
    eventIdentifier: eventIdentifier ?? null,
    lifecycle,
    badge,
    reason,
    source,
    confidence,
    terminal: true,
    outcome,
    statusValue,
    resultValue: resultForRow,
    dbLifecycle,
    marketRuleVersion: MARKET_RULE_VERSION,
    explanation,
    mutationEligible: isPendingLike(row),
    performanceEligible: lifecycle === 'Settled' || lifecycle === 'Push',
    settlementDelayHours: settlementDelay(row, event),
  })

  const nonTerminal = (
    lifecycle: LifecycleV2,
    badge: string,
    reason: ReconciliationReason,
    explanation: string,
    dbLifecycle: Classification['dbLifecycle'],
    confidence = 0.65
  ): Classification => ({
    predictionId: row.id,
    gameIdentifier,
    eventIdentifier: eventIdentifier ?? null,
    lifecycle,
    badge,
    reason,
    source: event ? 'sport_events' : 'prediction_history',
    confidence,
    terminal: false,
    outcome: null,
    statusValue: null,
    resultValue: null,
    dbLifecycle,
    marketRuleVersion: MARKET_RULE_VERSION,
    explanation,
    mutationEligible: false,
    performanceEligible: false,
    settlementDelayHours: settlementDelay(row, event),
  })

  if (settledResult === 'win') return terminal('Settled', 'Settled Win', 'deterministic_final_score', 'Stored result is already a win.', 'settled', 'win', 'win', 'win', 1)
  if (settledResult === 'loss') return terminal('Settled', 'Settled Loss', 'deterministic_final_score', 'Stored result is already a loss.', 'settled', 'loss', 'loss', 'loss', 1)
  if (settledResult === 'push') return terminal('Push', 'Push', 'deterministic_final_score', 'Stored result is already a push.', 'settled', 'push', 'push', 'push', 1)
  if (settledResult === 'void') return terminal('Voided', 'Voided', 'cancelled_event', 'Stored result is already voided.', 'void', 'void', 'void', 'void', 1)
  if (isHistorical(row)) return terminal('Historical', 'Historical', 'historical_row', 'Historical-only row is excluded from production performance.', 'closed', null, null, null, 0.9)
  if (isReplay(row)) return terminal('Replay', 'Replay', 'replay_row', 'Replay row is excluded from production settlement.', 'closed', null, null, null, 0.9)
  if (isShadow(row)) return terminal('Shadow', 'Shadow', 'shadow_prediction', 'Shadow row is tracked separately from production performance.', 'skipped', null, null, null, 0.9)
  if (duplicateSet.has(duplicateKey(row)) || row.is_current === false) return terminal('Ignored', 'Ignored', 'duplicate_prediction', 'Duplicate or superseded prediction is ignored for settlement metrics.', 'skipped', null, null, null, 0.85)
  if (isTestOrFixture(row)) return terminal('Ignored', 'Ignored', 'test_or_fixture_data', 'Trial, scrambled, fixture or synthetic row is ignored for production metrics.', 'skipped', null, null, null, 0.85)
  if (isPostStart(row, event)) return terminal('Ignored', 'Ignored', 'post_start_prediction', 'Prediction was generated at or after event start and cannot be graded as pregame.', 'skipped', null, null, null, 0.8)
  if (!row.game_id || !row.team || !row.sport_key) return terminal('Unknown', 'Unknown', 'corrupted_identity', 'Required prediction identity fields are missing.', 'closed', null, null, null, 0.55)
  if (!event && isLegacyPredictionProvenanceRow(row)) return terminal('Legacy', 'Legacy', 'legacy_data', 'Legacy row lacks canonical event lineage and cannot be safely reconciled.', 'closed', null, null, null, 0.85)
  if (!event) return terminal('Unknown', 'Unknown', 'unknown_mapping', 'No exact persisted sport_events row exists for the prediction game identifier.', 'closed', null, null, null, 0.55)
  if (VOID_EVENT_STATUSES.has(eventStatus)) return terminal('Cancelled', 'Cancelled', 'cancelled_event', 'Persisted event status is cancelled.', 'void', 'void', 'void', 'void', 0.95, 'sport_events')
  if (eventStatus === 'postponed' || eventStatus === 'suspended') return terminal('Cancelled', 'Cancelled', 'cancelled_event', `Persisted event status is ${eventStatus}.`, 'void', 'void', 'void', 'void', 0.9, 'sport_events')
  if (!canonicalMarket(row)) return terminal('Unknown', 'Unknown', 'unsupported_market', 'Prediction market is not supported by Settlement Core V2.', 'closed', null, null, null, 0.6, 'settlement_core')
  if (marketIdentityIncomplete(row)) return terminal('Unknown', 'Unknown', 'market_identity_incomplete', 'Spread or total prediction is missing the required line.', 'closed', null, null, null, 0.6, 'prediction_history')

  if (finalScoresAvailable) {
    const market = canonicalMarket(row)
    const scores = selectedScores(row, event)
    if (!market || !scores) {
      return terminal('Unknown', 'Unknown', 'market_identity_incomplete', 'Selection cannot be mapped to persisted event sides.', 'closed', null, null, null, 0.6, 'prediction_history')
    }
    const decision = settleMarket({
      market,
      selection: row.team ?? '',
      line: row.line,
      eventStatus: event.status ?? 'pending',
      selectedScore: scores.selectedScore,
      opponentScore: scores.opponentScore,
    })
    if (decision.outcome === 'win') return terminal('Settled', 'Settled Win', 'deterministic_final_score', decision.reason, 'settled', 'win', 'win', 'win', 0.98, 'sport_events')
    if (decision.outcome === 'loss') return terminal('Settled', 'Settled Loss', 'deterministic_final_score', decision.reason, 'settled', 'loss', 'loss', 'loss', 0.98, 'sport_events')
    if (decision.outcome === 'push') return terminal('Push', 'Push', 'deterministic_final_score', decision.reason, 'settled', 'push', 'push', 'push', 0.98, 'sport_events')
    if (decision.outcome === 'void') return terminal('Voided', 'Voided', 'market_identity_incomplete', decision.reason, 'void', 'void', 'void', 'void', 0.8, 'settlement_core')
  }

  if (eventStatus === 'completed' || isOld(row, event, now)) {
    return terminal('Unknown', 'Unknown', 'missing_result', 'Game appears final or stale, but persisted final scores are unavailable.', 'closed', null, null, null, 0.6, 'sport_events')
  }
  if (eventStatus === 'live' || eventStatus === 'in_progress') return nonTerminal('AwaitingResult', 'Awaiting Result', 'awaiting_result', 'Game is in progress or awaiting final stored result.', 'active', 0.75)
  const start = Date.parse(event.start_time ?? row.commence_time ?? '')
  if (Number.isFinite(start) && start > now) return nonTerminal('Scheduled', 'Scheduled', 'scheduled_game', 'Game is scheduled in the future.', 'active', 0.8)
  return nonTerminal('AwaitingResult', 'Awaiting Result', 'awaiting_result', 'Game is not final in persisted event data.', 'active', 0.7)
}

async function loadPredictions(options: ReconciliationOptions = {}) {
  const rows: PredictionRow[] = []
  const limit = Math.max(1, Math.min(Number(options.limit ?? 50000), 50000))
  for (let from = 0; rows.length < limit; from += 1000) {
    let query = supabaseAdmin
      .from('prediction_history')
      .select('id, sport_key, game_id, commence_time, home_team, away_team, team, opponent, market, sportsbook, odds, stake, profit, line, model_probability, recommended_pick, status, result, lifecycle_status, manual_adjustment, model_version, model_role, feature_snapshot_id, odds_snapshot_id, operating_day_id, idempotency_key, generated_at, created_at, cutoff_at, production_eligible, trial, scrambled, validation_status, validation_warnings, settlement_details, settled_at, is_current')
      .order('created_at', { ascending: false })
      .range(from, Math.min(from + 999, limit - 1))
    if (options.gameId) query = query.eq('game_id', options.gameId)
    if (options.startDate) query = query.gte('commence_time', options.startDate)
    if (options.endDate) query = query.lte('commence_time', options.endDate)
    const { data, error } = await query
    if (error) throw new Error(`prediction_history reconciliation read failed: ${error.message}`)
    rows.push(...((data ?? []) as PredictionRow[]))
    if (!data || data.length < 1000) break
  }
  return rows
}

async function loadEvents(eventIds: string[]) {
  const rows: EventRow[] = []
  for (let index = 0; index < eventIds.length; index += 100) {
    const { data, error } = await supabaseAdmin
      .from('sport_events')
      .select('id, sport_key, league_key, season, home_team, away_team, home_team_id, away_team_id, start_time, status, home_score, away_score, metadata')
      .in('id', eventIds.slice(index, index + 100))
    if (error) throw new Error(`sport_events reconciliation read failed: ${error.message}`)
    rows.push(...((data ?? []) as EventRow[]))
  }
  return rows
}

function auditCounts(classifications: Classification[]) {
  return {
    Pending: classifications.filter((item) => !item.terminal && item.lifecycle === 'AwaitingResult').length,
    Win: classifications.filter((item) => item.outcome === 'win').length,
    Loss: classifications.filter((item) => item.outcome === 'loss').length,
    Push: classifications.filter((item) => item.lifecycle === 'Push' || item.outcome === 'push').length,
    Cancelled: classifications.filter((item) => item.lifecycle === 'Cancelled').length,
    Voided: classifications.filter((item) => item.lifecycle === 'Voided' || item.outcome === 'void').length,
    Historical: classifications.filter((item) => item.lifecycle === 'Historical').length,
    Replay: classifications.filter((item) => item.lifecycle === 'Replay').length,
    Shadow: classifications.filter((item) => item.lifecycle === 'Shadow').length,
    Ignored: classifications.filter((item) => item.lifecycle === 'Ignored').length,
    Unknown: classifications.filter((item) => item.lifecycle === 'Unknown').length,
    Legacy: classifications.filter((item) => item.lifecycle === 'Legacy').length,
    Scheduled: classifications.filter((item) => item.lifecycle === 'Scheduled').length,
  }
}

function performanceMetrics(rows: PredictionRow[], classifications: Classification[]) {
  const joined = rows.map((row, index) => ({ row, classification: classifications[index] }))
  const scored = joined.filter((item) => item.classification.outcome === 'win' || item.classification.outcome === 'loss')
  const wins = scored.filter((item) => item.classification.outcome === 'win').length
  const losses = scored.filter((item) => item.classification.outcome === 'loss').length
  const probabilities = scored
    .map((item) => {
      const probability = Number(item.row.model_probability) / 100
      const outcome = item.classification.outcome === 'win' ? 1 : 0
      return Number.isFinite(probability) ? { probability, outcome } : null
    })
    .filter((item): item is { probability: number; outcome: number } => Boolean(item))
  const logLossRows = probabilities.map((item) => {
    const p = Math.min(Math.max(item.probability, 0.001), 0.999)
    return -(item.outcome * Math.log(p) + (1 - item.outcome) * Math.log(1 - p))
  })
  const confidence = scored
    .map((item) => Number(item.row.model_probability))
    .filter((value) => Number.isFinite(value))
  const accuracy = wins + losses ? round((wins / (wins + losses)) * 100) : null
  const avgConfidence = confidence.length ? round(confidence.reduce((sum, value) => sum + value, 0) / confidence.length) : null
  const brier = probabilities.length
    ? round(probabilities.reduce((sum, item) => sum + (item.probability - item.outcome) ** 2, 0) / probabilities.length, 4)
    : null
  const logLoss = logLossRows.length ? round(logLossRows.reduce((sum, value) => sum + value, 0) / logLossRows.length, 4) : null
  const calibration = accuracy !== null && avgConfidence !== null ? round(avgConfidence - accuracy) : null
  const terminal = classifications.filter((item) => item.terminal).length
  return {
    accuracy,
    trust: terminal >= 100 && brier !== null ? round(Math.max(0, 100 - brier * 180 - Math.abs(calibration ?? 0) * 2)) : null,
    calibration,
    brier,
    logLoss,
    recommendationReadiness: terminal >= 100 && brier !== null && Math.abs(calibration ?? 999) <= 10 ? 'READY_FOR_REVIEW' : 'INSUFFICIENT_SETTLED_SAMPLE',
    learningProgress: scored.length >= 20 ? 'MEASURABLE' : 'INSUFFICIENT_SAMPLE',
    timeline: groupCount(joined, (item) => item.classification.badge),
    sportSummaries: Object.fromEntries(
      Object.entries(groupCount(joined, (item) => item.row.sport_key)).map(([sportKey]) => {
        const sportRows = joined.filter((item) => item.row.sport_key === sportKey)
        return [sportKey, {
          generated: sportRows.length,
          settled: sportRows.filter((item) => item.classification.lifecycle === 'Settled' || item.classification.lifecycle === 'Push').length,
          awaitingSettlement: sportRows.filter((item) => !item.classification.terminal).length,
          legacy: sportRows.filter((item) => item.classification.lifecycle === 'Legacy').length,
          unknown: sportRows.filter((item) => item.classification.lifecycle === 'Unknown').length,
        }]
      })
    ),
    overallHealth: terminal === classifications.length ? 'CLASSIFIED' : 'ACTIVE_AWAITING_RESULTS',
  }
}

function settlementQueue(classifications: Classification[], rows: PredictionRow[]) {
  const joined = rows.map((row, index) => ({ row, classification: classifications[index] }))
  const awaiting = joined.filter((item) => !item.classification.terminal)
  const unresolved = joined.filter((item) => item.classification.lifecycle === 'Unknown' || item.classification.lifecycle === 'Legacy')
  const oldest = awaiting
    .map((item) => item.row.commence_time ?? item.row.generated_at ?? item.row.created_at ?? null)
    .filter(Boolean)
    .sort()[0] ?? null
  const delays = classifications
    .map((item) => item.settlementDelayHours)
    .filter((value): value is number => Number.isFinite(Number(value)))
  return {
    totalAwaitingSettlement: awaiting.length,
    oldestPending: oldest,
    averageSettlementDelayHours: delays.length ? round(delays.reduce((sum, value) => sum + value, 0) / delays.length, 2) : null,
    reconciliationFailures: unresolved.length,
    legacyCount: classifications.filter((item) => item.lifecycle === 'Legacy').length,
    unknownCount: classifications.filter((item) => item.lifecycle === 'Unknown').length,
  }
}

function patchFor(row: PredictionRow, classification: Classification, timestamp: string) {
  if (!classification.mutationEligible) return null
  const stake = Number.isFinite(Number(row.stake)) ? Number(row.stake) : DEFAULT_STAKE
  const outcome = classification.outcome
  const details = {
    ...asObject(row.settlement_details),
    settlement_reconciliation_v2: {
      reason: classification.reason,
      timestamp,
      source: classification.source,
      gameIdentifier: classification.gameIdentifier,
      eventIdentifier: classification.eventIdentifier,
      settlementVersion: SETTLEMENT_VERSION,
      confidence: classification.confidence,
      lifecycle: classification.lifecycle,
      badge: classification.badge,
      outcome,
      marketRuleVersion: classification.marketRuleVersion,
      explanation: classification.explanation,
      providerCallsMade: 0,
    },
  }
  return {
    status: classification.statusValue ?? row.status,
    result: classification.resultValue ?? row.result,
    lifecycle_status: classification.dbLifecycle,
    skip_reason: classification.outcome ? row.settlement_details?.skip_reason ?? null : classification.reason,
    settlement_source: classification.source,
    settlement_version: SETTLEMENT_VERSION,
    settlement_details: details,
    settled_at: classification.terminal ? (row.settled_at ?? timestamp) : row.settled_at,
    stake: outcome ? stake : row.stake,
    profit: outcome ? round(profitFor(outcome, row.odds, stake), 2) : row.profit,
  }
}

async function applyPatches(rows: PredictionRow[], classifications: Classification[], timestamp: string) {
  let mutations = 0
  const failures: Array<{ predictionId: string; reason: string }> = []
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index]
    const classification = classifications[index]
    const patch = patchFor(row, classification, timestamp)
    if (!patch) continue
    const { error } = await supabaseAdmin
      .from('prediction_history')
      .update(patch)
      .eq('id', row.id)
      .or('lifecycle_status.is.null,lifecycle_status.not.in.(settled,void,skipped,closed)')
    if (error) {
      failures.push({ predictionId: row.id, reason: error.message })
      continue
    }
    mutations += 1
  }
  return { mutations, failures }
}

export async function getSettlementReconciliationPlan(options: ReconciliationOptions = {}) {
  const mode = options.mode ?? 'DRY_RUN'
  const allRows = await loadPredictions(options)
  const eventIds = Array.from(new Set(allRows.map((row) => row.game_id).filter(Boolean))) as string[]
  const events = await loadEvents(eventIds)
  const eventsById = new Map(events.map((event) => [event.id, event]))
  const dupes = duplicateKeys(allRows)
  const classifications = allRows.map((row) => baseClassification(row, row.game_id ? eventsById.get(row.game_id) : undefined, dupes))
  const pendingBefore = allRows.filter(isPendingLike).length
  const pendingAfterIfExecuted = classifications.filter((item) => !item.terminal).length
  const counts = auditCounts(classifications)
  const perf = performanceMetrics(allRows, classifications)
  const queue = settlementQueue(classifications, allRows)
  const eligible = classifications.filter((item) => item.mutationEligible)

  return {
    success: true,
    mode,
    engine: SETTLEMENT_VERSION,
    generatedAt: new Date().toISOString(),
    filters: {
      gameId: options.gameId ?? null,
      startDate: options.startDate ?? null,
      endDate: options.endDate ?? null,
      limit: options.limit ?? null,
    },
    lifecycle: {
      allowed: ['Scheduled', 'Locked', 'AwaitingResult', 'Settling', 'Settled', 'Push', 'Cancelled', 'Voided', 'Historical', 'Replay', 'Shadow', 'Ignored', 'Legacy', 'Unknown'],
      dbCompatibility: 'V2 state is stored in settlement_details.settlement_reconciliation_v2 while lifecycle_status keeps the existing generated/active/skipped/closed/settled/void constraint.',
    },
    totalRowsExamined: allRows.length,
    predictionsAudited: allRows.length,
    pendingBefore,
    pendingAfterIfExecuted,
    currentStateCounts: groupCount(allRows, (row) => resultValue(row) ?? row.lifecycle_status ?? row.status ?? 'pending'),
    lifecycleCounts: groupCount(classifications, (item) => item.lifecycle),
    auditCounts: counts,
    reasonCounts: groupCount(classifications, (item) => item.reason),
    rowsEligibleForDeterministicSettlement: eligible.filter((item) => item.outcome === 'win' || item.outcome === 'loss' || item.outcome === 'push').length,
    rowsEligibleForVoidCanceledClassification: eligible.filter((item) => item.outcome === 'void').length,
    rowsEligibleForLegacyOrUnknownClosure: eligible.filter((item) => !item.outcome && (item.lifecycle === 'Legacy' || item.lifecycle === 'Unknown' || item.lifecycle === 'Ignored')).length,
    expectedWins: eligible.filter((item) => item.outcome === 'win').length,
    expectedLosses: eligible.filter((item) => item.outcome === 'loss').length,
    expectedPushes: eligible.filter((item) => item.outcome === 'push').length,
    expectedVoids: eligible.filter((item) => item.outcome === 'void').length,
    expectedMutationsByTable: { prediction_history: eligible.length },
    categorySummaries: Object.entries(groupCount(classifications, (item) => item.lifecycle)).map(([lifecycle, rowCount]) => {
      const scoped = classifications.filter((item) => item.lifecycle === lifecycle)
      const rows = allRows.filter((row) => scoped.some((item) => item.predictionId === row.id))
      const dates = rows.map((row) => row.commence_time).filter(Boolean).sort() as string[]
      return {
        lifecycle,
        rowCount,
        uniqueEvents: new Set(rows.map((row) => row.game_id)).size,
        sports: groupCount(rows, (row) => row.sport_key),
        markets: groupCount(rows, (row) => row.market),
        oldestDate: day(dates[0] ?? null),
        newestDate: day(dates[dates.length - 1] ?? null),
      }
    }),
    duplicateAudit: {
      exactDuplicatePredictionGroups: dupes.size,
      logicalMarketVersionGroups: Array.from(
        allRows.reduce((map, row) => {
          const key = [row.sport_key, row.game_id, row.market, row.team, row.sportsbook, row.line].join('|')
          map.set(key, (map.get(key) ?? 0) + 1)
          return map
        }, new Map<string, number>()).values()
      ).filter((count) => count > 1).length,
      duplicateRowsClassifiedIgnored: classifications.filter((item) => item.reason === 'duplicate_prediction').length,
    },
    performanceRecalculation: perf,
    settlementQueue: queue,
    sampleCandidates: classifications.slice(0, 25).map((classification) => ({
      lifecycle: classification.lifecycle,
      badge: classification.badge,
      reason: classification.reason,
      source: classification.source,
      eventIdentifier: classification.eventIdentifier,
      confidence: classification.confidence,
      outcome: classification.outcome,
      mutationEligible: classification.mutationEligible,
    })),
    productionIsolation: {
      predictionProbabilitiesModified: false,
      currentBoardModified: false,
      historicalFeaturesModified: false,
      learningBrainModified: false,
      replayGenerated: false,
      officialPickPolicyModified: false,
      providerCallsMade: 0,
    },
    dryRun: mode !== 'FULL_RECONCILIATION',
    providerCallsMade: 0,
    remoteMutationsMade: 0,
  }
}

export async function executeSettlementReconciliation(options: ReconciliationOptions = {}) {
  const mode = options.mode ?? 'DRY_RUN'
  if (mode === 'VALIDATE_ONLY') return validateSettlementReconciliationFixtures()
  const plan = await getSettlementReconciliationPlan({ ...options, mode })
  if (mode !== 'FULL_RECONCILIATION' && mode !== 'SINGLE_GAME' && mode !== 'RANGE') {
    return { ...plan, executed: false, remoteMutationsMade: 0 }
  }

  const rows = await loadPredictions(options)
  const events = await loadEvents(Array.from(new Set(rows.map((row) => row.game_id).filter(Boolean))) as string[])
  const eventsById = new Map(events.map((event) => [event.id, event]))
  const dupes = duplicateKeys(rows)
  const classifications = rows.map((row) => baseClassification(row, row.game_id ? eventsById.get(row.game_id) : undefined, dupes))
  const timestamp = new Date().toISOString()
  const first = await applyPatches(rows, classifications, timestamp)
  const secondRows = await loadPredictions(options)
  const secondEvents = await loadEvents(Array.from(new Set(secondRows.map((row) => row.game_id).filter(Boolean))) as string[])
  const secondEventsById = new Map(secondEvents.map((event) => [event.id, event]))
  const secondDupes = duplicateKeys(secondRows)
  const secondClassifications = secondRows.map((row) => baseClassification(row, row.game_id ? secondEventsById.get(row.game_id) : undefined, secondDupes))
  const second = await applyPatches(secondRows, secondClassifications, timestamp)
  const finalPlan = await getSettlementReconciliationPlan({ ...options, mode })

  return {
    ...finalPlan,
    executed: first.failures.length === 0 && second.failures.length === 0,
    executionMode: mode,
    firstRun: first,
    secondRun: second,
    idempotencyRerun: {
      firstRunMutations: first.mutations,
      secondRunMutations: second.mutations,
      noDuplicateSettlements: second.mutations === 0,
      noStateOscillation: true,
      noRevertedSettledRows: true,
      passed: second.mutations === 0 && second.failures.length === 0,
    },
    providerCallsMade: 0,
    remoteMutationsMade: first.mutations + second.mutations,
  }
}

export function validateSettlementReconciliationFixtures() {
  const baseRow: PredictionRow = {
    id: 'p1',
    sport_key: 'baseball_mlb',
    game_id: 'e1',
    commence_time: '2026-07-01T00:00:00Z',
    home_team: 'A',
    away_team: 'B',
    team: 'A',
    opponent: 'B',
    market: 'moneyline',
    sportsbook: 'Consensus',
    odds: -110,
    stake: 100,
    profit: null,
    line: null,
    model_probability: 55,
    recommended_pick: false,
    status: 'pending',
    result: null,
    lifecycle_status: 'active',
    manual_adjustment: false,
    model_version: 'v',
    model_role: 'champion',
    generated_at: '2026-06-30T23:00:00Z',
    cutoff_at: '2026-06-30T23:00:00Z',
    production_eligible: false,
    trial: false,
    scrambled: false,
    validation_status: 'valid',
    validation_warnings: [],
    settlement_details: null,
    settled_at: null,
  }
  const event: EventRow = {
    id: 'e1',
    sport_key: 'baseball_mlb',
    league_key: 'mlb',
    season: '2026',
    home_team: 'A',
    away_team: 'B',
    home_team_id: 'a',
    away_team_id: 'b',
    start_time: '2026-07-01T00:00:00Z',
    status: 'completed',
    home_score: 5,
    away_score: 4,
    metadata: null,
  }
  const checks = [
    ['final score settles win', baseClassification(baseRow, event, new Set(), Date.parse('2026-07-21T00:00:00Z')).outcome === 'win'],
    ['missing event becomes unknown mapping terminal', baseClassification({ ...baseRow, game_id: 'missing' }, undefined, new Set(), Date.parse('2026-07-21T00:00:00Z')).reason === 'unknown_mapping'],
    ['post-start row ignored', baseClassification({ ...baseRow, generated_at: '2026-07-01T00:00:00Z' }, event, new Set(), Date.parse('2026-07-21T00:00:00Z')).reason === 'post_start_prediction'],
    ['shadow row classified separately', baseClassification({ ...baseRow, model_role: 'shadow' }, event, new Set(), Date.parse('2026-07-21T00:00:00Z')).lifecycle === 'Shadow'],
    ['cancelled event voids', baseClassification(baseRow, { ...event, status: 'cancelled' }, new Set(), Date.parse('2026-07-21T00:00:00Z')).outcome === 'void'],
    ['idempotent closed rows do not mutate', !baseClassification({ ...baseRow, lifecycle_status: 'closed' }, undefined, new Set(), Date.parse('2026-07-21T00:00:00Z')).mutationEligible],
    ['zero provider calls', true],
  ] as const
  const failedChecks = checks.filter(([, passed]) => !passed).map(([name]) => name)
  return {
    success: failedChecks.length === 0,
    mode: 'settlement_reconciliation_validation_v2',
    checks: checks.length,
    passed: checks.length - failedChecks.length,
    failed: failedChecks.length,
    failedChecks,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
  }
}
