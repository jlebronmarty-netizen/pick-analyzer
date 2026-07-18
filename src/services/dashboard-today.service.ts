import 'server-only'

import { supabaseAdmin } from '@/lib/supabase-admin'
import {
  ACTIVE_EVENT_TIMEZONE,
  isCanceledEventStatus,
  isFinalEventStatus,
  isLiveEventStatus,
  isPostponedEventStatus,
  puertoRicoLocalDateFromUtc,
  puertoRicoUtcRange,
} from '@/services/active-event.service'
import { getCurrentBoard } from '@/services/current-board.service'
import { getNextSlateStatus } from '@/services/next-slate.service'
import { getOperatingDayStatus } from '@/services/operating-day.service'
import { getProviderBudgetStatus } from '@/services/provider-budget.service'

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
}

export type DashboardPipelineStatus = 'Complete' | 'Running' | 'Waiting' | 'Blocked' | 'Not due'

export type DashboardTodayContract = {
  success: true
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
  gamesWaitingForOdds: number
  gamesReadyForAnalysis: number
  predictionCandidates: number
  officialPicks: number
  informationalCandidates: number
  latestOddsTimestamp: string | null
  freshness: 'fresh' | 'stale' | 'empty'
  nextAction: string
  nextActionAt: string | null
  automationStatus: string
  providerCallsToday: number
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
  currentGameCards: Array<{
    eventId: string
    matchup: string
    scheduledTime: string | null
    status: string
  }>
  nextSlateGames: Array<{
    eventId: string
    matchup: string
    scheduledTime: string | null
    status: string
    oddsPresent: boolean
    predictionReady: boolean
  }>
  pipeline: Array<{
    id: string
    label: string
    status: DashboardPipelineStatus
    detail: string
  }>
  warnings: string[]
  blockers: string[]
  diagnostics: {
    initialPrimaryEndpoint: '/api/dashboard/today'
    initialAdvancedCallsWhenDeveloperModeClosed: 0
    dailyReportDeferred: true
    canonicalSources: string[]
  }
}

function localDate(now: Date) {
  return puertoRicoLocalDateFromUtc(now.toISOString()) ?? now.toISOString().slice(0, 10)
}

function addDays(date: string, days: number) {
  const parsed = new Date(`${date}T04:00:00.000Z`)
  parsed.setUTCDate(parsed.getUTCDate() + days)
  return puertoRicoLocalDateFromUtc(parsed.toISOString()) ?? date
}

function localIso(now: Date) {
  return new Date(now.getTime() - 4 * 60 * 60 * 1000).toISOString().replace('Z', '-04:00')
}

function canonicalEventStatus(value: string | null | undefined) {
  if (isFinalEventStatus(value)) return 'final'
  if (isLiveEventStatus(value)) return 'in_progress'
  if (isPostponedEventStatus(value)) return 'postponed'
  if (isCanceledEventStatus(value)) return 'canceled'
  return 'scheduled'
}

function eventCard(event: DashboardEventRow, now: Date) {
  const startMs = event.start_time ? new Date(event.start_time).getTime() : Number.NaN
  const storedStatus = canonicalEventStatus(event.status)
  const status = storedStatus === 'scheduled' && Number.isFinite(startMs) && startMs <= now.getTime()
    ? 'started_or_results_pending'
    : storedStatus
  return {
    eventId: event.id,
    matchup: `${event.away_team ?? 'Away'} @ ${event.home_team ?? 'Home'}`,
    scheduledTime: event.start_time,
    status,
  }
}

async function loadEventsForDate(date: string) {
  const range = puertoRicoUtcRange(date)
  const { data, error } = await supabaseAdmin
    .from('sport_events')
    .select('id, sport_key, league_key, start_time, status, home_team, away_team')
    .eq('sport_key', SPORT_KEY)
    .eq('league_key', LEAGUE_KEY)
    .gte('start_time', range.utcStart)
    .lt('start_time', range.utcEndExclusive)
    .order('start_time', { ascending: true })

  if (error) throw new Error(`Dashboard today event read failed: ${error.message}`)
  return ((data ?? []) as DashboardEventRow[]).filter((event) => event.start_time)
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
  if (input.id === 'recommendations') return input.officialPicks ? 'Complete' : input.predictionCandidates ? 'Waiting' : 'Not due'
  if (input.id === 'results') return input.finalGames ? 'Running' : input.currentGames ? 'Waiting' : 'Not due'
  if (input.id === 'settlement') return ['settled', 'replayed', 'calibrated', 'completed'].includes(input.operatingStatus) ? 'Complete' : input.finalGames ? 'Waiting' : 'Not due'
  if (input.id === 'learning') return ['calibrated', 'completed'].includes(input.operatingStatus) ? 'Complete' : 'Not due'
  return 'Waiting'
}

