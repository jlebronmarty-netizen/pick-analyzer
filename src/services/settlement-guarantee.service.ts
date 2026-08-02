import 'server-only'

import { supabaseAdmin } from '@/lib/supabase-admin'
import {
  canonicalPendingReason,
  classifyCanonicalSettlementState,
  type CanonicalEventLike,
  type CanonicalGameResultLike,
  type CanonicalPredictionLike,
} from '@/services/canonical-settlement-state.service'
import { getOperationsHealth } from '@/services/operations-health.service'
import { localDateInTimeZone, zonedUtcRange } from '@/services/provider-time-normalization.service'

const SPORT_KEY = 'baseball_mlb'
const TIMEZONE = 'America/Puerto_Rico'

type PredictionRow = CanonicalPredictionLike & {
  id: string
  game_id: string | null
  commence_time: string | null
  sport_key: string | null
  settled_at?: string | null
}

type EventRow = CanonicalEventLike & {
  id: string
}

type ResultRow = CanonicalGameResultLike & {
  id: string
  game_id: string | null
  status?: string | null
}

function localDate(offset = 0) {
  const now = new Date()
  now.setUTCDate(now.getUTCDate() + offset)
  return localDateInTimeZone(now.toISOString(), TIMEZONE) ?? now.toISOString().slice(0, 10)
}

function rangeForLookback(days: number) {
  const today = localDate(0)
  const startDay = new Date(`${today}T00:00:00.000Z`)
  startDay.setUTCDate(startDay.getUTCDate() - Math.max(1, days - 1))
  const startLocal = localDateInTimeZone(startDay.toISOString(), TIMEZONE) ?? today
  return {
    start: zonedUtcRange(startLocal, TIMEZONE).utcStart,
    end: zonedUtcRange(today, TIMEZONE).utcEndExclusive,
    startLocal,
    endLocal: today,
  }
}

function isCompletedEvent(event: EventRow | undefined) {
  if (!event) return false
  const status = String(event.status ?? '').toLowerCase()
  return ['completed', 'complete', 'final', 'closed'].includes(status) || (event.home_score !== null && event.away_score !== null)
}

function settlementState(row: PredictionRow, result: ResultRow | undefined, event: EventRow | undefined) {
  const classified = classifyCanonicalSettlementState(row, result ?? null, event)
  if (classified.storedTerminal) return 'SETTLED'
  if (classified.classification === 'STORED_PENDING_DETERMINISTIC_SETTLED') return 'READY_FOR_SETTLEMENT'
  const reason = canonicalPendingReason(row, event) ?? classified.deterministicReason ?? classified.classification
  return `BLOCKED:${reason}`
}

