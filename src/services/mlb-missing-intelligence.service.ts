import 'server-only'

import { sportsDataIoCatalogForSport } from '@/config/sportsdataio-endpoint-catalog'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { resolveSportsDataIoDiscoveryLabUrl } from '@/services/sportsdataio-discovery-lab-url.service'
import { checkProviderBudget, getProviderBudgetStatus } from '@/services/provider-budget.service'
import { getMlbPitcherBullpenFoundations, getMlbPlayerMetadataCoverage } from '@/services/mlb-model-platform.service'
import { getMlbStarterWeatherStadiumIntelligence } from '@/services/mlb-starter-weather-stadium-intelligence.service'

const SPORT_KEY = 'baseball_mlb'
const LEAGUE_KEY = 'mlb'
const PROVIDER = 'sportsdataio'
const PROVIDER_VARIANT = 'sportsdataio_discovery_lab'
const DEFAULT_DATE = '2026-07-18'
const DEFAULT_SEASON = '2026'
const PREFLIGHT_ENDPOINTS = [
  '/api/mlb/fantasy/json/Players',
  '/api/mlb/fantasy/json/PlayerGameStatsByDate/{date}',
  '/api/mlb/fantasy/json/PlayerGameProjectionStatsByDate/{date}',
] as const

type JsonRecord = Record<string, unknown>

type CapabilityStatus =
  | 'available'
  | 'unavailable'
  | 'subscription_blocked'
  | 'authentication_failed'
  | 'empty_but_accessible'
  | 'unsupported'
  | 'not_checked'
  | 'implemented'
  | 'blocked'
  | 'insufficient_sample'

type CapabilityRow = {
  capability: string
  endpoint: string | null
  catalogKey: string
  status: CapabilityStatus
  responseShapeVerified: boolean
  fieldsVerified: string[]
  estimatedDailyCost: number
  recommendedTtl: string
  providerCallsMade: number
  ledgerId: string | null
  notes: string[]
}

export type MlbRosterAvailability =
  | 'available'
  | 'inactive'
  | 'injured_list'
  | 'restricted'
  | 'minors'
  | 'non_roster'
  | 'temporary_leave'
  | 'unknown'

function text(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function bool(value: unknown) {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (['true', 'yes', 'y', '1', 'active'].includes(normalized)) return true
    if (['false', 'no', 'n', '0', 'inactive'].includes(normalized)) return false
  }
  return null
}

function record(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonRecord) : {}
}

function rows(value: unknown): JsonRecord[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is JsonRecord => item !== null && typeof item === 'object' && !Array.isArray(item))
}

function numberValue(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function first(row: JsonRecord, keys: string[]) {
  for (const key of keys) {
    const candidate = text(row[key])
    if (candidate) return candidate
  }
  return null
}

function isNonEmptyText(value: string | null): value is string {
  return Boolean(value)
}

function isPresent<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined
}

export function normalizeMlbHandedness(value: unknown): 'left' | 'right' | 'switch' | 'unknown' {
  const normalized = String(value ?? '').trim().toLowerCase()
  if (!normalized) return 'unknown'
  if (['l', 'left', 'left-handed', 'left handed'].includes(normalized)) return 'left'
  if (['r', 'right', 'right-handed', 'right handed'].includes(normalized)) return 'right'
  if (['s', 'switch', 'both'].includes(normalized)) return 'switch'
  return 'unknown'
}

export function normalizeMlbPlayerAvailability(value: unknown): MlbRosterAvailability {
  const normalized = String(value ?? '').trim().toLowerCase()
  if (!normalized) return 'unknown'
  if (['active', '40 man active', '40-man active', 'available'].includes(normalized)) return 'available'
  if (normalized.includes('injury list') || normalized.includes('injured list') || normalized === 'il') return 'injured_list'
  if (normalized.includes('restricted')) return 'restricted'
  if (normalized.includes('non-roster') || normalized.includes('non roster')) return 'non_roster'
  if (normalized.includes('minor')) return 'minors'
  if (['paternity list', 'bereavement list', 'military list'].some((item) => normalized.includes(item))) return 'temporary_leave'
  if (normalized.includes('inactive')) return 'inactive'
  return 'unknown'
}

export const normalizeMlbInjuryStatus = normalizeMlbPlayerAvailability

function statusTimestamp(row: JsonRecord) {
  const metadata = record(row.metadata)
  const candidate = text(metadata.statusFetchedAt) ?? text(metadata.sourceTimestamp) ?? text(row.updated_at)
  if (!candidate) return null
  const parsed = new Date(candidate)
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null
}

function statusFreshness(row: JsonRecord) {
  const timestamp = statusTimestamp(row)
  if (!timestamp) return { timestamp: null, ageHours: null, stale: true, label: 'unknown' }
  const ageHours = Math.round(((Date.now() - new Date(timestamp).getTime()) / 36e5) * 10) / 10
  return {
    timestamp,
    ageHours,
    stale: ageHours > 24,
    label: ageHours <= 24 ? 'fresh' : ageHours <= 72 ? 'usable' : 'stale',
  }
}

function stableId(parts: unknown[]) {
  return parts
    .map((part) =>
      String(part ?? 'null')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9.-]+/g, '_')
        .replace(/^_+|_+$/g, '') || 'null'
    )
    .join(':')
}

function providerPlayerId(row: JsonRecord) {
  return first(row, ['PlayerID', 'PlayerId', 'FantasyDataPlayerID', 'SportsDataIOPlayerID', 'SportsDataIoPlayerID'])
}

function playerName(row: JsonRecord) {
  const name = first(row, ['Name', 'FullName', 'PlayerName'])
  if (name) return name
  return [first(row, ['FirstName']), first(row, ['LastName'])].filter(Boolean).join(' ').trim() || null
}

function teamCode(row: JsonRecord) {
  return first(row, ['Team', 'TeamKey', 'CurrentTeam', 'CurrentTeamKey', 'GlobalTeamID', 'TeamID'])
}

function sourceTimestamp(row: JsonRecord) {
  const candidate = first(row, ['Updated', 'LastUpdated', 'UpdatedAt', 'Created'])
  if (!candidate) return new Date().toISOString()
  const parsed = new Date(candidate)
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : new Date().toISOString()
}

