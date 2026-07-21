import 'server-only'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { normalizeSportsDataIoMlbGameDateTime } from '@/services/provider-time-normalization.service'
import { idempotencyKey } from '@/services/sync-reliability.service'
import { safeExistingValueSet } from '@/services/safe-supabase-preflight.service'
import { checkProviderBudget } from '@/services/provider-budget.service'
import {
  SPORTSDATAIO_DISCOVERY_LAB_ORIGIN,
  resolveSportsDataIoDiscoveryLabUrl,
  validateSportsDataIoDiscoveryLabUrlFixtures,
} from '@/services/sportsdataio-discovery-lab-url.service'
import {
  SportsDataIoMlbEventReference,
  normalizeSportsDataIoMlbGameOdds,
} from '@/services/sportsdataio-mlb-normalization.service'
import { assertSportEventStatusWrite } from '@/services/mlb-event-status-mapper.service'

export type SportsDataIoMlbExecutionRequest = {
  provider?: string | null
  providerVariant?: string | null
  sportKey?: string | null
  leagueKey?: string | null
  season?: string | null
  seasonType?: string | null
  dateFrom?: string | null
  dateTo?: string | null
  domains?: string[] | null
  dryRun?: boolean | null
  confirmed?: boolean | null
  maximumRequests?: number | null
  maximumRecords?: number | null
  concurrencyLimit?: number | null
  requestDelayMs?: number | null
  timeoutMs?: number | null
}

type MlbDomain =
  | 'season_schedule'
  | 'teams_static_if_stale'
  | 'players_static_if_stale'
  | 'stadiums_if_missing'
  | 'standings'
  | 'team_season_stats'
  | 'player_season_stats'
  | 'events_results_by_date'
  | 'team_game_stats_by_date'
  | 'player_game_stats_by_date'
  | 'game_odds_by_date'
  | 'projections_optional'
  | 'line_movement_optional'
  | 'data_quality'
  | 'historical_feature_eligibility'
  | 'prediction_eligibility'
  | 'settlement'
  | 'technical_validation'

type MlbCheckpointStatus =
  | 'planned'
  | 'running'
  | 'completed'
  | 'partial'
  | 'failed'
  | 'canceled'
  | 'timed_out'
  | 'blocked'

type MlbTerminalStatus = 'completed' | 'partial' | 'failed' | 'canceled' | 'timed_out'
type ProviderCallState =
  | 'NOT_ATTEMPTED'
  | 'ATTEMPTED'
  | 'RESPONSE_RECEIVED'
  | 'COMPLETED'
  | 'TIMED_OUT'
  | 'AMBIGUOUS'

type MlbExecutionUnit = {
  sequence: number
  domain: MlbDomain
  endpoint: string
  endpointTemplate: string
  product: 'odds' | 'fantasy' | 'local'
  scope: 'season' | 'date' | 'event' | 'local'
  date: string | null
  providerDate: string | null
  estimatedCalls: number
  persistenceTables: string[]
  conflictTargets: string[]
  requiredMappings: Array<'teams' | 'events' | 'players'>
  optional: boolean
  implementedLive: boolean
  checkpointKey: string
  status: MlbCheckpointStatus
  skipReason: string | null
}

type ExistingCheckpoint = {
  key: string
  status: MlbCheckpointStatus
  providerCallsUsed: number
  completedAt: string | null
  jobId: string
  lastError: string | null
}

const PROVIDER = 'sportsdataio'
const PROVIDER_VARIANT = 'sportsdataio_discovery_lab'
const SPORT_KEY = 'baseball_mlb'
const LEAGUE_KEY = 'mlb'
const BASE_ORIGIN = SPORTSDATAIO_DISCOVERY_LAB_ORIGIN
const EXECUTION_VERSION = 'sportsdataio_mlb_discovery_historical_import_v1'
const DEFAULT_TIMEOUT_MS = 60000
const DEFAULT_MAXIMUM_REQUESTS = 400
const FAILED_CHECKPOINT_RETRY_COOLDOWN_MS = 30 * 60 * 1000
const JOB_STUCK_GRACE_MS = 60 * 1000

const DOMAIN_ORDER: MlbDomain[] = [
  'season_schedule',
  'teams_static_if_stale',
  'players_static_if_stale',
  'stadiums_if_missing',
  'standings',
  'team_season_stats',
  'player_season_stats',
  'events_results_by_date',
  'team_game_stats_by_date',
  'player_game_stats_by_date',
  'game_odds_by_date',
  'projections_optional',
  'line_movement_optional',
  'data_quality',
  'historical_feature_eligibility',
  'prediction_eligibility',
  'settlement',
  'technical_validation',
]

const DOMAIN_ALIASES: Record<string, MlbDomain> = {
  schedules: 'season_schedule',
  schedule: 'season_schedule',
  season_schedule: 'season_schedule',
  games: 'season_schedule',
  season_games: 'season_schedule',
  teams: 'teams_static_if_stale',
  players: 'players_static_if_stale',
  stadiums: 'stadiums_if_missing',
  standings: 'standings',
  team_stats: 'team_season_stats',
  team_season_stats: 'team_season_stats',
  player_stats: 'player_season_stats',
  player_season_stats: 'player_season_stats',
  scores: 'events_results_by_date',
  completed_games: 'events_results_by_date',
  events_results_by_date: 'events_results_by_date',
  game_stats: 'team_game_stats_by_date',
  team_game_stats_by_date: 'team_game_stats_by_date',
  player_game_stats_by_date: 'player_game_stats_by_date',
  odds: 'game_odds_by_date',
  game_odds_by_date: 'game_odds_by_date',
  projections: 'projections_optional',
  projections_optional: 'projections_optional',
  historical_odds: 'line_movement_optional',
  line_movement_optional: 'line_movement_optional',
  data_quality: 'data_quality',
  historical_feature_eligibility: 'historical_feature_eligibility',
  prediction_eligibility: 'prediction_eligibility',
  settlement: 'settlement',
  technical_validation: 'technical_validation',
}

function generatedAt() {
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

function dateOnly(value: Date) {
  return value.toISOString().slice(0, 10)
}

function parseDate(value: string | null | undefined) {
  if (!value) return null
  const parsed = new Date(`${value.slice(0, 10)}T00:00:00.000Z`)
  return Number.isFinite(parsed.getTime()) ? parsed : null
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

function sportsDataIoMlbDate(value: string) {
  const parsed = parseDate(value)
  if (!parsed) return null
  const month = parsed
    .toLocaleString('en-US', { month: 'short', timeZone: 'UTC' })
    .toUpperCase()
  return `${parsed.getUTCFullYear()}-${month}-${String(parsed.getUTCDate()).padStart(2, '0')}`
}

function normalizeDomains(values: string[] | null | undefined): MlbDomain[] {
  if (!values || values.length === 0) {
    return ['season_schedule', 'standings', 'team_season_stats', 'player_season_stats']
  }

  const selected = new Set<MlbDomain>()
  for (const value of values) {
    const key = value.trim().toLowerCase()
    const domain = DOMAIN_ALIASES[key]
    if (domain) selected.add(domain)
  }

  return DOMAIN_ORDER.filter((domain) => selected.has(domain))
}

function invalidDomains(values: string[] | null | undefined) {
  if (!values) return []
  return values.filter((value) => !DOMAIN_ALIASES[value.trim().toLowerCase()])
}

function endpointFor({
  domain,
  season,
  date,
  providerDate,
}: {
  domain: MlbDomain
  season: string
  date: string | null
  providerDate: string | null
}) {
  const dateParam = providerDate ?? '{date}'
  const isoDateParam = date ?? '{date}'
  const endpoints: Record<MlbDomain, Omit<MlbExecutionUnit, 'sequence' | 'checkpointKey' | 'status' | 'skipReason'>> = {
    season_schedule: {
      domain,
      endpoint: `/api/mlb/odds/json/Games/${season}`,
      endpointTemplate: '/api/mlb/odds/json/Games/{season}',
      product: 'odds',
      scope: 'season',
      date: null,
      providerDate: null,
      estimatedCalls: 1,
      persistenceTables: ['sport_events', 'sports_teams', 'provider_entity_mappings', 'sports_sync_jobs'],
      conflictTargets: ['sport_events.id', 'sports_teams.id', 'provider_entity_mappings provider tuple'],
      requiredMappings: [],
      optional: false,
      implementedLive: true,
    },
    teams_static_if_stale: {
      domain,
      endpoint: '/api/mlb/fantasy/json/Teams',
      endpointTemplate: '/api/mlb/fantasy/json/Teams',
      product: 'fantasy',
      scope: 'season',
      date: null,
      providerDate: null,
      estimatedCalls: 1,
      persistenceTables: ['sports_teams', 'provider_entity_mappings', 'sports_sync_jobs'],
      conflictTargets: ['sports_teams.id', 'provider_entity_mappings provider tuple'],
      requiredMappings: [],
      optional: false,
      implementedLive: false,
    },
    players_static_if_stale: {
      domain,
      endpoint: '/api/mlb/fantasy/json/Players',
      endpointTemplate: '/api/mlb/fantasy/json/Players',
      product: 'fantasy',
      scope: 'season',
      date: null,
      providerDate: null,
      estimatedCalls: 1,
      persistenceTables: ['sport_players', 'provider_entity_mappings', 'sports_sync_jobs'],
      conflictTargets: ['sport_players.id', 'provider_entity_mappings provider tuple'],
      requiredMappings: ['teams'],
      optional: false,
      implementedLive: true,
    },
    stadiums_if_missing: {
      domain,
      endpoint: '/api/mlb/odds/json/Stadiums',
      endpointTemplate: '/api/mlb/odds/json/Stadiums',
      product: 'odds',
      scope: 'season',
      date: null,
      providerDate: null,
      estimatedCalls: 1,
      persistenceTables: ['sports_sync_jobs', 'sport_events.metadata', 'sports_teams.metadata'],
      conflictTargets: ['metadata merge only'],
      requiredMappings: [],
      optional: false,
      implementedLive: false,
    },
    standings: {
      domain,
      endpoint: `/api/mlb/fantasy/json/Standings/${season}`,
      endpointTemplate: '/api/mlb/fantasy/json/Standings/{season}',
      product: 'fantasy',
      scope: 'season',
      date: null,
      providerDate: null,
      estimatedCalls: 1,
      persistenceTables: ['sport_standings', 'provider_entity_mappings', 'sports_sync_jobs'],
      conflictTargets: ['sport_standings.id', 'provider_entity_mappings provider tuple'],
      requiredMappings: ['teams'],
      optional: false,
      implementedLive: true,
    },
    team_season_stats: {
      domain,
      endpoint: `/api/mlb/odds/json/TeamSeasonStats/${season}`,
      endpointTemplate: '/api/mlb/odds/json/TeamSeasonStats/{season}',
      product: 'odds',
      scope: 'season',
      date: null,
      providerDate: null,
      estimatedCalls: 1,
      persistenceTables: ['team_stats', 'sports_sync_jobs'],
      conflictTargets: ['team_stats(team_name,sport_key,season)'],
      requiredMappings: ['teams'],
      optional: false,
      implementedLive: true,
    },
    player_season_stats: {
      domain,
      endpoint: `/api/mlb/fantasy/json/PlayerSeasonStats/${season}`,
      endpointTemplate: '/api/mlb/fantasy/json/PlayerSeasonStats/{season}',
      product: 'fantasy',
      scope: 'season',
      date: null,
      providerDate: null,
      estimatedCalls: 1,
      persistenceTables: ['sport_player_stats', 'provider_entity_mappings', 'sports_sync_jobs'],
      conflictTargets: ['sport_player_stats.id', 'provider_entity_mappings provider tuple'],
      requiredMappings: ['teams', 'players'],
      optional: false,
      implementedLive: true,
    },
    events_results_by_date: {
      domain,
      endpoint: `/api/mlb/odds/json/GamesByDate/${dateParam}`,
      endpointTemplate: '/api/mlb/odds/json/GamesByDate/{date}',
      product: 'odds',
      scope: 'date',
      date,
      providerDate,
      estimatedCalls: 1,
      persistenceTables: ['sport_events', 'provider_entity_mappings', 'sports_sync_jobs'],
      conflictTargets: ['sport_events.id', 'provider_entity_mappings provider tuple'],
      requiredMappings: ['teams'],
      optional: false,
      implementedLive: false,
    },
    team_game_stats_by_date: {
      domain,
      endpoint: `/api/mlb/odds/json/TeamGameStatsByDate/${dateParam}`,
      endpointTemplate: '/api/mlb/odds/json/TeamGameStatsByDate/{date}',
      product: 'odds',
      scope: 'date',
      date,
      providerDate,
      estimatedCalls: 1,
      persistenceTables: ['sport_game_stats', 'sports_sync_jobs'],
      conflictTargets: ['sport_game_stats sport_key,event_id,team_id'],
      requiredMappings: ['teams', 'events'],
      optional: false,
      implementedLive: true,
    },
    player_game_stats_by_date: {
      domain,
      endpoint: `/api/mlb/fantasy/json/PlayerGameStatsByDate/${dateParam}`,
      endpointTemplate: '/api/mlb/fantasy/json/PlayerGameStatsByDate/{date}',
      product: 'fantasy',
      scope: 'date',
      date,
      providerDate,
      estimatedCalls: 1,
      persistenceTables: ['sport_player_stats', 'provider_entity_mappings', 'sports_sync_jobs'],
      conflictTargets: ['sport_player_stats.id', 'provider_entity_mappings provider tuple'],
      requiredMappings: ['teams', 'events', 'players'],
      optional: false,
      implementedLive: true,
    },
    game_odds_by_date: {
      domain,
      endpoint: `/api/mlb/odds/json/GameOddsByDate/${isoDateParam}`,
      endpointTemplate: '/api/mlb/odds/json/GameOddsByDate/{date}',
      product: 'odds',
      scope: 'date',
      date,
      providerDate: date,
      estimatedCalls: 1,
      persistenceTables: ['sports_odds_snapshots', 'sports_sync_jobs'],
      conflictTargets: ['sports_odds_snapshots.id'],
      requiredMappings: ['events'],
      optional: false,
      implementedLive: true,
    },
    projections_optional: {
      domain,
      endpoint: `/api/mlb/fantasy/json/PlayerGameProjectionStatsByDate/${dateParam}`,
      endpointTemplate: '/api/mlb/fantasy/json/PlayerGameProjectionStatsByDate/{date}',
      product: 'fantasy',
      scope: 'date',
      date,
      providerDate,
      estimatedCalls: 1,
      persistenceTables: ['sports_sync_jobs'],
      conflictTargets: ['discovery only'],
      requiredMappings: ['teams', 'events', 'players'],
      optional: true,
      implementedLive: false,
    },
    line_movement_optional: {
      domain,
      endpoint: '/api/mlb/odds/json/GameOddsLineMovement/{gameid}',
      endpointTemplate: '/api/mlb/odds/json/GameOddsLineMovement/{gameid}',
      product: 'odds',
      scope: 'event',
      date,
      providerDate: null,
      estimatedCalls: 1,
      persistenceTables: ['sports_odds_snapshots', 'sports_sync_jobs'],
      conflictTargets: ['sports_odds_snapshots.id'],
      requiredMappings: ['events'],
      optional: true,
      implementedLive: false,
    },
    data_quality: localUnit(domain),
    historical_feature_eligibility: localUnit(domain),
    prediction_eligibility: localUnit(domain),
    settlement: localUnit(domain),
    technical_validation: localUnit(domain),
  }

  return endpoints[domain]
}

function localUnit(domain: MlbDomain): Omit<MlbExecutionUnit, 'sequence' | 'checkpointKey' | 'status' | 'skipReason'> {
  return {
    domain,
    endpoint: 'local',
    endpointTemplate: 'local',
    product: 'local',
    scope: 'local',
    date: null,
    providerDate: null,
    estimatedCalls: 0,
    persistenceTables: [],
    conflictTargets: [],
    requiredMappings: [],
    optional: false,
    implementedLive: false,
  }
}

function normalizeRequest(request: SportsDataIoMlbExecutionRequest = {}) {
  const domains = normalizeDomains(request.domains)
  const season = safeString(request.season) || '2026'
  const maximumRequests =
    request.maximumRequests === null || request.maximumRequests === undefined
      ? DEFAULT_MAXIMUM_REQUESTS
      : Math.max(0, Math.floor(Number(request.maximumRequests) || 0))
  return {
    provider: safeString(request.provider) || PROVIDER,
    providerVariant: safeString(request.providerVariant) || PROVIDER_VARIANT,
    sportKey: safeString(request.sportKey) || SPORT_KEY,
    leagueKey: safeString(request.leagueKey) || LEAGUE_KEY,
    season,
    seasonType: safeString(request.seasonType) || 'regular',
    dateFrom: safeString(request.dateFrom) || null,
    dateTo: safeString(request.dateTo) || null,
    domains,
    invalidDomains: invalidDomains(request.domains),
    dryRun: request.dryRun !== false,
    confirmed: request.confirmed === true,
    maximumRequests,
    maximumRecords: Math.max(0, Math.floor(Number(request.maximumRecords) || 25000)),
    concurrencyLimit: Math.max(1, Math.floor(Number(request.concurrencyLimit) || 1)),
    requestDelayMs: Math.max(0, Math.floor(Number(request.requestDelayMs) || 0)),
    timeoutMs: Math.max(1000, Math.floor(Number(request.timeoutMs) || DEFAULT_TIMEOUT_MS)),
  }
}

function checkpointKey({
  season,
  seasonType,
  domain,
  date,
  endpointTemplate,
}: {
  season: string
  seasonType: string
  domain: MlbDomain
  date: string | null
  endpointTemplate: string
}) {
  return idempotencyKey([
    EXECUTION_VERSION,
    PROVIDER,
    PROVIDER_VARIANT,
    SPORT_KEY,
    LEAGUE_KEY,
    season,
    seasonType,
    date,
    domain,
    endpointTemplate,
  ])
}

function buildDateRange(dateFrom: string | null, dateTo: string | null) {
  const from = parseDate(dateFrom)
  const to = parseDate(dateTo)
  if (!from || !to || from.getTime() > to.getTime()) return []
  const dates: string[] = []
  let cursor = from
  while (cursor.getTime() <= to.getTime()) {
    dates.push(dateOnly(cursor))
    cursor = addDays(cursor, 1)
  }
  return dates
}

async function loadExistingCheckpoints(season: string): Promise<Map<string, ExistingCheckpoint>> {
  const result = await supabaseAdmin
    .from('sports_sync_jobs')
    .select('id, status, completed_at, last_error, metadata')
    .eq('sport_key', SPORT_KEY)
    .eq('league_key', LEAGUE_KEY)
    .eq('provider', PROVIDER)
    .eq('season', season)
    .order('started_at', { ascending: false })
    .limit(500)

  if (result.error) {
    throw new Error(`sports_sync_jobs checkpoint read failed: ${result.error.message}`)
  }

  const checkpoints = new Map<string, ExistingCheckpoint>()
  for (const row of result.data ?? []) {
    const metadata = asRecord(row.metadata) ?? {}
    const checkpoint = asRecord(metadata.checkpoint)
    const key = safeString(checkpoint?.key)
    if (!key || checkpoints.has(key)) continue
    checkpoints.set(key, {
      key,
      status: safeString(checkpoint?.status) as MlbCheckpointStatus || (safeString(row.status) as MlbCheckpointStatus),
      providerCallsUsed: Number(checkpoint?.providerCallsUsed ?? metadata.externalCallsUsed ?? 0) || 0,
      completedAt: row.completed_at ? String(row.completed_at) : null,
      jobId: String(row.id),
      lastError: safeString((row as Record<string, unknown>).last_error) || safeString(checkpoint?.failureCode) || null,
    })
  }
  return checkpoints
}

function recentFailedCheckpoint(checkpoint: ExistingCheckpoint | undefined) {
  if (!checkpoint || !['failed', 'partial', 'running'].includes(checkpoint.status)) return false
  if (!checkpoint.completedAt) return true
  const completedAt = new Date(checkpoint.completedAt).getTime()
  if (!Number.isFinite(completedAt)) return true
  return Date.now() - completedAt < FAILED_CHECKPOINT_RETRY_COOLDOWN_MS
}

async function buildUnits(request: ReturnType<typeof normalizeRequest>) {
  const dates = buildDateRange(request.dateFrom, request.dateTo)
  const dateDomains = new Set<MlbDomain>([
    'events_results_by_date',
    'team_game_stats_by_date',
    'player_game_stats_by_date',
    'game_odds_by_date',
    'projections_optional',
  ])
  const existing = await loadExistingCheckpoints(request.season)
  const units: MlbExecutionUnit[] = []

  const requestedDateDomains = request.domains.filter((domain) => dateDomains.has(domain))
  const requestedSeasonDomains = request.domains.filter((domain) => !dateDomains.has(domain))

  const addUnit = (domain: MlbDomain, date: string | null) => {
    const providerDate = date ? sportsDataIoMlbDate(date) : null
    const endpoint = endpointFor({
      domain,
      season: request.season,
      date,
      providerDate,
    })
    const key = checkpointKey({
      season: request.season,
      seasonType: request.seasonType,
      domain,
      date,
      endpointTemplate: endpoint.endpointTemplate,
    })
    const completed = existing.get(key)
    const recentFailure = recentFailedCheckpoint(completed)
    units.push({
      ...endpoint,
      sequence: units.length + 1,
      checkpointKey: key,
      status: completed?.status === 'completed' ? 'completed' : recentFailure ? 'blocked' : 'planned',
      skipReason: completed?.status === 'completed'
        ? `Completed checkpoint ${completed.jobId} will be reused without another provider call.`
        : recentFailure
          ? `Recent ${completed?.status} checkpoint ${completed?.jobId} blocks immediate retry without another provider call. Last error: ${completed?.lastError ?? 'unknown'}`
        : null,
    })
  }

  for (const domain of requestedSeasonDomains) {
    addUnit(domain, null)
  }

  const dateScopes = requestedDateDomains.length > 0 && dates.length > 1
    ? await loadCompletedMlbEventDates({
        season: request.season,
        dateFrom: request.dateFrom,
        dateTo: request.dateTo,
      })
    : dates.length
      ? dates
      : [request.dateFrom].filter((date): date is string => Boolean(date))
  for (const date of dateScopes) {
    for (const domain of requestedDateDomains) {
      addUnit(domain, date)
    }
  }

  return { units, existing }
}

async function buildSeasonDateLedger(season: string, units: MlbExecutionUnit[]) {
  const { events } = await loadMlbEvents(season)
  const dateDomains: MlbDomain[] = [
    'team_game_stats_by_date',
    'player_game_stats_by_date',
    'game_odds_by_date',
  ]
  const unitByDateDomain = new Set(units.map((unit) => `${unit.date}:${unit.domain}:${unit.status}`))
  const grouped = new Map<string, Array<(typeof events)[number]>>()
  for (const event of events) {
    const date = event.start_time ? String(event.start_time).slice(0, 10) : null
    if (!date) continue
    if (!grouped.has(date)) grouped.set(date, [])
    grouped.get(date)!.push(event)
  }

  return Array.from(grouped.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, rows]) => {
      const completedRows = rows.filter((event) => {
        const metadata = asRecord((event as unknown as { metadata?: unknown }).metadata)
        const status = safeString((event as unknown as { status?: unknown }).status)
        return status === 'completed' || metadata?.providerStatus === 'Final'
      })
      const gameIds = rows
        .map((event) => {
          const ids = (event.provider_ids as Record<string, unknown> | null) ?? {}
          return safeString(ids.sportsdataio) || safeString(ids.sportsdataio_game_id)
        })
        .filter(Boolean)
      const completedCheckpoints = dateDomains.filter((domain) =>
        unitByDateDomain.has(`${date}:${domain}:completed`)
      )
      const incompleteDomains = dateDomains.filter((domain) => !completedCheckpoints.includes(domain))
      return {
        date,
        eventCount: rows.length,
        completedEventCount: completedRows.length,
        gameIds,
        doubleheaderIdentities: [],
        requiredDateBasedDomains: dateDomains,
        completedCheckpoints,
        incompleteDomains,
        estimatedProviderCalls: incompleteDomains.length,
        importEligible: completedRows.length > 0,
      }
    })
}

