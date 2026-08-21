import 'server-only'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { settleMarket, type SettlementDecision, type SettlementMarket } from '@/services/settlement-core.service'

export const MLB_CURRENT_ERA_SHADOW_SETTLEMENT_VERSION = 'mlb_current_era_shadow_settlement_preparation_v1'
export const MLB_CURRENT_ERA_SHADOW_SETTLEMENT_ORIGIN = 'CURRENT_ERA_SHADOW'
export const MLB_CURRENT_ERA_SHADOW_SETTLEMENT_SPORT_KEY = 'baseball_mlb'
export const MLB_CURRENT_ERA_SHADOW_SETTLEMENT_LOCK_KEY = 'mlb_current_era_shadow_settlement'
export const MLB_CURRENT_ERA_SHADOW_SETTLEMENT_AUTH_ENV = 'MLB_CURRENT_ERA_SHADOW_SETTLEMENT_AUTHORIZED'
export const MLB_CURRENT_ERA_SHADOW_SETTLEMENT_SUPPORTED_MARKETS = ['moneyline', 'run_line', 'total'] as const

type SupportedMarket = (typeof MLB_CURRENT_ERA_SHADOW_SETTLEMENT_SUPPORTED_MARKETS)[number]

export type MlbCurrentEraShadowSettlementSkipReason =
  | 'EVENT_NOT_FOUND'
  | 'NOT_READY_EVENT_PREGAME'
  | 'NOT_READY_EVENT_LIVE'
  | 'BLOCKED_RESULT_MISSING'
  | 'MISSING_FINAL_SCORE'
  | 'UNSUPPORTED_MARKET'
  | 'MISSING_LINE'
  | 'ALREADY_SETTLED'
  | 'MANUAL_ADJUSTMENT'
  | 'QUARANTINED_EXCLUDED'
  | 'AMBIGUOUS_SELECTION'
  | 'BLOCKED_CANCELLED'
  | 'CONFLICTING_PRIOR_SETTLEMENT'
  | 'ACTIVATION_NOT_AUTHORIZED'

type PredictionRow = {
  id: string
  sport_key: string | null
  prediction_origin: string | null
  game_id: string | null
  commence_time: string | null
  home_team: string | null
  away_team: string | null
  team: string | null
  selection: string | null
  market: string | null
  sportsbook: string | null
  odds: number | null
  line: number | null
  stake: number | null
  result: string | null
  status: string | null
  lifecycle_status: string | null
  manual_adjustment: boolean | null
  settled_at: string | null
  result_id: string | null
  production_eligible: boolean | null
  recommended_pick: boolean | null
  official_pick_at_lock: boolean | null
  is_current: boolean | null
  model_role: string | null
  certification_status: string | null
  settlement_details: Record<string, unknown> | null
}

type EventRow = {
  id: string
  sport_key: string | null
  start_time: string | null
  status: string | null
  home_team: string | null
  away_team: string | null
  home_score: number | null
  away_score: number | null
}

type ResultRow = {
  id: string
  game_id: string | null
  sport_key: string | null
  commence_time: string | null
  home_team: string | null
  away_team: string | null
  home_score: number | null
  away_score: number | null
  winner: string | null
  created_at: string | null
}

export type MlbCurrentEraShadowSettlementCandidate = {
  predictionId: string
  eventId: string | null
  market: string | null
  selection: string | null
  line: number | null
  sportsbook: string | null
  eventStatus: string | null
  resultId: string | null
  finalScore: { home: number | null; away: number | null } | null
  decision: SettlementDecision | null
  wouldSettle: boolean
  skipReason: MlbCurrentEraShadowSettlementSkipReason | null
  settlementOpportunity:
    | 'NOT_READY_EVENT_PREGAME'
    | 'NOT_READY_EVENT_LIVE'
    | 'READY_FINAL_RESULT_AVAILABLE'
    | 'BLOCKED_RESULT_MISSING'
    | 'BLOCKED_CANCELLED'
    | 'OTHER'
  proposedPatch: Record<string, unknown> | null
}