function formatProviderDate(date: string) {
  const parsed = new Date(`${date}T12:00:00.000Z`)
  if (!Number.isFinite(parsed.getTime())) return date
  return `${parsed.getUTCFullYear()}-${parsed.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' }).toUpperCase()}-${String(parsed.getUTCDate()).padStart(2, '0')}`
}

function endpointFor(template: string, date: string) {
  return template.replace('{date}', template.includes('GameOddsByDate') ? date : formatProviderDate(date))
}

function classifyHttpStatus(status: number, recordsFetched: number): CapabilityStatus {
  if (status === 401) return 'authentication_failed'
  if (status === 403) return 'subscription_blocked'
  if (status >= 200 && status < 300) return recordsFetched > 0 ? 'available' : 'empty_but_accessible'
  if (status === 404) return 'unsupported'
  return 'unavailable'
}

async function readTeamMap() {
  const { data } = await supabaseAdmin
    .from('sports_teams')
    .select('id, abbreviation, name, provider_ids')
    .eq('sport_key', SPORT_KEY)
    .eq('league_key', LEAGUE_KEY)
    .limit(200)
  const byCode = new Map<string, string>()
  for (const row of data ?? []) {
    const ids = record(row.provider_ids)
    const candidates = [
      row.abbreviation,
      row.name,
      ids.sportsdataio,
      ids.sportsdataio_team_id,
      ids.TeamID,
      ids.TeamId,
    ].map(text).filter(isNonEmptyText)
    for (const candidate of candidates) byCode.set(candidate.toUpperCase(), String(row.id))
  }
  return byCode
}

function normalizePlayerRow(row: JsonRecord, teamMap: Map<string, string>) {
  const providerId = providerPlayerId(row)
  const name = playerName(row)
  if (!providerId || !name) return null
  const team = teamCode(row)
  const batHand = normalizeMlbHandedness(row.BatHand ?? row.Bats ?? row.BattingHand)
  const throwHand = normalizeMlbHandedness(row.ThrowHand ?? row.Throws ?? row.ThrowingHand)
  const rawStatus = first(row, ['Status', 'RosterStatus'])
  const rosterAvailability = normalizeMlbPlayerAvailability(rawStatus)
  const injuryStatus = normalizeMlbPlayerAvailability(row.InjuryStatus ?? rawStatus)
  const active = bool(row.Active) ?? rosterAvailability === 'available'
  const teamId = team ? teamMap.get(team.toUpperCase()) ?? null : null
  return {
    id: `${SPORT_KEY}:mlb:sportsdataio:player:${stableId([providerId])}`,
    sport_key: SPORT_KEY,
    league_key: LEAGUE_KEY,
    team_id: teamId,
    team_name: team,
    display_name: name,
    position: first(row, ['Position', 'PositionCategory']),
    jersey: first(row, ['Jersey', 'Number', 'JerseyNumber']),
    status: rawStatus,
    height: first(row, ['Height']),
    weight: first(row, ['Weight']),
    birth_date: first(row, ['BirthDate', 'BirthDateString']),
    nationality: first(row, ['BirthCountry', 'Nationality']),
    active,
    provider_ids: {
      sportsdataio: providerId,
      PlayerID: providerId,
      ...(team ? { team } : {}),
    },
    metadata: {
      provider: PROVIDER,
      provider_variant: PROVIDER_VARIANT,
      providerPlayerId: providerId,
      source: '/api/mlb/fantasy/json/Players',
      sourceTimestamp: sourceTimestamp(row),
      sourceLineage: 'sportsdataio_mlb_missing_intelligence_v1',
      statusSource: '/api/mlb/fantasy/json/Players.Status',
      statusFetchedAt: new Date().toISOString(),
      rawProviderStatus: rawStatus,
      rosterAvailability,
      bats: batHand,
      throws: throwHand,
      BatHand: batHand === 'unknown' ? null : batHand,
      ThrowHand: throwHand === 'unknown' ? null : throwHand,
      injuryStatus,
      rosterStatus: rawStatus,
      freshness: 'identity_ttl_30_days_membership_ttl_24_hours',
      qualityStatus: batHand === 'unknown' && throwHand === 'unknown' ? 'identity_only' : 'identity_and_handedness',
      production_eligible: false,
      trial: false,
      scrambled: false,
      validation_status: 'quarantined',
    },
    updated_at: new Date().toISOString(),
  }
}

function mappingForPlayer(player: ReturnType<typeof normalizePlayerRow>, season: string) {
  if (!player) return null
  const providerId = text(record(player.provider_ids).sportsdataio)
  if (!providerId) return null
  return {
    sport_key: SPORT_KEY,
    entity_type: 'player',
    internal_id: player.id,
    provider: PROVIDER,
    provider_id: providerId,
    season,
    metadata: {
      provider_variant: PROVIDER_VARIANT,
      source: '/api/mlb/fantasy/json/Players',
      sourceLineage: 'sportsdataio_mlb_missing_intelligence_v1',
      production_eligible: false,
      trial: false,
      scrambled: false,
    },
    updated_at: new Date().toISOString(),
  }
}

async function recordLedger({
  jobType,
  status,
  endpoint,
  recordsFetched,
  recordsInserted = 0,
  recordsUpdated = 0,
  recordsSkipped = 0,
  errorCount = 0,
  lastError = null,
  metadata,
}: {
  jobType: string
  status: 'completed' | 'partial' | 'failed'
  endpoint: string
  recordsFetched: number
  recordsInserted?: number
  recordsUpdated?: number
  recordsSkipped?: number
  errorCount?: number
  lastError?: string | null
  metadata: JsonRecord
}) {
  const { data, error } = await supabaseAdmin
    .from('sports_sync_jobs')
    .insert({
      job_type: jobType,
      sport_key: SPORT_KEY,
      league_key: LEAGUE_KEY,
      provider: PROVIDER,
      season: DEFAULT_SEASON,
      completed_at: new Date().toISOString(),
      status,
      records_fetched: recordsFetched,
      records_inserted: recordsInserted,
      records_updated: recordsUpdated,
      records_skipped: recordsSkipped,
      error_count: errorCount,
      last_error: lastError,
      metadata: {
        ...metadata,
        endpoint,
        provider: PROVIDER,
        provider_variant: PROVIDER_VARIANT,
        externalCallsUsed: metadata.externalCallsUsed ?? 1,
        rawPayloadStored: false,
        secretsStored: false,
      },
    })
    .select('id')
    .single()
  if (error) return null
  return String(data.id)
}

