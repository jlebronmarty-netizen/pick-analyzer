import { supabaseAdmin } from '@/lib/supabase-admin'
import { getNbaInjuryLineupConfidenceStatus } from '@/services/nba-injury-lineup-confidence.service'
import { NBA_PREDICTION_MODEL_VERSION, NBA_SPORT_KEY } from '@/services/nba-prediction-validation.service'

type SettlementOutcome = 'win' | 'loss' | 'push' | 'void' | 'pending'
type NbaMarket = 'moneyline' | 'spread' | 'total' | 'first_half' | 'first_half_spread' | 'first_half_total'

type PredictionRow = {
  id: string
  sport_key: string
  game_id: string
  commence_time: string | null
  home_team: string | null
  away_team: string | null
  team: string
  opponent: string | null
  market: NbaMarket | string | null
  sportsbook: string | null
  odds: number | null
  line: number | null
  model_probability: number | null
  edge: number | null
  ev: number | null
  confidence: number | null
  stake: number | null
  profit: number | null
  status: string | null
  result: string | null
  settled_at: string | null
  lifecycle_status: string | null
  manual_adjustment: boolean | null
  model_version: string | null
  feature_snapshot: Record<string, unknown> | null
  feature_snapshot_id?: string | null
  production_eligible?: boolean | null
  trial?: boolean | null
  scrambled?: boolean | null
  validation_warnings: string[] | null
  odds_timestamp: string | null
  generated_at: string | null
  cutoff_at: string | null
}

type EventRow = {
  id: string
  status: string
  home_team: string
  away_team: string
  home_score: number | null
  away_score: number | null
  period_scores: Record<string, unknown> | null
  start_time: string
}

type StatsRow = {
  event_id: string
  team_name: string
  is_home: boolean
  points_for: number | null
  quarter_scores: unknown
}

type SettlementDecision = {
  outcome: SettlementOutcome
  reason: string
  homeScore?: number
  awayScore?: number
  firstHalfHome?: number
  firstHalfAway?: number
}

export type NbaSettlementResult = {
  success: true
  mode: string
  generatedAt: string
  checked: number
  settled: number
  wins: number
  losses: number
  pushes: number
  voids: number
  pending: number
  skipped: number
  errors: string[]
}

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits))
}