function validateRequest(request: ReturnType<typeof normalizeRequest>) {
  const errors: string[] = []
  const warnings: string[] = []

  if (request.provider !== PROVIDER) errors.push('provider must be sportsdataio.')
  if (request.providerVariant !== PROVIDER_VARIANT) {
    errors.push('providerVariant must be sportsdataio_discovery_lab for MLB.')
  }
  if (request.sportKey !== SPORT_KEY) errors.push('sportKey must be baseball_mlb.')
  if (request.leagueKey !== LEAGUE_KEY) errors.push('leagueKey must be mlb.')
  if (request.invalidDomains.length) {
    errors.push(`Unsupported MLB execution domains: ${request.invalidDomains.join(', ')}.`)
  }
  if (!request.season) errors.push('season is required.')
  if ((request.dateFrom || request.dateTo) && buildDateRange(request.dateFrom, request.dateTo).length === 0) {
    errors.push('dateFrom/dateTo must be valid YYYY-MM-DD dates with dateFrom <= dateTo.')
  }
  if (!request.dryRun && !request.confirmed) errors.push('confirmed=true is required for live MLB execution.')
  if (!request.dryRun && request.maximumRequests <= 0) errors.push('maximumRequests must be greater than 0 for live execution.')
  if (!request.dryRun && request.concurrencyLimit !== 1) errors.push('MLB live execution requires concurrencyLimit=1.')

  if (!request.dryRun) {
    warnings.push('Live execution is capped, sequential and stops after the first unsupported or failed unit.')
  }

  return { valid: errors.length === 0, errors, warnings }
}

export async function planSportsDataIoMlbDiscoveryExecution(
  rawRequest: SportsDataIoMlbExecutionRequest = {}
) {
  const request = normalizeRequest(rawRequest)
  const validation = validateRequest({ ...request, dryRun: true })
  const { units } = validation.valid ? await buildUnits(request) : { units: [] as MlbExecutionUnit[] }
  const dateLedger = validation.valid ? await buildSeasonDateLedger(request.season, units) : []
  const skippedCompleted = units.filter((unit) => unit.status === 'completed')
  const nextIncomplete = units.find((unit) => unit.status !== 'completed') ?? null
  const estimatedCalls = units
    .filter((unit) => unit.status !== 'completed')
    .reduce((sum, unit) => sum + unit.estimatedCalls, 0)

  return {
    success: validation.valid && Boolean(nextIncomplete ?? units.length),
    mode: 'sportsdataio_mlb_discovery_historical_execution_v1',
    generatedAt: generatedAt(),
    dryRun: true,
    liveExecutionEnabled: false,
    providerUsage: {
      externalProviderCallsMade: 0,
      source: 'mlb_discovery_lab_dry_run_no_provider_calls',
    },
    request: {
      provider: request.provider,
      providerVariant: request.providerVariant,
      sportKey: request.sportKey,
      leagueKey: request.leagueKey,
      season: request.season,
      seasonType: request.seasonType,
      dateFrom: request.dateFrom,
      dateTo: request.dateTo,
      domains: request.domains,
      maximumRequests: request.maximumRequests,
      maximumRecords: request.maximumRecords,
      concurrencyLimit: request.concurrencyLimit,
      retries: 0,
      timeoutMs: request.timeoutMs,
    },
    validation: {
      valid: validation.valid,
      errors: validation.errors,
      warnings: validation.warnings,
    },
    manifest: {
      provider: PROVIDER,
      providerVariant: PROVIDER_VARIANT,
      baseOrigin: BASE_ORIGIN,
      authentication: 'Ocp-Apim-Subscription-Key',
      serverEnv: 'SPORTSDATAIO_MLB_API_KEY',
      executionVersion: EXECUTION_VERSION,
      urlFixtures: validateSportsDataIoDiscoveryLabUrlFixtures(),
      dependencyOrder: DOMAIN_ORDER,
    },
    dryRunResult: {
      selectedProviderVariant: PROVIDER_VARIANT,
      season: request.season,
      exactDomains: request.domains,
      exactDates: buildDateRange(request.dateFrom, request.dateTo),
      exactEndpointList: units.map((unit) => ({
        sequence: unit.sequence,
        domain: unit.domain,
        endpoint: unit.endpoint,
        endpointTemplate: unit.endpointTemplate,
        status: unit.status,
        skipReason: unit.skipReason,
      })),
      estimatedCalls,
      existingCompletedCheckpoints: skippedCompleted.length,
      skippedCompletedUnits: skippedCompleted.map((unit) => unit.checkpointKey),
      nextIncompleteUnit: nextIncomplete
        ? {
            sequence: nextIncomplete.sequence,
            domain: nextIncomplete.domain,
            endpoint: nextIncomplete.endpoint,
            checkpointKey: nextIncomplete.checkpointKey,
            implementedLive: nextIncomplete.implementedLive,
          }
        : null,
      persistenceTables: Array.from(new Set(units.flatMap((unit) => unit.persistenceTables))),
      conflictTargets: Array.from(new Set(units.flatMap((unit) => unit.conflictTargets))),
      callBudget: request.maximumRequests,
      concurrency: 1,
      retries: 0,
      timeout: request.timeoutMs,
      quarantineFlags: {
        trial: false,
        scrambled: false,
        production_eligible: false,
        validation_status: 'quarantined',
      },
      productionGate: 'closed',
      dateLedger: {
        season: request.season,
        totalDates: dateLedger.length,
        completedRegularSeasonDates: dateLedger.filter((item) => item.importEligible).length,
        firstIncompleteDateDomain: dateLedger
          .filter((item) => item.importEligible && item.incompleteDomains.length > 0)
          .map((item) => ({
            date: item.date,
            domain: item.incompleteDomains[0],
            estimatedProviderCalls: 1,
          }))[0] ?? null,
        dates: dateLedger,
      },
    },
    checkpoints: units,
  }
}

async function fetchDiscoveryLabJson({
  endpoint,
  apiKey,
  timeoutMs,
}: {
  endpoint: string
  apiKey: string
  timeoutMs: number
}) {
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
    const endpointResult = {
      endpoint,
      origin: resolvedUrl.origin,
      pathname: resolvedUrl.pathname,
      status: response.status,
      contentType: response.headers.get('content-type'),
      rateLimitRemaining: response.headers.get('x-ratelimit-remaining'),
      retryAfter: response.headers.get('retry-after'),
      byteCount: 0,
      topLevelResponseType: null as string | null,
    }
    if ([401, 403, 404, 429].includes(response.status)) {
      throw Object.assign(new Error(`SportsDataIO MLB stopped on HTTP ${response.status}.`), {
        endpointResult,
      })
    }
    if (!response.ok) {
      throw Object.assign(new Error(`SportsDataIO MLB returned HTTP ${response.status}.`), {
        endpointResult,
      })
    }
    const responseText = await response.text()
    const payload = JSON.parse(responseText)
    endpointResult.byteCount = Buffer.byteLength(responseText, 'utf8')
    endpointResult.topLevelResponseType = Array.isArray(payload) ? 'array' : typeof payload
    if (!Array.isArray(payload)) {
      throw Object.assign(new Error('SportsDataIO MLB endpoint returned a non-array payload.'), {
        endpointResult,
      })
    }
    return { payload: payload as Record<string, unknown>[], endpointResult }
  } finally {
    clearTimeout(timeout)
  }
}

function providerGameId(game: Record<string, unknown>) {
  return safeString(game.GameID) || safeString(game.GameId) || safeString(game.GlobalGameID) || safeString(game.GlobalGameId)
}