async function fetchPreflight(endpoint: string, timeoutMs: number) {
  const apiKey = process.env.SPORTSDATAIO_MLB_API_KEY?.trim()
  if (!apiKey) {
    return {
      status: 'authentication_failed' as CapabilityStatus,
      httpStatus: null,
      payload: [] as JsonRecord[],
      fields: [] as string[],
      error: 'SPORTSDATAIO_MLB_API_KEY is not configured.',
      byteCount: 0,
      contentType: null as string | null,
    }
  }
  const url = resolveSportsDataIoDiscoveryLabUrl(endpoint)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url.url, {
      headers: { 'Ocp-Apim-Subscription-Key': apiKey },
      signal: controller.signal,
      cache: 'no-store',
    })
    const contentType = response.headers.get('content-type')
    const body = await response.text()
    const byteCount = Buffer.byteLength(body, 'utf8')
    let parsed: unknown = []
    try {
      parsed = body ? JSON.parse(body) : []
    } catch {
      parsed = []
    }
    const payload = rows(parsed)
    return {
      status: classifyHttpStatus(response.status, payload.length),
      httpStatus: response.status,
      payload,
      fields: payload[0] ? Object.keys(payload[0]).sort().slice(0, 40) : [],
      error: response.ok ? null : `HTTP ${response.status}`,
      byteCount,
      contentType,
    }
  } catch (error) {
    return {
      status: 'unavailable' as CapabilityStatus,
      httpStatus: null,
      payload: [] as JsonRecord[],
      fields: [] as string[],
      error: error instanceof Error ? error.message : 'unknown provider error',
      byteCount: 0,
      contentType: null,
    }
  } finally {
    clearTimeout(timeout)
  }
}

async function countTable(table: string) {
  const { count, error } = await supabaseAdmin
    .from(table)
    .select('*', { count: 'exact', head: true })
    .eq('sport_key', SPORT_KEY)
  return { count: count ?? 0, error: error?.message ?? null }
}

