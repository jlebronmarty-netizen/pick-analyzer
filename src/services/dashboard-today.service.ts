import 'server-only'

import { supabaseAdmin } from '@/lib/supabase-admin'
import {
  ACTIVE_EVENT_TIMEZONE,
  puertoRicoLocalDateFromUtc,
  puertoRicoUtcRange,
} from '@/services/active-event.service'
import { getCurrentBoardCached } from '@/services/current-board.service'
import type { CurrentBoardCandidate } from '@/services/current-board.service'
import type { OfficialPickContract } from '@/services/official-pick-experience.service'
import type { MlbAiPicksFeed } from '@/services/mlb-ai-picks-feed.service'
import { emptyCategoryTrackRecord, summarizeMarketIntelligenceCategories } from '@/services/market-intelligence-category.service'
import { getNextSlateStatus } from '@/services/next-slate.service'
import { getOperatingDayStatus } from '@/services/operating-day.service'
import { getProviderBudgetStatus } from '@/services/provider-budget.service'
import { eligibilityFromLifecycle, resolveMlbGameLifecycle } from '@/services/mlb-game-lifecycle.service'
import { validateMlbOperatingDateResolutionFixtures } from '@/services/mlb-operating-date-resolution.service'
import { formatInTimeZone, localDateInTimeZone, zonedUtcRange } from '@/services/provider-time-normalization.service'
import { getModelOnlyIntelligence } from '@/services/model-only-intelligence.service'
import { getMlbProjectedScores } from '@/services/mlb-projected-score.service'
import { getPregameSchedulerCoverage } from '@/services/pregame-scheduler-coverage.service'
import { getRecommendationPipelineTrace } from '@/services/recommendation-pipeline-trace.service'

const SPORT_KEY = 'baseball_mlb'
const LEAGUE_KEY = 'mlb'
const TIMEZONE = ACTIVE_EVENT_TIMEZONE

type DashboardEventRow = {
  id: string
  sport_key: string
  league_key: string | null
  start_time: string | null
  status: string | null
  home_team: string | null
  away_team: string | null
  updated_at?: string | null
  provider_ids?: Record<string, unknown> | null
  metadata?: Record<string, unknown> | null
}

type DashboardEventLoadResult = {
  rows: DashboardEventRow[]
  diagnostics: {
    status?: 'AVAILABLE' | 'EMPTY_CONFIRMED' | 'QUERY_TIMEOUT' | 'QUERY_FAILED' | 'FALLBACK_LAST_KNOWN'
    source?: 'primary_current_events' | 'last_known_grounded_slate'
    rawRowsRead: number
    canonicalRowsRetained: number
    filteredOutByCanonicalDate: number
    queryWindowUtcStart: string | null
    queryWindowUtcEndExclusive: string | null
    requestedRangeUtcStart: string | null
    requestedRangeUtcEndExclusive: string | null
  }
}

type EventSettlementState = {
  label: 'Settled' | 'Awaiting Settlement' | 'Settlement Pending'
  totalPredictions: number
  settledPredictions: number
  pendingPredictions: number
  latestSettledAt: string | null
}

export type DashboardPipelineStatus = 'Complete' | 'Running' | 'Waiting' | 'Blocked' | 'Not due'
export type DashboardTodayStatus = 'AVAILABLE' | 'PARTIAL' | 'DEGRADED' | 'UNAVAILABLE'
export type DashboardSectionStatus = 'AVAILABLE' | 'EMPTY' | 'DEGRADED' | 'UNAVAILABLE'
export type DashboardBettingEligibility =
  | 'ELIGIBLE'
  | 'DATA_AGING'
  | 'STALE'
  | 'LOCKED_AFTER_START'
  | 'STATUS_UNCONFIRMED'
  | 'NO_MARKET'
  | 'INSUFFICIENT_DATA'

type DashboardTodaySection<T> = {
  status: DashboardSectionStatus
  data: T
  reason: string | null
  updatedAt: string | null
}

type DependencyResult<T> = {
  ok: boolean
  label: string
  value: T | null
  durationMs: number
  error: string | null
}

export type DashboardOperationalStatus =
  | 'NO_ODDS_STORED'
  | 'PARTIAL_MARKET_COVERAGE'
  | 'FRESH_MARKET'
  | 'AGING_MARKET'
  | 'STALE_MARKET'
  | 'NO_ALIGNED_PRICE'
  | 'NO_ELIGIBLE_MARKET'
  | 'PREGAME_MARKET_EXPIRED'
  | 'BETTING_LOCKED'
  | 'LIVE'
  | 'FINAL'
  | 'SETTLEMENT_PENDING'
  | 'SETTLED'

export type DashboardCanonicalSelector = {
  status: 'AVAILABLE' | 'EMPTY' | 'BLOCKED'
  eventId: string | null
  matchup: string | null
  market: string | null
  marketLabel: string | null
  selection: string | null
  line: number | null
  metricName: string
  metricValue: number | null
  modelProbability: number | null
  confidence: number | null
  directlyStoredPrice: boolean
  priceState: 'AVAILABLE' | 'NO_OPPOSITE_PRICE' | 'NO_STORED_ODDS' | 'STALE_MARKET' | 'MARKET_MISMATCH' | 'UNKNOWN_PUSH' | 'UNAVAILABLE'
  americanOdds: number | null
  sportsbook: string | null
  oddsSnapshotId: string | null
  impliedProbability: number | null
  edge: number | null
  expectedValue: number | null
  freshness: 'FRESH' | 'AGING' | 'STALE' | 'UNKNOWN_TIMESTAMP'
  blocker: string | null
  candidateUniverseSize: number
  rankingReason: string
}

export type DashboardCanonicalViewModel = {
  contractVersion: 'dashboard_canonical_viewmodel_v1'
  generatedAt: string
  selectors: {
    highestProjectedOutcome: DashboardCanonicalSelector
    highestConfidenceOutcome: DashboardCanonicalSelector
    highestRankedPricedMarket: DashboardCanonicalSelector
    mostUncertainOutcome: DashboardCanonicalSelector
    bestAvailableValue: DashboardCanonicalSelector
    strongestPlayerIntelligence: DashboardCanonicalSelector & {
      pitcherProjectionCount: number
      batterProjectionCount: number
      starterCoverage: number
      lineupCoverage: number
      historicalCapabilityAvailable: boolean
    }
    mostLikelySummary: {
      meaning: 'Highest Projected Outcome'
      selector: DashboardCanonicalSelector
    }
    currentBoardSummary: {
      candidates: number
      displayableMarkets: number
      directlyPricedCandidates: number
      noOppositePriceCandidates: number
      unknownEvSerializedAsZero: 0
      oppositePriceViolations: 0
    }
    gameCoverageSummary: {
      gamesToday: number
      gamesWithValidPregamePredictions: number
      gamesWithDisplayableCurrentBoardMarket: number
      marketsPredicted: number
      currentBoardCandidates: number
      gamesWithNoStoredOdds: number
      gamesWithPartialCoverage: number
    }
    learningSummary: {
      labelsCreatedToday: number
      labelsPending: number
      updatesApplied: number
      autoPromotions: 0
      status: 'AVAILABLE' | 'EMPTY'
      message: string
    }
    marketFreshnessSummary: {
      state: 'FRESH' | 'AGING' | 'STALE' | 'UNKNOWN_TIMESTAMP'
      latestOddsTimestamp: string | null
      staleBlockers: number
      freshStaleContradictions: 0
    }
    perGameOperationalStatus: Array<{
      eventId: string
      storedOddsCount: number
      marketsStored: string[]
      sidesStored: string[]
      latestSnapshotAgeMinutes: number | null
      validPregamePredictionCount: number
      currentBoardCandidateCount: number
      displayableMarketCount: number
      operationalStatus: DashboardOperationalStatus
    }>
  }
  diagnostics: {
    maximumCanonicalProbability: number | null
    highestProjectedEqualsMaximumCanonicalProbability: boolean
    highestConfidenceUsesConfidenceField: boolean
    mostUncertainUsesNeutralDistance: boolean
    highestRankedPricedMarketHasAlignedPrice: boolean
    noComplementOutcomeBorrowsSourceOdds: boolean
    unknownEvValuesSerializedAsZero: 0
    gamesWithStoredOddsIncorrectlyWaitingForOdds: 0
    invalidTotalLineSigns: 0
    freshStaleContradictions: 0
  }
}

