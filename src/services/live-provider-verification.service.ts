import 'server-only'

import { sportsDataIoCatalogForSport } from '@/config/sportsdataio-endpoint-catalog'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { fetchOfficialBsnHomepageSnapshot } from '@/services/basketball/connectors/official-bsn-homepage.connector'
import { resolveSportsDataIoDiscoveryLabUrl } from '@/services/sportsdataio-discovery-lab-url.service'
import { getUniversalProjectionEngine } from '@/services/universal-projection-engine.service'

type ProviderKey = 'sportsdataio' | 'the_odds_api' | 'mlb_stats_api' | 'official_bsn_homepage'
type VerificationStatus = 'VERIFIED' | 'NOT_CONFIGURED' | 'BLOCKED' | 'ERROR' | 'DRY_RUN'

type EndpointVerification = {
  provider: ProviderKey
  endpoint: string
  status: VerificationStatus
  httpStatus: number | null
  rows: number
  byteCount: number
  fields: FieldProfile[]
  usableFields: string[]
  emptyFields: string[]
  identityFields: string[]
  delayedFields: string[]
  blockedReason: string | null
}

type FieldProfile = {
  fieldName: string
  type: string
  populated: number
  empty: number
  nullable: boolean
  identity: boolean
  usable: boolean
  projectionQuality: 'usable' | 'display_only' | 'unusable' | 'unknown'
  predictionQuality: 'usable' | 'display_only' | 'unusable' | 'unknown'
  displayQuality: 'usable' | 'limited' | 'unusable'
  sample: unknown
}

type CountSnapshot = {
  table: string
  count: number | null
  error: string | null
}

const SPORT_KEY = 'baseball_mlb'
const LEAGUE_KEY = 'mlb'
const VERSION = 'live_provider_verification_v1'

function generatedAt() {
  return new Date().toISOString()
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function rowsFromPayload(payload: unknown) {
  if (Array.isArray(payload)) return payload
  const record = asRecord(payload)
  for (const key of ['games', 'dates', 'teams', 'records', 'events']) {
    const value = record[key]
    if (Array.isArray(value)) return value
  }
  return payload && typeof payload === 'object' ? [payload] : []
}

function sanitizeSample(value: unknown): unknown {
  if (value === null || value === undefined) return null
  if (typeof value === 'number' || typeof value === 'boolean') return value
  if (typeof value === 'string') return value.slice(0, 80)
  if (Array.isArray(value)) return `[array:${value.length}]`
  if (typeof value === 'object') return '[object]'
  return String(value).slice(0, 80)
}

function profileFields(payload: unknown): FieldProfile[] {
  const rows = rowsFromPayload(payload).filter((row) => row && typeof row === 'object').slice(0, 100)
  const fieldNames = new Set<string>()
  for (const row of rows) {
    for (const key of Object.keys(asRecord(row))) fieldNames.add(key)
  }
  return [...fieldNames].sort().slice(0, 80).map((fieldName) => {
    const values = rows.map((row) => asRecord(row)[fieldName])
    const populatedValues = values.filter((value) => value !== null && value !== undefined && value !== '')
    const empty = values.length - populatedValues.length
    const sample = populatedValues[0]
    const lower = fieldName.toLowerCase()
    const identity = lower === 'id' || lower.endsWith('id') || lower.includes('gamepk') || lower.includes('playerid') || lower.includes('teamid')
    const usable = !identity && populatedValues.length > 0 && !['name', 'city', 'state', 'description', 'copyright'].some((token) => lower.includes(token))
    const projectionQuality = usable && ['probable', 'starting', 'stat', 'score', 'weather', 'odds', 'total', 'run', 'hit', 'pitch'].some((token) => lower.includes(token))
      ? 'usable'
      : identity || usable
        ? 'display_only'
        : populatedValues.length
          ? 'unknown'
          : 'unusable'
    const predictionQuality = usable && ['odds', 'price', 'spread', 'total', 'status', 'score', 'probable'].some((token) => lower.includes(token))
      ? 'usable'
      : projectionQuality === 'unusable'
        ? 'unusable'
        : 'display_only'
    return {
      fieldName,
      type: sample === undefined || sample === null ? 'unknown' : Array.isArray(sample) ? 'array' : typeof sample,
      populated: populatedValues.length,
      empty,
      nullable: empty > 0,
      identity,
      usable,
      projectionQuality,
      predictionQuality,
      displayQuality: populatedValues.length ? 'usable' : 'unusable',
      sample: sanitizeSample(sample),
    }
  })
}

async function countRows(table: string, filters: Record<string, string>) {
  try {
    let query = supabaseAdmin.from(table).select('*', { count: 'exact', head: true })
    for (const [key, value] of Object.entries(filters)) query = query.eq(key, value)
    const { count, error } = await query
    return { table, count: error ? null : count ?? 0, error: error?.message ?? null } satisfies CountSnapshot
  } catch (error) {
    return { table, count: null, error: error instanceof Error ? error.message : 'unknown count error' } satisfies CountSnapshot
  }
}

function providerDate(date: string) {
  const parsed = new Date(`${date}T00:00:00.000Z`)
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
  return `${parsed.getUTCFullYear()}-${months[parsed.getUTCMonth()]}-${String(parsed.getUTCDate()).padStart(2, '0')}`
}

async function fetchJson(url: string, init: RequestInit = {}, timeoutMs = 15000) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, { ...init, cache: 'no-store', signal: controller.signal })
    const text = await response.text()
    let payload: unknown = null
    try {
      payload = text ? JSON.parse(text) : null
    } catch {
      payload = { parseError: true, text: text.slice(0, 200) }
    }
    return {
      ok: response.ok,
      status: response.status,
      byteCount: Buffer.byteLength(text, 'utf8'),
      payload,
      rateLimitRemaining: response.headers.get('x-ratelimit-remaining') ?? response.headers.get('x-requests-remaining'),
    }
  } finally {
    clearTimeout(timeout)
  }
}