export type MlbCurrentEraShadowSettlementAudit = {
  success: boolean
  mode: typeof MLB_CURRENT_ERA_SHADOW_SETTLEMENT_VERSION
  generatedAt: string
  dryRun: boolean
  activationAuthorized: boolean
  checked: number
  uniqueGames: number
  finalGamesFound: number
  eligible: number
  wouldSettle: number
  settled: number
  wins: number
  losses: number
  pushes: number
  skipped: number
  skipReasons: Record<string, number>
  providerCallsMade: 0
  databaseMutationsMade: number
  learningWrites: 0
  calibrationWrites: 0
  officialPickWrites: 0
  productVisibilityWrites: 0
  bankrollWrites: 0
  notificationWrites: 0
  historicalReplayWrites: 0
  nflWrites: 0
  nbaWrites: 0
  performanceScope: 'shadow_cohort_only'
  lock: {
    key: typeof MLB_CURRENT_ERA_SHADOW_SETTLEMENT_LOCK_KEY
    requiredForMutation: true
    acquired: false
    note: string
  }
  candidates: MlbCurrentEraShadowSettlementCandidate[]
}

function nowIso() {
  return new Date().toISOString()
}

function normalize(value: string | null | undefined) {
  return String(value ?? '').trim().toLowerCase()
}

function isTerminalResult(value: string | null | undefined) {
  return ['win', 'loss', 'push', 'void'].includes(normalize(value))
}

function isFinalStatus(value: string | null | undefined) {
  return ['completed', 'complete', 'final', 'closed'].includes(normalize(value))
}

function isLiveStatus(value: string | null | undefined) {
  return ['live', 'in_progress', 'inprogress', 'started'].includes(normalize(value))
}

function isCancelledStatus(value: string | null | undefined) {
  return ['cancelled', 'canceled', 'postponed', 'suspended', 'void'].includes(normalize(value))
}

function isSupportedMarket(value: string | null | undefined): value is SupportedMarket {
  return MLB_CURRENT_ERA_SHADOW_SETTLEMENT_SUPPORTED_MARKETS.includes(value as SupportedMarket)
}

function safeStake(value: number | null | undefined) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 100
}

function profitFor(outcome: SettlementDecision['outcome'], odds: number | null, stake: number) {
  const price = Number(odds)
  if (outcome === 'loss') return -stake
  if (outcome === 'push' || outcome === 'void' || outcome === 'pending') return 0
  if (!Number.isFinite(price)) return 0
  return price > 0 ? stake * (price / 100) : stake * (100 / Math.abs(price))
}

function scorePairForSelection(prediction: PredictionRow, event: EventRow, result: ResultRow) {
  const selected = normalize(prediction.team ?? prediction.selection)
  const home = normalize(event.home_team ?? result.home_team)
  const away = normalize(event.away_team ?? result.away_team)

  if (selected === home) return { selectedScore: result.home_score, opponentScore: result.away_score }
  if (selected === away) return { selectedScore: result.away_score, opponentScore: result.home_score }
  return null
}

function candidateKey(prediction: PredictionRow): MlbCurrentEraShadowSettlementCandidate {
  return {
    predictionId: prediction.id,
    eventId: prediction.game_id,
    market: prediction.market,
    selection: prediction.team ?? prediction.selection,
    line: prediction.line,
    sportsbook: prediction.sportsbook,
    eventStatus: null,
    resultId: null,
    finalScore: null,
    decision: null,
    wouldSettle: false,
    skipReason: null,
    settlementOpportunity: 'OTHER',
    proposedPatch: null,
  }
}

function patchFor({
  prediction,
  candidate,
  timestamp,
}: {
  prediction: PredictionRow
  candidate: MlbCurrentEraShadowSettlementCandidate
  timestamp: string
}) {
  const decision = candidate.decision
  if (!decision || !candidate.resultId || !candidate.wouldSettle) return null
  const stake = safeStake(prediction.stake)
  const profit = Number(profitFor(decision.outcome, prediction.odds, stake).toFixed(2))
  return {
    result: decision.outcome,
    status: decision.outcome,
    lifecycle_status: 'settled',
    stake,
    profit,
    settled_at: timestamp,
    result_id: candidate.resultId,
    settlement_source: 'game_results',
    settlement_version: MLB_CURRENT_ERA_SHADOW_SETTLEMENT_VERSION,
    settlement_details: {
      reason: decision.reason,
      market: candidate.market,
      selection: candidate.selection,
      line: candidate.line,
      odds: prediction.odds,
      resultId: candidate.resultId,
      gameId: candidate.eventId,
      predictionOrigin: MLB_CURRENT_ERA_SHADOW_SETTLEMENT_ORIGIN,
      modelRole: 'shadow',
      productionLearningEligible: false,
      productionCalibrationEligible: false,
      productionVisible: false,
      officialPickEligible: false,
      bankrollEligible: false,
      notificationEligible: false,
      rawVsCalibratedOutcomeMetricsEligible: true,
    },
  }
}