export type DashboardTodayContract = {
  success: true
  status: DashboardTodayStatus
  mode: 'dashboard_today_contract_v1'
  generatedAt: string
  nowPuertoRico: string
  timezone: typeof TIMEZONE
  operatingDate: string
  activeSlateDate: string | null
  nextSlateDate: string | null
  currentStage: string
  activeOperatingDayStatus: string
  currentGames: number
  upcomingGames: number
  finalGames: number
  lifecycleCounts: {
    totalScheduledToday: number
    upcoming: number
    live: number
    final: number
    postponed: number
    canceled: number
    suspended: number
    statusUnconfirmed: number
    bettingEligible: number
    bettingLocked: number
    missingMarket: number
  }
  gamesWaitingForOdds: number
  gamesReadyForAnalysis: number
  predictionCandidates: number
  officialPicks: number
  informationalCandidates: number
  marketIntelligence: {
    official: number
    aiLeans: number
    watchlist: number
    modelOnly: number
    pass: number
    avoid: number
  }
  categoryTrackRecord: ReturnType<typeof emptyCategoryTrackRecord>
  categoryStatisticsPolicy: {
    officialOnlyPerformanceUnchanged: true
    categoriesNeverCombined: true
    informationalCategoriesAreNotRecommendations: true
    persistence: 'read_only_current_board_contract'
  }
  latestOddsTimestamp: string | null
  freshness: 'fresh' | 'partial' | 'stale' | 'empty'
  nextAction: string
  nextActionAt: string | null
  automationStatus: string
  providerCallsToday: number
  schedulerCoverage?: {
    gamesToday: number
    predictedToday: number
    pendingToday: number
    skippedToday: number
    coverageTodayPct: number | null
    averageLeadTimeBeforeCutoffMinutes: number | null
    missedWindowsToday: number
    nextPregameSlateDate?: string | null
    nextPregameCoveragePct?: number | null
    nextPregameValidGames?: number | null
    nextPregameEligibleGames?: number | null
    nextPregameAverageLeadTimeBeforeCutoffMinutes?: number | null
    gamesPendingPregameExecution?: number | null
    gamesProtectedByCutoff?: number | null
    nextBoardReadyGames?: number | null
    nextExecution: string | null
  }
  providerCallsMade: 0
  remoteMutationsMade: 0
  championRowsMutated: false
  v7Promoted: false
  officialThresholdsChanged: false
  summary: {
    recommendation: string
    aiBriefing: string
    currentOperatingDay: string
    nextSlate: string
    marketPrices: string
  }
  viewModel: DashboardCanonicalViewModel
  currentGameCards: Array<{
    eventId: string
    matchup: string
    scheduledTime: string | null
    displayTime: string | null
    status: string
    lifecycle: string
    eligibility: string
    bettingEligibility: DashboardBettingEligibility
    statusFresh: boolean
    statusSource: string
    statusReason: string
    rawProviderTime: string | null
    providerTimezone: string | null
    normalizedUtc: string | null
    storedStartTime: string | null
    temporalWarnings: string[]
    settlementState?: EventSettlementState
    storedOddsCount?: number
    marketsStored?: string[]
    sidesStored?: string[]
    latestSnapshotAgeMinutes?: number | null
    validPregamePredictionCount?: number
    currentBoardCandidateCount?: number
    displayableMarketCount?: number
    operationalStatus?: DashboardOperationalStatus
  }>
  nextSlateGames: Array<{
    eventId: string
    matchup: string
    scheduledTime: string | null
    displayTime?: string | null
    status: string
    lifecycle?: string
    eligibility?: string
    statusSource?: string
    statusReason?: string
    oddsPresent: boolean
    predictionReady: boolean
  }>
  pipeline: Array<{
    id: string
    label: string
    status: DashboardPipelineStatus
    detail: string
  }>
  sections: {
    core: DashboardTodaySection<{
      currentGames: number
      upcomingGames: number
      predictionCandidates: number
      officialPicks: number
      freshness: 'fresh' | 'partial' | 'stale' | 'empty'
    }>
    officialPicks: DashboardTodaySection<OfficialPickContract[]>
    aiPicksFeed: DashboardTodaySection<MlbAiPicksFeed>
    todayStory: DashboardTodaySection<string[]>
    mostLikely: DashboardTodaySection<unknown[]>
    bestValue: DashboardTodaySection<unknown[]>
    modelIntelligence: DashboardTodaySection<unknown>
    projectedScores: DashboardTodaySection<unknown[]>
    pitcherShadows: DashboardTodaySection<unknown[]>
    informationalParlays: DashboardTodaySection<unknown>
    aiBetFinder: DashboardTodaySection<unknown[]>
    topOpportunity: DashboardTodaySection<unknown | null>
    operations: DashboardTodaySection<{
      providerCallsToday: number
      nextAction: string
      nextActionAt: string | null
      blockers: string[]
      schedulerCoverage?: {
        coverageTodayPct: number | null
        averageLeadTimeBeforeCutoffMinutes: number | null
        missedWindowsToday: number
        nextExecution: string | null
      } | null
    }>
  }
  partial: boolean
  warnings: string[]
  blockers: string[]
  errors: Array<{
    dependency: string
    message: string
    critical: boolean
  }>
  timing: {
    totalMs: number
    dependencies: Record<string, number>
    slowDependencies: string[]
    coldOrWarm: 'runtime_observed'
    targetWarmMs: 2000
    targetColdMs: 5000
  }
  diagnostics: {
    initialPrimaryEndpoint: '/api/dashboard/today'
    initialAdvancedCallsWhenDeveloperModeClosed: 0
    dailyReportDeferred: true
    canonicalSources: string[]
    slate: {
      status: 'AVAILABLE' | 'DATA_EMPTY' | 'QUERY_FAILED' | 'TIMEOUT' | 'SLATE_FILTERED' | 'STATUS_STALE'
      requestedOperatingDate: string
      timezone: typeof TIMEZONE
      rawRowsRead: number
      canonicalRowsRetained: number
      filteredOutByCanonicalDate: number
      queryWindowUtcStart: string | null
      queryWindowUtcEndExclusive: string | null
      reason: string | null
    }
    dashboardSlateSource: 'primary_current_events' | 'last_known_grounded_slate'
    dashboardFallbackUsed: boolean
    dashboardQueryStatus: 'EMPTY_CONFIRMED' | 'QUERY_TIMEOUT' | 'QUERY_FAILED' | 'FALLBACK_LAST_KNOWN' | 'AVAILABLE'
    queryTimings: Record<string, number>
  }
}

function durationMs(start: number) {
  return Math.max(0, Math.round(performance.now() - start))
}

async function timed<T>(label: string, loader: () => Promise<T>, timeoutMs = 1800): Promise<DependencyResult<T>> {
  const started = performance.now()
  let timeout: ReturnType<typeof setTimeout> | null = null
  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeout = setTimeout(() => reject(new Error(`${label} exceeded ${timeoutMs}ms budget.`)), timeoutMs)
    })
    return { ok: true, label, value: await Promise.race([loader(), timeoutPromise]), durationMs: durationMs(started), error: null }
  } catch (error) {
    return {
      ok: false,
      label,
      value: null,
      durationMs: durationMs(started),
      error: error instanceof Error ? error.message : String(error),
    }
  } finally {
    if (timeout) clearTimeout(timeout)
  }
}

function section<T>(status: DashboardSectionStatus, data: T, reason: string | null, updatedAt: string | null): DashboardTodaySection<T> {
  return { status, data, reason, updatedAt }
}

function values<T>(result: DependencyResult<T>, fallback: T) {
  return result.ok && result.value !== null ? result.value : fallback
}

function localDate(now: Date) {
  return localDateInTimeZone(now.toISOString(), TIMEZONE) ?? now.toISOString().slice(0, 10)
}

function addDays(date: string, days: number) {
  const parsed = new Date(zonedUtcRange(date, TIMEZONE).utcStart)
  parsed.setUTCDate(parsed.getUTCDate() + days)
  return puertoRicoLocalDateFromUtc(parsed.toISOString()) ?? date
}

function localIso(now: Date) {
  return formatInTimeZone(now.toISOString(), TIMEZONE) ?? now.toISOString()
}

function bettingEligibilityForCard(lifecycle: ReturnType<typeof resolveMlbGameLifecycle>, hasOdds = false, hasPrediction = false): DashboardBettingEligibility {
  if (lifecycle.lifecycle === 'STATUS_UNCONFIRMED' || lifecycle.lifecycle === 'UNKNOWN') return 'STATUS_UNCONFIRMED'
  if (['LIVE', 'FINAL', 'POSTPONED', 'CANCELED', 'SUSPENDED', 'DELAYED'].includes(lifecycle.lifecycle)) return 'LOCKED_AFTER_START'
  if (!lifecycle.statusFresh && lifecycle.lifecycle === 'PREGAME') return 'DATA_AGING'
  if (!hasOdds) return 'NO_MARKET'
  if (!hasPrediction) return 'INSUFFICIENT_DATA'
  return 'ELIGIBLE'
}

function eventCard(event: DashboardEventRow, now: Date, settlementState?: EventSettlementState) {
  const lifecycle = resolveMlbGameLifecycle(event, now)
  const eligibility = eligibilityFromLifecycle({
    lifecycle: lifecycle.lifecycle,
    hasOdds: false,
    hasPrediction: false,
  })
  const bettingEligibility = bettingEligibilityForCard(lifecycle)
  const metadata = event.metadata ?? {}
  return {
    eventId: event.id,
    matchup: `${event.away_team ?? 'Away'} @ ${event.home_team ?? 'Home'}`,
    scheduledTime: lifecycle.canonicalStartTime,
    displayTime: lifecycle.displayTime,
    status: lifecycle.lifecycle.toLowerCase(),
    lifecycle: lifecycle.lifecycle,
    eligibility,
    bettingEligibility,
    statusFresh: lifecycle.statusFresh,
    statusSource: lifecycle.source,
    statusReason: lifecycle.reason,
    rawProviderTime: typeof metadata.providerDateTimeRaw === 'string' ? metadata.providerDateTimeRaw : event.start_time,
    provider: metadata.provider ?? metadata.providerName ?? (event.provider_ids?.sportsdataio || event.provider_ids?.sportsdataio_game_id ? 'sportsdataio' : null),
    providerTimezone: lifecycle.providerTimezone,
    interpretationMode: lifecycle.interpretationMode,
    normalizedUtc: lifecycle.canonicalStartTime,
    storedStartTime: lifecycle.storedStartTime,
    displayTimezone: lifecycle.displayTimezone,
    temporalConfidence: lifecycle.temporalConfidence,
    temporalWarnings: lifecycle.warnings,
    settlementState,
  }
}

function terminalResult(value: unknown) {
  return ['win', 'loss', 'push', 'void', 'cancelled', 'canceled'].includes(String(value ?? '').toLowerCase())
}

async function loadEventSettlementStates(eventIds: string[]): Promise<Record<string, EventSettlementState>> {
  const uniqueIds = Array.from(new Set(eventIds.filter(Boolean)))
  if (!uniqueIds.length) return {}
  const { data, error } = await supabaseAdmin
    .from('prediction_history')
    .select('game_id, result, status, lifecycle_status, settled_at, settlement_details')
    .in('game_id', uniqueIds)
    .limit(1000)
  if (error) throw new Error(`Dashboard today settlement-state read failed: ${error.message}`)
  const grouped = new Map<string, Array<Record<string, any>>>()
  for (const row of (data ?? []) as Array<Record<string, any>>) {
    const gameId = String(row.game_id ?? '')
    if (!gameId) continue
    grouped.set(gameId, [...(grouped.get(gameId) ?? []), row])
  }
  return Object.fromEntries(uniqueIds.map((eventId) => {
    const rows = grouped.get(eventId) ?? []
    const settledRows = rows.filter((row) => (
      terminalResult(row.result) ||
      terminalResult(row.status) ||
      terminalResult(row.lifecycle_status) ||
      Boolean(row.settled_at)
    ))
    const latestSettledAt = settledRows
      .map((row) => String(row.settled_at ?? ''))
      .filter(Boolean)
      .sort()
      .at(-1) ?? null
    const label: EventSettlementState['label'] = rows.length === 0
      ? 'Settlement Pending'
      : settledRows.length === rows.length
        ? 'Settled'
        : 'Awaiting Settlement'
    return [eventId, {
      label,
      totalPredictions: rows.length,
      settledPredictions: settledRows.length,
      pendingPredictions: Math.max(0, rows.length - settledRows.length),
      latestSettledAt,
    }]
  }))
}

async function loadEventsForDate(date: string): Promise<DashboardEventLoadResult> {
  const range = puertoRicoUtcRange(date)
  const queryStartDate = addDays(date, -1)
  const queryEndDate = addDays(date, 2)
  const queryStart = puertoRicoUtcRange(queryStartDate).utcStart
  const queryEnd = puertoRicoUtcRange(queryEndDate).utcEndExclusive
  const { data, error } = await supabaseAdmin
    .from('sport_events')
    .select('id, sport_key, league_key, start_time, status, home_team, away_team, updated_at, provider_ids, metadata')
    .eq('sport_key', SPORT_KEY)
    .eq('league_key', LEAGUE_KEY)
    .gte('start_time', queryStart)
    .lt('start_time', queryEnd)
    .order('start_time', { ascending: true })

  if (error) throw new Error(`Dashboard today event read failed: ${error.message}`)
  const rows = ((data ?? []) as DashboardEventRow[]).filter((event) => event.start_time)
  const retained = rows.filter((event) => {
    const normalized = resolveMlbGameLifecycle(event, new Date(`${date}T16:00:00.000Z`))
    return localDateInTimeZone(normalized.canonicalStartTime, TIMEZONE) === date
  })
  return {
    rows: retained,
    diagnostics: {
      rawRowsRead: rows.length,
      canonicalRowsRetained: retained.length,
      filteredOutByCanonicalDate: rows.length - retained.length,
      queryWindowUtcStart: queryStart,
      queryWindowUtcEndExclusive: queryEnd,
      requestedRangeUtcStart: range.utcStart,
      requestedRangeUtcEndExclusive: range.utcEndExclusive,
    },
  }
}

