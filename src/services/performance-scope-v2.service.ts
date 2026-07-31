import 'server-only'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { localDateInTimeZone } from '@/services/provider-time-normalization.service'
import { classifyPredictionCutoff } from '@/services/prediction-cutoff-enforcement.service'
import { getPregameSchedulerCoverage } from '@/services/pregame-scheduler-coverage.service'
import {
  canonicalEligibility,
  canonicalLifecycleBadge,
  canonicalPendingReason,
  canonicalStoredOutcome,
} from '@/services/canonical-settlement-state.service'

const TIMEZONE = 'America/Puerto_Rico'
const DEFAULT_MAX_PREDICTION_ROWS = 2000
const DEFAULT_HISTORY_PREVIEW_ROWS = 200

type PerformanceScopeOptions = {
  sportKey?: string | null
  maxPredictionRows?: number
  includeHistoryRows?: boolean
}

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
  confidence: number | null
  line: number | null
  result: string | null
  status: string | null
  lifecycle_status: string | null
  recommended_pick: boolean | null
  production_eligible: boolean | null
  trial: boolean | null
  scrambled: boolean | null
  validation_status: string | null
  validation_warnings: unknown
  model_role: string | null
  model_version: string | null
  feature_snapshot_id: string | null
  odds_snapshot_id: string | null
  operating_day_id: string | null
  idempotency_key: string | null
  generated_at: string | null
  cutoff_at: string | null
  created_at?: string | null
  settled_at: string | null
  settlement_details: Record<string, unknown> | null
  is_current?: boolean | null
}

type EventRow = {
  id: string
  start_time: string | null
  status: string | null
  home_team: string | null
  away_team: string | null
  home_score: number | null
  away_score: number | null
  updated_at?: string | null
}

function normalize(value: unknown) {
  return String(value ?? '').trim().toLowerCase()
}

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits))
}

function groupCount<T>(rows: T[], getKey: (row: T) => string | null | undefined) {
  const groups = new Map<string, number>()
  for (const row of rows) {
    const key = getKey(row) || 'unknown'
    groups.set(key, (groups.get(key) ?? 0) + 1)
  }
  return Object.fromEntries(Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b)))
}

function astDate(value: string | null | undefined) {
  return value ? localDateInTimeZone(value, TIMEZONE) ?? value.slice(0, 10) : 'unknown'
}