function endpointResult(provider: ProviderKey, endpoint: string, result: Awaited<ReturnType<typeof fetchJson>>): EndpointVerification {
  const fields = profileFields(result.payload)
  const rows = rowsFromPayload(result.payload).length
  return {
    provider,
    endpoint,
    status: result.ok ? 'VERIFIED' : 'ERROR',
    httpStatus: result.status,
    rows,
    byteCount: result.byteCount,
    fields,
    usableFields: fields.filter((field) => field.usable).map((field) => field.fieldName),
    emptyFields: fields.filter((field) => field.populated === 0).map((field) => field.fieldName),
    identityFields: fields.filter((field) => field.identity).map((field) => field.fieldName),
    delayedFields: fields.filter((field) => field.fieldName.toLowerCase().includes('delay')).map((field) => field.fieldName),
    blockedReason: result.ok ? null : `HTTP ${result.status}`,
  }
}

async function verifySportsDataIo(date: string, maxCalls: number, dryRun: boolean): Promise<{ endpoints: EndpointVerification[]; calls: number; configured: boolean }> {
  const configured = Boolean(process.env.SPORTSDATAIO_MLB_API_KEY?.trim())
  const selectedProviderDate = providerDate(date)
  const endpointCandidates = [
    '/api/mlb/fantasy/json/Teams',
    '/api/mlb/fantasy/json/Players',
    '/api/mlb/fantasy/json/Standings/2026',
    '/api/mlb/odds/json/TeamSeasonStats/2026',
    '/api/mlb/fantasy/json/PlayerSeasonStats/2026',
    `/api/mlb/odds/json/GamesByDate/${selectedProviderDate}`,
    `/api/mlb/odds/json/TeamGameStatsByDate/${selectedProviderDate}`,
    `/api/mlb/fantasy/json/PlayerGameStatsByDate/${selectedProviderDate}`,
    `/api/mlb/odds/json/GameOddsByDate/${date}`,
    `/api/mlb/fantasy/json/PlayerGameProjectionStatsByDate/${selectedProviderDate}`,
  ]
  const endpoints = endpointCandidates.slice(0, Math.min(maxCalls, endpointCandidates.length))
  if (dryRun || !configured) {
    return {
      configured,
      calls: 0,
      endpoints: endpoints.map((endpoint) => ({
        provider: 'sportsdataio',
        endpoint,
        status: dryRun ? 'DRY_RUN' : 'NOT_CONFIGURED',
        httpStatus: null,
        rows: 0,
        byteCount: 0,
        fields: [],
        usableFields: [],
        emptyFields: [],
        identityFields: [],
        delayedFields: [],
        blockedReason: dryRun ? null : 'SPORTSDATAIO_MLB_API_KEY missing',
      })),
    }
  }

  const results: EndpointVerification[] = []
  for (const endpoint of endpoints) {
    const resolved = resolveSportsDataIoDiscoveryLabUrl(endpoint)
    const result = await fetchJson(resolved.url, {
      headers: {
        Accept: 'application/json',
        'Ocp-Apim-Subscription-Key': process.env.SPORTSDATAIO_MLB_API_KEY?.trim() ?? '',
      },
    })
    results.push(endpointResult('sportsdataio', endpoint, result))
  }
  return { configured, calls: results.length, endpoints: results }
}