function safeNumber(value: unknown, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function normalize(value: string | null | undefined) {
  return String(value ?? '').trim().toLowerCase()
}

function isFinalResult(result: string | null | undefined) {
  return ['win', 'loss', 'push', 'void'].includes(String(result ?? '').toLowerCase())
}

function profitFor(outcome: SettlementOutcome, odds: number, stake: number) {
  if (outcome === 'loss') return -stake
  if (outcome === 'push' || outcome === 'void' || outcome === 'pending') return 0
  return odds > 0 ? stake * (odds / 100) : stake * (100 / Math.abs(odds))
}

function hasGenuineOfferedPrice(prediction: PredictionRow) {
  return Number.isFinite(Number(prediction.odds))
}

function getPeriodValue(periodScores: Record<string, unknown> | null, keys: string[]) {
  if (!periodScores) return null
  for (const key of keys) {
    const value = periodScores[key]
    if (typeof value === 'number') return value
    if (value && typeof value === 'object') {
      const score = (value as Record<string, unknown>).score
      if (typeof score === 'number') return score
    }
  }
  return null
}

function quarterSum(value: unknown) {
  if (!Array.isArray(value)) return null
  const q1 = safeNumber(value[0], Number.NaN)
  const q2 = safeNumber(value[1], Number.NaN)
  return Number.isFinite(q1) && Number.isFinite(q2) ? q1 + q2 : null
}

function firstHalfFromEvent(event: EventRow) {
  const home =
    getPeriodValue(event.period_scores, ['home_first_half', 'home_1h', 'homeHalf']) ??
    null
  const away =
    getPeriodValue(event.period_scores, ['away_first_half', 'away_1h', 'awayHalf']) ??
    null

  if (home !== null && away !== null) {
    return { home, away }
  }

  return null
}

function firstHalfFromStats(eventId: string, rows: StatsRow[]) {
  const eventRows = rows.filter((row) => row.event_id === eventId)
  const home = eventRows.find((row) => row.is_home)
  const away = eventRows.find((row) => !row.is_home)
  const homeHalf = quarterSum(home?.quarter_scores)
  const awayHalf = quarterSum(away?.quarter_scores)

  if (homeHalf !== null && awayHalf !== null) {
    return {
      home: homeHalf,
      away: awayHalf,
    }
  }

  return null
}

function settleSpread({
  prediction,
  event,
  homeScore,
  awayScore,
}: {
  prediction: PredictionRow
  event: EventRow
  homeScore: number
  awayScore: number
}): SettlementDecision {
  const line = Number(prediction.line)
  if (!Number.isFinite(line)) {
    return { outcome: 'pending', reason: 'missing_line' }
  }

  const pickIsHome = normalize(prediction.team) === normalize(event.home_team)
  const pickScore = pickIsHome ? homeScore : awayScore
  const opponentScore = pickIsHome ? awayScore : homeScore
  const adjusted = pickScore + line

  if (adjusted > opponentScore) return { outcome: 'win', reason: 'spread_covered' }
  if (adjusted < opponentScore) return { outcome: 'loss', reason: 'spread_not_covered' }
  return { outcome: 'push', reason: 'spread_push' }
}

function settleTotal(prediction: PredictionRow, totalScore: number): SettlementDecision {
  const line = Number(prediction.line)
  if (!Number.isFinite(line)) {
    return { outcome: 'pending', reason: 'missing_line' }
  }

  const pick = normalize(prediction.team)
  if (totalScore > line) {
    return { outcome: pick.includes('over') ? 'win' : 'loss', reason: 'total_over' }
  }
  if (totalScore < line) {
    return { outcome: pick.includes('under') ? 'win' : 'loss', reason: 'total_under' }
  }
  return { outcome: 'push', reason: 'total_push' }
}

function settlePrediction(
  prediction: PredictionRow,
  event: EventRow | undefined,
  statsRows: StatsRow[]
): SettlementDecision {
  if (!event) return { outcome: 'pending', reason: 'missing_event' }

  const eventStatus = normalize(event.status)
  if (eventStatus === 'cancelled') return { outcome: 'void', reason: 'event_cancelled' }
  if (eventStatus === 'postponed') return { outcome: 'pending', reason: 'event_postponed' }
  if (eventStatus !== 'completed') return { outcome: 'pending', reason: 'event_not_completed' }
  if (event.home_score === null || event.away_score === null) {
    return { outcome: 'pending', reason: 'missing_final_score' }
  }

  const market = String(prediction.market ?? 'moneyline') as NbaMarket
  const homeScore = Number(event.home_score)
  const awayScore = Number(event.away_score)

  if (market === 'moneyline') {
    if (homeScore === awayScore) return { outcome: 'push', reason: 'moneyline_tie' }
    const winner = homeScore > awayScore ? event.home_team : event.away_team
    return {
      outcome: normalize(prediction.team) === normalize(winner) ? 'win' : 'loss',
      reason: 'moneyline_final',
      homeScore,
      awayScore,
    }
  }

  if (market === 'spread') {
    return {
      ...settleSpread({ prediction, event, homeScore, awayScore }),
      homeScore,
      awayScore,
    }
  }

  if (market === 'total') {
    return {
      ...settleTotal(prediction, homeScore + awayScore),
      homeScore,
      awayScore,
    }
  }

  const firstHalf =
    firstHalfFromEvent(event) ?? firstHalfFromStats(event.id, statsRows)

  if (!firstHalf) {
    return { outcome: 'pending', reason: 'missing_first_half_score' }
  }

  if (market === 'first_half_spread') {
    return {
      ...settleSpread({
        prediction,
        event,
        homeScore: firstHalf.home,
        awayScore: firstHalf.away,
      }),
      firstHalfHome: firstHalf.home,
      firstHalfAway: firstHalf.away,
    }
  }

  return {
    ...settleTotal(prediction, firstHalf.home + firstHalf.away),
    firstHalfHome: firstHalf.home,
    firstHalfAway: firstHalf.away,
  }
}

async function loadPendingPredictions(eventId?: string) {
  let query = supabaseAdmin
    .from('prediction_history')
    .select('*')
    .eq('sport_key', NBA_SPORT_KEY)
    .or('result.is.null,result.eq.pending,status.eq.pending')
    .limit(1000)

  if (eventId) {
    query = query.eq('game_id', eventId)
  }

  const { data, error } = await query
  if (error) throw new Error(`Failed to load NBA predictions: ${error.message}`)
  return (data ?? []) as PredictionRow[]
}

async function loadPendingPredictionsByIds(predictionIds: string[]) {
  if (!predictionIds.length) return []

  const { data, error } = await supabaseAdmin
    .from('prediction_history')
    .select('*')
    .eq('sport_key', NBA_SPORT_KEY)
    .in('id', predictionIds)
    .limit(100)

  if (error) throw new Error(`Failed to load bounded NBA predictions: ${error.message}`)

  return ((data ?? []) as PredictionRow[]).filter(
    (row) => !isFinalResult(row.result) && row.lifecycle_status !== 'skipped'
  )
}

export async function settleNbaPredictions(eventId?: string): Promise<NbaSettlementResult> {
  const summary: NbaSettlementResult = {
    success: true,
    mode: eventId ? 'nba_prediction_event_settlement_v1' : 'nba_prediction_settlement_v1',
    generatedAt: new Date().toISOString(),
    checked: 0,
    settled: 0,
    wins: 0,
    losses: 0,
    pushes: 0,
    voids: 0,
    pending: 0,
    skipped: 0,
    errors: [],
  }

  const predictions = await loadPendingPredictions(eventId)
  summary.checked = predictions.length

  if (!predictions.length) return summary

  const eventIds = Array.from(new Set(predictions.map((prediction) => prediction.game_id)))
  const [{ data: events, error: eventError }, { data: statsRows, error: statsError }] =
    await Promise.all([
      supabaseAdmin
        .from('sport_events')
        .select('*')
        .eq('sport_key', NBA_SPORT_KEY)
        .in('id', eventIds),
      supabaseAdmin
        .from('sport_game_stats')
        .select('event_id, team_name, is_home, points_for, quarter_scores')
        .eq('sport_key', NBA_SPORT_KEY)
        .in('event_id', eventIds),
    ])

  if (eventError) throw new Error(`Failed to load NBA events: ${eventError.message}`)
  if (statsError) throw new Error(`Failed to load NBA game stats: ${statsError.message}`)

  const eventsById = new Map((events ?? []).map((event) => [event.id, event as EventRow]))
  const stats = (statsRows ?? []) as StatsRow[]

  for (const prediction of predictions) {
    if (prediction.manual_adjustment || isFinalResult(prediction.result)) {
      summary.skipped += 1
      continue
    }

    const decision = settlePrediction(prediction, eventsById.get(prediction.game_id), stats)

    if (decision.outcome === 'pending') {
      summary.pending += 1
      continue
    }

    const stake = safeNumber(prediction.stake, 100)
    const hasPrice = hasGenuineOfferedPrice(prediction)
    const odds = hasPrice ? Number(prediction.odds) : 0
    const profit = hasPrice ? round(profitFor(decision.outcome, odds, stake)) : 0
    const lifecycleStatus = decision.outcome === 'void' ? 'void' : 'settled'

    const { error } = await supabaseAdmin
      .from('prediction_history')
      .update({
        result: decision.outcome,
        status: decision.outcome,
        lifecycle_status: lifecycleStatus,
        stake,
        profit,
        settled_at: new Date().toISOString(),
        settlement_source: 'sport_events',
        settlement_version: 'nba_prediction_settlement_v1',
        settlement_details: {
          reason: decision.reason,
          market: prediction.market,
          line: prediction.line,
          odds: prediction.odds,
          roiEligible: hasPrice && prediction.production_eligible === true && prediction.trial !== true,
          missingOfferedPrice: !hasPrice,
          trial: prediction.trial === true,
          productionEligible: prediction.production_eligible === true,
          homeScore: decision.homeScore,
          awayScore: decision.awayScore,
          firstHalfHome: decision.firstHalfHome,
          firstHalfAway: decision.firstHalfAway,
        },
      })
      .eq('id', prediction.id)
      .eq('manual_adjustment', false)

    if (error) {
      summary.errors.push(`${prediction.id}: ${error.message}`)
      summary.skipped += 1
      continue
    }

    summary.settled += 1
    if (decision.outcome === 'win') summary.wins += 1
    if (decision.outcome === 'loss') summary.losses += 1
    if (decision.outcome === 'push') summary.pushes += 1
    if (decision.outcome === 'void') summary.voids += 1
  }

  return summary
}

export async function settleNbaPredictionsByIds(
  predictionIds: string[]
): Promise<NbaSettlementResult> {
  const summary: NbaSettlementResult = {
    success: true,
    mode: 'nba_prediction_bounded_lineage_settlement_v1',
    generatedAt: new Date().toISOString(),
    checked: 0,
    settled: 0,
    wins: 0,
    losses: 0,
    pushes: 0,
    voids: 0,
    pending: 0,
    skipped: 0,
    errors: [],
  }

  const predictions = await loadPendingPredictionsByIds(predictionIds)
  summary.checked = predictions.length

  if (!predictions.length) return summary

  const eventIds = Array.from(new Set(predictions.map((prediction) => prediction.game_id)))
  const [{ data: events, error: eventError }, { data: statsRows, error: statsError }] =
    await Promise.all([
      supabaseAdmin
        .from('sport_events')
        .select('*')
        .eq('sport_key', NBA_SPORT_KEY)
        .in('id', eventIds),
      supabaseAdmin
        .from('sport_game_stats')
        .select('event_id, team_name, is_home, points_for, quarter_scores')
        .eq('sport_key', NBA_SPORT_KEY)
        .in('event_id', eventIds),
    ])

  if (eventError) throw new Error(`Failed to load NBA events: ${eventError.message}`)
  if (statsError) throw new Error(`Failed to load NBA game stats: ${statsError.message}`)

  const eventsById = new Map((events ?? []).map((event) => [event.id, event as EventRow]))
  const stats = (statsRows ?? []) as StatsRow[]

  for (const prediction of predictions) {
    if (prediction.manual_adjustment || isFinalResult(prediction.result)) {
      summary.skipped += 1
      continue
    }

    const decision = settlePrediction(prediction, eventsById.get(prediction.game_id), stats)

    if (decision.outcome === 'pending') {
      summary.pending += 1
      continue
    }

    const stake = safeNumber(prediction.stake, 100)
    const hasPrice = hasGenuineOfferedPrice(prediction)
    const odds = hasPrice ? Number(prediction.odds) : 0
    const profit = hasPrice ? round(profitFor(decision.outcome, odds, stake)) : 0
    const lifecycleStatus = decision.outcome === 'void' ? 'void' : 'settled'

    const { error } = await supabaseAdmin
      .from('prediction_history')
      .update({
        result: decision.outcome,
        status: decision.outcome,
        lifecycle_status: lifecycleStatus,
        stake,
        profit,
        settled_at: new Date().toISOString(),
        settlement_source: 'sport_events',
        settlement_version: 'nba_prediction_bounded_lineage_settlement_v1',
        settlement_details: {
          reason: decision.reason,
          market: prediction.market,
          line: prediction.line,
          odds: prediction.odds,
          roiEligible: hasPrice && prediction.production_eligible === true && prediction.trial !== true,
          missingOfferedPrice: !hasPrice,
          trial: prediction.trial === true,
          productionEligible: prediction.production_eligible === true,
          homeScore: decision.homeScore,
          awayScore: decision.awayScore,
          firstHalfHome: decision.firstHalfHome,
          firstHalfAway: decision.firstHalfAway,
        },
      })
      .eq('id', prediction.id)
      .eq('manual_adjustment', false)

    if (error) {
      summary.errors.push(`${prediction.id}: ${error.message}`)
      summary.skipped += 1
      continue
    }

    summary.settled += 1
    if (decision.outcome === 'win') summary.wins += 1
    if (decision.outcome === 'loss') summary.losses += 1
    if (decision.outcome === 'push') summary.pushes += 1
    if (decision.outcome === 'void') summary.voids += 1
  }

  return summary
}

function getResult(row: PredictionRow) {
  return String(row.result ?? row.status ?? 'pending').toLowerCase()
}

function groupRows(rows: PredictionRow[], getKey: (row: PredictionRow) => string) {
  const groups = new Map<string, PredictionRow[]>()
  for (const row of rows) {
    const key = getKey(row)
    groups.set(key, [...(groups.get(key) ?? []), row])
  }
  return Array.from(groups.entries()).map(([key, group]) => ({ key, rows: group }))
}

function summarizeRows(rows: PredictionRow[]) {
  const settled = rows.filter((row) => ['win', 'loss', 'push', 'void'].includes(getResult(row)))
  const graded = settled.filter((row) => getResult(row) !== 'void')
  const wins = settled.filter((row) => getResult(row) === 'win').length
  const losses = settled.filter((row) => getResult(row) === 'loss').length
  const pushes = settled.filter((row) => getResult(row) === 'push').length
  const voids = settled.filter((row) => getResult(row) === 'void').length
  const profit = settled.reduce((sum, row) => sum + safeNumber(row.profit, 0), 0)
  const stake = settled.reduce((sum, row) => sum + safeNumber(row.stake, 100), 0)
  const avg = (field: keyof PredictionRow) =>
    rows.length
      ? round(rows.reduce((sum, row) => sum + safeNumber(row[field], 0), 0) / rows.length)
      : 0

  return {
    total: rows.length,
    settled: settled.length,
    pending: rows.length - settled.length,
    wins,
    losses,
    pushes,
    voids,
    winRate: graded.length ? round((wins / graded.length) * 100) : 0,
    profit: round(profit),
    units: round(profit / 100),
    roi: stake ? round((profit / stake) * 100) : 0,
    averageOdds: avg('odds'),
    averageEdge: avg('edge'),
    averageConfidence: avg('confidence'),
  }
}

function confidenceBucket(row: PredictionRow) {
  const confidence = safeNumber(row.confidence, 0)
  if (confidence >= 75) return '75+'
  if (confidence >= 65) return '65-74'
  if (confidence >= 55) return '55-64'
  return '<55'
}

function sufficiencyBucket(row: PredictionRow) {
  const sufficiency = safeNumber(row.feature_snapshot?.dataSufficiencyScore, 0)
  if (sufficiency >= 80) return '80+'
  if (sufficiency >= 60) return '60-79'
  if (sufficiency >= 40) return '40-59'
  return '<40'
}

function calibration(rows: PredictionRow[]) {
  return groupRows(
    rows.filter((row) => String(row.market) === 'moneyline' && ['win', 'loss'].includes(getResult(row))),
    (row) => {
      const probability = safeNumber(row.model_probability, 0)
      if (probability >= 80) return '80-100'
      if (probability >= 70) return '70-79'
      if (probability >= 60) return '60-69'
      if (probability >= 50) return '50-59'
      return '<50'
    }
  ).map(({ key, rows: bucketRows }) => ({
    bucket: key,
    sample: bucketRows.length,
    averageProbability: round(
      bucketRows.reduce((sum, row) => sum + safeNumber(row.model_probability, 0), 0) /
        Math.max(bucketRows.length, 1)
    ),
    actualWinRate: round(
      (bucketRows.filter((row) => getResult(row) === 'win').length /
        Math.max(bucketRows.length, 1)) *
        100
    ),
  }))
}

function brierScore(rows: PredictionRow[]) {
  const moneyline = rows.filter(
    (row) => String(row.market) === 'moneyline' && ['win', 'loss'].includes(getResult(row))
  )

  if (!moneyline.length) return null

  return round(
    moneyline.reduce((sum, row) => {
      const probability = safeNumber(row.model_probability, 0) / 100
      const actual = getResult(row) === 'win' ? 1 : 0
      return sum + Math.pow(probability - actual, 2)
    }, 0) / moneyline.length,
    4
  )
}

export async function getNbaPredictionPerformance() {
  const { data, error } = await supabaseAdmin
    .from('prediction_history')
    .select('*')
    .eq('sport_key', NBA_SPORT_KEY)
    .order('created_at', { ascending: false })
    .limit(5000)

  if (error) throw new Error(`Failed to load NBA performance: ${error.message}`)

  const rows = (data ?? []) as PredictionRow[]
  const overall = summarizeRows(rows)

  return {
    success: true,
    mode: 'nba_prediction_performance_v1',
    generatedAt: new Date().toISOString(),
    overall,
    brierScore: brierScore(rows),
    calibration: calibration(rows),
    byMarket: groupRows(rows, (row) => String(row.market ?? 'unknown')).map(({ key, rows }) => ({
      market: key,
      ...summarizeRows(rows),
    })),
    byConfidence: groupRows(rows, confidenceBucket).map(({ key, rows }) => ({
      bucket: key,
      ...summarizeRows(rows),
    })),
    byDataSufficiency: groupRows(rows, sufficiencyBucket).map(({ key, rows }) => ({
      bucket: key,
      ...summarizeRows(rows),
    })),
    warnings:
      overall.settled < 30
        ? ['NBA prediction sample is below 30 settled picks; treat ROI and calibration as directional.']
        : [],
  }
}

async function loadHealthRows() {
  const { data, error } = await supabaseAdmin
    .from('prediction_history')
    .select('*')
    .eq('sport_key', NBA_SPORT_KEY)
    .order('created_at', { ascending: false })
    .limit(5000)

  if (error) throw new Error(`Failed to load NBA model health rows: ${error.message}`)
  return (data ?? []) as PredictionRow[]
}

export async function getNbaSettlementBacklog() {
  const rows = await loadHealthRows()
  const pendingRows = rows.filter((row) => !isFinalResult(row.result) && row.lifecycle_status !== 'skipped')
  const eventIds = Array.from(new Set(pendingRows.map((row) => row.game_id)))

  const { data: events, error } = await supabaseAdmin
    .from('sport_events')
    .select('id, status, home_team, away_team, home_score, away_score, start_time')
    .eq('sport_key', NBA_SPORT_KEY)
    .in('id', eventIds.length ? eventIds : ['__empty__'])

  if (error) throw new Error(`Failed to load NBA backlog events: ${error.message}`)

  const eventsById = new Map((events ?? []).map((event) => [event.id, event as EventRow]))
  const backlog = pendingRows
    .map((row) => ({ row, event: eventsById.get(row.game_id) }))
    .filter(({ event }) => event?.status === 'completed' || event?.status === 'cancelled')
    .map(({ row, event }) => ({
      id: row.id,
      gameId: row.game_id,
      market: row.market,
      selection: row.team,
      sportsbook: row.sportsbook,
      line: row.line,
      eventStatus: event?.status ?? 'missing',
      commenceTime: row.commence_time,
      reason: event?.status === 'cancelled' ? 'ready_to_void' : 'ready_to_settle',
    }))

  return {
    success: true,
    mode: 'nba_prediction_settlement_backlog_v1',
    generatedAt: new Date().toISOString(),
    count: backlog.length,
    backlog,
  }
}

export async function getNbaModelHealthV2() {
  const [rows, backlog, injuryLineup] = await Promise.all([
    loadHealthRows(),
    getNbaSettlementBacklog(),
    getNbaInjuryLineupConfidenceStatus(),
  ])
  const issues: string[] = []
  const warnings: string[] = []

  const duplicateGroups = groupRows(rows, (row) =>
    [row.game_id, row.team, row.market, row.sportsbook].join('|')
  ).filter((group) => group.rows.length > 1)

  const missingModelVersion = rows.filter((row) => !row.model_version).length
  const missingFeatureSnapshot = rows.filter(
    (row) => !row.feature_snapshot || Object.keys(row.feature_snapshot).length === 0
  ).length
  const missingLine = rows.filter((row) => {
    const market = String(row.market ?? '')
    return ['spread', 'total', 'first_half', 'first_half_spread', 'first_half_total'].includes(market) &&
      row.line === null
  }).length
  const staleOdds = rows.filter((row) => {
    if (!row.odds_timestamp || !row.generated_at) return false
    const oddsAt = new Date(row.odds_timestamp).getTime()
    const generatedAt = new Date(row.generated_at).getTime()
    return generatedAt - oddsAt > 24 * 60 * 60 * 1000
  }).length
  const leakageRisk = rows.filter((row) => {
    if (!row.cutoff_at || !row.commence_time) return false
    return new Date(row.cutoff_at).getTime() >= new Date(row.commence_time).getTime()
  }).length
  const inconsistentSettlement = rows.filter((row) => {
    const result = getResult(row)
    return (
      ['win', 'loss', 'push', 'void'].includes(result) &&
      !['settled', 'void', 'closed'].includes(String(row.lifecycle_status ?? ''))
    )
  }).length

  if (missingModelVersion) issues.push(`${missingModelVersion} NBA predictions are missing model_version.`)
  if (missingFeatureSnapshot) issues.push(`${missingFeatureSnapshot} NBA predictions are missing feature snapshots.`)
  if (missingLine) issues.push(`${missingLine} NBA market predictions are missing line values.`)
  if (leakageRisk) issues.push(`${leakageRisk} NBA predictions have cutoff timestamps at or after event start.`)
  if (inconsistentSettlement) issues.push(`${inconsistentSettlement} settled NBA predictions have inconsistent lifecycle state.`)
  if (duplicateGroups.length) issues.push(`${duplicateGroups.length} duplicate NBA prediction keys were detected.`)
  if (backlog.count) warnings.push(`${backlog.count} completed or voidable NBA predictions are waiting for settlement.`)
  if (staleOdds) warnings.push(`${staleOdds} NBA predictions used odds older than 24 hours at generation time.`)
  if (injuryLineup.injuryFeed.stale) warnings.push('NBA injury feed is stale for Model Health V2.')
  if (injuryLineup.injuryFeed.unresolvedPlayerCount) {
    warnings.push(`${injuryLineup.injuryFeed.unresolvedPlayerCount} NBA injury rows have unresolved player mappings.`)
  }
  if (injuryLineup.injuryFeed.unresolvedTeamCount) {
    warnings.push(`${injuryLineup.injuryFeed.unresolvedTeamCount} NBA injury rows have unresolved team mappings.`)
  }
  if (injuryLineup.injuryFeed.trialCount > 0 && !injuryLineup.injuryFeed.productionEligible) {
    warnings.push('NBA injury coverage is trial/scrambled only and cannot improve production confidence.')
  }
  if (!injuryLineup.injuryFeed.providerConfigured) {
    issues.push('NBA injury provider coverage is missing.')
  }
  if (injuryLineup.injuryFeed.contradictoryStatusCount) {
    issues.push(`${injuryLineup.injuryFeed.contradictoryStatusCount} NBA players have contradictory injury statuses.`)
  }
  warnings.push(...injuryLineup.lineupFeed.warnings)

  const performance = summarizeRows(rows)
  if (performance.settled < 30) {
    warnings.push('Insufficient settled NBA sample for reliable health conclusions.')
  }

  return {
    success: true,
    mode: 'nba_model_health_v2',
    generatedAt: new Date().toISOString(),
    status: issues.length ? 'degraded' : warnings.length ? 'watch' : 'healthy',
    modelVersion: NBA_PREDICTION_MODEL_VERSION,
    issues,
    warnings,
    checks: {
      totalPredictions: rows.length,
      settlementBacklog: backlog.count,
      missingEventOrLine: missingLine,
      staleOdds,
      incompleteSnapshots: missingFeatureSnapshot,
      completedEventsWithoutSettlement: backlog.count,
      inconsistentSettlement,
      duplicateKeys: duplicateGroups.length,
      missingFirstHalfScores: backlog.backlog.filter((item) =>
        String(item.market ?? '').includes('first_half')
      ).length,
      missingModelVersion,
      leakageRisk,
      insufficientSample: performance.settled < 30,
      injuryFeedStale: injuryLineup.injuryFeed.stale,
      unresolvedInjuryPlayers: injuryLineup.injuryFeed.unresolvedPlayerCount,
      unresolvedInjuryTeams: injuryLineup.injuryFeed.unresolvedTeamCount,
      trialInjuryRows: injuryLineup.injuryFeed.trialCount,
      productionEligibleInjuryRows: injuryLineup.injuryFeed.productionEligibleInjuryCount,
      contradictoryInjuryStatuses: injuryLineup.injuryFeed.contradictoryStatusCount,
      injuryConfidencePenalty: injuryLineup.confidence.penalty,
    },
    performance,
    injuryLineup,
  }
}