export async function getSettlementGuaranteeStatus({ lookbackDays = 2 }: { lookbackDays?: number } = {}) {
  const range = rangeForLookback(lookbackDays)
  const operationsHealth = await getOperationsHealth()
  const scheduler = operationsHealth.scheduler ?? null
  const healthDomains = operationsHealth.healthDomains ?? null
  const { data: predictions, error } = await supabaseAdmin
    .from('prediction_history')
    .select('id, sport_key, game_id, commence_time, generated_at, cutoff_at, home_team, away_team, team, opponent, market, line, result, status, lifecycle_status, settlement_details, settled_at, validation_warnings, model_role, trial, scrambled, production_eligible, feature_snapshot_id, feature_snapshot_key, feature_snapshot, odds_snapshot_id, operating_day_id, idempotency_key, model_version, is_current')
    .eq('sport_key', SPORT_KEY)
    .gte('commence_time', range.start)
    .lt('commence_time', range.end)
    .order('commence_time', { ascending: true })
    .limit(3000)
  if (error) throw new Error(`Settlement guarantee prediction read failed: ${error.message}`)

  const rows = (predictions ?? []) as PredictionRow[]
  const eventIds = Array.from(new Set(rows.map((row) => row.game_id).filter(Boolean))) as string[]
  const events: EventRow[] = []
  const results: ResultRow[] = []

  for (let index = 0; index < eventIds.length; index += 100) {
    const chunk = eventIds.slice(index, index + 100)
    const { data: eventRows, error: eventError } = await supabaseAdmin
      .from('sport_events')
      .select('id, start_time, status, home_team, away_team, home_score, away_score')
      .in('id', chunk)
    if (eventError) throw new Error(`Settlement guarantee event read failed: ${eventError.message}`)
    events.push(...((eventRows ?? []) as EventRow[]))

    const { data: resultRows, error: resultError } = await supabaseAdmin
      .from('game_results')
      .select('id, game_id, home_team, away_team, home_score, away_score')
      .in('game_id', chunk)
    if (resultError) throw new Error(`Settlement guarantee result read failed: ${resultError.message}`)
    results.push(...((resultRows ?? []) as ResultRow[]))
  }

  const eventsById = new Map(events.map((event) => [event.id, event]))
  const resultsByGameId = new Map(results.map((result) => [String(result.game_id), result]))
  const classified = rows.map((row) => {
    const event = row.game_id ? eventsById.get(row.game_id) : undefined
    const result = row.game_id ? resultsByGameId.get(row.game_id) : undefined
    const state = settlementState(row, result, event)
    const completedByResult = Boolean(result && result.home_score !== null && result.away_score !== null)
    return {
      predictionId: row.id,
      gameId: row.game_id,
      commenceTime: row.commence_time,
      completedGame: isCompletedEvent(event) || completedByResult,
      state,
      reason: state.startsWith('BLOCKED:') ? state.slice('BLOCKED:'.length) : null,
      classification: classifyCanonicalSettlementState(row, result ?? null, event).classification,
      performanceIncluded: classifyCanonicalSettlementState(row, result ?? null, event).performanceIncluded,
      learningIncluded: classifyCanonicalSettlementState(row, result ?? null, event).learningIncluded,
    }
  })

  const completedRows = classified.filter((row) => row.completedGame)
  const settled = completedRows.filter((row) => row.state === 'SETTLED')
  const ready = completedRows.filter((row) => row.state === 'READY_FOR_SETTLEMENT')
  const blocked = completedRows.filter((row) => row.state.startsWith('BLOCKED:'))
  const silentPending = completedRows.filter((row) => row.state !== 'SETTLED' && row.state !== 'READY_FOR_SETTLEMENT' && !row.reason)
  const blockedReasonCounts = blocked.reduce<Record<string, number>>((counts, row) => {
    const reason = row.reason ?? 'UNKNOWN'
    counts[reason] = (counts[reason] ?? 0) + 1
    return counts
  }, {})
  const schedulerLate = scheduler?.schedulerLate === true || scheduler?.schedulerCritical === true
  const actionRequiredReasons = [
    ready.length > 0 ? 'SETTLEMENT_READY_ROWS_REMAIN' : null,
    silentPending.length > 0 ? 'SILENT_PENDING_ROWS_REMAIN' : null,
    schedulerLate ? 'SCHEDULER_LATE_OR_CRITICAL' : null,
  ].filter(Boolean) as string[]
  const success = actionRequiredReasons.length === 0

  return {
    success,
    mode: 'settlement_guarantee_status_v1',
    generatedAt: new Date().toISOString(),
    sportKey: SPORT_KEY,
    timezone: TIMEZONE,
    range,
    checkedPredictions: rows.length,
    completedPredictionRows: completedRows.length,
    settledRows: settled.length,
    readyForSettlementRows: ready.length,
    blockedRows: blocked.length,
    silentPendingRows: silentPending.length,
    blockedReasonCounts,
    oldestReadyForSettlement: ready.map((row) => row.commenceTime).filter(Boolean).sort()[0] ?? null,
    schedulerHealth: scheduler ? {
      status: operationsHealth.status,
      configured: scheduler.configured,
      lastSuccessfulProtectedInvocationAt: scheduler.lastSuccessfulProtectedInvocationAt,
      lastExternalSchedulerInvocationAt: scheduler.lastExternalSchedulerInvocationAt,
      lastSchedulerRun: scheduler.lastSchedulerRun,
      lastSchedulerSuccess: scheduler.lastSchedulerSuccess,
      expectedSchedulerIntervalMinutes: scheduler.expectedSchedulerIntervalMinutes,
      schedulerGraceMinutes: scheduler.schedulerGraceMinutes,
      missedSchedulerIntervals: scheduler.missedSchedulerIntervals,
      schedulerCadenceStatus: scheduler.schedulerCadenceStatus,
      nextExpectedSchedulerWindow: scheduler.nextExpectedSchedulerWindow,
      schedulerLate: scheduler.schedulerLate,
      schedulerCritical: scheduler.schedulerCritical,
      externalSchedulerVerified: scheduler.externalSchedulerVerified,
    } : null,
    healthDomains: healthDomains ? {
      schedulerExecution: healthDomains.schedulerExecution,
      marketFreshness: healthDomains.marketFreshness,
      providerBudget: healthDomains.providerBudget,
      settlementClosure: {
        ...healthDomains.settlementClosure,
        evidence: {
          ...healthDomains.settlementClosure.evidence,
          completedPredictionRows: completedRows.length,
          settledRows: settled.length,
          readyForSettlementRows: ready.length,
          blockedRows: blocked.length,
          silentPendingRows: silentPending.length,
        },
      },
      productReadiness: healthDomains.productReadiness,
      overall: healthDomains.overall,
    } : null,
    independentDomainSummary: healthDomains ? {
      schedulerExecution: healthDomains.schedulerExecution.status,
      marketFreshness: healthDomains.marketFreshness.status,
      providerBudget: healthDomains.providerBudget.status,
      settlementClosure: ready.length > 0 || silentPending.length > 0 ? 'CRITICAL' : healthDomains.settlementClosure.status,
      productReadiness: healthDomains.productReadiness.status,
      actionRequiredCausedBy: actionRequiredReasons,
    } : null,
    actionRequiredReasons,
    readyForSettlement: ready.slice(0, 25),
    blockedWithReason: blocked.slice(0, 25),
    guarantee: success ? 'PASS' : 'ACTION_REQUIRED',
    learningFlow: {
      source: 'prediction_history_settlement_derived_read_only_queue_v1',
      automaticModelTraining: false,
      settledRowsAvailableForLearning: settled.filter((row) => row.learningIncluded).length,
    },
    performanceFlow: {
      source: 'performance_scope_v2',
      settledRowsAvailableForPerformance: settled.filter((row) => row.performanceIncluded).length,
    },
    providerCallsMade: 0,
    remoteMutationsMade: 0,
  }
}