export function evaluateMlbCurrentEraShadowSettlementCandidate(input: {
  prediction: PredictionRow
  event?: EventRow | null
  result?: ResultRow | null
  now?: Date
}): MlbCurrentEraShadowSettlementCandidate {
  const { prediction, event, result } = input
  const candidate = candidateKey(prediction)
  candidate.eventStatus = event?.status ?? null
  candidate.resultId = result?.id ?? null
  candidate.finalScore = result ? { home: result.home_score, away: result.away_score } : null

  if (
    prediction.sport_key !== MLB_CURRENT_ERA_SHADOW_SETTLEMENT_SPORT_KEY ||
    prediction.prediction_origin !== MLB_CURRENT_ERA_SHADOW_SETTLEMENT_ORIGIN ||
    normalize(prediction.model_role) !== 'shadow'
  ) {
    candidate.skipReason = 'UNSUPPORTED_MARKET'
    return candidate
  }

  if (prediction.certification_status === 'QUARANTINED') {
    candidate.skipReason = 'QUARANTINED_EXCLUDED'
    return candidate
  }

  if (prediction.manual_adjustment) {
    candidate.skipReason = 'MANUAL_ADJUSTMENT'
    return candidate
  }

  if (prediction.settled_at || isTerminalResult(prediction.result) || isTerminalResult(prediction.status)) {
    if (result?.id && prediction.result_id && prediction.result_id !== result.id) {
      candidate.skipReason = 'CONFLICTING_PRIOR_SETTLEMENT'
      return candidate
    }
    candidate.skipReason = 'ALREADY_SETTLED'
    return candidate
  }

  const market = prediction.market
  if (!isSupportedMarket(market)) {
    candidate.skipReason = 'UNSUPPORTED_MARKET'
    return candidate
  }

  if ((market === 'run_line' || market === 'total') && !Number.isFinite(Number(prediction.line))) {
    candidate.skipReason = 'MISSING_LINE'
    return candidate
  }

  if (!event) {
    candidate.skipReason = 'EVENT_NOT_FOUND'
    return candidate
  }

  if (isCancelledStatus(event.status)) {
    candidate.skipReason = 'BLOCKED_CANCELLED'
    candidate.settlementOpportunity = 'BLOCKED_CANCELLED'
    return candidate
  }

  const startTime = event.start_time ?? prediction.commence_time
  if (startTime && new Date(startTime).getTime() > (input.now ?? new Date()).getTime()) {
    candidate.skipReason = 'NOT_READY_EVENT_PREGAME'
    candidate.settlementOpportunity = 'NOT_READY_EVENT_PREGAME'
    return candidate
  }

  if (!isFinalStatus(event.status)) {
    candidate.skipReason = isLiveStatus(event.status) ? 'NOT_READY_EVENT_LIVE' : 'BLOCKED_RESULT_MISSING'
    candidate.settlementOpportunity = isLiveStatus(event.status) ? 'NOT_READY_EVENT_LIVE' : 'BLOCKED_RESULT_MISSING'
    return candidate
  }

  if (!result || result.sport_key !== MLB_CURRENT_ERA_SHADOW_SETTLEMENT_SPORT_KEY || result.game_id !== event.id) {
    candidate.skipReason = 'BLOCKED_RESULT_MISSING'
    candidate.settlementOpportunity = 'BLOCKED_RESULT_MISSING'
    return candidate
  }

  if (result.home_score === null || result.away_score === null) {
    candidate.skipReason = 'MISSING_FINAL_SCORE'
    candidate.settlementOpportunity = 'BLOCKED_RESULT_MISSING'
    return candidate
  }

  if (market === 'total') {
    const decision = settleMarket({
      market: 'total',
      selection: prediction.team ?? prediction.selection ?? '',
      line: prediction.line,
      selectedScore: result.home_score,
      opponentScore: result.away_score,
      eventStatus: 'completed',
    })
    if (decision.outcome === 'void') {
      candidate.skipReason = 'AMBIGUOUS_SELECTION'
      return candidate
    }
    candidate.decision = decision
    candidate.wouldSettle = decision.outcome !== 'pending'
    candidate.settlementOpportunity = 'READY_FINAL_RESULT_AVAILABLE'
    candidate.proposedPatch = patchFor({ prediction, candidate, timestamp: input.now?.toISOString() ?? nowIso() })
    return candidate
  }

  const scores = scorePairForSelection(prediction, event, result)
  if (!scores) {
    candidate.skipReason = 'AMBIGUOUS_SELECTION'
    return candidate
  }

  const settlementMarket: SettlementMarket = market === 'run_line' ? 'spread' : 'moneyline'
  const decision = settleMarket({
    market: settlementMarket,
    selection: prediction.team ?? prediction.selection ?? '',
    line: market === 'moneyline' ? null : prediction.line,
    selectedScore: scores.selectedScore,
    opponentScore: scores.opponentScore,
    eventStatus: 'completed',
  })
  candidate.decision = decision
  candidate.wouldSettle = decision.outcome !== 'pending' && decision.outcome !== 'void'
  candidate.settlementOpportunity = 'READY_FINAL_RESULT_AVAILABLE'
  candidate.proposedPatch = patchFor({ prediction, candidate, timestamp: input.now?.toISOString() ?? nowIso() })
  return candidate
}

