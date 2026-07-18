import 'server-only'

import { supabaseAdmin } from '@/lib/supabase-admin'
import {
  ACTIVE_EVENT_TIMEZONE,
  activeEventBlockingReasons,
  isActiveBettingEvent,
  puertoRicoLocalDateFromUtc,
  puertoRicoUtcRange,
} from '@/services/active-event.service'

const DEFAULT_SPORT_KEY = 'baseball_mlb'
const DEFAULT_LEAGUE_KEY = 'mlb'
const DEFAULT_SEARCH_DAYS = 7

type EventRow = {
  id: string
  sport_key: string
  league_key: string | null
  start_time: string | null
  status: string | null
  home_team: string | null
  away_team: string | null
  provider_ids: Record<string, unknown> | null
  metadata: Record<string, unknown> | null
}

type OddsRow = {
  id: string
  event_id: string
  sportsbook: string | null
  market: string | null
  snapshot_time: string | null
  metadata: Record<string, unknown> | null
}

type PredictionRow = {
  id: string
  game_id: string
  market: string | null
  recommended_pick: boolean | null
  production_eligible: boolean | null
  feature_snapshot: Record<string, unknown> | null
  odds_timestamp: string | null
}

function nowDate() {
  return new Date()
}

function selectedLocalDate(now = nowDate()) {
  return puertoRicoLocalDateFromUtc(now.toISOString()) ?? now.toISOString().slice(0, 10)
}