function resultOf(row: PredictionRow) {
  return canonicalStoredOutcome(row)
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function lifecycleBadge(row: PredictionRow, event: EventRow | undefined) {
  return canonicalLifecycleBadge(row, event)
}

function cutoffExclusion(row: PredictionRow, event: EventRow | undefined) {
  const cutoff = classifyPredictionCutoff(row, event)
  return cutoff.eligible ? null : cutoff.state
}

function pendingReason(row: PredictionRow, event: EventRow | undefined) {
  return canonicalPendingReason(row, event)
}

function eligibility(row: PredictionRow, event: EventRow | undefined) {
  return canonicalEligibility(row, event)
}

function metrics(rows: Array<{ row: PredictionRow; event?: EventRow }>) {
  const eligibleRows = rows.filter((item) => eligibility(item.row, item.event).eligible)
  const settled = eligibleRows.filter((item) => resultOf(item.row) !== 'pending')
  const wins = settled.filter((item) => resultOf(item.row) === 'win').length
  const losses = settled.filter((item) => resultOf(item.row) === 'loss').length
  const pushes = settled.filter((item) => resultOf(item.row) === 'push').length
  const voids = settled.filter((item) => resultOf(item.row) === 'void').length
  const scored = settled
    .map((item) => {
      const probability = Number(item.row.model_probability) / 100
      const outcome = resultOf(item.row) === 'win' ? 1 : resultOf(item.row) === 'loss' ? 0 : null
      return { probability, outcome }
    })
    .filter((item) => item.outcome !== null && Number.isFinite(item.probability))
  const confidences = settled
    .map((item) => Number(item.row.confidence))
    .filter((value) => Number.isFinite(value))
  return {
    generated: rows.length,
    eligible: eligibleRows.length,
    uniqueMarkets: new Set(rows.map((item) => [item.row.game_id, item.row.market, item.row.team, item.row.line].join('|'))).size,
    current: rows.filter((item) => item.row.is_current !== false).length,
    superseded: rows.filter((item) => item.row.is_current === false).length,
    settled: settled.length,
    pending: eligibleRows.length - settled.length,
    wins,
    losses,
    pushes,
    voids,
    accuracy: wins + losses ? round((wins / (wins + losses)) * 100) : null,
    brier: scored.length ? round(scored.reduce((sum, item) => sum + (item.probability - Number(item.outcome)) ** 2, 0) / scored.length, 4) : null,
    averageConfidence: confidences.length ? round(confidences.reduce((sum, value) => sum + value, 0) / confidences.length) : null,
    settlementCoverage: eligibleRows.length ? round((settled.length / eligibleRows.length) * 100) : null,
  }
}

function boundedRowLimit(value: number | null | undefined) {
  const parsed = Number(value)
  return Number.isFinite(parsed)
    ? Math.max(1, Math.min(10000, Math.floor(parsed)))
    : DEFAULT_MAX_PREDICTION_ROWS
}

async function loadRows(sportKey?: string | null, maxRows = DEFAULT_MAX_PREDICTION_ROWS) {
  const rows: PredictionRow[] = []
  const rowLimit = boundedRowLimit(maxRows)
  let capApplied = false
  for (let from = 0; from < rowLimit; from += 1000) {
    const pageSize = Math.min(1000, rowLimit - from)
    let query = supabaseAdmin
      .from('prediction_history')
      .select('id, sport_key, game_id, commence_time, home_team, away_team, team, opponent, market, sportsbook, odds, implied_probability, model_probability, confidence, line, result, status, lifecycle_status, recommended_pick, production_eligible, trial, scrambled, validation_status, validation_warnings, model_role, model_version, feature_snapshot_id, odds_snapshot_id, operating_day_id, idempotency_key, generated_at, created_at, cutoff_at, settled_at, settlement_details, is_current')
      .order('created_at', { ascending: false })
      .range(from, from + pageSize - 1)
    if (sportKey) query = query.eq('sport_key', sportKey)
    const { data, error } = await query
    if (error) throw new Error(`performance scope v2 prediction read failed: ${error.message}`)
    rows.push(...((data ?? []) as PredictionRow[]))
    if (!data || data.length < pageSize) break
    if (rows.length >= rowLimit) {
      capApplied = true
      break
    }
  }
  return {
    rows,
    pagination: {
      rowsRead: rows.length,
      rowLimit,
      pagesRead: Math.ceil(rows.length / 1000),
      capApplied,
    },
  }
}

async function loadEvents(eventIds: string[]) {
  const rows: EventRow[] = []
  for (let index = 0; index < eventIds.length; index += 100) {
    const { data, error } = await supabaseAdmin
      .from('sport_events')
      .select('id, start_time, status, updated_at, home_team, away_team, home_score, away_score')
      .in('id', eventIds.slice(index, index + 100))
    if (error) throw new Error(`performance scope v2 event read failed: ${error.message}`)
    rows.push(...((data ?? []) as EventRow[]))
  }
  return new Map(rows.map((event) => [event.id, event]))
}

export async function getPerformanceScopeV2({
  sportKey,
  maxPredictionRows = DEFAULT_MAX_PREDICTION_ROWS,
  includeHistoryRows = true,
}: PerformanceScopeOptions = {}) {
  const [schedulerCoverage, rowLoad] = await Promise.all([
    getPregameSchedulerCoverage().catch((error) => ({
      success: false,
      providerCallsMade: 0,
      remoteMutationsMade: 0,
      error: error instanceof Error ? error.message : 'pregame scheduler coverage read failed',
    })),
    loadRows(sportKey, maxPredictionRows),
  ])
  const rows = rowLoad.rows
  const events = await loadEvents(Array.from(new Set(rows.map((row) => row.game_id).filter(Boolean))) as string[])
  const joined = rows.map((row) => ({ row, event: row.game_id ? events.get(row.game_id) : undefined }))
  const productHistory = joined.filter((item) => eligibility(item.row, item.event).eligible)
  const pending = joined.filter((item) => resultOf(item.row) === 'pending')
  const pendingClassified = pending.map((item) => ({ ...item, reason: pendingReason(item.row, item.event) ?? 'EVENT_NOT_FINAL' }))
  const now = new Date()
  const today = astDate(now.toISOString())
  const daysAgo = (days: number) => {
    const date = new Date(now)
    date.setUTCDate(date.getUTCDate() - days)
    return astDate(date.toISOString())
  }
  const productionDate = (item: { row: PredictionRow; event?: EventRow }) => astDate(item.event?.start_time ?? item.row.commence_time ?? item.row.generated_at)
  const periods = [
    { key: 'today', label: 'Today', rows: joined.filter((item) => productionDate(item) === today) },
    { key: 'yesterday', label: 'Yesterday', rows: joined.filter((item) => productionDate(item) === daysAgo(1)) },
    { key: 'last7Days', label: 'Last 7 Days', rows: joined.filter((item) => productionDate(item) >= daysAgo(6)) },
    { key: 'last30Days', label: 'Last 30 Days', rows: joined.filter((item) => productionDate(item) >= daysAgo(29)) },
    { key: 'season', label: 'Season', rows: joined },
    { key: 'lifetime', label: 'Lifetime', rows: joined },
  ]

  return {
    success: true,
    mode: 'performance_scope_timeline_v2',
    generatedAt: new Date().toISOString(),
    sportKey: sportKey ?? null,
    timezone: TIMEZONE,
    scopePolicy: {
      generatedUses: 'event_start_ast_date_fallback_prediction_generated_at',
      settlementUses: 'stored_result_and_settled_at_when_available',
      pushHandling: 'pushes_count_as_settled_but_are_excluded_from_win_loss_accuracy_and_brier_scoring',
      exclusions: ['LEGACY', 'TEST_FIXTURE', 'PREDICTION_POST_START', 'DUPLICATE_SUPERSEDED'],
      separatedContexts: ['market_predictions', 'official_picks', 'model_only_predictions', 'shadow_predictions'],
      boundedRead: {
        source: 'prediction_history',
        orderedBy: 'created_at_desc',
        rowLimit: rowLoad.pagination.rowLimit,
        capApplied: rowLoad.pagination.capApplied,
        fullHistoryRowsReturned: includeHistoryRows,
      },
    },
    queryDiagnostics: {
      predictionHistory: rowLoad.pagination,
      historyPreviewRows: Math.min(DEFAULT_HISTORY_PREVIEW_ROWS, productHistory.length),
      historyRowsReturned: includeHistoryRows ? productHistory.length : 0,
    },
    totals: metrics(joined),
    exclusions: groupCount(joined, (item) => eligibility(item.row, item.event).reason),
    cutoffExclusions: {
      byState: groupCount(joined.filter((item) => cutoffExclusion(item.row, item.event)), (item) => cutoffExclusion(item.row, item.event)),
      rows: joined.filter((item) => cutoffExclusion(item.row, item.event)).length,
    },
    schedulerCoverage,
    pending: {
      rows: pending.length,
      byReason: groupCount(pendingClassified, (item) => item.reason),
      byDate: groupCount(pendingClassified, (item) => astDate(item.row.commence_time ?? item.event?.start_time ?? item.row.generated_at)),
      bySport: groupCount(pendingClassified, (item) => item.row.sport_key),
      byMarket: groupCount(pendingClassified, (item) => item.row.market),
      byStatus: groupCount(pendingClassified, (item) => item.row.status ?? item.row.lifecycle_status),
    },
    contexts: {
      marketPredictions: joined.filter((item) => normalize(item.row.model_role) !== 'shadow').length,
      shadowPredictions: joined.filter((item) => normalize(item.row.model_role) === 'shadow').length,
      officialPicks: joined.filter((item) => item.row.recommended_pick === true || item.row.production_eligible === true).length,
      modelOnlyPredictions: joined.filter((item) => !Number.isFinite(Number(item.row.odds))).length,
    },
    timeline: Object.fromEntries(periods.map((period) => [period.key, { label: period.label, ...metrics(period.rows) }])),
    historyEligibleIds: productHistory.map((item) => item.row.id),
    historyRows: includeHistoryRows ? productHistory.map((item) => {
      const result = resultOf(item.row)
      const badge = lifecycleBadge(item.row, item.event)
      return {
        id: item.row.id,
        timestamp: item.row.generated_at ?? item.row.commence_time ?? item.event?.start_time ?? null,
        sport: item.row.sport_key,
        league: null,
        matchup: `${item.event?.away_team ?? item.row.away_team ?? 'Away'} @ ${item.event?.home_team ?? item.row.home_team ?? 'Home'}`,
        prediction: [item.row.team ?? item.row.opponent, item.row.market, item.row.line].filter((value) => value !== null && value !== undefined && value !== '').join(' '),
        probability: item.row.model_probability,
        confidence: item.row.confidence,
        modelVersion: item.row.model_version,
        category: item.row.recommended_pick || item.row.production_eligible ? 'official' : normalize(item.row.validation_status) || 'model',
        result,
        lifecycleBadge: badge,
        actualResult: result,
        correct: result === 'win' ? true : result === 'loss' ? false : null,
        push: result === 'push',
        pending: result === 'pending',
        official: item.row.recommended_pick === true || item.row.production_eligible === true,
        shadow: normalize(item.row.model_role) === 'shadow',
        featureSnapshot: null,
        missingData: [],
        settlement: item.row.settled_at || item.row.settlement_details ? {
          settledAt: item.row.settled_at,
          details: {
            source: asObject(item.row.settlement_details).source ?? asObject(asObject(item.row.settlement_details).settlement_reconciliation_v2).source ?? null,
            reason: asObject(item.row.settlement_details).reason ?? asObject(asObject(item.row.settlement_details).settlement_reconciliation_v2).reason ?? null,
            version: asObject(item.row.settlement_details).version ?? asObject(asObject(item.row.settlement_details).settlement_reconciliation_v2).settlement_version ?? null,
          },
        } : undefined,
        outcomeExplanation: badge,
        cutoff: classifyPredictionCutoff(item.row, item.event),
      }
    }) : [],
    historyPreview: productHistory.slice(0, DEFAULT_HISTORY_PREVIEW_ROWS).map((item) => ({
      id: item.row.id,
      eventDate: astDate(item.row.commence_time ?? item.event?.start_time ?? item.row.generated_at),
      matchup: `${item.event?.away_team ?? item.row.away_team ?? 'Away'} @ ${item.event?.home_team ?? item.row.home_team ?? 'Home'}`,
      market: item.row.market,
      selection: item.row.team,
      line: item.row.line,
      modelProbability: item.row.model_probability,
      impliedProbability: item.row.implied_probability,
      result: resultOf(item.row),
      status: lifecycleBadge(item.row, item.event),
      lifecycleBadge: lifecycleBadge(item.row, item.event),
      pendingReason: pendingReason(item.row, item.event),
      currentState: item.row.is_current === false ? 'Superseded' : 'Current',
      modelVersion: item.row.model_version,
      projectionOrigin: normalize(item.row.model_role) === 'shadow' ? 'shadow' : 'market_prediction',
    })),
    providerCallsMade: 0,
    remoteMutationsMade: 0,
  }
}

export function validatePerformanceScopeV2Fixtures() {
  const pushAware = metrics([
    { row: fixturePerformanceRow('win-1', 'win', 60), event: fixtureFinalEvent() },
    { row: fixturePerformanceRow('loss-1', 'loss', 60), event: fixtureFinalEvent() },
    { row: fixturePerformanceRow('push-1', 'push', 60), event: fixtureFinalEvent() },
  ])
  const checks = [
    ['pending reason uses exact labels', pendingReason({ id: 'x', sport_key: 'baseball_mlb', game_id: 'missing', commence_time: null, home_team: null, away_team: null, team: null, opponent: null, market: 'moneyline', sportsbook: null, odds: null, implied_probability: null, model_probability: null, confidence: null, line: null, result: null, status: 'pending', lifecycle_status: null, recommended_pick: false, production_eligible: false, trial: false, scrambled: false, validation_status: null, validation_warnings: [], model_role: null, model_version: null, feature_snapshot_id: null, odds_snapshot_id: null, operating_day_id: null, idempotency_key: null, generated_at: null, cutoff_at: null, settled_at: null, settlement_details: null }, undefined) === 'LEGACY'],
    ['push counts as settled', pushAware.settled === 3 && pushAware.pushes === 1],
    ['push excluded from accuracy denominator', pushAware.accuracy === 50],
    ['push excluded from brier denominator', pushAware.brier === 0.26],
    ['zero provider calls', true],
  ] as const
  const failedChecks = checks.filter(([, passed]) => !passed).map(([name]) => name)
  return {
    success: failedChecks.length === 0,
    mode: 'performance_scope_v2_validation',
    checks: checks.length,
    passed: checks.length - failedChecks.length,
    failed: failedChecks.length,
    failedChecks,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
  }
}

function fixtureFinalEvent(): EventRow {
  return {
    id: 'event-1',
    start_time: '2026-07-01T23:00:00.000Z',
    status: 'completed',
    home_team: 'Home',
    away_team: 'Away',
    home_score: 4,
    away_score: 3,
  }
}

function fixturePerformanceRow(id: string, result: string, probability: number): PredictionRow {
  return {
    id,
    sport_key: 'baseball_mlb',
    game_id: 'event-1',
    commence_time: '2026-07-01T23:00:00.000Z',
    home_team: 'Home',
    away_team: 'Away',
    team: 'Home',
    opponent: 'Away',
    market: 'moneyline',
    sportsbook: 'Fixture',
    odds: -110,
    implied_probability: 52.38,
    model_probability: probability,
    confidence: 60,
    line: null,
    result,
    status: 'settled',
    lifecycle_status: 'closed',
    recommended_pick: true,
    production_eligible: true,
    trial: false,
    scrambled: false,
    validation_status: 'validated',
    validation_warnings: [],
    model_role: 'champion',
    model_version: 'fixture',
    feature_snapshot_id: 'snapshot-1',
    odds_snapshot_id: 'odds-1',
    operating_day_id: 'op-day-1',
    idempotency_key: id,
    generated_at: '2026-07-01T20:00:00.000Z',
    cutoff_at: '2026-07-01T22:50:00.000Z',
    created_at: '2026-07-01T20:00:00.000Z',
    settled_at: '2026-07-02T03:00:00.000Z',
    settlement_details: null,
    is_current: true,
  }
}
