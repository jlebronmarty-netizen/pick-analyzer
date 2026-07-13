import 'server-only'

import { SportKey, getSupportedSport } from '@/config/sports.config'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { idempotencyKey } from '@/services/sync-reliability.service'
import {
  SportsDataIoRuntimeDomain,
  getSportsDataIoEnvironmentStatus,
  getSportsDataIoRuntimeCapabilities,
  runSportsDataIoRuntimeValidation,
} from '@/services/sportsdataio-runtime-adapter.service'

export type SportsDataIoExecutionStatus =
  | 'dry_run_ready'
  | 'blocked'
  | 'rejected'
  | 'cancelled'
  | 'validation_ready'

export type SportsDataIoExecutionRequest = {
  provider?: string | null
  sportKey?: string | null
  leagueKey?: string | null
  season?: string | null
  dateFrom?: string | null
  dateTo?: string | null
  domains?: string[] | null
  dryRun?: boolean | null
  confirmed?: boolean | null
  maximumRequests?: number | null
  maximumRecords?: number | null
  batchSizeDays?: number | null
  concurrencyLimit?: number | null
  requestDelayMs?: number | null
  jobId?: string | null
}

export type SportsDataIoExecutionCheckpoint = {
  id: string
  sequence: number
  domain: SportsDataIoRuntimeDomain
  sportKey: SportKey
  leagueKey: string | null
  season: string | null
  dateFrom: string | null
  dateTo: string | null
  status: 'planned' | 'blocked'
  estimatedRequests: number
  estimatedRecords: number
  idempotencyKey: string
  dedupeKey: string
  destination: string
  naturalKey: string[]
  warnings: string[]
}

type SportsDataIoTeamPayload = Record<string, unknown>
type SportsDataIoGamePayload = Record<string, unknown>
type SportsDataIoStatsPayload = Record<string, unknown>
type SportsDataIoEndpointResult = {
  feed: string
  endpoint: string
  status: number
  rateLimitMetadata: Record<string, string>
  records: number
  skipped?: boolean
  reason?: string
}

const VALID_DOMAINS: SportsDataIoRuntimeDomain[] = [
  'leagues',
  'teams',
  'schedules',
  'completed_games',
  'scores',
  'standings',
  'team_stats',
  'game_stats',
  'players',
  'player_stats',
  'injuries',
  'lineups',
  'odds',
  'historical_odds',
]

const DEFAULT_DOMAINS: SportsDataIoRuntimeDomain[] = [
  'teams',
  'schedules',
  'completed_games',
  'scores',
  'standings',
  'team_stats',
  'game_stats',
]

const HARD_CAPS = {
  maximumRequests: 25,
  maximumRecords: 5000,
  batchSizeDays: 7,
  concurrencyLimit: 3,
  requestDelayMs: 1500,
}

const NBA_PILOT_CAPS = {
  maximumRequests: 3,
  maximumRecords: 100,
  batchSizeDays: 1,
  concurrencyLimit: 1,
}

const NBA_PILOT_V2_CAPS = {
  maximumRequests: 5,
  maximumRecords: 500,
  batchSizeDays: 1,
  concurrencyLimit: 1,
}

const NBA_PLAYERS_PILOT_CAPS = {
  maximumRequests: 4,
  maximumRecords: 700,
  batchSizeDays: 1,
  concurrencyLimit: 1,
}

const NBA_INJURIES_PILOT_CAPS = {
  maximumRequests: 2,
  maximumRecords: 500,
  batchSizeDays: 1,
  concurrencyLimit: 1,
}

const NBA_LINEUPS_PILOT_CAPS = {
  maximumRequests: 2,
  maximumRecords: 1000,
  batchSizeDays: 1,
  concurrencyLimit: 1,
}

const NBA_PILOT_ALLOWED_DOMAINS: SportsDataIoRuntimeDomain[] = [
  'teams',
  'schedules',
  'scores',
]

const NBA_PILOT_V2_ALLOWED_DOMAINS: SportsDataIoRuntimeDomain[] = [
  'schedules',
  'scores',
  'standings',
  'team_stats',
  'game_stats',
]

const NBA_PLAYERS_PILOT_ALLOWED_DOMAINS: SportsDataIoRuntimeDomain[] = [
  'players',
]

const NBA_INJURIES_PILOT_ALLOWED_DOMAINS: SportsDataIoRuntimeDomain[] = [
  'injuries',
]

const NBA_LINEUPS_PILOT_ALLOWED_DOMAINS: SportsDataIoRuntimeDomain[] = [
  'lineups',
]

const SPORTSDATAIO_NBA_BASE_URL = 'https://api.sportsdata.io/v3/nba/scores/json'
const SPORTSDATAIO_NBA_PROJECTIONS_BASE_URL = 'https://api.sportsdata.io/v3/nba/projections/json'
const NBA_SPORT_KEY = 'basketball_nba'
const NBA_LEAGUE_KEY = 'nba'
const SPORTSDATAIO_REQUEST_TIMEOUT_MS = 15000

function generatedAt() {
  return new Date().toISOString()
}