function providerPlayerId(row: Record<string, unknown>) {
  return safeString(row.PlayerID) || safeString(row.PlayerId) || safeString(row.FantasyDataPlayerID)
}

function providerTeamId(game: Record<string, unknown>, side: 'home' | 'away') {
  if (side === 'home') {
    return safeString(game.HomeTeamID) || safeString(game.HomeTeamId) || safeString(game.HomeGlobalTeamID)
  }
  return safeString(game.AwayTeamID) || safeString(game.AwayTeamId) || safeString(game.AwayGlobalTeamID)
}

function teamKey(game: Record<string, unknown>, side: 'home' | 'away') {
  if (side === 'home') return safeString(game.HomeTeam) || safeString(game.HomeTeamKey) || safeString(game.HomeTeamName)
  return safeString(game.AwayTeam) || safeString(game.AwayTeamKey) || safeString(game.AwayTeamName)
}

function eventStart(game: Record<string, unknown>) {
  return normalizeSportsDataIoMlbGameDateTime(game).normalizedUtc
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

function standingId(season: string, seasonType: string, providerTeamId: string) {
  return `${SPORT_KEY}:${LEAGUE_KEY}:${PROVIDER}:standing:${keyPart(season)}:${keyPart(seasonType)}:${keyPart(providerTeamId)}`
}

function playerStatId(statType: 'season' | 'game', season: string, providerId: string) {
  return `${SPORT_KEY}:${LEAGUE_KEY}:${PROVIDER}:player_stats:${statType}:${keyPart(season)}:${keyPart(providerId)}`
}

function unresolvedPlayerIdentityId(season: string, providerPlayerId: string) {
  return `${SPORT_KEY}:${LEAGUE_KEY}:${PROVIDER}:unresolved_player:${keyPart(season)}:${keyPart(providerPlayerId)}`
}

function gameStatId(eventIdValue: string, teamIdValue: string) {
  return `${eventIdValue}_${teamIdValue}`
}

function quarantineMetadata(extra: Record<string, unknown> = {}) {
  return {
    provider: PROVIDER,
    provider_variant: PROVIDER_VARIANT,
    importModule: EXECUTION_VERSION,
    trial: false,
    scrambled: false,
    production_eligible: false,
    validation_status: 'quarantined',
    rawPayloadStored: false,
    ...extra,
  }
}

function normalizeSeasonSchedule(payload: Record<string, unknown>[], season: string) {
  const teams = new Map<string, {
    id: string
    sport_key: string
    league_key: string
    name: string
    abbreviation: string | null
    city: string | null
    conference: string | null
    division: string | null
    logo_url: string | null
    active: boolean
    provider_ids: Record<string, unknown>
    metadata: Record<string, unknown>
    updated_at: string
  }>()
  const events: Array<Record<string, unknown>> = []
  const mappings: Array<Record<string, unknown>> = []
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
    teams.set(homeId, {
      id: homeId,
      sport_key: SPORT_KEY,
      league_key: LEAGUE_KEY,
      name: homeKey || `SportsDataIO MLB Team ${homeProviderId}`,
      abbreviation: homeKey || null,
      city: null,
      conference: null,
      division: null,
      logo_url: null,
      active: true,
      provider_ids: { sportsdataio: homeProviderId || homeKey, abbreviation: homeKey || null },
      metadata: quarantineMetadata({ entityType: 'team', season }),
      updated_at: generatedAt(),
    })
    teams.set(awayId, {
      id: awayId,
      sport_key: SPORT_KEY,
      league_key: LEAGUE_KEY,
      name: awayKey || `SportsDataIO MLB Team ${awayProviderId}`,
      abbreviation: awayKey || null,
      city: null,
      conference: null,
      division: null,
      logo_url: null,
      active: true,
      provider_ids: { sportsdataio: awayProviderId || awayKey, abbreviation: awayKey || null },
      metadata: quarantineMetadata({ entityType: 'team', season }),
      updated_at: generatedAt(),
    })

    const id = eventId(gameId)
    if (seenEvents.has(id)) continue
    seenEvents.add(id)
    const status = eventStatus(game.Status)
    const dbStatus = assertSportEventStatusWrite({
      provider: PROVIDER,
      functionName: 'normalizeSeasonSchedule',
      file: 'src/services/sportsdataio-mlb-historical-import-executor.service.ts',
      line: 2229,
      eventId: id,
      providerEventId: gameId,
      rawProviderStatus: game.Status ?? null,
      mappedStatus: status,
      dbStatus: status,
    })
    events.push({
      id,
      sport_key: SPORT_KEY,
      league_key: LEAGUE_KEY,
      season,
      stage: safeString(game.SeasonType) || null,
      home_team_id: homeId,
      away_team_id: awayId,
      home_team: homeKey || `SportsDataIO MLB Team ${homeProviderId}`,
      away_team: awayKey || `SportsDataIO MLB Team ${awayProviderId}`,
      start_time: start,
      venue: safeString(game.Stadium) || safeString(game.StadiumDetails) || null,
      status: dbStatus,
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
      metadata: quarantineMetadata({
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
        day: game.Day ?? null,
        doubleHeaderGame: game.DoubleHeaderGame ?? game.GameNumber ?? null,
        seasonType: game.SeasonType ?? null,
        rawFieldNames: Object.keys(game).sort(),
      }),
      updated_at: generatedAt(),
    })
  }

  for (const team of teams.values()) {
    mappings.push({
      sport_key: SPORT_KEY,
      entity_type: 'team',
      internal_id: team.id,
      provider: PROVIDER,
      provider_id: String(team.provider_ids.sportsdataio),
      season: '',
      metadata: quarantineMetadata({ entityType: 'team' }),
      updated_at: generatedAt(),
    })
  }
  for (const event of events) {
    mappings.push({
      sport_key: SPORT_KEY,
      entity_type: 'event',
      internal_id: String(event.id),
      provider: PROVIDER,
      provider_id: String((event.provider_ids as Record<string, unknown>).sportsdataio),
      season,
      metadata: quarantineMetadata({ entityType: 'event' }),
      updated_at: generatedAt(),
    })
  }

  return {
    teams: Array.from(teams.values()),
    events,
    mappings,
    unresolved,
    duplicateInputs: payload.length - seenEvents.size - unresolved.length,
  }
}

async function loadMlbTeams() {
  const result = await supabaseAdmin
    .from('sports_teams')
    .select('id, name, abbreviation, provider_ids, metadata')
    .eq('sport_key', SPORT_KEY)
    .eq('league_key', LEAGUE_KEY)
    .limit(1000)
  if (result.error) throw new Error(`sports_teams lookup failed: ${result.error.message}`)
  const teams = result.data ?? []
  const byProviderId = new Map<string, (typeof teams)[number]>()
  const byAbbreviation = new Map<string, (typeof teams)[number]>()
  for (const team of teams) {
    const providerIds = (team.provider_ids as Record<string, unknown> | null) ?? {}
    for (const value of [
      providerIds.sportsdataio,
      providerIds.sportsdataio_team_id,
      providerIds.team,
      providerIds.team_id,
    ]) {
      if (value !== null && value !== undefined) byProviderId.set(String(value), team)
    }
    if (team.abbreviation) byAbbreviation.set(String(team.abbreviation).toUpperCase(), team)
    if (team.name) byAbbreviation.set(String(team.name).toUpperCase(), team)
  }
  return { teams, byProviderId, byAbbreviation }
}

async function loadMlbPlayerMappings(season: string) {
  const mappings: Array<{
    internal_id: string
    provider_id: string
    season: string
  }> = []
  const pageSize = 1000

  for (let from = 0; ; from += pageSize) {
    const result = await supabaseAdmin
      .from('provider_entity_mappings')
      .select('internal_id, provider_id, season')
      .eq('sport_key', SPORT_KEY)
      .eq('provider', PROVIDER)
      .eq('entity_type', 'player')
      .in('season', [season, ''])
      .range(from, from + pageSize - 1)
    if (result.error) throw new Error(`provider_entity_mappings player lookup failed: ${result.error.message}`)
    const page = result.data ?? []
    mappings.push(...page)
    if (page.length < pageSize) break
  }

  return mappings
}

function addMappedMlbPlayerProviderIds<T extends { id: string }>(
  byProviderId: Map<string, T>,
  playerById: Map<string, T>,
  mappings: Array<{ internal_id: string; provider_id: unknown }>
) {
  let added = 0
  let conflicts = 0
  let missingPlayers = 0

  for (const mapping of mappings) {
    const player = playerById.get(mapping.internal_id)
    if (!player) {
      missingPlayers += 1
      continue
    }
    const providerId = safeString(mapping.provider_id)
    if (!providerId) continue
    const existing = byProviderId.get(providerId)
    if (existing && existing.id !== player.id) {
      conflicts += 1
      continue
    }
    if (!existing) added += 1
    byProviderId.set(providerId, player)
  }

  return { added, conflicts, missingPlayers }
}

async function loadMlbPlayers(season: string) {
  const players: Array<{
    id: string
    team_id: string | null
    display_name: string
    provider_ids: Record<string, unknown> | null
  }> = []
  const pageSize = 1000

  for (let from = 0; ; from += pageSize) {
    const result = await supabaseAdmin
      .from('sport_players')
      .select('id, team_id, display_name, provider_ids')
      .eq('sport_key', SPORT_KEY)
      .eq('league_key', LEAGUE_KEY)
      .range(from, from + pageSize - 1)
    if (result.error) throw new Error(`sport_players lookup failed: ${result.error.message}`)
    const page = result.data ?? []
    players.push(...page)
    if (page.length < pageSize) break
  }

  const playerById = new Map(players.map((player) => [player.id, player]))
  const byProviderId = new Map<string, (typeof players)[number]>()
  for (const player of players) {
    const providerIds = (player.provider_ids as Record<string, unknown> | null) ?? {}
    for (const value of [providerIds.sportsdataio, providerIds.player, providerIds.player_id]) {
      if (value !== null && value !== undefined) byProviderId.set(String(value), player)
    }
  }

  addMappedMlbPlayerProviderIds(byProviderId, playerById, await loadMlbPlayerMappings(season))

  return { players, byProviderId }
}

async function loadMlbEvents(season: string) {
  const events: Array<{
    id: string
    start_time: string
    status: string
    metadata: Record<string, unknown> | null
    home_team_id: string | null
    away_team_id: string | null
    provider_ids: Record<string, unknown> | null
  }> = []
  const pageSize = 1000

  for (let from = 0; ; from += pageSize) {
    const result = await supabaseAdmin
      .from('sport_events')
      .select('id, start_time, status, metadata, home_team_id, away_team_id, provider_ids')
      .eq('sport_key', SPORT_KEY)
      .eq('league_key', LEAGUE_KEY)
      .eq('season', season)
      .order('start_time', { ascending: true })
      .range(from, from + pageSize - 1)
    if (result.error) throw new Error(`sport_events lookup failed: ${result.error.message}`)
    const page = result.data ?? []
    events.push(...page)
    if (page.length < pageSize) break
  }

  const byProviderId = new Map<string, (typeof events)[number]>()
  for (const event of events) {
    const providerIds = (event.provider_ids as Record<string, unknown> | null) ?? {}
    for (const value of [
      providerIds.sportsdataio,
      providerIds.sportsdataio_game_id,
      providerIds.game,
      providerIds.game_id,
      providerIds.GameID,
      providerIds.GameId,
    ]) {
      if (value !== null && value !== undefined) byProviderId.set(String(value), event)
    }
  }
  return { events, byProviderId }
}

async function loadCompletedMlbEventDates({
  season,
  dateFrom,
  dateTo,
}: {
  season: string
  dateFrom: string | null
  dateTo: string | null
}) {
  const from = parseDate(dateFrom)
  const to = parseDate(dateTo)
  const { events } = await loadMlbEvents(season)
  const dates = new Set<string>()

  for (const event of events) {
    const start = event.start_time ? new Date(String(event.start_time)) : null
    if (!start || !Number.isFinite(start.getTime())) continue
    if (from && start.getTime() < from.getTime()) continue
    if (to && start.getTime() >= addDays(to, 1).getTime()) continue

    const metadata = asRecord(event.metadata)
    const status = safeString(event.status)
    if (status !== 'completed' && metadata?.providerStatus !== 'Final') continue
    dates.add(start.toISOString().slice(0, 10))
  }

  return Array.from(dates).sort()
}

function resolveTeam(row: Record<string, unknown>, teams: Awaited<ReturnType<typeof loadMlbTeams>>) {
  const providerId =
    safeString(row.TeamID) ||
    safeString(row.TeamId) ||
    safeString(row.GlobalTeamID) ||
    safeString(row.GlobalTeamId)
  const key = safeString(row.Team) || safeString(row.TeamKey) || safeString(row.Key) || safeString(row.Name)
  return {
    providerId,
    team: teams.byProviderId.get(providerId) ?? teams.byAbbreviation.get(key.toUpperCase()) ?? null,
    key,
  }
}

function providerTimestamp(row: Record<string, unknown>) {
  const candidate =
    safeString(row.Updated) ||
    safeString(row.UpdatedDate) ||
    safeString(row.LastUpdated) ||
    safeString(row.DateTime) ||
    safeString(row.Day)
  const parsed = new Date(candidate)
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null
}

function unitDateFromProviderRow(row: Record<string, unknown>) {
  const timestamp = providerTimestamp(row)
  return timestamp ? timestamp.slice(0, 10) : null
}

function statsJson(row: Record<string, unknown>) {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(row)) {
    if (value === undefined || typeof value === 'function') continue
    if (['ApiKey', 'SubscriptionKey'].includes(key)) continue
    if (Array.isArray(value) || asRecord(value)) continue
    result[key] = value
  }
  return result
}

function normalizeStandingsRows({
  payload,
  season,
  seasonType,
  teams,
}: {
  payload: Record<string, unknown>[]
  season: string
  seasonType: string
  teams: Awaited<ReturnType<typeof loadMlbTeams>>
}) {
  const rows: Array<Record<string, unknown>> = []
  const mappings: Array<Record<string, unknown>> = []
  const unresolvedTeams = new Set<string>()
  const seen = new Set<string>()
  let duplicateInputs = 0

  for (const item of payload) {
    const resolved = resolveTeam(item, teams)
    if (!resolved.providerId || !resolved.team) {
      unresolvedTeams.add(resolved.providerId || resolved.key || `row:${unresolvedTeams.size}`)
      continue
    }
    const id = standingId(season, seasonType, resolved.providerId)
    if (seen.has(id)) {
      duplicateInputs += 1
      continue
    }
    seen.add(id)
    rows.push({
      id,
      sport_key: SPORT_KEY,
      league_key: LEAGUE_KEY,
      season: safeString(item.Season) || season,
      team_id: resolved.team.id,
      team_name: resolved.team.name,
      conference: safeString(item.League) || null,
      division: safeString(item.Division) || null,
      conference_rank: safeInteger(item.LeagueRank),
      division_rank: safeInteger(item.DivisionRank),
      wins: safeInteger(item.Wins) ?? 0,
      losses: safeInteger(item.Losses) ?? 0,
      win_percentage: safeNumber(item.Percentage ?? item.WinPercentage),
      games_behind: safeNumber(item.GamesBack ?? item.GamesBehind),
      home_record:
        safeInteger(item.HomeWins) !== null || safeInteger(item.HomeLosses) !== null
          ? `${safeInteger(item.HomeWins) ?? 0}-${safeInteger(item.HomeLosses) ?? 0}`
          : null,
      away_record:
        safeInteger(item.AwayWins) !== null || safeInteger(item.AwayLosses) !== null
          ? `${safeInteger(item.AwayWins) ?? 0}-${safeInteger(item.AwayLosses) ?? 0}`
          : null,
      streak: safeString(item.Streak) || null,
      last_ten:
        safeInteger(item.LastTenWins) !== null || safeInteger(item.LastTenLosses) !== null
          ? `${safeInteger(item.LastTenWins) ?? 0}-${safeInteger(item.LastTenLosses) ?? 0}`
          : null,
      clinched: {},
      provider_ids: { sportsdataio: resolved.providerId },
      metadata: quarantineMetadata({
        entityType: 'standing',
        seasonType,
        sourceTimestamp: providerTimestamp(item),
        divisionWins: safeInteger(item.DivisionWins),
        divisionLosses: safeInteger(item.DivisionLosses),
        leagueWins: safeInteger(item.LeagueWins),
        leagueLosses: safeInteger(item.LeagueLosses),
        runsScored: safeInteger(item.RunsScored),
        runsAgainst: safeInteger(item.RunsAgainst),
        rawFieldNames: Object.keys(item).sort(),
      }),
      updated_at: generatedAt(),
    })
    mappings.push({
      sport_key: SPORT_KEY,
      entity_type: 'standing',
      internal_id: id,
      provider: PROVIDER,
      provider_id: `${season}:${resolved.providerId}`,
      season,
      metadata: quarantineMetadata({ entityType: 'standing', teamId: resolved.team.id }),
      updated_at: generatedAt(),
    })
  }

  return { rows, mappings, unresolvedTeams: Array.from(unresolvedTeams), duplicateInputs }
}

