import 'server-only'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { settleMarket, type SettlementDecision, type SettlementMarket } from '@/services/settlement-core.service'

export const NBA_CURRENT_ERA_SHADOW_SETTLEMENT_VERSION = 'nba_current_era_shadow_settlement_preparation_v1'
export const NBA_CURRENT_ERA_SHADOW_SETTLEMENT_ORIGIN = 'CURRENT_ERA_SHADOW'
export const NBA_CURRENT_ERA_SHADOW_SETTLEMENT_SPORT_KEY = 'basketball_nba'
export const NBA_CURRENT_ERA_SHADOW_SETTLEMENT_LOCK_KEY = 'nba_current_era_shadow_settlement'
export const NBA_CURRENT_ERA_SHADOW_SETTLEMENT_SUPPORTED_MARKETS = ['moneyline', 'spread', 'total'] as const

type SupportedMarket = (typeof NBA_CURRENT_ERA_SHADOW_SETTLEMENT_SUPPORTED_MARKETS)[number]

export type NbaCurrentEraShadowSettlementSkipReason =
  | 'EVENT_NOT_FOUND'
  | 'EVENT_NOT_STARTED'
  | 'EVENT_NOT_FINAL'
  | 'RESULT_MISSING'
  | 'MISSING_FINAL_SCORE'
  | 'UNSUPPORTED_MARKET'
  | 'MISSING_LINE'
  | 'ALREADY_SETTLED'
  | 'MANUAL_ADJUSTMENT'
  | 'AMBIGUOUS_SELECTION'
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
  production_eligible: boolean | null
  recommended_pick: boolean | null
  official_pick_at_lock: boolean | null
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

export type NbaCurrentEraShadowSettlementCandidate = {
  predictionId: string
  eventId: string | null
  market: string | null
  selection: string | null
  line: number | null
  sportsbook: string | null
  eventStatus: string | null
  resultId: string | null
  decision: SettlementDecision | null
  wouldSettle: boolean
  skipReason: NbaCurrentEraShadowSettlementSkipReason | null
}