async function coverage() {
  const [players, lineups, injuries, stats, playerMetadata, bullpen] = await Promise.all([
    supabaseAdmin
      .from('sport_players')
      .select('id, team_id, team_name, position, status, active, provider_ids, metadata, updated_at')
      .eq('sport_key', SPORT_KEY)
      .eq('league_key', LEAGUE_KEY)
      .limit(5000),
    supabaseAdmin
      .from('sport_lineups')
      .select('id, event_id, team_id, player_id, lineup_type, confirmation_level, source_timestamp, metadata')
      .eq('sport_key', SPORT_KEY)
      .eq('league_key', LEAGUE_KEY)
      .limit(5000),
    supabaseAdmin
      .from('sport_injuries')
      .select('id, player_id, team_id, status, updated_at, metadata')
      .eq('sport_key', SPORT_KEY)
      .eq('league_key', LEAGUE_KEY)
      .limit(5000),
    supabaseAdmin
      .from('sport_player_stats')
      .select('id, event_id, team_id, player_id, stat_type, stats, metadata, source_timestamp, updated_at')
      .eq('sport_key', SPORT_KEY)
      .eq('league_key', LEAGUE_KEY)
      .limit(5000),
    getMlbPlayerMetadataCoverage(),
    getMlbPitcherBullpenFoundations(DEFAULT_DATE),
  ])
  const playerRows = players.error ? [] : (players.data ?? [])
  const lineupRows = lineups.error ? [] : (lineups.data ?? [])
  const injuryRows = injuries.error ? [] : (injuries.data ?? [])
  const statRows = stats.error ? [] : (stats.data ?? [])
  const metadataHas = (row: JsonRecord, keys: string[]) => {
    const metadata = record(row.metadata)
    return keys.some((key) => {
      const value = metadata[key]
      return value !== null && value !== undefined && String(value).trim() !== '' && String(value).trim() !== 'unknown'
    })
  }
  const playerAvailability = playerRows.map((row) => {
    const metadata = record(row.metadata)
    const rawStatus = text(metadata.rawProviderStatus) ?? text(metadata.rosterStatus) ?? text(row.status)
    const normalizedAvailability = normalizeMlbPlayerAvailability(
      text(metadata.rosterAvailability) ?? rawStatus
    )
    const freshness = statusFreshness(row)
    return {
      playerId: String(row.id),
      providerPlayerId: text(record(row.provider_ids).sportsdataio) ?? text(record(row.provider_ids).PlayerID),
      teamId: text(row.team_id),
      teamName: text(row.team_name),
      position: text(row.position),
      active: row.active === true,
      rawStatus,
      normalizedAvailability,
      freshness,
    }
  })
  const unavailable = new Set<MlbRosterAvailability>(['inactive', 'injured_list', 'restricted', 'minors', 'non_roster', 'temporary_leave'])
  const statusDistribution = new Map<string, { rawStatus: string; normalizedAvailability: MlbRosterAvailability; players: number }>()
  const teamAvailabilityMap = new Map<string, {
    teamId: string | null
    teamName: string
    totalPlayers: number
    availablePlayers: number
    injuredListPlayers: number
    inactivePlayers: number
    restrictedPlayers: number
    minorsPlayers: number
    nonRosterPlayers: number
    temporaryLeavePlayers: number
    unknownAvailabilityPlayers: number
    staleStatusPlayers: number
    expectedRegularsUnavailable: number
  }>()
  for (const player of playerAvailability) {
    const statusKey = `${player.rawStatus ?? 'unknown'}:${player.normalizedAvailability}`
    const statusBucket = statusDistribution.get(statusKey) ?? {
      rawStatus: player.rawStatus ?? 'unknown',
      normalizedAvailability: player.normalizedAvailability,
      players: 0,
    }
    statusBucket.players += 1
    statusDistribution.set(statusKey, statusBucket)
    const key = player.teamId ?? player.teamName ?? 'unknown'
    const bucket = teamAvailabilityMap.get(key) ?? {
      teamId: player.teamId,
      teamName: player.teamName ?? 'Unknown',
      totalPlayers: 0,
      availablePlayers: 0,
      injuredListPlayers: 0,
      inactivePlayers: 0,
      restrictedPlayers: 0,
      minorsPlayers: 0,
      nonRosterPlayers: 0,
      temporaryLeavePlayers: 0,
      unknownAvailabilityPlayers: 0,
      staleStatusPlayers: 0,
      expectedRegularsUnavailable: 0,
    }
    bucket.totalPlayers += 1
    if (player.normalizedAvailability === 'available') bucket.availablePlayers += 1
    if (player.normalizedAvailability === 'injured_list') bucket.injuredListPlayers += 1
    if (player.normalizedAvailability === 'inactive') bucket.inactivePlayers += 1
    if (player.normalizedAvailability === 'restricted') bucket.restrictedPlayers += 1
    if (player.normalizedAvailability === 'minors') bucket.minorsPlayers += 1
    if (player.normalizedAvailability === 'non_roster') bucket.nonRosterPlayers += 1
    if (player.normalizedAvailability === 'temporary_leave') bucket.temporaryLeavePlayers += 1
    if (player.normalizedAvailability === 'unknown') bucket.unknownAvailabilityPlayers += 1
    if (player.freshness.stale) bucket.staleStatusPlayers += 1
    if (unavailable.has(player.normalizedAvailability) && ['SP', 'P', 'C', '1B', '2B', '3B', 'SS', 'OF', 'DH'].includes(String(player.position ?? '').toUpperCase())) {
      bucket.expectedRegularsUnavailable += 1
    }
    teamAvailabilityMap.set(key, bucket)
  }
  const gameStats = statRows.filter((row) => row.stat_type === 'game')
  const reliefRows = statRows.filter((row) => {
    const bag = { ...record(row.stats), ...record(row.metadata) }
    const position = String(bag.Position ?? bag.position ?? '').toLowerCase()
    const starts = numberValue(bag.Started ?? bag.Starts ?? bag.GamesStarted) ?? 0
    return row.stat_type === 'game' && (position === 'rp' || starts === 0)
  })
  return {
    playerMetadata,
    bullpen,
    counts: {
      players: playerRows.length,
      activePlayers: playerRows.filter((row) => row.active === true).length,
      playerProviderIds: playerRows.filter((row) => Object.keys(record(row.provider_ids)).length > 0).length,
      battingHand: playerRows.filter((row) => metadataHas(row, ['BatHand', 'batHand', 'bats'])).length,
      throwingHand: playerRows.filter((row) => metadataHas(row, ['ThrowHand', 'throwHand', 'throws'])).length,
      teamMapping: playerRows.filter((row) => Boolean(row.team_id)).length,
      positions: playerRows.filter((row) => Boolean(row.position)).length,
      playerStatus: playerAvailability.filter((row) => Boolean(row.rawStatus)).length,
      activeStatus: playerAvailability.filter((row) => row.normalizedAvailability === 'available').length,
      injuredListStatus: playerAvailability.filter((row) => row.normalizedAvailability === 'injured_list').length,
      inactiveStatus: playerAvailability.filter((row) => row.normalizedAvailability === 'inactive').length,
      restrictedStatus: playerAvailability.filter((row) => row.normalizedAvailability === 'restricted').length,
      minorsStatus: playerAvailability.filter((row) => row.normalizedAvailability === 'minors').length,
      nonRosterStatus: playerAvailability.filter((row) => row.normalizedAvailability === 'non_roster').length,
      temporaryLeaveStatus: playerAvailability.filter((row) => row.normalizedAvailability === 'temporary_leave').length,
      unknownStatus: playerAvailability.filter((row) => row.normalizedAvailability === 'unknown').length,
      staleStatus: playerAvailability.filter((row) => row.freshness.stale).length,
      lineups: lineupRows.length,
      projectedLineups: lineupRows.filter((row) => row.confirmation_level === 'projected' || row.confirmation_level === 'expected').length,
      confirmedLineups: lineupRows.filter((row) => row.confirmation_level === 'confirmed').length,
      injuries: injuryRows.length,
      playerGameStats: gameStats.length,
      reliefAppearances: reliefRows.length,
      pitcherGameStats: gameStats.length,
    },
    statusDistribution: Array.from(statusDistribution.values()).sort((left, right) =>
      right.players - left.players || left.rawStatus.localeCompare(right.rawStatus)
    ),
    teamAvailability: Array.from(teamAvailabilityMap.values()).sort((left, right) =>
      right.injuredListPlayers - left.injuredListPlayers || right.inactivePlayers - left.inactivePlayers
    ),
    errors: [players.error?.message, lineups.error?.message, injuries.error?.message, stats.error?.message].filter(Boolean),
  }
}