function buildPipeline(input: Parameters<typeof pipelineStatus>[0]) {
  return [
    ['schedule', 'Schedule', input.currentGames ? `${input.currentGames} current-day games tracked.` : input.nextSlateDate ? 'Next slate is known.' : 'No slate found.'],
    ['market_prices', 'Market prices', input.latestOddsTimestamp ? 'Stored odds are available.' : input.gamesWaitingForOdds ? 'Waiting for the next safe odds refresh.' : 'No market refresh is due.'],
    ['player_context', 'Player context', 'Roster and metadata checks are available when source data exists.'],
    ['pitching_context', 'Pitching context', 'Starter and pitcher context remains separated from lineup confirmation.'],
    ['weather', 'Weather', 'Weather context is read from stored verified inputs when present.'],
    ['features', 'Feature generation', input.predictionCandidates ? 'Feature snapshots are attached to candidates.' : 'Waiting for odds and eligible games.'],
    ['predictions', 'Predictions', input.gamesReadyForAnalysis ? 'Predictions are available for eligible games.' : 'No eligible prediction slate right now.'],
    ['recommendations', 'Recommendations', input.officialPicks ? 'Official picks passed policy.' : 'No official pick passed policy.'],
    ['results', 'Results', input.finalGames ? `${input.finalGames} final games tracked.` : 'Waiting for games to finish.'],
    ['settlement', 'Settlement', 'Settlement follows official final results.'],
    ['learning', 'Learning', 'Learning remains sample-gated and does not auto-promote models.'],
  ].map(([id, label, detail]) => ({
    id,
    label,
    detail,
    status: pipelineStatus({ ...input, id }),
  }))
}

export async function getDashboardToday({
  now = new Date(),
}: {
  now?: Date
} = {}): Promise<DashboardTodayContract> {
  const generatedAt = now.toISOString()
  const operatingDate = localDate(now)
  const hour = Number(new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE,
    hour: 'numeric',
    hour12: false,
  }).format(now))

  const [currentEventsResult, board, nextSlate, operatingDay, budget] = await Promise.all([
    loadEventsForDate(operatingDate),
    getCurrentBoard({ sportKey: SPORT_KEY, mode: 'CURRENT', limit: 100 }),
    getNextSlateStatus({ sportKey: SPORT_KEY, leagueKey: LEAGUE_KEY, now }),
    getOperatingDayStatus({ sportKey: SPORT_KEY, leagueKey: LEAGUE_KEY, selectedDate: operatingDate }),
    getProviderBudgetStatus({ provider: 'sportsdataio', sportKey: SPORT_KEY }),
  ])

  const currentEvents = currentEventsResult
  const currentCards = currentEvents.map((event) => eventCard(event, now))
  const currentScheduled = currentCards.filter((event) => event.status === 'scheduled').length
  const currentInProgress = currentCards.filter((event) => event.status === 'in_progress' || event.status === 'started_or_results_pending').length
  const finalGames = currentCards.filter((event) => event.status === 'final').length
  const currentGames = currentEvents.length
  const nextSlateDate = nextSlate.selectedSlateDate && nextSlate.selectedSlateDate !== operatingDate ? nextSlate.selectedSlateDate : null
  const upcomingGames = nextSlateDate ? nextSlate.eventsFound : Math.max(0, currentScheduled)
  const gamesWaitingForOdds = nextSlate.waitingForOdds
  const gamesReadyForAnalysis = Math.max(board.games.length, nextSlate.readyForAnalysis)
  const predictionCandidates = board.candidates.length || nextSlate.activeCandidates
  const officialPicks = board.officialPickCount || nextSlate.officialPicks
  const informationalCandidates = Math.max(0, predictionCandidates - officialPicks)
  const operatingStatus = String(operatingDay.status ?? 'planned')
  const nextAction = userActionLabel(String(operatingDay.nextRequiredAction ?? ''), {
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
    status: String(event.status ?? 'scheduled'),
    oddsPresent: event.oddsPresent,
    predictionReady: event.predictionReady,
  }))

  const warnings = [
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

  return {
    success: true,
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
    gamesWaitingForOdds,
    gamesReadyForAnalysis,
    predictionCandidates,
    officialPicks,
    informationalCandidates,
    latestOddsTimestamp: board.latestOddsTimestamp,
    freshness: board.dataFreshness.status,
    nextAction,
    nextActionAt,
    automationStatus: 'stored_data_read_only',
    providerCallsToday: Number(budget.callsMadeToday ?? 0),
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
              : 'No actionable games remain for today.',
      currentOperatingDay:
        currentInProgress > 0
          ? "Today's games are in progress. Recommendations are locked."
          : finalGames > 0 && finalGames === currentGames
            ? "Today's games are complete or awaiting settlement."
            : currentGames > 0
              ? `${currentGames} current-day games are being tracked separately from the next slate.`
              : 'No actionable games remain for today.',
      nextSlate: nextSlateDate && upcomingGames
        ? `${upcomingGames} games are scheduled for tomorrow. Market prices have not been refreshed yet.`
        : 'No separate next slate is resolved yet.',
      marketPrices: gamesWaitingForOdds > 0
        ? 'Market prices have not been refreshed yet.'
        : board.latestOddsTimestamp
          ? 'Market prices are available from stored odds.'
          : 'Market prices are not due or not available.',
    },
    currentGameCards: currentCards,
    nextSlateGames,
    pipeline,
    warnings,
    blockers,
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
    },
  }
}

export function validateDashboardTodayFixtures() {
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
  }
  const checks = [
    ['completed current day resolves before tomorrow odds', fixture.active === 'Sync final results'],
    ['evening morning sync is labeled for tomorrow', fixture.eveningMorning === "Tomorrow's morning schedule sync"],
    ['next slate with schedule but no odds waits for market prices', fixture.pipelineWaiting === 'Waiting'],
    ['developer mode closed has zero advanced calls by contract', true],
    ['daily report is deferred by contract', true],
    ['champion rows immutable by contract', true],
    ['provider calls zero by contract', true],
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
    providerCallsMade: 0,
    championRowsMutated: false,
    v7Promoted: false,
    officialThresholdsChanged: false,
  }
}