function increment(counts: Record<string, number>, key: string | null) {
  const normalized = key ?? 'UNKNOWN'
  counts[normalized] = (counts[normalized] ?? 0) + 1
}

export async function auditMlbCurrentEraShadowSettlementReadiness(options: {
  execute?: boolean
  activationAuthorized?: boolean
  eventId?: string
  now?: Date
} = {}): Promise<MlbCurrentEraShadowSettlementAudit> {
  const execute = options.execute === true
  const activationAuthorized =
    options.activationAuthorized === true && process.env[MLB_CURRENT_ERA_SHADOW_SETTLEMENT_AUTH_ENV] === 'true'
  const audit: MlbCurrentEraShadowSettlementAudit = {
    success: true,
    mode: MLB_CURRENT_ERA_SHADOW_SETTLEMENT_VERSION,
    generatedAt: nowIso(),
    dryRun: !execute,
    activationAuthorized,
    checked: 0,
    uniqueGames: 0,
    finalGamesFound: 0,
    eligible: 0,
    wouldSettle: 0,
    settled: 0,
    wins: 0,
    losses: 0,
    pushes: 0,
    skipped: 0,
    skipReasons: {},
    providerCallsMade: 0,
    databaseMutationsMade: 0,
    learningWrites: 0,
    calibrationWrites: 0,
    officialPickWrites: 0,
    productVisibilityWrites: 0,
    bankrollWrites: 0,
    notificationWrites: 0,
    historicalReplayWrites: 0,
    nflWrites: 0,
    nbaWrites: 0,
    performanceScope: 'shadow_cohort_only',
    lock: {
      key: MLB_CURRENT_ERA_SHADOW_SETTLEMENT_LOCK_KEY,
      requiredForMutation: true,
      acquired: false,
      note: execute
        ? 'Future activation must acquire the MLB Current Era Shadow settlement lock before mutation.'
        : 'Read-only preparation does not acquire a settlement lock.',
    },
    candidates: [],
  }

  let query = supabaseAdmin
    .from('prediction_history')
    .select('id,sport_key,prediction_origin,game_id,commence_time,home_team,away_team,team,selection,market,sportsbook,odds,line,stake,result,status,lifecycle_status,manual_adjustment,settled_at,result_id,production_eligible,recommended_pick,official_pick_at_lock,is_current,model_role,certification_status,settlement_details')
    .eq('sport_key', MLB_CURRENT_ERA_SHADOW_SETTLEMENT_SPORT_KEY)
    .eq('prediction_origin', MLB_CURRENT_ERA_SHADOW_SETTLEMENT_ORIGIN)
    .eq('model_role', 'shadow')
    .neq('certification_status', 'QUARANTINED')
    .order('commence_time', { ascending: true })
    .limit(1000)

  if (options.eventId) query = query.eq('game_id', options.eventId)

  const { data: predictionData, error: predictionError } = await query
  if (predictionError) throw new Error(`MLB Current Era Shadow settlement prediction read failed: ${predictionError.message}`)

  const predictions = (predictionData ?? []) as PredictionRow[]
  audit.checked = predictions.length
  const eventIds = Array.from(new Set(predictions.map((row) => row.game_id).filter(Boolean))) as string[]
  audit.uniqueGames = eventIds.length

  const [{ data: eventData, error: eventError }, { data: resultData, error: resultError }] =
    await Promise.all([
      supabaseAdmin
        .from('sport_events')
        .select('id,sport_key,start_time,status,home_team,away_team,home_score,away_score')
        .eq('sport_key', MLB_CURRENT_ERA_SHADOW_SETTLEMENT_SPORT_KEY)
        .in('id', eventIds.length ? eventIds : ['__empty__']),
      supabaseAdmin
        .from('game_results')
        .select('id,game_id,sport_key,commence_time,home_team,away_team,home_score,away_score,winner,created_at')
        .eq('sport_key', MLB_CURRENT_ERA_SHADOW_SETTLEMENT_SPORT_KEY)
        .in('game_id', eventIds.length ? eventIds : ['__empty__']),
    ])

  if (eventError) throw new Error(`MLB Current Era Shadow settlement event read failed: ${eventError.message}`)
  if (resultError) throw new Error(`MLB Current Era Shadow settlement result read failed: ${resultError.message}`)

  const eventsById = new Map((eventData ?? []).map((event) => [event.id, event as EventRow]))
  const resultsByGameId = new Map((resultData ?? []).map((result) => [String(result.game_id), result as ResultRow]))
  audit.finalGamesFound = Array.from(eventsById.values()).filter((event) => isFinalStatus(event.status)).length

  for (const prediction of predictions) {
    const event = prediction.game_id ? eventsById.get(prediction.game_id) : null
    const result = prediction.game_id ? resultsByGameId.get(prediction.game_id) : null
    const candidate = evaluateMlbCurrentEraShadowSettlementCandidate({
      prediction,
      event,
      result,
      now: options.now,
    })
    audit.candidates.push(candidate)

    if (!candidate.wouldSettle) {
      audit.skipped += 1
      increment(audit.skipReasons, candidate.skipReason)
      continue
    }

    audit.eligible += 1
    audit.wouldSettle += 1
    if (candidate.decision?.outcome === 'win') audit.wins += 1
    if (candidate.decision?.outcome === 'loss') audit.losses += 1
    if (candidate.decision?.outcome === 'push') audit.pushes += 1

    if (!execute) continue

    if (!activationAuthorized) {
      audit.skipped += 1
      audit.eligible -= 1
      audit.wouldSettle -= 1
      increment(audit.skipReasons, 'ACTIVATION_NOT_AUTHORIZED')
      continue
    }

    if (!candidate.proposedPatch) {
      audit.skipped += 1
      increment(audit.skipReasons, candidate.skipReason ?? 'BLOCKED_RESULT_MISSING')
      continue
    }

    const { error: updateError } = await supabaseAdmin
      .from('prediction_history')
      .update(candidate.proposedPatch)
      .eq('id', prediction.id)
      .eq('sport_key', MLB_CURRENT_ERA_SHADOW_SETTLEMENT_SPORT_KEY)
      .eq('prediction_origin', MLB_CURRENT_ERA_SHADOW_SETTLEMENT_ORIGIN)
      .eq('model_role', 'shadow')
      .neq('certification_status', 'QUARANTINED')
      .is('settled_at', null)

    if (updateError) throw new Error(`MLB Current Era Shadow settlement update failed: ${updateError.message}`)
    audit.databaseMutationsMade += 1
    audit.settled += 1
  }

  return audit
}