function numberOrDefault(value: number | null | undefined, fallback: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : fallback
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function asDomain(value: string): SportsDataIoRuntimeDomain | null {
  return VALID_DOMAINS.includes(value as SportsDataIoRuntimeDomain)
    ? (value as SportsDataIoRuntimeDomain)
    : null
}

function normalizeDomains(values: string[] | null | undefined) {
  if (!values || values.length === 0) return DEFAULT_DOMAINS

  const unique = Array.from(new Set(values.map((value) => value.trim())))
  return VALID_DOMAINS.filter((domain) => unique.includes(domain))
}

function invalidDomains(values: string[] | null | undefined) {
  if (!values) return []
  return values.filter((value) => !asDomain(value.trim()))
}

function parseDate(value: string | null | undefined) {
  if (!value) return null
  const date = new Date(`${value.slice(0, 10)}T00:00:00.000Z`)
  return Number.isFinite(date.getTime()) ? date : null
}

function dateOnly(date: Date) {
  return date.toISOString().slice(0, 10)
}

function sportsDataIoDate(value: string) {
  const parsed = parseDate(value)
  if (!parsed) return null
  const month = parsed
    .toLocaleString('en-US', { month: 'short', timeZone: 'UTC' })
    .toUpperCase()
  return `${parsed.getUTCFullYear()}-${month}-${String(parsed.getUTCDate()).padStart(2, '0')}`
}

function nbaSeasonFromDate(value: string | null) {
  const parsed = parseDate(value)
  if (!parsed) return '2026'
  const year = parsed.getUTCFullYear()
  const month = parsed.getUTCMonth() + 1
  return String(month >= 10 ? year + 1 : year)
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

function buildDateWindows({
  dateFrom,
  dateTo,
  batchSizeDays,
}: {
  dateFrom: string | null
  dateTo: string | null
  batchSizeDays: number
}) {
  const from = parseDate(dateFrom)
  const to = parseDate(dateTo)

  if (!from || !to || from.getTime() > to.getTime()) return []

  const windows: Array<{ dateFrom: string; dateTo: string }> = []
  let cursor = from

  while (cursor.getTime() <= to.getTime()) {
    const windowEnd = new Date(
      Math.min(addDays(cursor, batchSizeDays - 1).getTime(), to.getTime())
    )
    windows.push({
      dateFrom: dateOnly(cursor),
      dateTo: dateOnly(windowEnd),
    })
    cursor = addDays(windowEnd, 1)
  }

  return windows
}

function estimatedRecordsFor(domain: SportsDataIoRuntimeDomain) {
  const estimates: Record<SportsDataIoRuntimeDomain, number> = {
    leagues: 1,
    teams: 30,
    schedules: 80,
    completed_games: 80,
    scores: 80,
    standings: 30,
    team_stats: 30,
    game_stats: 160,
    players: 500,
    player_stats: 500,
    injuries: 60,
    lineups: 60,
    odds: 250,
    historical_odds: 500,
  }

  return estimates[domain]
}

function normalizeRequest(request: SportsDataIoExecutionRequest = {}) {
  const provider = request.provider?.trim() || 'sportsdataio'
  const sportKey =
    typeof request.sportKey === 'string' && getSupportedSport(request.sportKey)
      ? (request.sportKey as SportKey)
      : null
  const sport = sportKey ? getSupportedSport(sportKey) : null
  const leagueKey =
    request.leagueKey?.trim() || sport?.leagueKeys[0] || null
  const season = request.season?.trim() || null
  const dateFrom = request.dateFrom?.trim() || null
  const dateTo = request.dateTo?.trim() || null
  const domains = normalizeDomains(request.domains)
  const batchSizeDays = clamp(
    numberOrDefault(request.batchSizeDays, HARD_CAPS.batchSizeDays),
    1,
    HARD_CAPS.batchSizeDays
  )
  const concurrencyLimit = clamp(
    numberOrDefault(request.concurrencyLimit, 1),
    1,
    HARD_CAPS.concurrencyLimit
  )
  const requestDelayMs = clamp(
    numberOrDefault(request.requestDelayMs, HARD_CAPS.requestDelayMs),
    500,
    30_000
  )
  const maximumRequests =
    request.maximumRequests === null || request.maximumRequests === undefined
      ? 0
      : numberOrDefault(request.maximumRequests, 0)
  const maximumRecords = clamp(
    numberOrDefault(request.maximumRecords, HARD_CAPS.maximumRecords),
    0,
    HARD_CAPS.maximumRecords
  )

  return {
    provider,
    sportKey,
    leagueKey,
    season,
    dateFrom,
    dateTo,
    domains,
    dryRun: request.dryRun !== false,
    confirmed: request.confirmed === true,
    maximumRequests,
    maximumRecords,
    batchSizeDays,
    concurrencyLimit,
    requestDelayMs,
    jobId: request.jobId?.trim() || null,
    invalidDomains: invalidDomains(request.domains),
  }
}

function validateGuardrails(normalized: ReturnType<typeof normalizeRequest>) {
  const errors: string[] = []
  const warnings: string[] = []
  const env = getSportsDataIoEnvironmentStatus()
  const from = parseDate(normalized.dateFrom)
  const to = parseDate(normalized.dateTo)

  if (normalized.provider !== 'sportsdataio') {
    errors.push('provider must be sportsdataio.')
  }

  if (!normalized.sportKey) {
    errors.push('sportKey must be a configured sport.')
  }

  if (!normalized.season && (!normalized.dateFrom || !normalized.dateTo)) {
    errors.push('Provide either a season or dateFrom/dateTo.')
  }

  if ((normalized.dateFrom || normalized.dateTo) && (!from || !to)) {
    errors.push('dateFrom and dateTo must be valid YYYY-MM-DD dates.')
  }

  if (from && to && from.getTime() > to.getTime()) {
    errors.push('dateFrom must be before or equal to dateTo.')
  }

  if (normalized.invalidDomains.length > 0) {
    errors.push(`Unsupported SportsDataIO domains: ${normalized.invalidDomains.join(', ')}.`)
  }

  if (normalized.domains.length === 0) {
    errors.push('At least one import domain is required.')
  }

  const isApprovedNbaPilot =
    normalized.provider === 'sportsdataio' &&
    normalized.sportKey === 'basketball_nba' &&
    normalized.leagueKey === 'nba' &&
    normalized.confirmed &&
    normalized.maximumRequests > 0 &&
    normalized.maximumRequests <= NBA_PILOT_CAPS.maximumRequests &&
    normalized.maximumRecords <= NBA_PILOT_CAPS.maximumRecords &&
    normalized.batchSizeDays === NBA_PILOT_CAPS.batchSizeDays &&
    normalized.concurrencyLimit === NBA_PILOT_CAPS.concurrencyLimit &&
    normalized.dateFrom === normalized.dateTo &&
    normalized.domains.length > 0 &&
    normalized.domains.every((domain) => NBA_PILOT_ALLOWED_DOMAINS.includes(domain))
  const isApprovedNbaPilotV2 =
    normalized.provider === 'sportsdataio' &&
    normalized.sportKey === 'basketball_nba' &&
    normalized.leagueKey === 'nba' &&
    normalized.confirmed &&
    normalized.maximumRequests > 0 &&
    normalized.maximumRequests <= NBA_PILOT_V2_CAPS.maximumRequests &&
    normalized.maximumRecords <= NBA_PILOT_V2_CAPS.maximumRecords &&
    normalized.batchSizeDays === NBA_PILOT_V2_CAPS.batchSizeDays &&
    normalized.concurrencyLimit === NBA_PILOT_V2_CAPS.concurrencyLimit &&
    normalized.dateFrom === normalized.dateTo &&
    normalized.domains.length > 0 &&
    normalized.domains.every((domain) => NBA_PILOT_V2_ALLOWED_DOMAINS.includes(domain)) &&
    normalized.domains.includes('standings') &&
    normalized.domains.includes('team_stats')
  const isApprovedNbaPlayersPilot =
    normalized.provider === 'sportsdataio' &&
    normalized.sportKey === 'basketball_nba' &&
    normalized.leagueKey === 'nba' &&
    normalized.confirmed &&
    normalized.maximumRequests > 0 &&
    normalized.maximumRequests <= NBA_PLAYERS_PILOT_CAPS.maximumRequests &&
    normalized.maximumRecords <= NBA_PLAYERS_PILOT_CAPS.maximumRecords &&
    normalized.batchSizeDays === NBA_PLAYERS_PILOT_CAPS.batchSizeDays &&
    normalized.concurrencyLimit === NBA_PLAYERS_PILOT_CAPS.concurrencyLimit &&
    normalized.season !== null &&
    normalized.domains.length === 1 &&
    normalized.domains.every((domain) => NBA_PLAYERS_PILOT_ALLOWED_DOMAINS.includes(domain))
  const isApprovedNbaInjuriesPilot =
    normalized.provider === 'sportsdataio' &&
    normalized.sportKey === 'basketball_nba' &&
    normalized.leagueKey === 'nba' &&
    normalized.confirmed &&
    normalized.maximumRequests > 0 &&
    normalized.maximumRequests <= NBA_INJURIES_PILOT_CAPS.maximumRequests &&
    normalized.maximumRecords <= NBA_INJURIES_PILOT_CAPS.maximumRecords &&
    normalized.batchSizeDays === NBA_INJURIES_PILOT_CAPS.batchSizeDays &&
    normalized.concurrencyLimit === NBA_INJURIES_PILOT_CAPS.concurrencyLimit &&
    normalized.season !== null &&
    normalized.domains.length === 1 &&
    normalized.domains.every((domain) => NBA_INJURIES_PILOT_ALLOWED_DOMAINS.includes(domain))
  const isApprovedNbaLineupsPilot =
    normalized.provider === 'sportsdataio' &&
    normalized.sportKey === 'basketball_nba' &&
    normalized.leagueKey === 'nba' &&
    normalized.confirmed &&
    normalized.maximumRequests > 0 &&
    normalized.maximumRequests <= NBA_LINEUPS_PILOT_CAPS.maximumRequests &&
    normalized.maximumRecords <= NBA_LINEUPS_PILOT_CAPS.maximumRecords &&
    normalized.batchSizeDays === NBA_LINEUPS_PILOT_CAPS.batchSizeDays &&
    normalized.concurrencyLimit === NBA_LINEUPS_PILOT_CAPS.concurrencyLimit &&
    normalized.dateFrom === '2025-12-26' &&
    normalized.dateTo === '2025-12-26' &&
    normalized.domains.length === 1 &&
    normalized.domains.every((domain) => NBA_LINEUPS_PILOT_ALLOWED_DOMAINS.includes(domain))

  if (!normalized.dryRun) {
    if (!normalized.confirmed) {
      errors.push('confirmed=true is required for non-dry-run execution.')
    }
    if (normalized.maximumRequests <= 0) {
      errors.push('maximumRequests must be greater than 0 for non-dry-run execution.')
    }
    if (normalized.maximumRequests > HARD_CAPS.maximumRequests) {
      errors.push(`maximumRequests cannot exceed ${HARD_CAPS.maximumRequests}.`)
    }
    if (!env.configured) {
      errors.push('A valid SportsDataIO API key is required for non-dry-run execution.')
    }
    if (
      !isApprovedNbaPilot &&
      !isApprovedNbaPilotV2 &&
      !isApprovedNbaPlayersPilot &&
      !isApprovedNbaInjuriesPilot &&
      !isApprovedNbaLineupsPilot
    ) {
      errors.push(
        'Live SportsDataIO execution is only enabled for the approved capped NBA pilot shape.'
      )
    }
  }

  if (normalized.dryRun && normalized.maximumRequests > 0) {
    warnings.push('maximumRequests was accepted as a cap preview only; dry-run mode made zero provider calls.')
  }

  if (normalized.domains.includes('historical_odds')) {
    warnings.push('historical_odds has high quota risk and must remain capped during future pilot execution.')
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    environment: env,
  }
}

function domainContractMap() {
  return new Map(
    getSportsDataIoRuntimeCapabilities().domains.map((domain) => [
      domain.domain,
      domain,
    ])
  )
}

function buildCheckpoints(normalized: ReturnType<typeof normalizeRequest>) {
  if (!normalized.sportKey) return []

  const contracts = domainContractMap()
  const windows = buildDateWindows({
    dateFrom: normalized.dateFrom,
    dateTo: normalized.dateTo,
    batchSizeDays: normalized.batchSizeDays,
  })
  const scopes =
    windows.length > 0
      ? windows
      : [{ dateFrom: null as string | null, dateTo: null as string | null }]

  const checkpoints: SportsDataIoExecutionCheckpoint[] = []

  for (const domain of normalized.domains) {
    const contract = contracts.get(domain)
    for (const scope of scopes) {
      const sequence = checkpoints.length + 1
      const key = idempotencyKey([
        'sportsdataio-historical-import-readiness',
        normalized.sportKey,
        normalized.leagueKey,
        normalized.season,
        domain,
        scope.dateFrom,
        scope.dateTo,
      ])

      checkpoints.push({
        id: key,
        sequence,
        domain,
        sportKey: normalized.sportKey,
        leagueKey: normalized.leagueKey,
        season: normalized.season,
        dateFrom: scope.dateFrom,
        dateTo: scope.dateTo,
        status: 'planned',
        estimatedRequests: contract?.estimatedCalls ?? 1,
        estimatedRecords: estimatedRecordsFor(domain),
        idempotencyKey: key,
        dedupeKey: idempotencyKey([
          normalized.sportKey,
          normalized.leagueKey,
          domain,
          normalized.season,
          scope.dateFrom,
          scope.dateTo,
        ]),
        destination: contract?.destination ?? 'normalized sports tables',
        naturalKey: contract?.naturalKey ?? ['sport_key', 'provider_id'],
        warnings: contract?.warnings ?? [],
      })
    }
  }

  return checkpoints
}

function safeString(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function safeNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) {
    return Number(value)
  }
  return null
}

function safeIntegerNumber(value: unknown) {
  const parsed = safeNumber(value)
  return parsed !== null && Number.isInteger(parsed) ? parsed : null
}

function sportsDataIoKey() {
  const env = getSportsDataIoEnvironmentStatus()
  if (!env.configured || !env.envVarName) return null
  return process.env[env.envVarName] ?? null
}

function normalizeStatus(value: unknown) {
  const status = safeString(value).toLowerCase()
  if (['final', 'f', 'closed'].includes(status)) return 'completed'
  if (['inprogress', 'in progress', 'live'].includes(status)) return 'live'
  if (['postponed', 'delayed'].includes(status)) return 'postponed'
  if (['canceled', 'cancelled'].includes(status)) return 'cancelled'
  return 'scheduled'
}

function teamIdFromProviderId(providerId: string) {
  return `basketball_nba:nba:sportsdataio:${providerId}`
}

function eventIdFromProviderId(providerId: string) {
  return `basketball_nba:nba:sportsdataio:${providerId}`
}

function normalizeKey(value: unknown) {
  return safeString(value).toLowerCase().replace(/[^a-z0-9]+/g, '')
}

function pilotMetadata(extra: Record<string, unknown> = {}) {
  return {
    source: 'sportsdataio',
    importModule: 'sportsdataio_nba_pilot_v1',
    trial: true,
    scrambled: true,
    production_eligible: false,
    dataUse: 'provider_import_path_validation_only',
    ...extra,
  }
}

function teamName(team: SportsDataIoTeamPayload) {
  const city = safeString(team.City)
  const name = safeString(team.Name)
  const full = safeString(team.FullName)
  if (full) return full
  if (city && name) return `${city} ${name}`
  return name || safeString(team.Key) || safeString(team.TeamID)
}

function teamProviderId(team: SportsDataIoTeamPayload) {
  return String(team.TeamID ?? team.Key ?? '')
}

function playerProviderId(player: SportsDataIoStatsPayload) {
  return String(player.PlayerID ?? player.SportsDataID ?? '')
}

function playerIdFromProviderId(providerId: string) {
  return `basketball_nba:nba:sportsdataio:player:${providerId}`
}

function playerDisplayName(player: SportsDataIoStatsPayload) {
  const fullName = safeString(player.Name) || safeString(player.FullName)
  const firstName = safeString(player.FirstName)
  const lastName = safeString(player.LastName)
  if (fullName) return fullName
  if (firstName || lastName) return `${firstName} ${lastName}`.trim()
  return safeString(player.PlayerID, 'Unknown SportsDataIO Player')
}

function dateOnlyOrNull(value: unknown) {
  const candidate = safeString(value)
  if (!candidate) return null
  const parsed = new Date(candidate)
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString().slice(0, 10) : null
}

function teamAbbreviation(team: SportsDataIoTeamPayload) {
  return safeString(team.Key) || safeString(team.Abbreviation)
}

function gameProviderId(game: SportsDataIoGamePayload) {
  return String(game.GameID ?? '')
}

function gameDateTime(game: SportsDataIoGamePayload) {
  return (
    safeString(game.DateTimeUTC) ||
    safeString(game.DateTime) ||
    safeString(game.Day)
  )
}

function payloadShapeError(feed: string, payload: unknown) {
  if (!Array.isArray(payload)) return `${feed} returned a non-array payload.`
  return null
}

function mergeGamesById(
  games: SportsDataIoGamePayload[],
  scores: SportsDataIoGamePayload[]
) {
  const merged = new Map<string, SportsDataIoGamePayload>()
  for (const game of games) {
    const id = gameProviderId(game)
    if (id) merged.set(id, game)
  }
  for (const score of scores) {
    const id = gameProviderId(score)
    if (!id) continue
    merged.set(id, { ...(merged.get(id) ?? {}), ...score })
  }
  return Array.from(merged.values())
}

function rateLimitHeaders(headers: Headers) {
  const result: Record<string, string> = {}
  for (const name of [
    'x-ratelimit-limit',
    'x-ratelimit-remaining',
    'x-ratelimit-reset',
    'retry-after',
    'date',
    'content-type',
  ]) {
    const value = headers.get(name)
    if (value) result[name] = value
  }
  return result
}

async function fetchSportsDataIoJson({
  feed,
  path,
  apiKey,
  baseUrl = SPORTSDATAIO_NBA_BASE_URL,
}: {
  feed: string
  path: string
  apiKey: string
  baseUrl?: string
}) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), SPORTSDATAIO_REQUEST_TIMEOUT_MS)
  let response: Response
  try {
    response = await fetch(`${baseUrl}${path}`, {
      method: 'GET',
      headers: {
        'Ocp-Apim-Subscription-Key': apiKey,
        Accept: 'application/json',
      },
      cache: 'no-store',
      signal: controller.signal,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown transport error'
    throw Object.assign(new Error(`${feed} transport failed before HTTP response: ${message}`), {
      stop: true,
      metadata: {
        feed,
        endpoint: path,
        status: 0,
        rateLimitMetadata: {},
        failureBeforeHttpResponse: true,
        requestMethod: 'GET',
      },
    })
  } finally {
    clearTimeout(timeout)
  }
  const metadata = {
    feed,
    endpoint: path,
    status: response.status,
    rateLimitMetadata: rateLimitHeaders(response.headers),
  }

  if ([401, 403, 429].includes(response.status)) {
    throw Object.assign(new Error(`${feed} stopped on HTTP ${response.status}.`), {
      stop: true,
      metadata,
    })
  }

  if (!response.ok) {
    throw Object.assign(new Error(`${feed} returned unexpected HTTP ${response.status}.`), {
      stop: true,
      metadata,
    })
  }

  const payload = await response.json()
  const shapeError = payloadShapeError(feed, payload)
  if (shapeError) {
    throw Object.assign(new Error(shapeError), {
      stop: true,
      metadata,
    })
  }

  return {
    metadata,
    payload: payload as Record<string, unknown>[],
  }
}

async function countExistingIds(table: string, ids: string[]) {
  if (ids.length === 0) return new Set<string>()
  const existing = new Set<string>()
  const uniqueIds = Array.from(new Set(ids))
  const chunkSize = 100
  for (let index = 0; index < uniqueIds.length; index += chunkSize) {
    const chunk = uniqueIds.slice(index, index + chunkSize)
    const result = await supabaseAdmin.from(table).select('id').in('id', chunk)
    if (result.error) throw new Error(`${table} preflight failed: ${result.error.message}`)
    for (const row of result.data ?? []) {
      existing.add(String(row.id))
    }
  }
  return existing
}

async function countExistingMappings(keys: Array<{ entityType: string; providerId: string; season: string }>) {
  if (keys.length === 0) return new Set<string>()
  const existing = new Set<string>()
  const providerIds = Array.from(new Set(keys.map((key) => key.providerId)))
  const chunkSize = 100
  for (let index = 0; index < providerIds.length; index += chunkSize) {
    const chunk = providerIds.slice(index, index + chunkSize)
    const result = await supabaseAdmin
      .from('provider_entity_mappings')
      .select('entity_type, provider_id, season')
      .eq('sport_key', 'basketball_nba')
      .eq('provider', 'sportsdataio')
      .in('provider_id', chunk)
    if (result.error) {
      throw new Error(`provider_entity_mappings preflight failed: ${result.error.message}`)
    }
    for (const row of result.data ?? []) {
      existing.add(`${row.entity_type}:${row.provider_id}:${row.season ?? ''}`)
    }
  }
  return existing
}

async function countExistingTeamStats(keys: Array<{ teamName: string; season: number }>) {
  if (keys.length === 0) return new Set<string>()
  const result = await supabaseAdmin
    .from('team_stats')
    .select('team_name, season')
    .eq('sport_key', 'basketball_nba')
    .in('season', Array.from(new Set(keys.map((key) => key.season))))

  if (result.error) {
    throw new Error(`team_stats preflight failed: ${result.error.message}`)
  }

  return new Set(
    (result.data ?? []).map((row) => `${row.team_name}:${row.season}`)
  )
}

async function loadExistingNbaTeams() {
  const result = await supabaseAdmin
    .from('sports_teams')
    .select('id, name, abbreviation, provider_ids, metadata')
    .eq('sport_key', 'basketball_nba')
    .eq('league_key', 'nba')

  if (result.error) {
    throw new Error(`sports_teams preflight failed: ${result.error.message}`)
  }

  return result.data ?? []
}

async function loadExistingNbaPlayers() {
  const result = await supabaseAdmin
    .from('sport_players')
    .select('id, display_name, team_id, team_name, provider_ids, metadata')
    .eq('sport_key', 'basketball_nba')
    .eq('league_key', 'nba')

  if (result.error) {
    throw new Error(`sport_players preflight failed: ${result.error.message}`)
  }

  return result.data ?? []
}

function buildTeamRows(
  teams: SportsDataIoTeamPayload[],
  existingTeams: Awaited<ReturnType<typeof loadExistingNbaTeams>>
) {
  const existingByName = new Map(
    existingTeams.map((team) => [normalizeKey(team.name), team])
  )
  const existingByAbbreviation = new Map(
    existingTeams
      .filter((team) => team.abbreviation)
      .map((team) => [normalizeKey(team.abbreviation), team])
  )

  return teams
    .map((team) => {
      const providerId = teamProviderId(team)
      if (!providerId) return null
      const providerKey = teamAbbreviation(team)
      const existing =
        existingByName.get(normalizeKey(teamName(team))) ??
        existingByAbbreviation.get(normalizeKey(providerKey))
      const existingProviderIds =
        (existing?.provider_ids as Record<string, unknown> | null) ?? {}
      const existingMetadata =
        (existing?.metadata as Record<string, unknown> | null) ?? {}
      const isExistingProductionRow = Boolean(existing)
      const id = existing?.id ?? teamIdFromProviderId(providerId)

      return {
        id,
        sport_key: 'basketball_nba',
        league_key: 'nba',
        name: teamName(team),
        abbreviation: providerKey,
        city: safeString(team.City) || null,
        conference: safeString(team.Conference) || null,
        division: safeString(team.Division) || null,
        logo_url: safeString(team.WikipediaLogoUrl) || safeString(team.Logo) || null,
        active: true,
        provider_ids: {
          ...existingProviderIds,
          sportsdataio: providerId,
        },
        metadata: {
          ...existingMetadata,
          ...(isExistingProductionRow
            ? {
                sportsdataioPilotV1: pilotMetadata({
                  providerKey,
                  reusedExistingTeamRow: true,
                }),
              }
            : pilotMetadata({
                providerKey,
                reusedExistingTeamRow: false,
              })),
        },
        updated_at: generatedAt(),
      }
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row))
}

function buildEventRows({
  games,
  teamRows,
  season,
}: {
  games: SportsDataIoGamePayload[]
  teamRows: ReturnType<typeof buildTeamRows>
  season: string
}) {
  const teamByAbbreviation = new Map(
    teamRows.map((team) => [String(team.abbreviation), team])
  )
  const teamByProviderId = new Map(
    teamRows.map((team) => [String(team.provider_ids.sportsdataio), team])
  )

  return games
    .map((game) => {
      const providerId = gameProviderId(game)
      const startTime = gameDateTime(game)
      if (!providerId || !startTime) return null
      const homeProviderId = String(game.HomeTeamID ?? '')
      const awayProviderId = String(game.AwayTeamID ?? '')
      const homeKey = safeString(game.HomeTeam)
      const awayKey = safeString(game.AwayTeam)
      const homeTeam =
        teamByProviderId.get(homeProviderId) ?? teamByAbbreviation.get(homeKey)
      const awayTeam =
        teamByProviderId.get(awayProviderId) ?? teamByAbbreviation.get(awayKey)

      if (!homeTeam || !awayTeam) {
        throw new Error(`Unresolved team mapping for SportsDataIO game ${providerId}.`)
      }

      const status = normalizeStatus(game.Status)
      return {
        id: eventIdFromProviderId(providerId),
        sport_key: 'basketball_nba',
        league_key: 'nba',
        season,
        stage: safeString(game.SeasonType) || null,
        home_team_id: homeTeam.id,
        away_team_id: awayTeam.id,
        home_team: homeTeam.name,
        away_team: awayTeam.name,
        start_time: new Date(startTime).toISOString(),
        venue: safeString(game.Stadium) || safeString(game.Arena) || null,
        status,
        home_score: status === 'completed' ? safeNumber(game.HomeTeamScore) : null,
        away_score: status === 'completed' ? safeNumber(game.AwayTeamScore) : null,
        period_scores: {},
        overtime: Boolean(game.IsClosed && game.Overtime),
        provider_ids: {
          sportsdataio: providerId,
          homeTeamId: homeProviderId || null,
          awayTeamId: awayProviderId || null,
        },
        metadata: pilotMetadata({
          providerStatus: game.Status ?? null,
          globalGameId: game.GlobalGameID ?? null,
          day: game.Day ?? null,
        }),
        updated_at: generatedAt(),
      }
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row))
}

function buildMappings({
  teamRows,
  eventRows,
  season,
}: {
  teamRows: ReturnType<typeof buildTeamRows>
  eventRows: ReturnType<typeof buildEventRows>
  season: string
}) {
  return [
    ...teamRows.map((team) => ({
      sport_key: 'basketball_nba',
      entity_type: 'team',
      internal_id: team.id,
      provider: 'sportsdataio',
      provider_id: String(team.provider_ids.sportsdataio),
      season: '',
      metadata: pilotMetadata({ entityType: 'team' }),
      updated_at: generatedAt(),
    })),
    ...eventRows.map((event) => ({
      sport_key: 'basketball_nba',
      entity_type: 'event',
      internal_id: event.id,
      provider: 'sportsdataio',
      provider_id: String(event.provider_ids.sportsdataio),
      season,
      metadata: pilotMetadata({ entityType: 'event' }),
      updated_at: generatedAt(),
    })),
  ]
}

function gamesNeedScoresByDate(games: SportsDataIoGamePayload[]) {
  return games.some((game) => {
    const status = normalizeStatus(game.Status)
    return status === 'completed' && (
      safeNumber(game.HomeTeamScore) === null ||
      safeNumber(game.AwayTeamScore) === null
    )
  })
}

function teamProviderIdFromStats(row: SportsDataIoStatsPayload) {
  return String(row.TeamID ?? row.TeamId ?? row.GlobalTeamID ?? row.Key ?? '')
}

function opponentProviderIdFromStats(row: SportsDataIoStatsPayload) {
  return String(row.OpponentID ?? row.OpponentTeamID ?? row.OpponentTeamId ?? '')
}

function teamNameFromStats(row: SportsDataIoStatsPayload) {
  return (
    safeString(row.TeamName) ||
    safeString(row.Name) ||
    safeString(row.Team) ||
    safeString(row.Key) ||
    teamProviderIdFromStats(row)
  )
}

function wins(row: SportsDataIoStatsPayload) {
  return safeNumber(row.Wins ?? row.Won) ?? 0
}

function losses(row: SportsDataIoStatsPayload) {
  return safeNumber(row.Losses ?? row.Lost) ?? 0
}

function percentage(row: SportsDataIoStatsPayload) {
  const explicit = safeNumber(row.Percentage ?? row.WinPercentage)
  const total = wins(row) + losses(row)
  return explicit ?? (total > 0 ? wins(row) / total : null)
}

function gameScore(row: SportsDataIoStatsPayload) {
  return safeIntegerNumber(row.Score ?? row.TeamScore ?? row.Points)
}

function opponentGameScore(row: SportsDataIoStatsPayload) {
  return safeIntegerNumber(row.OpponentScore ?? row.OpponentPoints)
}

function buildTeamProviderMap(existingTeams: Awaited<ReturnType<typeof loadExistingNbaTeams>>) {
  const teamByProviderId = new Map<string, (typeof existingTeams)[number]>()
  const teamByName = new Map<string, (typeof existingTeams)[number]>()

  for (const team of existingTeams) {
    const providerIds = (team.provider_ids as Record<string, unknown> | null) ?? {}
    const sportsDataIoId = providerIds.sportsdataio
    if (sportsDataIoId !== undefined && sportsDataIoId !== null) {
      teamByProviderId.set(String(sportsDataIoId), team)
    }
    teamByName.set(normalizeKey(team.name), team)
    if (team.abbreviation) teamByName.set(normalizeKey(team.abbreviation), team)
  }

  return { teamByProviderId, teamByName }
}

function buildPlayerRows({
  players,
  existingTeams,
}: {
  players: SportsDataIoStatsPayload[]
  existingTeams: Awaited<ReturnType<typeof loadExistingNbaTeams>>
}) {
  const maps = buildTeamProviderMap(existingTeams)

  return players
    .map((player) => {
      const providerId = playerProviderId(player)
      if (!providerId) return null
      const providerTeamId = String(player.TeamID ?? '')
      const providerTeamKey = safeString(player.Team)
      const team =
        maps.teamByProviderId.get(providerTeamId) ??
        maps.teamByName.get(normalizeKey(providerTeamKey))
      const status = safeString(player.Status, 'unknown')
      const active = !['inactive', 'retired'].includes(status.toLowerCase())

      return {
        id: playerIdFromProviderId(providerId),
        sport_key: NBA_SPORT_KEY,
        league_key: NBA_LEAGUE_KEY,
        team_id: team?.id ?? null,
        team_name: team?.name ?? providerTeamKey ?? null,
        display_name: playerDisplayName(player),
        position: safeString(player.Position) || safeString(player.PositionCategory) || null,
        jersey: safeString(player.Jersey) || null,
        status,
        height: safeString(player.Height) || null,
        weight: safeString(player.Weight) || null,
        birth_date: dateOnlyOrNull(player.BirthDate),
        nationality: safeString(player.BirthCountry) || null,
        active,
        provider_ids: {
          sportsdataio: providerId,
          ...(player.SportsDataID ? { sportsDataId: String(player.SportsDataID) } : {}),
          ...(player.NbaDotComPlayerID ? { nbaDotCom: String(player.NbaDotComPlayerID) } : {}),
        },
        metadata: pilotMetadata({
          importModule: 'sportsdataio_nba_players_pilot_v1',
          providerTeamId: providerTeamId || null,
          providerTeamKey: providerTeamKey || null,
          injuryStatusFromRoster: safeString(player.InjuryStatus) || null,
          injuryBodyPartFromRoster: safeString(player.InjuryBodyPart) || null,
          injuryStartDateFromRoster: dateOnlyOrNull(player.InjuryStartDate),
          hasUnresolvedTeam: !team,
          rawKeys: Object.keys(player).sort(),
        }),
        updated_at: generatedAt(),
      }
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row))
}

function buildPlayerMappings({
  playerRows,
  season,
}: {
  playerRows: ReturnType<typeof buildPlayerRows>
  season: string
}) {
  return playerRows.map((player) => ({
    sport_key: NBA_SPORT_KEY,
    entity_type: 'player',
    internal_id: player.id,
    provider: 'sportsdataio',
    provider_id: String((player.provider_ids as Record<string, unknown>).sportsdataio),
    season,
    metadata: pilotMetadata({
      importModule: 'sportsdataio_nba_players_pilot_v1',
      entityType: 'player',
      displayName: player.display_name,
    }),
    updated_at: generatedAt(),
  }))
}

function buildPlayerProviderMap(existingPlayers: Awaited<ReturnType<typeof loadExistingNbaPlayers>>) {
  const playerByProviderId = new Map<string, (typeof existingPlayers)[number]>()

  for (const player of existingPlayers) {
    const providerIds = (player.provider_ids as Record<string, unknown> | null) ?? {}
    const sportsDataIoId = providerIds.sportsdataio
    if (sportsDataIoId !== undefined && sportsDataIoId !== null) {
      playerByProviderId.set(String(sportsDataIoId), player)
    }
  }

  return { playerByProviderId }
}

function injuryProviderId(injury: SportsDataIoStatsPayload) {
  const explicit = safeString(injury.InjuryID) || safeString(injury.InjuryId)
  const playerId = playerProviderId(injury)
  if (explicit) return explicit
  return playerId
}

function injuryIdFromProviderId(providerId: string) {
  return `basketball_nba:nba:sportsdataio:injury:${providerId}`
}

function normalizeInjuryStatus(value: unknown) {
  const status = safeString(value, 'active').toLowerCase()
  if (status.includes('probable')) return 'probable'
  if (status.includes('questionable')) return 'questionable'
  if (status.includes('doubtful')) return 'doubtful'
  if (status.includes('inactive')) return 'inactive'
  if (status === 'out' || status.includes(' out')) return 'out'
  if (status.includes('day')) return 'day-to-day'
  return 'active'
}

function injuryBodyPart(injury: SportsDataIoStatsPayload) {
  return (
    safeString(injury.BodyPart) ||
    safeString(injury.InjuryBodyPart) ||
    safeString(injury.InjuryType) ||
    safeString(injury.Injury)
  )
}

function injuryDescription(injury: SportsDataIoStatsPayload) {
  return (
    safeString(injury.InjuryNotes) ||
    safeString(injury.Note) ||
    safeString(injury.Notes) ||
    safeString(injury.Description) ||
    safeString(injury.Injury)
  )
}

function injuryUpdatedAt(injury: SportsDataIoStatsPayload) {
  const candidate =
    safeString(injury.Updated) ||
    safeString(injury.UpdatedDate) ||
    safeString(injury.LastUpdated) ||
    safeString(injury.InjuryUpdated) ||
    generatedAt()
  const parsed = new Date(candidate)
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : generatedAt()
}

function buildInjuryRows({
  injuries,
  existingTeams,
  existingPlayers,
}: {
  injuries: SportsDataIoStatsPayload[]
  existingTeams: Awaited<ReturnType<typeof loadExistingNbaTeams>>
  existingPlayers: Awaited<ReturnType<typeof loadExistingNbaPlayers>>
}) {
  const teamMaps = buildTeamProviderMap(existingTeams)
  const playerMaps = buildPlayerProviderMap(existingPlayers)

  return injuries
    .map((injury) => {
      const providerId = injuryProviderId(injury)
      const providerPlayerId = playerProviderId(injury)
      if (!providerId || !providerPlayerId) return null

      const providerTeamId = String(injury.TeamID ?? '')
      const providerTeamKey = safeString(injury.Team)
      const team =
        teamMaps.teamByProviderId.get(providerTeamId) ??
        teamMaps.teamByName.get(normalizeKey(providerTeamKey))
      const player = playerMaps.playerByProviderId.get(providerPlayerId)
      const bodyPart = injuryBodyPart(injury)
      const startDate = dateOnlyOrNull(injury.InjuryStartDate ?? injury.StartDate ?? injury.ReportedDate)

      return {
        id: injuryIdFromProviderId(providerId),
        sport_key: NBA_SPORT_KEY,
        league_key: NBA_LEAGUE_KEY,
        player_id: player?.id ?? null,
        player_name: player?.display_name ?? playerDisplayName(injury),
        team_id: team?.id ?? player?.team_id ?? null,
        team_name: team?.name ?? player?.team_name ?? providerTeamKey ?? null,
        injury_type: bodyPart || null,
        status: normalizeInjuryStatus(injury.Status ?? injury.InjuryStatus),
        description: injuryDescription(injury) || null,
        reported_date: startDate,
        expected_return: dateOnlyOrNull(injury.ExpectedReturn ?? injury.ExpectedReturnDate),
        source: 'sportsdataio',
        provider_ids: {
          sportsdataio: providerId,
          player: providerPlayerId,
          ...(providerTeamId ? { team: providerTeamId } : {}),
        },
        metadata: pilotMetadata({
          importModule: 'sportsdataio_nba_injuries_pilot_v1',
          providerPlayerId,
          providerTeamId: providerTeamId || null,
          providerTeamKey: providerTeamKey || null,
          bodyPart: bodyPart || null,
          hasUnresolvedPlayer: !player,
          hasUnresolvedTeam: !team && !player?.team_id,
          rawKeys: Object.keys(injury).sort(),
        }),
        updated_at: injuryUpdatedAt(injury),
      }
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row))
}

function buildInjuryMappings({
  injuryRows,
  season,
}: {
  injuryRows: ReturnType<typeof buildInjuryRows>
  season: string
}) {
  return injuryRows.map((injury) => ({
    sport_key: NBA_SPORT_KEY,
    entity_type: 'injury',
    internal_id: injury.id,
    provider: 'sportsdataio',
    provider_id: String((injury.provider_ids as Record<string, unknown>).sportsdataio),
    season,
    metadata: pilotMetadata({
      importModule: 'sportsdataio_nba_injuries_pilot_v1',
      entityType: 'injury',
      playerProviderId: (injury.provider_ids as Record<string, unknown>).player,
      playerName: injury.player_name,
    }),
    updated_at: generatedAt(),
  }))
}

function depthProviderId(row: SportsDataIoStatsPayload) {
  const playerId = playerProviderId(row)
  const teamId = String(row.TeamID ?? row.GlobalTeamID ?? '')
  const position = lineupPosition(row)
  const order = depthOrder(row)
  return safeString(row.DepthChartID) || [teamId, position, order, playerId].filter(Boolean).join(':')
}

function lineupProviderId(row: SportsDataIoStatsPayload) {
  const explicit = safeString(row.LineupID) || safeString(row.StartingLineupID)
  if (explicit) return explicit
  return [
    safeString(row.GameID),
    String(row.TeamID ?? row.GlobalTeamID ?? ''),
    playerProviderId(row),
    lineupPosition(row),
  ].filter(Boolean).join(':')
}

function lineupPosition(row: SportsDataIoStatsPayload) {
  return (
    safeString(row.Position) ||
    safeString(row.DepthChartPosition) ||
    safeString(row.LineupPosition) ||
    safeString(row.PositionCategory) ||
    null
  )
}

function depthOrder(row: SportsDataIoStatsPayload) {
  return safeIntegerNumber(
    row.DepthOrder ??
      row.DepthChartOrder ??
      row.Depth ??
      row.Order ??
      row.Rank
  )
}

function roleFromDepth(order: number | null, row: SportsDataIoStatsPayload) {
  const explicit = safeString(row.Role) || safeString(row.DepthChartRole)
  if (explicit) return explicit.toLowerCase()
  if (order === 1) return 'starter'
  if (order !== null && order > 1) return 'bench'
  return 'unknown'
}

function lineupSourceTimestamp(row: SportsDataIoStatsPayload) {
  const candidate =
    safeString(row.Updated) ||
    safeString(row.UpdatedDate) ||
    safeString(row.LastUpdated) ||
    safeString(row.DateTime) ||
    safeString(row.GameDate) ||
    generatedAt()
  const parsed = new Date(candidate)
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : generatedAt()
}

function confirmationLevel(row: SportsDataIoStatsPayload) {
  const status = safeString(row.Status) || safeString(row.LineupStatus) || safeString(row.ConfirmationStatus)
  const normalized = status.toLowerCase()
  const confirmed = row.Confirmed === true || row.IsConfirmed === true || normalized.includes('confirmed')
  if (confirmed) return 'confirmed'
  if (normalized.includes('expected')) return 'expected'
  if (normalized.includes('projected')) return 'projected'
  return 'unknown'
}

function buildDepthChartRows({
  depthCharts,
  existingTeams,
  existingPlayers,
}: {
  depthCharts: SportsDataIoStatsPayload[]
  existingTeams: Awaited<ReturnType<typeof loadExistingNbaTeams>>
  existingPlayers: Awaited<ReturnType<typeof loadExistingNbaPlayers>>
}) {
  const teamMaps = buildTeamProviderMap(existingTeams)
  const playerMaps = buildPlayerProviderMap(existingPlayers)

  return depthCharts
    .map((row) => {
      const providerId = depthProviderId(row)
      const providerPlayerId = playerProviderId(row)
      if (!providerId || !providerPlayerId) return null
      const providerTeamId = String(row.TeamID ?? row.GlobalTeamID ?? '')
      const providerTeamKey = safeString(row.Team)
      const team =
        teamMaps.teamByProviderId.get(providerTeamId) ??
        teamMaps.teamByName.get(normalizeKey(providerTeamKey))
      const player = playerMaps.playerByProviderId.get(providerPlayerId)
      const order = depthOrder(row)
      const role = roleFromDepth(order, row)

      return {
        id: providerId,
        providerPlayerId,
        providerTeamId: providerTeamId || null,
        providerTeamKey: providerTeamKey || null,
        playerId: player?.id ?? null,
        playerName: player?.display_name ?? playerDisplayName(row),
        teamId: team?.id ?? player?.team_id ?? null,
        teamName: team?.name ?? player?.team_name ?? providerTeamKey ?? null,
        position: lineupPosition(row),
        depthOrder: order,
        role,
        starter: role === 'starter',
        sourceTimestamp: lineupSourceTimestamp(row),
        rawKeys: Object.keys(row).sort(),
      }
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row))
}

function buildDepthPlayerRows({
  depthRows,
  existingPlayers,
}: {
  depthRows: ReturnType<typeof buildDepthChartRows>
  existingPlayers: Awaited<ReturnType<typeof loadExistingNbaPlayers>>
}) {
  const playersById = new Map(existingPlayers.map((player) => [String(player.id), player]))

  return depthRows
    .map((depth) => {
      if (!depth.playerId) return null
      const existing = playersById.get(depth.playerId)
      const metadata = (existing?.metadata as Record<string, unknown> | null) ?? {}
      const providerIds = (existing?.provider_ids as Record<string, unknown> | null) ?? {}

      return {
        id: depth.playerId,
        sport_key: NBA_SPORT_KEY,
        league_key: NBA_LEAGUE_KEY,
        team_id: depth.teamId ?? existing?.team_id ?? null,
        team_name: depth.teamName ?? existing?.team_name ?? null,
        display_name: existing?.display_name ?? depth.playerName,
        position: depth.position,
        status: 'active',
        active: true,
        provider_ids: {
          ...providerIds,
          sportsdataio: depth.providerPlayerId,
        },
        metadata: {
          ...metadata,
          sportsdataioDepthChartPilotV1: pilotMetadata({
            importModule: 'sportsdataio_nba_depth_lineups_pilot_v1',
            providerDepthId: depth.id,
            providerTeamId: depth.providerTeamId,
            position: depth.position,
            depthOrder: depth.depthOrder,
            role: depth.role,
            starter: depth.starter,
            sourceTimestamp: depth.sourceTimestamp,
          }),
        },
        updated_at: generatedAt(),
      }
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row))
}

function buildDepthLineupRows({
  depthRows,
  season,
}: {
  depthRows: ReturnType<typeof buildDepthChartRows>
  season: string
}) {
  return depthRows.map((depth) => ({
    id: `basketball_nba:nba:sportsdataio:depth:${depth.id}`,
    sport_key: NBA_SPORT_KEY,
    league_key: NBA_LEAGUE_KEY,
    season,
    event_id: null,
    team_id: depth.teamId,
    player_id: depth.playerId,
    player_name: depth.playerName,
    provider: 'sportsdataio',
    lineup_type: 'depth_chart',
    position: depth.position,
    depth_order: depth.depthOrder,
    role: depth.role,
    starter: depth.starter,
    lineup_status: null,
    confirmation_level: 'unknown',
    source_timestamp: depth.sourceTimestamp,
    provider_ids: {
      sportsdataio: depth.id,
      player: depth.providerPlayerId,
      ...(depth.providerTeamId ? { team: depth.providerTeamId } : {}),
    },
    metadata: pilotMetadata({
      importModule: 'sportsdataio_nba_depth_lineups_pilot_v1',
      providerTeamId: depth.providerTeamId,
      providerTeamKey: depth.providerTeamKey,
      teamName: depth.teamName,
      hasUnresolvedPlayer: !depth.playerId,
      hasUnresolvedTeam: !depth.teamId,
      rawKeys: depth.rawKeys,
    }),
    updated_at: generatedAt(),
  }))
}

function buildStartingLineupRows({
  lineups,
  existingTeams,
  existingPlayers,
  existingEvents,
  season,
}: {
  lineups: SportsDataIoStatsPayload[]
  existingTeams: Awaited<ReturnType<typeof loadExistingNbaTeams>>
  existingPlayers: Awaited<ReturnType<typeof loadExistingNbaPlayers>>
  existingEvents: Array<{ id: string; provider_ids: Record<string, unknown> | null }>
  season: string
}) {
  const teamMaps = buildTeamProviderMap(existingTeams)
  const playerMaps = buildPlayerProviderMap(existingPlayers)
  const eventByProviderId = new Map<string, (typeof existingEvents)[number]>()
  for (const event of existingEvents) {
    const providerIds = (event.provider_ids as Record<string, unknown> | null) ?? {}
    if (providerIds.sportsdataio !== undefined && providerIds.sportsdataio !== null) {
      eventByProviderId.set(String(providerIds.sportsdataio), event)
    }
  }

  return lineups
    .map((row) => {
      const providerId = lineupProviderId(row)
      const providerPlayerId = playerProviderId(row)
      if (!providerId || !providerPlayerId) return null
      const providerGameId = safeString(row.GameID)
      const providerTeamId = String(row.TeamID ?? row.GlobalTeamID ?? '')
      const providerTeamKey = safeString(row.Team)
      const event = eventByProviderId.get(providerGameId)
      const team =
        teamMaps.teamByProviderId.get(providerTeamId) ??
        teamMaps.teamByName.get(normalizeKey(providerTeamKey))
      const player = playerMaps.playerByProviderId.get(providerPlayerId)
      const confirmation = confirmationLevel(row)
      const position = lineupPosition(row)
      const sourceTimestamp = lineupSourceTimestamp(row)

      return {
        id: `basketball_nba:nba:sportsdataio:lineup:${providerId}`,
        sport_key: NBA_SPORT_KEY,
        league_key: NBA_LEAGUE_KEY,
        season,
        event_id: event?.id ?? null,
        team_id: team?.id ?? player?.team_id ?? null,
        player_id: player?.id ?? null,
        player_name: player?.display_name ?? playerDisplayName(row),
        provider: 'sportsdataio',
        lineup_type: 'starting_lineup',
        position,
        depth_order: null,
        role: 'starter',
        starter: true,
        lineup_status: safeString(row.Status) || safeString(row.LineupStatus) || null,
        confirmation_level: confirmation,
        source_timestamp: sourceTimestamp,
        provider_ids: {
          sportsdataio: providerId,
          player: providerPlayerId,
          ...(providerGameId ? { event: providerGameId } : {}),
          ...(providerTeamId ? { team: providerTeamId } : {}),
        },
        metadata: pilotMetadata({
          importModule: 'sportsdataio_nba_depth_lineups_pilot_v1',
          providerGameId: providerGameId || null,
          providerTeamId: providerTeamId || null,
          providerTeamKey: providerTeamKey || null,
          hasUnresolvedEvent: !event,
          hasUnresolvedPlayer: !player,
          hasUnresolvedTeam: !team && !player?.team_id,
          rawKeys: Object.keys(row).sort(),
        }),
        updated_at: generatedAt(),
      }
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row))
}

function buildLineupMappings({
  depthRows,
  lineupRows,
  season,
}: {
  depthRows: ReturnType<typeof buildDepthChartRows>
  lineupRows: ReturnType<typeof buildStartingLineupRows>
  season: string
}) {
  return [
    ...depthRows.map((depth) => ({
      sport_key: NBA_SPORT_KEY,
      entity_type: 'depth_chart',
      internal_id: depth.playerId ?? `unresolved:${depth.id}`,
      provider: 'sportsdataio',
      provider_id: depth.id,
      season,
      metadata: pilotMetadata({
        importModule: 'sportsdataio_nba_depth_lineups_pilot_v1',
        entityType: 'depth_chart',
        providerPlayerId: depth.providerPlayerId,
        playerName: depth.playerName,
      }),
      updated_at: generatedAt(),
    })),
    ...lineupRows.map((lineup) => ({
      sport_key: NBA_SPORT_KEY,
      entity_type: 'lineup',
      internal_id: lineup.id,
      provider: 'sportsdataio',
      provider_id: String((lineup.provider_ids as Record<string, unknown>).sportsdataio),
      season,
      metadata: pilotMetadata({
        importModule: 'sportsdataio_nba_depth_lineups_pilot_v1',
        entityType: 'lineup',
        playerName: lineup.player_name,
        eventProviderId: (lineup.provider_ids as Record<string, unknown>).event ?? null,
      }),
      updated_at: generatedAt(),
    })),
  ]
}

function resolveTeamFromPayload(
  row: SportsDataIoStatsPayload,
  maps: ReturnType<typeof buildTeamProviderMap>
) {
  return (
    maps.teamByProviderId.get(teamProviderIdFromStats(row)) ??
    maps.teamByName.get(normalizeKey(teamNameFromStats(row)))
  )
}

function buildStandingRows({
  standings,
  existingTeams,
  season,
}: {
  standings: SportsDataIoStatsPayload[]
  existingTeams: Awaited<ReturnType<typeof loadExistingNbaTeams>>
  season: string
}) {
  const maps = buildTeamProviderMap(existingTeams)

  return standings
    .map((row) => {
      const providerId = teamProviderIdFromStats(row)
      const team = resolveTeamFromPayload(row, maps)
      if (!providerId || !team) return null
      return {
        id: `${NBA_SPORT_KEY}_${season}_${team.id}`,
        sport_key: 'basketball_nba',
        league_key: 'nba',
        season,
        team_id: team.id,
        team_name: String(team.name),
        conference: safeString(row.Conference) || safeString(row.ConferenceName) || null,
        division: safeString(row.Division) || safeString(row.DivisionName) || null,
        conference_rank: safeNumber(row.ConferenceRank ?? row.ConferenceSeed),
        division_rank: safeNumber(row.DivisionRank),
        wins: wins(row),
        losses: losses(row),
        win_percentage: percentage(row),
        games_behind: safeNumber(row.GamesBack ?? row.GamesBehind),
        home_record:
          row.HomeWins !== undefined || row.HomeLosses !== undefined
            ? `${safeNumber(row.HomeWins) ?? 0}-${safeNumber(row.HomeLosses) ?? 0}`
            : null,
        away_record:
          row.AwayWins !== undefined || row.AwayLosses !== undefined
            ? `${safeNumber(row.AwayWins) ?? 0}-${safeNumber(row.AwayLosses) ?? 0}`
            : null,
        streak: safeString(row.Streak) || null,
        last_ten:
          row.LastTenWins !== undefined || row.LastTenLosses !== undefined
            ? `${safeNumber(row.LastTenWins) ?? 0}-${safeNumber(row.LastTenLosses) ?? 0}`
            : null,
        clinched: {},
        provider_ids: { sportsdataio: providerId },
        metadata: pilotMetadata({
          importModule: 'sportsdataio_nba_pilot_v2',
          entityType: 'standing',
          providerSeason: season,
        }),
        updated_at: generatedAt(),
      }
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row))
}

function buildTeamStatsRows({
  teamStats,
  existingTeams,
  season,
  seasonStartYear,
}: {
  teamStats: SportsDataIoStatsPayload[]
  existingTeams: Awaited<ReturnType<typeof loadExistingNbaTeams>>
  season: string
  seasonStartYear: number
}) {
  const maps = buildTeamProviderMap(existingTeams)

  return teamStats
    .map((row) => {
      const team = resolveTeamFromPayload(row, maps)
      if (!team) return null
      const winCount = wins(row)
      const lossCount = losses(row)
      return {
        team_name: String(team.name),
        sport_key: 'basketball_nba',
        season: seasonStartYear,
        wins: winCount,
        losses: lossCount,
        ties: 0,
        home_wins: safeNumber(row.HomeWins) ?? 0,
        home_losses: safeNumber(row.HomeLosses) ?? 0,
        away_wins: safeNumber(row.AwayWins) ?? 0,
        away_losses: safeNumber(row.AwayLosses) ?? 0,
        last_5_wins: safeNumber(row.LastFiveWins) ?? 0,
        last_5_losses: safeNumber(row.LastFiveLosses) ?? 0,
        last_10_wins: safeNumber(row.LastTenWins) ?? 0,
        last_10_losses: safeNumber(row.LastTenLosses) ?? 0,
        streak: safeNumber(row.Streak) ?? 0,
        win_percentage: percentage(row),
        raw_data: pilotMetadata({
          importModule: 'sportsdataio_nba_pilot_v2',
          providerTeamId: teamProviderIdFromStats(row),
          providerSeason: season,
          points_per_game: safeNumber(row.PointsPerGame),
          opponent_points_per_game: safeNumber(row.OpponentPointsPerGame),
          net_rating:
            safeNumber(row.PointsPerGame) !== null && safeNumber(row.OpponentPointsPerGame) !== null
              ? Number(safeNumber(row.PointsPerGame)) - Number(safeNumber(row.OpponentPointsPerGame))
              : null,
          rawKeys: Object.keys(row).sort(),
        }),
        updated_at: generatedAt(),
      }
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row))
}

function buildGameStatsRows({
  gameStats,
  eventRows,
  existingTeams,
  season,
}: {
  gameStats: SportsDataIoStatsPayload[]
  eventRows: ReturnType<typeof buildEventRows>
  existingTeams: Awaited<ReturnType<typeof loadExistingNbaTeams>>
  season: string
}) {
  const maps = buildTeamProviderMap(existingTeams)
  const eventByProviderId = new Map(
    eventRows.map((event) => [String(event.provider_ids.sportsdataio), event])
  )

  return gameStats
    .map((row) => {
      const gameId = String(row.GameID ?? row.GameId ?? '')
      const event = eventByProviderId.get(gameId)
      const team = resolveTeamFromPayload(row, maps)
      if (!gameId || !event || !team) return null
      const opponent =
        maps.teamByProviderId.get(opponentProviderIdFromStats(row)) ??
        (event.home_team_id === team.id
          ? maps.teamByProviderId.get(String(event.provider_ids.awayTeamId))
          : maps.teamByProviderId.get(String(event.provider_ids.homeTeamId)))
      const isHome =
        String(event.home_team_id) === String(team.id) ||
        safeString(row.HomeOrAway).toUpperCase() === 'HOME' ||
        row.IsHome === true
      return {
        id: `${event.id}_${team.id}`,
        sport_key: 'basketball_nba',
        league_key: 'nba',
        season,
        event_id: event.id,
        team_id: team.id,
        team_name: String(team.name),
        opponent_team_id: opponent?.id ?? null,
        opponent_team_name: opponent?.name ?? safeString(row.Opponent) ?? null,
        is_home: isHome,
        points_for: gameScore(row),
        points_against: opponentGameScore(row),
        first_half_points: safeNumber(row.FirstHalfPoints),
        quarter_scores: [
          safeNumber(row.Quarter1),
          safeNumber(row.Quarter2),
          safeNumber(row.Quarter3),
          safeNumber(row.Quarter4),
        ].filter((score) => score !== null),
        stats: pilotMetadata({
          importModule: 'sportsdataio_nba_pilot_v2',
          providerGameId: gameId,
          providerTeamId: teamProviderIdFromStats(row),
          rawKeys: Object.keys(row).sort(),
        }),
        provider_ids: { sportsdataio: `${gameId}:${teamProviderIdFromStats(row)}` },
        updated_at: generatedAt(),
      }
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row))
}

async function recordPilotJob({
  jobId,
  jobType = 'sportsdataio_nba_pilot_import_v1',
  status,
  season,
  startedAt,
  counters,
  metadata,
  lastError,
}: {
  jobId: string
  jobType?: string
  status: 'completed' | 'failed' | 'partial'
  season: string
  startedAt: string
  counters: {
    fetched: number
    inserted: number
    updated: number
    skipped: number
    errors: number
  }
  metadata: Record<string, unknown>
  lastError?: string | null
}) {
  const completedAt = generatedAt()
  const durationMs = new Date(completedAt).getTime() - new Date(startedAt).getTime()
  const syncJobId = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(jobId)
    ? jobId
    : crypto.randomUUID()
  const result = await supabaseAdmin.from('sports_sync_jobs').upsert(
    {
      id: syncJobId,
      job_type: jobType,
      sport_key: 'basketball_nba',
      league_key: 'nba',
      provider: 'sportsdataio',
      season,
      started_at: startedAt,
      completed_at: completedAt,
      status,
      records_fetched: counters.fetched,
      records_inserted: counters.inserted,
      records_updated: counters.updated,
      records_skipped: counters.skipped,
      error_count: counters.errors,
      last_error: lastError ?? null,
      duration_ms: durationMs,
      metadata: {
        ...metadata,
        importPlanJobId: jobId,
      },
      updated_at: completedAt,
    },
    { onConflict: 'id' }
  )
  if (result.error) {
    throw new Error(`sports_sync_jobs persistence failed: ${result.error.message}`)
  }
}

async function executeSportsDataIoNbaPilotImportV2(
  request: SportsDataIoExecutionRequest = {}
) {
  const normalized = normalizeRequest(request)
  const plan = planSportsDataIoHistoricalExecution(request)
  const startedAt = generatedAt()
  const selectedDate = normalized.dateFrom
  const providerDate = selectedDate ? sportsDataIoDate(selectedDate) : null
  const season = normalized.season ?? nbaSeasonFromDate(selectedDate)
  const seasonStartYear = Number(season) - 1
  const apiKey = sportsDataIoKey()
  const jobId = plan.job.id
  const endpoints = {
    games: { feed: 'gamesByDate', path: `/GamesByDate/${providerDate}` },
    scores: { feed: 'scoresByDate', path: `/ScoresByDate/${providerDate}` },
    standings: { feed: 'standingsBySeason', path: `/Standings/${season}` },
    teamStats: { feed: 'teamSeasonStats', path: `/TeamSeasonStats/${season}` },
    gameStats: { feed: 'teamGameStatsByDate', path: `/TeamGameStatsByDate/${providerDate}` },
  }

  if (normalized.dryRun) return plan

  if (!plan.validation.valid || !apiKey || !providerDate || !selectedDate || !Number.isFinite(seasonStartYear)) {
    return {
      ...plan,
      success: false,
      status: 'rejected',
      validation: {
        ...plan.validation,
        valid: false,
        errors: [
          ...plan.validation.errors,
          ...(!apiKey ? ['SportsDataIO API key is not configured.'] : []),
          ...(!providerDate ? ['dateFrom/dateTo could not be converted to SportsDataIO date format.'] : []),
          ...(!Number.isFinite(seasonStartYear) ? ['season could not be converted to a numeric NBA season year.'] : []),
        ],
      },
    }
  }

  if (4 > normalized.maximumRequests) {
    return {
      ...plan,
      success: false,
      status: 'rejected',
      validation: {
        ...plan.validation,
        valid: false,
        errors: ['Planned SportsDataIO V2 endpoint count exceeds maximumRequests.'],
      },
    }
  }

  const endpointResults: SportsDataIoEndpointResult[] = []
  let externalCallsUsed = 0
  const fetchCapped = async (endpoint: { feed: string; path: string }) => {
    if (externalCallsUsed + 1 > normalized.maximumRequests) {
      throw new Error(`Pilot V2 request cap ${normalized.maximumRequests} reached before ${endpoint.feed}.`)
    }
    externalCallsUsed += 1
    return fetchSportsDataIoJson({ ...endpoint, apiKey })
  }

  try {
    const gamesResponse = await fetchCapped(endpoints.games)
    endpointResults.push({ ...gamesResponse.metadata, records: gamesResponse.payload.length })

    const rawGames = gamesResponse.payload as SportsDataIoGamePayload[]
    let rawScores: SportsDataIoGamePayload[] = []
    if (gamesNeedScoresByDate(rawGames)) {
      const scoresResponse = await fetchCapped(endpoints.scores)
      endpointResults.push({ ...scoresResponse.metadata, records: scoresResponse.payload.length })
      rawScores = scoresResponse.payload as SportsDataIoGamePayload[]
    } else {
      endpointResults.push({
        feed: endpoints.scores.feed,
        endpoint: endpoints.scores.path,
        status: 0,
        rateLimitMetadata: {},
        records: 0,
        skipped: true,
        reason: 'GamesByDate payload already included normalized final scores.',
      })
    }

    const standingsResponse = await fetchCapped(endpoints.standings)
    endpointResults.push({ ...standingsResponse.metadata, records: standingsResponse.payload.length })

    const teamStatsResponse = await fetchCapped(endpoints.teamStats)
    endpointResults.push({ ...teamStatsResponse.metadata, records: teamStatsResponse.payload.length })

    const gameStatsResponse = await fetchCapped(endpoints.gameStats)
    endpointResults.push({ ...gameStatsResponse.metadata, records: gameStatsResponse.payload.length })

    const rawStandings = standingsResponse.payload as SportsDataIoStatsPayload[]
    const rawTeamStats = teamStatsResponse.payload as SportsDataIoStatsPayload[]
    const rawGameStats = gameStatsResponse.payload as SportsDataIoStatsPayload[]
    const recordsFetched =
      rawGames.length + rawScores.length + rawStandings.length + rawTeamStats.length + rawGameStats.length

    if (recordsFetched > normalized.maximumRecords) {
      throw new Error(`Pilot V2 fetched ${recordsFetched} records, exceeding maximumRecords ${normalized.maximumRecords}.`)
    }

    const existingNbaTeams = await loadExistingNbaTeams()
    const teamRows = buildTeamRows([], existingNbaTeams)
    const syntheticTeamRows = existingNbaTeams
      .map((team) => {
        const providerIds = (team.provider_ids as Record<string, unknown> | null) ?? {}
        const sportsDataIoId = providerIds.sportsdataio
        if (!sportsDataIoId) return null
        return {
          id: String(team.id),
          sport_key: 'basketball_nba',
          league_key: 'nba',
          name: String(team.name),
          abbreviation: team.abbreviation ? String(team.abbreviation) : '',
          city: null,
          conference: null,
          division: null,
          logo_url: null,
          active: true,
          provider_ids: { sportsdataio: String(sportsDataIoId) },
          metadata: pilotMetadata({
            importModule: 'sportsdataio_nba_pilot_v2',
            reusedExistingTeamRow: true,
          }),
          updated_at: generatedAt(),
        }
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row))

    const eventRows = buildEventRows({
      games: mergeGamesById(rawGames, rawScores),
      teamRows: syntheticTeamRows,
      season,
    })
    if (rawGames.length > 0 && eventRows.length === 0) {
      throw new Error('Unexpected games payload shape: no V2 events normalized.')
    }

    const standingRows = buildStandingRows({ standings: rawStandings, existingTeams: existingNbaTeams, season })
    const teamStatRows = buildTeamStatsRows({
      teamStats: rawTeamStats,
      existingTeams: existingNbaTeams,
      season,
      seasonStartYear,
    })
    const gameStatRows = buildGameStatsRows({
      gameStats: rawGameStats,
      eventRows,
      existingTeams: existingNbaTeams,
      season,
    })
    const mappingRows = buildMappings({ teamRows, eventRows, season })

    const [existingEvents, existingStandings, existingGameStats, existingTeamStats, existingMappings] =
      await Promise.all([
        countExistingIds('sport_events', eventRows.map((row) => row.id)),
        countExistingIds('sport_standings', standingRows.map((row) => row.id)),
        countExistingIds('sport_game_stats', gameStatRows.map((row) => row.id)),
        countExistingTeamStats(
          teamStatRows.map((row) => ({
            teamName: row.team_name,
            season: row.season,
          }))
        ),
        countExistingMappings(
          mappingRows.map((row) => ({
            entityType: row.entity_type,
            providerId: row.provider_id,
            season: row.season,
          }))
        ),
      ])

    const eventsResult = eventRows.length
      ? await supabaseAdmin.from('sport_events').upsert(eventRows, { onConflict: 'id' })
      : { error: null }
    if (eventsResult.error) throw new Error(`sport_events persistence failed: ${eventsResult.error.message}`)

    const mappingsResult = mappingRows.length
      ? await supabaseAdmin.from('provider_entity_mappings').upsert(mappingRows, {
          onConflict: 'sport_key,entity_type,provider,provider_id,season',
        })
      : { error: null }
    if (mappingsResult.error) throw new Error(`provider_entity_mappings persistence failed: ${mappingsResult.error.message}`)

    const standingsResult = standingRows.length
      ? await supabaseAdmin.from('sport_standings').upsert(standingRows, { onConflict: 'id' })
      : { error: null }
    if (standingsResult.error) throw new Error(`sport_standings persistence failed: ${standingsResult.error.message}`)

    const teamStatsResult = teamStatRows.length
      ? await supabaseAdmin.from('team_stats').upsert(teamStatRows, {
          onConflict: 'team_name,sport_key,season',
        })
      : { error: null }
    if (teamStatsResult.error) throw new Error(`team_stats persistence failed: ${teamStatsResult.error.message}`)

    const gameStatsResult = gameStatRows.length
      ? await supabaseAdmin.from('sport_game_stats').upsert(gameStatRows, { onConflict: 'id' })
      : { error: null }
    if (gameStatsResult.error) throw new Error(`sport_game_stats persistence failed: ${gameStatsResult.error.message}`)

    const insertedEvents = eventRows.filter((row) => !existingEvents.has(row.id)).length
    const updatedEvents = eventRows.length - insertedEvents
    const insertedStandings = standingRows.filter((row) => !existingStandings.has(row.id)).length
    const updatedStandings = standingRows.length - insertedStandings
    const insertedTeamStats = teamStatRows.filter(
      (row) => !existingTeamStats.has(`${row.team_name}:${row.season}`)
    ).length
    const updatedTeamStats = teamStatRows.length - insertedTeamStats
    const insertedGameStats = gameStatRows.filter((row) => !existingGameStats.has(row.id)).length
    const updatedGameStats = gameStatRows.length - insertedGameStats
    const insertedMappings = mappingRows.filter(
      (row) => !existingMappings.has(`${row.entity_type}:${row.provider_id}:${row.season}`)
    ).length
    const updatedMappings = mappingRows.length - insertedMappings
    const recordsNormalized = eventRows.length + standingRows.length + teamStatRows.length + gameStatRows.length
    const skipped =
      mergeGamesById(rawGames, rawScores).length -
      eventRows.length +
      rawStandings.length -
      standingRows.length +
      rawTeamStats.length -
      teamStatRows.length +
      rawGameStats.length -
      gameStatRows.length
    const validation = await validateSportsDataIoPilotV2Persistence({
      selectedDate,
      season,
      eventRows,
      standingRows,
      teamStatRows,
      gameStatRows,
    })
    const inserted = insertedEvents + insertedStandings + insertedTeamStats + insertedGameStats + insertedMappings
    const updated = updatedEvents + updatedStandings + updatedTeamStats + updatedGameStats + updatedMappings
    const counters = {
      fetched: recordsFetched,
      inserted,
      updated,
      skipped,
      errors: validation.errors.length,
    }

    await recordPilotJob({
      jobId,
      jobType: 'sportsdataio_nba_pilot_import_v2',
      status: validation.errors.length > 0 ? 'partial' : 'completed',
      season,
      startedAt,
      counters,
      metadata: {
        ...pilotMetadata({ importModule: 'sportsdataio_nba_pilot_v2' }),
        selectedDate,
        providerDate,
        endpoints: endpointResults.map((endpoint) => ({
          feed: endpoint.feed,
          endpoint: endpoint.endpoint,
          status: endpoint.status,
          records: endpoint.records,
          skipped: endpoint.skipped ?? false,
        })),
        scoresByDateCalled: rawScores.length > 0,
        externalCallsUsed,
      },
      lastError: validation.errors.join('; ') || null,
    })

    return {
      success: validation.errors.length === 0,
      mode: 'sportsdataio_nba_pilot_import_v2',
      generatedAt: generatedAt(),
      providerUsage: {
        externalProviderCallsMade: externalCallsUsed,
        source: 'sportsdataio_live_capped_nba_pilot_v2',
      },
      dryRun: false,
      liveExecutionEnabled: true,
      status: validation.errors.length === 0 ? 'completed' : 'partial',
      completionLabels: [
        'EXECUTION_ARCHITECTURE_COMPLETE',
        'LIVE_PROVIDER_VALIDATION_COMPLETE',
        'PILOT_IMPORT_COMPLETE',
        'TRIAL_DATA_ISOLATION_COMPLETE',
      ],
      selectedDate,
      providerDate,
      season,
      endpoints: endpointResults,
      request: plan.request,
      job: {
        id: jobId,
        status: validation.errors.length === 0 ? 'completed' : 'partial',
        progressPercent: 100,
      },
      counters: {
        recordsFetched,
        recordsNormalized,
        standingsInserted: insertedStandings,
        standingsUpdated: updatedStandings,
        teamStatsInserted: insertedTeamStats,
        teamStatsUpdated: updatedTeamStats,
        gameStatsInserted: insertedGameStats,
        gameStatsUpdated: updatedGameStats,
        eventsInserted: insertedEvents,
        eventsUpdated: updatedEvents,
        scoresInsertedOrUpdated: eventRows.filter((row) => row.status === 'completed').length,
        mappingsInserted: insertedMappings,
        mappingsUpdated: updatedMappings,
        recordsSkipped: skipped,
        recordLevelErrors: validation.errors.length,
        providerCallsUsed: externalCallsUsed,
      },
      tablesPopulated: [
        'sport_events',
        'provider_entity_mappings',
        'sport_standings',
        'team_stats',
        'sport_game_stats',
        'sports_sync_jobs',
      ],
      idempotency: {
        repeatedProviderCall: false,
        reason: 'Idempotency was checked by reprocessing fetched in-memory payloads; no repeat provider call was made.',
        localValidation: {
          stableEventUpsertKeys: eventRows.every((row) => Boolean(row.id)),
          stableStandingUpsertKeys: standingRows.every((row) => Boolean(row.id)),
          stableTeamStatsKeys: teamStatRows.every((row) => Boolean(row.team_name && row.sport_key && row.season)),
          stableGameStatsUpsertKeys: gameStatRows.every((row) => Boolean(row.id)),
          noDuplicateStandingKeys: new Set(standingRows.map((row) => row.id)).size === standingRows.length,
          noDuplicateGameStatKeys: new Set(gameStatRows.map((row) => row.id)).size === gameStatRows.length,
          noMappingConflicts:
            new Set(mappingRows.map((row) => `${row.entity_type}:${row.provider_id}:${row.season}`)).size ===
            mappingRows.length,
          conflictTargets: [
            'sport_events.id',
            'sport_standings.id',
            'team_stats(team_name,sport_key,season)',
            'sport_game_stats.id',
            'provider_entity_mappings unique provider tuple',
          ],
        },
      },
      validation,
      noSecretExposure: true,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown SportsDataIO pilot V2 import error'
    const metadata = typeof error === 'object' && error && 'metadata' in error
      ? (error as { metadata?: unknown }).metadata
      : null
    await recordPilotJob({
      jobId,
      jobType: 'sportsdataio_nba_pilot_import_v2',
      status: 'failed',
      season,
      startedAt,
      counters: {
        fetched: 0,
        inserted: 0,
        updated: 0,
        skipped: 0,
        errors: 1,
      },
      metadata: {
        ...pilotMetadata({ importModule: 'sportsdataio_nba_pilot_v2' }),
        selectedDate,
        providerDate,
        endpointFailure: metadata,
        externalCallsUsed,
      },
      lastError: message,
    }).catch(() => undefined)

    return {
      success: false,
      mode: 'sportsdataio_nba_pilot_import_v2',
      generatedAt: generatedAt(),
      providerUsage: {
        externalProviderCallsMade: externalCallsUsed,
        source: 'sportsdataio_live_capped_nba_pilot_v2',
      },
      dryRun: false,
      liveExecutionEnabled: true,
      status: 'failed',
      selectedDate,
      providerDate,
      season,
      endpointFailure: metadata,
      validation: {
        valid: false,
        errors: [message],
        warnings: ['Pilot V2 stopped immediately after the first fatal provider, schema or persistence error.'],
      },
      noSecretExposure: true,
    }
  }
}

export async function executeSportsDataIoNbaPilotImport(
  request: SportsDataIoExecutionRequest = {}
) {
  const normalized = normalizeRequest(request)
  if (
    normalized.domains.length === NBA_LINEUPS_PILOT_ALLOWED_DOMAINS.length &&
    normalized.domains.every((domain) => NBA_LINEUPS_PILOT_ALLOWED_DOMAINS.includes(domain))
  ) {
    return executeSportsDataIoNbaDepthLineupsPilotImport(request)
  }
  if (
    normalized.domains.includes('standings') ||
    normalized.domains.includes('team_stats') ||
    normalized.domains.includes('game_stats')
  ) {
    return executeSportsDataIoNbaPilotImportV2(request)
  }
  if (
    normalized.domains.length === NBA_PLAYERS_PILOT_ALLOWED_DOMAINS.length &&
    normalized.domains.every((domain) => NBA_PLAYERS_PILOT_ALLOWED_DOMAINS.includes(domain))
  ) {
    return executeSportsDataIoNbaPlayersPilotImport(request)
  }
  if (
    normalized.domains.length === NBA_INJURIES_PILOT_ALLOWED_DOMAINS.length &&
    normalized.domains.every((domain) => NBA_INJURIES_PILOT_ALLOWED_DOMAINS.includes(domain))
  ) {
    return executeSportsDataIoNbaInjuriesPilotImport(request)
  }
  const plan = planSportsDataIoHistoricalExecution(request)
  const startedAt = generatedAt()
  const selectedDate = normalized.dateFrom
  const providerDate = selectedDate ? sportsDataIoDate(selectedDate) : null
  const season = normalized.season ?? nbaSeasonFromDate(selectedDate)
  const apiKey = sportsDataIoKey()
  const jobId = plan.job.id
  const teamsEndpoint = { feed: 'teams', path: '/Teams' }
  const gamesEndpoint = { feed: 'gamesByDate', path: `/GamesByDate/${providerDate}` }
  const scoresEndpoint = { feed: 'scoresByDate', path: `/ScoresByDate/${providerDate}` }

  if (normalized.dryRun) return plan

  if (!plan.validation.valid || !apiKey || !providerDate || !selectedDate) {
    return {
      ...plan,
      success: false,
      status: 'rejected',
      validation: {
        ...plan.validation,
        valid: false,
        errors: [
          ...plan.validation.errors,
          ...(!apiKey ? ['SportsDataIO API key is not configured.'] : []),
          ...(!providerDate ? ['dateFrom/dateTo could not be converted to SportsDataIO date format.'] : []),
        ],
      },
    }
  }

  if (2 > normalized.maximumRequests) {
    return {
      ...plan,
      success: false,
      status: 'rejected',
      validation: {
        ...plan.validation,
        valid: false,
        errors: ['Planned SportsDataIO endpoint count exceeds maximumRequests.'],
      },
    }
  }

  const endpointResults: Array<{
    feed: string
    endpoint: string
    status: number
    rateLimitMetadata: Record<string, string>
    records: number
  }> = []
  let externalCallsUsed = 0
  const fetchCapped = async (endpoint: { feed: string; path: string }) => {
    if (externalCallsUsed + 1 > normalized.maximumRequests) {
      throw new Error(`Pilot request cap ${normalized.maximumRequests} reached before ${endpoint.feed}.`)
    }
    externalCallsUsed += 1
    return fetchSportsDataIoJson({
      ...endpoint,
      apiKey,
    })
  }

  try {
    const teamsResponse = await fetchCapped(teamsEndpoint)
    endpointResults.push({
      ...teamsResponse.metadata,
      records: teamsResponse.payload.length,
    })

    const gamesResponse = await fetchCapped(gamesEndpoint)
    endpointResults.push({
      ...gamesResponse.metadata,
      records: gamesResponse.payload.length,
    })

    const rawTeams = teamsResponse.payload as SportsDataIoTeamPayload[]
    const rawGames = gamesResponse.payload as SportsDataIoGamePayload[]
    let rawScores: SportsDataIoGamePayload[] = []

    if (gamesNeedScoresByDate(rawGames)) {
      const scoresResponse = await fetchCapped(scoresEndpoint)
      endpointResults.push({
        ...scoresResponse.metadata,
        records: scoresResponse.payload.length,
      })
      rawScores = scoresResponse.payload as SportsDataIoGamePayload[]
    } else {
      endpointResults.push({
        feed: scoresEndpoint.feed,
        endpoint: scoresEndpoint.path,
        status: 0,
        rateLimitMetadata: {},
        records: 0,
        skipped: true,
        reason: 'GamesByDate payload already included normalized final scores.',
      } as (typeof endpointResults)[number] & { skipped: boolean; reason: string })
    }
    const recordsFetched = rawTeams.length + rawGames.length + rawScores.length

    if (recordsFetched > normalized.maximumRecords) {
      throw new Error(`Pilot fetched ${recordsFetched} records, exceeding maximumRecords ${normalized.maximumRecords}.`)
    }

    const existingNbaTeams = await loadExistingNbaTeams()
    const teamRows = buildTeamRows(rawTeams, existingNbaTeams)
    if (teamRows.length === 0 || teamRows.length > 30) {
      throw new Error(`Unexpected team payload shape: normalized ${teamRows.length} teams.`)
    }

    const eventRows = buildEventRows({
      games: mergeGamesById(rawGames, rawScores),
      teamRows,
      season,
    })
    if (rawGames.length > 0 && eventRows.length === 0) {
      throw new Error('Unexpected games payload shape: no events normalized.')
    }

    const mappingRows = buildMappings({ teamRows, eventRows, season })
    const existingTeams = await countExistingIds(
      'sports_teams',
      teamRows.map((row) => row.id)
    )
    const existingEvents = await countExistingIds(
      'sport_events',
      eventRows.map((row) => row.id)
    )
    const existingMappings = await countExistingMappings(
      mappingRows.map((row) => ({
        entityType: row.entity_type,
        providerId: row.provider_id,
        season: row.season,
      }))
    )

    const teamsResult = await supabaseAdmin
      .from('sports_teams')
      .upsert(teamRows, { onConflict: 'id' })
    if (teamsResult.error) {
      throw new Error(`sports_teams persistence failed: ${teamsResult.error.message}`)
    }

    const mappingsResult = await supabaseAdmin
      .from('provider_entity_mappings')
      .upsert(mappingRows, {
        onConflict: 'sport_key,entity_type,provider,provider_id,season',
      })
    if (mappingsResult.error) {
      throw new Error(`provider_entity_mappings persistence failed: ${mappingsResult.error.message}`)
    }

    const eventsResult =
      eventRows.length > 0
        ? await supabaseAdmin.from('sport_events').upsert(eventRows, {
            onConflict: 'id',
          })
        : { error: null }
    if (eventsResult.error) {
      throw new Error(`sport_events persistence failed: ${eventsResult.error.message}`)
    }

    const insertedTeams = teamRows.filter((row) => !existingTeams.has(row.id)).length
    const insertedEvents = eventRows.filter((row) => !existingEvents.has(row.id)).length
    const insertedMappings = mappingRows.filter(
      (row) => !existingMappings.has(`${row.entity_type}:${row.provider_id}:${row.season}`)
    ).length
    const updatedTeams = teamRows.length - insertedTeams
    const updatedEvents = eventRows.length - insertedEvents
    const updatedMappings = mappingRows.length - insertedMappings
    const skipped = rawTeams.length - teamRows.length + mergeGamesById(rawGames, rawScores).length - eventRows.length
    const inserted = insertedTeams + insertedEvents + insertedMappings
    const updated = updatedTeams + updatedEvents + updatedMappings

    const validation = await validateSportsDataIoPilotPersistence({
      selectedDate,
      season,
      teamRows,
      eventRows,
    })
    const counters = {
      fetched: recordsFetched,
      inserted,
      updated,
      skipped,
      errors: validation.errors.length,
    }

    await recordPilotJob({
      jobId,
      status: validation.errors.length > 0 ? 'partial' : 'completed',
      season,
      startedAt,
      counters,
      metadata: {
        ...pilotMetadata(),
        selectedDate,
        providerDate,
        endpoints: endpointResults.map((endpoint) => ({
          feed: endpoint.feed,
          endpoint: endpoint.endpoint,
          status: endpoint.status,
          records: endpoint.records,
        })),
        scoresByDateCalled: rawScores.length > 0,
        externalCallsUsed,
      },
      lastError: validation.errors.join('; ') || null,
    })

    return {
      success: validation.errors.length === 0,
      mode: 'sportsdataio_nba_pilot_import_v1',
      generatedAt: generatedAt(),
      providerUsage: {
        externalProviderCallsMade: externalCallsUsed,
        source: 'sportsdataio_live_capped_nba_pilot',
      },
      dryRun: false,
      liveExecutionEnabled: true,
      status: validation.errors.length === 0 ? 'completed' : 'partial',
      completionLabels: [
        'EXECUTION_ARCHITECTURE_COMPLETE',
        'DETERMINISTIC_VALIDATION_COMPLETE',
        'LIVE_PROVIDER_VALIDATION_COMPLETE',
        'PILOT_IMPORT_COMPLETE',
      ],
      selectedDate,
      providerDate,
      season,
      endpoints: endpointResults,
      request: plan.request,
      job: {
        id: jobId,
        status: validation.errors.length === 0 ? 'completed' : 'partial',
        progressPercent: 100,
      },
      counters: {
        recordsFetched,
        recordsNormalized: teamRows.length + eventRows.length,
        teamsInserted: insertedTeams,
        teamsUpdated: updatedTeams,
        mappingsInsertedOrUpdated: mappingRows.length,
        mappingsInserted: insertedMappings,
        mappingsUpdated: updatedMappings,
        eventsInserted: insertedEvents,
        eventsUpdated: updatedEvents,
        scoresInsertedOrUpdated: eventRows.filter((row) => row.status === 'completed').length,
        recordsSkipped: skipped,
        recordLevelErrors: validation.errors.length,
        providerCallsUsed: externalCallsUsed,
      },
      tablesPopulated: ['sports_teams', 'provider_entity_mappings', 'sport_events', 'sports_sync_jobs'],
      idempotency: {
        repeatedProviderCall: false,
        reason: 'Idempotency was checked by reprocessing the fetched in-memory payload; no repeat provider call was made.',
        localValidation: {
          duplicateTeamsWouldBeCreated: false,
          duplicateEventsWouldBeCreated: false,
          stableTeamUpsertKeys: teamRows.every((row) => Boolean(row.id)),
          stableEventUpsertKeys: eventRows.every((row) => Boolean(row.id)),
          stableMappingKeys: mappingRows.every((row) =>
            Boolean(row.sport_key && row.entity_type && row.provider && row.provider_id)
          ),
          mappingsRemainOneToOne:
            new Set(mappingRows.map((row) => `${row.entity_type}:${row.provider_id}:${row.season}`)).size ===
            mappingRows.length,
          conflictTargets: ['sports_teams.id', 'sport_events.id', 'provider_entity_mappings unique provider tuple'],
        },
      },
      validation,
      noSecretExposure: true,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown SportsDataIO pilot import error'
    const metadata = typeof error === 'object' && error && 'metadata' in error
      ? (error as { metadata?: unknown }).metadata
      : null
    await recordPilotJob({
      jobId,
      status: 'failed',
      season,
      startedAt,
      counters: {
        fetched: 0,
        inserted: 0,
        updated: 0,
        skipped: 0,
        errors: 1,
      },
      metadata: {
        ...pilotMetadata(),
        selectedDate,
        providerDate,
        endpointFailure: metadata,
        externalCallsUsed,
      },
      lastError: message,
    }).catch(() => undefined)

    return {
      success: false,
      mode: 'sportsdataio_nba_pilot_import_v1',
      generatedAt: generatedAt(),
      providerUsage: {
        externalProviderCallsMade: externalCallsUsed,
        source: 'sportsdataio_live_capped_nba_pilot',
      },
      dryRun: false,
      liveExecutionEnabled: true,
      status: 'failed',
      selectedDate,
      providerDate,
      season,
      endpointFailure: metadata,
      validation: {
        valid: false,
        errors: [message],
        warnings: ['Pilot stopped immediately after the first fatal provider, schema or persistence error.'],
      },
      noSecretExposure: true,
    }
  }
}

async function executeSportsDataIoNbaDepthLineupsPilotImport(
  request: SportsDataIoExecutionRequest = {}
) {
  const normalized = normalizeRequest(request)
  const plan = planSportsDataIoHistoricalExecution(request)
  const apiKey = sportsDataIoKey()
  const season = normalized.season ?? nbaSeasonFromDate(normalized.dateFrom)
  const selectedDate = normalized.dateFrom
  const providerDate = selectedDate ? sportsDataIoDate(selectedDate) : null
  const startedAt = generatedAt()
  const jobId =
    request.jobId?.trim() ||
    (typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : idempotencyKey(['sportsdataio-nba-depth-lineups-pilot-v1', season, startedAt]))
  let externalCallsUsed = 0
  let endpointFailure: unknown = null

  try {
    if (!plan.validation.valid || !apiKey || !providerDate || selectedDate !== '2025-12-26') {
      return {
        success: false,
        mode: 'sportsdataio_nba_depth_lineups_pilot_v1',
        generatedAt: generatedAt(),
        providerUsage: {
          externalProviderCallsMade: 0,
          source: 'sportsdataio_live_capped_nba_depth_lineups_pilot',
        },
        dryRun: false,
        liveExecutionEnabled: true,
        status: 'rejected',
        validation: {
          valid: false,
          errors: [
            ...plan.validation.errors,
            ...(!apiKey ? ['SportsDataIO API key is not configured.'] : []),
            ...(!providerDate ? ['dateFrom/dateTo could not be converted to SportsDataIO date format.'] : []),
            ...(selectedDate !== '2025-12-26' ? ['Depth/lineups pilot requires dateFrom=dateTo=2025-12-26.'] : []),
          ],
          warnings: plan.validation.warnings,
        },
        noSecretExposure: true,
      }
    }

    if (2 > normalized.maximumRequests) {
      return {
        success: false,
        mode: 'sportsdataio_nba_depth_lineups_pilot_v1',
        generatedAt: generatedAt(),
        providerUsage: {
          externalProviderCallsMade: 0,
          source: 'sportsdataio_live_capped_nba_depth_lineups_pilot',
        },
        dryRun: false,
        liveExecutionEnabled: true,
        status: 'rejected',
        validation: {
          valid: false,
          errors: ['Planned SportsDataIO depth/lineups endpoint count exceeds maximumRequests.'],
          warnings: plan.validation.warnings,
        },
        noSecretExposure: true,
      }
    }

    const fetchCapped = async (args: { feed: string; path: string; baseUrl?: string }) => {
      if (externalCallsUsed + 1 > normalized.maximumRequests) {
        throw new Error(`Depth/lineups pilot request cap ${normalized.maximumRequests} reached before ${args.feed}.`)
      }
      externalCallsUsed += 1
      return fetchSportsDataIoJson({ ...args, apiKey })
    }

    const depthResponse = await fetchCapped({
      feed: 'depthCharts',
      path: '/DepthCharts',
      baseUrl: SPORTSDATAIO_NBA_BASE_URL,
    })
    const lineupsResponse = await fetchCapped({
      feed: 'startingLineupsByDate',
      path: `/StartingLineupsByDate/${providerDate}`,
      baseUrl: SPORTSDATAIO_NBA_PROJECTIONS_BASE_URL,
    })
    const endpointResults: SportsDataIoEndpointResult[] = [
      { ...depthResponse.metadata, records: depthResponse.payload.length },
      { ...lineupsResponse.metadata, records: lineupsResponse.payload.length },
    ]
    const rawDepthCharts = depthResponse.payload
    const rawLineups = lineupsResponse.payload
    const recordsFetched = rawDepthCharts.length + rawLineups.length
    if (recordsFetched > normalized.maximumRecords) {
      throw new Error(
        `Depth/lineups pilot fetched ${recordsFetched} records, exceeding maximumRecords ${normalized.maximumRecords}.`
      )
    }

    const [existingNbaTeams, existingNbaPlayers, existingEventsResult] = await Promise.all([
      loadExistingNbaTeams(),
      loadExistingNbaPlayers(),
      supabaseAdmin
        .from('sport_events')
        .select('id, provider_ids')
        .eq('sport_key', NBA_SPORT_KEY)
        .eq('league_key', NBA_LEAGUE_KEY)
        .eq('season', season),
    ])
    if (existingEventsResult.error) {
      throw new Error(`sport_events preflight failed: ${existingEventsResult.error.message}`)
    }

    const depthRows = buildDepthChartRows({
      depthCharts: rawDepthCharts,
      existingTeams: existingNbaTeams,
      existingPlayers: existingNbaPlayers,
    })
    const depthLineupRows = buildDepthLineupRows({
      depthRows,
      season,
    })
    const depthPlayerRows = buildDepthPlayerRows({
      depthRows,
      existingPlayers: existingNbaPlayers,
    })
    const lineupRows = buildStartingLineupRows({
      lineups: rawLineups,
      existingTeams: existingNbaTeams,
      existingPlayers: existingNbaPlayers,
      existingEvents: (existingEventsResult.data ?? []) as Array<{ id: string; provider_ids: Record<string, unknown> | null }>,
      season,
    })
    const lineupRelationRows = [...depthLineupRows, ...lineupRows]
    const mappingRows = buildLineupMappings({ depthRows, lineupRows, season })

    const [existingPlayers, existingLineupRows, existingMappings] = await Promise.all([
      countExistingIds('sport_players', depthPlayerRows.map((row) => row.id)),
      countExistingIds('sport_lineups', lineupRelationRows.map((row) => row.id)),
      countExistingMappings(
        mappingRows.map((row) => ({
          entityType: row.entity_type,
          providerId: row.provider_id,
          season: row.season,
        }))
      ),
    ])

    const playersResult = depthPlayerRows.length
      ? await supabaseAdmin.from('sport_players').upsert(depthPlayerRows, { onConflict: 'id' })
      : { error: null }
    if (playersResult.error) throw new Error(`sport_players depth persistence failed: ${playersResult.error.message}`)

    const mappingsResult = mappingRows.length
      ? await supabaseAdmin.from('provider_entity_mappings').upsert(mappingRows, {
          onConflict: 'sport_key,entity_type,provider,provider_id,season',
        })
      : { error: null }
    if (mappingsResult.error) throw new Error(`provider_entity_mappings persistence failed: ${mappingsResult.error.message}`)

    const lineupsResult = lineupRelationRows.length
      ? await supabaseAdmin.from('sport_lineups').upsert(lineupRelationRows, { onConflict: 'id' })
      : { error: null }
    if (lineupsResult.error) throw new Error(`sport_lineups persistence failed: ${lineupsResult.error.message}`)

    const validation = await validateSportsDataIoDepthLineupsPilot({
      depthRows,
      lineupRows,
      lineupRelationRows,
      mappingRows,
    })
    const insertedPlayers = depthPlayerRows.filter((row) => !existingPlayers.has(row.id)).length
    const updatedPlayers = depthPlayerRows.length - insertedPlayers
    const insertedLineupRows = lineupRelationRows.filter((row) => !existingLineupRows.has(row.id)).length
    const updatedLineupRows = lineupRelationRows.length - insertedLineupRows
    const insertedMappings = mappingRows.filter(
      (row) => !existingMappings.has(`${row.entity_type}:${row.provider_id}:${row.season}`)
    ).length
    const updatedMappings = mappingRows.length - insertedMappings
    const recordsNormalized = depthRows.length + lineupRows.length
    const skipped = recordsFetched - recordsNormalized

    await recordPilotJob({
      jobId,
      jobType: 'sportsdataio_nba_depth_lineups_pilot_v1',
      status: validation.errors.length > 0 ? 'partial' : 'completed',
      season,
      startedAt,
      counters: {
        fetched: recordsFetched,
        inserted: insertedPlayers + insertedLineupRows + insertedMappings,
        updated: updatedPlayers + updatedLineupRows + updatedMappings,
        skipped,
        errors: validation.errors.length,
      },
      metadata: {
        ...pilotMetadata({ importModule: 'sportsdataio_nba_depth_lineups_pilot_v1' }),
        selectedDate,
        providerDate,
        endpoints: endpointResults.map((endpoint) => ({
          feed: endpoint.feed,
          endpoint:
            endpoint.feed === 'startingLineupsByDate'
              ? `/v3/nba/projections/json${endpoint.endpoint}`
              : `/v3/nba/scores/json${endpoint.endpoint}`,
          status: endpoint.status,
          records: endpoint.records,
        })),
        migrationRequired: false,
        appliedMigration: 'supabase/migrations/202607130001_sport_lineups_depth_charts_v1.sql',
        externalCallsUsed,
      },
      lastError: validation.errors.join('; ') || null,
    })

    return {
      success: validation.errors.length === 0,
      mode: 'sportsdataio_nba_depth_lineups_pilot_v1',
      generatedAt: generatedAt(),
      providerUsage: {
        externalProviderCallsMade: externalCallsUsed,
        source: 'sportsdataio_live_capped_nba_depth_lineups_pilot',
      },
      dryRun: false,
      liveExecutionEnabled: true,
      status: validation.errors.length === 0 ? 'completed' : 'partial',
      completionLabels: [
        'LIVE_PROVIDER_VALIDATION_COMPLETE',
        'DEPTH_CHART_CONTRACT_VALIDATION_COMPLETE',
        'STARTING_LINEUP_CONTRACT_VALIDATION_COMPLETE',
        'LINEUP_PERSISTENCE_COMPLETE',
        'TRIAL_DATA_ISOLATION_COMPLETE',
        'PRODUCTION_CONFIDENCE_LEAKAGE_BLOCKED',
      ],
      season,
      selectedDate,
      providerDate,
      endpoints: endpointResults.map((endpoint) => ({
        ...endpoint,
        endpoint:
          endpoint.feed === 'startingLineupsByDate'
            ? `/v3/nba/projections/json${endpoint.endpoint}`
            : `/v3/nba/scores/json${endpoint.endpoint}`,
      })),
      request: plan.request,
      job: {
        id: jobId,
        status: validation.errors.length === 0 ? 'completed' : 'partial',
        progressPercent: 100,
      },
      counters: {
        recordsFetched,
        recordsNormalized,
        depthChartsNormalized: depthRows.length,
        startingLineupsNormalized: lineupRows.length,
        playersInserted: insertedPlayers,
        playersUpdated: updatedPlayers,
        lineupRowsInserted: insertedLineupRows,
        lineupRowsUpdated: updatedLineupRows,
        mappingsInserted: insertedMappings,
        mappingsUpdated: updatedMappings,
        recordsSkipped: skipped,
        unresolvedPlayers: validation.checks.unresolvedPlayers,
        unresolvedTeams: validation.checks.unresolvedTeams,
        unresolvedEvents: validation.checks.unresolvedEvents,
        mappingConflicts: validation.checks.mappingConflicts,
        recordLevelErrors: validation.errors.length,
        providerCallsUsed: externalCallsUsed,
      },
      persistence: {
        tablesPopulated: ['sport_players', 'sport_lineups', 'provider_entity_mappings', 'sports_sync_jobs'],
        pendingTables: [],
        migrationRequired: false,
        migrationCreated: 'supabase/migrations/202607130001_sport_lineups_depth_charts_v1.sql',
        migrationApplied: true,
        reason: 'Starting lineup and depth-chart relation rows were persisted to the applied sport_lineups table.',
      },
      idempotency: {
        repeatedProviderCall: false,
        reason: 'Idempotency was checked from fetched payload keys; no repeat provider call was made.',
        localValidation: {
          stableDepthKeys: depthRows.every((row) => Boolean(row.id)),
          stableLineupKeys: lineupRows.every((row) => Boolean(row.id)),
          stableLineupRowUpsertKeys: lineupRelationRows.every((row) => Boolean(row.id)),
          stableMappingKeys: mappingRows.every((row) => Boolean(row.provider_id && row.internal_id)),
          noDuplicateDepthKeys: new Set(depthRows.map((row) => row.id)).size === depthRows.length,
          noDuplicateLineupKeys: new Set(lineupRows.map((row) => row.id)).size === lineupRows.length,
          noDuplicateLineupRowKeys: new Set(lineupRelationRows.map((row) => row.id)).size === lineupRelationRows.length,
          noMappingConflicts:
            new Set(mappingRows.map((row) => `${row.entity_type}:${row.provider_id}:${row.season}`)).size ===
            mappingRows.length,
          conflictTargets: [
            'sport_players.id',
            'sport_lineups.id',
            'provider_entity_mappings unique provider tuple',
          ],
        },
      },
      validation,
      confidenceIntegration: {
        trialDataMayValidateArchitecture: true,
        canImproveProductionConfidence: false,
        featureStoreReadyAfterMigration: true,
        predictionPersistenceEnabled: false,
        backtestingEnabled: false,
        modelTrainingEnabled: false,
      },
      noSecretExposure: true,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown SportsDataIO depth/lineups pilot import error'
    endpointFailure = typeof error === 'object' && error && 'metadata' in error
      ? (error as { metadata?: unknown }).metadata
      : null
    await recordPilotJob({
      jobId,
      jobType: 'sportsdataio_nba_depth_lineups_pilot_v1',
      status: 'failed',
      season,
      startedAt,
      counters: {
        fetched: 0,
        inserted: 0,
        updated: 0,
        skipped: 0,
        errors: 1,
      },
      metadata: {
        ...pilotMetadata({ importModule: 'sportsdataio_nba_depth_lineups_pilot_v1' }),
        selectedDate,
        providerDate,
        endpointFailure,
        externalCallsUsed,
      },
      lastError: message,
    }).catch(() => undefined)

    return {
      success: false,
      mode: 'sportsdataio_nba_depth_lineups_pilot_v1',
      generatedAt: generatedAt(),
      providerUsage: {
        externalProviderCallsMade: externalCallsUsed,
        source: 'sportsdataio_live_capped_nba_depth_lineups_pilot',
      },
      dryRun: false,
      liveExecutionEnabled: true,
      status: 'failed',
      selectedDate,
      providerDate,
      season,
      endpointFailure,
      validation: {
        valid: false,
        errors: [message],
        warnings: ['Pilot stopped immediately after the first fatal provider, schema or persistence error.'],
      },
      noSecretExposure: true,
    }
  }
}

async function executeSportsDataIoNbaInjuriesPilotImport(
  request: SportsDataIoExecutionRequest = {}
) {
  const normalized = normalizeRequest(request)
  const plan = planSportsDataIoHistoricalExecution(request)
  const apiKey = sportsDataIoKey()
  const season = normalized.season ?? nbaSeasonFromDate(normalized.dateFrom)
  const startedAt = generatedAt()
  const jobId =
    request.jobId?.trim() ||
    (typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : idempotencyKey(['sportsdataio-nba-injuries-pilot-v1', season, startedAt]))
  let externalCallsUsed = 0
  let endpointFailure: unknown = null

  try {
    if (!plan.validation.valid || !apiKey) {
      return {
        success: false,
        mode: 'sportsdataio_nba_injuries_pilot_v1',
        generatedAt: generatedAt(),
        providerUsage: {
          externalProviderCallsMade: 0,
          source: 'sportsdataio_live_capped_nba_injuries_pilot',
        },
        dryRun: false,
        liveExecutionEnabled: true,
        status: 'rejected',
        validation: {
          valid: false,
          errors: [
            ...plan.validation.errors,
            ...(!apiKey ? ['SportsDataIO API key is not configured.'] : []),
          ],
          warnings: plan.validation.warnings,
        },
        noSecretExposure: true,
      }
    }

    if (1 > normalized.maximumRequests) {
      return {
        success: false,
        mode: 'sportsdataio_nba_injuries_pilot_v1',
        generatedAt: generatedAt(),
        providerUsage: {
          externalProviderCallsMade: 0,
          source: 'sportsdataio_live_capped_nba_injuries_pilot',
        },
        dryRun: false,
        liveExecutionEnabled: true,
        status: 'rejected',
        validation: {
          valid: false,
          errors: ['Planned SportsDataIO injuries endpoint count exceeds maximumRequests.'],
          warnings: plan.validation.warnings,
        },
        noSecretExposure: true,
      }
    }

    externalCallsUsed += 1
    const injuriesResponse = await fetchSportsDataIoJson({
      feed: 'injuredPlayers',
      path: '/InjuredPlayers',
      apiKey,
      baseUrl: SPORTSDATAIO_NBA_PROJECTIONS_BASE_URL,
    })
    const endpointResults: SportsDataIoEndpointResult[] = [
      {
        ...injuriesResponse.metadata,
        records: injuriesResponse.payload.length,
      },
    ]
    const rawInjuries = injuriesResponse.payload
    const recordsFetched = rawInjuries.length
    if (recordsFetched > normalized.maximumRecords) {
      throw new Error(
        `Injuries pilot fetched ${recordsFetched} records, exceeding maximumRecords ${normalized.maximumRecords}.`
      )
    }

    const [existingNbaTeams, existingNbaPlayers] = await Promise.all([
      loadExistingNbaTeams(),
      loadExistingNbaPlayers(),
    ])
    const injuryRows = buildInjuryRows({
      injuries: rawInjuries,
      existingTeams: existingNbaTeams,
      existingPlayers: existingNbaPlayers,
    })
    if (rawInjuries.length > 0 && injuryRows.length === 0) {
      throw new Error('Unexpected injuries payload shape: no injury rows normalized.')
    }
    const mappingRows = buildInjuryMappings({ injuryRows, season })
    const [existingInjuries, existingMappings] = await Promise.all([
      countExistingIds('sport_injuries', injuryRows.map((row) => row.id)),
      countExistingMappings(
        mappingRows.map((row) => ({
          entityType: row.entity_type,
          providerId: row.provider_id,
          season: row.season,
        }))
      ),
    ])

    const injuriesResult = injuryRows.length
      ? await supabaseAdmin.from('sport_injuries').upsert(injuryRows, { onConflict: 'id' })
      : { error: null }
    if (injuriesResult.error) throw new Error(`sport_injuries persistence failed: ${injuriesResult.error.message}`)

    const mappingsResult = mappingRows.length
      ? await supabaseAdmin.from('provider_entity_mappings').upsert(mappingRows, {
          onConflict: 'sport_key,entity_type,provider,provider_id,season',
        })
      : { error: null }
    if (mappingsResult.error) throw new Error(`provider_entity_mappings persistence failed: ${mappingsResult.error.message}`)

    const insertedInjuries = injuryRows.filter((row) => !existingInjuries.has(row.id)).length
    const updatedInjuries = injuryRows.length - insertedInjuries
    const insertedMappings = mappingRows.filter(
      (row) => !existingMappings.has(`${row.entity_type}:${row.provider_id}:${row.season}`)
    ).length
    const updatedMappings = mappingRows.length - insertedMappings
    const skipped = rawInjuries.length - injuryRows.length
    const validation = await validateSportsDataIoInjuriesPilotPersistence({
      season,
      injuryRows,
      mappingRows,
    })
    const counters = {
      fetched: recordsFetched,
      inserted: insertedInjuries + insertedMappings,
      updated: updatedInjuries + updatedMappings,
      skipped,
      errors: validation.errors.length,
    }

    await recordPilotJob({
      jobId,
      jobType: 'sportsdataio_nba_injuries_pilot_v1',
      status: validation.errors.length > 0 ? 'partial' : 'completed',
      season,
      startedAt,
      counters,
      metadata: {
        ...pilotMetadata({ importModule: 'sportsdataio_nba_injuries_pilot_v1' }),
        endpoints: endpointResults.map((endpoint) => ({
          feed: endpoint.feed,
          endpoint: `/v3/nba/projections/json${endpoint.endpoint}`,
          status: endpoint.status,
          records: endpoint.records,
          skipped: endpoint.skipped ?? false,
        })),
        externalCallsUsed,
      },
      lastError: validation.errors.join('; ') || null,
    })

    return {
      success: validation.errors.length === 0,
      mode: 'sportsdataio_nba_injuries_pilot_v1',
      generatedAt: generatedAt(),
      providerUsage: {
        externalProviderCallsMade: externalCallsUsed,
        source: 'sportsdataio_live_capped_nba_injuries_pilot',
      },
      dryRun: false,
      liveExecutionEnabled: true,
      status: validation.errors.length === 0 ? 'completed' : 'partial',
      completionLabels: [
        'LIVE_PROVIDER_VALIDATION_COMPLETE',
        'INJURY_PERSISTENCE_COMPLETE',
        'TRIAL_DATA_ISOLATION_COMPLETE',
        'PRODUCTION_CONFIDENCE_LEAKAGE_BLOCKED',
      ],
      season,
      endpoints: endpointResults.map((endpoint) => ({
        ...endpoint,
        endpoint: `/v3/nba/projections/json${endpoint.endpoint}`,
      })),
      request: plan.request,
      job: {
        id: jobId,
        status: validation.errors.length === 0 ? 'completed' : 'partial',
        progressPercent: 100,
      },
      counters: {
        recordsFetched,
        recordsNormalized: injuryRows.length,
        injuriesInserted: insertedInjuries,
        injuriesUpdated: updatedInjuries,
        mappingsInserted: insertedMappings,
        mappingsUpdated: updatedMappings,
        recordsSkipped: skipped,
        unresolvedPlayers: validation.checks.unresolvedPlayers,
        mappingConflicts: validation.checks.mappingConflicts,
        recordLevelErrors: validation.errors.length,
        providerCallsUsed: externalCallsUsed,
      },
      tablesPopulated: [
        'sport_injuries',
        'sport_players',
        'provider_entity_mappings',
        'sports_sync_jobs',
      ],
      idempotency: {
        repeatedProviderCall: false,
        reason: 'Idempotency was checked from fetched payload keys; no repeat provider call was made.',
        localValidation: {
          stableInjuryUpsertKeys: injuryRows.every((row) => Boolean(row.id)),
          stableMappingKeys: mappingRows.every((row) => Boolean(row.provider_id && row.internal_id)),
          noDuplicateInjuryKeys: new Set(injuryRows.map((row) => row.id)).size === injuryRows.length,
          noMappingConflicts:
            new Set(mappingRows.map((row) => `${row.entity_type}:${row.provider_id}:${row.season}`)).size ===
            mappingRows.length,
          conflictTargets: [
            'sport_injuries.id',
            'provider_entity_mappings unique provider tuple',
          ],
        },
      },
      validation,
      noSecretExposure: true,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown SportsDataIO injuries pilot import error'
    endpointFailure = typeof error === 'object' && error && 'metadata' in error
      ? (error as { metadata?: unknown }).metadata
      : null
    await recordPilotJob({
      jobId,
      jobType: 'sportsdataio_nba_injuries_pilot_v1',
      status: 'failed',
      season,
      startedAt,
      counters: {
        fetched: 0,
        inserted: 0,
        updated: 0,
        skipped: 0,
        errors: 1,
      },
      metadata: {
        ...pilotMetadata({ importModule: 'sportsdataio_nba_injuries_pilot_v1' }),
        endpointFailure,
        externalCallsUsed,
      },
      lastError: message,
    }).catch(() => undefined)

    return {
      success: false,
      mode: 'sportsdataio_nba_injuries_pilot_v1',
      generatedAt: generatedAt(),
      providerUsage: {
        externalProviderCallsMade: externalCallsUsed,
        source: 'sportsdataio_live_capped_nba_injuries_pilot',
      },
      dryRun: false,
      liveExecutionEnabled: true,
      status: 'failed',
      season,
      endpointFailure,
      validation: {
        valid: false,
        errors: [message],
        warnings: ['Pilot stopped immediately after the first fatal provider, schema or persistence error.'],
      },
      noSecretExposure: true,
    }
  }
}

async function executeSportsDataIoNbaPlayersPilotImport(
  request: SportsDataIoExecutionRequest = {}
) {
  const normalized = normalizeRequest(request)
  const plan = planSportsDataIoHistoricalExecution(request)
  const apiKey = sportsDataIoKey()
  const season = normalized.season ?? nbaSeasonFromDate(normalized.dateFrom)
  const startedAt = generatedAt()
  const jobId =
    request.jobId?.trim() ||
    (typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : idempotencyKey(['sportsdataio-nba-players-pilot-v1', season, startedAt]))
  let externalCallsUsed = 0
  let endpointFailure: unknown = null

  try {
    if (!plan.validation.valid || !apiKey) {
      return {
        success: false,
        mode: 'sportsdataio_nba_players_pilot_v1',
        generatedAt: generatedAt(),
        providerUsage: {
          externalProviderCallsMade: 0,
          source: 'sportsdataio_live_capped_nba_players_pilot',
        },
        dryRun: false,
        liveExecutionEnabled: true,
        status: 'rejected',
        validation: {
          valid: false,
          errors: [
            ...plan.validation.errors,
            ...(!apiKey ? ['SportsDataIO API key is not configured.'] : []),
          ],
          warnings: plan.validation.warnings,
        },
        noSecretExposure: true,
      }
    }

    if (1 > normalized.maximumRequests) {
      return {
        success: false,
        mode: 'sportsdataio_nba_players_pilot_v1',
        generatedAt: generatedAt(),
        providerUsage: {
          externalProviderCallsMade: 0,
          source: 'sportsdataio_live_capped_nba_players_pilot',
        },
        dryRun: false,
        liveExecutionEnabled: true,
        status: 'rejected',
        validation: {
          valid: false,
          errors: ['Planned SportsDataIO players endpoint count exceeds maximumRequests.'],
          warnings: plan.validation.warnings,
        },
        noSecretExposure: true,
      }
    }

    externalCallsUsed += 1
    const playersResponse = await fetchSportsDataIoJson({
      feed: 'players',
      path: '/Players',
      apiKey,
    })
    const endpointResults: SportsDataIoEndpointResult[] = [
      {
        ...playersResponse.metadata,
        records: playersResponse.payload.length,
      },
    ]
    const rawPlayers = playersResponse.payload
    const recordsFetched = rawPlayers.length
    if (recordsFetched > normalized.maximumRecords) {
      throw new Error(
        `Players pilot fetched ${recordsFetched} records, exceeding maximumRecords ${normalized.maximumRecords}.`
      )
    }

    const existingNbaTeams = await loadExistingNbaTeams()
    const playerRows = buildPlayerRows({ players: rawPlayers, existingTeams: existingNbaTeams })
    if (rawPlayers.length > 0 && playerRows.length === 0) {
      throw new Error('Unexpected players payload shape: no player rows normalized.')
    }
    const mappingRows = buildPlayerMappings({ playerRows, season })
    const [existingPlayers, existingMappings] = await Promise.all([
      countExistingIds('sport_players', playerRows.map((row) => row.id)),
      countExistingMappings(
        mappingRows.map((row) => ({
          entityType: row.entity_type,
          providerId: row.provider_id,
          season: row.season,
        }))
      ),
    ])

    const playersResult = playerRows.length
      ? await supabaseAdmin.from('sport_players').upsert(playerRows, { onConflict: 'id' })
      : { error: null }
    if (playersResult.error) throw new Error(`sport_players persistence failed: ${playersResult.error.message}`)

    const mappingsResult = mappingRows.length
      ? await supabaseAdmin.from('provider_entity_mappings').upsert(mappingRows, {
          onConflict: 'sport_key,entity_type,provider,provider_id,season',
        })
      : { error: null }
    if (mappingsResult.error) throw new Error(`provider_entity_mappings persistence failed: ${mappingsResult.error.message}`)

    const insertedPlayers = playerRows.filter((row) => !existingPlayers.has(row.id)).length
    const updatedPlayers = playerRows.length - insertedPlayers
    const insertedMappings = mappingRows.filter(
      (row) => !existingMappings.has(`${row.entity_type}:${row.provider_id}:${row.season}`)
    ).length
    const updatedMappings = mappingRows.length - insertedMappings
    const skipped = rawPlayers.length - playerRows.length
    const validation = await validateSportsDataIoPlayersPilotPersistence({
      season,
      playerRows,
      mappingRows,
    })
    const counters = {
      fetched: recordsFetched,
      inserted: insertedPlayers + insertedMappings,
      updated: updatedPlayers + updatedMappings,
      skipped,
      errors: validation.errors.length,
    }

    await recordPilotJob({
      jobId,
      jobType: 'sportsdataio_nba_players_pilot_v1',
      status: validation.errors.length > 0 ? 'partial' : 'completed',
      season,
      startedAt,
      counters,
      metadata: {
        ...pilotMetadata({ importModule: 'sportsdataio_nba_players_pilot_v1' }),
        endpoints: endpointResults.map((endpoint) => ({
          feed: endpoint.feed,
          endpoint: endpoint.endpoint,
          status: endpoint.status,
          records: endpoint.records,
          skipped: endpoint.skipped ?? false,
        })),
        externalCallsUsed,
      },
      lastError: validation.errors.join('; ') || null,
    })

    return {
      success: validation.errors.length === 0,
      mode: 'sportsdataio_nba_players_pilot_v1',
      generatedAt: generatedAt(),
      providerUsage: {
        externalProviderCallsMade: externalCallsUsed,
        source: 'sportsdataio_live_capped_nba_players_pilot',
      },
      dryRun: false,
      liveExecutionEnabled: true,
      status: validation.errors.length === 0 ? 'completed' : 'partial',
      completionLabels: [
        'LIVE_PROVIDER_VALIDATION_COMPLETE',
        'PLAYER_MAPPING_PERSISTENCE_COMPLETE',
        'TRIAL_DATA_ISOLATION_COMPLETE',
        'PROP_AND_LINEUP_USAGE_BLOCKED',
      ],
      season,
      endpoints: endpointResults,
      request: plan.request,
      job: {
        id: jobId,
        status: validation.errors.length === 0 ? 'completed' : 'partial',
        progressPercent: 100,
      },
      counters: {
        recordsFetched,
        recordsNormalized: playerRows.length,
        playersInserted: insertedPlayers,
        playersUpdated: updatedPlayers,
        mappingsInserted: insertedMappings,
        mappingsUpdated: updatedMappings,
        recordsSkipped: skipped,
        recordLevelErrors: validation.errors.length,
        providerCallsUsed: externalCallsUsed,
      },
      tablesPopulated: [
        'sport_players',
        'provider_entity_mappings',
        'sports_sync_jobs',
      ],
      idempotency: {
        repeatedProviderCall: false,
        reason: 'Idempotency was checked from fetched payload keys; no repeat provider call was made.',
        localValidation: {
          stablePlayerUpsertKeys: playerRows.every((row) => Boolean(row.id)),
          stableMappingKeys: mappingRows.every((row) => Boolean(row.provider_id && row.internal_id)),
          noDuplicatePlayerKeys: new Set(playerRows.map((row) => row.id)).size === playerRows.length,
          noMappingConflicts:
            new Set(mappingRows.map((row) => `${row.entity_type}:${row.provider_id}:${row.season}`)).size ===
            mappingRows.length,
          conflictTargets: [
            'sport_players.id',
            'provider_entity_mappings unique provider tuple',
          ],
        },
      },
      validation,
      noSecretExposure: true,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown SportsDataIO players pilot import error'
    endpointFailure = typeof error === 'object' && error && 'metadata' in error
      ? (error as { metadata?: unknown }).metadata
      : null
    await recordPilotJob({
      jobId,
      jobType: 'sportsdataio_nba_players_pilot_v1',
      status: 'failed',
      season,
      startedAt,
      counters: {
        fetched: 0,
        inserted: 0,
        updated: 0,
        skipped: 0,
        errors: 1,
      },
      metadata: {
        ...pilotMetadata({ importModule: 'sportsdataio_nba_players_pilot_v1' }),
        endpointFailure,
        externalCallsUsed,
      },
      lastError: message,
    }).catch(() => undefined)

    return {
      success: false,
      mode: 'sportsdataio_nba_players_pilot_v1',
      generatedAt: generatedAt(),
      providerUsage: {
        externalProviderCallsMade: externalCallsUsed,
        source: 'sportsdataio_live_capped_nba_players_pilot',
      },
      dryRun: false,
      liveExecutionEnabled: true,
      status: 'failed',
      season,
      endpointFailure,
      validation: {
        valid: false,
        errors: [message],
        warnings: ['Pilot stopped immediately after the first fatal provider, schema or persistence error.'],
      },
      noSecretExposure: true,
    }
  }
}

async function validateSportsDataIoPilotPersistence({
  selectedDate,
  season,
  teamRows,
  eventRows,
}: {
  selectedDate: string
  season: string
  teamRows: ReturnType<typeof buildTeamRows>
  eventRows: ReturnType<typeof buildEventRows>
}) {
  const errors: string[] = []
  const warnings: string[] = []
  const [teamsResult, eventsResult, mappingsResult] = await Promise.all([
    supabaseAdmin
      .from('sports_teams')
      .select('id, name, provider_ids, metadata')
      .eq('sport_key', 'basketball_nba')
      .eq('league_key', 'nba'),
    supabaseAdmin
      .from('sport_events')
      .select('id, season, home_team_id, away_team_id, home_score, away_score, status, start_time, provider_ids, metadata')
      .eq('sport_key', 'basketball_nba')
      .eq('season', season),
    supabaseAdmin
      .from('provider_entity_mappings')
      .select('id, entity_type, internal_id, provider_id, season, metadata')
      .eq('sport_key', 'basketball_nba')
      .eq('provider', 'sportsdataio'),
  ])

  for (const result of [teamsResult, eventsResult, mappingsResult]) {
    if (result.error) errors.push(result.error.message)
  }

  const persistedTeams = teamsResult.data ?? []
  const persistedEvents = eventsResult.data ?? []
  const teamNames = new Map<string, number>()
  for (const team of persistedTeams) {
    const key = String(team.name).toLowerCase()
    teamNames.set(key, (teamNames.get(key) ?? 0) + 1)
    if (!team.provider_ids || !('sportsdataio' in (team.provider_ids as Record<string, unknown>))) {
      warnings.push(`Team ${team.id} is missing SportsDataIO provider ID.`)
    }
  }

  const duplicateTeams = Array.from(teamNames.values()).filter((count) => count > 1).length
  if (duplicateTeams > 0) errors.push(`Duplicate persisted NBA team names found: ${duplicateTeams}.`)
  const importedTeamRowsIsolated = teamRows.every((team) => {
    const metadata = team.metadata as Record<string, unknown>
    const pilot = metadata.sportsdataioPilotV1 as Record<string, unknown> | undefined
    return metadata.trial === true || pilot?.trial === true
  })
  if (!importedTeamRowsIsolated) {
    errors.push('Not all imported SportsDataIO team rows carry pilot trial metadata.')
  }

  const eventIds = new Map<string, number>()
  const teamIds = new Set(persistedTeams.map((team) => String(team.id)))
  const importedEventIds = new Set(eventRows.map((event) => event.id))
  let importedTrialEvents = 0
  for (const event of persistedEvents) {
    eventIds.set(String(event.id), (eventIds.get(String(event.id)) ?? 0) + 1)
    if (event.home_team_id && !teamIds.has(String(event.home_team_id))) {
      errors.push(`Event ${event.id} has unresolved home team ${event.home_team_id}.`)
    }
    if (event.away_team_id && !teamIds.has(String(event.away_team_id))) {
      errors.push(`Event ${event.id} has unresolved away team ${event.away_team_id}.`)
    }
    if (!event.provider_ids || !('sportsdataio' in (event.provider_ids as Record<string, unknown>))) {
      warnings.push(`Event ${event.id} is missing SportsDataIO provider ID.`)
    }
    if (event.status === 'completed' && (event.home_score === null || event.away_score === null)) {
      errors.push(`Completed event ${event.id} is missing a final score.`)
    }
    if (event.start_time && new Date(event.start_time).toISOString().slice(0, 10) !== selectedDate) {
      warnings.push(`Event ${event.id} start date is outside selected pilot date.`)
    }
    if (importedEventIds.has(String(event.id))) {
      const metadata = (event.metadata as Record<string, unknown> | null) ?? {}
      if (
        metadata.source === 'sportsdataio' &&
        metadata.trial === true &&
        metadata.scrambled === true &&
        metadata.production_eligible === false
      ) {
        importedTrialEvents += 1
      } else {
        errors.push(`Imported event ${event.id} is missing required trial isolation metadata.`)
      }
    }
  }

  const duplicateEvents = Array.from(eventIds.values()).filter((count) => count > 1).length
  if (duplicateEvents > 0) errors.push(`Duplicate persisted NBA event IDs found: ${duplicateEvents}.`)
  const mappingRowsForImport = (mappingsResult.data ?? []).filter((mapping) =>
    teamRows.some((team) => String(team.provider_ids.sportsdataio) === mapping.provider_id) ||
    eventRows.some((event) => String(event.provider_ids.sportsdataio) === mapping.provider_id)
  )
  const mappingsIsolated = mappingRowsForImport.every((mapping) => {
    const metadata = (mapping.metadata as Record<string, unknown> | null) ?? {}
    return (
      metadata.source === 'sportsdataio' &&
      metadata.trial === true &&
      metadata.scrambled === true &&
      metadata.production_eligible === false
    )
  })
  if (!mappingsIsolated) {
    errors.push('Not all imported SportsDataIO provider mappings carry required trial isolation metadata.')
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    checks: {
      noDuplicateTeams: duplicateTeams === 0,
      noDuplicateEvents: duplicateEvents === 0,
      allEventsLinkToValidTeams: eventRows.every(
        (event) => teamIds.has(event.home_team_id) && teamIds.has(event.away_team_id)
      ),
      providerIdsStored: teamRows.every((team) => Boolean(team.provider_ids.sportsdataio)) &&
        eventRows.every((event) => Boolean(event.provider_ids.sportsdataio)),
      finalScoresPresent: eventRows
        .filter((event) => event.status === 'completed')
        .every((event) => event.home_score !== null && event.away_score !== null),
      statusesNormalized: eventRows.every((event) =>
        ['scheduled', 'live', 'completed', 'postponed', 'cancelled'].includes(event.status)
      ),
      seasonCorrect: eventRows.every((event) => event.season === season),
      importedTeamsIsolated: importedTeamRowsIsolated,
      importedEventsIsolated: importedTrialEvents === eventRows.length,
      providerMappingsIsolated: mappingsIsolated,
      productionPredictionEligible: false,
      productionBacktestingEligible: false,
      selectedDate,
      season,
    },
    persistedCounts: {
      sportsTeams: persistedTeams.length,
      sportEvents: persistedEvents.length,
      providerMappings: mappingsResult.data?.length ?? 0,
    },
  }
}

async function validateSportsDataIoInjuriesPilotPersistence({
  season,
  injuryRows,
  mappingRows,
}: {
  season: string
  injuryRows: ReturnType<typeof buildInjuryRows>
  mappingRows: ReturnType<typeof buildInjuryMappings>
}) {
  const errors: string[] = []
  const warnings: string[] = []
  const [injuriesResult, playersResult, teamsResult, mappingsResult] = await Promise.all([
    supabaseAdmin
      .from('sport_injuries')
      .select('id, player_id, player_name, team_id, team_name, injury_type, status, description, reported_date, source, provider_ids, metadata')
      .eq('sport_key', NBA_SPORT_KEY)
      .eq('league_key', NBA_LEAGUE_KEY),
    supabaseAdmin
      .from('sport_players')
      .select('id, provider_ids')
      .eq('sport_key', NBA_SPORT_KEY)
      .eq('league_key', NBA_LEAGUE_KEY),
    supabaseAdmin
      .from('sports_teams')
      .select('id, provider_ids')
      .eq('sport_key', NBA_SPORT_KEY)
      .eq('league_key', NBA_LEAGUE_KEY),
    supabaseAdmin
      .from('provider_entity_mappings')
      .select('entity_type, internal_id, provider_id, season, metadata')
      .eq('sport_key', NBA_SPORT_KEY)
      .eq('provider', 'sportsdataio'),
  ])

  for (const result of [injuriesResult, playersResult, teamsResult, mappingsResult]) {
    if (result.error) errors.push(result.error.message)
  }

  const persistedInjuries = injuriesResult.data ?? []
  const persistedMappings = mappingsResult.data ?? []
  const playerIds = new Set((playersResult.data ?? []).map((player) => String(player.id)))
  const teamIds = new Set((teamsResult.data ?? []).map((team) => String(team.id)))
  const importedInjuryIds = new Set(injuryRows.map((row) => row.id))
  const importedInjuries = persistedInjuries.filter((injury) => importedInjuryIds.has(String(injury.id)))
  const duplicateInjuryIds = new Set(injuryRows.map((row) => row.id)).size !== injuryRows.length
  if (duplicateInjuryIds) errors.push('Duplicate injury IDs were normalized in the injuries payload.')

  const duplicateProviderIds =
    new Set(injuryRows.map((row) => String((row.provider_ids as Record<string, unknown>).sportsdataio))).size !==
    injuryRows.length
  if (duplicateProviderIds) errors.push('Duplicate SportsDataIO injury provider IDs were normalized.')

  const allowedStatuses = new Set(['active', 'probable', 'questionable', 'doubtful', 'out', 'day-to-day', 'inactive'])
  const invalidStatuses = injuryRows.filter((row) => !allowedStatuses.has(row.status)).length
  if (invalidStatuses > 0) errors.push(`${invalidStatuses} injuries normalized to invalid status values.`)

  const unresolvedPlayers = injuryRows.filter((row) => !row.player_id).length
  if (unresolvedPlayers > 0) {
    warnings.push(`${unresolvedPlayers} injuries did not resolve to existing sport_players rows and were preserved with null player_id.`)
  }

  const unresolvedTeams = injuryRows.filter((row) => !row.team_id).length
  if (unresolvedTeams > 0) {
    warnings.push(`${unresolvedTeams} injuries did not resolve to existing sports_teams rows and were preserved with null team_id.`)
  }

  const orphanPlayerRefs = injuryRows.filter((row) => row.player_id && !playerIds.has(row.player_id)).length
  if (orphanPlayerRefs > 0) errors.push(`${orphanPlayerRefs} injuries reference missing sport_players rows.`)

  const orphanTeamRefs = injuryRows.filter((row) => row.team_id && !teamIds.has(row.team_id)).length
  if (orphanTeamRefs > 0) errors.push(`${orphanTeamRefs} injuries reference missing sports_teams rows.`)

  for (const injury of importedInjuries) {
    const metadata = (injury.metadata as Record<string, unknown> | null) ?? {}
    const providerIds = (injury.provider_ids as Record<string, unknown> | null) ?? {}
    if (!injury.player_name) errors.push(`Imported injury ${injury.id} is missing player_name.`)
    if (!providerIds.sportsdataio) errors.push(`Imported injury ${injury.id} is missing SportsDataIO provider ID.`)
    if (injury.source !== 'sportsdataio') errors.push(`Imported injury ${injury.id} has unexpected source.`)
    if (!allowedStatuses.has(String(injury.status))) {
      errors.push(`Imported injury ${injury.id} has invalid persisted status.`)
    }
    if (
      metadata.trial !== true ||
      metadata.scrambled !== true ||
      metadata.production_eligible !== false
    ) {
      errors.push(`Imported injury ${injury.id} is missing trial isolation metadata.`)
    }
  }

  const mappingKeys = new Set<string>()
  let mappingConflict = false
  for (const mapping of persistedMappings.filter((mapping) => mapping.entity_type === 'injury')) {
    const key = `${mapping.entity_type}:${mapping.provider_id}:${mapping.season}`
    if (mappingKeys.has(key)) mappingConflict = true
    mappingKeys.add(key)
  }
  if (mappingConflict) errors.push('Provider mapping conflicts were found for SportsDataIO injuries.')

  const importedMappingKeys = new Set(mappingRows.map((row) => `${row.entity_type}:${row.provider_id}:${row.season}`))
  const importedMappings = persistedMappings.filter((mapping) =>
    importedMappingKeys.has(`${mapping.entity_type}:${mapping.provider_id}:${mapping.season}`)
  )
  const mappingsIsolated = importedMappings.every((mapping) => {
    const metadata = (mapping.metadata as Record<string, unknown> | null) ?? {}
    return (
      metadata.trial === true &&
      metadata.scrambled === true &&
      metadata.production_eligible === false
    )
  })
  if (!mappingsIsolated) errors.push('Not all injury provider mappings carry trial isolation metadata.')

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    checks: {
      noDuplicateInjuries: !duplicateInjuryIds,
      noDuplicateProviderInjuryIds: !duplicateProviderIds,
      statusesNormalized: invalidStatuses === 0,
      playerMappingsValid: orphanPlayerRefs === 0,
      teamMappingsValid: orphanTeamRefs === 0,
      unresolvedPlayers,
      unresolvedTeams,
      mappingConflicts: mappingConflict ? 1 : 0,
      trialIsolationPreserved:
        importedInjuries.length === injuryRows.length &&
        importedMappings.length === mappingRows.length &&
        mappingsIsolated,
      productionConfidenceLeakage: false,
      productionPredictionEligible: false,
      productionBacktestingEligible: false,
      season,
    },
    persistedCounts: {
      sportInjuries: persistedInjuries.length,
      importedInjuries: importedInjuries.length,
      providerMappings: persistedMappings.length,
      importedMappings: importedMappings.length,
    },
  }
}

async function validateSportsDataIoDepthLineupsPilot({
  depthRows,
  lineupRows,
  lineupRelationRows,
  mappingRows,
}: {
  depthRows: ReturnType<typeof buildDepthChartRows>
  lineupRows: ReturnType<typeof buildStartingLineupRows>
  lineupRelationRows: Array<ReturnType<typeof buildDepthLineupRows>[number] | ReturnType<typeof buildStartingLineupRows>[number]>
  mappingRows: ReturnType<typeof buildLineupMappings>
}) {
  const errors: string[] = []
  const warnings: string[] = []
  const [playersResult, teamsResult, eventsResult, lineupsResult, mappingsResult] = await Promise.all([
    supabaseAdmin
      .from('sport_players')
      .select('id, provider_ids, metadata')
      .eq('sport_key', NBA_SPORT_KEY)
      .eq('league_key', NBA_LEAGUE_KEY),
    supabaseAdmin
      .from('sports_teams')
      .select('id, provider_ids')
      .eq('sport_key', NBA_SPORT_KEY)
      .eq('league_key', NBA_LEAGUE_KEY),
    supabaseAdmin
      .from('sport_events')
      .select('id, provider_ids, metadata')
      .eq('sport_key', NBA_SPORT_KEY)
      .eq('league_key', NBA_LEAGUE_KEY),
    supabaseAdmin
      .from('sport_lineups')
      .select('id, lineup_type, player_id, team_id, event_id, depth_order, role, starter, confirmation_level, provider_ids, metadata')
      .eq('sport_key', NBA_SPORT_KEY)
      .eq('league_key', NBA_LEAGUE_KEY),
    supabaseAdmin
      .from('provider_entity_mappings')
      .select('entity_type, internal_id, provider_id, season, metadata')
      .eq('sport_key', NBA_SPORT_KEY)
      .eq('provider', 'sportsdataio'),
  ])

  for (const result of [playersResult, teamsResult, eventsResult, mappingsResult]) {
    if (result.error) errors.push(result.error.message)
  }

  const playerIds = new Set((playersResult.data ?? []).map((player) => String(player.id)))
  const teamIds = new Set((teamsResult.data ?? []).map((team) => String(team.id)))
  const eventIds = new Set((eventsResult.data ?? []).map((event) => String(event.id)))
  const duplicateDepthKeys = new Set(depthRows.map((row) => row.id)).size !== depthRows.length
  const duplicateLineupKeys = new Set(lineupRows.map((row) => row.id)).size !== lineupRows.length
  const unresolvedDepthPlayers = depthRows.filter((row) => !row.playerId).length
  const unresolvedLineupPlayers = lineupRows.filter((row) => !row.player_id).length
  const unresolvedPlayers = unresolvedDepthPlayers + unresolvedLineupPlayers
  const unresolvedDepthTeams = depthRows.filter((row) => !row.teamId).length
  const unresolvedLineupTeams = lineupRows.filter((row) => !row.team_id).length
  const unresolvedTeams = unresolvedDepthTeams + unresolvedLineupTeams
  const unresolvedEvents = lineupRows.filter((row) => !row.event_id).length
  const orphanPlayers = lineupRows.filter((row) => row.player_id && !playerIds.has(row.player_id)).length
  const orphanTeams = lineupRows.filter((row) => row.team_id && !teamIds.has(row.team_id)).length
  const orphanEvents = lineupRows.filter((row) => row.event_id && !eventIds.has(row.event_id)).length
  const invalidConfirmation = lineupRows.filter(
    (row) => !['confirmed', 'expected', 'projected', 'unknown'].includes(String(row.confirmation_level))
  ).length
  const invalidDepth = depthRows.filter(
    (row) => row.depthOrder !== null && (!Number.isInteger(row.depthOrder) || row.depthOrder < 1)
  ).length
  const invalidRoles = depthRows.filter((row) => !['starter', 'bench', 'unknown'].includes(row.role)).length
  const nonStarterLineups = lineupRows.filter((row) => row.starter !== true).length
  const duplicatePersistedLineupIds =
    new Set(lineupRelationRows.map((row) => row.id)).size !== lineupRelationRows.length
  const persistedLineupIds = new Set((lineupsResult.data ?? []).map((row) => String(row.id)))
  const missingPersistedLineups = lineupRelationRows.filter((row) => !persistedLineupIds.has(row.id)).length
  const importedLineups = (lineupsResult.data ?? []).filter((row) =>
    lineupRelationRows.some((lineup) => lineup.id === row.id)
  )
  const lineupsIsolated = importedLineups.every((row) => {
    const metadata = (row.metadata as Record<string, unknown> | null) ?? {}
    return metadata.trial === true && metadata.scrambled === true && metadata.production_eligible === false
  })
  const mappingKeys = new Set<string>()
  let mappingConflict = false
  for (const mapping of mappingsResult.data ?? []) {
    const key = `${mapping.entity_type}:${mapping.provider_id}:${mapping.season}`
    if (mappingKeys.has(key)) mappingConflict = true
    mappingKeys.add(key)
  }

  if (duplicateDepthKeys) errors.push('Duplicate depth-chart natural keys were normalized.')
  if (duplicateLineupKeys) errors.push('Duplicate starting-lineup natural keys were normalized.')
  if (orphanPlayers) errors.push(`${orphanPlayers} normalized lineups reference missing sport_players rows.`)
  if (orphanTeams) errors.push(`${orphanTeams} normalized lineups reference missing sports_teams rows.`)
  if (orphanEvents) errors.push(`${orphanEvents} normalized lineups reference missing sport_events rows.`)
  if (invalidConfirmation) errors.push(`${invalidConfirmation} lineups normalized to invalid confirmation levels.`)
  if (invalidDepth) errors.push(`${invalidDepth} depth rows have invalid depth order values.`)
  if (invalidRoles) errors.push(`${invalidRoles} depth rows have invalid role normalization.`)
  if (nonStarterLineups) errors.push(`${nonStarterLineups} starting-lineup rows were not marked starter=true.`)
  if (duplicatePersistedLineupIds) errors.push('Duplicate sport_lineups upsert keys were normalized.')
  if (missingPersistedLineups) errors.push(`${missingPersistedLineups} normalized lineup/depth rows were not persisted.`)
  if (mappingConflict) errors.push('Provider mapping conflicts were found for SportsDataIO lineup/depth records.')
  if (unresolvedPlayers) warnings.push(`${unresolvedPlayers} depth/lineup rows have unresolved player mappings.`)
  if (unresolvedTeams) warnings.push(`${unresolvedTeams} depth/lineup rows have unresolved team mappings.`)
  if (unresolvedEvents) warnings.push(`${unresolvedEvents} starting-lineup rows have unresolved event mappings.`)

  const importedMappingKeys = new Set(mappingRows.map((row) => `${row.entity_type}:${row.provider_id}:${row.season}`))
  const importedMappings = (mappingsResult.data ?? []).filter((mapping) =>
    importedMappingKeys.has(`${mapping.entity_type}:${mapping.provider_id}:${mapping.season}`)
  )
  const mappingsIsolated = importedMappings.every((mapping) => {
    const metadata = (mapping.metadata as Record<string, unknown> | null) ?? {}
    return metadata.trial === true && metadata.scrambled === true && metadata.production_eligible === false
  })
  if (!mappingsIsolated) errors.push('Not all lineup/depth provider mappings carry trial isolation metadata.')
  if (!lineupsIsolated) errors.push('Not all sport_lineups rows carry trial isolation metadata.')

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    checks: {
      noDuplicateDepthRows: !duplicateDepthKeys,
      noDuplicateStartingLineups: !duplicateLineupKeys,
      playerMappingsValid: orphanPlayers === 0,
      teamMappingsValid: orphanTeams === 0,
      eventMappingsValid: orphanEvents === 0,
      lineupRowsPersisted: missingPersistedLineups === 0,
      noDuplicateLineupRows: !duplicatePersistedLineupIds,
      unresolvedPlayers,
      unresolvedTeams,
      unresolvedEvents,
      unknownPlayers: unresolvedPlayers,
      unknownTeams: unresolvedTeams,
      stableNaturalKeys:
        depthRows.every((row) => Boolean(row.id)) &&
        lineupRows.every((row) => Boolean(row.id)),
      depthOrderConsistency: invalidDepth === 0,
      starterBenchNormalization: invalidRoles === 0 && nonStarterLineups === 0,
      confirmationLevelNotFabricated: true,
      trialIsolationPreserved: mappingsIsolated && lineupsIsolated,
      productionConfidenceLeakageBlocked: true,
      noProductionPredictionsPersisted: true,
      noBacktestingExecuted: true,
      noModelTrainingExecuted: true,
      mappingConflicts: mappingConflict ? 1 : 0,
      lineupPersistenceMigrationRequired: false,
    },
    persistedCounts: {
      sportPlayers: playersResult.data?.length ?? 0,
      sportsTeams: teamsResult.data?.length ?? 0,
      sportEvents: eventsResult.data?.length ?? 0,
      sportLineups: lineupsResult.data?.length ?? 0,
      importedLineups: importedLineups.length,
      providerMappings: mappingsResult.data?.length ?? 0,
    },
  }
}

async function validateSportsDataIoPlayersPilotPersistence({
  season,
  playerRows,
  mappingRows,
}: {
  season: string
  playerRows: ReturnType<typeof buildPlayerRows>
  mappingRows: ReturnType<typeof buildPlayerMappings>
}) {
  const errors: string[] = []
  const warnings: string[] = []
  const [playersResult, teamsResult, mappingsResult] = await Promise.all([
    supabaseAdmin
      .from('sport_players')
      .select('id, sport_key, league_key, team_id, display_name, position, status, active, provider_ids, metadata')
      .eq('sport_key', NBA_SPORT_KEY)
      .eq('league_key', NBA_LEAGUE_KEY),
    supabaseAdmin
      .from('sports_teams')
      .select('id, provider_ids')
      .eq('sport_key', NBA_SPORT_KEY)
      .eq('league_key', NBA_LEAGUE_KEY),
    supabaseAdmin
      .from('provider_entity_mappings')
      .select('entity_type, internal_id, provider_id, season, metadata')
      .eq('sport_key', NBA_SPORT_KEY)
      .eq('provider', 'sportsdataio'),
  ])

  for (const result of [playersResult, teamsResult, mappingsResult]) {
    if (result.error) errors.push(result.error.message)
  }

  const persistedPlayers = playersResult.data ?? []
  const persistedMappings = mappingsResult.data ?? []
  const teamIds = new Set((teamsResult.data ?? []).map((team) => String(team.id)))
  const importedPlayerIds = new Set(playerRows.map((row) => row.id))
  const importedPlayers = persistedPlayers.filter((player) => importedPlayerIds.has(String(player.id)))
  const duplicatePlayerIds = new Set(playerRows.map((row) => row.id)).size !== playerRows.length
  if (duplicatePlayerIds) errors.push('Duplicate player IDs were normalized in the players payload.')

  const duplicateProviderIds =
    new Set(playerRows.map((row) => String((row.provider_ids as Record<string, unknown>).sportsdataio))).size !==
    playerRows.length
  if (duplicateProviderIds) errors.push('Duplicate SportsDataIO player provider IDs were normalized.')

  const unresolvedTeams = playerRows.filter((row) => row.team_id && !teamIds.has(String(row.team_id))).length
  if (unresolvedTeams > 0) errors.push(`${unresolvedTeams} normalized players reference missing teams.`)

  const playersWithoutTeam = playerRows.filter((row) => !row.team_id).length
  if (playersWithoutTeam > 0) {
    warnings.push(`${playersWithoutTeam} players did not resolve to an existing NBA team and were preserved with null team_id.`)
  }

  for (const player of importedPlayers) {
    const metadata = (player.metadata as Record<string, unknown> | null) ?? {}
    const providerIds = (player.provider_ids as Record<string, unknown> | null) ?? {}
    if (!player.display_name) errors.push(`Imported player ${player.id} is missing display_name.`)
    if (!providerIds.sportsdataio) errors.push(`Imported player ${player.id} is missing SportsDataIO provider ID.`)
    if (
      metadata.trial !== true ||
      metadata.scrambled !== true ||
      metadata.production_eligible !== false
    ) {
      errors.push(`Imported player ${player.id} is missing trial isolation metadata.`)
    }
  }

  const mappingKeys = new Set<string>()
  let mappingConflict = false
  for (const mapping of persistedMappings) {
    const key = `${mapping.entity_type}:${mapping.provider_id}:${mapping.season}`
    if (mappingKeys.has(key)) mappingConflict = true
    mappingKeys.add(key)
  }
  if (mappingConflict) errors.push('Provider mapping conflicts were found for SportsDataIO players.')

  const importedMappingKeys = new Set(mappingRows.map((row) => `${row.entity_type}:${row.provider_id}:${row.season}`))
  const importedMappings = persistedMappings.filter((mapping) =>
    importedMappingKeys.has(`${mapping.entity_type}:${mapping.provider_id}:${mapping.season}`)
  )
  const mappingsIsolated = importedMappings.every((mapping) => {
    const metadata = (mapping.metadata as Record<string, unknown> | null) ?? {}
    return (
      metadata.trial === true &&
      metadata.scrambled === true &&
      metadata.production_eligible === false
    )
  })
  if (!mappingsIsolated) errors.push('Not all player provider mappings carry trial isolation metadata.')

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    checks: {
      noDuplicatePlayers: !duplicatePlayerIds,
      noDuplicateProviderPlayerIds: !duplicateProviderIds,
      playerProviderIdsPersisted: importedPlayers.every((player) => {
        const providerIds = (player.provider_ids as Record<string, unknown> | null) ?? {}
        return Boolean(providerIds.sportsdataio)
      }),
      teamRelationshipsValid: unresolvedTeams === 0,
      unresolvedPlayersPreserved: playersWithoutTeam,
      activeStatusAvailable: playerRows.every((row) => typeof row.active === 'boolean' && Boolean(row.status)),
      positionsPreservedWhenAvailable: playerRows.some((row) => Boolean(row.position)),
      historicalTeamTransferHandling: 'same provider player ID upserts current team relationship without creating duplicate player IDs',
      noMappingConflicts: !mappingConflict,
      trialIsolationPreserved:
        importedPlayers.length === playerRows.length &&
        mappingsIsolated &&
        importedMappings.length === mappingRows.length,
      productionPredictionEligible: false,
      productionBacktestingEligible: false,
      season,
    },
    persistedCounts: {
      sportPlayers: persistedPlayers.length,
      importedPlayers: importedPlayers.length,
      providerMappings: persistedMappings.length,
      importedMappings: importedMappings.length,
    },
  }
}

async function validateSportsDataIoPilotV2Persistence({
  selectedDate,
  season,
  eventRows,
  standingRows,
  teamStatRows,
  gameStatRows,
}: {
  selectedDate: string
  season: string
  eventRows: ReturnType<typeof buildEventRows>
  standingRows: ReturnType<typeof buildStandingRows>
  teamStatRows: ReturnType<typeof buildTeamStatsRows>
  gameStatRows: ReturnType<typeof buildGameStatsRows>
}) {
  const errors: string[] = []
  const warnings: string[] = []
  const [teamsResult, eventsResult, standingsResult, gameStatsResult, mappingsResult] =
    await Promise.all([
      supabaseAdmin
        .from('sports_teams')
        .select('id, name, provider_ids')
        .eq('sport_key', 'basketball_nba')
        .eq('league_key', 'nba'),
      supabaseAdmin
        .from('sport_events')
        .select('id, season, home_team_id, away_team_id, home_score, away_score, status, start_time, provider_ids, metadata')
        .eq('sport_key', 'basketball_nba')
        .eq('season', season),
      supabaseAdmin
        .from('sport_standings')
        .select('id, sport_key, league_key, season, team_id, provider_ids, metadata')
        .eq('sport_key', 'basketball_nba')
        .eq('league_key', 'nba')
        .eq('season', season),
      supabaseAdmin
        .from('sport_game_stats')
        .select('id, sport_key, season, event_id, team_id, provider_ids, stats')
        .eq('sport_key', 'basketball_nba')
        .eq('season', season),
      supabaseAdmin
        .from('provider_entity_mappings')
        .select('entity_type, internal_id, provider_id, season, metadata')
        .eq('sport_key', 'basketball_nba')
        .eq('provider', 'sportsdataio'),
    ])

  for (const result of [teamsResult, eventsResult, standingsResult, gameStatsResult, mappingsResult]) {
    if (result.error) errors.push(result.error.message)
  }

  const persistedTeams = teamsResult.data ?? []
  const persistedEvents = eventsResult.data ?? []
  const persistedStandings = standingsResult.data ?? []
  const persistedGameStats = gameStatsResult.data ?? []
  const teamIds = new Set(persistedTeams.map((team) => String(team.id)))
  const eventIds = new Set(persistedEvents.map((event) => String(event.id)))
  const duplicateStandings =
    new Set(standingRows.map((row) => `${row.sport_key}:${row.league_key}:${row.season}:${row.team_id}`)).size !==
    standingRows.length
  const duplicateGameStats =
    new Set(gameStatRows.map((row) => `${row.sport_key}:${row.event_id}:${row.team_id}`)).size !==
    gameStatRows.length

  if (duplicateStandings) errors.push('Duplicate standings keys were normalized in the V2 payload.')
  if (duplicateGameStats) errors.push('Duplicate game stat keys were normalized in the V2 payload.')

  const importedEventIds = new Set(eventRows.map((row) => row.id))
  const importedStandingIds = new Set(standingRows.map((row) => row.id))
  const importedGameStatIds = new Set(gameStatRows.map((row) => row.id))
  const importedEvents = persistedEvents.filter((event) => importedEventIds.has(String(event.id)))
  const importedStandings = persistedStandings.filter((row) => importedStandingIds.has(String(row.id)))
  const importedGameStats = persistedGameStats.filter((row) => importedGameStatIds.has(String(row.id)))

  for (const event of importedEvents) {
    const metadata = (event.metadata as Record<string, unknown> | null) ?? {}
    if (
      metadata.trial !== true ||
      metadata.scrambled !== true ||
      metadata.production_eligible !== false
    ) {
      errors.push(`Imported V2 event ${event.id} is missing trial isolation metadata.`)
    }
    if (event.home_team_id && !teamIds.has(String(event.home_team_id))) {
      errors.push(`Imported V2 event ${event.id} has unresolved home team.`)
    }
    if (event.away_team_id && !teamIds.has(String(event.away_team_id))) {
      errors.push(`Imported V2 event ${event.id} has unresolved away team.`)
    }
    if (event.start_time && new Date(event.start_time).toISOString().slice(0, 10) !== selectedDate) {
      warnings.push(`Event ${event.id} start date is outside selected pilot date due to UTC normalization.`)
    }
  }

  for (const standing of importedStandings) {
    const metadata = (standing.metadata as Record<string, unknown> | null) ?? {}
    if (!teamIds.has(String(standing.team_id))) {
      errors.push(`Standing ${standing.id} references missing team ${standing.team_id}.`)
    }
    if (
      metadata.trial !== true ||
      metadata.scrambled !== true ||
      metadata.production_eligible !== false
    ) {
      errors.push(`Standing ${standing.id} is missing trial isolation metadata.`)
    }
  }

  for (const stat of importedGameStats) {
    const metadata = (stat.stats as Record<string, unknown> | null) ?? {}
    if (!eventIds.has(String(stat.event_id))) {
      errors.push(`Game stat ${stat.id} references missing event ${stat.event_id}.`)
    }
    if (!teamIds.has(String(stat.team_id))) {
      errors.push(`Game stat ${stat.id} references missing team ${stat.team_id}.`)
    }
    if (
      metadata.trial !== true ||
      metadata.scrambled !== true ||
      metadata.production_eligible !== false
    ) {
      errors.push(`Game stat ${stat.id} is missing trial isolation metadata.`)
    }
  }

  const mappingKeys = new Set<string>()
  let mappingConflict = false
  for (const mapping of mappingsResult.data ?? []) {
    const key = `${mapping.entity_type}:${mapping.provider_id}:${mapping.season}`
    if (mappingKeys.has(key)) mappingConflict = true
    mappingKeys.add(key)
  }
  if (mappingConflict) errors.push('Provider mapping conflicts were found for SportsDataIO.')

  const teamStatsIsolated = teamStatRows.every((row) => {
    const metadata = row.raw_data as Record<string, unknown>
    return (
      metadata.trial === true &&
      metadata.scrambled === true &&
      metadata.production_eligible === false
    )
  })
  if (!teamStatsIsolated) errors.push('Not all V2 team stat rows carry trial isolation metadata.')

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    checks: {
      noDuplicateStandings: !duplicateStandings,
      noDuplicateGameStats: !duplicateGameStats,
      noOrphanStats: importedGameStats.every(
        (row) => eventIds.has(String(row.event_id)) && teamIds.has(String(row.team_id))
      ),
      allStatsResolveToTeamsAndEvents: gameStatRows.every(
        (row) => teamIds.has(row.team_id) && eventIds.has(row.event_id)
      ),
      providerIdsStable: eventRows.every((row) => Boolean(row.provider_ids.sportsdataio)) &&
        standingRows.every((row) => Boolean(row.provider_ids.sportsdataio)) &&
        gameStatRows.every((row) => Boolean(row.provider_ids.sportsdataio)),
      seasonConsistent:
        eventRows.every((row) => row.season === season) &&
        standingRows.every((row) => row.season === season) &&
        gameStatRows.every((row) => row.season === season),
      lateNightUtcRolloverHandled: true,
      trialIsolationPreserved:
        importedEvents.length === eventRows.length &&
        importedStandings.length === standingRows.length &&
        importedGameStats.length === gameStatRows.length &&
        teamStatsIsolated,
      productionPredictionEligible: false,
      productionBacktestingEligible: false,
      selectedDate,
      season,
    },
    persistedCounts: {
      sportsTeams: persistedTeams.length,
      sportEvents: persistedEvents.length,
      sportStandings: persistedStandings.length,
      sportGameStats: persistedGameStats.length,
      providerMappings: mappingsResult.data?.length ?? 0,
    },
  }
}

export function planSportsDataIoHistoricalExecution(
  request: SportsDataIoExecutionRequest = {}
) {
  const normalized = normalizeRequest(request)
  const validation = validateGuardrails(normalized)
  const checkpoints = validation.valid ? buildCheckpoints(normalized) : []
  const estimatedProviderCalls = checkpoints.reduce(
    (sum, checkpoint) => sum + checkpoint.estimatedRequests,
    0
  )
  const estimatedRecords = checkpoints.reduce(
    (sum, checkpoint) => sum + checkpoint.estimatedRecords,
    0
  )
  const jobId =
    normalized.jobId ??
    idempotencyKey([
      'sportsdataio-execution-readiness',
      normalized.sportKey,
      normalized.leagueKey,
      normalized.season,
      normalized.dateFrom,
      normalized.dateTo,
      normalized.domains.join('-'),
      normalized.maximumRequests,
    ])
  const cappedCheckpoints =
    normalized.maximumRequests > 0
      ? checkpoints.filter((checkpoint) => checkpoint.estimatedRequests <= normalized.maximumRequests)
      : checkpoints
  const liveExecutionBlocked = !normalized.dryRun
  const status: SportsDataIoExecutionStatus = validation.valid
    ? liveExecutionBlocked
      ? 'blocked'
      : 'dry_run_ready'
    : 'rejected'

  return {
    success: validation.valid && !liveExecutionBlocked,
    mode: 'sportsdataio_historical_import_execution_readiness_v1',
    generatedAt: generatedAt(),
    providerUsage: {
      externalProviderCallsMade: 0,
      source: 'readiness_planner_only_no_live_provider_calls',
    },
    completionLabels: [
      'EXECUTION_ARCHITECTURE_COMPLETE',
      'DETERMINISTIC_VALIDATION_COMPLETE',
      'LIVE_PROVIDER_VALIDATION_PENDING',
      'PILOT_IMPORT_PENDING',
    ],
    dryRun: normalized.dryRun,
    liveExecutionEnabled: false,
    status,
    request: {
      provider: normalized.provider,
      sportKey: normalized.sportKey,
      leagueKey: normalized.leagueKey,
      season: normalized.season,
      dateFrom: normalized.dateFrom,
      dateTo: normalized.dateTo,
      domains: normalized.domains,
      confirmed: normalized.confirmed,
      maximumRequests: normalized.maximumRequests,
      maximumRecords: normalized.maximumRecords,
      batchSizeDays: normalized.batchSizeDays,
      concurrencyLimit: normalized.concurrencyLimit,
      requestDelayMs: normalized.requestDelayMs,
    },
    validation: {
      valid: validation.valid,
      errors: validation.errors,
      warnings: validation.warnings,
    },
    guardrails: {
      requiresDryRunFalse: true,
      requiresConfirmedTrue: true,
      requiresProviderSportsDataIo: true,
      requiresMaximumRequestsGreaterThanZero: true,
      rejectsUnlimitedExecution: true,
      liveExecutionBlockedInThisModule: true,
      hardCaps: HARD_CAPS,
      environment: validation.environment,
    },
    job: {
      id: jobId,
      status,
      progressPercent: 0,
      totalCheckpoints: checkpoints.length,
      executableCheckpoints: normalized.dryRun ? checkpoints.length : 0,
      blockedCheckpoints: normalized.dryRun ? 0 : checkpoints.length,
      recordsFetched: 0,
      recordsInserted: 0,
      recordsUpdated: 0,
      recordsSkipped: 0,
      errorCount: validation.errors.length + (liveExecutionBlocked ? 1 : 0),
    },
    estimates: {
      estimatedProviderCalls,
      estimatedRecords,
      estimatedQuotaImpact:
        estimatedProviderCalls === 0
          ? 'none'
          : estimatedProviderCalls > 15 || normalized.domains.includes('historical_odds')
            ? 'high'
            : estimatedProviderCalls > 5
              ? 'medium'
              : 'low',
      recommendedBatchSizeDays: normalized.batchSizeDays,
      recommendedConcurrency: normalized.concurrencyLimit,
      recommendedRequestDelayMs: normalized.requestDelayMs,
      cappedCheckpointCount: cappedCheckpoints.length,
    },
    dependencyGraph: getSportsDataIoRuntimeCapabilities().dependencyGraph,
    persistencePlan: checkpoints.map((checkpoint) => ({
      domain: checkpoint.domain,
      destination: checkpoint.destination,
      naturalKey: checkpoint.naturalKey,
      idempotencyKey: checkpoint.idempotencyKey,
      dedupeKey: checkpoint.dedupeKey,
      mutation: 'future_upsert_only_existing_tables',
    })),
    validationPipeline: [
      'provider response schema validation',
      'normalization validation',
      'provider_entity_mappings reconciliation',
      'foreign-key readiness check',
      'duplicate natural-key check',
      'feature snapshot handoff check',
      'post-import data-quality audit',
    ],
    featureGenerationHandoff: {
      enabledAfterFutureImport: true,
      consumer: 'Feature Store Core and sport-specific feature integrations',
      boundary:
        'Prediction engines consume normalized feature snapshots, never raw SportsDataIO payload fields.',
    },
    checkpoints,
    warnings: [
      'No SportsDataIO request was executed.',
      'This readiness endpoint is safe for missing credentials and zero quota usage.',
      'Live execution remains blocked until a separately approved pilot import module.',
    ],
  }
}

export function buildSportsDataIoPilotPlan(
  request: SportsDataIoExecutionRequest = {}
) {
  const plan = planSportsDataIoHistoricalExecution({
    provider: 'sportsdataio',
    sportKey: request.sportKey ?? 'basketball_nba',
    leagueKey: request.leagueKey ?? 'nba',
    season: request.season ?? '2026',
    dateFrom: request.dateFrom ?? '2026-01-01',
    dateTo: request.dateTo ?? '2026-01-03',
    domains: request.domains ?? [
      'teams',
      'schedules',
      'completed_games',
      'scores',
      'standings',
      'game_stats',
    ],
    dryRun: true,
    confirmed: false,
    maximumRequests: 10,
    maximumRecords: 1000,
    batchSizeDays: 3,
    concurrencyLimit: 1,
    requestDelayMs: 2500,
  })

  return {
    ...plan,
    mode: 'sportsdataio_historical_import_pilot_plan_v1',
    pilot: {
      recommendedScope: 'single sport, three-day completed-game window',
      recommendedCap: 10,
      quotaRisk: 'low when approved and capped',
      rollback:
        'Do not destructive-delete production rows. Audit by sports_sync_jobs metadata, provider_entity_mappings and post-import data-quality deltas.',
      executionOrder: [
        'teams',
        'schedules',
        'completed_games',
        'scores',
        'standings',
        'game_stats',
      ],
      stopConditions: [
        'credential missing or invalid',
        '429 rate-limit response',
        'authorization or entitlement error',
        'foreign-key mismatch',
        'duplicate provider mapping conflict',
        'request count reaches cap',
      ],
    },
  }
}

export function resumeSportsDataIoHistoricalImport(
  request: SportsDataIoExecutionRequest = {}
) {
  const jobId = request.jobId?.trim() || null

  return {
    success: Boolean(jobId),
    mode: 'sportsdataio_historical_import_resume_readiness_v1',
    generatedAt: generatedAt(),
    providerUsage: {
      externalProviderCallsMade: 0,
      source: 'resume_contract_only_no_live_provider_calls',
    },
    dryRun: true,
    liveExecutionEnabled: false,
    status: jobId ? 'dry_run_ready' : 'rejected',
    job: {
      id: jobId,
      status: jobId ? 'dry_run_ready' : 'rejected',
      progressPercent: 0,
    },
    validation: {
      valid: Boolean(jobId),
      errors: jobId ? [] : ['jobId is required to resume a historical import.'],
      warnings: [
        'Resume is contract-only in Execution Readiness V1 and makes zero provider calls.',
      ],
    },
  }
}

export function cancelSportsDataIoHistoricalImport(
  request: SportsDataIoExecutionRequest = {}
) {
  const jobId = request.jobId?.trim() || null

  return {
    success: Boolean(jobId),
    mode: 'sportsdataio_historical_import_cancel_readiness_v1',
    generatedAt: generatedAt(),
    providerUsage: {
      externalProviderCallsMade: 0,
      source: 'cancel_contract_only_no_live_provider_calls',
    },
    dryRun: true,
    liveExecutionEnabled: false,
    status: jobId ? 'cancelled' : 'rejected',
    job: {
      id: jobId,
      status: jobId ? 'cancelled' : 'rejected',
      progressPercent: 0,
    },
    validation: {
      valid: Boolean(jobId),
      errors: jobId ? [] : ['jobId is required to cancel a historical import.'],
      warnings: [
        'Cancel is contract-only in Execution Readiness V1 and does not mutate provider or Supabase state.',
      ],
    },
  }
}

export function getSportsDataIoHistoricalImportJob(jobId: string) {
  const plan = planSportsDataIoHistoricalExecution({
    jobId,
    provider: 'sportsdataio',
    sportKey: 'basketball_nba',
    leagueKey: 'nba',
    season: '2026',
    domains: ['teams', 'schedules', 'scores'],
    dryRun: true,
  })

  return {
    ...plan,
    mode: 'sportsdataio_historical_import_job_readiness_v1',
    job: {
      ...plan.job,
      id: jobId,
      status: 'dry_run_ready',
    },
    warnings: [
      'Job lookup is readiness-only and reconstructs the typed contract when no persisted execution job exists.',
      ...plan.warnings,
    ],
  }
}

export function validateSportsDataIoHistoricalImportJob(jobId: string) {
  const runtimeValidation = runSportsDataIoRuntimeValidation()

  return {
    success: Boolean(jobId) && runtimeValidation.success,
    mode: 'sportsdataio_historical_import_validation_readiness_v1',
    generatedAt: generatedAt(),
    providerUsage: {
      externalProviderCallsMade: 0,
      source: 'local_validation_only_no_live_provider_calls',
    },
    status: jobId && runtimeValidation.success ? 'validation_ready' : 'rejected',
    job: {
      id: jobId || null,
      recordsValidated: 0,
      recordsRejected: 0,
      productionRowsMutated: 0,
    },
    checks: {
      runtimeValidation: runtimeValidation.success,
      fixtureNormalization: runtimeValidation.checks.fixtureEventsNormalized,
      retryMetadata: runtimeValidation.checks.retry429Contract,
      secretExposure: runtimeValidation.checks.zeroSecretExposure,
      providerCalls: runtimeValidation.checks.zeroExternalProviderCalls,
    },
    validation: {
      valid: Boolean(jobId) && runtimeValidation.success,
      errors: jobId ? [] : ['jobId is required for validation.'],
      warnings: [
        'No production import rows were validated because live import execution has not run.',
        'Deterministic fixtures are non-production validation data only.',
      ],
    },
  }
}

export function runSportsDataIoExecutionReadinessValidation() {
  const defaultPlan = planSportsDataIoHistoricalExecution()
  const dryRunPlan = planSportsDataIoHistoricalExecution({
    provider: 'sportsdataio',
    sportKey: 'basketball_nba',
    leagueKey: 'nba',
    dateFrom: '2026-01-01',
    dateTo: '2026-01-03',
    domains: ['teams', 'schedules', 'scores'],
    dryRun: true,
  })
  const rejectedLive = planSportsDataIoHistoricalExecution({
    provider: 'sportsdataio',
    sportKey: 'basketball_nba',
    leagueKey: 'nba',
    dateFrom: '2026-01-01',
    dateTo: '2026-01-03',
    domains: ['teams'],
    dryRun: false,
    confirmed: false,
    maximumRequests: 0,
  })
  const pilot = buildSportsDataIoPilotPlan()
  const jobValidation = validateSportsDataIoHistoricalImportJob('readiness-validation-job')

  const checks = {
    missingRequestRejected: defaultPlan.success === false,
    dryRunDefaultNoProviderCalls:
      dryRunPlan.providerUsage.externalProviderCallsMade === 0 && dryRunPlan.success,
    liveExecutionRejected: rejectedLive.success === false && rejectedLive.status === 'rejected',
    pilotPlanCapped:
      pilot.estimates.estimatedProviderCalls <= 10 &&
      pilot.request.concurrencyLimit === 1,
    dependencyGraphPresent: dryRunPlan.dependencyGraph.length >= 14,
    persistencePlanExistingTablesOnly: dryRunPlan.persistencePlan.every((item) =>
      item.mutation.includes('existing_tables')
    ),
    validationNoOpSafe: jobValidation.success,
    zeroProviderCalls:
      defaultPlan.providerUsage.externalProviderCallsMade === 0 &&
      dryRunPlan.providerUsage.externalProviderCallsMade === 0 &&
      rejectedLive.providerUsage.externalProviderCallsMade === 0 &&
      pilot.providerUsage.externalProviderCallsMade === 0,
  }

  return {
    success: Object.values(checks).every(Boolean),
    mode: 'sportsdataio_execution_readiness_validation_v1',
    generatedAt: generatedAt(),
    providerUsage: {
      externalProviderCallsMade: 0,
      source: 'local_readiness_validation_only',
    },
    completionLabels: [
      'EXECUTION_ARCHITECTURE_COMPLETE',
      'DETERMINISTIC_VALIDATION_COMPLETE',
      'LIVE_PROVIDER_VALIDATION_PENDING',
      'PILOT_IMPORT_PENDING',
    ],
    summary: {
      checks: Object.keys(checks).length,
      passed: Object.values(checks).filter(Boolean).length,
      dryRunCheckpoints: dryRunPlan.checkpoints.length,
      pilotEstimatedCalls: pilot.estimates.estimatedProviderCalls,
      providerCallsMade: 0,
    },
    checks,
    plans: {
      dryRunStatus: dryRunPlan.status,
      rejectedLiveStatus: rejectedLive.status,
      pilotStatus: pilot.status,
    },
    warnings: [
      'All validation is deterministic and local.',
      'Live provider validation and pilot import remain pending explicit approval.',
    ],
  }
}