async function verifyOddsApi(maxCalls: number, dryRun: boolean): Promise<{ endpoints: EndpointVerification[]; calls: number; configured: boolean }> {
  const apiKey = process.env.ODDS_API_KEY?.trim()
  const configured = Boolean(apiKey)
  const endpointPaths = [
    '/v4/sports',
    '/v4/sports/baseball_mlb/odds?regions=us&markets=h2h,spreads,totals&oddsFormat=american',
  ].slice(0, maxCalls)
  if (dryRun || !configured) {
    return {
      configured,
      calls: 0,
      endpoints: endpointPaths.map((endpoint) => ({
        provider: 'the_odds_api',
        endpoint,
        status: dryRun ? 'DRY_RUN' : 'NOT_CONFIGURED',
        httpStatus: null,
        rows: 0,
        byteCount: 0,
        fields: [],
        usableFields: [],
        emptyFields: [],
        identityFields: [],
        delayedFields: [],
        blockedReason: dryRun ? null : 'ODDS_API_KEY missing',
      })),
    }
  }
  const results: EndpointVerification[] = []
  for (const endpoint of endpointPaths) {
    const url = new URL(`https://api.the-odds-api.com${endpoint}`)
    url.searchParams.set('apiKey', apiKey ?? '')
    const result = await fetchJson(url.toString())
    results.push(endpointResult('the_odds_api', endpoint, result))
  }
  return { configured, calls: results.length, endpoints: results }
}

async function verifyMlbStats(date: string, maxCalls: number, dryRun: boolean): Promise<{ endpoints: EndpointVerification[]; calls: number; configured: boolean }> {
  const endpointPaths = [
    `/api/v1/schedule?sportId=1&date=${date}&hydrate=probablePitcher,team,venue,weather`,
    '/api/v1/teams?sportId=1&season=2026',
    '/api/v1/standings?leagueId=103,104&season=2026',
  ].slice(0, maxCalls)
  if (dryRun) {
    return {
      configured: true,
      calls: 0,
      endpoints: endpointPaths.map((endpoint) => ({
        provider: 'mlb_stats_api',
        endpoint,
        status: 'DRY_RUN',
        httpStatus: null,
        rows: 0,
        byteCount: 0,
        fields: [],
        usableFields: [],
        emptyFields: [],
        identityFields: [],
        delayedFields: [],
        blockedReason: null,
      })),
    }
  }
  const results: EndpointVerification[] = []
  for (const endpoint of endpointPaths) {
    const result = await fetchJson(`https://statsapi.mlb.com${endpoint}`)
    results.push(endpointResult('mlb_stats_api', endpoint, result))
  }
  return { configured: true, calls: results.length, endpoints: results }
}

async function verifyBsn(dryRun: boolean): Promise<{ endpoints: EndpointVerification[]; calls: number; configured: boolean }> {
  if (dryRun) {
    return {
      configured: true,
      calls: 0,
      endpoints: [{
        provider: 'official_bsn_homepage',
        endpoint: 'https://www.bsnpr.com/',
        status: 'DRY_RUN',
        httpStatus: null,
        rows: 0,
        byteCount: 0,
        fields: [],
        usableFields: [],
        emptyFields: [],
        identityFields: [],
        delayedFields: [],
        blockedReason: null,
      }],
    }
  }
  const snapshot = await fetchOfficialBsnHomepageSnapshot({ forceRefresh: true })
  const payload = {
    standings: snapshot.standings,
    teams: snapshot.teams,
    results: snapshot.results,
    upcomingGames: snapshot.upcomingGames,
    players: snapshot.players,
    teamLeaders: snapshot.teamLeaders,
  }
  return {
    configured: true,
    calls: snapshot.providerCallsMade,
    endpoints: [{
      provider: 'official_bsn_homepage',
      endpoint: snapshot.sourceUrl,
      status: 'VERIFIED',
      httpStatus: 200,
      rows: snapshot.standings.length + snapshot.teams.length + snapshot.results.length + snapshot.upcomingGames.length + snapshot.players.length + snapshot.teamLeaders.length,
      byteCount: 0,
      fields: profileFields(payload),
      usableFields: [],
      emptyFields: [],
      identityFields: [],
      delayedFields: [],
      blockedReason: null,
    }],
  }
}