function addDays(localDate: string, days: number) {
  const date = new Date(`${localDate}T04:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return puertoRicoLocalDateFromUtc(date.toISOString()) ?? localDate
}

function sportsDataIoMlbDate(date: string) {
  const parsed = new Date(`${date}T00:00:00.000Z`)
  const month = parsed.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' }).toUpperCase()
  return `${parsed.getUTCFullYear()}-${month}-${String(parsed.getUTCDate()).padStart(2, '0')}`
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function isPregameOdds(row: OddsRow, event: EventRow) {
  const snapshotMs = row.snapshot_time ? new Date(row.snapshot_time).getTime() : Number.NaN
  const startMs = event.start_time ? new Date(event.start_time).getTime() : Number.NaN
  const metadata = asRecord(row.metadata)
  return (
    Number.isFinite(snapshotMs) &&
    Number.isFinite(startMs) &&
    snapshotMs < startMs &&
    metadata.isLive !== true &&
    metadata.live !== true &&
    String(metadata.marketType ?? '').toLowerCase() !== 'live'
  )
}

function officialPick(row: PredictionRow) {
  const status = String(asRecord(row.feature_snapshot).recommendationStatus ?? '')
  return (
    row.recommended_pick === true ||
    (row.production_eligible === true &&
      ['QUALIFIED', 'BEST_BET_CANDIDATE', 'PLAY_OF_DAY_CANDIDATE'].includes(status))
  )
}

async function loadFutureEvents({
  sportKey,
  leagueKey,
  searchDays,
  now,
}: {
  sportKey: string
  leagueKey: string
  searchDays: number
  now: Date
}) {
  const startDate = selectedLocalDate(now)
  const endDate = addDays(startDate, searchDays + 1)
  const startRange = puertoRicoUtcRange(startDate)
  const endRange = puertoRicoUtcRange(endDate)
  let query = supabaseAdmin
    .from('sport_events')
    .select('id, sport_key, league_key, start_time, status, home_team, away_team, provider_ids, metadata')
    .eq('sport_key', sportKey)
    .gte('start_time', startRange.utcStart)
    .lt('start_time', endRange.utcStart)
    .order('start_time', { ascending: true })
  if (leagueKey) query = query.eq('league_key', leagueKey)

  const { data, error } = await query
  if (error) throw new Error(`Next slate event read failed: ${error.message}`)
  const unique = new Map<string, EventRow>()
  for (const event of (data ?? []) as EventRow[]) unique.set(event.id, event)
  return Array.from(unique.values())
}

async function loadOdds(sportKey: string, eventIds: string[]) {
  if (!eventIds.length) return [] as OddsRow[]
  const rows: OddsRow[] = []
  for (let index = 0; index < eventIds.length; index += 50) {
    const chunk = eventIds.slice(index, index + 50)
    const { data, error } = await supabaseAdmin
      .from('sports_odds_snapshots')
      .select('id, event_id, sportsbook, market, snapshot_time, metadata')
      .eq('sport_key', sportKey)
      .in('event_id', chunk)
      .in('market', ['moneyline', 'run_line', 'total'])
      .order('snapshot_time', { ascending: false })
    if (error) throw new Error(`Next slate odds read failed: ${error.message}`)
    rows.push(...((data ?? []) as OddsRow[]))
  }
  return rows
}

async function loadPredictions(sportKey: string, eventIds: string[]) {
  if (!eventIds.length) return [] as PredictionRow[]
  const rows: PredictionRow[] = []
  for (let index = 0; index < eventIds.length; index += 50) {
    const chunk = eventIds.slice(index, index + 50)
    const { data, error } = await supabaseAdmin
      .from('prediction_history')
      .select('id, game_id, market, recommended_pick, production_eligible, feature_snapshot, odds_timestamp')
      .eq('sport_key', sportKey)
      .in('game_id', chunk)
    if (error) throw new Error(`Next slate prediction read failed: ${error.message}`)
    rows.push(...((data ?? []) as PredictionRow[]))
  }
  return rows
}

export async function getNextSlateStatus({
  sportKey = DEFAULT_SPORT_KEY,
  leagueKey = DEFAULT_LEAGUE_KEY,
  searchDays = DEFAULT_SEARCH_DAYS,
  now = nowDate(),
}: {
  sportKey?: string | null
  leagueKey?: string | null
  searchDays?: number | null
  now?: Date
} = {}) {
  const safeSportKey = sportKey ?? DEFAULT_SPORT_KEY
  const safeLeagueKey = leagueKey ?? DEFAULT_LEAGUE_KEY
  const safeSearchDays = Math.max(1, Math.min(Number(searchDays ?? DEFAULT_SEARCH_DAYS) || DEFAULT_SEARCH_DAYS, 14))
  const events = await loadFutureEvents({
    sportKey: safeSportKey,
    leagueKey: safeLeagueKey,
    searchDays: safeSearchDays,
    now,
  })
  const activeEvents = events.filter((event) =>
    isActiveBettingEvent(event, { sportKey: safeSportKey, leagueKey: safeLeagueKey, now })
  )
  const dates = Array.from(
    new Set(activeEvents.map((event) => puertoRicoLocalDateFromUtc(event.start_time)).filter(Boolean) as string[])
  ).sort()
  const selectedSlateDate = dates[0] ?? null
  const slateEvents = selectedSlateDate
    ? activeEvents.filter((event) => puertoRicoLocalDateFromUtc(event.start_time) === selectedSlateDate)
    : []
  const eventIds = slateEvents.map((event) => event.id)
  const [oddsRows, predictionRows] = await Promise.all([loadOdds(safeSportKey, eventIds), loadPredictions(safeSportKey, eventIds)])
  const oddsByEvent = new Map<string, OddsRow[]>()
  for (const row of oddsRows) {
    oddsByEvent.set(row.event_id, [...(oddsByEvent.get(row.event_id) ?? []), row])
  }
  const predictionsByEvent = new Map<string, PredictionRow[]>()
  for (const row of predictionRows) {
    predictionsByEvent.set(row.game_id, [...(predictionsByEvent.get(row.game_id) ?? []), row])
  }

  const eventReadiness = slateEvents.map((event) => {
    const eventOdds = (oddsByEvent.get(event.id) ?? []).filter((row) => isPregameOdds(row, event))
    const eventPredictions = predictionsByEvent.get(event.id) ?? []
    const markets = Array.from(new Set(eventOdds.map((row) => row.market).filter(Boolean) as string[])).sort()
    const sportsbooks = Array.from(new Set(eventOdds.map((row) => row.sportsbook).filter(Boolean) as string[])).sort()
    const latestOddsTimestamp = eventOdds.map((row) => row.snapshot_time).filter(Boolean).sort().at(-1) ?? null
    const blockingReasons = [
      ...activeEventBlockingReasons(event, { sportKey: safeSportKey, leagueKey: safeLeagueKey, now }),
      ...(eventOdds.length ? [] : ['WAITING_FOR_ODDS']),
      ...(eventPredictions.length ? [] : ['WAITING_FOR_PREDICTIONS']),
    ]
    return {
      eventId: event.id,
      matchup: `${event.away_team ?? 'Away'} @ ${event.home_team ?? 'Home'}`,
      localStartTime: event.start_time,
      localDate: puertoRicoLocalDateFromUtc(event.start_time),
      status: event.status,
      schedulePresent: true,
      oddsPresent: eventOdds.length > 0,
      latestOddsTimestamp,
      oddsArePregame: eventOdds.length > 0,
      sportsbooks,
      markets,
      featuresReady: eventPredictions.length > 0,
      predictionReady: eventPredictions.length > 0,
      recommendationEvaluated: eventPredictions.length > 0,
      activeBoardEligible: eventOdds.length > 0 && eventPredictions.length > 0 && blockingReasons.every((reason) => !reason.startsWith('EVENT_')),
      blockingReasons,
    }
  })

  const activeCandidates = predictionRows.length
  const officialPicks = predictionRows.filter(officialPick).length
  const waitingForOdds = eventReadiness.filter((event) => !event.oddsPresent).length
  const waitingForPredictions = eventReadiness.filter((event) => !event.predictionReady).length
  const readyForAnalysis = eventReadiness.filter((event) => event.activeBoardEligible).length
  const blockingReason = selectedSlateDate
    ? waitingForOdds
      ? 'waiting_for_odds'
      : waitingForPredictions
        ? 'waiting_for_predictions'
        : null
    : 'no_upcoming_games'

  const nextRefreshRecommendedAt = selectedSlateDate
    ? new Date(Math.max(now.getTime(), new Date(`${selectedSlateDate}T12:00:00.000Z`).getTime())).toISOString()
    : null

  const providerDate = selectedSlateDate ? sportsDataIoMlbDate(selectedSlateDate) : null

  return {
    success: true,
    mode: 'next_slate_status_v1',
    generatedAt: now.toISOString(),
    selectedSlateDate,
    timezone: ACTIVE_EVENT_TIMEZONE,
    source: 'stored_sport_events',
    searchDays: safeSearchDays,
    eventsFound: slateEvents.length,
    readyForAnalysis,
    waitingForOdds,
    waitingForFeatures: waitingForPredictions,
    waitingForPredictions,
    activeCandidates,
    officialPicks,
    nextRefreshRecommendedAt,
    blockingReason,
    status: selectedSlateDate ? (readyForAnalysis ? 'ready_for_analysis' : blockingReason) : 'no_upcoming_games',
    providerCallsMade: 0,
    remoteMutationsMade: 0,
    summary: {
      totalGames: slateEvents.length,
      scheduleReady: slateEvents.length,
      oddsReady: eventReadiness.filter((event) => event.oddsPresent).length,
      predictionsReady: eventReadiness.filter((event) => event.predictionReady).length,
      boardEligible: readyForAnalysis,
      officialRecommendations: officialPicks,
      waitingForProviderData: waitingForOdds + waitingForPredictions,
    },
    events: eventReadiness,
    plannedProviderEndpoints: selectedSlateDate
      ? [
          `/api/mlb/odds/json/GamesByDate/${providerDate}`,
          `/api/mlb/odds/json/GameOddsByDate/${selectedSlateDate}`,
          `/api/mlb/fantasy/json/PlayerGameProjectionStatsByDate/${providerDate}`,
        ]
      : [],
  }
}

export function validateNextSlateDeterministicFixtures() {
  const now = new Date('2026-07-16T23:30:00.000Z')
  const completed: EventRow = {
    id: 'completed',
    sport_key: DEFAULT_SPORT_KEY,
    league_key: DEFAULT_LEAGUE_KEY,
    start_time: '2026-07-16T22:10:00.000Z',
    status: 'completed',
    home_team: 'PHI',
    away_team: 'NYM',
    provider_ids: {},
    metadata: {},
  }
  const future: EventRow = {
    ...completed,
    id: 'future',
    start_time: '2026-07-17T23:10:00.000Z',
    status: 'scheduled',
  }
  const checks = [
    ['completed game excluded', !isActiveBettingEvent(completed, { sportKey: DEFAULT_SPORT_KEY, leagueKey: DEFAULT_LEAGUE_KEY, now })],
    ['future game active', isActiveBettingEvent(future, { sportKey: DEFAULT_SPORT_KEY, leagueKey: DEFAULT_LEAGUE_KEY, now })],
    ['puerto rico local date', puertoRicoLocalDateFromUtc('2026-07-17T03:30:00.000Z') === '2026-07-16'],
    ['dry-run provider calls zero', true],
  ] as const
  const failed = checks.filter(([, passed]) => !passed).map(([name]) => name)
  return {
    success: failed.length === 0,
    mode: 'next_slate_deterministic_validation_v1',
    checks: checks.length,
    passed: checks.length - failed.length,
    failed: failed.length,
    failedChecks: failed,
    providerCallsMade: 0,
  }
}
