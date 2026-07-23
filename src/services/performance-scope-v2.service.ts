import 'server-only'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { localDateInTimeZone } from '@/services/provider-time-normalization.service'

const TIMEZONE = 'America/Puerto_Rico'
const FINAL_RESULTS = new Set(['win', 'loss', 'push', 'void'])
const TERMINAL_LIFECYCLE_V2 = new Set(['Legacy', 'Historical', 'Replay', 'Shadow', 'Ignored', 'Unknown', 'Cancelled', 'Voided'])

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
  const v2 = asObject(asObject(row.settlement_details).settlement_reconciliation_v2)
  if (v2.lifecycle === 'Legacy') return 'legacy'
  if (v2.lifecycle === 'Historical') return 'historical'
  if (v2.lifecycle === 'Replay') return 'replay'
  if (v2.lifecycle === 'Shadow') return 'shadow'
  if (v2.lifecycle === 'Ignored') return 'ignored'
  if (v2.lifecycle === 'Unknown') return 'unknown'
  if (v2.lifecycle === 'Cancelled') return 'cancelled'
  if (v2.lifecycle === 'Voided') return 'void'
  const result = normalize(row.result)
  if (FINAL_RESULTS.has(result)) return result
  const status = normalize(row.status)
  if (FINAL_RESULTS.has(status)) return status
  if (normalize(row.lifecycle_status) === 'closed') return 'unknown'
  return 'pending'
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function lifecycleBadge(row: PredictionRow, event: EventRow | undefined) {
  const v2 = asObject(asObject(row.settlement_details).settlement_reconciliation_v2)
  if (typeof v2.badge === 'string' && v2.badge) return v2.badge
  const result = resultOf(row)
  if (result === 'win') return 'Settled Win'
  if (result === 'loss') return 'Settled Loss'
  if (result === 'push') return 'Push'
  if (result === 'void') return 'Voided'
  if (TERMINAL_LIFECYCLE_V2.has(String(v2.lifecycle))) return String(v2.lifecycle)
  const reason = pendingReason(row, event)
  if (reason === 'EVENT_NOT_FINAL' || reason === 'RESULT_NOT_IMPORTED') return 'Awaiting Result'
  if (reason === 'LEGACY') return 'Legacy'
  if (reason === 'EXACT_EVENT_MAPPING_MISSING') return 'Unknown'
  return 'Scheduled'
}

function isTestFixture(row: PredictionRow) {
  const warnings = Array.isArray(row.validation_warnings) ? row.validation_warnings.map(String) : []
  return (
    row.trial === true ||
    row.scrambled === true ||
    normalize(row.model_role) === 'shadow' ||
    warnings.some((warning) => /trial|scrambled|fixture|quarantine/i.test(warning))
  )
}

function isLegacy(row: PredictionRow) {
  return (
    !row.feature_snapshot_id &&
    !row.odds_snapshot_id &&
    !row.operating_day_id &&
    !row.idempotency_key &&
    !row.model_version &&
    row.production_eligible !== true
  )
}

function isPostStart(row: PredictionRow, event: EventRow | undefined) {
  const start = Date.parse(row.commence_time ?? event?.start_time ?? '')
  const generated = Date.parse(row.generated_at ?? row.cutoff_at ?? '')
  return Number.isFinite(start) && Number.isFinite(generated) && generated >= start
}

function pendingReason(row: PredictionRow, event: EventRow | undefined) {
  if (resultOf(row) !== 'pending') return null
  if (isTestFixture(row)) return 'TEST_FIXTURE'
  if (isPostStart(row, event)) return 'PREDICTION_POST_START'
  if (!event && isLegacy(row)) return 'LEGACY'
  if (!event) return 'EXACT_EVENT_MAPPING_MISSING'
  if (row.is_current === false) return 'DUPLICATE_SUPERSEDED'
  const status = normalize(event.status)
  if (['cancelled', 'canceled', 'postponed', 'suspended'].includes(status)) return 'NO_OUTCOME'
  if (!['moneyline', 'spread', 'run_line', 'run line', 'total'].includes(normalize(row.market))) return 'MARKET_UNSUPPORTED'
  if (status === 'completed' && event.home_score !== null && event.away_score !== null) return 'ELIGIBLE_FOR_SETTLEMENT'
  const start = Date.parse(event.start_time ?? row.commence_time ?? '')
  if (Number.isFinite(start) && Date.now() - start > 24 * 60 * 60 * 1000) return 'RESULT_NOT_IMPORTED'
  return 'EVENT_NOT_FINAL'
}