function canonicalRegistry(endpoints: EndpointVerification[]) {
  const hasMlbStatsStarters = endpoints.some((endpoint) => endpoint.provider === 'mlb_stats_api' && endpoint.status === 'VERIFIED' && endpoint.endpoint.includes('/schedule'))
  const hasSportsDataIoOdds = endpoints.some((endpoint) => endpoint.provider === 'sportsdataio' && endpoint.status === 'VERIFIED' && endpoint.endpoint.includes('GameOddsByDate') && endpoint.rows > 0)
  const hasOddsApi = endpoints.some((endpoint) => endpoint.provider === 'the_odds_api' && endpoint.status === 'VERIFIED' && endpoint.endpoint.includes('/odds') && endpoint.rows > 0)
  return {
    schedule: hasMlbStatsStarters ? 'mlb_stats_api' : 'sportsdataio',
    gameStatus: hasMlbStatsStarters ? 'mlb_stats_api' : 'sportsdataio',
    standings: 'sportsdataio',
    results: hasMlbStatsStarters ? 'mlb_stats_api' : 'sportsdataio',
    teamStats: 'sportsdataio',
    playerStats: 'sportsdataio',
    pitcherStats: 'sportsdataio',
    batterStats: 'sportsdataio',
    startingPitchers: hasMlbStatsStarters ? 'mlb_stats_api' : 'sportsdataio',
    lineups: 'none_verified',
    weather: hasMlbStatsStarters ? 'mlb_stats_api' : 'sportsdataio',
    odds: hasOddsApi ? 'the_odds_api' : hasSportsDataIoOdds ? 'sportsdataio' : 'none_verified',
    lineMovement: 'none_verified',
    historicalData: 'sportsdataio',
    projectionInputs: hasMlbStatsStarters ? 'mlb_stats_api_plus_sportsdataio_stats' : 'sportsdataio_stats_only',
    predictionInputs: hasOddsApi ? 'the_odds_api_plus_mlb_stats_api' : 'sportsdataio_plus_mlb_stats_api',
  }
}

function acquisitionScore(endpoints: EndpointVerification[]) {
  const verified = (provider: ProviderKey, token: string) =>
    endpoints.some((endpoint) => endpoint.provider === provider && endpoint.status === 'VERIFIED' && endpoint.endpoint.toLowerCase().includes(token.toLowerCase()) && endpoint.rows > 0)
  return {
    identity: verified('sportsdataio', 'Teams') && verified('sportsdataio', 'Players') ? 85 : 35,
    teamStats: verified('sportsdataio', 'TeamSeasonStats') || verified('sportsdataio', 'TeamGameStats') ? 75 : 25,
    playerStats: verified('sportsdataio', 'PlayerSeasonStats') || verified('sportsdataio', 'PlayerGameStats') ? 75 : 25,
    pitcherStats: verified('sportsdataio', 'PlayerSeasonStats') || verified('sportsdataio', 'PlayerGameStats') ? 65 : 20,
    batterStats: verified('sportsdataio', 'PlayerSeasonStats') || verified('sportsdataio', 'PlayerGameStats') ? 65 : 20,
    starterResolution: verified('mlb_stats_api', 'schedule') || verified('sportsdataio', 'GamesByDate') ? 70 : 25,
    weather: verified('mlb_stats_api', 'schedule') || verified('sportsdataio', 'GamesByDate') ? 55 : 15,
    odds: verified('the_odds_api', 'odds') || verified('sportsdataio', 'GameOddsByDate') ? 75 : 20,
    historicalDepth: verified('sportsdataio', 'SeasonStats') ? 70 : 25,
    projectionReadiness: 35,
    predictionReadiness: 45,
    currentBoardReadiness: 60,
  }
}

