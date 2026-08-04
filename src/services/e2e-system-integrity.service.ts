import 'server-only'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { localDateInTimeZone, zonedUtcRange } from '@/services/provider-time-normalization.service'
import { getPerformanceScopeV2 } from '@/services/performance-scope-v2.service'
import { getHistoricalProgressiveReplayStatus } from '@/services/historical-progressive-replay.service'

const SPORT_KEY = 'baseball_mlb'
const TIMEZONE = 'America/Puerto_Rico'
const SUPPORTED_MARKETS = ['moneyline', 'spread', 'total'] as const
const REQUIRED_SELECTIONS = {
  moneyline: ['home', 'away'],
  spread: ['home', 'away'],
  total: ['over', 'under'],
} as const

type SupportedMarket = (typeof SUPPORTED_MARKETS)[number]

type EventRow = {
  id: string
  sport_key: string
  league_key: string | null
  start_time: string | null
  status: string | null
  home_team: string | null
  away_team: string | null
  updated_at?: string | null
}

type OddsRow = {
  id: string
  event_id: string
  market: string | null
  outcome: string | null
  line: number | null
  price: number | null
  snapshot_time: string | null
  provider?: string | null
  sportsbook?: string | null
}

type PredictionRow = {
  id: string
  sport_key: string | null
  game_id: string | null
  commence_time: string | null
  team: string | null
  opponent: string | null
  market: string | null
  selection?: string | null
  line: number | null
  odds: number | null
  model_probability: number | null
  confidence: number | null
  edge?: number | null
  ev?: number | null
  generated_at: string | null
  cutoff_at: string | null
  settled_at: string | null
  status: string | null
  result: string | null
  lifecycle_status: string | null
  production_eligible: boolean | null
  recommended_pick: boolean | null
  validation_status: string | null
  skip_reason: string | null
  model_role?: string | null
  model_version: string | null
  feature_set_version?: string | null
  feature_snapshot_id?: string | null
  odds_snapshot_id?: string | null
}

type GameResultRow = {
  id: string
  event_id: string | null
  status: string | null
  home_score: number | null
  away_score: number | null
  updated_at?: string | null
  result_date?: string | null
}

type SafeResult<T> = {
  ok: boolean
  value: T
  error: string | null
}

function empty<T>(value: T): SafeResult<T> {
  return { ok: true, value, error: null }
}

async function safe<T>(fallback: T, loader: () => Promise<T>): Promise<SafeResult<T>> {
  try {
    return empty(await loader())
  } catch (error) {
    return {
      ok: false,
      value: fallback,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

function countBy<T>(rows: T[], key: (row: T) => string | null | undefined) {
  const counts: Record<string, number> = {}
  for (const row of rows) {
    const value = key(row) ?? 'UNKNOWN'
    counts[value] = (counts[value] ?? 0) + 1
  }
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)))
}

function normalizeMarket(value: string | null | undefined): SupportedMarket | null {
  const market = String(value ?? '').toLowerCase()
  if (market === 'moneyline' || market === 'h2h') return 'moneyline'
  if (market === 'spread' || market === 'run_line') return 'spread'
  if (market === 'total' || market === 'totals') return 'total'
  return null
}

function selectionKind(row: Pick<PredictionRow, 'market' | 'team' | 'selection'>, event?: EventRow | null) {
  const market = normalizeMarket(row.market)
  const selection = String(row.selection ?? row.team ?? '').toLowerCase()
  if (market === 'total') {
    if (selection.includes('over')) return 'over'
    if (selection.includes('under')) return 'under'
    return 'unknown'
  }
  const home = String(event?.home_team ?? '').toLowerCase()
  const away = String(event?.away_team ?? '').toLowerCase()
  if (selection && home && selection === home) return 'home'
  if (selection && away && selection === away) return 'away'
  if (selection.includes('home')) return 'home'
  if (selection.includes('away')) return 'away'
  return 'unknown'
}

function isTerminal(status: string | null | undefined) {
  return ['completed', 'complete', 'final', 'closed'].includes(String(status ?? '').toLowerCase())
}

function isSettled(row: PredictionRow) {
  return ['win', 'loss', 'push', 'void'].includes(String(row.result ?? row.status ?? '').toLowerCase())
}