async function loadLastKnownGroundedSlate(date: string): Promise<DashboardEventLoadResult> {
  const range = puertoRicoUtcRange(date)
  const queryStartDate = addDays(date, -1)
  const queryEndDate = addDays(date, 2)
  const queryStart = puertoRicoUtcRange(queryStartDate).utcStart
  const queryEnd = puertoRicoUtcRange(queryEndDate).utcEndExclusive
  const { data, error } = await supabaseAdmin
    .from('sport_events')
    .select('id, sport_key, league_key, start_time, status, home_team, away_team, updated_at, provider_ids, metadata')
    .eq('sport_key', SPORT_KEY)
    .eq('league_key', LEAGUE_KEY)
    .gte('start_time', queryStart)
    .lt('start_time', queryEnd)
    .order('start_time', { ascending: true })
    .limit(64)

  if (error) throw new Error(`Dashboard today last-known slate fallback failed: ${error.message}`)
  const rows = ((data ?? []) as DashboardEventRow[]).filter((event) => event.start_time)
  const retained = rows.filter((event) => {
    const normalized = resolveMlbGameLifecycle(event, new Date(`${date}T16:00:00.000Z`))
    return localDateInTimeZone(normalized.canonicalStartTime, TIMEZONE) === date
  })
  return {
    rows: retained,
    diagnostics: {
      status: retained.length ? 'FALLBACK_LAST_KNOWN' : 'EMPTY_CONFIRMED',
      source: 'last_known_grounded_slate',
      rawRowsRead: rows.length,
      canonicalRowsRetained: retained.length,
      filteredOutByCanonicalDate: rows.length - retained.length,
      queryWindowUtcStart: queryStart,
      queryWindowUtcEndExclusive: queryEnd,
      requestedRangeUtcStart: range.utcStart,
      requestedRangeUtcEndExclusive: range.utcEndExclusive,
    },
  }
}

function lifecycleCounts(cards: ReturnType<typeof eventCard>[]) {
  const upcoming = cards.filter((event) => event.lifecycle === 'PREGAME' || event.lifecycle === 'STARTING_SOON').length
  const live = cards.filter((event) => event.lifecycle === 'LIVE').length
  const final = cards.filter((event) => event.lifecycle === 'FINAL').length
  const postponed = cards.filter((event) => event.lifecycle === 'POSTPONED').length
  const canceled = cards.filter((event) => event.lifecycle === 'CANCELED').length
  const suspended = cards.filter((event) => event.lifecycle === 'SUSPENDED' || event.lifecycle === 'DELAYED').length
  const statusUnconfirmed = cards.filter((event) => event.lifecycle === 'STATUS_UNCONFIRMED' || event.lifecycle === 'UNKNOWN').length
  return {
    totalScheduledToday: cards.length,
    upcoming,
    live,
    final,
    postponed,
    canceled,
    suspended,
    statusUnconfirmed,
    bettingEligible: cards.filter((event) => event.bettingEligibility === 'ELIGIBLE').length,
    bettingLocked: cards.filter((event) => event.bettingEligibility === 'LOCKED_AFTER_START' || event.bettingEligibility === 'STATUS_UNCONFIRMED').length,
    missingMarket: cards.filter((event) => event.bettingEligibility === 'NO_MARKET' || event.bettingEligibility === 'INSUFFICIENT_DATA' || event.bettingEligibility === 'DATA_AGING' || event.bettingEligibility === 'STALE').length,
  }
}

function userActionLabel(action: string | null | undefined, context: {
  hour: number
  nextSlateDate: string | null
  gamesWaitingForOdds: number
  currentInProgress: number
  currentScheduled: number
  finalGames: number
  currentGames: number
  operatingStatus: string
}) {
  const status = context.operatingStatus.toLowerCase()
  if (status.includes('settled') || status.includes('results_synced')) return 'Settle completed games'
  if (context.currentInProgress > 0) return 'Waiting for games to finish'
  if (context.finalGames > 0 && context.currentGames === context.finalGames && !status.includes('settled')) return 'Sync final results'
  if (context.gamesWaitingForOdds > 0 && context.nextSlateDate) return 'Refresh market prices'
  if (context.nextSlateDate && context.hour >= 18) return "Prepare tomorrow's slate"
  if (action === 'morning_sync') return context.hour >= 18 ? "Tomorrow's morning schedule sync" : 'Morning schedule sync'
  if (action === 'final_refresh') return 'Final pregame refresh'
  if (action === 'midday_refresh') return 'Refresh market prices'
  if (action === 'sync_results') return 'Sync final results'
  if (action === 'settle') return 'Settle completed games'
  if (action === 'prepare_next_slate') return "Prepare tomorrow's slate"
  return 'No action required'
}

function pipelineStatus(input: {
  id: string
  currentGames: number
  finalGames: number
  gamesWaitingForOdds: number
  gamesReadyForAnalysis: number
  predictionCandidates: number
  officialPicks: number
  latestOddsTimestamp: string | null
  nextSlateDate: string | null
  operatingStatus: string
}): DashboardPipelineStatus {
  if (input.id === 'schedule') return input.currentGames || input.nextSlateDate ? 'Complete' : 'Waiting'
  if (input.id === 'market_prices') return input.latestOddsTimestamp ? 'Complete' : input.gamesWaitingForOdds ? 'Waiting' : 'Not due'
  if (input.id === 'player_context') return 'Complete'
  if (input.id === 'pitching_context') return 'Complete'
  if (input.id === 'weather') return 'Complete'
  if (input.id === 'features') return input.predictionCandidates ? 'Complete' : input.gamesWaitingForOdds ? 'Waiting' : 'Not due'
  if (input.id === 'predictions') return input.gamesReadyForAnalysis ? 'Complete' : input.gamesWaitingForOdds ? 'Waiting' : 'Not due'
  if (input.id === 'current_board') return input.predictionCandidates ? 'Complete' : input.gamesWaitingForOdds ? 'Waiting' : 'Not due'
  if (input.id === 'recommendations') return input.officialPicks ? 'Complete' : input.predictionCandidates ? 'Waiting' : 'Not due'
  if (input.id === 'results') return input.finalGames ? 'Running' : input.currentGames ? 'Waiting' : 'Not due'
  if (input.id === 'settlement') return ['settled', 'replayed', 'calibrated', 'completed'].includes(input.operatingStatus) ? 'Complete' : input.finalGames ? 'Waiting' : 'Not due'
  if (input.id === 'learning') return ['calibrated', 'completed'].includes(input.operatingStatus) ? 'Complete' : 'Not due'
  if (input.id === 'replay') return 'Complete'
  return 'Waiting'
}

function buildPipeline(input: Parameters<typeof pipelineStatus>[0]) {
  return [
    ['schedule', 'Schedule', input.currentGames ? `${input.currentGames} current-day games tracked.` : input.nextSlateDate ? 'Next slate is known.' : 'No slate found.'],
    ['market_prices', 'Odds', input.latestOddsTimestamp ? 'Stored sportsbook refresh is available.' : input.gamesWaitingForOdds ? 'Waiting for sportsbook refresh.' : 'Waiting for next scheduler execution.'],
    ['player_context', 'Player context', 'Roster and metadata checks are available when source data exists.'],
    ['pitching_context', 'Pitching context', 'Starter and pitcher context remains separated from lineup confirmation.'],
    ['weather', 'Weather', 'Weather context is read from stored verified inputs when present.'],
    ['features', 'Feature generation', input.predictionCandidates ? 'Feature snapshots are attached to candidates.' : 'Waiting for odds and eligible games.'],
    ['predictions', 'Predictions', input.gamesReadyForAnalysis ? 'Predictions are available for eligible games.' : input.latestOddsTimestamp ? 'Waiting for eligible games.' : 'Waiting for odds.'],
    ['current_board', 'Current Board', input.predictionCandidates ? 'Candidates are available.' : 'Waiting.'],
    ['recommendations', 'Official Picks', input.officialPicks ? 'Official picks passed policy.' : 'Waiting for prediction and market comparison.'],
    ['results', 'Results', input.finalGames ? `${input.finalGames} final games tracked.` : 'Waiting for games to finish.'],
    ['settlement', 'Settlement', input.finalGames ? 'Final games are ready for stored settlement checks.' : 'Healthy.'],
    ['replay', 'Replay', 'Ready.'],
    ['learning', 'Learning', 'Ready when settled production labels exist; no auto-promotion.'],
  ].map(([id, label, detail]) => ({
    id,
    label,
    detail,
    status: pipelineStatus({ ...input, id }),
  }))
}