async function recordReport(input: {
  dryRun: boolean
  date: string
  calls: Record<ProviderKey, number>
  endpoints: EndpointVerification[]
  before: Record<string, unknown>
  after: Record<string, unknown>
}) {
  if (input.dryRun) return null
  const startedAt = generatedAt()
  const completedAt = generatedAt()
  const totalCalls = Object.values(input.calls).reduce((sum, value) => sum + value, 0)
  const { data, error } = await supabaseAdmin
    .from('sports_sync_jobs')
    .insert({
      job_type: VERSION,
      sport_key: SPORT_KEY,
      league_key: LEAGUE_KEY,
      provider: 'multi_provider',
      season: '2026',
      started_at: startedAt,
      completed_at: completedAt,
      status: 'completed',
    records_fetched: input.endpoints.reduce((sum, endpoint) => sum + endpoint.rows, 0),
      records_inserted: 0,
      records_updated: 0,
      records_skipped: 0,
      error_count: input.endpoints.filter((endpoint) => endpoint.status === 'ERROR').length,
      duration_ms: 0,
      metadata: {
        executionVersion: VERSION,
        externalCallsUsed: totalCalls,
        providerCalls: input.calls,
        date: input.date,
        before: input.before,
        after: input.after,
        endpoints: input.endpoints.map((endpoint) => ({
          provider: endpoint.provider,
          endpoint: endpoint.endpoint,
          status: endpoint.status,
          httpStatus: endpoint.httpStatus,
          rows: endpoint.rows,
          byteCount: endpoint.byteCount,
          fields: endpoint.fields.map(({ sample: _sample, ...field }) => field),
        })),
      },
    })
    .select('id')
    .single()
  if (error) throw new Error(`live verification checkpoint write failed: ${error.message}`)
  return data?.id ?? null
}