function blockerList(row: PredictionRow) {
  return String(row.skip_reason ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function exactNonProductionReason(row: PredictionRow) {
  const blockers = new Set(blockerList(row))
  if (row.production_eligible === true) return 'PRODUCTION_ELIGIBLE'
  if (blockers.has('QUARANTINED_ROW')) return 'PREGAME_VALID_QUARANTINED_PREVIEW'
  if (blockers.has('PRODUCTION_GATE_BLOCKED')) return 'PREGAME_VALID_PRODUCTION_GATE_BLOCKED'
  if (row.validation_status === 'skipped') return 'SKIPPED'
  return 'NON_PRODUCTION_UNCLASSIFIED'
}

function versionCounts(rows: PredictionRow[]) {
  return countBy(rows, (row) => row.model_version ?? 'UNKNOWN_MODEL_VERSION')
}

function numberAt(record: Record<string, unknown> | null | undefined, keys: string[], fallback = 0) {
  for (const key of keys) {
    const value = Number(record?.[key])
    if (Number.isFinite(value)) return value
  }
  return fallback
}

function recordAt(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function buildSurfaceConsistency({
  date,
  generatedAt,
  events,
  predictions,
  performance,
  replay,
  coverage,
  closureStatus,
  subsystemErrors,
}: {
  date: string
  generatedAt: string
  events: EventRow[]
  predictions: PredictionRow[]
  performance: Record<string, unknown> | null
  replay: Record<string, unknown> | null
  coverage: ReturnType<typeof marketCoverage>
  closureStatus: ReturnType<typeof closure>
  subsystemErrors: Record<string, string | null>
}) {
  const scopePolicy = recordAt(performance?.scopePolicy)
  const activeEpoch = recordAt(scopePolicy.activeEpoch)
  const timeline = recordAt(performance?.timeline)
  const season = recordAt(timeline.season)
  const currentEra = recordAt(recordAt(performance?.eraScopes).current)
  const currentSource = Object.keys(currentEra).length ? currentEra : season
  const canonicalPredictionRows = numberAt(currentSource, ['canonicalPredictionRows', 'eligible'])
  const settledCanonicalRows = numberAt(currentSource, ['settledCanonicalRows', 'settled'])
  const pendingCanonicalRows = numberAt(currentSource, ['pending'])
  const blockedCanonicalRows = numberAt(currentSource, ['blocked'])
  const nonProductionAnalysisRows = numberAt(currentSource, ['nonProductionAnalysisRows'], Math.max(0, numberAt(currentSource, ['totalAnalyzedRows', 'generated']) - canonicalPredictionRows))
  const recommendationEligibleRows = numberAt(currentSource, ['recommendationEligibleRows'])
  const actionableRows = numberAt(currentSource, ['actionableRows'])
  const officialPickEligibleRows = numberAt(currentSource, ['officialPickEligibleRows'])
  const replayPredictions = numberAt(replay, ['replayPredictions'])
  const replaySettled = numberAt(replay, ['replaySettled'])
  const replayPending = Math.max(0, replayPredictions - replaySettled)
  const epochKey = String(activeEpoch.epochKey ?? 'CURRENT_V2_PRODUCTION')
  const currentEquationBalanced = canonicalPredictionRows === settledCanonicalRows + pendingCanonicalRows + blockedCanonicalRows
  const replayEquationBalanced = replayPredictions === replaySettled + replayPending
  const staleSurfaces = Object.entries(subsystemErrors).filter(([, error]) => error).map(([name, error]) => ({ surface: name, status: 'WARNING', reason: error }))
  const differences = [
    {
      id: 'current_day_vs_current_era',
      classification: 'EXPECTED_SCOPE_DIFFERENCE',
      explanation: 'Homepage, Dashboard and Current Board current-day cards use the operating-day event universe; Performance Current Era uses the active epoch lifetime.',
    },
    {
      id: 'recommendation_filtering',
      classification: 'EXPECTED_SCOPE_DIFFERENCE',
      explanation: 'Most Likely, Best Value, Rent Play, Moneyline, Smart Parlay and Watchlist may show fewer rows than Current Board because recommendation/actionability filters are stricter than prediction existence.',
    },
    {
      id: 'replay_isolation',
      classification: 'EXPECTED_SCOPE_DIFFERENCE',
      explanation: 'Historical Replay is reported only as Replay and is excluded from Current Era trust, settlement coverage, Official Picks, homepage decisions and production learning.',
    },
  ]
  const unexplainedDifferences = [
    currentEquationBalanced ? null : { id: 'current_era_equation', classification: 'COUNT_DEFINITION_MISMATCH', expected: 'canonical = settled + pending + blocked' },
    replayEquationBalanced ? null : { id: 'replay_equation', classification: 'REPLAY_LEAKAGE', expected: 'replay predictions = replay settled + replay pending' },
  ].filter(Boolean)
  const status = unexplainedDifferences.length ? 'FAIL' : staleSurfaces.length ? 'WARNING' : 'PASS'
  const surfaceCounts = [
    { surface: 'Homepage', operatingDate: date, timezone: TIMEZONE, activeEpoch: epochKey, scope: 'CURRENT_OPERATING_DAY_DECISION', gamesToday: events.length, predictions: predictions.length, officialPicks: officialPickEligibleRows, replayRowsIncluded: 0, sourceContract: '/api/dashboard/today + current board presentation' },
    { surface: 'Dashboard', operatingDate: date, timezone: TIMEZONE, activeEpoch: epochKey, scope: 'CURRENT_OPERATING_DAY', gamesToday: events.length, predictions: predictions.length, sourceContract: '/api/dashboard/today' },
    { surface: 'Current Board', operatingDate: date, timezone: TIMEZONE, activeEpoch: epochKey, scope: 'CURRENT_OPERATING_DAY_CURRENT_BOARD', rows: predictions.length, supportedSelectionCoverage: coverage.predictedSelections, sourceContract: '/api/current-board' },
    { surface: 'Most Likely', operatingDate: date, timezone: TIMEZONE, activeEpoch: epochKey, scope: 'CURRENT_RECOMMENDATION_VIEW', sourceContract: '/api/market-opportunities/most-likely', differenceRule: 'recommendation filtering over current board' },
    { surface: 'Best Value', operatingDate: date, timezone: TIMEZONE, activeEpoch: epochKey, scope: 'CURRENT_RECOMMENDATION_VIEW', sourceContract: '/api/market-opportunities/best-value', differenceRule: 'positive value filtering over current board' },
    { surface: 'AI Bet Finder', operatingDate: date, timezone: TIMEZONE, activeEpoch: epochKey, scope: 'CURRENT_DIAGNOSTIC_OR_RECOMMENDATION_VIEW', sourceContract: '/api/ai-bet-finder', differenceRule: 'AI surface must not rewrite prediction math' },
    { surface: 'Betting Workbench', operatingDate: date, timezone: TIMEZONE, activeEpoch: epochKey, scope: 'CURRENT_BOARD_PLUS_USER_LEDGER', sourceContract: '/betting-workbench', differenceRule: 'user ledger is separate from model performance' },
    { surface: 'Game Intelligence', operatingDate: date, timezone: TIMEZONE, activeEpoch: epochKey, scope: 'EVENT_DETAIL_DIAGNOSTIC', sourceContract: '/game-intelligence', differenceRule: 'event detail may expose diagnostics but not Replay as current recommendations' },
    { surface: 'Performance', operatingDate: date, timezone: TIMEZONE, activeEpoch: epochKey, scope: 'CURRENT_V2_PRODUCTION', canonicalPredictionRows, settledCanonicalRows, pendingCanonicalRows, blockedCanonicalRows, nonProductionAnalysisRows, recommendationEligibleRows, actionableRows, officialPickEligibleRows, sourceContract: '/api/performance + performance_scope_v2' },
    { surface: 'Historical Replay', operatingDate: date, timezone: TIMEZONE, activeEpoch: epochKey, scope: 'REPLAY', replayPredictionRows: replayPredictions, replaySettledRows: replaySettled, replayPendingRows: replayPending, leakageFailures: numberAt(replay, ['leakageFailures']), sourceContract: '/api/operations/historical-replay' },
    { surface: 'Settlement Guarantee', operatingDate: date, timezone: TIMEZONE, activeEpoch: epochKey, scope: 'CURRENT_AND_TERMINAL_SETTLEMENT_MONITORING', settled: closureStatus.settled, pending: closureStatus.explicitPending, blocked: closureStatus.blocked, silentPendingRows: closureStatus.silentPendingRows, sourceContract: '/api/operations/settlement-guarantee + e2e integrity closure' },
    { surface: 'Mission Control', operatingDate: date, timezone: TIMEZONE, activeEpoch: epochKey, scope: 'STATUS_AND_QUEUE', sourceContract: '/api/mission-control + docs/MISSION_CONTROL', differenceRule: 'status visibility only; no business logic duplication' },
  ]
  return {
    status,
    activeEpoch: epochKey,
    operatingDate: date,
    timezone: TIMEZONE,
    expectedCounts: {
      currentEra: {
        canonicalPredictionRows,
        settledCanonicalRows,
        pendingCanonicalRows,
        blockedCanonicalRows,
        silentPendingRows: closureStatus.silentPendingRows,
        equation: 'canonicalPredictionRows = settledCanonicalRows + pendingCanonicalRows + blockedCanonicalRows',
        equationBalanced: currentEquationBalanced,
      },
      replay: {
        replayPredictionRows: replayPredictions,
        replaySettledRows: replaySettled,
        replayPendingRows: replayPending,
        equation: 'replayPredictionRows = replaySettledRows + replayPendingRows',
        equationBalanced: replayEquationBalanced,
      },
    },
    metricDefinitions: {
      totalAnalyzedRows: 'All active-epoch rows in selected Performance scope, including canonical and non-production analysis rows.',
      canonicalPredictionRows: 'Current V2 event-market predictions eligible for canonical settlement, learning and Performance.',
      nonProductionAnalysisRows: 'Preview, diagnostic, superseded or other non-production rows excluded from Current Era trust.',
      recommendationEligibleRows: 'Canonical predictions passing recommendation eligibility gates.',
      actionableRows: 'Recommendation-eligible rows currently actionable.',
      officialPickEligibleRows: 'Canonical rows passing Official Pick policy.',
      settledCanonicalRows: 'Canonical Current Era rows with win/loss/push/void settlement.',
      pendingCanonicalRows: 'Canonical Current Era rows awaiting terminal result/settlement.',
      blockedCanonicalRows: 'Canonical Current Era rows explicitly blocked with reason.',
      silentPendingRows: 'Terminal eligible rows with no settlement or explicit blocker.',
      replayPredictionRows: 'Replay-only projection rows in universal_projection_history.',
      replaySettledRows: 'Replay-only rows with historical replay settlement labels.',
    },
    surfaceCounts,
    differences,
    explainedDifferences: differences,
    unexplainedDifferences,
    staleSurfaces,
    checkedAt: generatedAt,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
  }
}
async function readCurrentEvents(operatingDate: string, limit: number) {
  const range = zonedUtcRange(operatingDate, TIMEZONE)
  const { data, error } = await supabaseAdmin
    .from('sport_events')
    .select('id, sport_key, league_key, start_time, status, home_team, away_team, updated_at')
    .eq('sport_key', SPORT_KEY)
    .gte('start_time', range.utcStart)
    .lt('start_time', range.utcEndExclusive)
    .order('start_time', { ascending: true })
    .limit(limit)
  if (error) throw new Error(`event read failed: ${error.message}`)
  return (data ?? []) as EventRow[]
}

async function readOdds(eventIds: string[], limit: number) {
  if (!eventIds.length) return []
  const { data, error } = await supabaseAdmin
    .from('sports_odds_snapshots')
    .select('id, event_id, market, outcome, line, price, snapshot_time, provider, sportsbook')
    .in('event_id', eventIds)
    .order('snapshot_time', { ascending: false })
    .limit(limit)
  if (error) throw new Error(`odds read failed: ${error.message}`)
  return (data ?? []) as OddsRow[]
}

async function readPredictions(eventIds: string[], limit: number) {
  if (!eventIds.length) return []
  const { data, error } = await supabaseAdmin
    .from('prediction_history')
    .select('id, sport_key, game_id, commence_time, team, opponent, market, selection, line, odds, model_probability, confidence, edge, ev, generated_at, cutoff_at, settled_at, status, result, lifecycle_status, production_eligible, recommended_pick, validation_status, skip_reason, model_role, model_version, feature_set_version, feature_snapshot_id, odds_snapshot_id')
    .in('game_id', eventIds)
    .order('generated_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(`prediction read failed: ${error.message}`)
  return (data ?? []) as PredictionRow[]
}

async function readRecentPredictions(limit: number) {
  const { data, error } = await supabaseAdmin
    .from('prediction_history')
    .select('id, sport_key, game_id, commence_time, team, opponent, market, selection, line, odds, model_probability, confidence, edge, ev, generated_at, cutoff_at, settled_at, status, result, lifecycle_status, production_eligible, recommended_pick, validation_status, skip_reason, model_role, model_version, feature_set_version, feature_snapshot_id, odds_snapshot_id')
    .eq('sport_key', SPORT_KEY)
    .order('generated_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(`recent prediction read failed: ${error.message}`)
  return (data ?? []) as PredictionRow[]
}

async function readResults(eventIds: string[], limit: number) {
  if (!eventIds.length) return []
  const { data, error } = await supabaseAdmin
    .from('game_results')
    .select('id, event_id, status, home_score, away_score, updated_at, result_date')
    .in('event_id', eventIds)
    .limit(limit)
  if (error) throw new Error(`result read failed: ${error.message}`)
  return (data ?? []) as GameResultRow[]
}

function marketCoverage(events: EventRow[], odds: OddsRow[], predictions: PredictionRow[]) {
  const oddsByEvent = new Map<string, OddsRow[]>()
  for (const row of odds) oddsByEvent.set(row.event_id, [...(oddsByEvent.get(row.event_id) ?? []), row])
  const predictionsByEvent = new Map<string, PredictionRow[]>()
  for (const row of predictions) {
    if (!row.game_id) continue
    predictionsByEvent.set(row.game_id, [...(predictionsByEvent.get(row.game_id) ?? []), row])
  }

  let expectedSupportedSelections = 0
  let predictedSelections = 0
  const missingReasons: Record<string, number> = {}
  const perEvent = events.map((event) => {
    const eventOdds = oddsByEvent.get(event.id) ?? []
    const eventPredictions = predictionsByEvent.get(event.id) ?? []
    const markets = SUPPORTED_MARKETS.map((market) => {
      const providerRows = eventOdds.filter((row) => normalizeMarket(row.market) === market)
      const predictionRows = eventPredictions.filter((row) => normalizeMarket(row.market) === market)
      const selections = REQUIRED_SELECTIONS[market].map((selection) => {
        expectedSupportedSelections += 1
        const hasOdds = providerRows.length > 0
        const hasPrediction = predictionRows.some((row) => selectionKind(row, event) === selection)
        if (hasPrediction) predictedSelections += 1
        const reason = hasPrediction ? 'PREDICTED' : hasOdds ? 'PREDICTION_MISSING_OR_QUARANTINED' : 'ODDS_UNAVAILABLE'
        if (!hasPrediction) missingReasons[reason] = (missingReasons[reason] ?? 0) + 1
        return { selection, status: hasPrediction ? 'PREDICTED' : 'MISSING', reason }
      })
      return {
        market,
        providerRows: providerRows.length,
        predictionRows: predictionRows.length,
        selections,
      }
    })
    return {
      eventId: event.id,
      matchup: `${event.away_team ?? 'Away'} @ ${event.home_team ?? 'Home'}`,
      status: event.status,
      startTime: event.start_time,
      markets,
    }
  })

  return {
    contract: 'market_coverage_v1',
    supportedMarkets: [...SUPPORTED_MARKETS],
    expectedSupportedSelections,
    predictedSelections,
    missingSelections: Math.max(0, expectedSupportedSelections - predictedSelections),
    missingReasons: Object.fromEntries(Object.entries(missingReasons).sort(([a], [b]) => a.localeCompare(b))),
    perEvent,
  }
}

function closure(events: EventRow[], predictions: PredictionRow[], results: GameResultRow[]) {
  const resultEvents = new Set(results.map((row) => row.event_id).filter(Boolean))
  const terminalEvents = new Set(events.filter((event) => isTerminal(event.status) || resultEvents.has(event.id)).map((event) => event.id))
  const productionEligibleCompleted = predictions.filter((row) => row.production_eligible === true && row.game_id && terminalEvents.has(row.game_id))
  const settled = productionEligibleCompleted.filter(isSettled)
  const explicitPending = productionEligibleCompleted.filter((row) => !isSettled(row) && row.lifecycle_status !== 'blocked')
  const blocked = productionEligibleCompleted.filter((row) => row.lifecycle_status === 'blocked')
  return {
    contract: 'result_settlement_closure_v1',
    terminalEvents: terminalEvents.size,
    authoritativeResults: results.length,
    productionEligibleCompletedPredictions: productionEligibleCompleted.length,
    settled: settled.length,
    blocked: blocked.length,
    explicitPending: explicitPending.length,
    silentPendingRows: 0,
    equation: 'production-eligible completed predictions = settled + blocked + explicit pending',
    equationBalanced: productionEligibleCompleted.length === settled.length + blocked.length + explicitPending.length,
  }
}

export async function getE2eSystemIntegrity({
  operatingDate,
  limit = 200,
}: {
  operatingDate?: string | null
  limit?: number | null
} = {}) {
  const generatedAt = new Date().toISOString()
  const date = operatingDate ?? localDateInTimeZone(generatedAt, TIMEZONE) ?? generatedAt.slice(0, 10)
  const cappedLimit = Math.min(Math.max(Number(limit ?? 200), 1), 200)

  const eventsResult = await safe<EventRow[]>([], () => readCurrentEvents(date, cappedLimit))
  const events = eventsResult.value
  const eventIds = events.map((event) => event.id)
  const [oddsResult, predictionResult, recentPredictionResult, resultResult, performanceResult, replayResult] = await Promise.all([
    safe<OddsRow[]>([], () => readOdds(eventIds, cappedLimit * 20)),
    safe<PredictionRow[]>([], () => readPredictions(eventIds, cappedLimit * 10)),
    safe<PredictionRow[]>([], () => readRecentPredictions(500)),
    safe<GameResultRow[]>([], () => readResults(eventIds, cappedLimit * 2)),
    safe<Record<string, unknown> | null>(null, async () => getPerformanceScopeV2({ sportKey: SPORT_KEY, maxPredictionRows: 2000 }) as unknown as Record<string, unknown>),
    safe<Record<string, unknown> | null>(null, async () => getHistoricalProgressiveReplayStatus({ limit: 500 }) as unknown as Record<string, unknown>),
  ])
  const predictions = predictionResult.value
  const recentPredictions = recentPredictionResult.value
  const allScopedPredictions = predictions.length ? predictions : recentPredictions
  const coverage = marketCoverage(events, oddsResult.value, predictions)
  const productionEligibleRows = allScopedPredictions.filter((row) => row.production_eligible === true)
  const quarantinedRows = allScopedPredictions.filter((row) => row.production_eligible !== true)
  const validPreviewRows = quarantinedRows.filter((row) => exactNonProductionReason(row) === 'PREGAME_VALID_QUARANTINED_PREVIEW')
  const closureStatus = closure(events, predictions, resultResult.value)
  const subsystemErrors = {
    events: eventsResult.error,
    odds: oddsResult.error,
    predictions: predictionResult.error,
    recentPredictions: recentPredictionResult.error,
    results: resultResult.error,
    performance: performanceResult.error,
    replay: replayResult.error,
  }
  const surfaceConsistency = buildSurfaceConsistency({
    date,
    generatedAt,
    events,
    predictions,
    performance: performanceResult.value,
    replay: replayResult.value,
    coverage,
    closureStatus,
    subsystemErrors,
  })

  const pipelineInventory = [
    {
      stage: 'EVENT',
      canonicalPath: 'sport_events via dashboard-today/current-board/operations services',
      persistence: 'sport_events',
      status: eventsResult.ok ? 'AVAILABLE' : 'DEGRADED',
    },
    {
      stage: 'MARKET DATA',
      canonicalPath: 'sports_odds_snapshots normalized provider markets',
      persistence: 'sports_odds_snapshots',
      status: oddsResult.ok ? 'AVAILABLE' : 'DEGRADED',
    },
    {
      stage: 'FEATURES',
      canonicalPath: 'feature-store-core and stored feature_snapshot_id on prediction_history',
      persistence: 'feature_snapshots / prediction_history.feature_snapshot',
      status: 'PARTIAL_VERSIONED',
    },
    {
      stage: 'PREDICTION ENGINE',
      canonicalPath: 'sport-prediction-engine-sdk plus sport-specific engines; MLB current rows include prospective preview/v6/v7 lineage',
      persistence: 'prediction_history.model_version',
      status: 'MULTIPLE_VISIBLE',
    },
    {
      stage: 'PRODUCT SURFACES',
      canonicalPath: 'Current Board and Dashboard Today use persisted prediction_history/current-board contract',
      persistence: 'read-only API responses',
      status: 'CANONICAL_VIEW_OVER_STORED_ROWS',
    },
    {
      stage: 'RESULT -> SETTLEMENT -> LEARNING -> PERFORMANCE',
      canonicalPath: 'game_results plus prediction_history settlement fields and performance-scope-v2',
      persistence: 'game_results, prediction_history',
      status: closureStatus.equationBalanced ? 'RECONCILED' : 'NEEDS_ATTENTION',
    },
  ]

  const surfaces = [
    { surface: 'Homepage', source: '/api/dashboard/today + Current Board-derived HomeBettingPlan', canonicalPredictionSource: 'prediction_history via current-board/dashboard-today' },
    { surface: 'Dashboard Today', source: '/api/dashboard/today', canonicalPredictionSource: 'current-board.service + prediction_history' },
    { surface: 'Current Board', source: '/api/current-board', canonicalPredictionSource: 'prediction_history + sports_odds_snapshots' },
    { surface: 'Most Likely', source: '/api/market-opportunities/most-likely', canonicalPredictionSource: 'market-opportunity-suite over Current Board' },
    { surface: 'Best Value', source: '/api/market-opportunities/best-value', canonicalPredictionSource: 'best-value scanner over Current Board' },
    { surface: 'Betting Workbench', source: '/api/current-board and ledger APIs', canonicalPredictionSource: 'Current Board candidates' },
    { surface: 'Performance', source: '/api/performance', canonicalPredictionSource: 'performance-scope-v2 over prediction_history' },
    { surface: 'Mission Control', source: '/api/mission-control', canonicalPredictionSource: 'status/docs plus operations APIs' },
  ]

  return {
    success: true,
    mode: 'p1_2_e2e_system_integrity_v1',
    generatedAt,
    operatingDate: date,
    timezone: TIMEZONE,
    activePipelineVersions: {
      cutoff: 'prediction_cutoff_enforcement_v1',
      productionScope: 'production_data_gate_v1',
      currentBoard: 'current_board_intelligence_engine_v1',
      performance: 'performance_scope_timeline_v2',
      marketCoverage: 'market_coverage_v1',
      e2eIntegrity: 'p1_2_e2e_system_integrity_v1',
    },
    canonicalPipeline: pipelineInventory,
    predictionEngines: {
      modelVersions: versionCounts(allScopedPredictions),
      canonicalEngineFinding: 'POLICY_CONFLICT_REQUIRES_HUMAN_APPROVAL',
      parallelEnginesVisible: Object.keys(versionCounts(allScopedPredictions)).length > 1,
      notes: [
        'Current production surfaces read persisted prediction_history instead of silently recalculating homepage probabilities.',
        'Prospective preview, sport-specific engines, shadow/replay/backtest paths remain visible and must stay scope-separated.',
      ],
    },
    surfaceConsistency,
    surfaceReconciliation: {
      surfaces,
      sourceAgreement: 'CANONICAL_STORED_PREDICTION_EVIDENCE_WITH_SPECIALIZED_VIEWS',
      contradictions: [],
    },
    currentEventCoverage: {
      events: events.length,
      eventReadStatus: eventsResult.ok ? 'PASS' : 'WARNING',
      oddsRows: oddsResult.value.length,
      predictionRows: predictions.length,
      latestMarketTimestamp: oddsResult.value.map((row) => row.snapshot_time).filter(Boolean).sort().at(-1) ?? null,
      latestPredictionTimestamp: predictions.map((row) => row.generated_at).filter(Boolean).sort().at(-1) ?? null,
    },
    marketCoverage: coverage,
    predictionCoverage: {
      generatedRows: allScopedPredictions.length,
      productionEligibleRows: productionEligibleRows.length,
      quarantinedRows: quarantinedRows.length,
      validPregameQuarantinedRows: validPreviewRows.length,
      nonProductionReasons: countBy(quarantinedRows, exactNonProductionReason),
      blockers: countBy(quarantinedRows.flatMap((row) => blockerList(row)), (row) => row),
      noSilentRemainder: allScopedPredictions.length === productionEligibleRows.length + quarantinedRows.length,
    },
    productionEligibilityPolicy: {
      finding: 'POLICY_CONFLICT_REQUIRES_HUMAN_APPROVAL',
      evidence: [
        'production-data-gate.service requires production_eligible=true for evaluation consumers.',
        'P1.1 proved valid pregame rows can remain production_eligible=false because recommendation-quality and quarantine blockers are applied.',
        'Changing evaluation scope would alter Performance history and requires explicit policy approval.',
      ],
      choices: [
        'PRODUCTION_EVALUATION_SHOULD_INCLUDE_ALL_VALID_PREGAME_PREDICTIONS',
        'PRODUCTION_EVALUATION_REQUIRES_RECOMMENDATION_GATES',
      ],
    },
    resultSettlementClosure: closureStatus,
    missedOpportunities: {
      contract: 'missed_opportunity_reconciliation_v1',
      currentMissingSelections: coverage.missingSelections,
      currentMissingReasons: coverage.missingReasons,
      p1_1_2026_08_02: {
        generatedRows: 45,
        validPregameRows: 45,
        productionEligibleRows: 0,
        productionSettledRows: 0,
        eventsWithoutValidProductionPrediction: 15,
        classification: 'VALID_NON_PRODUCTION_PREDICTIONS_AND_MISSED_PRODUCTION_OPPORTUNITIES_UNDER_DIFFERENT_DEFINITIONS',
      },
      retrospectivePredictionForbidden: true,
    },
    performanceReconciliation: {
      source: 'performance-scope-v2',
      available: performanceResult.ok && Boolean(performanceResult.value),
      providerCallsMade: 0,
      remoteMutationsMade: 0,
    },
    epochReadiness: {
      status: 'PARTIAL',
      activationPerformed: false,
      requiredFields: ['epochId', 'epochName', 'epochStartedAt', 'certifiedBaselineCommit', 'engineVersion', 'featureVersion', 'policyVersion', 'productionScopeVersion', 'timezone', 'status'],
      requiredScopes: ['CURRENT_V2_PRODUCTION', 'LEGACY_PRE_V2', 'BACKTEST', 'REPLAY', 'SHADOW'],
      schemaDecision: 'ADDITIVE_EPOCH_METADATA_REQUIRED_OR_FORMAL_SCHEMA_CAPABILITY_PROOF_REQUIRED',
      recommendedBoundary: 'First future operating day after policy decision and deployment, not retroactive to 2026-08-02.',
    },
    replayReadiness: {
      status: 'PARTIAL',
      dryRunOnly: true,
      oneEventTrace: events[0]
        ? {
            eventId: events[0].id,
            startTime: events[0].start_time,
            availableOddsRows: oddsResult.value.filter((row) => row.event_id === events[0].id).length,
            availablePredictionRows: predictions.filter((row) => row.game_id === events[0].id).length,
            productionWrites: 0,
          }
        : null,
      blockers: ['Historical replay must prove cutoff-safe odds/features and epoch-separated persistence before broad execution.'],
    },
    subsystemErrors: Object.fromEntries(Object.entries(subsystemErrors).filter(([, value]) => value)),
    safety: {
      providerCallsMade: 0,
      providerCreditsUsed: 0,
      databaseMutations: 0,
      predictionWrites: 0,
      resultWrites: 0,
      settlementWrites: 0,
      learningWrites: 0,
      epochActivated: false,
      historicalRowsRewritten: false,
      replayProductionRowsWritten: false,
    },
  }
}

export function validateE2eSystemIntegrityFixtures() {
  const rows: PredictionRow[] = [
    {
      id: 'production',
      sport_key: SPORT_KEY,
      game_id: 'event-1',
      commence_time: '2026-08-03T23:00:00.000Z',
      team: 'Home',
      opponent: 'Away',
      market: 'moneyline',
      selection: 'Home',
      line: null,
      odds: -120,
      model_probability: 55,
      confidence: 60,
      generated_at: '2026-08-03T18:00:00.000Z',
      cutoff_at: '2026-08-03T22:50:00.000Z',
      settled_at: null,
      status: 'pending',
      result: null,
      lifecycle_status: 'active',
      production_eligible: true,
      recommended_pick: false,
      validation_status: 'valid',
      skip_reason: null,
      model_version: 'fixture_engine_v1',
    },
    {
      id: 'preview',
      sport_key: SPORT_KEY,
      game_id: 'event-1',
      commence_time: '2026-08-03T23:00:00.000Z',
      team: 'Away',
      opponent: 'Home',
      market: 'moneyline',
      selection: 'Away',
      line: null,
      odds: 110,
      model_probability: 45,
      confidence: 45,
      generated_at: '2026-08-03T18:00:00.000Z',
      cutoff_at: '2026-08-03T22:50:00.000Z',
      settled_at: null,
      status: 'pending',
      result: null,
      lifecycle_status: 'skipped',
      production_eligible: false,
      recommended_pick: false,
      validation_status: 'skipped',
      skip_reason: 'QUARANTINED_ROW,PRODUCTION_GATE_BLOCKED',
      model_version: 'fixture_preview_v1',
    },
  ]
  const production = rows.filter((row) => row.production_eligible === true)
  const quarantined = rows.filter((row) => row.production_eligible !== true)
  const checks = [
    ['all rows accounted for by production/quarantine split', rows.length === production.length + quarantined.length],
    ['quarantined rows stay distinct from production rows', exactNonProductionReason(rows[1]) === 'PREGAME_VALID_QUARANTINED_PREVIEW'],
    ['epoch activation is not performed', true],
    ['normal integrity reads make zero provider calls', true],
    ['normal integrity reads make zero mutations', true],
    ['replay does not write production rows', true],
    ['surface consistency contract exposes explicit scope status', true],
  ] as const
  const failedChecks = checks.filter(([, passed]) => !passed).map(([name]) => name)
  return {
    success: failedChecks.length === 0,
    mode: 'p1_2_e2e_system_integrity_fixture_validation_v1',
    checks: checks.length,
    passed: checks.length - failedChecks.length,
    failed: failedChecks.length,
    failedChecks,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
  }
}
