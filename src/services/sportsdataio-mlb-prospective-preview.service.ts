import 'server-only'

import { createHash } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { createFeatureSnapshot } from '@/services/feature-store-core.service'
import { evaluateRecommendationEligibility } from '@/services/recommendation-eligibility-policy.service'
import { buildSportPrediction } from '@/services/sport-prediction-engine-sdk.service'
import {
  normalizeSportsDataIoMlbGameOdds,
  type SportsDataIoMlbEventReference,
} from '@/services/sportsdataio-mlb-normalization.service'
import {
  SPORTSDATAIO_DISCOVERY_LAB_ORIGIN,
  resolveSportsDataIoDiscoveryLabUrl,
} from '@/services/sportsdataio-discovery-lab-url.service'

const PROVIDER = 'sportsdataio'
const PROVIDER_VARIANT = 'sportsdataio_discovery_lab'
const SPORT_KEY = 'baseball_mlb'
const LEAGUE_KEY = 'mlb'
const SEASON = '2026'
const BASE_ORIGIN = SPORTSDATAIO_DISCOVERY_LAB_ORIGIN
const MODE = 'sportsdataio_mlb_prospective_preview_v1'
const INTELLIGENCE_VERSION = 'mlb_prediction_intelligence_v1'
const DEFAULT_TIMEOUT_MS = 15000
const MAX_CALLS = 6

type Request = {
  dryRun?: boolean | null
  confirmed?: boolean | null
  selectedDate?: string | null
  finalPregameRefresh?: boolean | null
  operatingDayRefresh?: boolean | null
  operatingDayFinalRefresh?: boolean | null
  maximumRequests?: number | null
  timeoutMs?: number | null
}

type EndpointResult = {
  endpoint: string
  origin: string
  pathname: string
  status: number
  contentType: string | null
  rateLimitRemaining: string | null
  retryAfter: string | null
}

type EventRow = {
  id: string
  sport_key: string
  league_key: string
  season: string
  home_team_id: string | null
  away_team_id: string | null
  home_team: string | null
  away_team: string | null
  start_time: string
  status: string | null
  home_score?: number | null
  away_score?: number | null
  provider_ids: Record<string, unknown> | null
  metadata: Record<string, unknown> | null
}

type OddsRow = {
  id: string
  event_id: string
  sportsbook: string
  market: 'moneyline' | 'run_line' | 'total'
  outcome: string
  price: number
  line: number | null
  snapshot_time: string
  metadata: Record<string, unknown> | null
}

function nowIso() {
  return new Date().toISOString()
}

function safeString(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return typeof value === 'string' && value.trim() ? value.trim() : ''
}

function safeNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value)
  return null
}

function safeInteger(value: unknown) {
  const parsed = safeNumber(value)
  return parsed !== null && Number.isInteger(parsed) ? parsed : null
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function keyPart(value: unknown) {
  return String(value ?? 'null')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'null'
}

function stableId(parts: unknown[]) {
  return parts.map(keyPart).join(':')
}

function stableUuid(parts: unknown[]) {
  const hex = createHash('sha256').update(stableId(parts)).digest('hex')
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `5${hex.slice(13, 16)}`,
    `${((parseInt(hex.slice(16, 18), 16) & 0x3f) | 0x80).toString(16).padStart(2, '0')}${hex.slice(18, 20)}`,
    hex.slice(20, 32),
  ].join('-')
}

function parseDateMs(value: string | null | undefined) {
  if (!value) return null
  const parsed = new Date(value).getTime()
  return Number.isFinite(parsed) ? parsed : null
}

function selectedDateFromEvents(events: EventRow[], now: Date) {
  const future = events
    .filter((event) => {
      const start = parseDateMs(event.start_time)
      return start !== null && start > now.getTime() && (event.status ?? 'scheduled') === 'scheduled'
    })
    .sort((left, right) => String(left.start_time).localeCompare(String(right.start_time)))
  return future[0]?.start_time.slice(0, 10) ?? null
}

function sportsDataIoMlbDate(date: string) {
  const parsed = new Date(`${date}T00:00:00.000Z`)
  const month = parsed.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' }).toUpperCase()
  return `${parsed.getUTCFullYear()}-${month}-${String(parsed.getUTCDate()).padStart(2, '0')}`
}

function providerGameId(row: Record<string, unknown>) {
  return safeString(row.GameID) || safeString(row.GameId) || safeString(row.GlobalGameID) || safeString(row.GlobalGameId)
}

function providerTeamId(row: Record<string, unknown>, side: 'home' | 'away') {
  if (side === 'home') return safeString(row.HomeTeamID) || safeString(row.HomeTeamId) || safeString(row.HomeGlobalTeamID)
  return safeString(row.AwayTeamID) || safeString(row.AwayTeamId) || safeString(row.AwayGlobalTeamID)
}

function teamKey(row: Record<string, unknown>, side: 'home' | 'away') {
  if (side === 'home') return safeString(row.HomeTeam) || safeString(row.HomeTeamKey) || safeString(row.HomeTeamName)
  return safeString(row.AwayTeam) || safeString(row.AwayTeamKey) || safeString(row.AwayTeamName)
}

function eventStart(row: Record<string, unknown>) {
  const candidate = safeString(row.DateTimeUTC) || safeString(row.DateTime) || safeString(row.Day) || safeString(row.GameDate)
  const parsed = new Date(candidate)
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null
}

function eventStatus(value: unknown) {
  const status = safeString(value).toLowerCase()
  if (['final', 'f', 'closed', 'completed'].includes(status)) return 'completed'
  if (['inprogress', 'in progress', 'live'].includes(status)) return 'live'
  if (['postponed', 'delayed', 'suspended'].includes(status)) return 'postponed'
  if (['canceled', 'cancelled'].includes(status)) return 'cancelled'
  return 'scheduled'
}

function teamId(providerId: string, abbreviation: string) {
  return `${SPORT_KEY}:${LEAGUE_KEY}:${PROVIDER}:team:${keyPart(providerId || abbreviation)}`
}

function eventId(providerId: string) {
  return `${SPORT_KEY}:${LEAGUE_KEY}:${PROVIDER}:event:${keyPart(providerId)}`
}

function quarantine(extra: Record<string, unknown> = {}) {
  return {
    provider: PROVIDER,
    provider_variant: PROVIDER_VARIANT,
    importModule: MODE,
    trial: false,
    scrambled: false,
    production_eligible: false,
    prospective_preview: true,
    validation_status: 'quarantined',
    rawPayloadStored: false,
    ...extra,
  }
}

async function fetchJson(endpoint: string, apiKey: string, timeoutMs: number) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  const resolvedUrl = resolveSportsDataIoDiscoveryLabUrl(endpoint)
  try {
    const response = await fetch(resolvedUrl.url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'Ocp-Apim-Subscription-Key': apiKey,
      },
      cache: 'no-store',
      signal: controller.signal,
    })
    const endpointResult: EndpointResult = {
      endpoint,
      origin: resolvedUrl.origin,
      pathname: resolvedUrl.pathname,
      status: response.status,
      contentType: response.headers.get('content-type'),
      rateLimitRemaining: response.headers.get('x-ratelimit-remaining'),
      retryAfter: response.headers.get('retry-after'),
    }
    if ([401, 403, 404, 429].includes(response.status)) {
      throw Object.assign(new Error(`SportsDataIO MLB stopped on HTTP ${response.status}.`), { endpointResult })
    }
    if (!response.ok) {
      throw Object.assign(new Error(`SportsDataIO MLB returned HTTP ${response.status}.`), { endpointResult })
    }
    const payload = await response.json()
    if (!Array.isArray(payload)) {
      throw Object.assign(new Error('SportsDataIO MLB endpoint returned a non-array payload.'), { endpointResult })
    }
    return { payload: payload as Record<string, unknown>[], endpointResult }
  } finally {
    clearTimeout(timeout)
  }
}

async function countExisting(table: string, ids: string[]) {
  if (!ids.length) return new Set<string>()
  const existing = new Set<string>()
  for (let index = 0; index < ids.length; index += 200) {
    const slice = ids.slice(index, index + 200)
    const result = await supabaseAdmin.from(table).select('id').in('id', slice)
    if (result.error) throw new Error(`${table} existing-row check failed: ${result.error.message}`)
    for (const row of result.data ?? []) existing.add(String(row.id))
  }
  return existing
}

async function countExistingMappings(rows: Array<Record<string, unknown>>) {
  if (!rows.length) return new Set<string>()
  const ids = rows.map((row) => String(row.provider_id))
  const result = await supabaseAdmin
    .from('provider_entity_mappings')
    .select('provider_id')
    .eq('sport_key', SPORT_KEY)
    .eq('provider', PROVIDER)
    .in('provider_id', ids)
  if (result.error) throw new Error(`provider_entity_mappings existing-row check failed: ${result.error.message}`)
  return new Set((result.data ?? []).map((row) => String(row.provider_id)))
}

async function loadFutureEvents() {
  const result = await supabaseAdmin
    .from('sport_events')
    .select('id, sport_key, league_key, season, home_team_id, away_team_id, home_team, away_team, start_time, status, home_score, away_score, provider_ids, metadata')
    .eq('sport_key', SPORT_KEY)
    .eq('league_key', LEAGUE_KEY)
    .eq('season', SEASON)
    .gte('start_time', nowIso())
    .order('start_time', { ascending: true })
    .limit(200)
  if (result.error) throw new Error(`future sport_events read failed: ${result.error.message}`)
  return (result.data ?? []) as EventRow[]
}

async function loadEventsForDate(date: string) {
  const start = `${date}T00:00:00.000Z`
  const end = new Date(start)
  end.setUTCDate(end.getUTCDate() + 1)
  const result = await supabaseAdmin
    .from('sport_events')
    .select('id, sport_key, league_key, season, home_team_id, away_team_id, home_team, away_team, start_time, status, home_score, away_score, provider_ids, metadata')
    .eq('sport_key', SPORT_KEY)
    .eq('league_key', LEAGUE_KEY)
    .eq('season', SEASON)
    .gte('start_time', start)
    .lt('start_time', end.toISOString())
    .order('start_time', { ascending: true })
    .limit(200)
  if (result.error) throw new Error(`sport_events date read failed: ${result.error.message}`)
  return (result.data ?? []) as EventRow[]
}