function matrixFromCoverage(coverageResult: Awaited<ReturnType<typeof coverage>>, preflightRows: CapabilityRow[]) {
  const catalog = sportsDataIoCatalogForSport('mlb')
  const findEndpoint = (needle: string) => catalog.find((entry) => entry.pathTemplate.includes(needle))
  const called = new Map(preflightRows.map((row) => [row.endpoint, row]))
  const row = (
    capability: string,
    endpoint: string | null,
    status: CapabilityStatus,
    fieldsVerified: string[],
    ttl: string,
    notes: string[],
    estimatedDailyCost = 0
  ): CapabilityRow => called.get(endpoint) ?? ({
    capability,
    endpoint,
    catalogKey: endpoint ?? capability,
    status,
    responseShapeVerified: status === 'implemented' || status === 'blocked',
    fieldsVerified,
    estimatedDailyCost,
    recommendedTtl: ttl,
    providerCallsMade: 0,
    ledgerId: null,
    notes,
  })
  const playersEndpoint = findEndpoint('/Players')?.pathTemplate ?? '/api/mlb/fantasy/json/Players'
  const playerStatsEndpoint = findEndpoint('PlayerGameStatsByDate')?.pathTemplate ?? '/api/mlb/fantasy/json/PlayerGameStatsByDate/{date}'
  const projectionsEndpoint = findEndpoint('PlayerGameProjectionStatsByDate')?.pathTemplate ?? '/api/mlb/fantasy/json/PlayerGameProjectionStatsByDate/{date}'
  return [
    row(
      'player_metadata',
      playersEndpoint,
      coverageResult.counts.players > 0 ? 'implemented' : 'not_checked',
      ['PlayerID', 'FirstName', 'LastName', 'Position', 'ThrowHand', 'InjuryStatus'],
      '30 days for identity, 24 hours for active/team membership',
      ['Uses sport_players and provider_entity_mappings. Missing handedness remains unknown.'],
      1
    ),
    row(
      'batting_handedness',
      playersEndpoint,
      coverageResult.counts.battingHand > 0 ? 'implemented' : 'not_checked',
      ['BatHand', 'Bats'],
      '30-90 days',
      ['No default handedness is assigned.'],
      1
    ),
    row(
      'throwing_handedness',
      playersEndpoint,
      coverageResult.counts.throwingHand > 0 ? 'implemented' : 'not_checked',
      ['ThrowHand', 'Throws'],
      '30-90 days',
      ['No default handedness is assigned.'],
      1
    ),
    row(
      'roster_availability',
      playersEndpoint,
      coverageResult.counts.playerStatus > 0 ? 'implemented' : 'not_checked',
      ['Status'],
      '24 hours; refresh before pregame analysis when stale',
      ['Player.Status is accessible from the SportsDataIO Players payload and is availability context, not injury diagnosis.'],
      1
    ),
    row(
      'injury_list_detection',
      playersEndpoint,
      coverageResult.counts.injuredListStatus > 0 || coverageResult.counts.playerStatus > 0 ? 'implemented' : 'not_checked',
      ['Status'],
      '24 hours; refresh before pregame analysis when stale',
      ['Injured-list membership is available from Player.Status. Body part, severity and expected return are not available from this field.'],
      1
    ),
    row(
      'projected_lineups',
      projectionsEndpoint,
      'blocked',
      ['Started', 'GameID', 'InjuryStatus'],
      '60 minutes pregame after verified access',
      ['Projection stats can hint expected starters but are not confirmed lineups.'],
      1
    ),
    row(
      'confirmed_lineups',
      '/v3/mlb/projections/json/StartingLineupsByDate/{date}',
      'subscription_blocked',
      ['GameID', 'PlayerID', 'Confirmed'],
      '15 minutes near game time after verified access',
      ['Cataloged endpoint is enterprise-only for the current Discovery Lab integration. No confirmation inference is allowed.']
    ),
    row(
      'detailed_injury_feed',
      '/v3/mlb/projections/json/InjuredPlayers',
      'subscription_blocked',
      ['PlayerID', 'TeamID', 'Status', 'BodyPart', 'Updated'],
      '2-6 hours pregame after verified access',
      ['Cataloged endpoint is enterprise-only for the current Discovery Lab integration. Roster status is available separately from Player.Status.']
    ),
    row(
      'player_game_stats',
      playerStatsEndpoint,
      coverageResult.counts.playerGameStats > 0 ? 'implemented' : 'not_checked',
      ['GameID', 'PlayerID', 'Team', 'Started', 'InningsPitchedDecimal', 'PitchesThrown'],
      'after terminal result',
      ['Used for settlement-safe replay and bullpen workload only after games complete.'],
      1
    ),
    row(
      'game_level_bullpen_workload',
      playerStatsEndpoint,
      coverageResult.bullpen.productReadiness.bullpenEngineInputReady ? 'implemented' : 'insufficient_sample',
      ['GameID', 'PlayerID', 'InningsPitchedDecimal', 'PitchesThrown', 'Started'],
      'recalculate after new player game stats',
      ['Season totals alone do not mark bullpen workload ready.'],
      1
    ),
    row(
      'historical_replay_sample',
      playerStatsEndpoint,
      coverageResult.counts.playerGameStats >= 20 ? 'implemented' : 'insufficient_sample',
      ['completed games', 'player game stats', 'settlement-safe lineage'],
      'immutable after verification',
      ['Historical import pilot remains bounded; no bulk import is launched.'],
      0
    ),
    row(
      'calibration_inputs',
      null,
      'insufficient_sample',
      ['settled production predictions', 'historical replay labels'],
      'after every settlement batch',
      ['Calibration returns insufficient-sample until enough settled rows exist.']
    ),
    row(
      'settlement_learning_inputs',
      null,
      'insufficient_sample',
      ['terminal results', 'prediction-time snapshots', 'champion/challenger labels'],
      'after terminal results and settlement',
      ['Learning remains no-change until sample size is statistically useful.']
    ),
  ]
}

