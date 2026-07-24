import 'server-only'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { getCurrentBoardCached } from '@/services/current-board.service'
import { getModelOnlyIntelligence } from '@/services/model-only-intelligence.service'
import { localDateInTimeZone, zonedUtcRange } from '@/services/provider-time-normalization.service'
import { classifyPredictionCutoff } from '@/services/prediction-cutoff-enforcement.service'

const TIMEZONE = 'America/Puerto_Rico'
const SPORT_KEY = 'baseball_mlb'

type EventRow = {
  id: string
  start_time: string | null
  status: string | null
  home_team?: string | null
  away_team?: string | null
  home_score?: number | null
  away_score?: number | null
  updated_at?: string | null
}

type PredictionRow = {
  id: string
  game_id: string | null
  commence_time?: string | null
  generated_at: string | null
  created_at?: string | null
  cutoff_at?: string | null
  market?: string | null
  odds_snapshot_id?: string | null
  feature_snapshot_id?: string | null
  feature_snapshot_key?: string | null
  feature_snapshot?: Record<string, unknown> | null
  result: string | null
  status: string | null
  recommended_pick: boolean | null
  model_role: string | null
  production_eligible: boolean | null
  trial: boolean | null
  scrambled: boolean | null
  settlement_details: Record<string, unknown> | null
  settled_at?: string | null
}

function astDate(value: string) {
  return localDateInTimeZone(value, TIMEZONE) ?? value.slice(0, 10)
}

function dateForOffset(days: number) {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() - days)
  return astDate(date.toISOString())
}

function lower(value: unknown) {
  return String(value ?? '').toLowerCase()
}

function isFinal(status: string | null) {
  return ['completed', 'final', 'closed'].includes(lower(status))
}

function hasFeatureEvidence(row: PredictionRow) {
  return Boolean(
    row.feature_snapshot_id ||
      row.feature_snapshot_key ||
      (row.feature_snapshot && Object.keys(row.feature_snapshot).length > 0)
  )
}

function isProductionSettled(row: PredictionRow) {
  const result = lower(row.result ?? row.status)
  const lifecycle = lower((row.settlement_details?.settlement_reconciliation_v2 as Record<string, unknown> | undefined)?.lifecycle)
  if (row.trial || row.scrambled || lower(row.model_role).includes('shadow')) return false
  if (['legacy', 'ignored', 'historical', 'replay', 'shadow', 'cancelled', 'voided', 'unknown'].includes(lifecycle)) return false
  if (!classifyPredictionCutoff(row).eligible) return false
  return ['win', 'loss', 'push'].includes(result)
}

function predictionBeforeStart(row: PredictionRow, event: EventRow) {
  const generated = Date.parse(row.generated_at ?? '')
  const start = Date.parse(event.start_time ?? row.commence_time ?? '')
  return Number.isFinite(generated) && Number.isFinite(start) && generated < start
}

function predictionBeforeCutoff(row: PredictionRow, event: EventRow) {
  const generated = Date.parse(row.generated_at ?? '')
  const cutoff = Date.parse(row.cutoff_at ?? event.start_time ?? '')
  return Number.isFinite(generated) && Number.isFinite(cutoff) && generated <= cutoff
}

function missedReason(input: {
  event: EventRow
  odds: number
  predictions: PredictionRow[]
  boardCandidates: number
}) {
  if (input.predictions.length > 0) return null
  if (!input.odds) return 'ODDS_UNAVAILABLE'
  const start = Date.parse(input.event.start_time ?? '')
  if (Number.isFinite(start) && start <= Date.now()) return 'SCHEDULER_MISSED_WINDOW'
  if (!input.boardCandidates) return 'NO_ELIGIBLE_MARKET'
  return 'PREDICTION_NOT_DUE'
}