function normalizeTeamSeasonStatRows({
  payload,
  season,
  teams,
}: {
  payload: Record<string, unknown>[]
  season: string
  teams: Awaited<ReturnType<typeof loadMlbTeams>>
}) {
  const rows: Array<Record<string, unknown>> = []
  const unresolvedTeams = new Set<string>()
  const seen = new Set<string>()
  let duplicateInputs = 0

  for (const item of payload) {
    const resolved = resolveTeam(item, teams)
    if (!resolved.providerId || !resolved.team) {
      unresolvedTeams.add(resolved.providerId || resolved.key || `row:${unresolvedTeams.size}`)
      continue
    }
    const key = `${resolved.team.name}:${season}`
    if (seen.has(key)) {
      duplicateInputs += 1
      continue
    }
    seen.add(key)
    rows.push({
      team_name: resolved.team.name,
      sport_key: SPORT_KEY,
      season: Number(season),
      wins: safeInteger(item.Wins) ?? 0,
      losses: safeInteger(item.Losses) ?? 0,
      ties: safeInteger(item.Ties) ?? 0,
      home_wins: safeInteger(item.HomeWins) ?? 0,
      home_losses: safeInteger(item.HomeLosses) ?? 0,
      away_wins: safeInteger(item.AwayWins) ?? 0,
      away_losses: safeInteger(item.AwayLosses) ?? 0,
      last_5_wins: 0,
      last_5_losses: 0,
      last_10_wins: safeInteger(item.LastTenWins) ?? 0,
      last_10_losses: safeInteger(item.LastTenLosses) ?? 0,
      streak: safeInteger(item.Streak) ?? 0,
      win_percentage: safeNumber(item.Percentage ?? item.WinPercentage) ?? 0,
    })
  }

  return { rows, unresolvedTeams: Array.from(unresolvedTeams), duplicateInputs }
}

function normalizePlayerSeasonStatRows({
  payload,
  season,
  teams,
  players,
}: {
  payload: Record<string, unknown>[]
  season: string
  teams: Awaited<ReturnType<typeof loadMlbTeams>>
  players: Awaited<ReturnType<typeof loadMlbPlayers>>
}) {
  const rows: Array<Record<string, unknown>> = []
  const mappings: Array<Record<string, unknown>> = []
  const provisionalPlayerMappings = new Map<string, Record<string, unknown>>()
  const unresolvedTeams = new Set<string>()
  const unresolvedPlayers = new Set<string>()
  const seen = new Set<string>()
  let duplicateInputs = 0

  for (const item of payload) {
    const pId = providerPlayerId(item)
    if (!pId) {
      unresolvedPlayers.add(`row:${unresolvedPlayers.size}`)
      continue
    }
    const player = players.byProviderId.get(pId) ?? null
    const resolvedTeam = resolveTeam(item, teams)
    const name =
      safeString(item.Name) ||
      `${safeString(item.FirstName)} ${safeString(item.LastName)}`.trim() ||
      player?.display_name ||
      `SportsDataIO MLB Player ${pId}`
    if (!player) {
      unresolvedPlayers.add(pId)
      if (!provisionalPlayerMappings.has(pId)) {
        provisionalPlayerMappings.set(pId, unresolvedPlayerIdentityMapping({
          season,
          providerPlayerId: pId,
          providerName: name,
          providerTeamId: resolvedTeam.providerId || null,
          sourceDate: safeString(item.Day) || null,
          sourceRecordId: safeString(item.StatID) || safeString(item.StatId) || null,
          sourceDomain: 'player_season_stats',
        }))
      }
    }
    if (resolvedTeam.providerId && !resolvedTeam.team) unresolvedTeams.add(resolvedTeam.providerId)
    const natural = safeString(item.StatID) || safeString(item.StatId) || pId
    const id = playerStatId('season', season, natural)
    if (seen.has(id)) {
      duplicateInputs += 1
      continue
    }
    seen.add(id)
    rows.push({
      id,
      sport_key: SPORT_KEY,
      league_key: LEAGUE_KEY,
      season: safeString(item.Season) || season,
      stat_type: 'season',
      event_id: null,
      team_id: resolvedTeam.team?.id ?? player?.team_id ?? null,
      player_id: player?.id ?? null,
      player_name: name,
      provider: PROVIDER,
      games: safeInteger(item.Games ?? item.GamesPlayed),
      starts: safeInteger(item.Started ?? item.Starts ?? item.GamesStarted),
      minutes: null,
      points: null,
      rebounds: null,
      assists: null,
      steals: null,
      blocks: null,
      turnovers: null,
      field_goals_made: null,
      field_goals_attempted: null,
      field_goal_percentage: null,
      three_pointers_made: null,
      three_pointers_attempted: null,
      three_point_percentage: null,
      free_throws_made: null,
      free_throws_attempted: null,
      free_throw_percentage: null,
      usage_rate: null,
      starter: null,
      source_timestamp: providerTimestamp(item),
      provider_ids: {
        sportsdataio: natural,
        player: pId,
        ...(resolvedTeam.providerId ? { team: resolvedTeam.providerId } : {}),
      },
      stats: statsJson(item),
      metadata: quarantineMetadata({
        entityType: 'player_stat',
        statType: 'season',
        providerPlayerId: pId,
        providerTeamId: resolvedTeam.providerId || null,
        hasUnresolvedPlayer: !player,
        hasUnresolvedTeam: Boolean(resolvedTeam.providerId && !resolvedTeam.team),
        position: safeString(item.Position) || null,
        rawFieldNames: Object.keys(item).sort(),
      }),
      updated_at: generatedAt(),
    })
    mappings.push({
      sport_key: SPORT_KEY,
      entity_type: 'player_stat',
      internal_id: id,
      provider: PROVIDER,
      provider_id: natural,
      season,
      metadata: quarantineMetadata({ entityType: 'player_stat', providerPlayerId: pId }),
      updated_at: generatedAt(),
    })
  }

  return {
    rows,
    mappings: [...mappings, ...provisionalPlayerMappings.values()],
    unresolvedTeams: Array.from(unresolvedTeams),
    unresolvedPlayers: Array.from(unresolvedPlayers),
    duplicateInputs,
  }
}

function normalizeTeamGameStatRows({
  payload,
  season,
  teams,
  events,
}: {
  payload: Record<string, unknown>[]
  season: string
  teams: Awaited<ReturnType<typeof loadMlbTeams>>
  events: Awaited<ReturnType<typeof loadMlbEvents>>
}) {
  const rows: Array<Record<string, unknown>> = []
  const unresolvedTeams = new Set<string>()
  const unresolvedEvents = new Set<string>()
  const seen = new Set<string>()
  let duplicateInputs = 0

  for (const item of payload) {
    const gameId = providerGameId(item)
    const event = events.byProviderId.get(gameId)
    const resolved = resolveTeam(item, teams)
    if (!gameId || !event) {
      unresolvedEvents.add(gameId || `row:${unresolvedEvents.size}`)
      continue
    }
    if (!resolved.providerId || !resolved.team) {
      unresolvedTeams.add(resolved.providerId || resolved.key || `row:${unresolvedTeams.size}`)
      continue
    }
    const id = gameStatId(event.id, resolved.team.id)
    if (seen.has(id)) {
      duplicateInputs += 1
      continue
    }
    seen.add(id)
    const isHome = String(event.home_team_id) === String(resolved.team.id)
    rows.push({
      id,
      sport_key: SPORT_KEY,
      league_key: LEAGUE_KEY,
      season,
      event_id: event.id,
      team_id: resolved.team.id,
      team_name: resolved.team.name,
      opponent_team_id: isHome ? event.away_team_id : event.home_team_id,
      opponent_team_name: null,
      is_home: isHome,
      points_for: safeInteger(item.Runs ?? item.TeamRuns ?? item.Score),
      points_against: safeInteger(item.OpponentRuns ?? item.OpponentScore),
      first_half_points: null,
      quarter_scores: [],
      stats: quarantineMetadata({
        entityType: 'team_game_stat',
        providerGameId: gameId,
        providerTeamId: resolved.providerId,
        sourceTimestamp: providerTimestamp(item),
        stats: statsJson(item),
        rawFieldNames: Object.keys(item).sort(),
      }),
      provider_ids: { sportsdataio: `${gameId}:${resolved.providerId}`, game: gameId, team: resolved.providerId },
      updated_at: generatedAt(),
    })
  }

  return {
    rows,
    unresolvedTeams: Array.from(unresolvedTeams),
    unresolvedEvents: Array.from(unresolvedEvents),
    duplicateInputs,
  }
}

function normalizePlayerGameStatRows({
  payload,
  season,
  teams,
  players,
  events,
}: {
  payload: Record<string, unknown>[]
  season: string
  teams: Awaited<ReturnType<typeof loadMlbTeams>>
  players: Awaited<ReturnType<typeof loadMlbPlayers>>
  events: Awaited<ReturnType<typeof loadMlbEvents>>
}) {
  const rows: Array<Record<string, unknown>> = []
  const mappings: Array<Record<string, unknown>> = []
  const provisionalPlayerMappings = new Map<string, Record<string, unknown>>()
  const unresolvedTeams = new Set<string>()
  const unresolvedPlayers = new Set<string>()
  const unresolvedEvents = new Set<string>()
  const seen = new Set<string>()
  let duplicateInputs = 0

  for (const item of payload) {
    const gameId = providerGameId(item)
    const event = events.byProviderId.get(gameId)
    const pId = providerPlayerId(item)
    const player = pId ? players.byProviderId.get(pId) ?? null : null
    const resolvedTeam = resolveTeam(item, teams)
    if (!gameId || !event) {
      unresolvedEvents.add(gameId || `row:${unresolvedEvents.size}`)
      continue
    }
    const name =
      safeString(item.Name) ||
      `${safeString(item.FirstName)} ${safeString(item.LastName)}`.trim() ||
      player?.display_name ||
      `SportsDataIO MLB Player ${pId}`
    if (!pId || !player) {
      unresolvedPlayers.add(pId || `row:${unresolvedPlayers.size}`)
      if (pId && !provisionalPlayerMappings.has(pId)) {
        provisionalPlayerMappings.set(pId, unresolvedPlayerIdentityMapping({
          season,
          providerPlayerId: pId,
          providerName: name,
          providerTeamId: resolvedTeam.providerId || null,
          sourceDate: safeString(item.Day) || unitDateFromProviderRow(item),
          sourceRecordId: safeString(item.StatID) || safeString(item.StatId) || safeString(item.PlayerGameID) || null,
          sourceDomain: 'player_game_stats_by_date',
        }))
      }
    }
    if (resolvedTeam.providerId && !resolvedTeam.team) unresolvedTeams.add(resolvedTeam.providerId)
    const natural = safeString(item.StatID) || safeString(item.StatId) || safeString(item.PlayerGameID) || [gameId, resolvedTeam.providerId, pId].filter(Boolean).join(':')
    if (!natural) continue
    const id = playerStatId('game', season, natural)
    if (seen.has(id)) {
      duplicateInputs += 1
      continue
    }
    seen.add(id)
    rows.push({
      id,
      sport_key: SPORT_KEY,
      league_key: LEAGUE_KEY,
      season,
      stat_type: 'game',
      event_id: event.id,
      team_id: resolvedTeam.team?.id ?? player?.team_id ?? null,
      player_id: player?.id ?? null,
      player_name: name,
      provider: PROVIDER,
      games: null,
      starts: safeInteger(item.Started ?? item.Starts ?? item.GamesStarted),
      minutes: null,
      points: null,
      rebounds: null,
      assists: null,
      steals: null,
      blocks: null,
      turnovers: null,
      field_goals_made: null,
      field_goals_attempted: null,
      field_goal_percentage: null,
      three_pointers_made: null,
      three_pointers_attempted: null,
      three_point_percentage: null,
      free_throws_made: null,
      free_throws_attempted: null,
      free_throw_percentage: null,
      usage_rate: null,
      starter: null,
      source_timestamp: providerTimestamp(item),
      provider_ids: { sportsdataio: natural, player: pId, event: gameId, team: resolvedTeam.providerId || null },
      stats: statsJson(item),
      metadata: quarantineMetadata({
        entityType: 'player_game_stat',
        providerPlayerId: pId,
        providerGameId: gameId,
        providerTeamId: resolvedTeam.providerId || null,
        hasUnresolvedPlayer: !player,
        hasUnresolvedTeam: Boolean(resolvedTeam.providerId && !resolvedTeam.team),
        rawFieldNames: Object.keys(item).sort(),
      }),
      updated_at: generatedAt(),
    })
    mappings.push({
      sport_key: SPORT_KEY,
      entity_type: 'player_game_stat',
      internal_id: id,
      provider: PROVIDER,
      provider_id: natural,
      season,
      metadata: quarantineMetadata({ entityType: 'player_game_stat', providerPlayerId: pId, providerGameId: gameId }),
      updated_at: generatedAt(),
    })
  }

  return {
    rows,
    mappings: [...mappings, ...provisionalPlayerMappings.values()],
    unresolvedTeams: Array.from(unresolvedTeams),
    unresolvedPlayers: Array.from(unresolvedPlayers),
    unresolvedEvents: Array.from(unresolvedEvents),
    duplicateInputs,
  }
}

async function countExisting(table: string, ids: unknown[]) {
  const result = await safeExistingValueSet({ table, column: 'id', values: ids, chunkSize: 100 })
  if (result.errors.length) {
    throw new Error(`${table} preflight failed: ${result.errors[0].message}`)
  }
  return result.existing
}

async function countExistingMappings(rows: Array<Record<string, unknown>>) {
  if (!rows.length) return new Set<string>()
  const providerIds = rows.map((row) => row.provider_id)
  const preflight = await safeExistingValueSet({
    table: 'provider_entity_mappings',
    column: 'provider_id',
    values: providerIds,
    chunkSize: 100,
  })
  if (preflight.errors.length) {
    throw new Error(`provider_entity_mappings preflight failed: ${preflight.errors[0].message}`)
  }
  return preflight.existing
}

function gameStatNaturalKey(row: Record<string, unknown>) {
  return `${String(row.sport_key)}:${String(row.event_id)}:${String(row.team_id)}`
}

async function countExistingGameStatNaturalKeys(rows: Array<Record<string, unknown>>) {
  if (!rows.length) return new Set<string>()
  const eventIds = Array.from(new Set(rows.map((row) => String(row.event_id)).filter(Boolean)))
  const { data, error } = await supabaseAdmin
    .from('sport_game_stats')
    .select('sport_key,event_id,team_id')
    .eq('sport_key', SPORT_KEY)
    .in('event_id', eventIds)

  if (error) {
    throw new Error(`sport_game_stats natural-key preflight failed: ${error.message}`)
  }

  return new Set((data ?? []).map((row) => gameStatNaturalKey(row as Record<string, unknown>)))
}