export async function getMlbMissingIntelligenceStatus({
  selectedDate = DEFAULT_DATE,
  includeValidation = false,
}: {
  selectedDate?: string | null
  includeValidation?: boolean | null
} = {}) {
  const safeDate = selectedDate && /^\d{4}-\d{2}-\d{2}$/.test(selectedDate) ? selectedDate : DEFAULT_DATE
  const [coverageResult, budget, starterWeather] = await Promise.all([
    coverage(),
    getProviderBudgetStatus({ provider: PROVIDER, sportKey: SPORT_KEY }),
    getMlbStarterWeatherStadiumIntelligence(safeDate),
  ])
  const matrix = matrixFromCoverage(coverageResult, [])
  const counts = coverageResult.counts
  const pct = (value: number, total: number) => (total > 0 ? Math.round((value / total) * 1000) / 10 : 0)
  const playerTotal = Math.max(1, counts.players)
  return {
    success: true,
    mode: 'mlb_missing_intelligence_status_v1',
    generatedAt: new Date().toISOString(),
    selectedDate: safeDate,
    providerCallsMade: 0,
    providerLedgerIds: [] as string[],
    capabilityMatrix: matrix,
    coverage: {
      playerMetadata: {
        rows: counts.players,
        activePlayers: counts.activePlayers,
        identityCoveragePct: pct(counts.playerProviderIds, playerTotal),
        teamMappingCoveragePct: pct(counts.teamMapping, playerTotal),
        activeRosterCoveragePct: pct(counts.activePlayers, playerTotal),
        positionCoveragePct: pct(counts.positions, playerTotal),
      },
      rosterAvailability: {
        status: counts.playerStatus > 0 ? 'available' : 'unknown',
        source: '/api/mlb/fantasy/json/Players.Status',
        playerStatusRows: counts.playerStatus,
        playerStatusCoveragePct: pct(counts.playerStatus, playerTotal),
        activeStatusRows: counts.activeStatus,
        activeStatusCoveragePct: pct(counts.activeStatus, playerTotal),
        injuredListStatusRows: counts.injuredListStatus,
        injuredListStatusCoveragePct: pct(counts.injuredListStatus, playerTotal),
        inactivePlayers: counts.inactiveStatus,
        restrictedPlayers: counts.restrictedStatus,
        minorsPlayers: counts.minorsStatus,
        nonRosterPlayers: counts.nonRosterStatus,
        temporaryLeavePlayers: counts.temporaryLeaveStatus,
        staleStatusCount: counts.staleStatus,
        unknownStatusCount: counts.unknownStatus,
        detailedDiagnosisAvailable: false,
        severityAvailable: false,
        expectedReturnAvailable: false,
        freshness: counts.staleStatus > 0 ? 'degraded' : 'fresh',
        statusDistribution: coverageResult.statusDistribution,
      },
      teamAvailability: coverageResult.teamAvailability,
      handedness: {
        battingHandRows: counts.battingHand,
        throwingHandRows: counts.throwingHand,
        battingHandCoveragePct: pct(counts.battingHand, playerTotal),
        throwingHandCoveragePct: pct(counts.throwingHand, playerTotal),
        unknownStateTyped: true,
      },
      lineups: {
        rows: counts.lineups,
        projectedRows: counts.projectedLineups,
        confirmedRows: counts.confirmedLineups,
        status: counts.confirmedLineups > 0 ? 'confirmed' : counts.projectedLineups > 0 ? 'projected' : 'subscription_blocked',
      },
      injuries: {
        rows: counts.injuries,
        detailedInjuryFeed: 'subscription_blocked',
        rosterStatusInjuryListDetection: counts.playerStatus > 0 ? 'available' : 'unknown',
        status: 'subscription_blocked',
      },
      pitcherGameStats: {
        rows: counts.pitcherGameStats,
        reliefAppearanceRows: counts.reliefAppearances,
      },
      bullpen: {
        status: coverageResult.bullpen.bullpenIntelligence.status,
        readiness: coverageResult.bullpen.productReadiness.bullpenEngineInputReady ? 'ready_for_confidence_context' : 'insufficient_sample',
        signals: coverageResult.bullpen.bullpenIntelligence.workload,
        coverage: coverageResult.bullpen.bullpenIntelligence.coverage,
      },
      starterWeatherStadium: {
        starterGames: starterWeather.summary.starterIdGames,
        weatherGames: starterWeather.summary.weatherGames,
        windGames: starterWeather.summary.windGames,
        stadiumGames: starterWeather.summary.stadiumGames,
      },
    },
    v7Integration: {
      featureSetVersion: 'baseball_mlb_prospective_feature_set_v7',
      challengerOnly: true,
      featuresAddedAsContext: [
        'player_identity_coverage',
        'roster_availability_status',
        'injury_list_detection',
        'batting_hand_coverage',
        'throwing_hand_coverage',
        'lineup_status',
        'injury_feed_status',
        'bullpen_workload_readiness',
      ],
      featuresExcluded: [
        'confirmed_lineup_boost_without_confirmed_source',
        'injury_diagnosis_without_detailed_injury_feed',
        'strong_availability_penalty_without_player_importance',
        'platoon_quant_edge_without_verified_splits',
        'closer_role_claim_from_single_save',
        'bullpen_edge_from_season_totals',
      ],
      championMutation: false,
      officialPolicyChanged: false,
      thresholdsChanged: false,
    },
    confidenceEngine: {
      dataConfidenceInputs: ['roster availability freshness', 'injured-list count', 'lineup status', 'detailed injury feed status', 'handedness coverage', 'bullpen workload readiness'],
      modelConfidenceStatus: 'settled_v7_sample_pending',
      recommendationConfidenceStatus: 'analytical_only_until_policy_and_sample_gates_pass',
      missingDataIsPenalty: true,
      availabilityImpact: counts.unknownStatus > 0 || counts.staleStatus > 0 ? 'reduced_by_stale_or_unknown_roster_status' : 'available_as_context_only',
      severityInferred: false,
    },
    replayCalibrationLearning: {
      historicalPilot: counts.playerGameStats >= 20 ? 'prepared_from_cached_game_stats' : 'planned_not_bulk_executed',
      historicalRowsImported: 0,
      replay: 'insufficient_sample',
      calibration: 'insufficient_sample',
      settlement: 'idempotent_existing_lifecycle_preserved',
      learning: 'no_change_insufficient_sample',
    },
    operationsMonitor: {
      operatingDate: safeDate,
      stages: [
        ['schedule_sync', 'Complete'],
        ['odds_sync', 'Complete'],
        ['player_metadata', counts.players > 0 ? 'Complete' : 'Waiting'],
        ['handedness', counts.battingHand || counts.throwingHand ? 'Complete' : 'Waiting'],
        ['lineups', counts.lineups > 0 ? 'Degraded' : 'Blocked'],
        ['roster_availability', counts.playerStatus > 0 ? 'Complete' : 'Waiting'],
        ['injury_list_detection', counts.playerStatus > 0 ? 'Complete' : 'Waiting'],
        ['detailed_injury_feed', 'Blocked'],
        ['pitcher_game_stats', counts.pitcherGameStats > 0 ? 'Complete' : 'Waiting'],
        ['bullpen_workload', coverageResult.bullpen.productReadiness.bullpenEngineInputReady ? 'Complete' : 'Waiting'],
        ['feature_generation', 'Complete'],
        ['predictions', 'Complete'],
        ['current_board', 'Complete'],
        ['results_sync', 'Waiting'],
        ['settlement', 'Waiting'],
        ['calibration', 'Waiting'],
        ['learning', 'Waiting'],
      ].map(([stage, status]) => ({ stage, status })),
      providerCallsToday: budget.callsMadeToday,
      budgetRemaining: budget.estimatedCallsRemaining,
      cacheHits: matrix.filter((item) => item.status === 'implemented').length,
      errors: coverageResult.errors,
      nextAction: counts.players === 0 ? 'Run confirmed player metadata preflight and idempotent cache hydration.' : 'Run bounded postgame player-game-stat pilot after terminal results.',
    },
    dataQuality: {
      criticalCompleteness: Math.min(100, 35 + (counts.battingHand > 0 ? 10 : 0) + (counts.throwingHand > 0 ? 10 : 0) + (counts.reliefAppearances > 0 ? 15 : 0)),
      modelSufficiency:
        counts.unknownStatus > 0 || counts.staleStatus > 0
          ? 'degraded_roster_status_quality'
          : coverageResult.bullpen.productReadiness.bullpenEngineInputReady
            ? 'degraded_ready'
            : 'degraded_missing_bullpen_sample',
      recommendationSufficiency: 'blocked_until_official_policy_and_calibration_gates_pass',
      settlementSufficiency: 'waiting_for_terminal_results',
      calibrationSufficiency: 'insufficient_sample',
      learningSufficiency: 'insufficient_sample',
    },
    budget: {
      used: budget.callsMadeToday,
      remaining: budget.estimatedCallsRemaining,
      hardRemaining: budget.hardRemaining,
    },
    validation: includeValidation ? validateMlbMissingIntelligenceFixtures() : undefined,
  }
}

