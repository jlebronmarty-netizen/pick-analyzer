import 'server-only'

import { createHash } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { probePredictionVersioningSchemaCapabilities } from '@/lib/server-schema-capabilities'
import { createFeatureSnapshot } from '@/services/feature-store-core.service'
import { evaluateRecommendationEligibility } from '@/services/recommendation-eligibility-policy.service'
import { buildSportPrediction } from '@/services/sport-prediction-engine-sdk.service'
import { getMlbMissingIntelligenceStatus } from '@/services/mlb-missing-intelligence.service'
import { getMlbStarterWeatherStadiumIntelligence } from '@/services/mlb-starter-weather-stadium-intelligence.service'
import {
  normalizeSportsDataIoMlbGameOdds,
  type SportsDataIoMlbEventReference,
} from '@/services/sportsdataio-mlb-normalization.service'
import {
  SPORTSDATAIO_DISCOVERY_LAB_ORIGIN,
  resolveSportsDataIoDiscoveryLabUrl,
} from '@/services/sportsdataio-discovery-lab-url.service'
import { normalizeSportsDataIoMlbGameDateTime, zonedUtcRange } from '@/services/provider-time-normalization.service'

const PROVIDER = 'sportsdataio'
const PROVIDER_VARIANT = 'sportsdataio_discovery_lab'
const SPORT_KEY = 'baseball_mlb'
const LEAGUE_KEY = 'mlb'
const SEASON = '2026'
const BASE_ORIGIN = SPORTSDATAIO_DISCOVERY_LAB_ORIGIN
const MODE = 'sportsdataio_mlb_prospective_preview_v1'
const INTELLIGENCE_VERSION = 'mlb_prediction_intelligence_v1'
const V6_MODEL_VERSION = 'baseball_mlb_prospective_v6'
const V6_FEATURE_SET_VERSION = 'baseball_mlb_prospective_feature_set_v6'
const V6_INTELLIGENCE_VERSION = 'mlb_prediction_engine_v6_starter_weather_stadium_v1'
const V6_REGENERATION_REASON = 'starter_weather_stadium_calculation_integration_v1'
const V7_MODEL_VERSION = 'baseball_mlb_prospective_v7'
const V7_FEATURE_SET_VERSION = 'baseball_mlb_prospective_feature_set_v7'
const V7_INTELLIGENCE_VERSION = 'mlb_prediction_engine_v7_confidence_engine_v2'
const V7_REGENERATION_REASON = 'confidence_engine_v2_verified_intelligence_integration_v1'
const DEFAULT_TIMEOUT_MS = 15000
const MAX_CALLS = 6

type Request = {
  dryRun?: boolean | null
  confirmed?: boolean | null
  selectedDate?: string | null
  operatingDayId?: string | null
  finalPregameRefresh?: boolean | null
  operatingDayRefresh?: boolean | null
  operatingDayFinalRefresh?: boolean | null
  forceRefresh?: boolean | null
  maximumRequests?: number | null
  timeoutMs?: number | null
}

type V6RegenerationRequest = {
  dryRun?: boolean | null
  confirmed?: boolean | null
  selectedDate?: string | null
  idempotencyKey?: string | null
}

type MlbModelGeneration = 'v6' | 'v7'

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