function normalizeSchedule(payload: Record<string, unknown>[], selectedDate: string, capturedAt: string) {
  const teams = new Map<string, Record<string, unknown>>()
  const events: Record<string, unknown>[] = []
  const mappings: Record<string, unknown>[] = []
  const unresolved: string[] = []
  const seenEvents = new Set<string>()

  for (const game of payload) {
    const gameId = providerGameId(game)
    const start = eventStart(game)
    const homeProviderId = providerTeamId(game, 'home')
    const awayProviderId = providerTeamId(game, 'away')
    const homeKey = teamKey(game, 'home')
    const awayKey = teamKey(game, 'away')
    if (!gameId || !start || (!homeProviderId && !homeKey) || (!awayProviderId && !awayKey)) {
      unresolved.push(gameId || `row:${unresolved.length}`)
      continue
    }
    const homeId = teamId(homeProviderId, homeKey)
    const awayId = teamId(awayProviderId, awayKey)
    for (const [id, providerId, abbreviation] of [
      [homeId, homeProviderId, homeKey],
      [awayId, awayProviderId, awayKey],
    ]) {
      teams.set(id, {
        id,
        sport_key: SPORT_KEY,
        league_key: LEAGUE_KEY,
        name: abbreviation || `SportsDataIO MLB Team ${providerId}`,
        abbreviation: abbreviation || null,
        city: null,
        conference: null,
        division: null,
        logo_url: null,
        active: true,
        provider_ids: { sportsdataio: providerId || abbreviation, abbreviation: abbreviation || null },
        metadata: quarantine({ entityType: 'team', season: SEASON, capturedAt }),
        updated_at: capturedAt,
      })
    }

    const id = eventId(gameId)
    if (seenEvents.has(id)) continue
    seenEvents.add(id)
    const status = eventStatus(game.Status)
    events.push({
      id,
      sport_key: SPORT_KEY,
      league_key: LEAGUE_KEY,
      season: SEASON,
      stage: safeString(game.SeasonType) || null,
      home_team_id: homeId,
      away_team_id: awayId,
      home_team: homeKey || `SportsDataIO MLB Team ${homeProviderId}`,
      away_team: awayKey || `SportsDataIO MLB Team ${awayProviderId}`,
      start_time: start,
      venue: safeString(game.Stadium) || safeString(game.StadiumDetails) || null,
      status,
      home_score: status === 'completed' ? safeInteger(game.HomeTeamRuns ?? game.HomeTeamScore) : null,
      away_score: status === 'completed' ? safeInteger(game.AwayTeamRuns ?? game.AwayTeamScore) : null,
      period_scores: {},
      overtime: Boolean(game.Inning && Number(game.Inning) > 9) || Boolean(game.ExtraInnings),
      provider_ids: {
        sportsdataio: gameId,
        sportsdataio_game_id: gameId,
        homeTeamId: homeProviderId || null,
        awayTeamId: awayProviderId || null,
        globalGameId: game.GlobalGameID ?? game.GlobalGameId ?? null,
      },
      metadata: quarantine({
        entityType: 'event',
        providerStatus: game.Status ?? null,
        selectedSlateDate: selectedDate,
        day: game.Day ?? null,
        doubleHeaderGame: game.DoubleHeaderGame ?? game.GameNumber ?? null,
        seasonType: game.SeasonType ?? null,
        capturedAt,
        rawFieldNames: Object.keys(game).sort(),
      }),
      updated_at: capturedAt,
    })
  }

  for (const team of teams.values()) {
    mappings.push({
      sport_key: SPORT_KEY,
      entity_type: 'team',
      internal_id: team.id,
      provider: PROVIDER,
      provider_id: String((team.provider_ids as Record<string, unknown>).sportsdataio),
      season: '',
      metadata: quarantine({ entityType: 'team', capturedAt }),
      updated_at: capturedAt,
    })
  }
  for (const event of events) {
    mappings.push({
      sport_key: SPORT_KEY,
      entity_type: 'event',
      internal_id: String(event.id),
      provider: PROVIDER,
      provider_id: String((event.provider_ids as Record<string, unknown>).sportsdataio),
      season: SEASON,
      metadata: quarantine({ entityType: 'event', capturedAt }),
      updated_at: capturedAt,
    })
  }

  return { teams: Array.from(teams.values()), events, mappings, unresolved }
}

function eventReferences(events: EventRow[]): SportsDataIoMlbEventReference[] {
  return events.map((event) => ({
    id: event.id,
    provider_ids: event.provider_ids,
    start_time: event.start_time,
  }))
}

async function writeCheckpoint(input: {
  phase: string
  selectedDate: string
  status: 'completed' | 'partial' | 'failed' | 'blocked'
  startedAt: string
  endpoint: EndpointResult | null
  recordsFetched: number
  inserted: number
  updated: number
  skipped: number
  errorCount: number
  providerCallsUsed: number
  metadata: Record<string, unknown>
  lastError?: string | null
}) {
  const completedAt = nowIso()
  const result = await supabaseAdmin.from('sports_sync_jobs').insert({
    id: crypto.randomUUID(),
    job_type: MODE,
    sport_key: SPORT_KEY,
    league_key: LEAGUE_KEY,
    provider: PROVIDER,
    season: SEASON,
    started_at: input.startedAt,
    completed_at: completedAt,
    status: input.status,
    records_fetched: input.recordsFetched,
    records_inserted: input.inserted,
    records_updated: input.updated,
    records_skipped: input.skipped,
    error_count: input.errorCount,
    last_error: input.lastError ?? null,
    duration_ms: new Date(completedAt).getTime() - new Date(input.startedAt).getTime(),
    metadata: {
      providerVariant: PROVIDER_VARIANT,
      executionVersion: MODE,
      prospective_preview: true,
      externalCallsUsed: input.providerCallsUsed,
      endpoint: input.endpoint,
      checkpoint: {
        key: stableId([MODE, input.selectedDate, input.phase]),
        status: input.status,
        phase: input.phase,
        selectedDate: input.selectedDate,
        providerCallsUsed: input.providerCallsUsed,
        httpStatus: input.endpoint?.status ?? null,
        startedAt: input.startedAt,
        completedAt,
        trial: false,
        scrambled: false,
        production_eligible: false,
        prospective_preview: true,
      },
      ...input.metadata,
      quarantine: quarantine(),
      rawPayloadStored: false,
      noSecretExposure: true,
    },
    updated_at: completedAt,
  }).select('id').single()
  if (result.error) throw new Error(`sports_sync_jobs checkpoint write failed: ${result.error.message}`)
  return String(result.data.id)
}

async function loadCompletedCheckpoint(selectedDate: string, phase: string) {
  const result = await supabaseAdmin
    .from('sports_sync_jobs')
    .select('id, metadata')
    .eq('job_type', MODE)
    .eq('provider', PROVIDER)
    .eq('sport_key', SPORT_KEY)
    .eq('season', SEASON)
    .eq('status', 'completed')
    .contains('metadata', { prospective_preview: true })
    .order('started_at', { ascending: false })
    .limit(25)
  if (result.error) throw new Error(`prospective checkpoint read failed: ${result.error.message}`)
  return (result.data ?? []).find((row) => {
    const checkpoint = asRecord(asRecord(row.metadata)?.checkpoint)
    return checkpoint?.selectedDate === selectedDate && checkpoint?.phase === phase
  }) ?? null
}

async function loadPersistedSafeOddsForDate(events: EventRow[]) {
  const eventIds = events.map((event) => event.id)
  if (!eventIds.length) return [] as OddsRow[]
  const result = await supabaseAdmin
    .from('sports_odds_snapshots')
    .select('id, event_id, sportsbook, market, outcome, price, line, snapshot_time, metadata')
    .eq('sport_key', SPORT_KEY)
    .eq('league_key', LEAGUE_KEY)
    .eq('season', SEASON)
    .in('event_id', eventIds)
    .eq('provider', PROVIDER)
    .order('snapshot_time', { ascending: true })
    .limit(1000)
  if (result.error) throw new Error(`persisted odds read failed: ${result.error.message}`)
  const eventById = new Map(events.map((event) => [event.id, event]))
  return ((result.data ?? []) as OddsRow[]).filter((row) => {
    const event = eventById.get(row.event_id)
    const eventStart = parseDateMs(event?.start_time)
    const timestamp = parseDateMs(row.snapshot_time)
    const metadata = row.metadata ?? {}
    return (
      eventStart !== null &&
      timestamp !== null &&
      timestamp < eventStart &&
      metadata.production_eligible === false &&
      metadata.validation_status === 'quarantined'
    )
  })
}

function marketForPrediction(market: string) {
  return market === 'run_line' ? 'spread' : market
}