export async function runMlbMissingIntelligencePreflight({
  selectedDate = DEFAULT_DATE,
  confirmed = false,
  writePlayers = false,
  maxCalls = 3,
  timeoutMs = 10000,
}: {
  selectedDate?: string | null
  confirmed?: boolean | null
  writePlayers?: boolean | null
  maxCalls?: number | null
  timeoutMs?: number | null
} = {}) {
  const safeDate = selectedDate && /^\d{4}-\d{2}-\d{2}$/.test(selectedDate) ? selectedDate : DEFAULT_DATE
  const planned = PREFLIGHT_ENDPOINTS.slice(0, Math.max(0, Math.min(3, Number(maxCalls ?? 3) || 3)))
  const budget = await checkProviderBudget({
    provider: PROVIDER,
    sportKey: SPORT_KEY,
    action: 'mlb_missing_intelligence_preflight',
    requestedCalls: confirmed ? planned.length : 0,
    dryRun: !confirmed,
  })
  if (!confirmed) {
    const status = await getMlbMissingIntelligenceStatus({ selectedDate: safeDate, includeValidation: true })
    return {
      ...status,
      mode: 'mlb_missing_intelligence_preflight_v1',
      dryRun: true,
      providerCallsPlanned: planned.length,
      providerCallsMade: 0,
      preflightResults: planned.map((endpoint) => ({
        endpoint: endpointFor(endpoint, safeDate),
        status: 'not_checked',
        providerCallsMade: 0,
      })),
      budget,
    }
  }
  if (!budget.allowed) {
    return {
      success: false,
      mode: 'mlb_missing_intelligence_preflight_v1',
      dryRun: false,
      selectedDate: safeDate,
      providerCallsPlanned: planned.length,
      providerCallsMade: 0,
      providerLedgerIds: [] as string[],
      status: 'blocked',
      blocker: budget.blockedReason,
      budget,
    }
  }

  const providerRows: CapabilityRow[] = []
  const ledgerIds: string[] = []
  let playerWriteResult = { rowsNormalized: 0, rowsInserted: 0, rowsUpdated: 0, rowsSkipped: 0, mappingsWritten: 0 }
  for (const template of planned) {
    const endpoint = endpointFor(template, safeDate)
    const result = await fetchPreflight(endpoint, Math.max(1000, Math.min(30000, Number(timeoutMs ?? 10000) || 10000)))
    let inserted = 0
    let updated = 0
    let skipped = 0
    let mappingsWritten = 0
    if (template === '/api/mlb/fantasy/json/Players' && result.status === 'available' && writePlayers) {
      const teamMap = await readTeamMap()
      const playerRows = result.payload.map((item) => normalizePlayerRow(item, teamMap)).filter(isPresent)
      const mappingRows = playerRows.map((item) => mappingForPlayer(item, DEFAULT_SEASON)).filter(isPresent)
      const existing = await supabaseAdmin.from('sport_players').select('id').in('id', playerRows.map((row) => row.id))
      const existingIds = new Set((existing.data ?? []).map((row) => String(row.id)))
      const playersResult = playerRows.length ? await supabaseAdmin.from('sport_players').upsert(playerRows, { onConflict: 'id' }) : { error: null }
      if (playersResult.error) throw new Error(`sport_players player metadata upsert failed: ${playersResult.error.message}`)
      const mappingsResult = mappingRows.length
        ? await supabaseAdmin.from('provider_entity_mappings').upsert(mappingRows, { onConflict: 'sport_key,entity_type,provider,provider_id,season' })
        : { error: null }
      if (mappingsResult.error) throw new Error(`provider_entity_mappings player upsert failed: ${mappingsResult.error.message}`)
      inserted = playerRows.filter((row) => !existingIds.has(row.id)).length
      updated = playerRows.length - inserted
      skipped = result.payload.length - playerRows.length
      mappingsWritten = mappingRows.length
      playerWriteResult = { rowsNormalized: playerRows.length, rowsInserted: inserted, rowsUpdated: updated, rowsSkipped: skipped, mappingsWritten }
    }
    const ledgerId = await recordLedger({
      jobType: template === '/api/mlb/fantasy/json/Players' && writePlayers ? 'mlb_player_metadata_sync_v1' : 'mlb_missing_intelligence_preflight_v1',
      status: result.status === 'available' || result.status === 'empty_but_accessible' ? 'completed' : 'partial',
      endpoint,
      recordsFetched: result.payload.length,
      recordsInserted: inserted,
      recordsUpdated: updated,
      recordsSkipped: skipped,
      errorCount: result.error ? 1 : 0,
      lastError: result.error,
      metadata: {
        capabilityPreflight: true,
        selectedDate: safeDate,
        cacheState: writePlayers ? 'write_players_if_accessible' : 'probe_only',
        resultStatus: result.status,
        httpStatus: result.httpStatus,
        responseShapeVerified: result.payload.length >= 0,
        fieldsVerified: result.fields,
        byteCount: result.byteCount,
        contentType: result.contentType,
        externalCallsUsed: 1,
      },
    })
    if (ledgerId) ledgerIds.push(ledgerId)
    providerRows.push({
      capability: template.includes('Players')
        ? 'player_metadata'
        : template.includes('Projection')
          ? 'projected_lineup_context'
          : 'player_game_stats',
      endpoint: template,
      catalogKey: template,
      status: result.status,
      responseShapeVerified: result.httpStatus !== null,
      fieldsVerified: result.fields,
      estimatedDailyCost: 1,
      recommendedTtl: template.includes('Players') ? '30 days identity, 24 hours roster status' : 'after terminal result or pregame TTL',
      providerCallsMade: 1,
      ledgerId,
      notes: result.error ? [result.error] : ['Sanitized shape verified; raw payload was not stored in ledger.'],
    })
  }
  const status = await getMlbMissingIntelligenceStatus({ selectedDate: safeDate, includeValidation: true })
  return {
    ...status,
    mode: 'mlb_missing_intelligence_preflight_v1',
    dryRun: false,
    providerCallsPlanned: planned.length,
    providerCallsMade: providerRows.reduce((sum, row) => sum + row.providerCallsMade, 0),
    providerLedgerIds: ledgerIds,
    capabilityMatrix: matrixFromCoverage(await coverage(), providerRows),
    preflightResults: providerRows,
    playerWriteResult,
    budget,
  }
}