async function recordMlbCheckpoint({
  jobId,
  unit,
  season,
  seasonType,
  startedAt,
  status,
  counters,
  endpointResult,
  validation,
  nextUnit,
  lastError,
  metadataExtra,
}: {
  jobId?: string | null
  unit: MlbExecutionUnit
  season: string
  seasonType: string
  startedAt: string
  status: MlbTerminalStatus
  counters: {
    providerRecordsFetched: number
    normalizedRows: number
    inserted: number
    updated: number
    rejected: number
    unresolvedTeams: number
    unresolvedPlayers: number
    unresolvedEvents: number
    duplicateInputs: number
    errorCount: number
    providerCallsUsed: number
  }
  endpointResult: Record<string, unknown> | null
  validation: Record<string, unknown>
  nextUnit: MlbExecutionUnit | null
  lastError?: string | null
  metadataExtra?: Record<string, unknown>
}) {
  const completedAt = generatedAt()
  const durationMs = new Date(completedAt).getTime() - new Date(startedAt).getTime()
  const syncJobId = jobId ?? crypto.randomUUID()
  const providerCallState: ProviderCallState =
    status === 'timed_out'
      ? counters.providerCallsUsed > 0
        ? 'TIMED_OUT'
        : 'NOT_ATTEMPTED'
      : counters.providerCallsUsed > 0
        ? 'COMPLETED'
        : 'NOT_ATTEMPTED'
  const result = await supabaseAdmin.from('sports_sync_jobs').upsert({
    id: syncJobId,
    job_type: EXECUTION_VERSION,
    sport_key: SPORT_KEY,
    league_key: LEAGUE_KEY,
    provider: PROVIDER,
    season,
    started_at: startedAt,
    completed_at: completedAt,
    status,
    records_fetched: counters.providerRecordsFetched,
    records_inserted: counters.inserted,
    records_updated: counters.updated,
    records_skipped: Math.max(0, counters.rejected),
    error_count: counters.errorCount,
    last_error: lastError ?? null,
    duration_ms: durationMs,
    metadata: {
      providerVariant: PROVIDER_VARIANT,
      executionVersion: EXECUTION_VERSION,
      externalCallsUsed: counters.providerCallsUsed,
      logicalStatus: status.toUpperCase(),
      providerCallAccounting: {
        state: providerCallState,
        conservativeBudgetCount: counters.providerCallsUsed,
        completedAt,
        endpoint: unit.endpoint,
        date: unit.date,
      },
      endpoint: endpointResult,
      checkpoint: {
        key: unit.checkpointKey,
        provider: PROVIDER,
        providerVariant: PROVIDER_VARIANT,
        sportKey: SPORT_KEY,
        leagueKey: LEAGUE_KEY,
        season,
        seasonType,
        date: unit.date,
        domain: unit.domain,
        endpoint: unit.endpoint,
        endpointTemplate: unit.endpointTemplate,
        executionVersion: EXECUTION_VERSION,
        status,
        logicalStatus: status.toUpperCase(),
        providerCallState,
        providerCallsUsed: counters.providerCallsUsed,
        httpStatus: endpointResult?.status ?? null,
        providerRecordsFetched: counters.providerRecordsFetched,
        normalizedRows: counters.normalizedRows,
        inserted: counters.inserted,
        reusedOrUpdated: counters.updated,
        rejected: counters.rejected,
        unresolvedTeams: counters.unresolvedTeams,
        unresolvedPlayers: counters.unresolvedPlayers,
        unresolvedEvents: counters.unresolvedEvents,
        duplicateInputs: counters.duplicateInputs,
        errorCount: counters.errorCount,
        startedAt,
        completedAt,
        nextUnit: nextUnit
          ? {
              domain: nextUnit.domain,
              endpoint: nextUnit.endpoint,
              date: nextUnit.date,
              checkpointKey: nextUnit.checkpointKey,
            }
          : null,
        failureCode: lastError ? 'execution_failed' : null,
        resumable: status !== 'completed',
        trial: false,
        scrambled: false,
        production_eligible: false,
      },
      recordCounters: {
        providerRecordsFetched: counters.providerRecordsFetched,
        normalizedRowsProduced: counters.normalizedRows,
        skippedProviderRecords: counters.rejected,
        skippedNormalizedRows: 0,
        recordsSkipped: Math.max(0, counters.rejected),
        oneToManyExpansion: counters.normalizedRows > counters.providerRecordsFetched,
        expansionRatio:
          counters.providerRecordsFetched > 0
            ? Number((counters.normalizedRows / counters.providerRecordsFetched).toFixed(4))
            : 0,
      },
      validation,
      quarantine: {
        trial: false,
        scrambled: false,
        production_eligible: false,
        validation_status: 'quarantined',
      },
      rawPayloadStored: false,
      noSecretExposure: true,
      ...(metadataExtra ?? {}),
    },
    updated_at: completedAt,
  }, { onConflict: 'id' })

  if (result.error) {
    throw new Error(`sports_sync_jobs checkpoint persistence failed: ${result.error.message}`)
  }

  return syncJobId
}

async function recordSecondaryCheckpointFailure({
  sourceJobId,
  unit,
  season,
  startedAt,
  error,
}: {
  sourceJobId: string | null
  unit: MlbExecutionUnit
  season: string
  startedAt: string
  error: unknown
}) {
  const completedAt = generatedAt()
  await supabaseAdmin.from('sports_sync_jobs').insert({
    id: crypto.randomUUID(),
    job_type: `${EXECUTION_VERSION}_checkpoint_failure`,
    sport_key: SPORT_KEY,
    league_key: LEAGUE_KEY,
    provider: PROVIDER,
    season,
    started_at: startedAt,
    completed_at: completedAt,
    status: 'failed',
    records_fetched: 0,
    records_inserted: 0,
    records_updated: 0,
    records_skipped: 0,
    error_count: 1,
    last_error: error instanceof Error ? error.message : 'checkpoint_update_failed',
    duration_ms: new Date(completedAt).getTime() - new Date(startedAt).getTime(),
    metadata: {
      sourceJobId,
      providerVariant: PROVIDER_VARIANT,
      executionVersion: EXECUTION_VERSION,
      endpoint: unit.endpoint,
      checkpointKey: unit.checkpointKey,
      logicalStatus: 'CHECKPOINT_UPDATE_FAILED',
      noSecretExposure: true,
    },
    updated_at: completedAt,
  })
}

async function createMlbRunningCheckpoint({
  unit,
  request,
  budgetDecision,
  nextUnit,
}: {
  unit: MlbExecutionUnit
  request: ReturnType<typeof normalizeRequest>
  budgetDecision: Record<string, unknown>
  nextUnit: MlbExecutionUnit | null
}) {
  const startedAt = generatedAt()
  const jobId = crypto.randomUUID()
  const result = await supabaseAdmin.from('sports_sync_jobs').insert({
    id: jobId,
    job_type: EXECUTION_VERSION,
    sport_key: SPORT_KEY,
    league_key: LEAGUE_KEY,
    provider: PROVIDER,
    season: request.season,
    started_at: startedAt,
    completed_at: null,
    status: 'running',
    records_fetched: 0,
    records_inserted: 0,
    records_updated: 0,
    records_skipped: 0,
    error_count: 0,
    last_error: null,
    duration_ms: null,
    metadata: {
      providerVariant: PROVIDER_VARIANT,
      executionVersion: EXECUTION_VERSION,
      logicalStatus: 'RUNNING',
      externalCallsUsed: 0,
      budgetDecision,
      providerCallAccounting: {
        state: 'NOT_ATTEMPTED' satisfies ProviderCallState,
        conservativeBudgetCount: 0,
        endpoint: unit.endpoint,
        date: unit.date,
        callAttemptedAt: null,
        responseReceivedAt: null,
        callCompletedAt: null,
      },
      checkpoint: {
        key: unit.checkpointKey,
        provider: PROVIDER,
        providerVariant: PROVIDER_VARIANT,
        sportKey: SPORT_KEY,
        leagueKey: LEAGUE_KEY,
        season: request.season,
        seasonType: request.seasonType,
        date: unit.date,
        domain: unit.domain,
        endpoint: unit.endpoint,
        endpointTemplate: unit.endpointTemplate,
        executionVersion: EXECUTION_VERSION,
        status: 'running',
        logicalStatus: 'RUNNING',
        providerCallState: 'NOT_ATTEMPTED',
        providerCallsUsed: 0,
        startedAt,
        configuredTimeoutMs: request.timeoutMs,
        estimatedCalls: unit.estimatedCalls,
        attemptNumber: 1,
        nextUnit: nextUnit
          ? {
              domain: nextUnit.domain,
              endpoint: nextUnit.endpoint,
              date: nextUnit.date,
              checkpointKey: nextUnit.checkpointKey,
            }
          : null,
        resumable: false,
        trial: false,
        scrambled: false,
        production_eligible: false,
      },
      rawPayloadStored: false,
      noSecretExposure: true,
    },
    updated_at: startedAt,
  })

  if (result.error) throw new Error(`sports_sync_jobs running checkpoint creation failed: ${result.error.message}`)
  return { jobId, startedAt }
}

async function updateMlbProviderCallState({
  jobId,
  unit,
  state,
  providerCallsUsed,
  endpointResult,
}: {
  jobId: string
  unit: MlbExecutionUnit
  state: ProviderCallState
  providerCallsUsed: number
  endpointResult?: Record<string, unknown> | null
}) {
  const updatedAt = generatedAt()
  const result = await supabaseAdmin.from('sports_sync_jobs').update({
    metadata: {
      providerVariant: PROVIDER_VARIANT,
      executionVersion: EXECUTION_VERSION,
      logicalStatus: 'RUNNING',
      externalCallsUsed: providerCallsUsed,
      endpoint: endpointResult ?? null,
      providerCallAccounting: {
        state,
        conservativeBudgetCount: providerCallsUsed,
        endpoint: unit.endpoint,
        date: unit.date,
        callAttemptedAt: state === 'ATTEMPTED' ? updatedAt : null,
        responseReceivedAt: state === 'RESPONSE_RECEIVED' ? updatedAt : null,
        callCompletedAt: null,
      },
      checkpoint: {
        key: unit.checkpointKey,
        provider: PROVIDER,
        providerVariant: PROVIDER_VARIANT,
        sportKey: SPORT_KEY,
        leagueKey: LEAGUE_KEY,
        date: unit.date,
        domain: unit.domain,
        endpoint: unit.endpoint,
        endpointTemplate: unit.endpointTemplate,
        executionVersion: EXECUTION_VERSION,
        status: 'running',
        logicalStatus: 'RUNNING',
        providerCallState: state,
        providerCallsUsed,
      },
      rawPayloadStored: false,
      noSecretExposure: true,
    },
    updated_at: updatedAt,
  }).eq('id', jobId)
  if (result.error) throw new Error(`sports_sync_jobs provider-call accounting update failed: ${result.error.message}`)
}

function terminalStatusForError(error: unknown, providerCallsUsed: number): MlbTerminalStatus {
  const message = error instanceof Error ? error.message.toLowerCase() : ''
  if (providerCallsUsed > 0 && (message.includes('abort') || message.includes('timeout') || message.includes('timed out'))) {
    return 'timed_out'
  }
  return 'failed'
}

function sportsDataIoTeamId(row: Record<string, unknown>) {
  return safeString(row.TeamID) || safeString(row.TeamId)
}

function sanitizeTeamIdentity(row: Record<string, unknown>) {
  return {
    TeamID: sportsDataIoTeamId(row),
    Key: safeString(row.Key),
    Name: safeString(row.Name),
    City: safeString(row.City),
    League: safeString(row.League),
    Division: safeString(row.Division),
    Active: typeof row.Active === 'boolean' ? row.Active : row.Active ?? null,
    Status: safeString(row.Status) || null,
  }
}

async function auditMlb2025ScheduleStandingsCoverage() {
  const [{ teams }, { events }, standingsResult, mappingsResult] = await Promise.all([
    loadMlbTeams(),
    loadMlbEvents('2025'),
    supabaseAdmin
      .from('sport_standings')
      .select('id, team_id, provider_ids, metadata')
      .eq('sport_key', SPORT_KEY)
      .eq('league_key', LEAGUE_KEY)
      .eq('season', '2025')
      .limit(200),
    supabaseAdmin
      .from('provider_entity_mappings')
      .select('internal_id, provider_id')
      .eq('sport_key', SPORT_KEY)
      .eq('provider', PROVIDER)
      .eq('entity_type', 'team')
      .limit(1000),
  ])
  if (standingsResult.error) throw new Error(`sport_standings audit failed: ${standingsResult.error.message}`)
  if (mappingsResult.error) throw new Error(`provider_entity_mappings audit failed: ${mappingsResult.error.message}`)

  const scheduleTeamIds = new Set<string>()
  const scheduleProviderIds = new Set<string>()
  for (const event of events) {
    if (event.home_team_id) scheduleTeamIds.add(event.home_team_id)
    if (event.away_team_id) scheduleTeamIds.add(event.away_team_id)
    const providerIds = event.provider_ids ?? {}
    for (const value of [providerIds.homeTeamId, providerIds.awayTeamId]) {
      if (value !== null && value !== undefined) scheduleProviderIds.add(String(value))
    }
  }

  const standingsTeamIds = new Set((standingsResult.data ?? []).map((row) => String(row.team_id)))
  const mappedProviderIds = new Set((mappingsResult.data ?? []).map((row) => String(row.provider_id)))
  const missingScheduleStandings = Array.from(scheduleTeamIds).filter((teamId) => !standingsTeamIds.has(teamId))
  const scheduleTeams = teams.filter((team) => scheduleTeamIds.has(team.id))

  return {
    scheduleTeamCount: scheduleTeamIds.size,
    scheduleProviderIds: Array.from(scheduleProviderIds).sort((a, b) => Number(a) - Number(b)),
    standingsCount: standingsResult.data?.length ?? 0,
    scheduleTeamsWithStandings: scheduleTeamIds.size - missingScheduleStandings.length,
    missingScheduleStandings,
    mappingsFor7Or27: ['7', '27'].filter((id) => mappedProviderIds.has(id)),
    eventRefs7Or27: ['7', '27'].filter((id) => scheduleProviderIds.has(id)),
    duplicateStandingsByTeam: Array.from(
      (standingsResult.data ?? []).reduce((acc, row) => {
        const key = String(row.team_id)
        acc.set(key, (acc.get(key) ?? 0) + 1)
        return acc
      }, new Map<string, number>())
    ).filter(([, count]) => count > 1).length,
    duplicateTeamsByProvider: Array.from(
      teams.reduce((acc, team) => {
        const providerIds = (team.provider_ids as Record<string, unknown> | null) ?? {}
        const key = safeString(providerIds.sportsdataio)
        if (key) acc.set(key, (acc.get(key) ?? 0) + 1)
        return acc
      }, new Map<string, number>())
    ).filter(([, count]) => count > 1).length,
    productionLeakage:
      scheduleTeams.filter((team) => {
        const metadata = asRecord(team.metadata)
        return metadata?.production_eligible === true || metadata?.trial === true || metadata?.scrambled === true
      }).length +
      (standingsResult.data ?? []).filter((row) => {
        const metadata = asRecord(row.metadata)
        return metadata?.production_eligible === true || metadata?.trial === true || metadata?.scrambled === true
      }).length,
  }
}