export type NbaCurrentEraShadowSettlementAudit = {
  success: boolean
  mode: typeof NBA_CURRENT_ERA_SHADOW_SETTLEMENT_VERSION
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
  historicalReplayWrites: 0
  mlbWrites: 0
  lock: {
    key: typeof NBA_CURRENT_ERA_SHADOW_SETTLEMENT_LOCK_KEY
    requiredForMutation: true
    acquired: false
    note: string
  }
  candidates: NbaCurrentEraShadowSettlementCandidate[]
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

function isSupportedMarket(value: string | null | undefined): value is SupportedMarket {
  return NBA_CURRENT_ERA_SHADOW_SETTLEMENT_SUPPORTED_MARKETS.includes(value as SupportedMarket)
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

  if (selected === home) {
    return {
      selectedScore: result.home_score,
      opponentScore: result.away_score,
    }
  }

  if (selected === away) {
    return {
      selectedScore: result.away_score,
      opponentScore: result.home_score,
    }
  }

  return null
}

function candidateKey(prediction: PredictionRow): NbaCurrentEraShadowSettlementCandidate {
  return {
    predictionId: prediction.id,
    eventId: prediction.game_id,
    market: prediction.market,
    selection: prediction.team ?? prediction.selection,
    line: prediction.line,
    sportsbook: prediction.sportsbook,
    eventStatus: null,
    resultId: null,
    decision: null,
    wouldSettle: false,
    skipReason: null,
  }
}

export function evaluateNbaCurrentEraShadowSettlementCandidate(input: {
  prediction: PredictionRow
  event?: EventRow | null
  result?: ResultRow | null
  now?: Date
}): NbaCurrentEraShadowSettlementCandidate {
  const { prediction, event, result } = input
  const candidate = candidateKey(prediction)
  candidate.eventStatus = event?.status ?? null
  candidate.resultId = result?.id ?? null

  if (prediction.prediction_origin !== NBA_CURRENT_ERA_SHADOW_SETTLEMENT_ORIGIN) {
    candidate.skipReason = 'UNSUPPORTED_MARKET'
    return candidate
  }

  if (prediction.manual_adjustment) {
    candidate.skipReason = 'MANUAL_ADJUSTMENT'
    return candidate
  }

  if (prediction.settled_at || isTerminalResult(prediction.result) || isTerminalResult(prediction.status)) {
    candidate.skipReason = 'ALREADY_SETTLED'
    return candidate
  }

  const market = prediction.market
  if (!isSupportedMarket(market)) {
    candidate.skipReason = 'UNSUPPORTED_MARKET'
    return candidate
  }

  if ((market === 'spread' || market === 'total') && !Number.isFinite(Number(prediction.line))) {
    candidate.skipReason = 'MISSING_LINE'
    return candidate
  }

  if (!event) {
    candidate.skipReason = 'EVENT_NOT_FOUND'
    return candidate
  }

  const startTime = event.start_time ?? prediction.commence_time
  if (startTime && new Date(startTime).getTime() > (input.now ?? new Date()).getTime()) {
    candidate.skipReason = 'EVENT_NOT_STARTED'
    return candidate
  }

  if (!isFinalStatus(event.status)) {
    candidate.skipReason = 'EVENT_NOT_FINAL'
    return candidate
  }

  if (!result || result.sport_key !== NBA_CURRENT_ERA_SHADOW_SETTLEMENT_SPORT_KEY || result.game_id !== event.id) {
    candidate.skipReason = 'RESULT_MISSING'
    return candidate
  }

  if (result.home_score === null || result.away_score === null) {
    candidate.skipReason = 'MISSING_FINAL_SCORE'
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
    return candidate
  }

  const scores = scorePairForSelection(prediction, event, result)
  if (!scores) {
    candidate.skipReason = 'AMBIGUOUS_SELECTION'
    return candidate
  }

  const decision = settleMarket({
    market: market as SettlementMarket,
    selection: prediction.team ?? prediction.selection ?? '',
    line: market === 'moneyline' ? null : prediction.line,
    selectedScore: scores.selectedScore,
    opponentScore: scores.opponentScore,
    eventStatus: 'completed',
  })
  candidate.decision = decision
  candidate.wouldSettle = decision.outcome !== 'pending' && decision.outcome !== 'void'
  return candidate
}

function increment(counts: Record<string, number>, key: string | null) {
  const normalized = key ?? 'UNKNOWN'
  counts[normalized] = (counts[normalized] ?? 0) + 1
}

export async function auditNbaCurrentEraShadowSettlementReadiness(options: {
  execute?: boolean
  activationAuthorized?: boolean
  eventId?: string
  now?: Date
} = {}): Promise<NbaCurrentEraShadowSettlementAudit> {
  const execute = options.execute === true
  const activationAuthorized = options.activationAuthorized === true
  const audit: NbaCurrentEraShadowSettlementAudit = {
    success: true,
    mode: NBA_CURRENT_ERA_SHADOW_SETTLEMENT_VERSION,
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
    historicalReplayWrites: 0,
    mlbWrites: 0,
    lock: {
      key: NBA_CURRENT_ERA_SHADOW_SETTLEMENT_LOCK_KEY,
      requiredForMutation: true,
      acquired: false,
      note: execute
        ? 'Future activation must acquire the NBA Current Era Shadow settlement lock before mutation.'
        : 'Read-only preparation does not acquire a settlement lock.',
    },
    candidates: [],
  }

  let query = supabaseAdmin
    .from('prediction_history')
    .select('id,sport_key,prediction_origin,game_id,commence_time,home_team,away_team,team,selection,market,sportsbook,odds,line,stake,result,status,lifecycle_status,manual_adjustment,settled_at,production_eligible,recommended_pick,official_pick_at_lock')
    .eq('sport_key', NBA_CURRENT_ERA_SHADOW_SETTLEMENT_SPORT_KEY)
    .eq('prediction_origin', NBA_CURRENT_ERA_SHADOW_SETTLEMENT_ORIGIN)
    .order('commence_time', { ascending: true })
    .limit(1000)

  if (options.eventId) query = query.eq('game_id', options.eventId)

  const { data: predictionData, error: predictionError } = await query
  if (predictionError) throw new Error(`NBA Current Era Shadow settlement prediction read failed: ${predictionError.message}`)

  const predictions = (predictionData ?? []) as PredictionRow[]
  audit.checked = predictions.length
  const eventIds = Array.from(new Set(predictions.map((row) => row.game_id).filter(Boolean))) as string[]
  audit.uniqueGames = eventIds.length

  const [{ data: eventData, error: eventError }, { data: resultData, error: resultError }] =
    await Promise.all([
      supabaseAdmin
        .from('sport_events')
        .select('id,sport_key,start_time,status,home_team,away_team,home_score,away_score')
        .eq('sport_key', NBA_CURRENT_ERA_SHADOW_SETTLEMENT_SPORT_KEY)
        .in('id', eventIds.length ? eventIds : ['__empty__']),
      supabaseAdmin
        .from('game_results')
        .select('id,game_id,sport_key,commence_time,home_team,away_team,home_score,away_score,winner,created_at')
        .eq('sport_key', NBA_CURRENT_ERA_SHADOW_SETTLEMENT_SPORT_KEY)
        .in('game_id', eventIds.length ? eventIds : ['__empty__']),
    ])

  if (eventError) throw new Error(`NBA Current Era Shadow settlement event read failed: ${eventError.message}`)
  if (resultError) throw new Error(`NBA Current Era Shadow settlement result read failed: ${resultError.message}`)

  const eventsById = new Map((eventData ?? []).map((event) => [event.id, event as EventRow]))
  const resultsByGameId = new Map((resultData ?? []).map((result) => [String(result.game_id), result as ResultRow]))
  audit.finalGamesFound = Array.from(eventsById.values()).filter((event) => isFinalStatus(event.status)).length

  for (const prediction of predictions) {
    const event = prediction.game_id ? eventsById.get(prediction.game_id) : null
    const result = prediction.game_id ? resultsByGameId.get(prediction.game_id) : null
    const candidate = evaluateNbaCurrentEraShadowSettlementCandidate({
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

    const decision = candidate.decision
    if (!decision) {
      audit.skipped += 1
      increment(audit.skipReasons, candidate.skipReason ?? 'RESULT_MISSING')
      continue
    }

    const stake = safeStake(prediction.stake)
    const profit = Number(profitFor(decision.outcome, prediction.odds, stake).toFixed(2))
    const { error: updateError } = await supabaseAdmin
      .from('prediction_history')
      .update({
        result: decision.outcome,
        status: decision.outcome,
        lifecycle_status: 'settled',
        stake,
        profit,
        settled_at: nowIso(),
        result_id: candidate.resultId,
        settlement_source: 'game_results',
        settlement_version: NBA_CURRENT_ERA_SHADOW_SETTLEMENT_VERSION,
        settlement_details: {
          reason: decision.reason,
          market: candidate.market,
          selection: candidate.selection,
          line: candidate.line,
          odds: prediction.odds,
          resultId: candidate.resultId,
          predictionOrigin: NBA_CURRENT_ERA_SHADOW_SETTLEMENT_ORIGIN,
          productionLearningEligible: false,
          productionCalibrationEligible: false,
          productionVisible: false,
        },
      })
      .eq('id', prediction.id)
      .eq('prediction_origin', NBA_CURRENT_ERA_SHADOW_SETTLEMENT_ORIGIN)
      .is('settled_at', null)

    if (updateError) throw new Error(`NBA Current Era Shadow settlement update failed: ${updateError.message}`)
    audit.databaseMutationsMade += 1
    audit.settled += 1
  }

  return audit
}

export function runNbaCurrentEraShadowSettlementFixtures() {
  const basePrediction: PredictionRow = {
    id: 'prediction-1',
    sport_key: NBA_CURRENT_ERA_SHADOW_SETTLEMENT_SPORT_KEY,
    prediction_origin: NBA_CURRENT_ERA_SHADOW_SETTLEMENT_ORIGIN,
    game_id: 'event-1',
    commence_time: '2026-10-20T23:00:00.000Z',
    home_team: 'Detroit Pistons',
    away_team: 'Chicago Bulls',
    team: 'Detroit Pistons',
    selection: 'Detroit Pistons',
    market: 'moneyline',
    sportsbook: 'draftkings',
    odds: -120,
    line: null,
    stake: 100,
    result: null,
    status: 'pending',
    lifecycle_status: 'active',
    manual_adjustment: false,
    settled_at: null,
    production_eligible: false,
    recommended_pick: false,
    official_pick_at_lock: false,
  }
  const finalEvent: EventRow = {
    id: 'event-1',
    sport_key: NBA_CURRENT_ERA_SHADOW_SETTLEMENT_SPORT_KEY,
    start_time: '2026-10-20T23:00:00.000Z',
    status: 'completed',
    home_team: 'Detroit Pistons',
    away_team: 'Chicago Bulls',
    home_score: 112,
    away_score: 108,
  }
  const finalResult: ResultRow = {
    id: 'result-1',
    game_id: 'event-1',
    sport_key: NBA_CURRENT_ERA_SHADOW_SETTLEMENT_SPORT_KEY,
    commence_time: '2026-10-20T23:00:00.000Z',
    home_team: 'Detroit Pistons',
    away_team: 'Chicago Bulls',
    home_score: 112,
    away_score: 108,
    winner: 'Detroit Pistons',
    created_at: '2026-10-21T02:00:00.000Z',
  }
  const futureEvent = { ...finalEvent, status: 'scheduled', start_time: '2099-10-20T23:00:00.000Z', home_score: null, away_score: null }
  const liveEvent = { ...finalEvent, status: 'live', home_score: 56, away_score: 51 }
  const now = new Date('2026-10-21T03:00:00.000Z')
  const evaluate = (prediction: Partial<PredictionRow>, event: EventRow | null = finalEvent, result: ResultRow | null = finalResult) =>
    evaluateNbaCurrentEraShadowSettlementCandidate({
      prediction: { ...basePrediction, ...prediction },
      event,
      result,
      now,
    })
  const cases = {
    futureGame: evaluate({}, futureEvent, null),
    startedNotFinal: evaluate({}, liveEvent, null),
    moneylineWin: evaluate({ market: 'moneyline', team: 'Detroit Pistons', selection: 'Detroit Pistons' }),
    moneylineLoss: evaluate({ market: 'moneyline', team: 'Chicago Bulls', selection: 'Chicago Bulls' }),
    spreadWin: evaluate({ market: 'spread', team: 'Detroit Pistons', selection: 'Detroit Pistons', line: -2 }),
    spreadLoss: evaluate({ market: 'spread', team: 'Chicago Bulls', selection: 'Chicago Bulls', line: 3 }),
    spreadPush: evaluate({ market: 'spread', team: 'Chicago Bulls', selection: 'Chicago Bulls', line: 4 }),
    totalOver: evaluate({ market: 'total', team: 'over', selection: 'over', line: 219.5 }),
    totalUnder: evaluate({ market: 'total', team: 'under', selection: 'under', line: 221.5 }),
    totalPush: evaluate({ market: 'total', team: 'over', selection: 'over', line: 220 }),
    missingFinalScore: evaluate({}, finalEvent, { ...finalResult, home_score: null, away_score: null }),
    alreadySettled: evaluate({ result: 'win', status: 'win', settled_at: '2026-10-21T02:05:00.000Z' }),
    repeatedSettlementRun: evaluate({ result: 'win', status: 'win', settled_at: '2026-10-21T02:05:00.000Z' }),
    multipleSportsbooksSameGame: [
      evaluate({ id: 'prediction-book-1', sportsbook: 'draftkings' }),
      evaluate({ id: 'prediction-book-2', sportsbook: 'fanduel' }),
    ],
    historicalReplayIsolation: evaluate({ prediction_origin: 'HISTORICAL_REPLAY_SHADOW' }),
    officialPickNoProductAction: evaluate({ official_pick_at_lock: true, production_eligible: false, recommended_pick: false }),
    learningCalibrationSpy: {
      productionLearningEligible: false,
      productionCalibrationEligible: false,
    },
    mlbIsolation: evaluate({ sport_key: 'baseball_mlb', prediction_origin: 'LIVE_PREGAME' }),
  }
  return {
    mode: `${NBA_CURRENT_ERA_SHADOW_SETTLEMENT_VERSION}_fixtures`,
    cases,
    expected: {
      futureGame: 'EVENT_NOT_STARTED',
      startedNotFinal: 'EVENT_NOT_FINAL',
      moneylineWin: 'win',
      moneylineLoss: 'loss',
      spreadWin: 'win',
      spreadLoss: 'loss',
      spreadPush: 'push',
      totalOver: 'win',
      totalUnder: 'win',
      totalPush: 'push',
      missingFinalScore: 'MISSING_FINAL_SCORE',
      alreadySettled: 'ALREADY_SETTLED',
      repeatedSettlementRun: 'ALREADY_SETTLED',
      historicalReplayIsolation: 'UNSUPPORTED_MARKET',
      officialPickWrites: 0,
      learningWrites: 0,
      calibrationWrites: 0,
      mlbWrites: 0,
    },
    providerCallsMade: 0,
    productionDatabaseMutations: 0,
  }
}