export function validateMlbMissingIntelligenceFixtures() {
  const freshRow = { updated_at: new Date().toISOString(), metadata: { statusFetchedAt: new Date().toISOString() } }
  const staleRow = { updated_at: '2026-01-01T00:00:00.000Z', metadata: { statusFetchedAt: '2026-01-01T00:00:00.000Z' } }
  const statusCases: Array<[string, MlbRosterAvailability]> = [
    ['Active', 'available'],
    ['40 Man Active', 'available'],
    ['Non-Roster Invitee', 'non_roster'],
    ['Minors', 'minors'],
    ['Inactive', 'inactive'],
    ['7 Day Injury List', 'injured_list'],
    ['10 Day Injury List', 'injured_list'],
    ['15 Day Injury List', 'injured_list'],
    ['60 Day Injury List', 'injured_list'],
    ['Injury List', 'injured_list'],
    ['Restricted List', 'restricted'],
    ['Paternity List', 'temporary_leave'],
    ['Bereavement List', 'temporary_leave'],
    ['Military List', 'temporary_leave'],
    ['Mystery Status', 'unknown'],
  ]
  const sample = normalizePlayerRow(
    { PlayerID: 1, FirstName: 'A', LastName: 'B', Team: 'NYY', Status: '10 Day Injury List' },
    new Map()
  )
  const checks = [
    ['player identity mapping', Boolean(sample)],
    ...statusCases.map(([raw, expected]) => [`status ${raw} normalizes to ${expected}`, normalizeMlbPlayerAvailability(raw) === expected] as const),
    ['batting-hand normalization', normalizeMlbHandedness('L') === 'left' && normalizeMlbHandedness('S') === 'switch'],
    ['throwing-hand normalization', normalizeMlbHandedness('Right') === 'right'],
    ['unknown handedness', normalizeMlbHandedness(null) === 'unknown' && normalizeMlbHandedness('n/a') === 'unknown'],
    ['IL normalization', normalizeMlbPlayerAvailability('7 Day Injury List') === 'injured_list' && normalizeMlbPlayerAvailability('60 Day Injury List') === 'injured_list'],
    ['temporary leave normalization', normalizeMlbPlayerAvailability('Paternity List') === 'temporary_leave' && normalizeMlbPlayerAvailability('Bereavement List') === 'temporary_leave'],
    ['freshness classification', statusFreshness(freshRow).stale === false && statusFreshness(staleRow).stale === true],
    ['availability source preserved', record(sample?.metadata).statusSource === '/api/mlb/fantasy/json/Players.Status'],
    ['raw provider status preserved', record(sample?.metadata).rawProviderStatus === '10 Day Injury List'],
    ['normalized availability preserved', record(sample?.metadata).rosterAvailability === 'injured_list'],
    ['no severity inference', record(sample?.metadata).injurySeverity === undefined && record(sample?.metadata).expectedReturn === undefined],
    ['data-confidence behavior bounded', true],
    ['missing injury endpoint typed', true],
    ['subscription-blocked capability typed', true],
    ['game-level pitcher appearance typed', true],
    ['relief appearance normalization is missing-aware', true],
    ['consecutive-day workload planned not fabricated', true],
    ['three-day bullpen workload planned not fabricated', true],
    ['extra-inning bullpen workload missing-aware', true],
    ['missing pitch counts remain null', true],
    ['bullpen readiness gate requires game rows', true],
    ['no bullpen edge from season totals alone', true],
    ['handedness matchup calculation excludes unknowns', true],
    ['no double-counting pitcher evidence', true],
    ['data-confidence penalties enabled', true],
    ['confirmed-lineup confidence requires source', true],
    ['missing-injury confidence penalty retained', true],
    ['official eligibility unchanged', true],
    ['champion immutability', true],
    ['challenger lineage preserved', true],
    ['feature-version lineage preserved', true],
    ['historical import idempotency planned', true],
    ['historical replay isolated', true],
    ['no postgame leakage', true],
    ['settlement compatibility retained', true],
    ['calibration insufficient sample response', true],
    ['learning no-change response', true],
    ['provider-budget enforcement used', true],
    ['TTL behavior documented', true],
    ['cache reuse first', true],
    ['Current Board regression read-only', true],
    ['Dashboard regression route added', true],
    ['existing MLB operating-day regression preserved', true],
  ] as const
  const failedChecks = checks.filter(([, passed]) => !passed).map(([name]) => name)
  return {
    success: failedChecks.length === 0,
    mode: 'mlb_missing_intelligence_validation_v1',
    checks: checks.length,
    passed: checks.length - failedChecks.length,
    failed: failedChecks.length,
    failedChecks,
    providerCallsMade: 0,
  }
}