export function runMlbCurrentEraShadowSettlementFixtures() {
  const basePrediction: PredictionRow = {
    id: 'prediction-1',
    sport_key: MLB_CURRENT_ERA_SHADOW_SETTLEMENT_SPORT_KEY,
    prediction_origin: MLB_CURRENT_ERA_SHADOW_SETTLEMENT_ORIGIN,
    game_id: 'event-1',
    commence_time: '2026-08-20T23:00:00.000Z',
    home_team: 'TEX',
    away_team: 'WSH',
    team: 'WSH',
    selection: 'WSH',
    market: 'moneyline',
    sportsbook: 'betmgm',
    odds: 155,
    line: null,
    stake: 100,
    result: null,
    status: 'pending',
    lifecycle_status: 'active',
    manual_adjustment: false,
    settled_at: null,
    result_id: null,
    production_eligible: false,
    recommended_pick: false,
    official_pick_at_lock: false,
    is_current: false,
    model_role: 'shadow',
    certification_status: 'SHADOW_PENDING',
    settlement_details: {},
  }
  const finalEvent: EventRow = {
    id: 'event-1',
    sport_key: MLB_CURRENT_ERA_SHADOW_SETTLEMENT_SPORT_KEY,
    start_time: '2026-08-20T23:00:00.000Z',
    status: 'completed',
    home_team: 'TEX',
    away_team: 'WSH',
    home_score: 4,
    away_score: 6,
  }
  const finalResult: ResultRow = {
    id: 'result-1',
    game_id: 'event-1',
    sport_key: MLB_CURRENT_ERA_SHADOW_SETTLEMENT_SPORT_KEY,
    commence_time: '2026-08-20T23:00:00.000Z',
    home_team: 'TEX',
    away_team: 'WSH',
    home_score: 4,
    away_score: 6,
    winner: 'WSH',
    created_at: '2026-08-21T03:00:00.000Z',
  }
  const now = new Date('2026-08-21T04:00:00.000Z')
  const evaluate = (
    prediction: Partial<PredictionRow>,
    event: EventRow | null = finalEvent,
    result: ResultRow | null = finalResult
  ) =>
    evaluateMlbCurrentEraShadowSettlementCandidate({
      prediction: { ...basePrediction, ...prediction },
      event,
      result,
      now,
    })

  const cases = {
    moneylineWin: evaluate({ market: 'moneyline', team: 'WSH', selection: 'WSH' }),
    moneylineLoss: evaluate({ market: 'moneyline', team: 'TEX', selection: 'TEX' }),
    runLineWin: evaluate({ market: 'run_line', team: 'TEX', selection: 'TEX', line: 2.5 }),
    runLineLoss: evaluate({ market: 'run_line', team: 'TEX', selection: 'TEX', line: 1.5 }),
    runLinePush: evaluate({ market: 'run_line', team: 'TEX', selection: 'TEX', line: 2 }),
    totalOver: evaluate({ market: 'total', team: 'over', selection: 'over', line: 9.5 }),
    totalUnder: evaluate({ market: 'total', team: 'under', selection: 'under', line: 10.5 }),
    totalPush: evaluate({ market: 'total', team: 'over', selection: 'over', line: 10 }),
    cancelled: evaluate({}, { ...finalEvent, status: 'postponed', home_score: null, away_score: null }, null),
    missingResult: evaluate({}, finalEvent, null),
    alreadySettledSameResult: evaluate({ result: 'win', status: 'win', settled_at: '2026-08-21T03:05:00.000Z', result_id: 'result-1' }),
    conflictingPriorSettlement: evaluate({ result: 'win', status: 'win', settled_at: '2026-08-21T03:05:00.000Z', result_id: 'other-result' }),
    quarantinedExclusion: evaluate({ certification_status: 'QUARANTINED' }),
  }

  return {
    mode: `${MLB_CURRENT_ERA_SHADOW_SETTLEMENT_VERSION}_fixtures`,
    cases,
    expected: {
      moneylineWin: 'win',
      moneylineLoss: 'loss',
      runLineWin: 'win',
      runLineLoss: 'loss',
      runLinePush: 'push',
      totalOver: 'win',
      totalUnder: 'win',
      totalPush: 'push',
      cancelled: 'BLOCKED_CANCELLED',
      missingResult: 'BLOCKED_RESULT_MISSING',
      alreadySettledSameResult: 'ALREADY_SETTLED',
      conflictingPriorSettlement: 'CONFLICTING_PRIOR_SETTLEMENT',
      quarantinedExclusion: 'QUARANTINED_EXCLUDED',
    },
    providerCallsMade: 0,
    productionDatabaseMutations: 0,
  }
}