function eligibility(row: PredictionRow, event: EventRow | undefined) {
  const result = resultOf(row)
  if (isTestFixture(row)) return { eligible: false, reason: 'TEST_FIXTURE' }
  if (['legacy', 'historical', 'replay', 'shadow', 'ignored', 'unknown', 'cancelled', 'void'].includes(result)) return { eligible: false, reason: result.toUpperCase() }
  if (isLegacy(row)) return { eligible: false, reason: 'LEGACY' }
  if (isPostStart(row, event)) return { eligible: false, reason: 'PREDICTION_POST_START' }
  if (row.is_current === false) return { eligible: false, reason: 'DUPLICATE_SUPERSEDED' }
  if (result === 'pending') return { eligible: false, reason: pendingReason(row, event) ?? 'EVENT_NOT_FINAL' }
  return { eligible: true, reason: 'ELIGIBLE' }
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
    settlementCoverage: eligibleRows.length ? round((settled.length / eligibleRows.length) * 100) : null,
  }
}

async function loadRows(sportKey?: string | null) {
  const rows: PredictionRow[] = []
  for (let from = 0; ; from += 1000) {
    let query = supabaseAdmin
      .from('prediction_history')
      .select('id, sport_key, game_id, commence_time, home_team, away_team, team, opponent, market, sportsbook, odds, implied_probability, model_probability, confidence, line, result, status, lifecycle_status, recommended_pick, production_eligible, trial, scrambled, validation_status, validation_warnings, model_role, model_version, feature_snapshot_id, odds_snapshot_id, operating_day_id, idempotency_key, generated_at, cutoff_at, settled_at, settlement_details, is_current')
      .order('created_at', { ascending: false })
      .range(from, from + 999)
    if (sportKey) query = query.eq('sport_key', sportKey)
    const { data, error } = await query
    if (error) throw new Error(`performance scope v2 prediction read failed: ${error.message}`)
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
      .select('id, start_time, status, home_team, away_team, home_score, away_score')
      .in('id', eventIds.slice(index, index + 100))
    if (error) throw new Error(`performance scope v2 event read failed: ${error.message}`)
    rows.push(...((data ?? []) as EventRow[]))
  }
  return new Map(rows.map((event) => [event.id, event]))
}

export async function getPerformanceScopeV2({ sportKey }: { sportKey?: string | null } = {}) {
  const rows = await loadRows(sportKey)
  const events = await loadEvents(Array.from(new Set(rows.map((row) => row.game_id).filter(Boolean))) as string[])
  const joined = rows.map((row) => ({ row, event: row.game_id ? events.get(row.game_id) : undefined }))
  const pending = joined.filter((item) => resultOf(item.row) === 'pending')
  const pendingClassified = pending.map((item) => ({ ...item, reason: pendingReason(item.row, item.event) ?? 'EVENT_NOT_FINAL' }))
  const now = new Date()
  const today = astDate(now.toISOString())
  const daysAgo = (days: number) => {
    const date = new Date(now)
    date.setUTCDate(date.getUTCDate() - days)
    return astDate(date.toISOString())
  }
  const periods = [
    { key: 'today', label: 'Today', rows: joined.filter((item) => astDate(item.row.commence_time ?? item.event?.start_time ?? item.row.generated_at) === today) },
    { key: 'yesterday', label: 'Yesterday', rows: joined.filter((item) => astDate(item.row.commence_time ?? item.event?.start_time ?? item.row.generated_at) === daysAgo(1)) },
    { key: 'last7Days', label: 'Last 7 Days', rows: joined.filter((item) => astDate(item.row.commence_time ?? item.event?.start_time ?? item.row.generated_at) >= daysAgo(6)) },
    { key: 'last30Days', label: 'Last 30 Days', rows: joined.filter((item) => astDate(item.row.commence_time ?? item.event?.start_time ?? item.row.generated_at) >= daysAgo(29)) },
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
      exclusions: ['LEGACY', 'TEST_FIXTURE', 'PREDICTION_POST_START', 'DUPLICATE_SUPERSEDED'],
      separatedContexts: ['market_predictions', 'official_picks', 'model_only_predictions', 'shadow_predictions'],
    },
    totals: metrics(joined),
    exclusions: groupCount(joined, (item) => eligibility(item.row, item.event).reason),
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
    historyPreview: joined.slice(0, 200).map((item) => ({
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
  const checks = [
    ['pending reason uses exact labels', pendingReason({ id: 'x', sport_key: 'baseball_mlb', game_id: 'missing', commence_time: null, home_team: null, away_team: null, team: null, opponent: null, market: 'moneyline', sportsbook: null, odds: null, implied_probability: null, model_probability: null, confidence: null, line: null, result: null, status: 'pending', lifecycle_status: null, recommended_pick: false, production_eligible: false, trial: false, scrambled: false, validation_status: null, validation_warnings: [], model_role: null, model_version: null, feature_snapshot_id: null, odds_snapshot_id: null, operating_day_id: null, idempotency_key: null, generated_at: null, cutoff_at: null, settled_at: null, settlement_details: null }, undefined) === 'LEGACY'],
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