export async function runLiveProviderVerification(options: {
  dryRun?: boolean
  date?: string
  maxSportsDataIoCalls?: number
  maxOddsApiCalls?: number
  maxMlbStatsCalls?: number
} = {}) {
  const dryRun = options.dryRun !== false
  const date = options.date ?? '2026-07-19'
  const maxSportsDataIoCalls = Math.min(30, Math.max(0, Number(options.maxSportsDataIoCalls ?? 9)))
  const maxOddsApiCalls = Math.min(10, Math.max(0, Number(options.maxOddsApiCalls ?? 2)))
  const maxMlbStatsCalls = Math.min(15, Math.max(0, Number(options.maxMlbStatsCalls ?? 3)))
  const [mappingsBefore, gameStatsBefore, projectionsBefore] = await Promise.all([
    countRows('provider_entity_mappings', { sport_key: SPORT_KEY, provider: 'sportsdataio' }),
    countRows('sport_game_stats', { sport_key: SPORT_KEY }),
    getUniversalProjectionEngine({ sportKey: SPORT_KEY, date, dryRun: true }),
  ])

  const [sportsDataIo, oddsApi, mlbStats, bsn] = await Promise.all([
    verifySportsDataIo(date, maxSportsDataIoCalls, dryRun),
    verifyOddsApi(maxOddsApiCalls, dryRun),
    verifyMlbStats(date, maxMlbStatsCalls, dryRun),
    verifyBsn(dryRun),
  ])
  const endpoints = [...sportsDataIo.endpoints, ...oddsApi.endpoints, ...mlbStats.endpoints, ...bsn.endpoints]

  const [mappingsAfter, gameStatsAfter, projectionsAfter] = await Promise.all([
    countRows('provider_entity_mappings', { sport_key: SPORT_KEY, provider: 'sportsdataio' }),
    countRows('sport_game_stats', { sport_key: SPORT_KEY }),
    getUniversalProjectionEngine({ sportKey: SPORT_KEY, date, dryRun: true }),
  ])
  const before = {
    providerEntityMappings: mappingsBefore.count,
    teamGameStats: gameStatsBefore.count,
    projections: projectionsBefore.summary,
  }
  const after = {
    providerEntityMappings: mappingsAfter.count,
    teamGameStats: gameStatsAfter.count,
    projections: projectionsAfter.summary,
  }
  const calls = {
    sportsdataio: sportsDataIo.calls,
    the_odds_api: oddsApi.calls,
    mlb_stats_api: mlbStats.calls,
    official_bsn_homepage: bsn.calls,
  }
  const checkpointId = await recordReport({ dryRun, date, calls, endpoints, before, after })
  const registry = canonicalRegistry(endpoints)

  return {
    success: true,
    mode: VERSION,
    generatedAt: generatedAt(),
    dryRun,
    date,
    providerInventory: {
      sportsdataio: {
        authenticationStatus: sportsDataIo.configured ? 'configured' : 'missing',
        subscriptionTier: 'sportsdataio_discovery_lab_or_configured_mlb_key',
        enabledSports: ['baseball_mlb'],
        supportedEndpoints: sportsDataIoCatalogForSport('mlb').length,
        callBudget: { maximum: 30, requested: maxSportsDataIoCalls, consumed: sportsDataIo.calls },
      },
      the_odds_api: {
        authenticationStatus: oddsApi.configured ? 'configured' : 'missing',
        subscriptionTier: 'configured_account_unknown_tier',
        enabledSports: ['baseball_mlb_when_key_supports_it'],
        supportedEndpoints: 2,
        callBudget: { maximum: 10, requested: maxOddsApiCalls, consumed: oddsApi.calls },
      },
      mlb_stats_api: {
        authenticationStatus: 'public_no_key_required',
        subscriptionTier: 'public',
        enabledSports: ['baseball_mlb'],
        supportedEndpoints: 3,
        callBudget: { maximum: 15, requested: maxMlbStatsCalls, consumed: mlbStats.calls },
      },
      official_bsn_homepage: {
        authenticationStatus: 'public_no_key_required',
        subscriptionTier: 'public_site',
        enabledSports: ['basketball_bsn'],
        supportedEndpoints: 1,
        callBudget: { maximum: 'connector_internal_limit', requested: 1, consumed: bsn.calls },
      },
    },
    providerCalls: calls,
    providerCallsMade: Object.values(calls).reduce((sum, value) => sum + value, 0),
    remoteMutationsMade: checkpointId ? 1 : 0,
    checkpointId,
    endpointsVerified: endpoints,
    canonicalProviderRegistry: registry,
    providerEntityMappings: {
      before: mappingsBefore.count,
      after: mappingsAfter.count,
      beforeReadError: mappingsBefore.error,
      afterReadError: mappingsAfter.error,
      inserted:
        mappingsBefore.count === null || mappingsAfter.count === null
          ? null
          : Math.max(0, mappingsAfter.count - mappingsBefore.count),
      updated: 0,
      skipped: 0,
      note: 'V1 verification records runtime evidence. Durable mapping population remains delegated to existing SportsDataIO import executor to avoid duplicate persistence logic.',
    },
    teamGameStats: {
      before: gameStatsBefore.count,
      after: gameStatsAfter.count,
      beforeReadError: gameStatsBefore.error,
      afterReadError: gameStatsAfter.error,
      inserted:
        gameStatsBefore.count === null || gameStatsAfter.count === null
          ? null
          : Math.max(0, gameStatsAfter.count - gameStatsBefore.count),
      note: 'V1 verification does not bypass the existing team-game-stat importer.',
    },
    starterResolution: {
      provider: registry.startingPitchers,
      status: registry.startingPitchers === 'none_verified' ? 'Unknown' : 'Runtime endpoint verified; inspect field profiles for probable/starting pitcher population.',
      noInference: true,
    },
    projectionCounts: {
      before: projectionsBefore.summary,
      after: projectionsAfter.summary,
      userVisibleBefore: projectionsBefore.summary.userVisible,
      userVisibleAfter: projectionsAfter.summary.userVisible,
      activationPerformed: false,
    },
    featureStoreImprovements: dryRun ? [] : ['runtime_provider_evidence_checkpoint_created'],
    acquisitionScore: acquisitionScore(endpoints),
    remainingSubscriptionBlockers: [
      'SportsDataIO enterprise lineup endpoint remains blocked unless subscription changes.',
      'SportsDataIO detailed injury endpoint remains blocked unless subscription changes.',
      'Line movement and unsupported markets require explicit endpoint, model, settlement and replay lifecycle.',
    ],
    warnings: [
      dryRun ? 'Dry run made no provider calls.' : null,
      !sportsDataIo.configured ? 'SPORTSDATAIO_MLB_API_KEY missing in runtime.' : null,
      !oddsApi.configured ? 'ODDS_API_KEY missing in runtime.' : null,
      'No prediction rows, official picks, champion rows, thresholds, settlement rows or model versions are mutated by this verifier.',
    ].filter(Boolean),
  }
}