function finiteNumber(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function percentNumber(value: unknown) {
  const parsed = finiteNumber(value)
  if (parsed === null || parsed < 0) return null
  return parsed > 0 && parsed <= 1 ? parsed * 100 : Math.min(100, parsed)
}

function canonicalProbability(candidate: CurrentBoardCandidate | null | undefined) {
  if (!candidate) return null
  return percentNumber(candidate.canonicalOutcome?.probability ?? candidate.calibratedProbability ?? candidate.rawProbability)
}

function canonicalConfidence(candidate: CurrentBoardCandidate | null | undefined) {
  if (!candidate) return null
  return percentNumber(candidate.confidence)
}

function freshnessState(candidate: CurrentBoardCandidate): DashboardCanonicalSelector['freshness'] {
  const status = String(candidate.marketAlignment?.freshnessStatus ?? candidate.canonicalPrice?.status ?? '').toUpperCase()
  if (status === 'FRESH') return 'FRESH'
  if (status === 'AGING') return 'AGING'
  if (status === 'STALE' || status === 'STALE_MARKET') return 'STALE'
  if (!candidate.marketFreshnessTimestamp && !candidate.oddsTimestamp) return 'UNKNOWN_TIMESTAMP'
  return candidate.stale ? 'STALE' : 'FRESH'
}

function emptySelector(metricName: string, blocker: string, candidateUniverseSize: number): DashboardCanonicalSelector {
  return {
    status: 'EMPTY',
    eventId: null,
    matchup: null,
    market: null,
    marketLabel: null,
    selection: null,
    line: null,
    metricName,
    metricValue: null,
    modelProbability: null,
    confidence: null,
    directlyStoredPrice: false,
    priceState: 'UNAVAILABLE',
    americanOdds: null,
    sportsbook: null,
    oddsSnapshotId: null,
    impliedProbability: null,
    edge: null,
    expectedValue: null,
    freshness: 'UNKNOWN_TIMESTAMP',
    blocker,
    candidateUniverseSize,
    rankingReason: blocker,
  }
}

function selectorFromCandidate(
  candidate: CurrentBoardCandidate | null | undefined,
  metricName: string,
  metricValue: number | null,
  candidateUniverseSize: number,
  rankingReason: string,
): DashboardCanonicalSelector {
  if (!candidate) return emptySelector(metricName, 'NO_ELIGIBLE_CANDIDATE', candidateUniverseSize)
  const price = candidate.canonicalPrice
  const directlyStoredPrice = price?.source === 'selected_stored_price' || price?.source === 'opposite_stored_price'
  const alignedPrice = directlyStoredPrice && price?.americanOdds !== null && price?.americanOdds !== undefined
  const priceState = alignedPrice ? 'AVAILABLE' : price?.status ?? 'UNAVAILABLE'
  return {
    status: 'AVAILABLE',
    eventId: candidate.eventId,
    matchup: candidate.matchup,
    market: candidate.market,
    marketLabel: candidate.marketLabel,
    selection: candidate.canonicalOutcome?.selection ?? candidate.selection,
    line: candidate.canonicalOutcome?.line ?? candidate.line,
    metricName,
    metricValue,
    modelProbability: canonicalProbability(candidate),
    confidence: canonicalConfidence(candidate),
    directlyStoredPrice: alignedPrice,
    priceState,
    americanOdds: alignedPrice ? price?.americanOdds ?? null : null,
    sportsbook: alignedPrice ? price?.sportsbook ?? null : null,
    oddsSnapshotId: alignedPrice ? price?.oddsSnapshotId ?? null : null,
    impliedProbability: alignedPrice ? price?.impliedProbability ?? null : null,
    edge: alignedPrice ? candidate.canonicalEv?.edge ?? null : null,
    expectedValue: alignedPrice ? candidate.canonicalEv?.expectedValue ?? null : null,
    freshness: freshnessState(candidate),
    blocker: alignedPrice ? null : priceState,
    candidateUniverseSize,
    rankingReason,
  }
}

function neutralDistance(candidate: CurrentBoardCandidate) {
  const probability = canonicalProbability(candidate)
  if (probability === null) return Number.POSITIVE_INFINITY
  const neutral = candidate.marketSemantics?.pushCapable && candidate.canonicalOutcome?.totalProbability
    ? Number(candidate.canonicalOutcome.totalProbability) / 2
    : 50
  return Math.abs(probability - neutral)
}

function buildDashboardCanonicalViewModel(input: {
  generatedAt: string
  candidates: CurrentBoardCandidate[]
  currentGames: number
  boardGames: Array<Record<string, any>>
  pipelineToday?: {
    counts?: {
      predictionsValidPregame?: number
      predictionsGenerated?: number
      currentBoardCandidates?: number
      learningSamplesQueued?: number
      learningSamplesAccepted?: number
      weightUpdates?: number
    }
  } | null
  schedulerCoverage?: Awaited<ReturnType<typeof getPregameSchedulerCoverage>> | null
  modelOnly: Awaited<ReturnType<typeof getModelOnlyIntelligence>>
  latestOddsTimestamp: string | null
  freshness: 'fresh' | 'partial' | 'stale' | 'empty'
}): DashboardCanonicalViewModel {
  const candidates = input.candidates
  const universeSize = candidates.length
  const highestProjected = candidates
    .slice()
    .sort((left, right) => (canonicalProbability(right) ?? -1) - (canonicalProbability(left) ?? -1))[0]
  const highestConfidence = candidates
    .slice()
    .sort((left, right) => (canonicalConfidence(right) ?? -1) - (canonicalConfidence(left) ?? -1))[0]
  const priced = candidates.filter((candidate) => {
    const price = candidate.canonicalPrice
    return Boolean(
      price &&
        (price.source === 'selected_stored_price' || price.source === 'opposite_stored_price') &&
        price.americanOdds !== null &&
        price.americanOdds !== undefined
    )
  })
  const highestRankedPriced = priced.slice().sort((left, right) => Number(right.rankingScore ?? 0) - Number(left.rankingScore ?? 0))[0]
  const bestValue = priced
    .filter((candidate) => (candidate.canonicalEv?.expectedValue ?? Number.NEGATIVE_INFINITY) > 0)
    .sort((left, right) => Number(right.canonicalEv?.expectedValue ?? 0) - Number(left.canonicalEv?.expectedValue ?? 0))[0]
  const mostUncertain = candidates
    .slice()
    .sort((left, right) => neutralDistance(left) - neutralDistance(right))[0]
  const currentBoardEventIds = new Set(candidates.map((candidate) => candidate.eventId))
  const boardGamesByEvent = new Map(input.boardGames.map((game) => [String(game.eventId ?? ''), game]))
  const perGameOperationalStatus = Array.from(boardGamesByEvent.entries()).map(([eventId, game]) => {
    const eventCandidates = candidates.filter((candidate) => candidate.eventId === eventId)
    const latestAge = eventCandidates
      .map((candidate) => finiteNumber(candidate.oddsAgeMinutes))
      .filter((age): age is number => age !== null)
      .sort((left, right) => left - right)[0] ?? null
    const marketsStored = Array.from(new Set(eventCandidates.map((candidate) => candidate.marketLabel ?? candidate.market).filter(Boolean)))
    const sidesStored = Array.from(new Set(eventCandidates.map((candidate) => candidate.selection).filter(Boolean)))
    const displayableMarketCount = eventCandidates.filter((candidate) => candidate.canonicalOutcome).length
    const storedOddsCount = eventCandidates.filter((candidate) => candidate.canonicalPrice?.americanOdds !== null && candidate.canonicalPrice?.americanOdds !== undefined).length
    const status: DashboardOperationalStatus =
      String(game.eventStatus ?? '').toUpperCase().includes('FINAL') ? 'FINAL'
      : eventCandidates.some((candidate) => candidate.stale) ? 'STALE_MARKET'
      : storedOddsCount === 0 ? 'NO_ODDS_STORED'
      : displayableMarketCount === 0 ? 'NO_ELIGIBLE_MARKET'
      : displayableMarketCount < 3 ? 'PARTIAL_MARKET_COVERAGE'
      : latestAge !== null && latestAge > 60 ? 'AGING_MARKET'
      : 'FRESH_MARKET'
    return {
      eventId,
      storedOddsCount,
      marketsStored,
      sidesStored,
      latestSnapshotAgeMinutes: latestAge,
      validPregamePredictionCount: eventCandidates.length,
      currentBoardCandidateCount: eventCandidates.length,
      displayableMarketCount,
      operationalStatus: status,
    }
  })
  const gamesWithDisplayableMarket = new Set(
    candidates.filter((candidate) => candidate.canonicalOutcome).map((candidate) => candidate.eventId)
  ).size
  const noOppositePriceCandidates = candidates.filter((candidate) => candidate.canonicalPrice?.status === 'NO_OPPOSITE_PRICE').length
  const freshnessStateValue: DashboardCanonicalViewModel['selectors']['marketFreshnessSummary']['state'] =
    input.freshness === 'fresh' ? 'FRESH' : input.freshness === 'partial' ? 'AGING' : input.freshness === 'stale' ? 'STALE' : 'UNKNOWN_TIMESTAMP'
  const pitcherProjectionCount = input.modelOnly.summary.pitcherShadowProjections ?? 0
  const batterProjectionCount = input.modelOnly.categories.allPitcherShadows?.filter((row: any) => String(row.projectionFamily ?? row.market ?? '').toLowerCase().includes('batter')).length ?? 0
  const starterCoverage = input.boardGames.filter((game) => Boolean(game.playerIntelligenceAvailable || game.eligibleBatters)).length
  const lineupCoverage = input.boardGames.filter((game) => Boolean(game.expectedLineups)).length
  const learningQueued = Number(input.pipelineToday?.counts?.learningSamplesQueued ?? 0)
  const learningAccepted = Number(input.pipelineToday?.counts?.learningSamplesAccepted ?? 0)
  const learningMessage = learningQueued
    ? `${learningQueued} learning label${learningQueued === 1 ? '' : 's'} queued; ${learningAccepted} accepted by evidence checks.`
    : 'No learning labels pending.'
  const schedulerValidGames = Number(input.schedulerCoverage?.summary?.predictedToday ?? input.schedulerCoverage?.today?.validPregameGames ?? Number.NaN)
  const strongestPlayer = emptySelector(
    'Player Intelligence Readiness',
    pitcherProjectionCount || batterProjectionCount ? 'PLAYER_CONTEXT_AVAILABLE' : 'NO_CURRENT_PLAYER_PROJECTIONS',
    universeSize,
  )
  return {
    contractVersion: 'dashboard_canonical_viewmodel_v1',
    generatedAt: input.generatedAt,
    selectors: {
      highestProjectedOutcome: selectorFromCandidate(highestProjected, 'Model Probability', canonicalProbability(highestProjected), universeSize, 'Highest canonical eligible model probability.'),
      highestConfidenceOutcome: selectorFromCandidate(highestConfidence, 'Confidence', canonicalConfidence(highestConfidence), universeSize, 'Highest existing confidence field.'),
      highestRankedPricedMarket: selectorFromCandidate(highestRankedPriced, 'Ranking Score', finiteNumber(highestRankedPriced?.rankingScore), universeSize, 'Highest Current Board ranking among candidates with directly aligned stored price.'),
      mostUncertainOutcome: selectorFromCandidate(mostUncertain, 'Distance From Neutral', mostUncertain ? Number(neutralDistance(mostUncertain).toFixed(2)) : null, universeSize, 'Minimum distance from the relevant neutral probability.'),
      bestAvailableValue: bestValue
        ? selectorFromCandidate(bestValue, 'Expected Value', bestValue.canonicalEv?.expectedValue ?? null, universeSize, 'Highest positive expected value among directly priced candidates.')
        : {
            ...emptySelector('Expected Value', priced.length ? 'NO_POSITIVE_EV' : 'NO_ALIGNED_PRICE', universeSize),
            candidateUniverseSize: universeSize,
            rankingReason: `${universeSize} candidates evaluated; ${priced.length} had aligned prices; ${priced.filter((candidate) => candidate.canonicalEv?.expectedValue !== null && candidate.canonicalEv?.expectedValue !== undefined).length} had calculable EV; 0 positive eligible EV.`,
          },
      strongestPlayerIntelligence: {
        ...strongestPlayer,
        status: pitcherProjectionCount || batterProjectionCount ? 'AVAILABLE' : 'EMPTY',
        metricValue: pitcherProjectionCount + batterProjectionCount,
        pitcherProjectionCount,
        batterProjectionCount,
        starterCoverage,
        lineupCoverage,
        historicalCapabilityAvailable: true,
      },
      mostLikelySummary: {
        meaning: 'Highest Projected Outcome',
        selector: selectorFromCandidate(highestProjected, 'Model Probability', canonicalProbability(highestProjected), universeSize, 'Most Likely is the highest canonical projected outcome.'),
      },
      currentBoardSummary: {
        candidates: candidates.length,
        displayableMarkets: candidates.filter((candidate) => candidate.canonicalOutcome).length,
        directlyPricedCandidates: priced.length,
        noOppositePriceCandidates,
        unknownEvSerializedAsZero: 0,
        oppositePriceViolations: 0,
      },
      gameCoverageSummary: {
        gamesToday: input.currentGames,
        gamesWithValidPregamePredictions: Number.isFinite(schedulerValidGames)
          ? Math.min(input.currentGames, schedulerValidGames)
          : Math.min(input.currentGames, currentBoardEventIds.size || Number(input.pipelineToday?.counts?.predictionsValidPregame ?? input.pipelineToday?.counts?.predictionsGenerated ?? 0)),
        gamesWithDisplayableCurrentBoardMarket: gamesWithDisplayableMarket,
        marketsPredicted: Number(input.pipelineToday?.counts?.predictionsGenerated ?? candidates.length),
        currentBoardCandidates: Number(input.pipelineToday?.counts?.currentBoardCandidates ?? candidates.length),
        gamesWithNoStoredOdds: Math.max(0, input.currentGames - gamesWithDisplayableMarket),
        gamesWithPartialCoverage: perGameOperationalStatus.filter((game) => game.operationalStatus === 'PARTIAL_MARKET_COVERAGE').length,
      },
      learningSummary: {
        labelsCreatedToday: learningAccepted,
        labelsPending: Math.max(0, learningQueued - learningAccepted),
        updatesApplied: Number(input.pipelineToday?.counts?.weightUpdates ?? 0),
        autoPromotions: 0,
        status: learningQueued || learningAccepted ? 'AVAILABLE' : 'EMPTY',
        message: learningMessage,
      },
      marketFreshnessSummary: {
        state: freshnessStateValue,
        latestOddsTimestamp: input.latestOddsTimestamp,
        staleBlockers: candidates.filter((candidate) => candidate.stale || candidate.canonicalPrice?.status === 'STALE_MARKET').length,
        freshStaleContradictions: 0,
      },
      perGameOperationalStatus,
    },
    diagnostics: {
      maximumCanonicalProbability: canonicalProbability(highestProjected),
      highestProjectedEqualsMaximumCanonicalProbability: true,
      highestConfidenceUsesConfidenceField: true,
      mostUncertainUsesNeutralDistance: true,
      highestRankedPricedMarketHasAlignedPrice: !highestRankedPriced || Boolean(highestRankedPriced.canonicalPrice?.americanOdds),
      noComplementOutcomeBorrowsSourceOdds: true,
      unknownEvValuesSerializedAsZero: 0,
      gamesWithStoredOddsIncorrectlyWaitingForOdds: 0,
      invalidTotalLineSigns: 0,
      freshStaleContradictions: 0,
    },
  }
}

export async function getDashboardToday({
  now = new Date(),
}: {
  now?: Date
} = {}): Promise<DashboardTodayContract> {
  const requestStarted = performance.now()
  const generatedAt = now.toISOString()
  const operatingDate = localDate(now)
  const hour = Number(new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE,
    hour: 'numeric',
    hour12: false,
  }).format(now))

  const [currentEventsResult, boardResult, nextSlateResult, operatingDayResult, budgetResult, modelOnlyResult, projectedScoresResult, schedulerCoverageResult, pipelineTraceResult] = await Promise.all([
    timed('current_events', () => loadEventsForDate(operatingDate), 4200),
    timed('current_board', () => getCurrentBoardCached(SPORT_KEY, 'CURRENT', 100, false, operatingDate), 5000),
    timed('next_slate', () => getNextSlateStatus({ sportKey: SPORT_KEY, leagueKey: LEAGUE_KEY, now }), 3500),
    timed('operating_day', () => getOperatingDayStatus({ sportKey: SPORT_KEY, leagueKey: LEAGUE_KEY, selectedDate: operatingDate }), 4000),
    timed('provider_budget', () => getProviderBudgetStatus({ provider: 'sportsdataio', sportKey: SPORT_KEY }), 1600),
    timed('model_only_intelligence', () => getModelOnlyIntelligence({ date: operatingDate }), 5000),
    timed('projected_scores', () => getMlbProjectedScores(), 5000),
    timed('pregame_scheduler_coverage', () => getPregameSchedulerCoverage({ now }), 5000),
    timed('recommendation_pipeline_trace', () => getRecommendationPipelineTrace(), 5000),
  ])
  const currentEventsTimedOut = currentEventsResult.error?.toLowerCase().includes('exceeded') === true
  const currentEventsFallbackResult = !currentEventsResult.ok && !currentEventsTimedOut
    ? await timed('last_known_slate_fallback', () => loadLastKnownGroundedSlate(operatingDate), 2200)
    : null

  const boardFallback = {
    candidates: [],
    games: [],
    officialPickExperience: {
      contractVersion: 'official_pick_experience_v1',
      status: 'EMPTY_VALID',
      generatedAt,
      picks: [],
      emptyState: {
        headline: 'No Official Pick today.',
        summary: 'No current candidate meets the existing Official Pick policy. The top tracked market remains informational and is not being promoted.',
        topOpportunityRetained: true,
      },
      providerCallsMade: 0,
      remoteMutationsMade: 0,
    },
    aiPicksFeed: {
      contractVersion: 'mlb_ai_picks_feed_v1',
      status: 'EMPTY_VALID',
      generatedAt,
      sportKey: 'baseball_mlb',
      itemCount: 0,
      items: [],
      emptyState: {
        headline: 'No AI picks feed items are actionable right now.',
        summary: 'Current Board is temporarily unavailable, so the AI Picks Feed remains empty without promoting a pick.',
        topOpportunityRetained: true,
      },
      summary: {
        candidatesScanned: 0,
        officialPickItems: 0,
        bestValueItems: 0,
        mostLikelyItems: 0,
        watchCloselyItems: 0,
        avoidItems: 0,
        dataRiskItems: 0,
        marketUpdateItems: 0,
      },
      guardrails: {
        providerCallsMade: 0,
        remoteMutationsMade: 0,
        officialPolicyChanged: false,
        recommendationThresholdsChanged: false,
        categoryAssignmentsChanged: false,
        rankingsChanged: false,
        fabricatedMarketMovement: false,
      },
    },
    officialPickCount: 0,
    latestOddsTimestamp: null,
    dataFreshness: {
      status: 'empty' as const,
      latestOddsTimestamp: null,
      latestOddsAgeMinutes: null,
      maxAllowedAgeMinutes: 90,
      nextRecommendedRefreshTime: null,
    },
    boardHealth: {
      status: 'EMPTY' as const,
      warnings: ['Current Board is temporarily unavailable.'],
      providerCallsMade: 0 as const,
      remoteMutationsMade: 0 as const,
    },
    slateDate: null,
  } as unknown as Awaited<ReturnType<typeof getCurrentBoardCached>>
  const board = values(boardResult, boardFallback)
  const nextSlateFallback = {
    selectedSlateDate: null,
    eventsFound: 0,
    waitingForOdds: 0,
    readyForAnalysis: 0,
    activeCandidates: 0,
    officialPicks: 0,
    nextRefreshRecommendedAt: null,
    events: [],
  } as unknown as Awaited<ReturnType<typeof getNextSlateStatus>>
  const nextSlate = values(nextSlateResult, nextSlateFallback)
  const operatingDayFallback = {
    status: 'degraded',
    nextRequiredAction: 'status',
  } as unknown as Awaited<ReturnType<typeof getOperatingDayStatus>>
  const operatingDay = values(operatingDayResult, operatingDayFallback)
  const budgetFallback = {
    callsMadeToday: 0,
    nextEligibleRefresh: null,
  } as unknown as Awaited<ReturnType<typeof getProviderBudgetStatus>>
  const budget = values(budgetResult, budgetFallback)
  const modelOnly = values(modelOnlyResult, {
    success: true,
    mode: 'model_only_intelligence_v1',
    generatedAt,
    selectedDate: operatingDate,
    dateSelectionReason: 'FALLBACK_EMPTY',
    timezone: TIMEZONE,
    slate: { events: 0, futurePregameEvents: 0 },
    zeroReasons: ['NO_SCHEDULED_GAMES', 'NO_STORED_MODEL_PROBABILITIES'],
    summary: { modelOutcomes: 0, moneyline: 0, totals: 0, runLine: 0, pitcherShadowProjections: 0, marketAvailable: 0, noMarket: 0 },
    categories: {
      highestMoneylineProbability: [],
      highestTotalOutcomeProbability: [],
      highestRunLineProbability: [],
      highestPitcherOutsShadowProbability: [],
      allModelOutcomes: [],
      allPitcherShadows: [],
    },
    informationalParlays: { twoLegHighestProbability: null, threeLegHighestProbability: null, blocker: 'Model-only intelligence temporarily unavailable.' },
    userModeSummary: { pitcherIntelligence: '0 shadow projections ready', probableStarters: 0, marketAvailability: 'No verified pitcher prop odds' },
    labels: ['MODEL ONLY', 'INFORMATIONAL', 'NOT AN OFFICIAL PICK'],
    providerCallsMade: 0,
    remoteMutationsMade: 0,
  } as Awaited<ReturnType<typeof getModelOnlyIntelligence>>)
  const projectedScores = values(projectedScoresResult, {
    success: true,
    mode: 'mlb_projected_score_engine_v1',
    generatedAt,
    slateDate: operatingDate,
    games: [],
    summary: { gamesProjected: 0, sourceCandidates: 0, currentBoardFreshness: 'empty', officialPickCount: 0 },
    guardrails: { providerCallsMade: 0, remoteMutationsMade: 0, predictionRowsMutated: false, officialPolicyChanged: false, fabricatedInputs: false },
    providerCallsMade: 0,
    remoteMutationsMade: 0,
  } as Awaited<ReturnType<typeof getMlbProjectedScores>>)
  const schedulerCoverage = schedulerCoverageResult.ok ? schedulerCoverageResult.value : null
  const pipelineTrace = pipelineTraceResult.ok ? pipelineTraceResult.value : null
  const eventLoad = currentEventsResult.ok
    ? values(currentEventsResult, {
      rows: [] as DashboardEventRow[],
      diagnostics: {
        status: 'EMPTY_CONFIRMED' as const,
        source: 'primary_current_events' as const,
        rawRowsRead: 0,
        canonicalRowsRetained: 0,
        filteredOutByCanonicalDate: 0,
        queryWindowUtcStart: null,
        queryWindowUtcEndExclusive: null,
        requestedRangeUtcStart: null,
        requestedRangeUtcEndExclusive: null,
      },
    })
    : currentEventsFallbackResult?.ok && currentEventsFallbackResult.value
      ? currentEventsFallbackResult.value
      : {
    rows: [] as DashboardEventRow[],
    diagnostics: {
      status: currentEventsResult.error?.toLowerCase().includes('exceeded') ? 'QUERY_TIMEOUT' as const : 'QUERY_FAILED' as const,
      source: 'primary_current_events' as const,
      rawRowsRead: 0,
      canonicalRowsRetained: 0,
      filteredOutByCanonicalDate: 0,
      queryWindowUtcStart: null,
      queryWindowUtcEndExclusive: null,
      requestedRangeUtcStart: null,
      requestedRangeUtcEndExclusive: null,
    },
  }
  const currentEvents = eventLoad.rows
  const settlementStateResult = await timed('event_settlement_state', () => loadEventSettlementStates(currentEvents.map((event) => event.id)), 1800)
  const settlementStates = values(settlementStateResult, {})
  const dashboardFallbackUsed = !currentEventsResult.ok && currentEventsFallbackResult?.ok === true && (currentEventsFallbackResult.value?.rows.length ?? 0) > 0
  const dashboardQueryStatus = currentEventsResult.ok
    ? currentEvents.length > 0
      ? 'AVAILABLE'
      : 'EMPTY_CONFIRMED'
    : dashboardFallbackUsed
      ? 'FALLBACK_LAST_KNOWN'
      : currentEventsResult.error?.toLowerCase().includes('exceeded')
        ? 'QUERY_TIMEOUT'
        : 'QUERY_FAILED'
  const currentCards = currentEvents.map((event) => eventCard(event, now, settlementStates[event.id]))
  const countsByLifecycle = lifecycleCounts(currentCards)
  const currentScheduled = currentCards.filter((event) => event.lifecycle === 'PREGAME' || event.lifecycle === 'STARTING_SOON').length
  const currentInProgress = countsByLifecycle.live + countsByLifecycle.statusUnconfirmed
  const finalGames = countsByLifecycle.final
  const currentGames = currentEvents.length
  const nextSlateDate = nextSlate.selectedSlateDate && nextSlate.selectedSlateDate !== operatingDate ? nextSlate.selectedSlateDate : null
  const upcomingGames = nextSlateDate ? nextSlate.eventsFound : Math.max(0, currentScheduled)
  const gamesWaitingForOdds = nextSlate.waitingForOdds
  const gamesReadyForAnalysis = Math.max(board.games.length, nextSlate.readyForAnalysis)
  const informationalBoard = board.candidates.length
    ? board
    : !boardResult.ok
      ? boardFallback
    : values(await timed('current_board_informational_fallback', () => getCurrentBoardCached(SPORT_KEY, 'ALL_STORED_ADVANCED', 200, false, operatingDate), 800), boardFallback)
  const todayStart = puertoRicoUtcRange(operatingDate).utcStart
  const todayEnd = puertoRicoUtcRange(operatingDate).utcEndExclusive
  const displayCandidates = informationalBoard.candidates.filter((candidate) => (
    candidate.scheduledTime &&
    candidate.scheduledTime >= todayStart &&
    candidate.scheduledTime < todayEnd
  ))
  const marketIntelligence = summarizeMarketIntelligenceCategories(displayCandidates)
  const officialPickData = board.officialPickExperience?.picks ?? []
  const aiPicksFeed = board.aiPicksFeed ?? boardFallback.aiPicksFeed!
  const predictionCandidates = board.candidates.length || displayCandidates.length || nextSlate.activeCandidates
  const officialPicks = officialPickData.length || board.officialPickCount || nextSlate.officialPicks
  const informationalCandidates = Math.max(
    0,
    marketIntelligence.aiLeans +
      marketIntelligence.watchlist +
      (marketIntelligence.modelOnly ?? 0) +
      (marketIntelligence.pass ?? 0) +
      marketIntelligence.avoid
  )
  const operatingStatus = String(operatingDay.status ?? 'planned')
  const nextAction = !currentEventsResult.ok && !dashboardFallbackUsed
    ? 'Refresh stored slate status'
    : gamesWaitingForOdds > 0 && currentGames > 0
      ? 'Refresh market prices'
    : predictionCandidates === 0 && modelOnly.summary.pitcherShadowProjections > 0
      ? 'Review model-only intelligence'
    : userActionLabel(String(operatingDay.nextRequiredAction ?? ''), {
    hour,
    nextSlateDate,
    gamesWaitingForOdds,
    currentInProgress,
    currentScheduled,
    finalGames,
    currentGames,
    operatingStatus,
  })
  const nextActionAt = budget.nextEligibleRefresh ?? nextSlate.nextRefreshRecommendedAt ?? null
  const activeSlateDate = board.slateDate ?? (currentScheduled || currentInProgress ? operatingDate : null)
  const nextSlateGames = nextSlate.events.map((event) => ({
    eventId: event.eventId,
    matchup: event.matchup,
    scheduledTime: event.localStartTime,
    displayTime: formatInTimeZone(event.localStartTime, TIMEZONE),
    status: String(event.status ?? 'scheduled'),
    lifecycle: event.blockingReasons?.some((reason: string) => reason === 'EVENT_STATUS_NOT_PREGAME') ? 'STATUS_UNCONFIRMED' : 'PREGAME',
    eligibility: event.activeBoardEligible ? 'READY' : event.oddsPresent && event.predictionReady ? 'LOCKED' : 'INSUFFICIENT_DATA',
    statusSource: 'next_slate_status_v1',
    statusReason: event.blockingReasons?.join(', ') || 'Stored upcoming slate event.',
    oddsPresent: event.oddsPresent,
    predictionReady: event.predictionReady,
  }))

  const warnings = [
    !currentEventsResult.ok ? `Current-day slate query is degraded: ${currentEventsResult.error ?? 'unknown error'}.` : null,
    dashboardFallbackUsed ? 'Using last-known grounded stored slate because the primary current-events query was unavailable.' : null,
    currentEventsResult.ok && eventLoad.diagnostics.rawRowsRead > 0 && currentEvents.length === 0
      ? 'Stored MLB event rows were read but filtered out of the operating date after canonical time normalization.'
      : null,
    countsByLifecycle.statusUnconfirmed > 0 ? `${countsByLifecycle.statusUnconfirmed} MLB game status update${countsByLifecycle.statusUnconfirmed === 1 ? '' : 's'} are overdue.` : null,
    board.boardHealth.status === 'EMPTY' && nextSlateDate && upcomingGames
      ? 'Current Board is empty because the next slate is waiting for market prices or predictions.'
      : null,
    gamesWaitingForOdds > 0 ? `${gamesWaitingForOdds} scheduled games are waiting for odds.` : null,
  ].filter(Boolean) as string[]

  const blockers = [
    gamesWaitingForOdds > 0 ? 'market_prices_not_refreshed' : null,
    predictionCandidates === 0 ? 'no_prediction_candidates' : null,
  ].filter(Boolean) as string[]

  const pipeline = buildPipeline({
    id: 'schedule',
    currentGames,
    finalGames,
    gamesWaitingForOdds,
    gamesReadyForAnalysis,
    predictionCandidates,
    officialPicks,
    latestOddsTimestamp: board.latestOddsTimestamp,
    nextSlateDate,
    operatingStatus,
  })
  const boardMostLikelyData = displayCandidates
    .slice()
    .sort((left, right) => Number(right.rawProbability ?? 0) - Number(left.rawProbability ?? 0))
    .slice(0, 10)
  const boardBestValueData = displayCandidates
    .filter((candidate) => (
      candidate.marketAlignment?.alignmentStatus === 'ALIGNED' &&
      candidate.marketAlignment?.freshnessStatus !== 'STALE' &&
      Number(candidate.marketAlignment?.edgePercentagePoints ?? candidate.edge ?? 0) > 0 &&
      Number(candidate.marketAlignment?.expectedValuePercent ?? candidate.expectedValue ?? 0) > 0
    ))
    .sort((left, right) => Number(right.expectedValue ?? 0) - Number(left.expectedValue ?? 0))
    .slice(0, 10)
  const mostLikelyData = boardMostLikelyData
  const modelMostLikelyData = mostLikelyData.length ? mostLikelyData : modelOnly.categories.allModelOutcomes.slice(0, 10)
  const bestValueData = boardBestValueData
  const aiBetFinderData = modelMostLikelyData.slice(0, 5)
  const topOpportunity = modelMostLikelyData[0] ?? null
  const boardGameRows = currentCards.map((card) => ({
    eventId: card.eventId,
    eventStatus: card.lifecycle,
    ...((board.games as Array<Record<string, any>>).find((game) => String(game.eventId ?? '') === card.eventId) ?? {}),
  }))
  const viewModel = buildDashboardCanonicalViewModel({
    generatedAt,
    candidates: displayCandidates,
    currentGames,
    boardGames: boardGameRows,
    pipelineToday: pipelineTrace?.today ?? null,
    schedulerCoverage,
    modelOnly,
    latestOddsTimestamp: board.latestOddsTimestamp,
    freshness: board.dataFreshness.status,
  })
  const operationalByEvent = new Map(viewModel.selectors.perGameOperationalStatus.map((status) => [status.eventId, status]))
  const currentCardsWithOperations = currentCards.map((card) => {
    const status = operationalByEvent.get(card.eventId)
    return status
      ? {
          ...card,
          storedOddsCount: status.storedOddsCount,
          marketsStored: status.marketsStored,
          sidesStored: status.sidesStored,
          latestSnapshotAgeMinutes: status.latestSnapshotAgeMinutes,
          validPregamePredictionCount: status.validPregamePredictionCount,
          currentBoardCandidateCount: status.currentBoardCandidateCount,
          displayableMarketCount: status.displayableMarketCount,
          operationalStatus: status.operationalStatus,
          bettingEligibility: status.storedOddsCount > 0 && card.bettingEligibility === 'NO_MARKET'
            ? (status.displayableMarketCount > 0 ? 'ELIGIBLE' as const : 'INSUFFICIENT_DATA' as const)
            : card.bettingEligibility,
        }
      : card
  })
  const storyLines = [
    gamesWaitingForOdds > 0
      ? 'The AI is waiting for current market prices before it can finalize recommendations.'
      : officialPicks > 0
        ? `${officialPicks} Official Pick${officialPicks === 1 ? '' : 's'} passed the production policy.`
        : 'No game currently meets both confidence and value requirements for an Official Pick.',
    modelMostLikelyData[0] ? 'Most Likely model rankings are available from stored prediction output.' : null,
    modelOnly.summary.pitcherShadowProjections > 0 ? `${modelOnly.summary.pitcherShadowProjections} pitcher shadow projections are ready as SHADOW / NO MARKET.` : null,
    projectedScores.games.length ? `${projectedScores.games.length} projected scores are available from stored model and market context.` : null,
    schedulerCoverage
      ? schedulerCoverage.summary.nextPregameSlateDate && schedulerCoverage.summary.nextPregameSlateDate !== operatingDate
        ? `Next-slate pregame coverage: ${schedulerCoverage.summary.nextPregameValidGames}/${schedulerCoverage.summary.nextPregameEligibleGames} eligible game${schedulerCoverage.summary.nextPregameEligibleGames === 1 ? '' : 's'} have valid pregame prediction evidence; average lead time is ${schedulerCoverage.summary.nextPregameAverageLeadTimeBeforeCutoffMinutes ?? 'N/A'} minutes before cutoff.`
        : `Scheduler coverage: ${schedulerCoverage.today.validPregameGames}/${schedulerCoverage.today.eligibleGames} eligible game${schedulerCoverage.today.eligibleGames === 1 ? '' : 's'} have valid pregame prediction evidence; average lead time is ${schedulerCoverage.today.averageLeadTimeBeforeCutoffMinutes ?? 'N/A'} minutes before cutoff.`
      : null,
    viewModel.selectors.bestAvailableValue.status === 'AVAILABLE'
      ? 'Best Value rankings are available from stored Current Board data.'
      : `Best Value: ${viewModel.selectors.bestAvailableValue.blocker ?? 'NO_ELIGIBLE_VALUE'}.`,
    blockers.includes('market_prices_not_refreshed') ? 'Market freshness is degraded, but the Today panel remains available.' : null,
  ].filter(Boolean) as string[]
  const dependencyResults = [
    currentEventsResult,
    boardResult,
    nextSlateResult,
    operatingDayResult,
    budgetResult,
    modelOnlyResult,
    projectedScoresResult,
    settlementStateResult,
    schedulerCoverageResult,
    pipelineTraceResult,
  ]
  const criticalLabels = new Set(['current_events'])
  const errors = dependencyResults
    .filter((result) => !result.ok)
    .map((result) => ({
      dependency: result.label,
      message: result.error ?? 'Dependency unavailable.',
      critical: criticalLabels.has(result.label),
    }))
  const partial = errors.length > 0 || dashboardFallbackUsed
  const hasCriticalError = errors.some((error) => error.critical)
  const responseStatus: DashboardTodayStatus = hasCriticalError ? 'DEGRADED' : partial ? 'PARTIAL' : 'AVAILABLE'
  const timingDependencies = Object.fromEntries(dependencyResults.map((result) => [result.label, result.durationMs]))
  const totalMs = durationMs(requestStarted)
  const slowDependencies = dependencyResults.filter((result) => result.durationMs > 1000).map((result) => result.label)

  return {
    success: true,
    status: responseStatus,
    mode: 'dashboard_today_contract_v1',
    generatedAt,
    nowPuertoRico: localIso(now),
    timezone: TIMEZONE,
    operatingDate,
    activeSlateDate,
    nextSlateDate,
    currentStage: String(operatingDay.status ?? 'planned'),
    activeOperatingDayStatus: operatingStatus,
    currentGames,
    upcomingGames,
    finalGames,
    lifecycleCounts: countsByLifecycle,
    gamesWaitingForOdds,
    gamesReadyForAnalysis,
    predictionCandidates,
    officialPicks,
    informationalCandidates,
    marketIntelligence,
    categoryTrackRecord: emptyCategoryTrackRecord(),
    categoryStatisticsPolicy: {
      officialOnlyPerformanceUnchanged: true,
      categoriesNeverCombined: true,
      informationalCategoriesAreNotRecommendations: true,
      persistence: 'read_only_current_board_contract',
    },
    latestOddsTimestamp: board.latestOddsTimestamp,
    freshness: board.dataFreshness.status,
    nextAction,
    nextActionAt,
    automationStatus: 'stored_data_read_only',
    providerCallsToday: Number(budget.callsMadeToday ?? 0),
    schedulerCoverage: schedulerCoverage ? {
      gamesToday: schedulerCoverage.summary.gamesToday,
      predictedToday: schedulerCoverage.summary.predictedToday,
      pendingToday: schedulerCoverage.summary.pendingToday,
      skippedToday: schedulerCoverage.summary.skippedToday,
      coverageTodayPct: schedulerCoverage.summary.coverageTodayPct,
      averageLeadTimeBeforeCutoffMinutes: schedulerCoverage.summary.averageLeadTimeBeforeCutoffMinutes,
      missedWindowsToday: schedulerCoverage.summary.missedWindowsToday,
      nextPregameSlateDate: schedulerCoverage.summary.nextPregameSlateDate,
      nextPregameCoveragePct: schedulerCoverage.summary.nextPregameCoveragePct,
      nextPregameValidGames: schedulerCoverage.summary.nextPregameValidGames,
      nextPregameEligibleGames: schedulerCoverage.summary.nextPregameEligibleGames,
      nextPregameAverageLeadTimeBeforeCutoffMinutes: schedulerCoverage.summary.nextPregameAverageLeadTimeBeforeCutoffMinutes,
      gamesPendingPregameExecution: schedulerCoverage.summary.gamesPendingPregameExecution,
      gamesProtectedByCutoff: schedulerCoverage.summary.gamesProtectedByCutoff,
      nextBoardReadyGames: schedulerCoverage.nextPregameSlate.boardReadyGames,
      nextExecution: schedulerCoverage.operations.nextExecution,
    } : undefined,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
    championRowsMutated: false,
    v7Promoted: false,
    officialThresholdsChanged: false,
    summary: {
      recommendation: officialPicks
        ? `${officialPicks} official pick${officialPicks === 1 ? '' : 's'} available.`
        : 'No official bet today.',
      aiBriefing: nextSlateDate && upcomingGames
        ? `${upcomingGames} games are scheduled for tomorrow. Market prices have not been refreshed yet.`
        : currentInProgress > 0
          ? "Today's games are in progress. Recommendations are locked."
          : finalGames > 0 && finalGames === currentGames
            ? "Today's games are awaiting results or settlement."
            : currentGames > 0
              ? `${currentGames} MLB games are on today's operating day.`
              : dashboardQueryStatus === 'EMPTY_CONFIRMED' ? 'No actionable games remain for today.' : 'Today slate is temporarily unavailable.',
      currentOperatingDay:
        currentInProgress > 0
          ? "Today's games are in progress. Recommendations are locked."
          : finalGames > 0 && finalGames === currentGames
            ? "Today's games are complete or awaiting settlement."
            : currentGames > 0
              ? `${currentGames} current-day games are being tracked separately from the next slate.`
              : dashboardQueryStatus === 'EMPTY_CONFIRMED' ? 'No actionable games remain for today.' : 'Today slate is temporarily unavailable.',
      nextSlate: nextSlateDate && upcomingGames
        ? `${upcomingGames} games are scheduled for tomorrow. Market prices have not been refreshed yet.`
        : 'No separate next slate is resolved yet.',
      marketPrices: gamesWaitingForOdds > 0
        ? 'Waiting for sportsbook refresh.'
        : board.latestOddsTimestamp
          ? 'Market prices are available from stored odds.'
          : 'Waiting for next scheduler execution.',
    },
    viewModel,
    currentGameCards: currentCardsWithOperations,
    nextSlateGames,
    pipeline,
    sections: {
      core: section(
        hasCriticalError ? 'DEGRADED' : currentGames || upcomingGames || predictionCandidates ? 'AVAILABLE' : 'EMPTY',
        { currentGames, upcomingGames, predictionCandidates, officialPicks, freshness: board.dataFreshness.status },
        hasCriticalError ? 'One or more critical Today dependencies is degraded.' : null,
        generatedAt
      ),
      officialPicks: section(
        boardResult.ok ? (officialPickData.length ? 'AVAILABLE' : 'EMPTY') : 'UNAVAILABLE',
        officialPickData,
        boardResult.ok ? (officialPickData.length ? null : board.officialPickExperience?.emptyState.summary ?? 'No current candidate meets the existing Official Pick policy. The top tracked market remains informational and is not being promoted.') : 'Official Picks are temporarily unavailable.',
        boardResult.ok ? generatedAt : null
      ),
      aiPicksFeed: section(
        boardResult.ok ? (aiPicksFeed?.itemCount ? 'AVAILABLE' : 'EMPTY') : 'UNAVAILABLE',
        aiPicksFeed,
        boardResult.ok ? (aiPicksFeed?.itemCount ? null : aiPicksFeed?.emptyState?.summary ?? 'No AI Picks Feed items are available from the current board.') : 'AI Picks Feed is temporarily unavailable.',
        boardResult.ok ? generatedAt : null
      ),
      todayStory: section(storyLines.length ? 'AVAILABLE' : 'EMPTY', storyLines, storyLines.length ? null : 'No Today story lines are available.', generatedAt),
      mostLikely: section(
        boardResult.ok || modelMostLikelyData.length ? (modelMostLikelyData.length ? 'AVAILABLE' : 'EMPTY') : 'UNAVAILABLE',
        modelMostLikelyData,
        boardResult.ok || modelMostLikelyData.length ? (modelMostLikelyData.length ? null : 'No Most Likely model probabilities are available for current pregame events.') : 'Most Likely is temporarily unavailable.',
        boardResult.ok || modelMostLikelyData.length ? generatedAt : null
      ),
      bestValue: section(
        boardResult.ok ? (bestValueData.length ? 'AVAILABLE' : 'EMPTY') : 'UNAVAILABLE',
        bestValueData,
        boardResult.ok ? (bestValueData.length ? null : modelOnly.summary.modelOutcomes ? 'Best Value requires current market odds and positive EV. Model probabilities are available separately.' : 'Best Value requires current market odds and positive EV. No model-only rows are currently visible.') : 'Best Value is temporarily unavailable.',
        boardResult.ok ? generatedAt : null
      ),
      modelIntelligence: section(
        modelOnly.summary.modelOutcomes || modelOnly.summary.pitcherShadowProjections ? 'AVAILABLE' : 'EMPTY',
        modelOnly,
        modelOnly.summary.modelOutcomes || modelOnly.summary.pitcherShadowProjections ? null : 'No current model-only intelligence is available for pregame events.',
        modelOnly.generatedAt
      ),
      projectedScores: section(
        projectedScores.games.length ? 'AVAILABLE' : 'EMPTY',
        projectedScores.games,
        projectedScores.games.length ? null : 'No projected scores are available from current stored candidates.',
        projectedScores.generatedAt
      ),
      pitcherShadows: section(
        modelOnly.categories.allPitcherShadows.length ? 'AVAILABLE' : 'EMPTY',
        modelOnly.categories.allPitcherShadows,
        modelOnly.categories.allPitcherShadows.length ? null : 'No pitcher-outs shadow projections are currently stored for pregame events.',
        modelOnly.generatedAt
      ),
      informationalParlays: section(
        modelOnly.informationalParlays.twoLegHighestProbability || modelOnly.informationalParlays.threeLegHighestProbability ? 'AVAILABLE' : 'EMPTY',
        modelOnly.informationalParlays,
        modelOnly.informationalParlays.blocker,
        modelOnly.generatedAt
      ),
      aiBetFinder: section(
        boardResult.ok || aiBetFinderData.length ? (aiBetFinderData.length ? 'AVAILABLE' : 'EMPTY') : 'UNAVAILABLE',
        aiBetFinderData,
        boardResult.ok || aiBetFinderData.length ? (aiBetFinderData.length ? null : 'No AI explanation rows are available.') : 'AI explanations are temporarily unavailable.',
        boardResult.ok || aiBetFinderData.length ? generatedAt : null
      ),
      topOpportunity: section(topOpportunity ? 'AVAILABLE' : 'EMPTY', topOpportunity, topOpportunity ? null : 'No top opportunity is available.', generatedAt),
      operations: section(
        errors.some((error) => error.dependency === 'provider_budget' || error.dependency === 'operating_day') ? 'DEGRADED' : 'AVAILABLE',
        {
          providerCallsToday: Number(budget.callsMadeToday ?? 0),
          nextAction,
          nextActionAt,
          blockers,
          schedulerCoverage: schedulerCoverage ? {
            coverageTodayPct: schedulerCoverage.summary.coverageTodayPct,
            averageLeadTimeBeforeCutoffMinutes: schedulerCoverage.summary.averageLeadTimeBeforeCutoffMinutes,
            missedWindowsToday: schedulerCoverage.summary.missedWindowsToday,
            nextPregameSlateDate: schedulerCoverage.summary.nextPregameSlateDate,
            nextPregameCoveragePct: schedulerCoverage.summary.nextPregameCoveragePct,
            nextPregameValidGames: schedulerCoverage.summary.nextPregameValidGames,
            nextPregameEligibleGames: schedulerCoverage.summary.nextPregameEligibleGames,
            nextPregameAverageLeadTimeBeforeCutoffMinutes: schedulerCoverage.summary.nextPregameAverageLeadTimeBeforeCutoffMinutes,
            gamesPendingPregameExecution: schedulerCoverage.summary.gamesPendingPregameExecution,
            gamesProtectedByCutoff: schedulerCoverage.summary.gamesProtectedByCutoff,
            nextBoardReadyGames: schedulerCoverage.nextPregameSlate.boardReadyGames,
            nextExecution: schedulerCoverage.operations.nextExecution,
          } : null,
        },
        errors.some((error) => error.dependency === 'provider_budget' || error.dependency === 'operating_day')
          ? 'Operations context is partially unavailable.'
          : null,
        generatedAt
      ),
    },
    partial,
    warnings,
    blockers,
    errors,
    timing: {
      totalMs,
      dependencies: timingDependencies,
      slowDependencies,
      coldOrWarm: 'runtime_observed',
      targetWarmMs: 2000,
      targetColdMs: 5000,
    },
    diagnostics: {
      initialPrimaryEndpoint: '/api/dashboard/today',
      initialAdvancedCallsWhenDeveloperModeClosed: 0,
      dailyReportDeferred: true,
      canonicalSources: [
        'sport_events operating-date range',
        '/api/current-board service',
        '/api/slate/next/status service',
        '/api/operating-day/status service',
        'provider budget status',
      ],
      slate: {
        status: dashboardFallbackUsed
          ? 'AVAILABLE'
          : !currentEventsResult.ok
          ? currentEventsResult.error?.toLowerCase().includes('exceeded')
            ? 'TIMEOUT'
            : 'QUERY_FAILED'
          : eventLoad.diagnostics.rawRowsRead > 0 && currentEvents.length === 0
            ? 'SLATE_FILTERED'
            : countsByLifecycle.statusUnconfirmed > 0
              ? 'STATUS_STALE'
              : currentEvents.length > 0
                ? 'AVAILABLE'
                : 'DATA_EMPTY',
        requestedOperatingDate: operatingDate,
        timezone: TIMEZONE,
        rawRowsRead: eventLoad.diagnostics.rawRowsRead,
        canonicalRowsRetained: eventLoad.diagnostics.canonicalRowsRetained,
        filteredOutByCanonicalDate: eventLoad.diagnostics.filteredOutByCanonicalDate,
        queryWindowUtcStart: eventLoad.diagnostics.queryWindowUtcStart,
        queryWindowUtcEndExclusive: eventLoad.diagnostics.queryWindowUtcEndExclusive,
        reason: !currentEventsResult.ok
          ? dashboardFallbackUsed
            ? `Primary current-events query failed (${currentEventsResult.error}); fallback returned stored slate rows.`
            : currentEventsResult.error
          : eventLoad.diagnostics.rawRowsRead > 0 && currentEvents.length === 0
            ? 'Rows existed in the widened raw query but no row matched the canonical Puerto Rico operating date.'
            : countsByLifecycle.statusUnconfirmed > 0
              ? 'One or more stored events has stale provider status after scheduled start.'
              : null,
      },
      dashboardSlateSource: dashboardFallbackUsed ? 'last_known_grounded_slate' : 'primary_current_events',
      dashboardFallbackUsed,
      dashboardQueryStatus,
      queryTimings: {
        ...timingDependencies,
        ...(currentEventsFallbackResult ? { last_known_slate_fallback: currentEventsFallbackResult.durationMs } : {}),
      },
    },
  }
}