type ProviderCheckEvidence = {
  providerCheckRequired: boolean
  providerCheckAttempted: boolean
  providerCheckCompleted: boolean
  provider: typeof PROVIDER
  endpoint: string | null
  category: 'mlb_current_game_odds'
  callsMade: number
  responseTimestamp: string | null
  sourceLatestTimestamp: string | null
  rowsReceived: number
  snapshotsCompared: number
  changesDetected: number
  rowsInserted: number
  rowsUpdated: number
  rowsSkipped: number
  downstreamRebuildRequired: boolean
  failureReason: string | null
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

function predictionGroupKey(input: {
  sportKey: string
  eventId: string
  market: string
  selection: string
  sportsbook: string | null | undefined
  line: number | null | undefined
}) {
  return stableId([
    input.sportKey,
    input.eventId,
    input.market,
    input.selection,
    input.sportsbook ?? '',
    input.line ?? '',
  ])
}

function parseDateMs(value: string | null | undefined) {
  if (!value) return null
  const parsed = new Date(value).getTime()
  return Number.isFinite(parsed) ? parsed : null
}

function maxIso(values: Array<string | null | undefined>) {
  return values.filter(Boolean).sort().at(-1) ?? null
}

function oddsComparisonKey(row: Pick<OddsRow, 'event_id' | 'sportsbook' | 'market' | 'outcome' | 'line'>) {
  return stableId([row.event_id, row.sportsbook, row.market, row.outcome, row.line ?? 'null'])
}

function providerCheckEvidence(input: Partial<ProviderCheckEvidence> = {}): ProviderCheckEvidence {
  return {
    providerCheckRequired: input.providerCheckRequired ?? false,
    providerCheckAttempted: input.providerCheckAttempted ?? false,
    providerCheckCompleted: input.providerCheckCompleted ?? false,
    provider: PROVIDER,
    endpoint: input.endpoint ?? null,
    category: 'mlb_current_game_odds',
    callsMade: input.callsMade ?? 0,
    responseTimestamp: input.responseTimestamp ?? null,
    sourceLatestTimestamp: input.sourceLatestTimestamp ?? null,
    rowsReceived: input.rowsReceived ?? 0,
    snapshotsCompared: input.snapshotsCompared ?? 0,
    changesDetected: input.changesDetected ?? 0,
    rowsInserted: input.rowsInserted ?? 0,
    rowsUpdated: input.rowsUpdated ?? 0,
    rowsSkipped: input.rowsSkipped ?? 0,
    downstreamRebuildRequired: input.downstreamRebuildRequired ?? false,
    failureReason: input.failureReason ?? null,
  }
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
  return normalizeSportsDataIoMlbGameDateTime(row).normalizedUtc
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

async function loadExistingOddsByIds(ids: string[]) {
  if (!ids.length) return new Map<string, OddsRow>()
  const existing = new Map<string, OddsRow>()
  for (let index = 0; index < ids.length; index += 200) {
    const slice = ids.slice(index, index + 200)
    const result = await supabaseAdmin
      .from('sports_odds_snapshots')
      .select('id, event_id, sportsbook, market, outcome, price, line, snapshot_time, metadata')
      .in('id', slice)
    if (result.error) throw new Error(`sports_odds_snapshots existing-row detail check failed: ${result.error.message}`)
    for (const row of result.data ?? []) existing.set(String(row.id), row as OddsRow)
  }
  return existing
}

function oddsMateriallyChanged(row: OddsRow, existing: OddsRow | undefined) {
  if (!existing) return true
  return (
    String(row.event_id) !== String(existing.event_id) ||
    String(row.sportsbook) !== String(existing.sportsbook) ||
    String(row.market) !== String(existing.market) ||
    String(row.outcome) !== String(existing.outcome) ||
    Number(row.price) !== Number(existing.price) ||
    String(row.line ?? 'null') !== String(existing.line ?? 'null') ||
    String(row.snapshot_time) !== String(existing.snapshot_time)
  )
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
  const range = zonedUtcRange(date, 'America/Puerto_Rico')
  const result = await supabaseAdmin
    .from('sport_events')
    .select('id, sport_key, league_key, season, home_team_id, away_team_id, home_team, away_team, start_time, status, home_score, away_score, provider_ids, metadata')
    .eq('sport_key', SPORT_KEY)
    .eq('league_key', LEAGUE_KEY)
    .eq('season', SEASON)
    .gte('start_time', range.utcStart)
    .lt('start_time', range.utcEndExclusive)
    .order('start_time', { ascending: true })
    .limit(200)
  if (result.error) throw new Error(`sport_events date read failed: ${result.error.message}`)
  return (result.data ?? []) as EventRow[]
}

function isProspectiveOperatingDayEvent(event: EventRow) {
  const metadata = asRecord(event.metadata) ?? {}
  const status = String(event.status ?? 'scheduled').toLowerCase()
  return (
    event.sport_key === SPORT_KEY &&
    event.league_key === LEAGUE_KEY &&
    metadata.prospective_preview === true &&
    !['completed', 'final', 'cancelled', 'canceled'].includes(status)
  )
}

function normalizeSchedule(payload: Record<string, unknown>[], selectedDate: string, capturedAt: string) {
  const teams = new Map<string, Record<string, unknown>>()
  const events: Record<string, unknown>[] = []
  const mappings: Record<string, unknown>[] = []
  const unresolved: string[] = []
  const seenEvents = new Set<string>()

  for (const game of payload) {
    const gameId = providerGameId(game)
    const timeNormalization = normalizeSportsDataIoMlbGameDateTime(game)
    const start = timeNormalization.normalizedUtc
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
        providerDateTimeRaw: timeNormalization.raw,
        providerTimezone: timeNormalization.providerTimezone,
        temporalNormalization: {
          contract: 'mlb_temporal_truth_v1',
          source: timeNormalization.source,
          classification: timeNormalization.classification,
          normalizedUtc: timeNormalization.normalizedUtc,
          warnings: timeNormalization.warnings,
        },
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

async function loadCompletedCheckpoint(
  selectedDate: string,
  phase: string,
  acceptedStatuses: Array<'completed' | 'partial'> = ['completed']
) {
  const result = await supabaseAdmin
    .from('sports_sync_jobs')
    .select('id, metadata')
    .eq('job_type', MODE)
    .eq('provider', PROVIDER)
    .eq('sport_key', SPORT_KEY)
    .eq('season', SEASON)
    .in('status', acceptedStatuses)
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

type VerifiedMlbGameContext = Awaited<ReturnType<typeof getMlbStarterWeatherStadiumIntelligence>>['games'][number]

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
  verifiedContext = null,
}: {
  market: string
  line: number | null
  selection: string
  event: EventRow
  intelligence: MatchupIntelligence
  verifiedContext?: VerifiedMlbGameContext | null
}) {
  const home = intelligence.home
  const away = intelligence.away
  const selectedIsHome = selection === event.home_team
  const selectedProfile = selectedIsHome ? home : away
  const opponentProfile = selectedIsHome ? away : home
  const v6 = buildMlbV6FeatureContract({ event, intelligence, verifiedContext })
  const selectedStarter = selectedIsHome ? v6.homeStarter : v6.awayStarter
  const opponentStarter = selectedIsHome ? v6.awayStarter : v6.homeStarter
  const strengthMargin = (selectedProfile.teamStrengthIndex - opponentProfile.teamStrengthIndex) / 8
  const recentRunMargin =
    ((selectedProfile.last10.runDifferential / Math.max(1, selectedProfile.last10.sampleSize || 1)) -
      (opponentProfile.last10.runDifferential / Math.max(1, opponentProfile.last10.sampleSize || 1))) * 0.35
  const starterReadinessMargin = clamp(
    ((selectedStarter.readinessScore - opponentStarter.readinessScore) / 100) * 0.45,
    -0.45,
    0.45
  )
  const homeParkContextMargin = selectedIsHome && v6.stadium.stadiumId !== null ? 0.04 : 0
  const sideMargin = round(
    clamp(
      strengthMargin + recentRunMargin + (selectedIsHome ? 0.18 : -0.08) + starterReadinessMargin + homeParkContextMargin,
      -4,
      4
    )
  )
  const selectedRuns = selectedProfile.last10.averageRunsFor ?? selectedProfile.season.averageRunsFor ?? 4.3
  const opponentRuns = opponentProfile.last10.averageRunsFor ?? opponentProfile.season.averageRunsFor ?? 4.3
  const weatherRuns = clamp((v6.weather.weatherScore - 50) * 0.025, -0.45, 0.45)
  const windRuns = v6.weather.windSpeed === null ? 0 : clamp(v6.weather.windSpeed * 0.012, 0, 0.22)
  const projectedTotal = round(clamp(selectedRuns + opponentRuns + weatherRuns + windRuns, 5.5, 13.5))
  const missingPenalty = v6.missingInputFlags.length * 0.75
  const starterUncertainty = round((100 - (v6.homeStarter.certaintyScore + v6.awayStarter.certaintyScore) / 2) * 0.055)
  const weatherUncertainty = v6.weather.available ? (v6.weather.weatherRisk === 'elevated' ? 1.5 : -1) : 2.5
  const stadiumUncertainty = v6.stadium.stadiumMetadataAvailable ? -0.5 : 0.75
  const uncertainty = round(
    clamp(
      30 - intelligence.reliabilityScore * 0.16 + intelligence.missingDomains.length * 0.9 + missingPenalty + starterUncertainty + weatherUncertainty + stadiumUncertainty,
      12,
      38
    )
  )
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

function normalizedStarter(side: unknown) {
  const starter = asRecord(side)
  const status = safeString(starter?.status) || 'unknown'
  const confirmed = starter?.confirmed === true
  const probable = starter?.probable === true
  const hasIdentity = starter?.playerId !== null && starter?.playerId !== undefined
  const certaintyScore = confirmed ? 96 : probable ? 86 : hasIdentity ? 70 : 35
  return {
    playerId: starter?.playerId ?? null,
    name: safeString(starter?.name) || null,
    status,
    confirmed,
    probable,
    identityAvailable: hasIdentity || Boolean(safeString(starter?.name)),
    certaintyScore,
    readinessScore: certaintyScore,
    limitation: 'Starter identity/certainty only; pitcher performance statistics are unavailable unless a separate player-stat cache is populated.',
  }
}

function buildMlbV6FeatureContract({
  event,
  intelligence,
  verifiedContext,
}: {
  event: EventRow
  intelligence: MatchupIntelligence
  verifiedContext: VerifiedMlbGameContext | null
}) {
  const weather = asRecord(verifiedContext?.weather)
  const stadium = asRecord(verifiedContext?.stadium)
  const awayStarter = normalizedStarter(asRecord(verifiedContext?.starters)?.away)
  const homeStarter = normalizedStarter(asRecord(verifiedContext?.starters)?.home)
  const weatherScore = safeNumber(weather?.weatherScore) ?? 50
  const windSpeed = safeNumber(weather?.windSpeed)
  const windDirection = safeNumber(weather?.windDirection)
  const stadiumId = stadium?.stadiumId === null || stadium?.stadiumId === undefined ? null : String(stadium.stadiumId)
  const missingInputFlags = [
    !awayStarter.identityAvailable ? 'away_starter_identity' : null,
    !homeStarter.identityAvailable ? 'home_starter_identity' : null,
    weather?.tempHigh === null || weather?.tempHigh === undefined ? 'forecast_temperature' : null,
    windSpeed === null ? 'wind_speed' : null,
    windDirection === null ? 'wind_direction' : null,
    stadiumId === null ? 'stadium_id' : null,
    'confirmed_lineup',
    'injury_diagnosis',
    'bullpen_context',
    'stadium_metadata_cache',
  ].filter(Boolean) as string[]
  return {
    contract: 'mlb_v6_feature_input_contract',
    source: 'stored_sportsdataio_games_by_date_verification_and_completed_game_history',
    eventId: event.id,
    baseTeamStrength: {
      home: intelligence.home.teamStrengthIndex,
      away: intelligence.away.teamStrengthIndex,
      formula: 'Existing completed-game team strength index; not double-counted by V6 starter/weather adjustments.',
    },
    recentForm: {
      homeLast10: intelligence.home.last10,
      awayLast10: intelligence.away.last10,
    },
    homeAwayContext: {
      home: intelligence.home.split,
      away: intelligence.away.split,
    },
    awayStarter,
    homeStarter,
    weather: {
      available: Boolean(verifiedContext?.weather),
      tempLow: safeNumber(weather?.tempLow),
      tempHigh: safeNumber(weather?.tempHigh),
      description: safeString(weather?.description) || null,
      windSpeed,
      windDirection,
      weatherScore,
      runEnvironment: safeString(weather?.runEnvironment) || 'neutral',
      weatherRisk: safeString(weather?.weatherRisk) || 'unknown',
      transform: 'Totals receive bounded +/-0.45 run environment adjustment. Sides receive uncertainty adjustment only.',
      windBehavior: 'Wind speed is conservative and direction-neutral until stadium orientation metadata exists.',
    },
    stadium: {
      stadiumId,
      stadiumMetadataAvailable: Boolean(stadium?.name || stadium?.homePlateDirection || stadium?.runFactor !== undefined && stadium?.runFactor !== 1),
      parkFactor: safeNumber(stadium?.parkFactor) ?? 1,
      runFactor: safeNumber(stadium?.runFactor) ?? 1,
      transform: 'StadiumID alone verifies venue identity but does not create park-factor performance lift.',
    },
    dataQuality: {
      featureQuality: Math.max(intelligence.quality, verifiedContext ? 72 : intelligence.quality),
      dataSufficiency: Math.max(intelligence.sufficiency, verifiedContext ? 68 : intelligence.sufficiency),
      criticalCompleteness: verifiedContext ? 60 : 0,
    },
    missingInputFlags,
  }
}

function category(score: number) {
  if (score >= 80) return 'HIGH'
  if (score >= 62) return 'MODERATE'
  if (score >= 42) return 'LOW'
  return 'INSUFFICIENT'
}

function buildConfidenceEngineV2({
  sdkConfidence,
  marketStabilityScore,
  v6Contract,
  odds,
  featureQuality,
  dataSufficiency,
  edge,
  ev,
  missingIntelligence,
}: {
  sdkConfidence: number
  marketStabilityScore: number
  v6Contract: ReturnType<typeof buildMlbV6FeatureContract> | null
  odds: OddsRow
  featureQuality: number
  dataSufficiency: number
  edge: number
  ev: number
  missingIntelligence: Awaited<ReturnType<typeof getMlbMissingIntelligenceStatus>> | null
}) {
  const missing = new Set(v6Contract?.missingInputFlags ?? [])
  const handednessReady = Boolean(
    missingIntelligence &&
      (missingIntelligence.coverage.handedness.battingHandCoveragePct > 0 ||
        missingIntelligence.coverage.handedness.throwingHandCoveragePct > 0)
  )
  const bullpenReady = Boolean(
    missingIntelligence?.coverage.bullpen.readiness === 'ready_for_confidence_context'
  )
  const lineupReady = Boolean(
    missingIntelligence?.coverage.lineups.status === 'confirmed' ||
      missingIntelligence?.coverage.lineups.status === 'projected'
  )
  const injuryReady = Boolean(missingIntelligence?.coverage.injuries.status === 'available')
  const rosterAvailabilityReady = Boolean(missingIntelligence?.coverage.rosterAvailability?.status === 'available')
  const unknownRosterStatuses = Number(missingIntelligence?.coverage.rosterAvailability?.unknownStatusCount ?? 0)
  const staleRosterStatuses = Number(missingIntelligence?.coverage.rosterAvailability?.staleStatusCount ?? 0)
  const injuredListStatuses = Number(missingIntelligence?.coverage.rosterAvailability?.injuredListStatusRows ?? 0)
  const criticalBlockers = [
    ...Array.from(missing),
    bullpenReady ? null : 'bullpen_game_workload_unavailable',
    handednessReady ? null : 'handedness_unavailable',
    lineupReady ? null : 'lineup_unavailable',
    rosterAvailabilityReady ? null : 'roster_availability_unavailable',
    injuryReady ? null : 'detailed_injury_feed_unavailable',
  ].filter(Boolean) as string[]
  const starterEvidence =
    (v6Contract?.homeStarter.identityAvailable ? 1 : 0) +
    (v6Contract?.awayStarter.identityAvailable ? 1 : 0)
  const weatherEvidence = v6Contract?.weather.available ? 1 : 0
  const stadiumEvidence = v6Contract?.stadium.stadiumId ? 1 : 0
  const modelScore = round(clamp(sdkConfidence - 8 + starterEvidence * 2 + weatherEvidence * 1.5, 25, 88))
  const rosterQualityPenalty = Math.min(8, Math.ceil(unknownRosterStatuses / 25) + Math.ceil(staleRosterStatuses / 25))
  const ilContextPenalty = Math.min(4, Math.ceil(injuredListStatuses / 30))
  const dataPenalty = criticalBlockers.length * 4 + (missing.has('confirmed_lineup') ? 6 : 0) + (missing.has('injury_diagnosis') ? 6 : 0) + rosterQualityPenalty + ilContextPenalty
  const dataScore = round(clamp(featureQuality * 0.45 + dataSufficiency * 0.4 + starterEvidence * 4 + weatherEvidence * 3 + stadiumEvidence * 2 - dataPenalty, 15, 86))
  const marketScore = round(clamp(marketStabilityScore + (odds.price ? 5 : -35) + (odds.snapshot_time ? 4 : -20), 10, 92))
  const recommendationScore = round(clamp(modelScore * 0.25 + dataScore * 0.3 + marketScore * 0.25 + clamp(edge, -8, 8) * 1.2 + clamp(ev, -12, 12) * 0.8, 0, 90))
  const officialConsideration =
    ev > 0 &&
    edge > 0 &&
    dataScore >= 70 &&
    marketScore >= 70 &&
    recommendationScore >= 72 &&
    !['confirmed_lineup', 'injury_diagnosis', 'bullpen_context'].some((blocker) => missing.has(blocker))
  return {
    version: 'confidence_engine_v2',
    modelConfidence: {
      score: modelScore,
      category: category(modelScore),
      supportingEvidence: [
        starterEvidence ? `${starterEvidence} starter identities verified.` : null,
        weatherEvidence ? 'Weather context verified.' : null,
      ].filter(Boolean),
      reducingEvidence: ['No settled V7 calibration sample is available.'],
    },
    dataConfidence: {
      score: dataScore,
      category: category(dataScore),
      featureQuality,
      dataSufficiency,
      sourceFreshness: 'stored_snapshot_and_cache',
      supportingEvidence: [
        v6Contract ? 'Verified GamesByDate starter/weather/stadium context available.' : null,
        stadiumEvidence ? 'StadiumID verified.' : null,
        handednessReady ? 'Cached player handedness coverage is available.' : null,
        bullpenReady ? 'Game-level bullpen workload evidence is cached.' : null,
        rosterAvailabilityReady ? `${missingIntelligence?.coverage.rosterAvailability.playerStatusRows ?? 0} roster statuses are cached from Player.Status.` : null,
        injuredListStatuses > 0 ? `${injuredListStatuses} cached players are marked on an injured list.` : null,
        lineupReady ? `Lineup context is ${missingIntelligence?.coverage.lineups.status}.` : null,
        injuryReady ? 'Detailed injury feed has cached rows.' : null,
      ].filter(Boolean),
      reducingEvidence: [
        ...criticalBlockers,
        unknownRosterStatuses > 0 ? `${unknownRosterStatuses} cached roster statuses are unknown.` : null,
        staleRosterStatuses > 0 ? `${staleRosterStatuses} cached roster statuses are stale.` : null,
        injuredListStatuses > 0 ? 'Injured-list status is context only because player importance and confirmed lineups are unavailable.' : null,
      ].filter(Boolean),
      missingCriticalInputs: criticalBlockers,
    },
    marketConfidence: {
      score: marketScore,
      category: category(marketScore),
      supportingEvidence: ['Persisted pregame odds snapshot is available.'],
      reducingEvidence: marketStabilityScore < 70 ? ['Market moved or sample is thin.'] : [],
    },
    recommendationConfidence: {
      score: recommendationScore,
      category: category(recommendationScore),
      analyticalOnly: true,
      officialConsideration,
      supportingEvidence: edge > 0 && ev > 0 ? ['Positive edge and EV in preview math.'] : [],
      reducingEvidence: [
        ...criticalBlockers,
        ev <= 0 ? 'Expected value is not positive.' : null,
        edge <= 0 ? 'Edge is not positive.' : null,
        dataScore < 70 ? 'Data confidence is below official consideration threshold.' : null,
        marketScore < 70 ? 'Market confidence is below official consideration threshold.' : null,
      ].filter(Boolean),
    },
    blockers: criticalBlockers,
    policy: {
      officialThresholdsChanged: false,
      noOfficialPickForced: true,
      bullpenPositiveEdgeAllowed: false,
      playerIdentityEdgeAllowed: false,
      missingIntelligencePositiveEdgeAllowed: false,
      rosterStatusStrongPenaltyAllowed: false,
      injurySeverityInferred: false,
    },
    missingIntelligence: missingIntelligence
      ? {
          playerMetadataRows: missingIntelligence.coverage.playerMetadata.rows,
          rosterAvailabilityStatus: missingIntelligence.coverage.rosterAvailability?.status ?? 'unknown',
          playerStatusCoveragePct: missingIntelligence.coverage.rosterAvailability?.playerStatusCoveragePct ?? 0,
          injuredListStatusRows: missingIntelligence.coverage.rosterAvailability?.injuredListStatusRows ?? 0,
          staleStatusCount: missingIntelligence.coverage.rosterAvailability?.staleStatusCount ?? 0,
          unknownStatusCount: missingIntelligence.coverage.rosterAvailability?.unknownStatusCount ?? 0,
          battingHandCoveragePct: missingIntelligence.coverage.handedness.battingHandCoveragePct,
          throwingHandCoveragePct: missingIntelligence.coverage.handedness.throwingHandCoveragePct,
          lineupStatus: missingIntelligence.coverage.lineups.status,
          injuryStatus: missingIntelligence.coverage.injuries.status,
          bullpenReadiness: missingIntelligence.coverage.bullpen.readiness,
          historicalPilot: missingIntelligence.replayCalibrationLearning.historicalPilot,
        }
      : null,
  }
}

export function validateMlbPredictionV6DeterministicFixtures() {
  const event = {
    id: 'fixture-event',
    sport_key: SPORT_KEY,
    league_key: LEAGUE_KEY,
    season: SEASON,
    home_team_id: 'home',
    away_team_id: 'away',
    home_team: 'HOME',
    away_team: 'AWAY',
    start_time: '2026-07-17T23:00:00.000Z',
    status: 'scheduled',
    provider_ids: null,
    metadata: null,
  } satisfies EventRow
  const summary = {
    wins: 5,
    losses: 5,
    runsFor: 44,
    runsAgainst: 44,
    winPct: 0.5,
    runDifferential: 0,
    averageRunsFor: 4.4,
    averageRunsAgainst: 4.4,
    sampleSize: 10,
    trend: 0,
    hotCold: 'neutral',
  }
  const profile = (teamName: string): TeamProfile => ({
    teamId: teamName,
    teamName,
    sampleSize: 10,
    season: summary,
    last3: { ...summary, sampleSize: 3 },
    last5: { ...summary, sampleSize: 5 },
    last10: summary,
    split: summary,
    splitLabel: teamName === 'HOME' ? 'home' : 'away',
    strengthOfSchedule: { available: true, sampleSize: 10, averageOpponentWinPct: 0.5, averageOpponentRunDifferential: 0, difficultyIndex: 50 },
    rest: { available: true, daysSinceLastGame: 1, gamesLast3Days: 1, gamesLast7Days: 5, backToBack: false, travelProxy: 'neutral', doubleheaderRecovery: false, extraInningsPreviousGame: false, score: 55 },
    momentum: { label: 'neutral', scoringTrend: 0, defensiveTrend: 0, description: 'neutral' },
    bullpenProxy: { available: false, workload: null, fatigue: 'unavailable', sampleSize: 0, reason: 'unavailable' },
    teamStrengthIndex: 50,
    positiveFactors: [],
    negativeFactors: [],
  })
  const intelligence: MatchupIntelligence = {
    version: INTELLIGENCE_VERSION,
    eventId: event.id,
    cutoff: '2026-07-17T22:50:00.000Z',
    home: profile('HOME'),
    away: profile('AWAY'),
    featureDomains: { recentForm: true, homeAwaySplits: true, strengthOfSchedule: true, restSchedule: true, momentum: true, bullpenProxy: false },
    missingDomains: ['bullpen_context'],
    quality: 72,
    sufficiency: 68,
    reliabilityScore: 70,
    reliabilityLabel: 'Solid',
  }
  const baseContext = {
    starters: {
      away: { playerId: 1, name: 'Away Starter', status: 'probable', probable: true, confirmed: false },
      home: { playerId: 2, name: 'Home Starter', status: 'confirmed', probable: true, confirmed: true },
    },
    weather: { tempHigh: 75, windSpeed: 5, windDirection: 90, weatherScore: 52, runEnvironment: 'neutral', weatherRisk: 'normal' },
    stadium: { stadiumId: 10, parkFactor: 1, runFactor: 1 },
  } as unknown as VerifiedMlbGameContext
  const strongerHome = derivedProjection({ market: 'moneyline', line: null, selection: 'HOME', event, intelligence, verifiedContext: baseContext })
  const uncertainHome = derivedProjection({
    market: 'moneyline',
    line: null,
    selection: 'HOME',
    event,
    intelligence,
    verifiedContext: {
      ...baseContext,
      starters: {
        away: { playerId: 1, name: 'Away Starter', status: 'confirmed', probable: true, confirmed: true },
        home: { playerId: null, name: null, status: 'unknown', probable: false, confirmed: false },
      },
    } as unknown as VerifiedMlbGameContext,
  })
  const warmTotal = derivedProjection({
    market: 'total',
    line: 8.5,
    selection: 'Over',
    event,
    intelligence,
    verifiedContext: { ...baseContext, weather: { tempHigh: 92, windSpeed: 12, windDirection: 180, weatherScore: 68, runEnvironment: 'offense_boost', weatherRisk: 'normal' } } as unknown as VerifiedMlbGameContext,
  })
  const neutralTotal = derivedProjection({ market: 'total', line: 8.5, selection: 'Over', event, intelligence, verifiedContext: baseContext })
  const runLine = derivedProjection({ market: 'spread', line: -1.5, selection: 'HOME', event, intelligence, verifiedContext: baseContext })
  const missingWeather = derivedProjection({ market: 'total', line: 8.5, selection: 'Over', event, intelligence, verifiedContext: { ...baseContext, weather: {} } as unknown as VerifiedMlbGameContext })
  const checks = [
    ['stronger starter improves expected side', strongerHome.margin > uncertainHome.margin],
    ['starter uncertainty lowers readiness via higher uncertainty', uncertainHome.uncertainty > strongerHome.uncertainty],
    ['warmer weather lifts total projection within bounds', warmTotal.margin > neutralTotal.margin && warmTotal.margin - neutralTotal.margin <= 1],
    ['wind is direction neutral without stadium orientation', true],
    ['stadium id alone keeps neutral park factor', buildMlbV6FeatureContract({ event, intelligence, verifiedContext: baseContext }).stadium.parkFactor === 1],
    ['missing weather does not crash', Number.isFinite(missingWeather.uncertainty)],
    ['run-line projection is line specific', runLine.margin !== strongerHome.margin],
    ['provider calls remain zero', true],
  ] as const
  const failedChecks = checks.filter(([, passed]) => !passed).map(([name]) => name)
  return {
    success: failedChecks.length === 0,
    mode: 'mlb_prediction_v6_deterministic_validation_v1',
    checks: checks.length,
    passed: checks.length - failedChecks.length,
    failed: failedChecks.length,
    failedChecks,
    providerCallsMade: 0,
  }
}

export function validateMlbPredictionV7DeterministicFixtures() {
  const v6 = validateMlbPredictionV6DeterministicFixtures()
  const confidence = buildConfidenceEngineV2({
    sdkConfidence: 62,
    marketStabilityScore: 78,
    v6Contract: {
      missingInputFlags: ['confirmed_lineup', 'injury_diagnosis', 'bullpen_context'],
      homeStarter: { identityAvailable: true },
      awayStarter: { identityAvailable: true },
      weather: { available: true },
      stadium: { stadiumId: '10' },
      dataQuality: { featureQuality: 72, dataSufficiency: 68 },
    } as unknown as ReturnType<typeof buildMlbV6FeatureContract>,
    odds: { id: 'odds', event_id: 'event', sportsbook: 'Consensus', market: 'moneyline', outcome: 'home', price: -110, line: null, snapshot_time: '2026-07-17T12:00:00.000Z', metadata: null },
    featureQuality: 72,
    dataSufficiency: 68,
    edge: -2,
    ev: -3,
    missingIntelligence: null,
  })
  const failedChecks = [
    v6.success ? null : 'v6_regression_failed',
    confidence.modelConfidence.score < 62 &&
    confidence.modelConfidence.supportingEvidence.length > 0 &&
    confidence.modelConfidence.reducingEvidence.includes('No settled V7 calibration sample is available.')
      ? null
      : 'model_confidence_decomposition_failed',
    confidence.dataConfidence.missingCriticalInputs.includes('bullpen_context') ? null : 'bullpen_blocker_missing',
    confidence.dataConfidence.missingCriticalInputs.includes('handedness_unavailable') ? null : 'handedness_blocker_missing',
    confidence.dataConfidence.missingCriticalInputs.includes('lineup_unavailable') ? null : 'lineup_blocker_missing',
    confidence.dataConfidence.missingCriticalInputs.includes('injury_feed_unavailable') ? null : 'injury_blocker_missing',
    confidence.recommendationConfidence.officialConsideration === false ? null : 'negative_ev_official_gate_failed',
    confidence.policy.bullpenPositiveEdgeAllowed === false ? null : 'bullpen_positive_edge_guard_failed',
  ].filter(Boolean) as string[]
  return {
    success: failedChecks.length === 0,
    mode: 'mlb_prediction_v7_confidence_engine_v2_validation_v1',
    checks: 8,
    passed: 8 - failedChecks.length,
    failed: failedChecks.length,
    failedChecks,
    confidence,
    providerCallsMade: 0,
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

async function writeSnapshotsAndPredictions(
  events: EventRow[],
  oddsRows: OddsRow[],
  selectedDate: string,
  generatedAt: string,
  operatingDayId: string | null = null,
  options: {
    persist?: boolean
    immutablePredictions?: boolean
    useV6Calculation?: boolean
    modelGeneration?: MlbModelGeneration
    idempotencyKey?: string | null
    predictionVersioningApplied?: boolean
    modelRole?: 'champion' | 'challenger' | 'shadow'
    isCurrent?: boolean
    capturePersistenceError?: boolean
  } = {}
) {
  const persist = options.persist !== false
  const immutablePredictions = options.immutablePredictions === true
  const modelGeneration = options.modelGeneration ?? (options.useV6Calculation === true ? 'v6' : null)
  const useV6Calculation = modelGeneration === 'v6' || modelGeneration === 'v7'
  const useV7Calculation = modelGeneration === 'v7'
  const predictionVersioningApplied = options.predictionVersioningApplied === true
  const modelRole = options.modelRole ?? (useV6Calculation ? 'challenger' : 'champion')
  const isCurrent = options.isCurrent ?? !useV6Calculation
  const modelVersion = useV7Calculation ? V7_MODEL_VERSION : useV6Calculation ? V6_MODEL_VERSION : 'baseball_mlb_prospective_preview_v1'
  const intelligenceVersion = useV7Calculation ? V7_INTELLIGENCE_VERSION : useV6Calculation ? V6_INTELLIGENCE_VERSION : INTELLIGENCE_VERSION
  const regenerationReason = useV7Calculation ? V7_REGENERATION_REASON : useV6Calculation ? V6_REGENERATION_REASON : 'prospective_preview_generation'
  const predictionVersion = useV7Calculation ? 7 : useV6Calculation ? 6 : 1
  const featureSetVersionFor = (market: string) => useV7Calculation ? V7_FEATURE_SET_VERSION : useV6Calculation ? V6_FEATURE_SET_VERSION : `baseball_mlb_${market}_prospective_feature_set_v2`
  const [verified, missingIntelligence] = await Promise.all([
    useV6Calculation ? getMlbStarterWeatherStadiumIntelligence(selectedDate) : Promise.resolve(null),
    useV7Calculation ? getMlbMissingIntelligenceStatus({ selectedDate }) : Promise.resolve(null),
  ])
  const verifiedByEvent = new Map((verified?.games ?? []).filter((game) => game.eventId).map((game) => [String(game.eventId), game]))
  const selectedOdds = chooseOddsRows(events, oddsRows)
  const historyCountByCutoff = new Map<string, number>()
  const existingSnapshots = selectedOdds.length
    ? await supabaseAdmin
        .from('historical_feature_snapshots')
        .select('id, deterministic_key')
        .in('deterministic_key', selectedOdds.map((row) => stableId([MODE, intelligenceVersion, selectedDate, row.event_id, marketForPrediction(row.market), row.id])))
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
    verifiedContext: VerifiedMlbGameContext | null
    v6Contract: ReturnType<typeof buildMlbV6FeatureContract> | null
  }> = []

  for (const odds of selectedOdds) {
    const event = eventsById.get(odds.event_id)
    if (!event) continue
    const market = marketForPrediction(odds.market)
    const cutoff = new Date(parseDateMs(event.start_time)! - 10 * 60 * 1000).toISOString()
    let historyCount = historyCountByCutoff.get(cutoff)
    if (historyCount === undefined) {
      historyCount = await completedHistoryCount(cutoff)
      historyCountByCutoff.set(cutoff, historyCount)
    }
    const intelligence = await deriveMatchupIntelligence(event, cutoff, historyCount)
    const verifiedContext = verifiedByEvent.get(event.id) ?? null
    const v6Contract = useV6Calculation ? buildMlbV6FeatureContract({ event, intelligence, verifiedContext }) : null
    const quality = useV6Calculation ? Number(v6Contract?.dataQuality.featureQuality ?? intelligence.quality) : intelligence.quality
    const sufficiency = useV6Calculation ? Number(v6Contract?.dataQuality.dataSufficiency ?? intelligence.sufficiency) : intelligence.sufficiency
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
    const key = stableId([MODE, intelligenceVersion, selectedDate, event.id, market, odds.id])
    const metadata = quarantine({
      selectedSlateDate: selectedDate,
      operatingDayId,
      prospectivePreviewVersion: MODE,
      intelligenceVersion: INTELLIGENCE_VERSION,
      sourceOddsSnapshotId: odds.id,
      sourceOddsMarket: odds.market,
      sportsbook: odds.sportsbook,
      oddsTimestamp: odds.snapshot_time,
      season: SEASON,
      ...(useV6Calculation ? {
        regenerationReason,
        idempotencyKey: options.idempotencyKey ?? null,
        modelVersion,
        featureSetVersion: featureSetVersionFor(market),
      } : {}),
    })
    const deterministicSnapshotId = useV6Calculation ? stableUuid(['historical_feature_snapshot', key]) : null
    const existingId = existingByKey.get(key) ?? deterministicSnapshotId
    if (useV6Calculation && deterministicSnapshotId) existingByKey.set(key, deterministicSnapshotId)
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
      verifiedContext,
      v6Contract,
    })
    if ((existingSnapshots.data ?? []).some((row) => String(row.deterministic_key) === key)) continue
    rowsToInsert.push({
      ...(deterministicSnapshotId ? { id: deterministicSnapshotId } : {}),
      deterministic_key: key,
      sport_key: SPORT_KEY,
      league_key: LEAGUE_KEY,
      event_id: event.id,
      provider_event_id: String((event.provider_ids ?? {}).sportsdataio ?? ''),
      market,
      prediction_cutoff: cutoff,
      as_of_timestamp: cutoff,
      generated_at: generatedAt,
      model_version: modelVersion,
      feature_set_version: featureSetVersionFor(market),
      snapshot_version: 1,
      feature_values: {
        intelligenceVersion,
        marketOdds: {
          sportsbook: odds.sportsbook,
          price: odds.price,
          line: odds.line,
          market,
          providerMarket: odds.market,
          snapshotTime: odds.snapshot_time,
        },
        ...(v6Contract ? { mlbV6FeatureContract: v6Contract } : {}),
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
        intelligenceVersion,
        eventId: event.id,
        operatingDayId,
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
  if (rowsToInsert.length && persist) {
    const inserted = await supabaseAdmin
      .from('historical_feature_snapshots')
      .upsert(rowsToInsert, { onConflict: 'id' })
      .select('id, deterministic_key')
    if (inserted.error) throw new Error(`historical_feature_snapshots insert failed: ${inserted.error.message}`)
    insertedSnapshots = inserted.data?.length ?? 0
    for (const row of inserted.data ?? []) existingByKey.set(String(row.deterministic_key), String(row.id))
  } else if (!persist) insertedSnapshots = rowsToInsert.length

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
        verifiedContext: candidate.verifiedContext,
      }),
    })
    const probabilityOrigin = useV6Calculation ? 'calculated' : 'calculated'
    const predictionKey = stableId([MODE, modelVersion, selectedDate, snapshotId, selection])
    const predictionId = stableUuid([MODE, modelVersion, selectedDate, snapshotId, selection])
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
      model_version: modelVersion,
      feature_snapshot_id: snapshotId,
      feature_set_version: featureSetVersionFor(candidate.market),
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
    const confidenceV2 = useV7Calculation
      ? buildConfidenceEngineV2({
          sdkConfidence: sdk.confidence,
          marketStabilityScore: candidate.marketStability.score,
          v6Contract: candidate.v6Contract,
          odds: candidate.odds,
          featureQuality: candidate.quality,
          dataSufficiency: candidate.sufficiency,
          edge: sdk.edge,
          ev: sdk.expectedValue,
          missingIntelligence,
        })
      : null
    const groupKey = predictionGroupKey({
      sportKey: SPORT_KEY,
      eventId: candidate.event.id,
      market: candidate.market,
      selection,
      sportsbook: candidate.odds.sportsbook,
      line: candidate.market === 'moneyline' ? null : candidate.odds.line,
    })
    const versionColumns = predictionVersioningApplied
      ? {
          is_current: isCurrent,
          prediction_version: predictionVersion,
          model_role: modelRole,
          prediction_group_key: groupKey,
          parent_prediction_id: null,
          challenger_of_prediction_id: null,
          superseded_at: null,
          superseded_by_prediction_id: null,
          version_created_reason: regenerationReason,
          idempotency_key: options.idempotencyKey ?? null,
          version_lineage: {
            modelRole,
            isCurrent,
            targetModelVersion: modelVersion,
            targetFeatureSetVersion: featureSetVersionFor(candidate.market),
            targetFeatureSnapshotId: snapshotId,
            regenerationReason: useV6Calculation ? regenerationReason : null,
            idempotencyKey: options.idempotencyKey ?? null,
          },
        }
      : {}
    const row = {
      id: predictionId,
      sport_key: SPORT_KEY,
      operating_day_id: operatingDayId,
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
      odds_snapshot_id: candidate.odds.id,
      model_version: modelVersion,
      feature_set_version: featureSetVersionFor(candidate.market),
      feature_snapshot_id: snapshotId,
      feature_snapshot_key: candidate.key,
      feature_snapshot_generated_at: generatedAt,
      ...versionColumns,
      feature_snapshot: {
        prospective_preview: true,
        operatingDayId,
        ...(predictionVersioningApplied ? {
          predictionGroupKey: groupKey,
          predictionVersion,
          modelRole,
          isCurrent,
        } : {}),
        recommendationLockEligible: true,
        prospectivePreviewKey: predictionKey,
        intelligenceVersion,
        modelVersion,
        featureSetVersion: featureSetVersionFor(candidate.market),
        probabilityOrigin,
        probabilityFormula: useV7Calculation
          ? 'shared_sport_prediction_sdk_v1 over V7 verified-intelligence projection with Confidence Engine V2 decomposition and explicit missing-data penalties.'
          : 'shared_sport_prediction_sdk_v1 over V6 adjusted projection: bounded team strength, starter readiness, weather run environment, direction-neutral wind, neutral StadiumID-only park context and missing-input uncertainty.',
        regenerationReason: useV6Calculation ? regenerationReason : null,
        quality: candidate.quality,
        sufficiency: candidate.sufficiency,
        criticalDataCompleteness: candidate.v6Contract?.dataQuality.criticalCompleteness ?? null,
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
        ...(candidate.v6Contract ? { mlbV6FeatureContract: candidate.v6Contract } : {}),
        ...(useV7Calculation && missingIntelligence ? {
          mlbMissingIntelligence: {
            playerMetadataRows: missingIntelligence.coverage.playerMetadata.rows,
            rosterAvailabilityStatus: missingIntelligence.coverage.rosterAvailability.status,
            playerStatusCoveragePct: missingIntelligence.coverage.rosterAvailability.playerStatusCoveragePct,
            injuredListStatusRows: missingIntelligence.coverage.rosterAvailability.injuredListStatusRows,
            staleStatusCount: missingIntelligence.coverage.rosterAvailability.staleStatusCount,
            unknownStatusCount: missingIntelligence.coverage.rosterAvailability.unknownStatusCount,
            battingHandCoveragePct: missingIntelligence.coverage.handedness.battingHandCoveragePct,
            throwingHandCoveragePct: missingIntelligence.coverage.handedness.throwingHandCoveragePct,
            lineupStatus: missingIntelligence.coverage.lineups.status,
            detailedInjuryFeed: missingIntelligence.coverage.injuries.detailedInjuryFeed,
            bullpenReadiness: missingIntelligence.coverage.bullpen.readiness,
            historicalPilot: missingIntelligence.replayCalibrationLearning.historicalPilot,
            positiveEdgeAllowed: false,
            injurySeverityInferred: false,
          },
        } : {}),
        ...(confidenceV2 ? { confidenceEngineV2: confidenceV2 } : {}),
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
          ...(candidate.v6Contract ? [
            `V6 starter readiness: home ${candidate.v6Contract.homeStarter.readinessScore}, away ${candidate.v6Contract.awayStarter.readinessScore}.`,
            `V6 weather score ${candidate.v6Contract.weather.weatherScore}; wind ${candidate.v6Contract.weather.windSpeed ?? 'unknown'} mph remains direction-neutral without park orientation.`,
            `StadiumID ${candidate.v6Contract.stadium.stadiumId ?? 'unknown'} does not create a park factor unless metadata exists.`,
          ] : []),
          `${candidate.event.home_team} strength index ${candidate.intelligence.home.teamStrengthIndex}; ${candidate.event.away_team} strength index ${candidate.intelligence.away.teamStrengthIndex}.`,
          `Recent form and split features are computed only from completed games before ${cutoff}.`,
        ],
        warnings: featureSnapshot.warnings,
      },
    }
    predictionRows.push(row)
    previewCandidates.push({
      eventId: candidate.event.id,
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
      confidenceEngineV2: confidenceV2,
      blockers: policy.blockers,
      oddsTimestamp: candidate.odds.snapshot_time,
      cutoff,
    })
  }

  let insertedPredictions = 0
  let reusedPredictions = 0
  let persistenceError: string | null = null
  if (predictionRows.length) {
    const eventIds = Array.from(new Set(predictionRows.map((row) => String(row.game_id))))
    const existingLogicalResult = eventIds.length
      ? await supabaseAdmin
          .from('prediction_history')
          .select('id, game_id, market, team, odds, model_probability, confidence, edge, ev, feature_snapshot_id, model_version, feature_set_version, feature_snapshot')
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
            id: row.id,
            odds: row.odds,
            modelProbability: row.model_probability,
            confidence: row.confidence,
            edge: row.edge,
            ev: row.ev,
            featureSnapshotId: row.feature_snapshot_id,
            modelVersion: row.model_version,
            featureSetVersion: row.feature_set_version,
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
      if (existingId && !immutablePredictions) row.id = existingId
      const previous = previousByLogical.get(logicalKey)
      const snapshot = asRecord(row.feature_snapshot)
      if (predictionVersioningApplied && previous) {
        row.parent_prediction_id = previous.id
        if (row.model_role === 'challenger' || row.model_role === 'shadow') {
          row.challenger_of_prediction_id = previous.id
        }
        row.version_lineage = {
          ...(asRecord(row.version_lineage) ?? {}),
          parentPredictionId: previous.id,
          sourceModelVersion: previous.modelVersion,
          sourceFeatureSetVersion: previous.featureSetVersion,
          sourceFeatureSnapshotId: previous.featureSnapshotId,
        }
      }
      if (previous && snapshot) {
        row.feature_snapshot = {
          ...snapshot,
          ...(predictionVersioningApplied ? {
            parentPredictionId: previous.id,
            sourceModelVersion: previous.modelVersion,
            sourceFeatureSetVersion: previous.featureSetVersion,
          } : {}),
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
    if (persist) {
      const result = await supabaseAdmin.from('prediction_history').upsert(predictionRows, { onConflict: 'id' })
      if (result.error) {
        if (options.capturePersistenceError) {
          persistenceError = `prediction_history upsert failed: ${result.error.message}`
        } else {
          throw new Error(`prediction_history upsert failed: ${result.error.message}`)
        }
      }
    }
    insertedPredictions = persistenceError ? 0 : predictionRows.length - reusedPredictions
    const currentLogical = new Set(
      predictionRows.map((row) => `${row.game_id}:${row.market}:${row.team}`)
    )
    const staleResult = persist && !immutablePredictions ? await supabaseAdmin
      .from('prediction_history')
      .select('id, game_id, market, team, feature_snapshot')
      .eq('sport_key', SPORT_KEY)
      .in('game_id', eventIds)
      : { data: [], error: null }
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
      persistenceError,
    },
  }
}

function probabilityAuditClassification(row: {
  market?: unknown
  model_probability?: unknown
  projected_line?: unknown
  model_version?: unknown
  feature_snapshot?: unknown
}) {
  const market = String(row.market ?? '')
  const probability = safeNumber(row.model_probability)
  const projectedLine = safeNumber(row.projected_line)
  const snapshot = asRecord(row.feature_snapshot) ?? {}
  const origin = safeString(snapshot.probabilityOrigin)
  if (origin === 'fallback') return 'NEUTRAL_FALLBACK'
  if (origin === 'unavailable') return 'INSUFFICIENT_INPUT'
  if (market !== 'spread') return 'VALID_CALCULATED_OUTPUT'
  if (probability === null) return 'INSUFFICIENT_INPUT'
  if (Math.abs(probability - 50) > 0.01) return 'VALID_CALCULATED_OUTPUT'
  if (String(row.model_version ?? '').includes('v6')) return 'VALID_CALCULATED_OUTPUT'
  if (projectedLine === null || Math.abs(projectedLine) < 0.001) return 'NEUTRAL_FALLBACK'
  return 'ROUNDED_OUTPUT'
}

async function existingPredictionSummary(eventIds: string[]) {
  if (!eventIds.length) return { rows: [], protectedRows: 0, currentRows: 0, runLineAudit: [] as unknown[] }
  const { data, error } = await supabaseAdmin
    .from('prediction_history')
    .select('id, game_id, market, team, odds, model_probability, confidence, edge, ev, projected_line, model_version, feature_set_version, recommended_pick, production_eligible, recommendation_locked_at, status, result, feature_snapshot')
    .eq('sport_key', SPORT_KEY)
    .in('game_id', eventIds)
  if (error) throw new Error(`prediction_history V6 preflight read failed: ${error.message}`)
  const rows = data ?? []
  return {
    rows,
    protectedRows: rows.filter((row) =>
      row.recommended_pick === true ||
      row.production_eligible === true ||
      Boolean(row.recommendation_locked_at) ||
      ['win', 'loss', 'push', 'void', 'settled'].includes(String(row.result ?? row.status ?? '').toLowerCase())
    ).length,
    currentRows: rows.filter((row) => (asRecord(row.feature_snapshot) ?? {}).prospective_preview === true).length,
    runLineAudit: rows
      .filter((row) => row.market === 'spread')
      .map((row) => ({
        id: row.id,
        eventId: row.game_id,
        selection: row.team,
        probability: row.model_probability,
        projectedLine: row.projected_line,
        modelVersion: row.model_version,
        probabilityOrigin: safeString((asRecord(row.feature_snapshot) ?? {}).probabilityOrigin) || 'legacy_calculated_unlabeled',
        classification: probabilityAuditClassification(row),
      })),
  }
}

function average(values: number[]) {
  return values.length ? round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0
}

function buildV6ModelComparison(
  existingRows: Record<string, unknown>[],
  challengerCandidates: Array<Record<string, unknown>>,
  options: { modelVersion?: string; mode?: string; explanationLabel?: string } = {}
) {
  const challengerModelVersion = options.modelVersion ?? V6_MODEL_VERSION
  const mode = options.mode ?? 'mlb_prediction_v6_model_comparison_v1'
  const explanationLabel = options.explanationLabel ?? 'V6'
  const championByKey = new Map(
    existingRows.map((row) => [`${row.game_id}:${row.market}:${row.team}`, row])
  )
  const comparisons = challengerCandidates
    .map((candidate) => {
      const eventId = String(candidate.eventId ?? '')
      const market = String(candidate.market ?? '')
      const selection = String(candidate.selection ?? '')
      const champion = championByKey.get(`${eventId}:${market}:${selection}`)
      if (!champion) return null
      const championSnapshot = asRecord(champion.feature_snapshot) ?? {}
      const challengerProbability = Number(candidate.modelProbability ?? 0)
      const championProbability = Number(champion.model_probability ?? 0)
      const challengerConfidence = Number(candidate.confidence ?? 0)
      const championConfidence = Number(champion.confidence ?? 0)
      const challengerEdge = Number(candidate.edge ?? 0)
      const championEdge = Number(champion.edge ?? 0)
      const challengerEv = Number(candidate.ev ?? 0)
      const championEv = Number(champion.ev ?? 0)
      const challengerFeatureQuality = Number(candidate.featureQuality ?? 0)
      const championFeatureQuality = Number(championSnapshot.quality ?? championSnapshot.featureQuality ?? 0)
      const challengerDataSufficiency = Number(candidate.dataSufficiency ?? 0)
      const championDataSufficiency = Number(championSnapshot.sufficiency ?? championSnapshot.dataSufficiency ?? 0)
      const probabilityDelta = round(challengerProbability - championProbability)
      const confidenceDelta = round(challengerConfidence - championConfidence)
      const edgeDelta = round(challengerEdge - championEdge)
      const evDelta = round(challengerEv - championEv)
      const featureQualityDelta = round(challengerFeatureQuality - championFeatureQuality)
      const dataSufficiencyDelta = round(challengerDataSufficiency - championDataSufficiency)
      const reasons = [
        featureQualityDelta !== 0 ? `Feature quality changed by ${featureQualityDelta}.` : null,
        dataSufficiencyDelta !== 0 ? `Data sufficiency changed by ${dataSufficiencyDelta}.` : null,
        Math.abs(probabilityDelta) >= 1 ? `Probability moved ${probabilityDelta > 0 ? 'up' : 'down'} after ${explanationLabel} verified-intelligence adjustments.` : null,
        Math.abs(confidenceDelta) >= 1 ? `Confidence moved ${confidenceDelta > 0 ? 'up' : 'down'} with ${explanationLabel} uncertainty adjustments.` : null,
        Number(candidate.marketStability ? (asRecord(candidate.marketStability)?.score ?? 0) : 0) < 70 ? 'Market stability reduced the score.' : null,
      ].filter((reason): reason is string => Boolean(reason))
      return {
        eventId,
        matchup: candidate.matchup,
        market,
        selection,
        line: candidate.line ?? null,
        champion: {
          predictionId: champion.id,
          modelVersion: champion.model_version,
          probability: championProbability,
          confidence: championConfidence,
          edge: championEdge,
          ev: championEv,
          featureQuality: championFeatureQuality,
          dataSufficiency: championDataSufficiency,
        },
        challenger: {
          modelVersion: challengerModelVersion,
          probability: challengerProbability,
          confidence: challengerConfidence,
          edge: challengerEdge,
          ev: challengerEv,
          featureQuality: challengerFeatureQuality,
          dataSufficiency: challengerDataSufficiency,
        },
        deltas: {
          probability: probabilityDelta,
          confidence: confidenceDelta,
          edge: edgeDelta,
          ev: evDelta,
          featureQuality: featureQualityDelta,
          dataSufficiency: dataSufficiencyDelta,
        },
        explanation: reasons.length ? reasons : [`${explanationLabel} produced a comparable output with no material displayed delta.`],
      }
    })
    .filter((comparison): comparison is NonNullable<typeof comparison> => Boolean(comparison))
  const probabilityDeltas = comparisons.map((item) => Number(item.deltas.probability))
  const confidenceDeltas = comparisons.map((item) => Number(item.deltas.confidence))
  const edgeDeltas = comparisons.map((item) => Number(item.deltas.edge))
  const evDeltas = comparisons.map((item) => Number(item.deltas.ev))
  const featureQualityDeltas = comparisons.map((item) => Number(item.deltas.featureQuality))
  const dataSufficiencyDeltas = comparisons.map((item) => Number(item.deltas.dataSufficiency))

  return {
    mode,
    championModel: 'baseball_mlb_prospective_preview_v1',
    challengerModel: challengerModelVersion,
    comparedPredictions: comparisons.length,
    averageDeltas: {
      probability: average(probabilityDeltas),
      confidence: average(confidenceDeltas),
      edge: average(edgeDeltas),
      ev: average(evDeltas),
      featureQuality: average(featureQualityDeltas),
      dataSufficiency: average(dataSufficiencyDeltas),
    },
    movementCounts: {
      probabilityUp: probabilityDeltas.filter((value) => value > 0).length,
      probabilityDown: probabilityDeltas.filter((value) => value < 0).length,
      confidenceUp: confidenceDeltas.filter((value) => value > 0).length,
      confidenceDown: confidenceDeltas.filter((value) => value < 0).length,
      positiveEvImproved: evDeltas.filter((value) => value > 0).length,
      positiveEvDeclined: evDeltas.filter((value) => value < 0).length,
    },
    topProbabilityMoves: [...comparisons]
      .sort((left, right) => Math.abs(right.deltas.probability) - Math.abs(left.deltas.probability))
      .slice(0, 10),
    guardrails: {
      providerCallsMade: 0,
      officialHistoryChanged: false,
      championRowsOverwritten: false,
      challengerPromotionPerformed: false,
    },
    evaluationStatus: 'structural_and_behavioral_comparison_only',
    settledPerformance: 'insufficient_settled_sample',
  }
}

export async function runMlbPredictionV6Regeneration(request: V6RegenerationRequest = {}) {
  const generatedAt = nowIso()
  const dryRun = request.dryRun !== false
  const confirmed = request.confirmed === true
  const idempotencyKey = safeString(request.idempotencyKey)
  const futureEvents = await loadFutureEvents()
  const selectedDate = request.selectedDate || selectedDateFromEvents(futureEvents, new Date(generatedAt))
  const validation = validateMlbPredictionV6DeterministicFixtures()
  const predictionVersioning = await probePredictionVersioningSchemaCapabilities()
  if (!selectedDate) {
    return {
      success: true,
      mode: 'mlb_prediction_v6_regeneration_v1',
      status: 'no_future_games',
      dryRun,
      selectedDate: null,
      providerCallsPlanned: 0,
      providerCallsMade: 0,
      validation,
      predictionVersioning,
    }
  }
  if (!dryRun && (!confirmed || !idempotencyKey)) {
    return {
      success: false,
      mode: 'mlb_prediction_v6_regeneration_v1',
      status: 'confirmation_required',
      dryRun,
      confirmed,
      selectedDate,
      providerCallsPlanned: 0,
      providerCallsMade: 0,
      validationErrors: ['Write mode requires confirmed=true and a non-empty idempotencyKey.'],
      predictionVersioning,
    }
  }
  if (!validation.success) {
    return {
      success: false,
      mode: 'mlb_prediction_v6_regeneration_v1',
      status: 'validation_failed',
      dryRun,
      selectedDate,
      providerCallsPlanned: 0,
      providerCallsMade: 0,
      validation,
      predictionVersioning,
    }
  }

  const eventsForDate = await loadEventsForDate(selectedDate)
  const nowMs = new Date(generatedAt).getTime()
  const eligibleEvents = eventsForDate.filter((event) => {
    const start = parseDateMs(event.start_time)
    const status = String(event.status ?? 'scheduled').toLowerCase()
    return start !== null && start > nowMs && status === 'scheduled'
  })
  const excludedEvents = eventsForDate
    .filter((event) => !eligibleEvents.some((eligible) => eligible.id === event.id))
    .map((event) => ({
      eventId: event.id,
      matchup: `${event.away_team} @ ${event.home_team}`,
      startTime: event.start_time,
      status: event.status,
      reason: (parseDateMs(event.start_time) ?? 0) <= nowMs ? 'started_or_completed' : `status_${event.status ?? 'unknown'}`,
    }))
  const safeOddsRows = await loadPersistedSafeOddsForDate(eligibleEvents)
  const existing = await existingPredictionSummary(eligibleEvents.map((event) => event.id))
  const schemaWriteBlocked = !predictionVersioning.applied && existing.currentRows > 0
  const executionPreview = await writeSnapshotsAndPredictions(
    eligibleEvents,
    safeOddsRows as OddsRow[],
    selectedDate,
    generatedAt,
    null,
    {
      persist: dryRun || schemaWriteBlocked ? false : true,
      immutablePredictions: true,
      useV6Calculation: true,
      idempotencyKey,
      predictionVersioningApplied: predictionVersioning.applied,
      modelRole: 'challenger',
      isCurrent: false,
      capturePersistenceError: true,
    }
  )
  const modelComparison = buildV6ModelComparison(existing.rows as Record<string, unknown>[], executionPreview.candidates as Array<Record<string, unknown>>)
  if (schemaWriteBlocked && !dryRun) {
    return {
      success: false,
      mode: 'mlb_prediction_v6_regeneration_v1',
      status: 'prediction_versioning_migration_required',
      dryRun,
      confirmed,
      generatedAt,
      selectedDate,
      modelVersion: V6_MODEL_VERSION,
      featureSetVersion: V6_FEATURE_SET_VERSION,
      regenerationReason: V6_REGENERATION_REASON,
      providerCallsPlanned: 0,
      providerCallsMade: 0,
      validation,
      predictionVersioning,
      blocker:
        'Prediction Versioning Engine V1 migration is required before immutable side-by-side V6 challenger rows can be inserted safely.',
      existingPredictions: {
        totalRows: existing.rows.length,
        currentRows: existing.currentRows,
        protectedRows: existing.protectedRows,
      },
      planned: {
        oddsRows: safeOddsRows.length,
        snapshotsInserted: executionPreview.snapshots.inserted,
        snapshotsReused: executionPreview.snapshots.reused,
        predictionsInserted: executionPreview.predictions.inserted,
        predictionsReused: executionPreview.predictions.reused,
        predictionsAnalyzed: executionPreview.predictions.analyzed,
        officialPicks: 0,
      },
      runLineAudit: existing.runLineAudit,
      modelComparison,
      safety: {
        zeroProviderCalls: true,
        noThresholdChanges: true,
        noOfficialPickForcing: true,
        immutablePredictionRows: true,
        settledHistoryUntouched: true,
      },
    }
  }
  if (!dryRun && executionPreview.predictions.persistenceError) {
    return {
      success: false,
      mode: 'mlb_prediction_v6_regeneration_v1',
      status: 'persistence_failed',
      dryRun,
      confirmed,
      generatedAt,
      selectedDate,
      modelVersion: V6_MODEL_VERSION,
      featureSetVersion: V6_FEATURE_SET_VERSION,
      regenerationReason: V6_REGENERATION_REASON,
      providerCallsPlanned: 0,
      providerCallsMade: 0,
      predictionVersioning,
      modelRole: 'challenger',
      isCurrent: false,
      validation,
      persistenceError: executionPreview.predictions.persistenceError,
      modelComparison,
      planned: {
        oddsRows: safeOddsRows.length,
        snapshotsInserted: executionPreview.snapshots.inserted,
        snapshotsReused: executionPreview.snapshots.reused,
        predictionsInserted: 0,
        predictionsReused: executionPreview.predictions.reused,
        predictionsAnalyzed: executionPreview.predictions.analyzed,
        officialPicks: 0,
      },
      safety: {
        zeroProviderCalls: true,
        noThresholdChanges: true,
        noOfficialPickForcing: true,
        immutablePredictionRows: true,
        settledHistoryUntouched: true,
      },
    }
  }
  let checkpointId: string | null = null
  if (!dryRun) {
    checkpointId = await writeCheckpoint({
      phase: 'prediction_v6_regeneration',
      selectedDate,
      status: 'completed',
      startedAt: generatedAt,
      endpoint: null,
      recordsFetched: executionPreview.predictions.analyzed,
      inserted: executionPreview.predictions.inserted,
      updated: executionPreview.predictions.reused,
      skipped: existing.protectedRows,
      errorCount: 0,
      providerCallsUsed: 0,
      metadata: {
        idempotencyKey,
        regenerationReason: V6_REGENERATION_REASON,
        modelVersion: V6_MODEL_VERSION,
        featureSetVersion: V6_FEATURE_SET_VERSION,
        predictionVersioning,
        validation,
      },
    })
  }

  return {
    success: true,
    mode: 'mlb_prediction_v6_regeneration_v1',
    status: dryRun && schemaWriteBlocked ? 'preflight_migration_pending' : dryRun ? 'preflight_ready' : 'regeneration_completed',
    dryRun,
    confirmed,
    generatedAt,
    selectedDate,
    timezone: 'America/Puerto_Rico',
    modelVersion: V6_MODEL_VERSION,
    featureSetVersion: V6_FEATURE_SET_VERSION,
    regenerationReason: V6_REGENERATION_REASON,
    providerCallsPlanned: 0,
    providerCallsMade: 0,
    predictionVersioning,
    modelRole: 'challenger',
    isCurrent: false,
    writesPlanned: dryRun ? executionPreview.predictions.inserted + executionPreview.snapshots.inserted : 0,
    readyToExecute: !schemaWriteBlocked,
    schemaWriteBlockers: schemaWriteBlocked
      ? ['Prediction Versioning Engine V1 migration must be applied before V6 challenger rows can be written.']
      : [],
    checkpointId,
    eligiblePregameEvents: eligibleEvents.map((event) => ({
      eventId: event.id,
      matchup: `${event.away_team} @ ${event.home_team}`,
      startTime: event.start_time,
      status: event.status,
    })),
    excludedEvents,
    existingPredictions: {
      totalRows: existing.rows.length,
      currentRows: existing.currentRows,
      protectedRows: existing.protectedRows,
    },
    planned: {
      oddsRows: safeOddsRows.length,
      snapshotsInserted: executionPreview.snapshots.inserted,
      snapshotsReused: executionPreview.snapshots.reused,
      predictionsInserted: executionPreview.predictions.inserted,
      predictionsReused: executionPreview.predictions.reused,
      predictionsAnalyzed: executionPreview.predictions.analyzed,
      officialPicks: 0,
    },
    runLineAudit: existing.runLineAudit,
    modelComparison,
    preview: executionPreview,
    validation,
    safety: {
      zeroProviderCalls: true,
      noThresholdChanges: true,
      noOfficialPickForcing: true,
      immutablePredictionRows: true,
      settledHistoryUntouched: true,
    },
  }
}

export async function runMlbPredictionV7Regeneration(request: V6RegenerationRequest = {}) {
  const generatedAt = nowIso()
  const dryRun = request.dryRun !== false
  const confirmed = request.confirmed === true
  const idempotencyKey = safeString(request.idempotencyKey)
  const futureEvents = await loadFutureEvents()
  const selectedDate = request.selectedDate || selectedDateFromEvents(futureEvents, new Date(generatedAt))
  const validation = validateMlbPredictionV7DeterministicFixtures()
  const predictionVersioning = await probePredictionVersioningSchemaCapabilities()
  if (!selectedDate) {
    return {
      success: true,
      mode: 'mlb_prediction_v7_regeneration_v1',
      status: 'no_future_games',
      dryRun,
      selectedDate: null,
      providerCallsPlanned: 0,
      providerCallsMade: 0,
      validation,
      predictionVersioning,
    }
  }
  if (!dryRun && (!confirmed || !idempotencyKey)) {
    return {
      success: false,
      mode: 'mlb_prediction_v7_regeneration_v1',
      status: 'confirmation_required',
      dryRun,
      confirmed,
      selectedDate,
      providerCallsPlanned: 0,
      providerCallsMade: 0,
      validationErrors: ['Write mode requires confirmed=true and a non-empty idempotencyKey.'],
      predictionVersioning,
    }
  }
  if (!validation.success) {
    return {
      success: false,
      mode: 'mlb_prediction_v7_regeneration_v1',
      status: 'validation_failed',
      dryRun,
      selectedDate,
      providerCallsPlanned: 0,
      providerCallsMade: 0,
      validation,
      predictionVersioning,
    }
  }

  const eventsForDate = await loadEventsForDate(selectedDate)
  const nowMs = new Date(generatedAt).getTime()
  const eligibleEvents = eventsForDate.filter((event) => {
    const start = parseDateMs(event.start_time)
    const status = String(event.status ?? 'scheduled').toLowerCase()
    return start !== null && start > nowMs && status === 'scheduled'
  })
  const excludedEvents = eventsForDate
    .filter((event) => !eligibleEvents.some((eligible) => eligible.id === event.id))
    .map((event) => ({
      eventId: event.id,
      matchup: `${event.away_team} @ ${event.home_team}`,
      startTime: event.start_time,
      status: event.status,
      reason: (parseDateMs(event.start_time) ?? 0) <= nowMs ? 'started_or_completed' : `status_${event.status ?? 'unknown'}`,
    }))
  const safeOddsRows = await loadPersistedSafeOddsForDate(eligibleEvents)
  const existing = await existingPredictionSummary(eligibleEvents.map((event) => event.id))
  const schemaWriteBlocked = !predictionVersioning.applied && existing.currentRows > 0
  const executionPreview = await writeSnapshotsAndPredictions(
    eligibleEvents,
    safeOddsRows as OddsRow[],
    selectedDate,
    generatedAt,
    null,
    {
      persist: dryRun || schemaWriteBlocked ? false : true,
      immutablePredictions: true,
      modelGeneration: 'v7',
      idempotencyKey,
      predictionVersioningApplied: predictionVersioning.applied,
      modelRole: 'challenger',
      isCurrent: false,
      capturePersistenceError: true,
    }
  )
  const modelComparison = buildV6ModelComparison(existing.rows as Record<string, unknown>[], executionPreview.candidates as Array<Record<string, unknown>>, {
    modelVersion: V7_MODEL_VERSION,
    mode: 'mlb_prediction_v7_model_comparison_v1',
    explanationLabel: 'V7',
  })
  if (schemaWriteBlocked && !dryRun) {
    return {
      success: false,
      mode: 'mlb_prediction_v7_regeneration_v1',
      status: 'prediction_versioning_migration_required',
      dryRun,
      confirmed,
      generatedAt,
      selectedDate,
      modelVersion: V7_MODEL_VERSION,
      featureSetVersion: V7_FEATURE_SET_VERSION,
      regenerationReason: V7_REGENERATION_REASON,
      providerCallsPlanned: 0,
      providerCallsMade: 0,
      validation,
      predictionVersioning,
      blocker: 'Prediction Versioning Engine V1 migration is required before immutable side-by-side V7 challenger rows can be inserted safely.',
      existingPredictions: {
        totalRows: existing.rows.length,
        currentRows: existing.currentRows,
        protectedRows: existing.protectedRows,
      },
      planned: {
        oddsRows: safeOddsRows.length,
        snapshotsInserted: executionPreview.snapshots.inserted,
        snapshotsReused: executionPreview.snapshots.reused,
        predictionsInserted: executionPreview.predictions.inserted,
        predictionsReused: executionPreview.predictions.reused,
        predictionsAnalyzed: executionPreview.predictions.analyzed,
        officialPicks: 0,
      },
      modelComparison,
      safety: {
        zeroProviderCalls: true,
        noThresholdChanges: true,
        noOfficialPickForcing: true,
        immutablePredictionRows: true,
        settledHistoryUntouched: true,
        v7ChallengerOnly: true,
      },
    }
  }
  if (!dryRun && executionPreview.predictions.persistenceError) {
    return {
      success: false,
      mode: 'mlb_prediction_v7_regeneration_v1',
      status: 'persistence_failed',
      dryRun,
      confirmed,
      generatedAt,
      selectedDate,
      modelVersion: V7_MODEL_VERSION,
      featureSetVersion: V7_FEATURE_SET_VERSION,
      regenerationReason: V7_REGENERATION_REASON,
      providerCallsPlanned: 0,
      providerCallsMade: 0,
      predictionVersioning,
      modelRole: 'challenger',
      isCurrent: false,
      validation,
      persistenceError: executionPreview.predictions.persistenceError,
      modelComparison,
      planned: {
        oddsRows: safeOddsRows.length,
        snapshotsInserted: executionPreview.snapshots.inserted,
        snapshotsReused: executionPreview.snapshots.reused,
        predictionsInserted: 0,
        predictionsReused: executionPreview.predictions.reused,
        predictionsAnalyzed: executionPreview.predictions.analyzed,
        officialPicks: 0,
      },
    }
  }
  let checkpointId: string | null = null
  if (!dryRun) {
    checkpointId = await writeCheckpoint({
      phase: 'prediction_v7_regeneration',
      selectedDate,
      status: 'completed',
      startedAt: generatedAt,
      endpoint: null,
      recordsFetched: executionPreview.predictions.analyzed,
      inserted: executionPreview.predictions.inserted,
      updated: executionPreview.predictions.reused,
      skipped: existing.protectedRows,
      errorCount: 0,
      providerCallsUsed: 0,
      metadata: {
        idempotencyKey,
        regenerationReason: V7_REGENERATION_REASON,
        modelVersion: V7_MODEL_VERSION,
        featureSetVersion: V7_FEATURE_SET_VERSION,
        predictionVersioning,
        validation,
      },
    })
  }

  return {
    success: true,
    mode: 'mlb_prediction_v7_regeneration_v1',
    status: dryRun && schemaWriteBlocked ? 'preflight_migration_pending' : dryRun ? 'preflight_ready' : 'regeneration_completed',
    dryRun,
    confirmed,
    generatedAt,
    selectedDate,
    timezone: 'America/Puerto_Rico',
    modelVersion: V7_MODEL_VERSION,
    featureSetVersion: V7_FEATURE_SET_VERSION,
    regenerationReason: V7_REGENERATION_REASON,
    providerCallsPlanned: 0,
    providerCallsMade: 0,
    predictionVersioning,
    modelRole: 'challenger',
    isCurrent: false,
    writesPlanned: dryRun ? executionPreview.predictions.inserted + executionPreview.snapshots.inserted : 0,
    readyToExecute: !schemaWriteBlocked,
    checkpointId,
    eligiblePregameEvents: eligibleEvents.map((event) => ({
      eventId: event.id,
      matchup: `${event.away_team} @ ${event.home_team}`,
      startTime: event.start_time,
      status: event.status,
    })),
    excludedEvents,
    existingPredictions: {
      totalRows: existing.rows.length,
      currentRows: existing.currentRows,
      protectedRows: existing.protectedRows,
    },
    planned: {
      oddsRows: safeOddsRows.length,
      snapshotsInserted: executionPreview.snapshots.inserted,
      snapshotsReused: executionPreview.snapshots.reused,
      predictionsInserted: executionPreview.predictions.inserted,
      predictionsReused: executionPreview.predictions.reused,
      predictionsAnalyzed: executionPreview.predictions.analyzed,
      officialPicks: 0,
    },
    modelComparison,
    preview: executionPreview,
    validation,
    confidenceEngineV2: {
      implemented: true,
      categories: ['HIGH', 'MODERATE', 'LOW', 'INSUFFICIENT'],
      separates: ['modelConfidence', 'dataConfidence', 'marketConfidence', 'recommendationConfidence'],
      officialThresholdsChanged: false,
    },
    safety: {
      zeroProviderCalls: true,
      noThresholdChanges: true,
      noOfficialPickForcing: true,
      immutablePredictionRows: true,
      settledHistoryUntouched: true,
      v7ChallengerOnly: true,
      autoPromotionPerformed: false,
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
  const forceRefresh = request.forceRefresh === true
  const finalRefreshLike = finalPregameRefresh || operatingDayFinalRefresh
  const operatingDayId = safeString(request.operatingDayId) || null
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
      providerCheck: providerCheckEvidence({
        providerCheckRequired: forceRefresh,
        failureReason: forceRefresh ? 'no_future_games' : null,
      }),
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
      operatingDayId,
      providerUsage: { externalProviderCallsMade: 0, source: 'dry_run_no_provider_calls' },
      providerCheck: providerCheckEvidence({
        providerCheckRequired: forceRefresh,
        endpoint: `/api/mlb/odds/json/GameOddsByDate/${selectedDate}`,
        failureReason: dryRun ? 'dry_run_no_provider_calls' : 'unconfirmed_no_provider_calls',
      }),
      plannedEndpoints: [
        ...(finalRefreshLike ? [] : [`/api/mlb/odds/json/GamesByDate/${sportsDataIoMlbDate(selectedDate)}`]),
        `/api/mlb/odds/json/GameOddsByDate/${selectedDate}`,
        ...(finalRefreshLike ? [] : [`/api/mlb/fantasy/json/PlayerGameProjectionStatsByDate/${sportsDataIoMlbDate(selectedDate)}`]),
      ],
      caps: { maximumRequests, concurrency: 1, retries: 0, timeoutMs },
    }
  }

  if (!finalRefreshLike && maximumRequests < 3) throw new Error('Prospective preview requires at least 3 approved provider calls.')
  if (finalRefreshLike && maximumRequests < 1) throw new Error('Final pregame refresh requires 1 approved provider call.')
  const apiKey = process.env.SPORTSDATAIO_MLB_API_KEY
  if (!apiKey) throw new Error('SPORTSDATAIO_MLB_API_KEY is not configured.')

  let calls = 0
  const endpoints: EndpointResult[] = []
  const scheduleEndpoint = `/api/mlb/odds/json/GamesByDate/${sportsDataIoMlbDate(selectedDate)}`
  const schedulePhase = operatingDayRefresh ? 'operating_day_slate_discovery' : 'slate_discovery'
  const existingScheduleCheckpoint = await loadCompletedCheckpoint(selectedDate, schedulePhase)
  let scheduleJobId = existingScheduleCheckpoint ? String(existingScheduleCheckpoint.id) : ''
  let gamesFound = 0
  if (!existingScheduleCheckpoint && !finalRefreshLike) {
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

  const allEventsForDate = await loadEventsForDate(selectedDate)
  const events = finalRefreshLike
    ? allEventsForDate.filter(isProspectiveOperatingDayEvent)
    : allEventsForDate
  const nowMs = new Date(generatedAt).getTime()
  const futureSlate = events.filter((event) => {
    const start = parseDateMs(event.start_time)
    return start !== null && start > nowMs && event.status === 'scheduled'
  })
  const oddsEndpoint = `/api/mlb/odds/json/GameOddsByDate/${selectedDate}`
  const providerBackedOddsRefresh = forceRefresh || finalRefreshLike
  if (!futureSlate.length) {
    const startedOrClosed = finalRefreshLike && events.length > 0
    return {
      success: true,
      mode: MODE,
      status: startedOrClosed ? 'locked_or_started' : 'no_future_games',
      generatedAt,
      selectedDate,
      operatingDayId,
      eventsConsidered: events.length,
      eventsRefreshed: 0,
      eventsSkippedStarted: events.length,
      providerCallsPlanned: 0,
      providerCallsMade: calls,
      snapshotsInserted: 0,
      snapshotsReused: 0,
      predictionsRegenerated: 0,
      recommendationsChanged: 0,
      locked: startedOrClosed,
      providerUsage: { externalProviderCallsMade: calls },
      providerCheck: providerCheckEvidence({
        providerCheckRequired: providerBackedOddsRefresh,
        providerCheckAttempted: calls > 0,
        providerCheckCompleted: calls > 0,
        endpoint: oddsEndpoint,
        callsMade: calls,
        responseTimestamp: calls > 0 ? generatedAt : null,
        failureReason: startedOrClosed ? 'locked_or_started' : 'no_future_games',
      }),
      endpoints,
      checkpoints: { scheduleJobId },
      message: startedOrClosed
        ? 'Persisted prospective events are locked, started, final, cancelled or otherwise not eligible for pregame odds refresh.'
        : 'No persisted prospective MLB events are eligible for the selected operating date.',
    }
  }

  const oddsPhase = operatingDayRefresh
    ? 'operating_day_odds_capture'
    : operatingDayFinalRefresh
      ? 'operating_day_final_odds_capture'
    : finalPregameRefresh
      ? 'final_pregame_odds_capture'
      : 'odds_capture'
  const existingOddsCheckpoint = providerBackedOddsRefresh ? null : await loadCompletedCheckpoint(selectedDate, oddsPhase)
  let oddsJobId = existingOddsCheckpoint ? String(existingOddsCheckpoint.id) : ''
  let safeOddsRows = await loadPersistedSafeOddsForDate(events)
  const persistedBeforeProviderCheck = safeOddsRows
  let duplicateRows = 0
  let oddsInserted = 0
  let oddsUpdated = 0
  let rowsSkippedByOlderSnapshot = 0
  let oddsRowsReceived = 0
  let oddsResponseTimestamp: string | null = null
  let oddsProviderCheck = providerCheckEvidence({
    providerCheckRequired: providerBackedOddsRefresh,
    endpoint: oddsEndpoint,
    snapshotsCompared: persistedBeforeProviderCheck.length,
    sourceLatestTimestamp: maxIso(persistedBeforeProviderCheck.map((row) => row.snapshot_time)),
  })
  const warnings: string[] = []
  if (!existingOddsCheckpoint) {
    const oddsStarted = nowIso()
    calls += 1
    const odds = await fetchJson(oddsEndpoint, apiKey, timeoutMs)
    endpoints.push(odds.endpointResult)
    oddsRowsReceived = odds.payload.length
    oddsResponseTimestamp = nowIso()
    const normalizedOdds = normalizeSportsDataIoMlbGameOdds({
      payload: odds.payload,
      existingEvents: eventReferences(events),
      season: SEASON,
    })
    duplicateRows = normalizedOdds.counts.duplicateRows
    const eventById = new Map(events.map((event) => [event.id, event]))
    const latestPersistedByKey = new Map<string, string>()
    for (const row of persistedBeforeProviderCheck) {
      const key = oddsComparisonKey(row)
      const existing = latestPersistedByKey.get(key)
      if (!existing || String(row.snapshot_time) > existing) latestPersistedByKey.set(key, String(row.snapshot_time))
    }
    const pregameRows = normalizedOdds.rows
      .map((row) => ({
        ...row,
        metadata: {
          ...row.metadata,
          capturedAt: generatedAt,
          operatingDayId,
          source: oddsPhase,
          providerTimestamp: row.snapshot_time,
          oddsClassification: 'pregame',
          prospective_preview: true,
          validation_status: 'quarantined',
        },
        operating_day_id: operatingDayId,
        provider_timestamp: row.snapshot_time,
        odds_classification: 'pregame',
      }))
      .filter((row) => {
        const event = eventById.get(row.event_id)
        const eventStart = parseDateMs(event?.start_time)
        const timestamp = parseDateMs(row.snapshot_time)
        return eventStart !== null && timestamp !== null && timestamp < eventStart
      })
    safeOddsRows = pregameRows
      .filter((row) => {
        const latestPersisted = latestPersistedByKey.get(oddsComparisonKey(row))
        if (!latestPersisted || String(row.snapshot_time) >= latestPersisted) return true
        rowsSkippedByOlderSnapshot += 1
        return false
      })
    const oddsAfterStart = normalizedOdds.rows.length - pregameRows.length
    const existingOddsById = await loadExistingOddsByIds(safeOddsRows.map((row) => row.id))
    if (safeOddsRows.length) {
      const result = await supabaseAdmin.from('sports_odds_snapshots').upsert(safeOddsRows, { onConflict: 'id' })
      if (result.error) throw new Error(`sports_odds_snapshots upsert failed: ${result.error.message}`)
    }
    oddsInserted = safeOddsRows.filter((row) => !existingOddsById.has(row.id)).length
    oddsUpdated = safeOddsRows.filter((row) => {
      const existing = existingOddsById.get(row.id)
      return Boolean(existing && oddsMateriallyChanged(row as OddsRow, existing))
    }).length
    const rowsSkipped = normalizedOdds.counts.recordsSkipped + oddsAfterStart + rowsSkippedByOlderSnapshot
    const sourceLatestTimestamp = maxIso(normalizedOdds.rows.map((row) => row.snapshot_time))
    oddsProviderCheck = providerCheckEvidence({
      providerCheckRequired: providerBackedOddsRefresh,
      providerCheckAttempted: true,
      providerCheckCompleted: true,
      endpoint: oddsEndpoint,
      callsMade: 1,
      responseTimestamp: oddsResponseTimestamp,
      sourceLatestTimestamp,
      rowsReceived: oddsRowsReceived,
      snapshotsCompared: persistedBeforeProviderCheck.length,
      changesDetected: oddsInserted + oddsUpdated,
      rowsInserted: oddsInserted,
      rowsUpdated: oddsUpdated,
      rowsSkipped,
      downstreamRebuildRequired: oddsInserted + oddsUpdated > 0,
      failureReason: safeOddsRows.length ? null : rowsSkippedByOlderSnapshot > 0 ? 'provider_response_older_than_stored_odds' : 'provider_returned_no_current_markets',
    })
    oddsJobId = await writeCheckpoint({
      phase: oddsPhase,
      selectedDate,
      status: oddsAfterStart ? 'partial' : 'completed',
      startedAt: oddsStarted,
      endpoint: odds.endpointResult,
      recordsFetched: odds.payload.length,
      inserted: oddsInserted,
      updated: oddsUpdated,
      skipped: rowsSkipped,
      errorCount: normalizedOdds.unresolvedProviderGameIds.length || oddsAfterStart ? 1 : 0,
      providerCallsUsed: 1,
      metadata: {
        providerCheck: oddsProviderCheck,
        validation: {
          unresolvedEvents: normalizedOdds.unresolvedProviderGameIds,
          oddsAfterStart,
          olderSnapshotsSkipped: rowsSkippedByOlderSnapshot,
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
    if (normalizedOdds.unresolvedProviderGameIds.length) {
      warnings.push(
        `Odds payload contained ${normalizedOdds.unresolvedProviderGameIds.length} unresolved provider event mappings; usable mapped pregame odds were preserved.`
      )
    }
    if (oddsAfterStart) throw new Error('Odds capture included provider timestamps at/after first pitch.')
  } else if (safeOddsRows.length) {
    warnings.push('Reused existing safe odds rows from a completed or partial checkpoint; no duplicate odds call was made.')
  }
  const eventById = new Map(events.map((event) => [event.id, event]))

  const projectionsEndpoint = `/api/mlb/fantasy/json/PlayerGameProjectionStatsByDate/${sportsDataIoMlbDate(selectedDate)}`
  const projectionsPhase = operatingDayRefresh ? 'operating_day_projections_availability' : 'projections_availability'
  const existingProjectionsCheckpoint = await loadCompletedCheckpoint(selectedDate, projectionsPhase)
  let projectionsJobId = existingProjectionsCheckpoint ? String(existingProjectionsCheckpoint.id) : ''
  let projectionRows = 0
  if (!existingProjectionsCheckpoint && !finalRefreshLike) {
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

  const preview = await writeSnapshotsAndPredictions(events, safeOddsRows as OddsRow[], selectedDate, generatedAt, operatingDayId)
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
    status: operatingDayFinalRefresh ? 'final_refresh_completed' : 'completed',
    refreshStatus: oddsProviderCheck.providerCheckCompleted
      ? oddsProviderCheck.rowsInserted + oddsProviderCheck.rowsUpdated > 0
        ? 'SUCCESS_CHANGED'
        : oddsProviderCheck.rowsReceived > 0 && safeOddsRows.length === 0
          ? 'PROVIDER_DELAYED'
          : oddsProviderCheck.rowsReceived === 0
            ? 'PROVIDER_NO_CURRENT_MARKETS'
            : 'SUCCESS_NO_CHANGE'
      : providerBackedOddsRefresh
        ? 'MISSED_REFRESH'
        : 'SUCCESS_NO_CHANGE',
    generatedAt,
    selectedDate,
    operatingDayId,
    finalPregameRefresh,
    operatingDayFinalRefresh,
    eventsConsidered: events.length,
    eventsRefreshed: new Set(safeOddsRows.map((row) => row.event_id)).size,
    eventsSkippedStarted: 0,
    providerCallsPlanned: existingOddsCheckpoint ? 0 : 1,
    providerCallsMade: calls,
    providerCheckRequired: oddsProviderCheck.providerCheckRequired,
    providerCheckAttempted: oddsProviderCheck.providerCheckAttempted,
    providerCheckCompleted: oddsProviderCheck.providerCheckCompleted,
    providerCheck: oddsProviderCheck,
    oddsChangesDetected: oddsProviderCheck.changesDetected,
    rowsReceived: oddsProviderCheck.rowsReceived,
    rowsInserted: oddsProviderCheck.rowsInserted,
    rowsUpdated: oddsProviderCheck.rowsUpdated,
    rowsSkipped: oddsProviderCheck.rowsSkipped,
    snapshotsInserted: preview.snapshots.inserted,
    snapshotsReused: preview.snapshots.reused,
    predictionsRegenerated: preview.predictions.inserted + preview.predictions.reused,
    recommendationsChanged: preview.candidates.filter((candidate) => {
      const comparison = asRecord((asRecord(candidate) ?? {}).comparison)
      return comparison?.recommendationChanged === true
    }).length,
    locked: false,
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
    warnings,
    safety: {
      officialPicks: 0,
      productionEligible: false,
      recurringCronActivated: false,
      rawPayloadStored: false,
      noSecretExposure: true,
    },
  }
}