function americanImplied(price: number) {
  return price > 0 ? Number(((100 / (price + 100)) * 100).toFixed(2)) : Number(((Math.abs(price) / (Math.abs(price) + 100)) * 100).toFixed(2))
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function round(value: number, places = 2) {
  const factor = 10 ** places
  return Math.round(value * factor) / factor
}

function outcomePreference(row: OddsRow) {
  const market = marketForPrediction(row.market)
  const outcome = String(row.outcome).toLowerCase()
  if (market === 'total') return outcome === 'under' ? 0 : 1
  return outcome === 'away' ? 0 : outcome === 'home' ? 1 : 2
}

function shouldReplaceChosenOdds(row: OddsRow, existing: OddsRow) {
  const rowTime = parseDateMs(row.snapshot_time) ?? 0
  const existingTime = parseDateMs(existing.snapshot_time) ?? 0
  if (rowTime !== existingTime) return rowTime > existingTime
  const rowPreference = outcomePreference(row)
  const existingPreference = outcomePreference(existing)
  if (rowPreference !== existingPreference) return rowPreference < existingPreference
  const rowSportsbook = row.sportsbook === 'Consensus' ? 0 : 1
  const existingSportsbook = existing.sportsbook === 'Consensus' ? 0 : 1
  if (rowSportsbook !== existingSportsbook) return rowSportsbook < existingSportsbook
  return row.id < existing.id
}

function chooseOddsRows(events: EventRow[], odds: OddsRow[]) {
  const eventsById = new Map(events.map((event) => [event.id, event]))
  const chosen = new Map<string, OddsRow>()
  for (const row of odds) {
    const event = eventsById.get(row.event_id)
    if (!event) continue
    const start = parseDateMs(event.start_time)
    const ts = parseDateMs(row.snapshot_time)
    if (start === null || ts === null) continue
    const cutoff = start - 10 * 60 * 1000
    if (ts > cutoff) continue
    const key = `${row.event_id}:${marketForPrediction(row.market)}`
    const existing = chosen.get(key)
    if (!existing || shouldReplaceChosenOdds(row, existing)) {
      chosen.set(key, row)
    }
  }
  return Array.from(chosen.values())
}

type TeamGame = {
  eventId: string
  startTime: string
  teamId: string
  opponentId: string | null
  isHome: boolean
  runsFor: number
  runsAgainst: number
  win: boolean
  runDiff: number
  extraInnings: boolean
}

type TeamProfile = {
  teamId: string
  teamName: string
  sampleSize: number
  season: ReturnType<typeof summarizeGames>
  last3: ReturnType<typeof summarizeGames>
  last5: ReturnType<typeof summarizeGames>
  last10: ReturnType<typeof summarizeGames>
  split: ReturnType<typeof summarizeGames>
  splitLabel: 'home' | 'away'
  strengthOfSchedule: {
    available: boolean
    sampleSize: number
    averageOpponentWinPct: number | null
    averageOpponentRunDifferential: number | null
    difficultyIndex: number | null
  }
  rest: {
    available: boolean
    daysSinceLastGame: number | null
    gamesLast3Days: number
    gamesLast7Days: number
    backToBack: boolean
    travelProxy: 'home' | 'road' | 'neutral'
    doubleheaderRecovery: boolean
    extraInningsPreviousGame: boolean
    score: number
  }
  momentum: {
    label: 'positive' | 'negative' | 'neutral'
    scoringTrend: number
    defensiveTrend: number
    description: string
  }
  bullpenProxy: {
    available: boolean
    workload: null
    fatigue: string
    sampleSize: number
    reason: string
  }
  teamStrengthIndex: number
  positiveFactors: string[]
  negativeFactors: string[]
}

type MatchupIntelligence = {
  version: string
  eventId: string
  cutoff: string
  home: TeamProfile
  away: TeamProfile
  featureDomains: {
    recentForm: boolean
    homeAwaySplits: boolean
    strengthOfSchedule: boolean
    restSchedule: boolean
    momentum: boolean
    bullpenProxy: boolean
  }
  missingDomains: string[]
  quality: number
  sufficiency: number
  reliabilityScore: number
  reliabilityLabel: 'Limited data' | 'Developing' | 'Solid' | 'Strong'
}

function eventIsCompleted(event: EventRow) {
  const metadata = asRecord(event.metadata)
  return event.status === 'completed' || metadata?.providerStatus === 'Final'
}

function scorePair(event: EventRow) {
  const metadata = asRecord(event.metadata)
  const home = safeNumber(event.home_score ?? metadata?.homeScore ?? metadata?.HomeScore)
  const away = safeNumber(event.away_score ?? metadata?.awayScore ?? metadata?.AwayScore)
  if (home === null || away === null) return null
  return { home, away }
}

function eventToTeamGames(event: EventRow): TeamGame[] {
  if (!event.home_team_id || !event.away_team_id || !eventIsCompleted(event)) return []
  const scores = scorePair(event)
  if (!scores) return []
  const metadata = asRecord(event.metadata)
  const innings = safeNumber(metadata?.innings ?? metadata?.Innings)
  const extraInnings = Boolean(metadata?.extraInnings === true || (innings !== null && innings > 9))
  return [
    {
      eventId: event.id,
      startTime: event.start_time,
      teamId: event.home_team_id,
      opponentId: event.away_team_id,
      isHome: true,
      runsFor: scores.home,
      runsAgainst: scores.away,
      win: scores.home > scores.away,
      runDiff: scores.home - scores.away,
      extraInnings,
    },
    {
      eventId: event.id,
      startTime: event.start_time,
      teamId: event.away_team_id,
      opponentId: event.home_team_id,
      isHome: false,
      runsFor: scores.away,
      runsAgainst: scores.home,
      win: scores.away > scores.home,
      runDiff: scores.away - scores.home,
      extraInnings,
    },
  ]
}

function summarizeGames(games: TeamGame[]) {
  const wins = games.filter((game) => game.win).length
  const losses = games.length - wins
  const runsFor = games.reduce((sum, game) => sum + game.runsFor, 0)
  const runsAgainst = games.reduce((sum, game) => sum + game.runsAgainst, 0)
  const runDifferential = runsFor - runsAgainst
  const firstHalf = games.slice(Math.ceil(games.length / 2))
  const secondHalf = games.slice(0, Math.ceil(games.length / 2))
  const firstAvg = firstHalf.length ? firstHalf.reduce((sum, game) => sum + game.runsFor, 0) / firstHalf.length : 0
  const secondAvg = secondHalf.length ? secondHalf.reduce((sum, game) => sum + game.runsFor, 0) / secondHalf.length : 0
  const trend = games.length >= 4 ? round(secondAvg - firstAvg) : 0
  const hotCold =
    games.length >= 5 && wins / games.length >= 0.65
      ? 'hot'
      : games.length >= 5 && wins / games.length <= 0.35
        ? 'cold'
        : 'neutral'
  return {
    sampleSize: games.length,
    wins,
    losses,
    runsFor,
    runsAgainst,
    runDifferential,
    averageRunsFor: games.length ? round(runsFor / games.length) : null,
    averageRunsAgainst: games.length ? round(runsAgainst / games.length) : null,
    winPct: games.length ? round(wins / games.length, 3) : null,
    trend,
    hotCold,
  }
}

async function loadCompletedEventsBefore(cutoff: string) {
  const result = await supabaseAdmin
    .from('sport_events')
    .select('id, sport_key, league_key, season, home_team_id, away_team_id, home_team, away_team, start_time, status, home_score, away_score, provider_ids, metadata')
    .eq('sport_key', SPORT_KEY)
    .eq('league_key', LEAGUE_KEY)
    .eq('season', SEASON)
    .lt('start_time', cutoff)
    .order('start_time', { ascending: false })
    .limit(500)
  if (result.error) throw new Error(`completed events read failed: ${result.error.message}`)
  return ((result.data ?? []) as EventRow[]).filter((event) => eventToTeamGames(event).length > 0)
}

function strengthOfSchedule(teamGames: TeamGame[], gamesByTeam: Map<string, TeamGame[]>) {
  const opponentProfiles = teamGames
    .map((game) => (game.opponentId ? summarizeGames(gamesByTeam.get(game.opponentId) ?? []) : null))
    .filter((profile): profile is ReturnType<typeof summarizeGames> => Boolean(profile && profile.sampleSize > 0))
  if (!opponentProfiles.length) {
    return {
      available: false,
      sampleSize: 0,
      averageOpponentWinPct: null,
      averageOpponentRunDifferential: null,
      difficultyIndex: null,
    }
  }
  const averageOpponentWinPct = round(
    opponentProfiles.reduce((sum, profile) => sum + (profile.winPct ?? 0.5), 0) / opponentProfiles.length,
    3
  )
  const averageOpponentRunDifferential = round(
    opponentProfiles.reduce((sum, profile) => sum + profile.runDifferential, 0) / opponentProfiles.length
  )
  return {
    available: true,
    sampleSize: opponentProfiles.length,
    averageOpponentWinPct,
    averageOpponentRunDifferential,
    difficultyIndex: round(clamp(50 + (averageOpponentWinPct - 0.5) * 80 + averageOpponentRunDifferential * 0.3, 0, 100)),
  }
}

function restProfile(teamGames: TeamGame[], cutoff: string, targetIsHome: boolean) {
  const cutoffMs = parseDateMs(cutoff) ?? Date.now()
  const latest = teamGames[0]
  const daysSinceLastGame = latest ? round((cutoffMs - (parseDateMs(latest.startTime) ?? cutoffMs)) / (24 * 60 * 60 * 1000), 1) : null
  const gamesLast3Days = teamGames.filter((game) => cutoffMs - (parseDateMs(game.startTime) ?? 0) <= 3 * 24 * 60 * 60 * 1000).length
  const gamesLast7Days = teamGames.filter((game) => cutoffMs - (parseDateMs(game.startTime) ?? 0) <= 7 * 24 * 60 * 60 * 1000).length
  const doubleheaderRecovery = latest
    ? teamGames.filter((game) => game.startTime.slice(0, 10) === latest.startTime.slice(0, 10)).length > 1
    : false
  const score = round(
    clamp(
      55 +
        (daysSinceLastGame === null ? -10 : daysSinceLastGame >= 2 ? 8 : daysSinceLastGame >= 1 ? 0 : -8) -
        Math.max(0, gamesLast7Days - 5) * 4 -
        (doubleheaderRecovery ? 6 : 0) -
        (latest?.extraInnings ? 5 : 0),
      0,
      100
    )
  )
  return {
    available: Boolean(latest),
    daysSinceLastGame,
    gamesLast3Days,
    gamesLast7Days,
    backToBack: daysSinceLastGame !== null && daysSinceLastGame <= 1.5,
    travelProxy: targetIsHome ? 'home' as const : 'road' as const,
    doubleheaderRecovery,
    extraInningsPreviousGame: latest?.extraInnings ?? false,
    score,
  }
}

function momentumProfile(teamGames: TeamGame[]) {
  const last10 = summarizeGames(teamGames.slice(0, 10))
  const last5 = summarizeGames(teamGames.slice(0, 5))
  const scoringTrend = round((last5.averageRunsFor ?? 0) - (last10.averageRunsFor ?? last5.averageRunsFor ?? 0))
  const defensiveTrend = round((last10.averageRunsAgainst ?? last5.averageRunsAgainst ?? 0) - (last5.averageRunsAgainst ?? 0))
  const label: 'positive' | 'negative' | 'neutral' =
    last10.sampleSize >= 5 && ((last10.winPct ?? 0.5) >= 0.65 || last10.runDifferential >= 10)
      ? 'positive'
      : last10.sampleSize >= 5 && ((last10.winPct ?? 0.5) <= 0.35 || last10.runDifferential <= -10)
        ? 'negative'
        : 'neutral'
  return {
    label,
    scoringTrend,
    defensiveTrend,
    description:
      label === 'positive'
        ? `Won ${last10.wins} of last ${last10.sampleSize} with +${Math.max(0, last10.runDifferential)} run differential.`
        : label === 'negative'
          ? `Won ${last10.wins} of last ${last10.sampleSize} with ${last10.runDifferential} run differential.`
          : `Recent form is balanced across ${last10.sampleSize} games.`,
  }
}

function teamStrengthIndex(input: {
  season: ReturnType<typeof summarizeGames>
  recent: ReturnType<typeof summarizeGames>
  split: ReturnType<typeof summarizeGames>
  sos: ReturnType<typeof strengthOfSchedule>
  rest: ReturnType<typeof restProfile>
}) {
  const seasonWin = (input.season.winPct ?? 0.5) * 100
  const recentWin = (input.recent.winPct ?? input.season.winPct ?? 0.5) * 100
  const runDiff = clamp(50 + (input.season.runDifferential / Math.max(1, input.season.sampleSize)) * 10, 0, 100)
  const split = (input.split.winPct ?? input.season.winPct ?? 0.5) * 100
  const sos = input.sos.difficultyIndex ?? 50
  return round(
    clamp(
      seasonWin * 0.3 +
        recentWin * 0.2 +
        runDiff * 0.2 +
        split * 0.1 +
        sos * 0.1 +
        input.rest.score * 0.1,
      0,
      100
    )
  )
}

function profileForTeam({
  teamId,
  teamName,
  targetIsHome,
  cutoff,
  gamesByTeam,
}: {
  teamId: string
  teamName: string
  targetIsHome: boolean
  cutoff: string
  gamesByTeam: Map<string, TeamGame[]>
}) {
  const games = (gamesByTeam.get(teamId) ?? []).sort((left, right) => String(right.startTime).localeCompare(String(left.startTime)))
  const season = summarizeGames(games)
  const last3 = summarizeGames(games.slice(0, 3))
  const last5 = summarizeGames(games.slice(0, 5))
  const last10 = summarizeGames(games.slice(0, 10))
  const split = summarizeGames(games.filter((game) => game.isHome === targetIsHome))
  const sos = strengthOfSchedule(games, gamesByTeam)
  const rest = restProfile(games, cutoff, targetIsHome)
  const momentum = momentumProfile(games)
  const teamStrength = teamStrengthIndex({ season, recent: last10, split, sos, rest })
  const positiveFactors = [
    last10.hotCold === 'hot' ? `Recent form: ${last10.wins}-${last10.losses} over last ${last10.sampleSize}.` : null,
    split.sampleSize && (split.winPct ?? 0) >= 0.55 ? `${targetIsHome ? 'Home' : 'Away'} split is positive at ${split.wins}-${split.losses}.` : null,
    sos.available && (sos.difficultyIndex ?? 50) >= 55 ? `Schedule difficulty is above average (${sos.difficultyIndex}).` : null,
    rest.available && rest.score >= 60 ? `Rest profile is favorable (${rest.daysSinceLastGame} days since last game).` : null,
    momentum.label === 'positive' ? `Momentum is positive: ${momentum.description}` : null,
  ].filter(Boolean) as string[]
  const negativeFactors = [
    last10.hotCold === 'cold' ? `Recent form is cold at ${last10.wins}-${last10.losses} over last ${last10.sampleSize}.` : null,
    split.sampleSize && (split.winPct ?? 1) <= 0.45 ? `${targetIsHome ? 'Home' : 'Away'} split is negative at ${split.wins}-${split.losses}.` : null,
    rest.backToBack ? 'Back-to-back schedule spot reduces rest score.' : null,
    rest.extraInningsPreviousGame ? 'Previous game went extra innings.' : null,
    momentum.label === 'negative' ? `Momentum is negative: ${momentum.description}` : null,
  ].filter(Boolean) as string[]
  return {
    teamId,
    teamName,
    sampleSize: season.sampleSize,
    season,
    last3,
    last5,
    last10,
    split,
    splitLabel: targetIsHome ? 'home' as const : 'away' as const,
    strengthOfSchedule: sos,
    rest,
    momentum,
    bullpenProxy: {
      available: false,
      workload: null,
      fatigue: 'unavailable' as const,
      sampleSize: 0,
      reason: 'Normalized imported MLB rows do not yet expose starter/relief split or relief-innings workload.',
    },
    teamStrengthIndex: teamStrength,
    positiveFactors,
    negativeFactors,
  }
}

async function deriveMatchupIntelligence(event: EventRow, cutoff: string, historyCount: number): Promise<MatchupIntelligence> {
  const completedEvents = await loadCompletedEventsBefore(cutoff)
  const gamesByTeam = new Map<string, TeamGame[]>()
  for (const completedEvent of completedEvents) {
    for (const game of eventToTeamGames(completedEvent)) {
      const current = gamesByTeam.get(game.teamId) ?? []
      current.push(game)
      gamesByTeam.set(game.teamId, current)
    }
  }
  for (const [teamId, games] of gamesByTeam) {
    gamesByTeam.set(teamId, games.sort((left, right) => String(right.startTime).localeCompare(String(left.startTime))))
  }
  const home = profileForTeam({
    teamId: String(event.home_team_id ?? 'home'),
    teamName: String(event.home_team ?? 'Home'),
    targetIsHome: true,
    cutoff,
    gamesByTeam,
  })
  const away = profileForTeam({
    teamId: String(event.away_team_id ?? 'away'),
    teamName: String(event.away_team ?? 'Away'),
    targetIsHome: false,
    cutoff,
    gamesByTeam,
  })
  const validDomains = {
    recentForm: home.last5.sampleSize > 0 && away.last5.sampleSize > 0,
    homeAwaySplits: home.split.sampleSize > 0 && away.split.sampleSize > 0,
    strengthOfSchedule: home.strengthOfSchedule.available && away.strengthOfSchedule.available,
    restSchedule: home.rest.available && away.rest.available,
    momentum: home.last10.sampleSize > 0 && away.last10.sampleSize > 0,
    bullpenProxy: false,
  }
  const validCount = Object.values(validDomains).filter(Boolean).length
  const missingDomains = [
    'starting_pitcher',
    'confirmed_lineup',
    'injury_diagnosis',
    'weather',
    'bullpen_context',
    ...Object.entries(validDomains).filter(([, available]) => !available).map(([domain]) => domain),
  ]
  const coverage = Math.min(home.sampleSize, away.sampleSize)
  const quality = round(clamp(52 + validCount * 5 + Math.min(10, Math.floor(historyCount / 25)) - missingDomains.length * 1.5, 45, 82))
  const sufficiency = round(clamp(42 + Math.min(24, coverage * 1.7) + validCount * 4 - (validDomains.bullpenProxy ? 0 : 4), 35, 80))
  const reliabilityScore = round(clamp(quality * 0.35 + sufficiency * 0.35 + Math.min(coverage, 20) * 1.2 + validCount * 2 - missingDomains.length, 0, 100))
  const reliabilityLabel = reliabilityScore >= 85 ? 'Strong' : reliabilityScore >= 70 ? 'Solid' : reliabilityScore >= 55 ? 'Developing' : 'Limited data'
  return {
    version: INTELLIGENCE_VERSION,
    eventId: event.id,
    cutoff,
    home,
    away,
    featureDomains: validDomains,
    missingDomains,
    quality,
    sufficiency,
    reliabilityScore,
    reliabilityLabel,
  }
}

function marketStability(oddsRows: OddsRow[], selected: OddsRow, market: string) {
  const logicalRows = oddsRows
    .filter((row) => row.event_id === selected.event_id && marketForPrediction(row.market) === market && row.outcome === selected.outcome)
    .sort((left, right) => String(left.snapshot_time).localeCompare(String(right.snapshot_time)))
  const first = logicalRows[0] ?? selected
  const priceMove = selected.price - first.price
  const lineMove = selected.line !== null && first.line !== null ? round(selected.line - first.line) : null
  return {
    initialOdds: first.price,
    latestOdds: selected.price,
    initialLine: first.line,
    latestLine: selected.line,
    priceMove,
    lineMove,
    direction: priceMove === 0 && (lineMove ?? 0) === 0 ? 'stable' : priceMove < 0 ? 'more_expensive' : 'cheaper',
    score: round(clamp(75 - Math.abs(priceMove) * 0.35 - Math.abs(lineMove ?? 0) * 8, 35, 90)),
  }
}

function derivedProjection({
  market,
  line,
  selection,
  event,
  intelligence,
}: {
  market: string
  line: number | null
  selection: string
  event: EventRow
  intelligence: MatchupIntelligence
}) {
  const home = intelligence.home
  const away = intelligence.away
  const selectedIsHome = selection === event.home_team
  const selectedProfile = selectedIsHome ? home : away
  const opponentProfile = selectedIsHome ? away : home
  const strengthMargin = (selectedProfile.teamStrengthIndex - opponentProfile.teamStrengthIndex) / 8
  const recentRunMargin =
    ((selectedProfile.last10.runDifferential / Math.max(1, selectedProfile.last10.sampleSize || 1)) -
      (opponentProfile.last10.runDifferential / Math.max(1, opponentProfile.last10.sampleSize || 1))) * 0.35
  const sideMargin = round(clamp(strengthMargin + recentRunMargin + (selectedIsHome ? 0.18 : -0.08), -4, 4))
  const selectedRuns = selectedProfile.last10.averageRunsFor ?? selectedProfile.season.averageRunsFor ?? 4.3
  const opponentRuns = opponentProfile.last10.averageRunsFor ?? opponentProfile.season.averageRunsFor ?? 4.3
  const projectedTotal = round(clamp(selectedRuns + opponentRuns, 5.5, 13.5))
  const uncertainty = round(clamp(30 - intelligence.reliabilityScore * 0.16 + intelligence.missingDomains.length * 0.9, 14, 34))
  if (market === 'total') {
    const margin = line === null ? 0 : selection === 'Under' ? round(line - projectedTotal) : round(projectedTotal - line)
    return {
      selectionScore: round(projectedTotal / 2),
      opponentScore: round(projectedTotal / 2),
      total: line ?? projectedTotal,
      margin,
      uncertainty,
    }
  }
  return {
    selectionScore: round(4.4 + sideMargin / 2),
    opponentScore: round(4.4 - sideMargin / 2),
    margin: market === 'spread' && line !== null ? round(sideMargin + line) : sideMargin,
    uncertainty,
  }
}

function selectionFor(event: EventRow, market: string, odds: OddsRow) {
  const outcome = String(odds.outcome).toLowerCase()
  return market === 'total'
    ? outcome === 'under'
      ? 'Under'
      : 'Over'
    : outcome === 'away'
      ? String(event.away_team ?? 'Away')
      : outcome === 'home'
        ? String(event.home_team ?? 'Home')
        : String(odds.outcome || event.home_team || 'Selected')
}

function opponentFor(event: EventRow, market: string, selection: string) {
  return market === 'total'
    ? 'Game total'
    : selection === event.home_team
      ? String(event.away_team ?? 'Opponent')
      : String(event.home_team ?? 'Opponent')
}

function confidenceLabel(confidence: number) {
  if (confidence >= 80) return 'Very High'
  if (confidence >= 70) return 'High'
  if (confidence >= 60) return 'Medium'
  return 'Low'
}

function aiGrade(score: number) {
  if (score >= 92) return 'A+'
  if (score >= 85) return 'A'
  if (score >= 75) return 'B'
  if (score >= 65) return 'C'
  if (score >= 55) return 'D'
  return 'F'
}

function aiRating(input: {
  confidence: number
  reliabilityScore: number
  featureQuality: number
  dataSufficiency: number
  edge: number
  ev: number
  marketStabilityScore: number
}) {
  return round(
    clamp(
      input.confidence * 0.25 +
        input.reliabilityScore * 0.2 +
        input.featureQuality * 0.2 +
        input.dataSufficiency * 0.15 +
        clamp(input.edge, 0, 8) * 1.25 +
        clamp(input.ev, 0, 10) +
        input.marketStabilityScore * 0.1,
      0,
      100
    )
  )
}

function rankingScore(input: {
  edge: number
  ev: number
  confidence: number
  reliabilityScore: number
  featureQuality: number
  dataSufficiency: number
  marketStabilityScore: number
  recommendationStatus: string
}) {
  const statusBoost =
    input.recommendationStatus === 'PLAY_OF_DAY_CANDIDATE'
      ? 20
      : input.recommendationStatus === 'BEST_BET_CANDIDATE'
        ? 16
        : input.recommendationStatus === 'QUALIFIED'
          ? 12
          : input.recommendationStatus === 'WATCH'
            ? 6
            : 0
  return round(
    clamp(
      statusBoost +
        clamp(input.edge, -12, 12) * 1.8 +
        clamp(input.ev, -20, 20) * 1.1 +
        input.confidence * 0.18 +
        input.reliabilityScore * 0.16 +
        input.featureQuality * 0.14 +
        input.dataSufficiency * 0.12 +
        input.marketStabilityScore * 0.08,
      0,
      100
    )
  )
}

async function completedHistoryCount(cutoff: string) {
  const result = await supabaseAdmin
    .from('sport_events')
    .select('id', { count: 'exact', head: true })
    .eq('sport_key', SPORT_KEY)
    .eq('league_key', LEAGUE_KEY)
    .eq('season', SEASON)
    .eq('status', 'completed')
    .lt('start_time', cutoff)
  if (result.error) throw new Error(`completed history count failed: ${result.error.message}`)
  return result.count ?? 0
}

async function writeSnapshotsAndPredictions(events: EventRow[], oddsRows: OddsRow[], selectedDate: string, generatedAt: string) {
  const selectedOdds = chooseOddsRows(events, oddsRows)
  const existingSnapshots = selectedOdds.length
    ? await supabaseAdmin
        .from('historical_feature_snapshots')
        .select('id, deterministic_key')
        .in('deterministic_key', selectedOdds.map((row) => stableId([MODE, INTELLIGENCE_VERSION, selectedDate, row.event_id, marketForPrediction(row.market), row.id])))
    : { data: [], error: null }
  if (existingSnapshots.error) throw new Error(`snapshot existing check failed: ${existingSnapshots.error.message}`)
  const existingByKey = new Map((existingSnapshots.data ?? []).map((row) => [String(row.deterministic_key), String(row.id)]))
  const eventsById = new Map(events.map((event) => [event.id, event]))
  const rowsToInsert: Record<string, unknown>[] = []
  const candidates: Array<{
    key: string
    snapshotId: string | null
    event: EventRow
    odds: OddsRow
    market: string
    selection: string
    opponent: string
    quality: number
    sufficiency: number
    historyCount: number
    intelligence: MatchupIntelligence
    marketStability: ReturnType<typeof marketStability>
  }> = []

  for (const odds of selectedOdds) {
    const event = eventsById.get(odds.event_id)
    if (!event) continue
    const market = marketForPrediction(odds.market)
    const cutoff = new Date(parseDateMs(event.start_time)! - 10 * 60 * 1000).toISOString()
    const historyCount = await completedHistoryCount(cutoff)
    const intelligence = await deriveMatchupIntelligence(event, cutoff, historyCount)
    const quality = intelligence.quality
    const sufficiency = intelligence.sufficiency
    const selection = selectionFor(event, market, odds)
    const opponent = opponentFor(event, market, selection)
    const stability = marketStability(oddsRows, odds, market)
    const snapshot = createFeatureSnapshot({
      sportKey: SPORT_KEY,
      leagueKey: LEAGUE_KEY,
      eventId: event.id,
      market: market as 'moneyline' | 'spread' | 'total',
      generatedAt,
      cutoffAt: cutoff,
      eventStartTime: event.start_time,
    })
    snapshot.featureQualityScore = quality
    snapshot.dataSufficiencyScore = sufficiency
    snapshot.noLeakage = true
    snapshot.warnings = [
      'QUARANTINED MODEL PREVIEW - NOT AN OFFICIAL PICK.',
      'No target-game result, target-game stats, post-start odds or production promotion used.',
      'Pitcher, lineup, injury, weather and bullpen domains are unavailable and not fabricated.',
    ]
    const key = stableId([MODE, INTELLIGENCE_VERSION, selectedDate, event.id, market, odds.id])
    const metadata = quarantine({
      selectedSlateDate: selectedDate,
      prospectivePreviewVersion: MODE,
      intelligenceVersion: INTELLIGENCE_VERSION,
      sourceOddsSnapshotId: odds.id,
      sourceOddsMarket: odds.market,
      sportsbook: odds.sportsbook,
      oddsTimestamp: odds.snapshot_time,
      season: SEASON,
    })
    const existingId = existingByKey.get(key) ?? null
    candidates.push({
      key,
      snapshotId: existingId,
      event,
      odds,
      market,
      selection,
      opponent,
      quality,
      sufficiency,
      historyCount,
      intelligence,
      marketStability: stability,
    })
    if (existingId) continue
    rowsToInsert.push({
      deterministic_key: key,
      sport_key: SPORT_KEY,
      league_key: LEAGUE_KEY,
      event_id: event.id,
      provider_event_id: String((event.provider_ids ?? {}).sportsdataio ?? ''),
      market,
      prediction_cutoff: cutoff,
      as_of_timestamp: cutoff,
      generated_at: generatedAt,
      model_version: 'baseball_mlb_prospective_preview_v1',
      feature_set_version: `baseball_mlb_${market}_prospective_feature_set_v2`,
      snapshot_version: 1,
      feature_values: {
        intelligenceVersion: INTELLIGENCE_VERSION,
        marketOdds: {
          sportsbook: odds.sportsbook,
          price: odds.price,
          line: odds.line,
          market,
          providerMarket: odds.market,
          snapshotTime: odds.snapshot_time,
        },
        marketStability: stability,
        derivedBaseballFeatures: {
          home: intelligence.home,
          away: intelligence.away,
          featureDomains: intelligence.featureDomains,
          reliabilityScore: intelligence.reliabilityScore,
          reliabilityLabel: intelligence.reliabilityLabel,
          teamStrengthFormula:
            '0.30 season win pct + 0.20 last-10 win pct + 0.20 per-game run differential + 0.10 home/away split + 0.10 opponent difficulty + 0.10 rest score.',
        },
        priorHistory: {
          completedGamesBeforeCutoff: historyCount,
          last5Available: historyCount >= 5,
          last10Available: historyCount >= 10,
        },
        unavailableDomains: intelligence.missingDomains,
      },
      feature_lineage: {
        source: MODE,
        intelligenceVersion: INTELLIGENCE_VERSION,
        eventId: event.id,
        oddsSnapshotId: odds.id,
        noTargetGameLeakage: true,
        noPostStartOdds: true,
        noRawPayloadStored: true,
      },
      source_timestamps: {
        odds: odds.snapshot_time,
        generatedAt,
        cutoff,
      },
      data_quality_score: quality,
      data_sufficiency_score: sufficiency,
      unresolved_mapping_count: 0,
      leakage_status: 'passed',
      leakage_warnings: snapshot.warnings,
      trial: false,
      scrambled: false,
      production_eligible: false,
      metadata,
    })
  }

  let insertedSnapshots = 0
  if (rowsToInsert.length) {
    const inserted = await supabaseAdmin
      .from('historical_feature_snapshots')
      .insert(rowsToInsert)
      .select('id, deterministic_key')
    if (inserted.error) throw new Error(`historical_feature_snapshots insert failed: ${inserted.error.message}`)
    insertedSnapshots = inserted.data?.length ?? 0
    for (const row of inserted.data ?? []) existingByKey.set(String(row.deterministic_key), String(row.id))
  }

  const predictionRows: Record<string, unknown>[] = []
  const previewCandidates = []
  for (const candidate of candidates) {
    const snapshotId = existingByKey.get(candidate.key)
    if (!snapshotId) continue
    const selection = candidate.selection
    const opponent = candidate.opponent
    const cutoff = new Date(parseDateMs(candidate.event.start_time)! - 10 * 60 * 1000).toISOString()
    const featureSnapshot = createFeatureSnapshot({
      sportKey: SPORT_KEY,
      leagueKey: LEAGUE_KEY,
      eventId: candidate.event.id,
      market: candidate.market as 'moneyline' | 'spread' | 'total',
      generatedAt: candidate.odds.snapshot_time,
      cutoffAt: cutoff,
      eventStartTime: candidate.event.start_time,
    })
    featureSnapshot.featureQualityScore = candidate.quality
    featureSnapshot.dataSufficiencyScore = candidate.sufficiency
    featureSnapshot.noLeakage = true
    featureSnapshot.warnings = ['QUARANTINED MODEL PREVIEW - NOT AN OFFICIAL PICK.']
    const sdk = buildSportPrediction({
      sportKey: SPORT_KEY,
      leagueKey: LEAGUE_KEY,
      eventId: candidate.event.id,
      market: candidate.market,
      selection,
      opponent,
      sportsbook: candidate.odds.sportsbook,
      americanOdds: candidate.odds.price,
      line: candidate.market === 'moneyline' ? null : candidate.odds.line,
      bankroll: 0,
      generatedAt,
      cutoffAt: cutoff,
      eventStartTime: candidate.event.start_time,
      featureSnapshot,
      projection: derivedProjection({
        market: candidate.market,
        line: candidate.odds.line,
        selection,
        event: candidate.event,
        intelligence: candidate.intelligence,
      }),
    })
    const predictionKey = stableId([MODE, selectedDate, snapshotId, selection])
    const predictionId = stableUuid([MODE, selectedDate, snapshotId, selection])
    const policy = evaluateRecommendationEligibility({
      id: predictionId,
      sport_key: SPORT_KEY,
      game_id: candidate.event.id,
      commence_time: candidate.event.start_time,
      home_team: candidate.event.home_team,
      away_team: candidate.event.away_team,
      team: selection,
      opponent,
      market: candidate.market,
      sportsbook: candidate.odds.sportsbook,
      odds: candidate.odds.price,
      implied_probability: americanImplied(candidate.odds.price),
      model_probability: sdk.modelProbability,
      confidence: sdk.confidence,
      edge: sdk.edge,
      ev: sdk.expectedValue,
      production_eligible: false,
      trial: false,
      scrambled: false,
      status: 'pending',
      odds_timestamp: candidate.odds.snapshot_time,
      generated_at: generatedAt,
      cutoff_at: cutoff,
      model_version: 'baseball_mlb_prospective_preview_v1',
      feature_snapshot_id: snapshotId,
      feature_set_version: `baseball_mlb_${candidate.market}_prospective_feature_set_v2`,
      data_quality_score: candidate.quality,
      data_sufficiency_score: candidate.sufficiency,
      calibrationStatus: 'probationary',
    }, { now: new Date(generatedAt), allowProbationaryPreview: true })
    const rating = aiRating({
      confidence: sdk.confidence,
      reliabilityScore: candidate.intelligence.reliabilityScore,
      featureQuality: candidate.quality,
      dataSufficiency: candidate.sufficiency,
      edge: sdk.edge,
      ev: sdk.expectedValue,
      marketStabilityScore: candidate.marketStability.score,
    })
    const rank = rankingScore({
      edge: sdk.edge,
      ev: sdk.expectedValue,
      confidence: sdk.confidence,
      reliabilityScore: candidate.intelligence.reliabilityScore,
      featureQuality: candidate.quality,
      dataSufficiency: candidate.sufficiency,
      marketStabilityScore: candidate.marketStability.score,
      recommendationStatus: policy.status,
    })
    const row = {
      id: predictionId,
      sport_key: SPORT_KEY,
      game_id: candidate.event.id,
      home_team: candidate.event.home_team,
      away_team: candidate.event.away_team,
      team: selection,
      opponent,
      market: candidate.market,
      selection,
      line: candidate.market === 'moneyline' ? null : candidate.odds.line,
      odds: candidate.odds.price,
      sportsbook: candidate.odds.sportsbook,
      implied_probability: americanImplied(candidate.odds.price),
      model_probability: sdk.modelProbability,
      confidence: sdk.confidence,
      edge: sdk.edge,
      ev: sdk.expectedValue,
      projected_line: sdk.projectedLine,
      recommended_pick: false,
      status: 'pending',
      lifecycle_status: 'active',
      result: null,
      stake: 0,
      profit: null,
      trial: false,
      scrambled: false,
      production_eligible: false,
      validation_status: 'skipped',
      validation_warnings: policy.warnings,
      skip_reason: policy.blockers.join(','),
      generated_at: generatedAt,
      cutoff_at: cutoff,
      commence_time: candidate.event.start_time,
      odds_timestamp: candidate.odds.snapshot_time,
      model_version: 'baseball_mlb_prospective_preview_v1',
      feature_set_version: `baseball_mlb_${candidate.market}_prospective_feature_set_v2`,
      feature_snapshot_id: snapshotId,
      feature_snapshot_key: candidate.key,
      feature_snapshot_generated_at: generatedAt,
      feature_snapshot: {
        prospective_preview: true,
        prospectivePreviewKey: predictionKey,
        intelligenceVersion: INTELLIGENCE_VERSION,
        quality: candidate.quality,
        sufficiency: candidate.sufficiency,
        confidenceLabel: confidenceLabel(sdk.confidence),
        reliabilityScore: candidate.intelligence.reliabilityScore,
        reliabilityLabel: candidate.intelligence.reliabilityLabel,
        aiRating: rating,
        aiGrade: aiGrade(rating),
        rankingScore: rank,
        recommendationStatus: policy.status,
        sourceOddsSnapshotId: candidate.odds.id,
        marketStability: candidate.marketStability,
        derivedBaseballFeatures: {
          home: candidate.intelligence.home,
          away: candidate.intelligence.away,
          featureDomains: candidate.intelligence.featureDomains,
        },
        positiveFactors: [
          ...candidate.intelligence.home.positiveFactors.map((factor) => `${candidate.event.home_team}: ${factor}`),
          ...candidate.intelligence.away.positiveFactors.map((factor) => `${candidate.event.away_team}: ${factor}`),
        ].slice(0, 5),
        negativeFactors: [
          ...candidate.intelligence.home.negativeFactors.map((factor) => `${candidate.event.home_team}: ${factor}`),
          ...candidate.intelligence.away.negativeFactors.map((factor) => `${candidate.event.away_team}: ${factor}`),
        ].slice(0, 5),
        missingData: candidate.intelligence.missingDomains,
        factors: [
          ...sdk.explanationFactors,
          `${candidate.event.home_team} strength index ${candidate.intelligence.home.teamStrengthIndex}; ${candidate.event.away_team} strength index ${candidate.intelligence.away.teamStrengthIndex}.`,
          `Recent form and split features are computed only from completed games before ${cutoff}.`,
        ],
        warnings: featureSnapshot.warnings,
      },
    }
    predictionRows.push(row)
    previewCandidates.push({
      matchup: `${candidate.event.away_team} @ ${candidate.event.home_team}`,
      startTime: candidate.event.start_time,
      market: candidate.market,
      selection,
      line: row.line,
      odds: row.odds,
      impliedProbability: row.implied_probability,
      modelProbability: row.model_probability,
      calibratedProbability: null,
      edge: row.edge,
      ev: row.ev,
      confidence: row.confidence,
      confidenceLabel: confidenceLabel(Number(row.confidence)),
      reliability: candidate.intelligence.reliabilityLabel,
      reliabilityScore: candidate.intelligence.reliabilityScore,
      featureQuality: candidate.quality,
      dataSufficiency: candidate.sufficiency,
      aiRating: rating,
      aiGrade: aiGrade(rating),
      rankingScore: rank,
      positiveFactors: (row.feature_snapshot as Record<string, unknown>).positiveFactors,
      negativeFactors: (row.feature_snapshot as Record<string, unknown>).negativeFactors,
      missingDataWarnings: candidate.intelligence.missingDomains,
      marketStability: candidate.marketStability,
      recommendationStatus: policy.status,
      blockers: policy.blockers,
      oddsTimestamp: candidate.odds.snapshot_time,
      cutoff,
    })
  }

  let insertedPredictions = 0
  let reusedPredictions = 0
  if (predictionRows.length) {
    const eventIds = Array.from(new Set(predictionRows.map((row) => String(row.game_id))))
    const existingLogicalResult = eventIds.length
      ? await supabaseAdmin
          .from('prediction_history')
          .select('id, game_id, market, team, odds, model_probability, confidence, edge, ev, feature_snapshot_id, feature_snapshot')
          .eq('sport_key', SPORT_KEY)
          .in('game_id', eventIds)
      : { data: [], error: null }
    if (existingLogicalResult.error) {
      throw new Error(`prediction_history logical existing-row check failed: ${existingLogicalResult.error.message}`)
    }
    const existingLogical = new Map(
      (existingLogicalResult.data ?? []).map((row) => [
        `${row.game_id}:${row.market}:${row.team}`,
        String(row.id),
      ])
    )
    const previousByLogical = new Map(
      (existingLogicalResult.data ?? []).map((row) => {
        const snapshot = asRecord(row.feature_snapshot) ?? {}
        return [
          `${row.game_id}:${row.market}:${row.team}`,
          {
            odds: row.odds,
            modelProbability: row.model_probability,
            confidence: row.confidence,
            edge: row.edge,
            ev: row.ev,
            featureSnapshotId: row.feature_snapshot_id,
            aiRating: snapshot.aiRating ?? null,
            recommendationStatus: snapshot.recommendationStatus ?? null,
            intelligenceVersion: snapshot.intelligenceVersion ?? null,
            rankingScore: snapshot.rankingScore ?? null,
          },
        ]
      })
    )
    for (const row of predictionRows) {
      const logicalKey = `${row.game_id}:${row.market}:${row.team}`
      const existingId = existingLogical.get(logicalKey)
      if (existingId) row.id = existingId
      const previous = previousByLogical.get(logicalKey)
      const snapshot = asRecord(row.feature_snapshot)
      if (previous && snapshot) {
        row.feature_snapshot = {
          ...snapshot,
          previousPreview: previous,
          comparison: {
            probabilityDelta: round(Number(row.model_probability ?? 0) - Number(previous.modelProbability ?? 0)),
            confidenceDelta: round(Number(row.confidence ?? 0) - Number(previous.confidence ?? 0)),
            edgeDelta: round(Number(row.edge ?? 0) - Number(previous.edge ?? 0)),
            evDelta: round(Number(row.ev ?? 0) - Number(previous.ev ?? 0)),
            aiRatingDelta:
              snapshot.aiRating !== null && previous.aiRating !== null
                ? round(Number(snapshot.aiRating ?? 0) - Number(previous.aiRating ?? 0))
                : null,
            recommendationChanged: snapshot.recommendationStatus !== previous.recommendationStatus,
          },
        }
      }
    }
    const existing = await countExisting('prediction_history', predictionRows.map((row) => String(row.id)))
    reusedPredictions = predictionRows.filter((row) => existing.has(String(row.id))).length
    const result = await supabaseAdmin.from('prediction_history').upsert(predictionRows, { onConflict: 'id' })
    if (result.error) throw new Error(`prediction_history upsert failed: ${result.error.message}`)
    insertedPredictions = predictionRows.length - reusedPredictions
    const currentLogical = new Set(
      predictionRows.map((row) => `${row.game_id}:${row.market}:${row.team}`)
    )
    const staleResult = await supabaseAdmin
      .from('prediction_history')
      .select('id, game_id, market, team, feature_snapshot')
      .eq('sport_key', SPORT_KEY)
      .in('game_id', eventIds)
    if (staleResult.error) {
      throw new Error(`prediction_history stale preview check failed: ${staleResult.error.message}`)
    }
    for (const row of staleResult.data ?? []) {
      const snapshot = asRecord(row.feature_snapshot) ?? {}
      const logicalKey = `${row.game_id}:${row.market}:${row.team}`
      if (snapshot.prospective_preview === true && !currentLogical.has(logicalKey)) {
        const updateResult = await supabaseAdmin
          .from('prediction_history')
          .update({
            feature_snapshot: {
              ...snapshot,
              prospective_preview: false,
              supersededByFinalPregameRefresh: true,
            },
            validation_status: 'skipped',
            skip_reason: 'SUPERSEDED_BY_FINAL_PREGAME_REFRESH',
            recommended_pick: false,
            production_eligible: false,
          })
          .eq('id', row.id)
        if (updateResult.error) {
          throw new Error(`prediction_history stale preview update failed: ${updateResult.error.message}`)
        }
      }
    }
  }

  return {
    candidates: previewCandidates,
    snapshots: {
      candidates: selectedOdds.length,
      inserted: insertedSnapshots,
      reused: selectedOdds.length - insertedSnapshots,
      rejected: Math.max(0, oddsRows.length - selectedOdds.length),
    },
    predictions: {
      analyzed: previewCandidates.length,
      inserted: insertedPredictions,
      reused: reusedPredictions,
      qualified: previewCandidates.filter((item) => ['QUALIFIED', 'BEST_BET_CANDIDATE', 'PLAY_OF_DAY_CANDIDATE'].includes(item.recommendationStatus)).length,
      watch: previewCandidates.filter((item) => item.recommendationStatus === 'WATCH').length,
      blocked: previewCandidates.filter((item) => item.recommendationStatus === 'ANALYZED_ONLY' || item.blockers.length > 0).length,
    },
  }
}

export async function runSportsDataIoMlbProspectivePreview(request: Request = {}) {
  const generatedAt = nowIso()
  const dryRun = request.dryRun ?? true
  const confirmed = request.confirmed === true
  const finalPregameRefresh = request.finalPregameRefresh === true
  const operatingDayRefresh = request.operatingDayRefresh === true
  const operatingDayFinalRefresh = request.operatingDayFinalRefresh === true
  const maximumRequests = Math.min(Number(request.maximumRequests ?? MAX_CALLS) || MAX_CALLS, MAX_CALLS)
  const timeoutMs = Number(request.timeoutMs ?? DEFAULT_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS
  const futureEvents = await loadFutureEvents()
  const selectedDate = request.selectedDate || selectedDateFromEvents(futureEvents, new Date(generatedAt))

  if (!selectedDate) {
    return {
      success: true,
      mode: MODE,
      status: 'no_future_games',
      dryRun,
      generatedAt,
      providerUsage: { externalProviderCallsMade: 0, source: 'persisted_future_event_audit' },
      selectedDate: null,
      message: 'No future MLB slate exists in persisted event state.',
    }
  }

  if (dryRun || !confirmed) {
    return {
      success: true,
      mode: MODE,
      status: 'dry_run',
      dryRun,
      confirmed,
      generatedAt,
      selectedDate,
      providerUsage: { externalProviderCallsMade: 0, source: 'dry_run_no_provider_calls' },
      plannedEndpoints: [
        ...(finalPregameRefresh ? [] : [`/api/mlb/odds/json/GamesByDate/${sportsDataIoMlbDate(selectedDate)}`]),
        `/api/mlb/odds/json/GameOddsByDate/${selectedDate}`,
        ...(finalPregameRefresh ? [] : [`/api/mlb/fantasy/json/PlayerGameProjectionStatsByDate/${sportsDataIoMlbDate(selectedDate)}`]),
      ],
      caps: { maximumRequests, concurrency: 1, retries: 0, timeoutMs },
    }
  }

  if (!finalPregameRefresh && maximumRequests < 3) throw new Error('Prospective preview requires at least 3 approved provider calls.')
  if (finalPregameRefresh && maximumRequests < 1) throw new Error('Final pregame refresh requires 1 approved provider call.')
  const apiKey = process.env.SPORTSDATAIO_MLB_API_KEY
  if (!apiKey) throw new Error('SPORTSDATAIO_MLB_API_KEY is not configured.')

  let calls = 0
  const endpoints: EndpointResult[] = []
  const scheduleEndpoint = `/api/mlb/odds/json/GamesByDate/${sportsDataIoMlbDate(selectedDate)}`
  const schedulePhase = operatingDayRefresh ? 'operating_day_slate_discovery' : 'slate_discovery'
  const existingScheduleCheckpoint = await loadCompletedCheckpoint(selectedDate, schedulePhase)
  let scheduleJobId = existingScheduleCheckpoint ? String(existingScheduleCheckpoint.id) : ''
  let gamesFound = 0
  if (!existingScheduleCheckpoint && !finalPregameRefresh) {
    const scheduleStarted = nowIso()
    calls += 1
    const schedule = await fetchJson(scheduleEndpoint, apiKey, timeoutMs)
    endpoints.push(schedule.endpointResult)
    gamesFound = schedule.payload.length
    const normalizedSchedule = normalizeSchedule(schedule.payload, selectedDate, generatedAt)
    const [existingTeams, existingEvents, existingMappings] = await Promise.all([
      countExisting('sports_teams', normalizedSchedule.teams.map((row) => String(row.id))),
      countExisting('sport_events', normalizedSchedule.events.map((row) => String(row.id))),
      countExistingMappings(normalizedSchedule.mappings),
    ])
    if (normalizedSchedule.teams.length) {
      const result = await supabaseAdmin.from('sports_teams').upsert(normalizedSchedule.teams, { onConflict: 'id' })
      if (result.error) throw new Error(`sports_teams upsert failed: ${result.error.message}`)
    }
    if (normalizedSchedule.events.length) {
      const result = await supabaseAdmin.from('sport_events').upsert(normalizedSchedule.events, { onConflict: 'id' })
      if (result.error) throw new Error(`sport_events upsert failed: ${result.error.message}`)
    }
    if (normalizedSchedule.mappings.length) {
      const result = await supabaseAdmin.from('provider_entity_mappings').upsert(normalizedSchedule.mappings, {
        onConflict: 'sport_key,entity_type,provider,provider_id,season',
      })
      if (result.error) throw new Error(`provider_entity_mappings upsert failed: ${result.error.message}`)
    }
    const scheduleInserted =
      normalizedSchedule.teams.filter((row) => !existingTeams.has(String(row.id))).length +
      normalizedSchedule.events.filter((row) => !existingEvents.has(String(row.id))).length +
      normalizedSchedule.mappings.filter((row) => !existingMappings.has(String(row.provider_id))).length
    const scheduleUpdated = normalizedSchedule.teams.length + normalizedSchedule.events.length + normalizedSchedule.mappings.length - scheduleInserted
    scheduleJobId = await writeCheckpoint({
      phase: schedulePhase,
      selectedDate,
      status: normalizedSchedule.unresolved.length ? 'partial' : 'completed',
      startedAt: scheduleStarted,
      endpoint: schedule.endpointResult,
      recordsFetched: schedule.payload.length,
      inserted: scheduleInserted,
      updated: scheduleUpdated,
      skipped: normalizedSchedule.unresolved.length,
      errorCount: normalizedSchedule.unresolved.length ? 1 : 0,
      providerCallsUsed: 1,
      metadata: { validation: { unresolvedGames: normalizedSchedule.unresolved } },
    })
    if (normalizedSchedule.unresolved.length) throw new Error('Slate discovery produced unresolved game mappings.')
  }

  const events = await loadEventsForDate(selectedDate)
  const nowMs = new Date(generatedAt).getTime()
  const futureSlate = events.filter((event) => {
    const start = parseDateMs(event.start_time)
    return start !== null && start > nowMs && event.status === 'scheduled'
  })
  if (!futureSlate.length) {
    return {
      success: true,
      mode: MODE,
      status: 'no_future_games',
      generatedAt,
      selectedDate,
      providerUsage: { externalProviderCallsMade: calls },
      endpoints,
      checkpoints: { scheduleJobId },
    }
  }

  const oddsEndpoint = `/api/mlb/odds/json/GameOddsByDate/${selectedDate}`
  const oddsPhase = operatingDayRefresh
    ? 'operating_day_odds_capture'
    : operatingDayFinalRefresh
      ? 'operating_day_final_odds_capture'
    : finalPregameRefresh
      ? 'final_pregame_odds_capture'
      : 'odds_capture'
  const existingOddsCheckpoint = await loadCompletedCheckpoint(selectedDate, oddsPhase)
  let oddsJobId = existingOddsCheckpoint ? String(existingOddsCheckpoint.id) : ''
  let safeOddsRows = await loadPersistedSafeOddsForDate(events)
  let duplicateRows = 0
  if (!existingOddsCheckpoint) {
    const oddsStarted = nowIso()
    calls += 1
    const odds = await fetchJson(oddsEndpoint, apiKey, timeoutMs)
    endpoints.push(odds.endpointResult)
    const normalizedOdds = normalizeSportsDataIoMlbGameOdds({
      payload: odds.payload,
      existingEvents: eventReferences(events),
      season: SEASON,
    })
    duplicateRows = normalizedOdds.counts.duplicateRows
    const eventById = new Map(events.map((event) => [event.id, event]))
    safeOddsRows = normalizedOdds.rows
      .map((row) => ({
        ...row,
        metadata: {
          ...row.metadata,
          capturedAt: generatedAt,
          prospective_preview: true,
          validation_status: 'quarantined',
        },
      }))
      .filter((row) => {
        const event = eventById.get(row.event_id)
        const eventStart = parseDateMs(event?.start_time)
        const timestamp = parseDateMs(row.snapshot_time)
        return eventStart !== null && timestamp !== null && timestamp < eventStart
      })
    const oddsAfterStart = normalizedOdds.rows.length - safeOddsRows.length
    const existingOdds = await countExisting('sports_odds_snapshots', safeOddsRows.map((row) => row.id))
    if (safeOddsRows.length) {
      const result = await supabaseAdmin.from('sports_odds_snapshots').upsert(safeOddsRows, { onConflict: 'id' })
      if (result.error) throw new Error(`sports_odds_snapshots upsert failed: ${result.error.message}`)
    }
    const oddsInserted = safeOddsRows.filter((row) => !existingOdds.has(row.id)).length
    const oddsUpdated = safeOddsRows.length - oddsInserted
    oddsJobId = await writeCheckpoint({
      phase: oddsPhase,
      selectedDate,
      status: normalizedOdds.unresolvedProviderGameIds.length || oddsAfterStart ? 'partial' : 'completed',
      startedAt: oddsStarted,
      endpoint: odds.endpointResult,
      recordsFetched: odds.payload.length,
      inserted: oddsInserted,
      updated: oddsUpdated,
      skipped: normalizedOdds.counts.recordsSkipped + oddsAfterStart,
      errorCount: normalizedOdds.unresolvedProviderGameIds.length || oddsAfterStart ? 1 : 0,
      providerCallsUsed: 1,
      metadata: {
        validation: {
          unresolvedEvents: normalizedOdds.unresolvedProviderGameIds,
          oddsAfterStart,
          duplicateRows: normalizedOdds.counts.duplicateRows,
        },
        marketCounts: {
          moneyline: safeOddsRows.filter((row) => row.market === 'moneyline').length,
          run_line: safeOddsRows.filter((row) => row.market === 'run_line').length,
          total: safeOddsRows.filter((row) => row.market === 'total').length,
        },
        sportsbooks: normalizedOdds.sportsbooks,
      },
    })
    if (normalizedOdds.unresolvedProviderGameIds.length) throw new Error('Odds capture produced unresolved event mappings.')
    if (oddsAfterStart) throw new Error('Odds capture included provider timestamps at/after first pitch.')
  }
  const eventById = new Map(events.map((event) => [event.id, event]))

  const projectionsEndpoint = `/api/mlb/fantasy/json/PlayerGameProjectionStatsByDate/${sportsDataIoMlbDate(selectedDate)}`
  const projectionsPhase = operatingDayRefresh ? 'operating_day_projections_availability' : 'projections_availability'
  const existingProjectionsCheckpoint = await loadCompletedCheckpoint(selectedDate, projectionsPhase)
  let projectionsJobId = existingProjectionsCheckpoint ? String(existingProjectionsCheckpoint.id) : ''
  let projectionRows = 0
  if (!existingProjectionsCheckpoint && !finalPregameRefresh) {
    const projectionsStarted = nowIso()
    calls += 1
    const projections = await fetchJson(projectionsEndpoint, apiKey, timeoutMs)
    endpoints.push(projections.endpointResult)
    projectionRows = projections.payload.length
    projectionsJobId = await writeCheckpoint({
      phase: projectionsPhase,
      selectedDate,
      status: 'completed',
      startedAt: projectionsStarted,
      endpoint: projections.endpointResult,
      recordsFetched: projections.payload.length,
      inserted: 0,
      updated: 0,
      skipped: 0,
      errorCount: 0,
      providerCallsUsed: 1,
      metadata: {
        projectionRows: projections.payload.length,
        persistedRows: 0,
        reason: 'Projection endpoint was used for availability/timestamp discovery only; no raw payload was stored.',
      },
    })
  }

  const preview = await writeSnapshotsAndPredictions(events, safeOddsRows as OddsRow[], selectedDate, generatedAt)
  const featuresJobId = await writeCheckpoint({
    phase: 'feature_generation',
    selectedDate,
    status: 'completed',
    startedAt: generatedAt,
    endpoint: null,
    recordsFetched: safeOddsRows.length,
    inserted: preview.snapshots.inserted,
    updated: preview.snapshots.reused,
    skipped: preview.snapshots.rejected,
    errorCount: 0,
    providerCallsUsed: 0,
    metadata: { snapshots: preview.snapshots },
  })
  const predictionsJobId = await writeCheckpoint({
    phase: 'prediction_generation',
    selectedDate,
    status: 'completed',
    startedAt: generatedAt,
    endpoint: null,
    recordsFetched: preview.predictions.analyzed,
    inserted: preview.predictions.inserted,
    updated: preview.predictions.reused,
    skipped: 0,
    errorCount: 0,
    providerCallsUsed: 0,
    metadata: { predictions: preview.predictions },
  })

  const startTimes = futureSlate.map((event) => event.start_time).sort()
  const timestamps = safeOddsRows.map((row) => row.snapshot_time).sort()
  return {
    success: true,
    mode: MODE,
    status: 'completed',
    generatedAt,
    selectedDate,
    finalPregameRefresh,
    providerUsage: { externalProviderCallsMade: calls, maximumRequests },
    endpoints,
    slate: {
      gamesFound: gamesFound || events.length,
      futureGames: futureSlate.length,
      mappedGames: events.length,
      unresolvedGames: 0,
      earliestStart: startTimes[0] ?? null,
      latestStart: startTimes[startTimes.length - 1] ?? null,
    },
    odds: {
      gamesWithOdds: new Set(safeOddsRows.map((row) => row.event_id)).size,
      rows: safeOddsRows.length,
      marketCounts: {
        moneyline: safeOddsRows.filter((row) => row.market === 'moneyline').length,
        run_line: safeOddsRows.filter((row) => row.market === 'run_line').length,
        total: safeOddsRows.filter((row) => row.market === 'total').length,
      },
      sportsbooks: Array.from(new Set(safeOddsRows.map((row) => row.sportsbook))).sort(),
      earliestProviderTimestamp: timestamps[0] ?? null,
      latestProviderTimestamp: timestamps[timestamps.length - 1] ?? null,
      eventsWithNoOdds: Math.max(0, futureSlate.length - new Set(safeOddsRows.map((row) => row.event_id)).size),
      staleOdds: 0,
      oddsAfterCutoff: safeOddsRows.filter((row) => {
        const event = eventById.get(row.event_id)
        const start = parseDateMs(event?.start_time)
        const timestamp = parseDateMs(row.snapshot_time)
        return start !== null && timestamp !== null && timestamp > start - 10 * 60 * 1000
      }).length,
      duplicateRows,
    },
    projections: {
      rows: projectionRows,
      mappedPlayers: 0,
      unresolvedPlayers: 0,
      timestampSafeRows: projectionRows,
      unavailableDomains: ['starting_pitcher', 'confirmed_lineup', 'injury_diagnosis', 'weather', 'bullpen_context'],
    },
    preview,
    checkpoints: {
      scheduleJobId,
      oddsJobId,
      projectionsJobId,
      featuresJobId,
      predictionsJobId,
    },
    safety: {
      officialPicks: 0,
      productionEligible: false,
      recurringCronActivated: false,
      rawPayloadStored: false,
      noSecretExposure: true,
    },
  }
}