function reasons(counts: Record<string, number>) {
  const result: string[] = []
  if (!counts.gamesScheduled) result.push('NO_SCHEDULED_GAMES')
  if (counts.gamesScheduled && !counts.gamesEligibleBeforeStart) result.push('EVENT_ALREADY_STARTED')
  if (!counts.oddsSnapshotsAvailable) result.push('ODDS_NOT_AVAILABLE')
  if (!counts.predictionsGenerated) result.push('PREDICTION_NOT_DUE')
  if (!counts.currentBoardCandidates) result.push('NO_ELIGIBLE_MARKET')
  if (!counts.bestValue) result.push('NO_POSITIVE_EV')
  if (!counts.officialPicks) result.push('OFFICIAL_POLICY_NOT_MET')
  if (counts.gamesScheduled && !counts.gamesCompleted) result.push('RESULT_NOT_FINAL')
  if (!counts.learningSamplesQueued) result.push('NO_LEARNING_LABEL')
  if (!counts.weightUpdates) result.push('LEARNING_NOT_RUN')
  return Array.from(new Set(result))
}

async function safeCount(table: string, build: (query: any) => any) {
  try {
    const { count, error } = await build(supabaseAdmin.from(table).select('*', { count: 'exact', head: true }))
    if (error) return { count: 0, error: error.message }
    return { count: count ?? 0, error: null }
  } catch (error) {
    return { count: 0, error: error instanceof Error ? error.message : `${table} unavailable` }
  }
}