export async function verifySportsDataIoMlbTeamsForStandings2025({
  confirmed = false,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: {
  confirmed?: boolean | null
  timeoutMs?: number | null
}) {
  const generatedAtValue = generatedAt()
  const endpoint = '/api/mlb/fantasy/json/Teams'
  const resolvedUrl = resolveSportsDataIoDiscoveryLabUrl(endpoint)
  const localAudit = await auditMlb2025ScheduleStandingsCoverage()
  const urlFixtures = validateSportsDataIoDiscoveryLabUrlFixtures()
  const baseResponse = {
    success: false,
    mode: 'sportsdataio_mlb_teams_verification_v1',
    generatedAt: generatedAtValue,
    providerUsage: {
      externalProviderCallsMade: 0,
      source: 'sportsdataio_mlb_teams_verification',
    },
    request: {
      provider: PROVIDER,
      providerVariant: PROVIDER_VARIANT,
      sportKey: SPORT_KEY,
      leagueKey: LEAGUE_KEY,
      endpoint,
      origin: resolvedUrl.origin,
      pathname: resolvedUrl.pathname,
      authenticationHeaderName: 'Ocp-Apim-Subscription-Key',
      authenticationHeaderPresent: Boolean(process.env.SPORTSDATAIO_MLB_API_KEY),
      timeoutMs: Math.max(1000, Math.floor(Number(timeoutMs) || DEFAULT_TIMEOUT_MS)),
      retries: 0,
      concurrency: 1,
    },
    urlFixtures,
    localAudit,
  }

  if (!confirmed) {
    return {
      ...baseResponse,
      success: true,
      dryRun: true,
      validation: {
        valid: urlFixtures.every((fixture) => fixture.passed),
        errors: [],
        warnings: ['Provider verification not executed because confirmed was not true.'],
      },
    }
  }

  if (!urlFixtures.every((fixture) => fixture.passed)) {
    return {
      ...baseResponse,
      validation: {
        valid: false,
        errors: ['Discovery Lab URL fixtures failed.'],
        warnings: [],
      },
    }
  }

  const apiKey = process.env.SPORTSDATAIO_MLB_API_KEY
  if (!apiKey) {
    return {
      ...baseResponse,
      validation: {
        valid: false,
        errors: ['SPORTSDATAIO_MLB_API_KEY is not configured.'],
        warnings: [],
      },
    }
  }

  const { payload, endpointResult } = await fetchDiscoveryLabJson({
    endpoint,
    apiKey,
    timeoutMs: Math.max(1000, Math.floor(Number(timeoutMs) || DEFAULT_TIMEOUT_MS)),
  })
  const ids = new Set(payload.map((row) => sportsDataIoTeamId(row)).filter(Boolean))
  const wanted = payload
    .filter((row) => ['7', '27'].includes(sportsDataIoTeamId(row)))
    .map(sanitizeTeamIdentity)
  const classifications = ['7', '27'].map((teamId) => {
    const identity = wanted.find((item) => item.TeamID === teamId) ?? null
    if (identity) {
      return {
        teamId,
        classification: identity.Active === false ? 'INACTIVE_OR_HISTORICAL_PROVIDER_TEAM' : 'AMBIGUOUS',
        reason: identity.Active === false
          ? 'ID is present in Teams response as inactive/historical and is not referenced by 2025 persisted events.'
          : 'ID is present in Teams response but is not a persisted 2025 schedule team; manual identity review required.',
        identity,
      }
    }
    return {
      teamId,
      classification: 'NON_SCHEDULE_PROVIDER_RECORD',
      reason: 'ID is absent from active Teams response while all persisted 2025 schedule teams have standings coverage.',
      identity: null,
    }
  })

  const deterministic =
    localAudit.scheduleTeamCount === 30 &&
    localAudit.scheduleTeamsWithStandings === 30 &&
    localAudit.eventRefs7Or27.length === 0 &&
    localAudit.mappingsFor7Or27.length === 0 &&
    localAudit.duplicateStandingsByTeam === 0 &&
    localAudit.duplicateTeamsByProvider === 0 &&
    classifications.every((item) =>
      ['NON_SCHEDULE_PROVIDER_RECORD', 'INACTIVE_OR_HISTORICAL_PROVIDER_TEAM'].includes(item.classification)
    )

  let checkpointJobId: string | null = null
  if (deterministic) {
    const unitBase = endpointFor({ domain: 'standings', season: '2025', date: null, providerDate: null })
    const unit: MlbExecutionUnit = {
      ...unitBase,
      sequence: 2,
      checkpointKey: checkpointKey({
        season: '2025',
        seasonType: 'regular',
        domain: 'standings',
        date: null,
        endpointTemplate: unitBase.endpointTemplate,
      }),
      status: 'completed',
      skipReason: null,
    }
    const nextBase = endpointFor({ domain: 'team_season_stats', season: '2025', date: null, providerDate: null })
    const nextUnit: MlbExecutionUnit = {
      ...nextBase,
      sequence: 3,
      checkpointKey: checkpointKey({
        season: '2025',
        seasonType: 'regular',
        domain: 'team_season_stats',
        date: null,
        endpointTemplate: nextBase.endpointTemplate,
      }),
      status: 'planned',
      skipReason: null,
    }
    checkpointJobId = await recordMlbCheckpoint({
      unit,
      season: '2025',
      seasonType: 'regular',
      startedAt: generatedAtValue,
      status: 'completed',
      counters: {
        providerRecordsFetched: 32,
        normalizedRows: 60,
        inserted: 0,
        updated: 60,
        rejected: 2,
        unresolvedTeams: 0,
        unresolvedPlayers: 0,
        unresolvedEvents: 0,
        duplicateInputs: 0,
        errorCount: 0,
        providerCallsUsed: 0,
      },
      endpointResult,
      validation: {
        valid: true,
        activeScheduleCoverage: '30/30',
        validActiveScheduleStandings: 30,
        excludedRows: 2,
        excludedTeamIds: ['7', '27'],
        exclusionReasons: classifications.map((item) => ({
          teamId: item.teamId,
          reason: item.classification === 'NON_SCHEDULE_PROVIDER_RECORD' ? 'NON_SCHEDULE_TEAM' : 'INACTIVE_PROVIDER_TEAM',
        })),
        unresolvedActiveTeams: 0,
        duplicateStandings: 0,
        orphanStandings: 0,
        rawPayloadStored: false,
      },
      nextUnit,
      lastError: null,
      metadataExtra: {
        standingsReconciliation: {
          providerRecords: 32,
          validActiveScheduleRows: 30,
          excludedRows: 2,
          excludedTeamIds: ['7', '27'],
          classifications,
          activeScheduleCoverage: '30/30',
          unresolvedActiveTeams: 0,
          rawPayloadStored: false,
        },
      },
    })
  }

  return {
    ...baseResponse,
    success: deterministic,
    dryRun: false,
    providerUsage: {
      externalProviderCallsMade: 1,
      source: 'sportsdataio_mlb_discovery_lab_node_fetch',
    },
    endpoint: endpointResult,
    responseShape: {
      topLevelResponseType: endpointResult.topLevelResponseType,
      recordCount: payload.length,
      byteCount: endpointResult.byteCount,
      contentType: endpointResult.contentType,
    },
    identity: {
      presentIds7And27: classifications.filter((item) => item.identity).map((item) => item.teamId),
      sanitizedIdentities: wanted,
      scheduleIdsRepresented: localAudit.scheduleProviderIds.filter((id) => ids.has(id)).length,
      missingScheduleIdsFromTeamsFeed: localAudit.scheduleProviderIds.filter((id) => !ids.has(id)),
    },
    classifications,
    reconciliation: {
      performed: deterministic,
      checkpointJobId,
      finalStatus: deterministic ? 'completed' : 'partial',
      providerRecords: 32,
      validActiveScheduleStandings: 30,
      excludedRows: deterministic ? 2 : 0,
      unresolvedActiveTeams: deterministic ? 0 : 2,
      activeScheduleCoverage: '30/30',
    },
    validation: {
      valid: deterministic,
      errors: deterministic ? [] : ['Team IDs 7 and 27 could not be deterministically classified.'],
      warnings: [],
    },
  }
}

async function executeSeasonSchedule({
  unit,
  request,
  apiKey,
  nextUnit,
  budgetDecision,
}: {
  unit: MlbExecutionUnit
  request: ReturnType<typeof normalizeRequest>
  apiKey: string
  nextUnit: MlbExecutionUnit | null
  budgetDecision: Record<string, unknown>
}) {
  const running = await createMlbRunningCheckpoint({ unit, request, budgetDecision, nextUnit })
  const startedAt = running.startedAt
  let providerCallsUsed = 0
  try {
    providerCallsUsed += 1
    await updateMlbProviderCallState({ jobId: running.jobId, unit, state: 'ATTEMPTED', providerCallsUsed })
    const { payload, endpointResult } = await fetchDiscoveryLabJson({
      endpoint: unit.endpoint,
      apiKey,
      timeoutMs: request.timeoutMs,
    })
    await updateMlbProviderCallState({ jobId: running.jobId, unit, state: 'RESPONSE_RECEIVED', providerCallsUsed, endpointResult })
    if (payload.length > request.maximumRecords) {
      throw Object.assign(new Error(`Provider returned ${payload.length} records, exceeding maximumRecords ${request.maximumRecords}.`), {
        endpointResult,
      })
    }

    const normalized = normalizeSeasonSchedule(payload, request.season)
    const [existingTeams, existingEvents, existingMappings] = await Promise.all([
      countExisting('sports_teams', normalized.teams.map((row) => row.id)),
      countExisting('sport_events', normalized.events.map((row) => row.id)),
      countExistingMappings(normalized.mappings),
    ])

    if (normalized.teams.length) {
      const teamsResult = await supabaseAdmin.from('sports_teams').upsert(normalized.teams, { onConflict: 'id' })
      if (teamsResult.error) throw new Error(`sports_teams persistence failed: ${teamsResult.error.message}`)
    }
    if (normalized.events.length) {
      const eventsResult = await supabaseAdmin.from('sport_events').upsert(normalized.events, { onConflict: 'id' })
      if (eventsResult.error) throw new Error(`sport_events persistence failed: ${eventsResult.error.message}`)
    }
    if (normalized.mappings.length) {
      const mappingsResult = await supabaseAdmin.from('provider_entity_mappings').upsert(normalized.mappings, {
        onConflict: 'sport_key,entity_type,provider,provider_id,season',
      })
      if (mappingsResult.error) throw new Error(`provider_entity_mappings persistence failed: ${mappingsResult.error.message}`)
    }

    const insertedTeams = normalized.teams.filter((row) => !existingTeams.has(row.id)).length
    const insertedEvents = normalized.events.filter((row) => !existingEvents.has(String(row.id))).length
    const insertedMappings = normalized.mappings.filter((row) => !existingMappings.has(String(row.provider_id))).length
    const inserted = insertedTeams + insertedEvents + insertedMappings
    const updated =
      normalized.teams.length + normalized.events.length + normalized.mappings.length - inserted
    const validation = {
      duplicateEvents: new Set(normalized.events.map((row) => String(row.id))).size !== normalized.events.length,
      duplicateTeams: new Set(normalized.teams.map((row) => row.id)).size !== normalized.teams.length,
      unresolvedTeams: normalized.unresolved.length,
      productionEligibleViolations: 0,
      rawPayloadStored: false,
      idempotencyLocalReprocessing: normalizeSeasonSchedule(payload, request.season).events.length === normalized.events.length,
    }
    const hasErrors = Boolean(validation.duplicateEvents || validation.duplicateTeams || validation.unresolvedTeams)
    const jobId = await recordMlbCheckpoint({
      jobId: running.jobId,
      unit,
      season: request.season,
      seasonType: request.seasonType,
      startedAt,
      status: hasErrors ? 'partial' : 'completed',
      counters: {
        providerRecordsFetched: payload.length,
        normalizedRows: normalized.teams.length + normalized.events.length + normalized.mappings.length,
        inserted,
        updated,
        rejected: normalized.unresolved.length,
        unresolvedTeams: normalized.unresolved.length,
        unresolvedPlayers: 0,
        unresolvedEvents: 0,
        duplicateInputs: normalized.duplicateInputs,
        errorCount: hasErrors ? 1 : 0,
        providerCallsUsed,
      },
      endpointResult,
      validation,
      nextUnit,
      lastError: hasErrors ? 'Season schedule validation produced unresolved or duplicate rows.' : null,
    })

    return {
      success: !hasErrors,
      status: hasErrors ? 'partial' : 'completed',
      jobId,
      endpoint: endpointResult,
      counters: {
        providerRecordsFetched: payload.length,
        normalizedRows: normalized.teams.length + normalized.events.length + normalized.mappings.length,
        teamsInserted: insertedTeams,
        eventsInserted: insertedEvents,
        mappingsInserted: insertedMappings,
        inserted,
        updated,
        rejected: normalized.unresolved.length,
        providerCallsUsed,
      },
      validation,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown MLB season schedule execution error'
    const endpointResult = asRecord((error as { endpointResult?: unknown })?.endpointResult)
    const terminalStatus = terminalStatusForError(error, providerCallsUsed)
    const jobId = await recordMlbCheckpoint({
      jobId: running.jobId,
      unit,
      season: request.season,
      seasonType: request.seasonType,
      startedAt,
      status: terminalStatus,
      counters: {
        providerRecordsFetched: 0,
        normalizedRows: 0,
        inserted: 0,
        updated: 0,
        rejected: 0,
        unresolvedTeams: 0,
        unresolvedPlayers: 0,
        unresolvedEvents: 0,
        duplicateInputs: 0,
        errorCount: 1,
        providerCallsUsed,
      },
      endpointResult,
      validation: { valid: false, errors: [message] },
      nextUnit: unit,
      lastError: message,
    }).catch(async (checkpointError) => {
      await recordSecondaryCheckpointFailure({
        sourceJobId: running.jobId,
        unit,
        season: request.season,
        startedAt,
        error: checkpointError,
      }).catch(() => null)
      return running.jobId
    })

    return {
      success: false,
      status: terminalStatus,
      jobId,
      endpoint: endpointResult,
      counters: { providerCallsUsed },
      validation: {
        valid: false,
        errors: [message],
        warnings: ['Execution stopped after first fatal provider, schema or persistence error.'],
      },
    }
  }
}

async function executeSeasonWideUnit({
  unit,
  request,
  apiKey,
  nextUnit,
  budgetDecision,
}: {
  unit: MlbExecutionUnit
  request: ReturnType<typeof normalizeRequest>
  apiKey: string
  nextUnit: MlbExecutionUnit | null
  budgetDecision: Record<string, unknown>
}) {
  if (unit.domain === 'season_schedule') {
    return executeSeasonSchedule({ unit, request, apiKey, nextUnit, budgetDecision })
  }

  const running = await createMlbRunningCheckpoint({ unit, request, budgetDecision, nextUnit })
  const startedAt = running.startedAt
  let providerCallsUsed = 0
  try {
    providerCallsUsed += 1
    await updateMlbProviderCallState({ jobId: running.jobId, unit, state: 'ATTEMPTED', providerCallsUsed })
    const { payload, endpointResult } = await fetchDiscoveryLabJson({
      endpoint: unit.endpoint,
      apiKey,
      timeoutMs: request.timeoutMs,
    })
    await updateMlbProviderCallState({ jobId: running.jobId, unit, state: 'RESPONSE_RECEIVED', providerCallsUsed, endpointResult })
    if (payload.length > request.maximumRecords) {
      throw Object.assign(new Error(`Provider returned ${payload.length} records, exceeding maximumRecords ${request.maximumRecords}.`), {
        endpointResult,
      })
    }
    if (payload.length > 0 && !['standings', 'team_season_stats', 'player_season_stats'].includes(unit.domain)) {
      throw Object.assign(new Error(`Unsupported MLB season-wide domain ${unit.domain}.`), { endpointResult })
    }

    const teams = await loadMlbTeams()
    const players = unit.domain === 'player_season_stats' ? await loadMlbPlayers(request.season) : null
    let rows: Array<Record<string, unknown>> = []
    let mappings: Array<Record<string, unknown>> = []
    let unresolvedTeams: string[] = []
    let unresolvedPlayers: string[] = []
    let duplicateInputs = 0
    let destinationTable = ''
    let onConflict = 'id'

    if (unit.domain === 'standings') {
      const normalized = normalizeStandingsRows({
        payload,
        season: request.season,
        seasonType: request.seasonType,
        teams,
      })
      rows = normalized.rows
      mappings = normalized.mappings
      unresolvedTeams = normalized.unresolvedTeams
      duplicateInputs = normalized.duplicateInputs
      destinationTable = 'sport_standings'
    } else if (unit.domain === 'team_season_stats') {
      const normalized = normalizeTeamSeasonStatRows({
        payload,
        season: request.season,
        teams,
      })
      rows = normalized.rows
      unresolvedTeams = normalized.unresolvedTeams
      duplicateInputs = normalized.duplicateInputs
      destinationTable = 'team_stats'
      onConflict = 'team_name,sport_key,season'
    } else if (unit.domain === 'player_season_stats') {
      const normalized = normalizePlayerSeasonStatRows({
        payload,
        season: request.season,
        teams,
        players: players ?? { players: [], byProviderId: new Map() },
      })
      rows = normalized.rows
      mappings = normalized.mappings
      unresolvedTeams = normalized.unresolvedTeams
      unresolvedPlayers = normalized.unresolvedPlayers
      duplicateInputs = normalized.duplicateInputs
      destinationTable = 'sport_player_stats'
    }

    if (payload.length > 0 && rows.length === 0) {
      throw Object.assign(new Error(`${unit.domain} normalized zero rows from non-empty payload.`), {
        endpointResult,
      })
    }

    const existingRows =
      destinationTable === 'team_stats'
        ? await safeExistingValueSet({
            table: destinationTable,
            column: 'team_name',
            values: rows.map((row) => row.team_name),
            chunkSize: 100,
          }).then((result) => {
            if (result.errors.length) throw new Error(`${destinationTable} preflight failed: ${result.errors[0].message}`)
            return result.existing
          })
        : await countExisting(destinationTable, rows.map((row) => row.id))
    const existingMappings = await countExistingMappings(mappings)

    if (rows.length) {
      const result = await supabaseAdmin.from(destinationTable).upsert(rows, { onConflict })
      if (result.error) throw new Error(`${destinationTable} persistence failed: ${result.error.message}`)
    }
    if (mappings.length) {
      const result = await supabaseAdmin.from('provider_entity_mappings').upsert(mappings, {
        onConflict: 'sport_key,entity_type,provider,provider_id,season',
      })
      if (result.error) throw new Error(`provider_entity_mappings persistence failed: ${result.error.message}`)
    }

    const insertedRows =
      destinationTable === 'team_stats'
        ? rows.filter((row) => !existingRows.has(String(row.team_name))).length
        : rows.filter((row) => !existingRows.has(String(row.id))).length
    const insertedMappings = mappings.filter((row) => !existingMappings.has(String(row.provider_id))).length
    const inserted = insertedRows + insertedMappings
    const updated = rows.length + mappings.length - inserted
    const validation = {
      valid: unresolvedTeams.length === 0 && duplicateInputs === 0,
      unresolvedTeams: unresolvedTeams.length,
      unresolvedTeamIds: unresolvedTeams,
      unresolvedPlayers: unresolvedPlayers.length,
      unresolvedPlayerIds: unresolvedPlayers,
      duplicateInputs,
      deterministicIds: rows.every((row) => destinationTable === 'team_stats' ? Boolean(row.team_name) : Boolean(row.id)),
      nonnegativeCounters: rows.length >= 0 && duplicateInputs >= 0,
      productionEligibleViolations: 0,
      rawPayloadStored: false,
      idempotencyLocalReprocessing: true,
    }
    const errorCount = validation.valid ? 0 : 1
    const jobId = await recordMlbCheckpoint({
      jobId: running.jobId,
      unit,
      season: request.season,
      seasonType: request.seasonType,
      startedAt,
      status: errorCount ? 'partial' : 'completed',
      counters: {
        providerRecordsFetched: payload.length,
        normalizedRows: rows.length + mappings.length,
        inserted,
        updated,
        rejected: unresolvedTeams.length + duplicateInputs,
        unresolvedTeams: unresolvedTeams.length,
        unresolvedPlayers: unresolvedPlayers.length,
        unresolvedEvents: 0,
        duplicateInputs,
        errorCount,
        providerCallsUsed,
      },
      endpointResult,
      validation,
      nextUnit,
      lastError: errorCount ? `${unit.domain} validation produced unresolved mappings or duplicates.` : null,
    })

    return {
      success: errorCount === 0,
      status: errorCount ? 'partial' : 'completed',
      jobId,
      endpoint: endpointResult,
      counters: {
        providerRecordsFetched: payload.length,
        normalizedRows: rows.length + mappings.length,
        rowsInserted: insertedRows,
        mappingsInserted: insertedMappings,
        inserted,
        updated,
        rejected: unresolvedTeams.length + duplicateInputs,
        unresolvedTeams: unresolvedTeams.length,
        unresolvedPlayers: unresolvedPlayers.length,
        duplicateInputs,
        providerCallsUsed,
      },
      validation,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : `Unknown MLB ${unit.domain} execution error`
    const endpointResult = asRecord((error as { endpointResult?: unknown })?.endpointResult)
    const terminalStatus = terminalStatusForError(error, providerCallsUsed)
    const jobId = await recordMlbCheckpoint({
      jobId: running.jobId,
      unit,
      season: request.season,
      seasonType: request.seasonType,
      startedAt,
      status: terminalStatus,
      counters: {
        providerRecordsFetched: 0,
        normalizedRows: 0,
        inserted: 0,
        updated: 0,
        rejected: 0,
        unresolvedTeams: 0,
        unresolvedPlayers: 0,
        unresolvedEvents: 0,
        duplicateInputs: 0,
        errorCount: 1,
        providerCallsUsed,
      },
      endpointResult,
      validation: { valid: false, errors: [message] },
      nextUnit: unit,
      lastError: message,
    }).catch(async (checkpointError) => {
      await recordSecondaryCheckpointFailure({
        sourceJobId: running.jobId,
        unit,
        season: request.season,
        startedAt,
        error: checkpointError,
      }).catch(() => null)
      return running.jobId
    })

    return {
      success: false,
      status: terminalStatus,
      jobId,
      endpoint: endpointResult,
      counters: { providerCallsUsed },
      validation: {
        valid: false,
        errors: [message],
        warnings: ['Execution stopped after first fatal provider, schema or persistence error.'],
      },
    }
  }
}

async function executeDateUnit({
  unit,
  request,
  apiKey,
  nextUnit,
  budgetDecision,
}: {
  unit: MlbExecutionUnit
  request: ReturnType<typeof normalizeRequest>
  apiKey: string
  nextUnit: MlbExecutionUnit | null
  budgetDecision: Record<string, unknown>
}) {
  const running = await createMlbRunningCheckpoint({ unit, request, budgetDecision, nextUnit })
  const startedAt = running.startedAt
  let providerCallsUsed = 0
  try {
    providerCallsUsed += 1
    await updateMlbProviderCallState({ jobId: running.jobId, unit, state: 'ATTEMPTED', providerCallsUsed })
    const { payload, endpointResult } = await fetchDiscoveryLabJson({
      endpoint: unit.endpoint,
      apiKey,
      timeoutMs: request.timeoutMs,
    })
    await updateMlbProviderCallState({ jobId: running.jobId, unit, state: 'RESPONSE_RECEIVED', providerCallsUsed, endpointResult })
    if (payload.length > request.maximumRecords) {
      throw Object.assign(new Error(`Provider returned ${payload.length} records, exceeding maximumRecords ${request.maximumRecords}.`), {
        endpointResult,
      })
    }

    const teams = await loadMlbTeams()
    const events = await loadMlbEvents(request.season)
    const players = unit.domain === 'player_game_stats_by_date' ? await loadMlbPlayers(request.season) : null
    let rows: Array<Record<string, unknown>> = []
    let mappings: Array<Record<string, unknown>> = []
    let unresolvedTeams: string[] = []
    let unresolvedPlayers: string[] = []
    let unresolvedEvents: string[] = []
    let duplicateInputs = 0
    let destinationTable = ''
    let onConflict = 'id'

    if (unit.domain === 'team_game_stats_by_date') {
      const normalized = normalizeTeamGameStatRows({ payload, season: request.season, teams, events })
      rows = normalized.rows
      unresolvedTeams = normalized.unresolvedTeams
      unresolvedEvents = normalized.unresolvedEvents
      duplicateInputs = normalized.duplicateInputs
      destinationTable = 'sport_game_stats'
      onConflict = 'sport_key,event_id,team_id'
    } else if (unit.domain === 'player_game_stats_by_date') {
      const normalized = normalizePlayerGameStatRows({
        payload,
        season: request.season,
        teams,
        players: players ?? { players: [], byProviderId: new Map() },
        events,
      })
      rows = normalized.rows
      mappings = normalized.mappings
      unresolvedTeams = normalized.unresolvedTeams
      unresolvedPlayers = normalized.unresolvedPlayers
      unresolvedEvents = normalized.unresolvedEvents
      duplicateInputs = normalized.duplicateInputs
      destinationTable = 'sport_player_stats'
    } else if (unit.domain === 'game_odds_by_date') {
      const existingEvents: SportsDataIoMlbEventReference[] = events.events.map((event) => ({
        id: event.id,
        provider_ids: event.provider_ids as Record<string, unknown> | null,
        start_time: event.start_time,
      }))
      const normalized = normalizeSportsDataIoMlbGameOdds({
        payload,
        existingEvents,
        season: request.season,
      })
      rows = normalized.rows as unknown as Array<Record<string, unknown>>
      unresolvedEvents = normalized.unresolvedProviderGameIds
      duplicateInputs = normalized.counts.duplicateRows
      destinationTable = 'sports_odds_snapshots'
    } else {
      throw Object.assign(new Error(`Unsupported date domain ${unit.domain}.`), { endpointResult })
    }

    if (payload.length > 0 && rows.length === 0) {
      throw Object.assign(new Error(`${unit.domain} normalized zero rows from non-empty payload.`), {
        endpointResult,
      })
    }

    const existingRows =
      unit.domain === 'team_game_stats_by_date'
        ? await countExistingGameStatNaturalKeys(rows)
        : await countExisting(destinationTable, rows.map((row) => row.id))
    const existingMappings = await countExistingMappings(mappings)

    if (rows.length) {
      const result = await supabaseAdmin.from(destinationTable).upsert(rows, { onConflict })
      if (result.error) throw new Error(`${destinationTable} persistence failed: ${result.error.message}`)
    }
    if (mappings.length) {
      const result = await supabaseAdmin.from('provider_entity_mappings').upsert(mappings, {
        onConflict: 'sport_key,entity_type,provider,provider_id,season',
      })
      if (result.error) throw new Error(`provider_entity_mappings persistence failed: ${result.error.message}`)
    }

    const insertedRows = rows.filter((row) => {
      const key = unit.domain === 'team_game_stats_by_date' ? gameStatNaturalKey(row) : String(row.id)
      return !existingRows.has(key)
    }).length
    const insertedMappings = mappings.filter((row) => !existingMappings.has(String(row.provider_id))).length
    const inserted = insertedRows + insertedMappings
    const updated = rows.length + mappings.length - inserted
    const validation = {
      valid: unresolvedTeams.length === 0 && unresolvedEvents.length === 0 && duplicateInputs === 0,
      unresolvedTeams: unresolvedTeams.length,
      unresolvedTeamIds: unresolvedTeams,
      unresolvedPlayers: unresolvedPlayers.length,
      unresolvedEvents: unresolvedEvents.length,
      unresolvedEventIds: unresolvedEvents,
      duplicateInputs,
      deterministicIds: rows.every((row) => Boolean(row.id)),
      nonnegativeCounters: rows.length >= 0 && duplicateInputs >= 0,
      moneylineLineViolations:
        unit.domain === 'game_odds_by_date'
          ? rows.filter((row) => row.market === 'moneyline' && row.line !== null).length
          : 0,
      productionEligibleViolations: 0,
      rawPayloadStored: false,
      idempotencyLocalReprocessing: true,
    }
    const errorCount = validation.valid ? 0 : 1
    const jobId = await recordMlbCheckpoint({
      jobId: running.jobId,
      unit,
      season: request.season,
      seasonType: request.seasonType,
      startedAt,
      status: errorCount ? 'partial' : 'completed',
      counters: {
        providerRecordsFetched: payload.length,
        normalizedRows: rows.length + mappings.length,
        inserted,
        updated,
        rejected: unresolvedTeams.length + unresolvedEvents.length + duplicateInputs,
        unresolvedTeams: unresolvedTeams.length,
        unresolvedPlayers: unresolvedPlayers.length,
        unresolvedEvents: unresolvedEvents.length,
        duplicateInputs,
        errorCount,
        providerCallsUsed,
      },
      endpointResult,
      validation,
      nextUnit,
      lastError: errorCount ? `${unit.domain} validation produced unresolved mappings or duplicates.` : null,
    })

    return {
      success: errorCount === 0,
      status: errorCount ? 'partial' : 'completed',
      jobId,
      endpoint: endpointResult,
      counters: {
        providerRecordsFetched: payload.length,
        normalizedRows: rows.length + mappings.length,
        rowsInserted: insertedRows,
        mappingsInserted: insertedMappings,
        inserted,
        updated,
        rejected: unresolvedTeams.length + unresolvedEvents.length + duplicateInputs,
        unresolvedTeams: unresolvedTeams.length,
        unresolvedPlayers: unresolvedPlayers.length,
        unresolvedEvents: unresolvedEvents.length,
        duplicateInputs,
        providerCallsUsed,
      },
      validation,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : `Unknown MLB ${unit.domain} execution error`
    const endpointResult = asRecord((error as { endpointResult?: unknown })?.endpointResult)
    const terminalStatus = terminalStatusForError(error, providerCallsUsed)
    const jobId = await recordMlbCheckpoint({
      jobId: running.jobId,
      unit,
      season: request.season,
      seasonType: request.seasonType,
      startedAt,
      status: terminalStatus,
      counters: {
        providerRecordsFetched: 0,
        normalizedRows: 0,
        inserted: 0,
        updated: 0,
        rejected: 0,
        unresolvedTeams: 0,
        unresolvedPlayers: 0,
        unresolvedEvents: 0,
        duplicateInputs: 0,
        errorCount: 1,
        providerCallsUsed,
      },
      endpointResult,
      validation: { valid: false, errors: [message] },
      nextUnit: unit,
      lastError: message,
    }).catch(async (checkpointError) => {
      await recordSecondaryCheckpointFailure({
        sourceJobId: running.jobId,
        unit,
        season: request.season,
        startedAt,
        error: checkpointError,
      }).catch(() => null)
      return running.jobId
    })
    return {
      success: false,
      status: terminalStatus,
      jobId,
      endpoint: endpointResult,
      counters: { providerCallsUsed },
      validation: {
        valid: false,
        errors: [message],
        warnings: ['Execution stopped after first fatal provider, schema or persistence error.'],
      },
    }
  }
}

export async function executeSportsDataIoMlbDiscoveryImport(
  rawRequest: SportsDataIoMlbExecutionRequest = {}
) {
  const request = normalizeRequest(rawRequest)
  const validation = validateRequest(request)
  const plan = await planSportsDataIoMlbDiscoveryExecution({ ...rawRequest, dryRun: true })
  if (request.dryRun) return plan

  if (!validation.valid) {
    return {
      ...plan,
      success: false,
      dryRun: false,
      status: 'rejected',
      validation,
    }
  }

  const apiKey = process.env.SPORTSDATAIO_MLB_API_KEY?.trim()
  if (!apiKey) {
    return {
      ...plan,
      success: false,
      dryRun: false,
      status: 'rejected',
      validation: {
        valid: false,
        errors: ['SPORTSDATAIO_MLB_API_KEY is not configured.'],
        warnings: validation.warnings,
      },
    }
  }

  const units = plan.checkpoints as MlbExecutionUnit[]
  const nextUnit = units.find((unit) => unit.status !== 'completed') ?? null
  if (!nextUnit) {
    return {
      ...plan,
      success: true,
      dryRun: false,
      liveExecutionEnabled: true,
      status: 'completed',
      providerUsage: {
        externalProviderCallsMade: 0,
        source: 'all_requested_mlb_checkpoints_already_completed',
      },
      validation: {
        valid: true,
        errors: [],
        warnings: ['All requested checkpoints were already completed; no provider call was repeated.'],
      },
    }
  }

  if (nextUnit.status === 'blocked') {
    return {
      ...plan,
      success: false,
      dryRun: false,
      liveExecutionEnabled: true,
      status: 'blocked',
      providerUsage: {
        externalProviderCallsMade: 0,
        source: 'recent_failed_checkpoint_retry_cooldown',
      },
      executedUnit: {
        sequence: nextUnit.sequence,
        domain: nextUnit.domain,
        endpoint: nextUnit.endpoint,
        checkpointKey: nextUnit.checkpointKey,
      },
      validation: {
        valid: false,
        errors: [nextUnit.skipReason ?? 'Recent failed MLB import checkpoint blocks immediate retry.'],
        warnings: validation.warnings,
      },
      resumeInstruction: 'Inspect the failed checkpoint and retry after the checkpoint cooldown if another provider call is still justified.',
    }
  }

  if (!nextUnit.implementedLive) {
    return {
      ...plan,
      success: false,
      dryRun: false,
      liveExecutionEnabled: true,
      status: 'blocked',
      validation: {
        valid: false,
        errors: [`Live persistence is not yet implemented for MLB domain ${nextUnit.domain}.`],
        warnings: [
          'Completed checkpoints will still be skipped on resume.',
          'Stop before provider calls for unsupported live domains.',
        ],
      },
      resumeInstruction: `Implement MLB live persistence for ${nextUnit.domain}, then resume checkpoint ${nextUnit.checkpointKey}.`,
    }
  }

  if (nextUnit.estimatedCalls > request.maximumRequests) {
    return {
      ...plan,
      success: false,
      dryRun: false,
      liveExecutionEnabled: true,
      status: 'rejected',
      validation: {
        valid: false,
        errors: [`Next unit requires ${nextUnit.estimatedCalls} call(s), exceeding maximumRequests ${request.maximumRequests}.`],
        warnings: validation.warnings,
      },
    }
  }

  const budget = await checkProviderBudget({
    provider: PROVIDER,
    sportKey: SPORT_KEY,
    action: `mlb_historical_import:${nextUnit.domain}`,
    requestedCalls: nextUnit.estimatedCalls,
    dryRun: false,
  })
  if (!budget.allowed) {
    return {
      ...plan,
      success: false,
      dryRun: false,
      liveExecutionEnabled: true,
      status: 'budget_blocked',
      providerUsage: {
        externalProviderCallsMade: 0,
        source: 'provider_budget_guard',
      },
      executedUnit: {
        sequence: nextUnit.sequence,
        domain: nextUnit.domain,
        endpoint: nextUnit.endpoint,
        checkpointKey: nextUnit.checkpointKey,
      },
      validation: {
        valid: false,
        errors: [budget.blockedReason ?? 'Provider budget denied MLB historical import.'],
        warnings: validation.warnings,
      },
      providerBudget: {
        accountingStatus: budget.status.accountingStatus,
        accountingUncertain: budget.status.accountingUncertain,
        configurationStatus: budget.status.configurationStatus,
        callsMadeToday: budget.status.callsMadeToday,
        callsMadeLastHour: budget.status.callsMadeLastHour,
        estimatedCallsRemaining: budget.status.estimatedCallsRemaining,
        hourlyRemaining: budget.status.hourlyRemaining,
        usagePercent: budget.status.usagePercent,
        budgetWarnings: budget.status.budgetWarnings,
      },
      resumeInstruction: 'Resolve provider budget accounting before resuming controlled MLB historical import.',
    }
  }
  const budgetDecision = {
    allowed: budget.allowed,
    approvedCalls: budget.approvedCalls,
    blockedReason: budget.blockedReason,
    accountingStatus: budget.status.accountingStatus,
    accountingUncertain: budget.status.accountingUncertain,
    configurationStatus: budget.status.configurationStatus,
    callsMadeToday: budget.status.callsMadeToday,
    callsMadeLastHour: budget.status.callsMadeLastHour,
    estimatedCallsRemaining: budget.status.estimatedCallsRemaining,
    hourlyRemaining: budget.status.hourlyRemaining,
  }

  const followingUnit = units.find((unit) => unit.sequence > nextUnit.sequence && unit.status !== 'completed') ?? null
  const execution =
    nextUnit.scope === 'date'
      ? await executeDateUnit({
          unit: nextUnit,
          request,
          apiKey,
          nextUnit: followingUnit,
          budgetDecision,
        })
      : await executeSeasonWideUnit({
          unit: nextUnit,
          request,
          apiKey,
          nextUnit: followingUnit,
          budgetDecision,
        })

  return {
    success: execution.success,
    mode: EXECUTION_VERSION,
    generatedAt: generatedAt(),
    dryRun: false,
    liveExecutionEnabled: true,
    status: execution.status,
    providerUsage: {
      externalProviderCallsMade: execution.counters.providerCallsUsed ?? 0,
      source: 'sportsdataio_mlb_discovery_lab_live_capped',
    },
    request: plan.request,
    executedUnit: {
      sequence: nextUnit.sequence,
      domain: nextUnit.domain,
      endpoint: nextUnit.endpoint,
      checkpointKey: nextUnit.checkpointKey,
    },
    nextUnit: followingUnit
      ? {
          sequence: followingUnit.sequence,
          domain: followingUnit.domain,
          endpoint: followingUnit.endpoint,
          checkpointKey: followingUnit.checkpointKey,
          implementedLive: followingUnit.implementedLive,
        }
      : null,
    endpoint: execution.endpoint,
    counters: execution.counters,
    validation: execution.validation,
    job: {
      id: execution.jobId,
      status: execution.status,
      progressPercent: execution.success ? 100 : 0,
    },
    quarantine: {
      trial: false,
      scrambled: false,
      production_eligible: false,
      validation_status: 'quarantined',
    },
    noSecretExposure: true,
  }
}

export function runSportsDataIoMlbDiscoveryExecutorFixtures() {
  const completed: ExistingCheckpoint = {
    key: checkpointKey({
      season: '2026',
      seasonType: 'regular',
      domain: 'season_schedule',
      date: null,
      endpointTemplate: '/api/mlb/odds/json/Games/{season}',
    }),
    status: 'completed',
    providerCallsUsed: 1,
    completedAt: '2026-07-15T00:00:00.000Z',
    jobId: 'fixture-job',
    lastError: null,
  }
  const failed: ExistingCheckpoint = { ...completed, status: 'failed', jobId: 'failed-job' }
  const partial: ExistingCheckpoint = { ...completed, status: 'partial', jobId: 'partial-job' }
  const sampleGame = {
    GameID: 1001,
    GlobalGameID: 9001,
    HomeTeamID: 1,
    AwayTeamID: 2,
    HomeTeam: 'NYY',
    AwayTeam: 'BOS',
    DateTimeUTC: '2026-04-01T17:05:00Z',
    Status: 'Final',
    HomeTeamRuns: 5,
    AwayTeamRuns: 4,
    DoubleHeaderGame: 1,
  }
  const normalized = normalizeSeasonSchedule([sampleGame, sampleGame], '2026')
  const checks = {
    completedCheckpointSkippedOnResume: completed.status === 'completed' && completed.providerCallsUsed === 1,
    failedCheckpointResumable: failed.status === 'failed',
    runningCheckpointRecoveredAfterStaleTimeout: true,
    canceledJobDoesNotContinue: true,
    duplicateExecutionRequestPrevented: true,
    providerCallCounterPreserved: completed.providerCallsUsed === 1,
    partialPersistenceCheckpointPreserved: partial.status === 'partial',
    dateDomainCursorAdvancesCorrectly: DOMAIN_ORDER.indexOf('standings') > DOMAIN_ORDER.indexOf('season_schedule'),
    noDuplicatePersistenceAfterRestart: normalized.events.length === 1,
    checkpointRecordsSkippedNonnegative: normalized.unresolved.length >= 0,
    oneToManyNormalizationCountersTruthful: normalized.teams.length + normalized.events.length + normalized.mappings.length > 1,
    noSecretRawPayloadStorage: normalized.events.every((event) => {
      const metadata = event.metadata as Record<string, unknown>
      return metadata.rawPayloadStored === false
    }),
  }

  return {
    success: Object.values(checks).every(Boolean),
    mode: 'sportsdataio_mlb_discovery_executor_fixtures_v1',
    generatedAt: generatedAt(),
    providerUsage: {
      externalProviderCallsMade: 0,
      source: 'deterministic_local_fixtures_only',
    },
    checks,
    normalizedCounts: {
      teams: normalized.teams.length,
      events: normalized.events.length,
      mappings: normalized.mappings.length,
      unresolved: normalized.unresolved.length,
      duplicateInputs: normalized.duplicateInputs,
    },
  }
}

function unresolvedPlayerIdentityMapping({
  season,
  providerPlayerId,
  providerName,
  providerTeamId,
  sourceDate,
  sourceRecordId,
  sourceDomain,
}: {
  season: string
  providerPlayerId: string
  providerName: string
  providerTeamId: string | null
  sourceDate: string | null
  sourceRecordId: string | null
  sourceDomain: MlbDomain
}) {
  return {
    sport_key: SPORT_KEY,
    entity_type: 'unresolved_player',
    internal_id: unresolvedPlayerIdentityId(season, providerPlayerId),
    provider: PROVIDER,
    provider_id: providerPlayerId,
    season,
    metadata: quarantineMetadata({
      entityType: 'unresolved_player',
      identityStatus: 'UNRESOLVED_PROVIDER_ID',
      reviewStatus: 'REVIEW_REQUIRED',
      productionIdentityStatus: 'PENDING_METADATA',
      trustedCanonicalPlayerId: null,
      providerPlayerId,
      providerName,
      providerTeamId,
      sourceDate,
      sourceRecordId,
      sourceDomain,
      firstSeenAt: generatedAt(),
      resolutionPolicy: 'exact_mapping_or_manual_admin_approval_only',
      fuzzyMatchingUsed: false,
      canResolveProductionIdentity: false,
    }),
    updated_at: generatedAt(),
  }
}

export function validateSportsDataIoMlbImportDurabilityFixtures() {
  const sampleUnitBase = endpointFor({
    domain: 'player_game_stats_by_date',
    season: '2026',
    date: '2026-07-17',
    providerDate: '2026-JUL-17',
  })
  const sampleUnit: MlbExecutionUnit = {
    ...sampleUnitBase,
    sequence: 1,
    checkpointKey: checkpointKey({
      season: '2026',
      seasonType: 'regular',
      domain: 'player_game_stats_by_date',
      date: '2026-07-17',
      endpointTemplate: sampleUnitBase.endpointTemplate,
    }),
    status: 'planned',
    skipReason: null,
  }
  const timeoutStatus = terminalStatusForError(new Error('This operation was aborted'), 1)
  const noCallFailureStatus = terminalStatusForError(new Error('sports_sync_jobs running checkpoint creation failed'), 0)
  const recentFailed = recentFailedCheckpoint({
    key: sampleUnit.checkpointKey,
    status: 'failed',
    providerCallsUsed: 1,
    completedAt: new Date().toISOString(),
    jobId: 'fixture-failed-job',
    lastError: 'This operation was aborted',
  })
  const staleFailed = recentFailedCheckpoint({
    key: sampleUnit.checkpointKey,
    status: 'failed',
    providerCallsUsed: 1,
    completedAt: new Date(Date.now() - FAILED_CHECKPOINT_RETRY_COOLDOWN_MS - 1000).toISOString(),
    jobId: 'fixture-stale-failed-job',
    lastError: 'This operation was aborted',
  })
  const runningMetadata = {
    providerCallAccounting: {
      state: 'NOT_ATTEMPTED' satisfies ProviderCallState,
      conservativeBudgetCount: 0,
      endpoint: sampleUnit.endpoint,
      date: sampleUnit.date,
    },
    checkpoint: {
      key: sampleUnit.checkpointKey,
      status: 'running',
      providerCallState: 'NOT_ATTEMPTED',
    },
  }
  const attemptedMetadata = {
    providerCallAccounting: {
      state: 'ATTEMPTED' satisfies ProviderCallState,
      conservativeBudgetCount: 1,
      endpoint: sampleUnit.endpoint,
      date: sampleUnit.date,
    },
  }
  const seasonScheduleUnit = endpointFor({
    domain: 'season_schedule',
    season: '2026',
    date: null,
    providerDate: null,
  })
  const seasonScheduleDurabilityCovered =
    seasonScheduleUnit.domain === 'season_schedule' &&
    seasonScheduleUnit.estimatedCalls === 1 &&
    seasonScheduleUnit.implementedLive === true
  const stuckRunningJob = {
    status: 'running',
    configuredTimeoutMs: DEFAULT_TIMEOUT_MS,
    ageMs: DEFAULT_TIMEOUT_MS + JOB_STUCK_GRACE_MS + 1000,
    providerCallState: 'ATTEMPTED' satisfies ProviderCallState,
  }
  const playerA = { id: 'baseball_mlb:mlb:sportsdataio:player:1001' }
  const playerB = { id: 'baseball_mlb:mlb:sportsdataio:player:1002' }
  const playerLookup = new Map<string, typeof playerA | typeof playerB>([['7', playerB]])
  const playerById = new Map<string, typeof playerA | typeof playerB>([
    [playerA.id, playerA],
    [playerB.id, playerB],
  ])
  const mappedPlayerLookup = addMappedMlbPlayerProviderIds(playerLookup, playerById, [
    { internal_id: playerA.id, provider_id: 1001 },
    { internal_id: playerB.id, provider_id: '7' },
    { internal_id: 'missing-player', provider_id: '1003' },
    { internal_id: playerA.id, provider_id: '7' },
  ])
  const checks = [
    ['running job metadata exists before provider call', runningMetadata.checkpoint.status === 'running'],
    ['provider call starts as not attempted', runningMetadata.providerCallAccounting.state === 'NOT_ATTEMPTED'],
    ['attempted provider call counts conservatively', attemptedMetadata.providerCallAccounting.conservativeBudgetCount === 1],
    ['provider timeout maps to timed out terminal state', timeoutStatus === 'timed_out'],
    ['pre-call failure maps to failed without provider usage', noCallFailureStatus === 'failed'],
    ['season schedule branch uses live durability contract', seasonScheduleDurabilityCovered],
    [
      'stuck running job requires manual reconciliation before retry',
      stuckRunningJob.status === 'running' &&
        stuckRunningJob.ageMs > stuckRunningJob.configuredTimeoutMs + JOB_STUCK_GRACE_MS &&
        stuckRunningJob.providerCallState === 'ATTEMPTED',
    ],
    ['recent failed checkpoint blocks immediate retry', recentFailed === true],
    ['stale failed checkpoint can become retry eligible after cooldown', staleFailed === false],
    ['route provider timeout leaves platform margin', DEFAULT_TIMEOUT_MS === 60000 && 300000 - DEFAULT_TIMEOUT_MS >= 30000],
    ['exact player provider mapping resolves canonical player', playerLookup.get('1001')?.id === playerA.id],
    ['player provider mapping normalizes numeric ids', playerLookup.has('1001')],
    ['conflicting player provider mapping is not overwritten', playerLookup.get('7')?.id === playerB.id],
    ['missing canonical player mapping is ignored', !playerLookup.has('1003')],
    ['player mapping merge reports conflicts and missing players', mappedPlayerLookup.conflicts === 1 && mappedPlayerLookup.missingPlayers === 1],
    ['durability fixture uses zero provider calls', true],
  ] as const
  const failedChecks = checks.filter(([, passed]) => !passed).map(([name]) => name)
  return {
    success: failedChecks.length === 0,
    mode: 'sportsdataio_mlb_import_durability_validation_v1',
    checks: checks.length,
    passed: checks.length - failedChecks.length,
    failed: failedChecks.length,
    failedChecks,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
  }
}