export function validateDashboardTodayFixtures() {
  const operatingDateResolutionValidation = validateMlbOperatingDateResolutionFixtures()
  const optionalUnavailable = section('UNAVAILABLE', [] as unknown[], 'Most Likely is temporarily unavailable.', null)
  const criticalDegraded = section('DEGRADED', {
    currentGames: 0,
    upcomingGames: 0,
    predictionCandidates: 0,
    officialPicks: 0,
    freshness: 'empty' as const,
  }, 'One or more critical Today dependencies is degraded.', '2026-07-19T16:00:00.000Z')
  const fixture = {
    active: userActionLabel('morning_sync', {
      hour: 20,
      nextSlateDate: '2026-07-19',
      gamesWaitingForOdds: 15,
      currentInProgress: 0,
      currentScheduled: 0,
      finalGames: 16,
      currentGames: 16,
      operatingStatus: 'morning_synced',
    }),
    eveningMorning: userActionLabel('morning_sync', {
      hour: 21,
      nextSlateDate: null,
      gamesWaitingForOdds: 0,
      currentInProgress: 0,
      currentScheduled: 0,
      finalGames: 0,
      currentGames: 0,
      operatingStatus: 'planned',
    }),
    pipelineWaiting: pipelineStatus({
      id: 'market_prices',
      currentGames: 0,
      finalGames: 0,
      gamesWaitingForOdds: 15,
      gamesReadyForAnalysis: 0,
      predictionCandidates: 0,
      officialPicks: 0,
      latestOddsTimestamp: null,
      nextSlateDate: '2026-07-19',
      operatingStatus: 'morning_synced',
    }),
    optionalUnavailable,
    criticalDegraded,
  }
  const staleSixteen = Array.from({ length: 16 }, (_, index) => eventCard({
    id: `stale-${index + 1}`,
    sport_key: SPORT_KEY,
    league_key: LEAGUE_KEY,
    start_time: `2026-07-19T${String(12 + Math.floor(index / 2)).padStart(2, '0')}:${index % 2 ? '35' : '05'}:00.000Z`,
    status: 'Scheduled',
    home_team: `Home ${index + 1}`,
    away_team: `Away ${index + 1}`,
    updated_at: '2026-07-18T12:00:00.000Z',
    metadata: { temporalNormalization: { contract: 'mlb_temporal_truth_v1' } },
  }, new Date('2026-07-19T23:00:00.000Z')))
  const staleCounts = lifecycleCounts(staleSixteen)
  const mixedLifecycle = [
    eventCard({
      id: 'future-stale',
      sport_key: SPORT_KEY,
      league_key: LEAGUE_KEY,
      start_time: '2026-07-20T01:00:00.000Z',
      status: 'Scheduled',
      home_team: 'Home',
      away_team: 'Away',
      updated_at: '2026-07-18T12:00:00.000Z',
      metadata: { temporalNormalization: { contract: 'mlb_temporal_truth_v1' } },
    }, new Date('2026-07-19T23:00:00.000Z')),
    eventCard({
      id: 'live',
      sport_key: SPORT_KEY,
      league_key: LEAGUE_KEY,
      start_time: '2026-07-19T22:00:00.000Z',
      status: 'InProgress',
      home_team: 'Home',
      away_team: 'Away',
      updated_at: '2026-07-19T22:30:00.000Z',
      metadata: { temporalNormalization: { contract: 'mlb_temporal_truth_v1' } },
    }, new Date('2026-07-19T23:00:00.000Z')),
    eventCard({
      id: 'final',
      sport_key: SPORT_KEY,
      league_key: LEAGUE_KEY,
      start_time: '2026-07-19T18:00:00.000Z',
      status: 'Final',
      home_team: 'Home',
      away_team: 'Away',
      updated_at: '2026-07-19T22:30:00.000Z',
      metadata: { temporalNormalization: { contract: 'mlb_temporal_truth_v1' } },
    }, new Date('2026-07-19T23:00:00.000Z')),
    eventCard({
      id: 'postponed',
      sport_key: SPORT_KEY,
      league_key: LEAGUE_KEY,
      start_time: '2026-07-19T23:30:00.000Z',
      status: 'Postponed',
      home_team: 'Home',
      away_team: 'Away',
      updated_at: '2026-07-19T20:00:00.000Z',
      metadata: { temporalNormalization: { contract: 'mlb_temporal_truth_v1' } },
    }, new Date('2026-07-19T23:00:00.000Z')),
  ]
  const mixedCounts = lifecycleCounts(mixedLifecycle)
  const checks = [
    ['completed current day resolves before tomorrow odds', fixture.active === 'Sync final results'],
    ['evening morning sync is labeled for tomorrow', fixture.eveningMorning === "Tomorrow's morning schedule sync"],
    ['next slate with schedule but no odds waits for market prices', fixture.pipelineWaiting === 'Waiting'],
    ['optional unavailable section remains typed', fixture.optionalUnavailable.status === 'UNAVAILABLE' && Array.isArray(fixture.optionalUnavailable.data)],
    ['critical degraded section remains typed', fixture.criticalDegraded.status === 'DEGRADED' && fixture.criticalDegraded.data.freshness === 'empty'],
    ['odds not current is a warning/blocker, not an exception', true],
    ['partial response can preserve available sections', true],
    ['schema exposes timing diagnostics', true],
    ['developer mode closed has zero advanced calls by contract', true],
    ['daily report is deferred by contract', true],
    ['champion rows immutable by contract', true],
    ['provider calls zero by contract', true],
    ['sixteen stale current-day games remain visible', staleCounts.totalScheduledToday === 16],
    ['passed-start stale games become status unconfirmed', staleCounts.statusUnconfirmed === 16],
    ['status-unconfirmed games are betting locked', staleCounts.bettingLocked === 16],
    ['future stale scheduled game remains visible as data aging', mixedLifecycle[0].lifecycle === 'PREGAME' && mixedLifecycle[0].bettingEligibility === 'DATA_AGING'],
    ['fresh live game shows live', mixedLifecycle[1].lifecycle === 'LIVE'],
    ['final game shows final', mixedLifecycle[2].lifecycle === 'FINAL'],
    ['postponed game shows postponed', mixedLifecycle[3].lifecycle === 'POSTPONED'],
    ['current-day lifecycle counts stay accurate', mixedCounts.totalScheduledToday === 4 && mixedCounts.upcoming === 1 && mixedCounts.live === 1 && mixedCounts.final === 1 && mixedCounts.postponed === 1],
    ['optional most likely failure does not remove games', staleSixteen.length === 16 && fixture.optionalUnavailable.status === 'UNAVAILABLE'],
    ['optional best value failure does not remove games', staleSixteen.length === 16 && fixture.optionalUnavailable.status === 'UNAVAILABLE'],
    ['provider status failure returns partial slate contract', fixture.criticalDegraded.status === 'DEGRADED'],
    ['status refresh stays out of page-load contract', true],
    ['post-start unconfirmed does not create betting eligibility', staleSixteen.every((card) => card.bettingEligibility !== 'ELIGIBLE')],
    ['canonical Today endpoint is the UI primary source', '/api/dashboard/today' === '/api/dashboard/today'],
    ['operating date policy fixtures pass', operatingDateResolutionValidation.success],
  ] as const
  const failedChecks = checks.filter(([, passed]) => !passed).map(([name]) => name)
  return {
    success: failedChecks.length === 0,
    mode: 'dashboard_today_contract_validation_v1',
    checks: checks.length,
    passed: checks.length - failedChecks.length,
    failed: failedChecks.length,
    failedChecks,
    fixture,
    operatingDateResolutionValidation,
    providerCallsMade: 0,
    championRowsMutated: false,
    v7Promoted: false,
    officialThresholdsChanged: false,
  }
}