async function traceDay(label: 'Today' | 'Yesterday', date: string) {
  const range = zonedUtcRange(date, TIMEZONE)
  const { data: eventsData, error: eventsError } = await supabaseAdmin
    .from('sport_events')
    .select('id, start_time, status, home_team, away_team, home_score, away_score, updated_at')
    .eq('sport_key', SPORT_KEY)
    .gte('start_time', range.utcStart)
    .lt('start_time', range.utcEndExclusive)

  const events = ((eventsData ?? []) as EventRow[])
  const eventIds = events.map((event) => event.id)
  const nowMs = Date.now()
  const gamesEligibleBeforeStart = events.filter((event) => {
    const startMs = Date.parse(event.start_time ?? '')
    return Number.isFinite(startMs) && startMs > nowMs && !isFinal(event.status)
  }).length

  const oddsSnapshots = eventIds.length
    ? await safeCount('sports_odds_snapshots', (query) => query.in('event_id', eventIds))
    : { count: 0, error: null }

  const predictionsResult = eventIds.length
    ? await supabaseAdmin
        .from('prediction_history')
        .select('id, game_id, commence_time, generated_at, created_at, cutoff_at, market, odds_snapshot_id, feature_snapshot_id, feature_snapshot_key, feature_snapshot, result, status, recommended_pick, model_role, production_eligible, trial, scrambled, settlement_details, settled_at')
        .in('game_id', eventIds)
    : { data: [], error: null }
  const predictions = ((predictionsResult.data ?? []) as PredictionRow[])

  const board = label === 'Today'
    ? await getCurrentBoardCached(SPORT_KEY, 'CURRENT', 200).catch(() => null)
    : null
  const modelOnly = label === 'Today'
    ? await getModelOnlyIntelligence({ date }).catch(() => null)
    : null

  const learningAccepted = await safeCount('ai_performance_snapshots', (query) => query.eq('snapshot_date', date))
  const weightUpdates = await safeCount('model_weight_history', (query) => query.gte('created_at', range.utcStart).lt('created_at', range.utcEndExclusive))

  const boardCandidates = board?.candidates ?? []
  const boardByEvent = new Map<string, any[]>()
  for (const candidate of boardCandidates as any[]) {
    const id = String(candidate.eventId ?? candidate.gameId ?? '')
    if (!id) continue
    boardByEvent.set(id, [...(boardByEvent.get(id) ?? []), candidate])
  }
  const oddsByEvent = new Map<string, number>()
  if (eventIds.length) {
    const { data: oddsRows } = await supabaseAdmin
      .from('sports_odds_snapshots')
      .select('event_id')
      .in('event_id', eventIds)
      .limit(5000)
    for (const row of (oddsRows ?? []) as Array<{ event_id: string | null }>) {
      if (!row.event_id) continue
      oddsByEvent.set(row.event_id, (oddsByEvent.get(row.event_id) ?? 0) + 1)
    }
  }
  const predictionsByEvent = new Map<string, PredictionRow[]>()
  for (const prediction of predictions) {
    const id = String(prediction.game_id ?? '')
    if (!id) continue
    predictionsByEvent.set(id, [...(predictionsByEvent.get(id) ?? []), prediction])
  }
  const gameLifecycles = events.map((event) => {
    const eventPredictions = predictionsByEvent.get(event.id) ?? []
    const eventBoard = boardByEvent.get(event.id) ?? []
    const settled = eventPredictions.filter(isProductionSettled)
    const cutoffClassifications = eventPredictions.map((row) => classifyPredictionCutoff(row, event))
    const validPregame = cutoffClassifications.filter((item) => item.eligible).length
    const excludedAfterCutoff = cutoffClassifications.length - validPregame
    const learningAccepted = settled.filter(hasFeatureEvidence)
    const learningRejected = settled.filter((row) => !hasFeatureEvidence(row))
    const beforeStart = eventPredictions.filter((row) => predictionBeforeStart(row, event)).length
    const beforeCutoff = eventPredictions.filter((row) => predictionBeforeCutoff(row, event)).length
    const odds = oddsByEvent.get(event.id) ?? 0
    const reason = missedReason({ event, odds, predictions: eventPredictions, boardCandidates: eventBoard.length })
    return {
      eventId: event.id,
      matchup: `${event.away_team ?? 'Away'} @ ${event.home_team ?? 'Home'}`,
      startTime: event.start_time,
      status: event.status,
      gameDetected: true,
      oddsAvailable: odds > 0,
      oddsSnapshots: odds,
      predictionGenerated: eventPredictions.length > 0,
      predictionsPersisted: eventPredictions.length,
      predictionsValidPregame: validPregame,
      predictionsExcludedAfterCutoff: excludedAfterCutoff,
      cutoffStates: cutoffClassifications.reduce<Record<string, number>>((acc, item) => {
        acc[item.state] = (acc[item.state] ?? 0) + 1
        return acc
      }, {}),
      predictionTimestamp: eventPredictions.map((row) => row.generated_at).filter(Boolean).sort()[0] ?? null,
      predictionBeforeStart: eventPredictions.length ? beforeStart === eventPredictions.length : null,
      predictionBeforeCutoff: eventPredictions.length ? beforeCutoff === eventPredictions.length : null,
      currentBoardClassification: eventBoard[0]?.marketIntelligenceCategory ?? eventBoard[0]?.recommendationPolicyStatus ?? null,
      mostLikelyEligible: eventPredictions.length > 0 || eventBoard.length > 0,
      bestValueEligible: eventBoard.some((candidate) => Number(candidate.expectedValue ?? 0) > 0 && Number(candidate.edge ?? 0) > 0),
      officialPickEligible: eventPredictions.some((row) => row.recommended_pick === true || row.production_eligible === true) || eventBoard.some((candidate) => candidate.officialEligibility === 'OFFICIAL_ELIGIBLE_CANDIDATE'),
      gameFinal: isFinal(event.status) || (event.home_score !== null && event.away_score !== null),
      settlementCompleted: settled.length,
      learningLabel: settled.length,
      learningAccepted: learningAccepted.length,
      learningRejected: learningRejected.length,
      learningSkipped: 0,
      learningDecisionReason: settled.length
        ? learningRejected.length
          ? 'FEATURE_SNAPSHOT_MISSING'
          : 'DETERMINISTIC_LABEL_AND_FEATURE_EVIDENCE_ACCEPTED'
        : eventPredictions.length
          ? 'RESULT_NOT_FINAL_OR_NOT_SETTLED'
          : reason,
      missedReason: reason,
    }
  })
  const gamesPredicted = gameLifecycles.filter((game) => game.predictionGenerated).length
  const predictionsValidPregame = gameLifecycles.reduce((sum, game) => sum + game.predictionsValidPregame, 0)
  const predictionsExcludedAfterCutoff = gameLifecycles.reduce((sum, game) => sum + game.predictionsExcludedAfterCutoff, 0)
  const gamesSettled = gameLifecycles.filter((game) => game.settlementCompleted > 0).length
  const gamesLearned = gameLifecycles.filter((game) => game.learningAccepted + game.learningRejected + game.learningSkipped > 0).length
  const gamesMissed = gameLifecycles.filter((game) => !game.predictionGenerated).length
  const missReasons = gameLifecycles.reduce<Record<string, number>>((acc, game) => {
    if (game.missedReason) acc[game.missedReason] = (acc[game.missedReason] ?? 0) + 1
    return acc
  }, {})
  const counts = {
    gamesScheduled: events.length,
    gamesEligibleBeforeStart,
    oddsSnapshotsAvailable: oddsSnapshots.count,
    predictionsGenerated: predictions.length,
    predictionsValidPregame,
    predictionsExcludedAfterCutoff,
    currentBoardCandidates: board?.candidates?.length ?? 0,
    modelOnlyRows: modelOnly?.summary?.modelOutcomes ?? 0,
    aiLeans: boardCandidates.filter((candidate: any) => /LEAN|QUALIFIED|PREVIEW/i.test(String(candidate.recommendationPolicyStatus ?? candidate.semanticLabel ?? ''))).length,
    watchlist: boardCandidates.filter((candidate: any) => /WATCH/i.test(String(candidate.recommendationPolicyStatus ?? candidate.semanticLabel ?? ''))).length,
    bestValue: boardCandidates.filter((candidate: any) => Number(candidate.expectedValue ?? 0) > 0 && Number(candidate.edge ?? 0) > 0).length,
    officialPicks: board?.officialPickCount ?? predictions.filter((row) => row.recommended_pick === true || row.production_eligible === true).length,
    gamesCompleted: events.filter((event) => isFinal(event.status)).length,
    productionPredictionsSettled: predictions.filter(isProductionSettled).length,
    learningSamplesQueued: predictions.filter(isProductionSettled).length,
    learningSamplesAccepted: learningAccepted.count,
    learningSamplesRejected: Math.max(0, predictions.filter(isProductionSettled).length - learningAccepted.count),
    weightUpdates: weightUpdates.count,
  }
  const coverage = {
    gamesDetected: events.length,
    gamesPredicted,
    gamesSettled,
    gamesLearned,
    gamesMissed,
    predictionsValidPregame,
    predictionsExcludedAfterCutoff,
    missReasons,
    predictionCoveragePct: events.length ? Number(((gamesPredicted / events.length) * 100).toFixed(2)) : null,
    settlementCoveragePct: events.length ? Number(((gamesSettled / events.length) * 100).toFixed(2)) : null,
    learningDecisionCoveragePct: events.length ? Number(((gamesLearned / events.length) * 100).toFixed(2)) : null,
    noPostStartPredictions: gameLifecycles.every((game) => game.predictionBeforeStart !== false),
    noPostFinalPredictions: predictions.every((row) => {
      const event = events.find((item) => item.id === row.game_id)
      if (!event || !isFinal(event.status)) return true
      const generated = Date.parse(row.generated_at ?? '')
      const start = Date.parse(event.start_time ?? '')
      return Number.isFinite(generated) && Number.isFinite(start) ? generated < start : true
    }),
  }

  return {
    label,
    date,
    timezone: TIMEZONE,
    counts,
    coverage,
    gameLifecycles,
    zeroReasonCodes: reasons(counts),
    evidence: {
      scheduleReadError: eventsError?.message ?? null,
      oddsReadError: oddsSnapshots.error,
      predictionReadError: predictionsResult.error?.message ?? null,
      learningReadError: learningAccepted.error,
      weightReadError: weightUpdates.error,
      modelOnlyDateSelectionReason: modelOnly?.dateSelectionReason ?? null,
      modelOnlyZeroReasons: modelOnly?.zeroReasons ?? [],
    },
  }
}

export async function getRecommendationPipelineTrace() {
  const [today, yesterday] = await Promise.all([
    traceDay('Today', dateForOffset(0)),
    traceDay('Yesterday', dateForOffset(1)),
  ])
  return {
    success: true,
    mode: 'recommendation_pipeline_trace_v1',
    generatedAt: new Date().toISOString(),
    readOnly: true,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
    today,
    yesterday,
    days: [today, yesterday],
  }
}
