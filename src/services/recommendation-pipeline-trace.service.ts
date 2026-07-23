import 'server-only'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { getCurrentBoardCached } from '@/services/current-board.service'
import { getModelOnlyIntelligence } from '@/services/model-only-intelligence.service'
import { localDateInTimeZone, zonedUtcRange } from '@/services/provider-time-normalization.service'

const TIMEZONE = 'America/Puerto_Rico'
const SPORT_KEY = 'baseball_mlb'

type EventRow = {
  id: string
  start_time: string | null
  status: string | null
}

type PredictionRow = {
  id: string
  game_id: string | null
  generated_at: string | null
  result: string | null
  status: string | null
  recommended_pick: boolean | null
  model_role: string | null
  production_eligible: boolean | null
  trial: boolean | null
  scrambled: boolean | null
  settlement_details: Record<string, unknown> | null
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

function isProductionSettled(row: PredictionRow) {
  const result = lower(row.result ?? row.status)
  const lifecycle = lower((row.settlement_details?.settlement_reconciliation_v2 as Record<string, unknown> | undefined)?.lifecycle)
  if (row.trial || row.scrambled || lower(row.model_role).includes('shadow')) return false
  if (['legacy', 'ignored', 'historical', 'replay', 'shadow', 'cancelled', 'voided', 'unknown'].includes(lifecycle)) return false
  return ['win', 'loss', 'push'].includes(result)
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
    .select('id, start_time, status')
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
        .select('id, game_id, generated_at, result, status, recommended_pick, model_role, production_eligible, trial, scrambled, settlement_details')
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
  const counts = {
    gamesScheduled: events.length,
    gamesEligibleBeforeStart,
    oddsSnapshotsAvailable: oddsSnapshots.count,
    predictionsGenerated: predictions.length,
    currentBoardCandidates: board?.candidates.length ?? 0,
    modelOnlyRows: modelOnly?.summary.modelOutcomes ?? 0,
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

  return {
    label,
    date,
    timezone: TIMEZONE,
    counts,
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
    days: [today, yesterday],
  }
}