export function validateSettlementGuaranteeFixtures() {
  const settled: PredictionRow = {
    id: 'settled-1',
    sport_key: SPORT_KEY,
    game_id: 'event-1',
    commence_time: '2026-07-30T23:00:00.000Z',
    generated_at: '2026-07-30T20:00:00.000Z',
    cutoff_at: '2026-07-30T22:55:00.000Z',
    team: 'Home',
    market: 'moneyline',
    result: 'win',
    status: 'win',
    lifecycle_status: null,
    settlement_details: null,
    settled_at: '2026-07-31T03:00:00.000Z',
    validation_warnings: [],
    model_role: null,
    trial: false,
    scrambled: false,
    production_eligible: true,
    feature_snapshot_id: 'snapshot-1',
    feature_snapshot_key: null,
    feature_snapshot: null,
    odds_snapshot_id: 'odds-1',
    operating_day_id: 'day-1',
    idempotency_key: 'key-1',
    model_version: 'v1',
    is_current: true,
  }
  const pending = { ...settled, id: 'pending-1', result: null, status: 'pending', settled_at: null }
  const unsupported = { ...pending, id: 'blocked-1', market: 'pitcher_props' }
  const event: EventRow = { id: 'event-1', start_time: '2026-07-30T23:00:00.000Z', status: 'completed', home_team: 'Home', away_team: 'Away', home_score: 5, away_score: 3 }
  const result: ResultRow = { id: 'result-1', game_id: 'event-1', status: 'final', home_team: 'Home', away_team: 'Away', home_score: 5, away_score: 3 }
  const checks = [
    ['settled row classified settled', settlementState(settled, result, event) === 'SETTLED'],
    ['pending supported completed row becomes ready', settlementState(pending, result, event) === 'READY_FOR_SETTLEMENT'],
    ['unsupported completed row is blocked with reason', settlementState(unsupported, result, event).startsWith('BLOCKED:')],
  ] as const
  const failedChecks = checks.filter(([, pass]) => !pass).map(([name]) => name)
  return {
    success: failedChecks.length === 0,
    mode: 'settlement_guarantee_validation_v1',
    checks: checks.length,
    passed: checks.length - failedChecks.length,
    failed: failedChecks.length,
    failedChecks,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
  }
}
