import 'server-only'

import { SPORTS, getEnabledSports } from '@/config/sports.config'

const PROVIDER = 'the-odds-api'
const BASE_URL = 'https://api.the-odds-api.com/v4'
const CONFIRMATION = 'ODDS_API_MAX_UTILIZATION_V1'
const HARD_CALL_BUDGET = 12
const CREDIT_RESERVE = 2000
const STANDARD_MARKETS = ['h2h', 'spreads', 'totals'] as const
const PLAYER_PROP_PROBE_MARKETS = [
  'pitcher_outs',
  'pitcher_strikeouts',
  'pitcher_walks',
  'pitcher_hits_allowed',
  'pitcher_earned_runs',
  'batter_hits',
  'batter_total_bases',
  'batter_home_runs',
  'batter_rbis',
  'batter_runs_scored',
  'batter_walks',
  'batter_stolen_bases',
] as const

type CapabilityStatus =
  | 'AVAILABLE'
  | 'AVAILABLE_WITH_ROWS'
  | 'AVAILABLE_NO_CURRENT_ROWS'
  | 'NOT_TESTED_CREDIT_PROTECTION'
  | 'NOT_TESTED_NO_EVENT'
  | 'BLOCKED'
  | 'UNKNOWN'

type OddsApiSport = {
  key: string
  group?: string
  title?: string
  description?: string
  active?: boolean
  has_outrights?: boolean
}

type OddsApiEvent = {
  id: string
  sport_key?: string
  commence_time?: string
  home_team?: string
  away_team?: string
  bookmakers?: Array<{
    key: string
    title?: string
    markets?: Array<{
      key: string
      outcomes?: unknown[]
    }>
  }>
}

type ProviderCall = {
  label: string
  endpoint: string
  httpStatus: number | null
  ok: boolean
  rows: number
  requestsRemaining: number | null
  requestsUsed: number | null
  requestsLast: number | null
  error: string | null
}

type RunOptions = {
  dryRun?: boolean
  live?: boolean
  confirm?: string | null
  maxCalls?: number | null
  maxSports?: number | null
}

type FetchState = {
  calls: ProviderCall[]
  maxCalls: number
  stop: boolean
  stopReason: string | null
  remaining: number | null
}

function nowIso() {
  return new Date().toISOString()
}

function bool(value: unknown) {
  return value === true || value === 'true'
}

function apiKey() {
  return process.env.ODDS_API_KEY?.trim() ?? process.env.THE_ODDS_API_KEY?.trim() ?? ''
}

function headerNumber(headers: Headers, name: string) {
  const value = headers.get(name)
  if (!value) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function sanitizeError(value: unknown) {
  const raw = typeof value === 'string' ? value : JSON.stringify(value ?? '')
  return raw
    .replace(/apiKey=[^&\s"]+/gi, 'apiKey=[REDACTED]')
    .replace(/"apiKey"\s*:\s*"[^"]+"/gi, '"apiKey":"[REDACTED]"')
    .slice(0, 500)
}

function rowCount(payload: unknown) {
  if (Array.isArray(payload)) return payload.length
  if (payload && typeof payload === 'object') return 1
  return 0
}

function safeEndpoint(path: string, query: Record<string, string>) {
  const params = new URLSearchParams(query)
  const rendered = params.toString()
  return rendered ? `${path}?${rendered}` : path
}

function requestUrl(path: string, query: Record<string, string>) {
  const url = new URL(`${BASE_URL}${path}`)
  url.searchParams.set('apiKey', apiKey())
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value)
  return url
}

function catalogMapping(providerSports: OddsApiSport[]) {
  const enabled = getEnabledSports()
  return enabled.map((sport) => {
    const providerSportKey = String(sport.metadata.providerSportKey ?? sport.key)
    const direct = providerSports.find((item) => item.key === providerSportKey)
    const family = providerSports.filter((item) => (
      sport.key === 'soccer'
        ? item.key.startsWith('soccer_')
        : item.key === providerSportKey
    ))
    return {
      sportKey: sport.key,
      label: sport.label,
      providerSportKey,
      directCatalogMatch: Boolean(direct),
      active: Boolean(direct?.active ?? family.some((item) => item.active)),
      catalogKeys: family.length ? family.map((item) => item.key).sort() : direct ? [direct.key] : [],
      seasonState: direct?.active ?? family.some((item) => item.active) ? 'ACTIVE_OR_LISTED' : 'INACTIVE_OR_NOT_LISTED',
    }
  })
}

function dryCatalog() {
  return catalogMapping([]).map((item) => ({
    ...item,
    directCatalogMatch: false,
    active: false,
    catalogKeys: [],
    seasonState: 'NOT_TESTED_CREDIT_PROTECTION',
  }))
}

async function fetchProviderJson(
  state: FetchState,
  label: string,
  path: string,
  query: Record<string, string>
) {
  if (state.stop || state.calls.length >= state.maxCalls) {
    state.stop = true
    state.stopReason = state.stopReason ?? 'HARD_CALL_BUDGET_REACHED'
    return { payload: null as unknown, call: null as ProviderCall | null }
  }
  if (state.remaining !== null && state.remaining <= CREDIT_RESERVE) {
    state.stop = true
    state.stopReason = 'CREDIT_RESERVE_REACHED'
    return { payload: null as unknown, call: null as ProviderCall | null }
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15000)
  try {
    const response = await fetch(requestUrl(path, query).toString(), {
      cache: 'no-store',
      signal: controller.signal,
    })
    const text = await response.text()
    let parsed: unknown = null
    try {
      parsed = text ? JSON.parse(text) : null
    } catch {
      parsed = text
    }
    const call: ProviderCall = {
      label,
      endpoint: safeEndpoint(path, query),
      httpStatus: response.status,
      ok: response.ok,
      rows: response.ok ? rowCount(parsed) : 0,
      requestsRemaining: headerNumber(response.headers, 'x-requests-remaining'),
      requestsUsed: headerNumber(response.headers, 'x-requests-used'),
      requestsLast: headerNumber(response.headers, 'x-requests-last'),
      error: response.ok ? null : sanitizeError(parsed),
    }
    state.calls.push(call)
    state.remaining = call.requestsRemaining
    if (call.requestsRemaining === null) {
      state.stop = true
      state.stopReason = 'CREDIT_HEADERS_UNAVAILABLE'
    } else if (call.requestsRemaining <= CREDIT_RESERVE) {
      state.stop = true
      state.stopReason = 'CREDIT_RESERVE_REACHED'
    }
    return { payload: response.ok ? parsed : null, call }
  } catch (error) {
    const call: ProviderCall = {
      label,
      endpoint: safeEndpoint(path, query),
      httpStatus: null,
      ok: false,
      rows: 0,
      requestsRemaining: null,
      requestsUsed: null,
      requestsLast: null,
      error: sanitizeError(error instanceof Error ? error.message : error),
    }
    state.calls.push(call)
    state.stop = true
    state.stopReason = 'PROVIDER_REQUEST_FAILED'
    return { payload: null, call }
  } finally {
    clearTimeout(timeout)
  }
}

function summarizeEvents(events: OddsApiEvent[]) {
  const bookmakers = new Set<string>()
  const markets = new Set<string>()
  for (const event of events) {
    for (const bookmaker of event.bookmakers ?? []) {
      bookmakers.add(bookmaker.key)
      for (const market of bookmaker.markets ?? []) markets.add(market.key)
    }
  }
  return {
    events: events.length,
    bookmakers: Array.from(bookmakers).sort(),
    markets: Array.from(markets).sort(),
  }
}

function buildCapabilityMatrix({
  mappedCatalog,
  currentOddsBySport,
  scoresBySport,
  props,
}: {
  mappedCatalog: ReturnType<typeof catalogMapping>
  currentOddsBySport: Record<string, ReturnType<typeof summarizeEvents>>
  scoresBySport: Record<string, { status: CapabilityStatus; rows: number }>
  props: Record<string, { status: CapabilityStatus; rows: number; bookmakers: string[]; markets: string[] }>
}) {
  return mappedCatalog.map((sport) => {
    const odds = currentOddsBySport[sport.sportKey]
    const scores = scoresBySport[sport.sportKey]
    const prop = props[sport.sportKey]
    return {
      sportKey: sport.sportKey,
      label: sport.label,
      providerSportKeys: sport.catalogKeys,
      CURRENT_EVENTS: odds ? (odds.events > 0 ? 'AVAILABLE_WITH_ROWS' : 'AVAILABLE_NO_CURRENT_ROWS') : 'NOT_TESTED_CREDIT_PROTECTION',
      CURRENT_ODDS: odds ? (odds.markets.length > 0 ? 'AVAILABLE_WITH_ROWS' : 'AVAILABLE_NO_CURRENT_ROWS') : 'NOT_TESTED_CREDIT_PROTECTION',
      EVENT_MARKETS: odds ? (odds.markets.length > 0 ? 'AVAILABLE' : 'UNKNOWN') : 'NOT_TESTED_CREDIT_PROTECTION',
      PLAYER_PROPS: prop?.status ?? 'NOT_TESTED_CREDIT_PROTECTION',
      SCORES: scores?.status ?? 'NOT_TESTED_CREDIT_PROTECTION',
      HISTORICAL_ODDS: 'NOT_TESTED_RANGE_DISCOVERY_PENDING',
      BOOKMAKER_COVERAGE: odds ? odds.bookmakers : [],
      REGION_COVERAGE: odds ? ['us'] : [],
      SEASON_STATE: sport.seasonState,
    }
  })
}

function dryRunResponse() {
  const mappedCatalog = dryCatalog()
  return {
    success: true,
    mode: 'the_odds_api_maximum_utilization_v1',
    status: 'DRY_RUN',
    generatedAt: nowIso(),
    provider: PROVIDER,
    apiKeyPresent: Boolean(apiKey()),
    live: false,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
    productionMutationsMade: 0,
    rowsPersisted: 0,
    creditReserve: CREDIT_RESERVE,
    hardCallBudget: HARD_CALL_BUDGET,
    requestsRemainingBefore: null,
    requestsRemainingAfter: null,
    requestsUsedObserved: null,
    stopReason: null,
    catalog: {
      providerSportsFound: 0,
      mappedSports: mappedCatalog,
    },
    capabilityMatrix: buildCapabilityMatrix({
      mappedCatalog,
      currentOddsBySport: {},
      scoresBySport: {},
      props: {},
    }),
    coverage: {
      sportsWithCurrentEvents: 0,
      sportsWithCurrentOdds: 0,
      sportsWithScores: 0,
      sportsWithPlayerProps: 0,
      bookmakersObserved: [],
      marketsObserved: [],
    },
    planObserved: [],
    blockers: Boolean(apiKey()) ? [] : ['ODDS_API_KEY_NOT_PRESENT'],
    warnings: [
      'Dry-run mode makes zero provider calls.',
      'Historical odds range discovery is intentionally deferred to a later bounded checkpoint.',
    ],
  }
}

export async function runTheOddsApiMaximumUtilizationCheckpoint1(options: RunOptions = {}) {
  const live = bool(options.live) && options.dryRun !== true
  if (!live) return dryRunResponse()
  if (options.confirm !== CONFIRMATION) {
    return {
      ...dryRunResponse(),
      success: false,
      status: 'BLOCKED_CONFIRMATION_REQUIRED',
      warnings: [`Live catalog and capability audit requires confirm=${CONFIRMATION}.`],
    }
  }
  if (!apiKey()) {
    return {
      ...dryRunResponse(),
      success: false,
      status: 'BLOCKED_MISSING_API_KEY',
      warnings: ['The Odds API key is not present in runtime.'],
    }
  }

  const maxCalls = Math.min(Math.max(Number(options.maxCalls ?? HARD_CALL_BUDGET), 1), HARD_CALL_BUDGET)
  const maxSports = Math.min(Math.max(Number(options.maxSports ?? 6), 1), 8)
  const state: FetchState = {
    calls: [],
    maxCalls,
    stop: false,
    stopReason: null,
    remaining: null,
  }

  const catalogResult = await fetchProviderJson(state, 'catalog_all_sports', '/sports', { all: 'true' })
  const providerSports = Array.isArray(catalogResult.payload) ? catalogResult.payload as OddsApiSport[] : []
  const mappedCatalog = catalogMapping(providerSports)
  const catalogBySportKey = new Map(mappedCatalog.map((item) => [item.sportKey, item]))
  const providerKeyBySportKey = new Map(
    getEnabledSports().map((sport) => [
      sport.key,
      String(sport.metadata.providerSportKey ?? sport.key),
    ])
  )
  const probeSports = getEnabledSports()
    .filter((sport) => sport.key !== 'basketball_bsn')
    .map((sport) => ({ sport, mapped: catalogBySportKey.get(sport.key), providerKey: providerKeyBySportKey.get(sport.key) ?? sport.key }))
    .filter((item) => item.mapped?.directCatalogMatch || item.mapped?.catalogKeys.length)
    .slice(0, maxSports)

  const currentOddsBySport: Record<string, ReturnType<typeof summarizeEvents>> = {}
  const scoresBySport: Record<string, { status: CapabilityStatus; rows: number }> = {}
  const props: Record<string, { status: CapabilityStatus; rows: number; bookmakers: string[]; markets: string[] }> = {}

  for (const item of probeSports) {
    const providerKey = item.providerKey
    const oddsResult = await fetchProviderJson(state, `current_odds_${item.sport.key}`, `/sports/${providerKey}/odds`, {
      regions: 'us',
      markets: STANDARD_MARKETS.join(','),
      oddsFormat: 'american',
    })
    const oddsEvents = Array.isArray(oddsResult.payload) ? oddsResult.payload as OddsApiEvent[] : []
    currentOddsBySport[item.sport.key] = summarizeEvents(oddsEvents)
    if (state.stop) break
  }

  for (const item of probeSports.slice(0, 3)) {
    if (state.stop) break
    const scoresResult = await fetchProviderJson(state, `scores_${item.sport.key}`, `/sports/${item.providerKey}/scores`, {
      daysFrom: String(item.sport.scoresDaysFrom),
    })
    scoresBySport[item.sport.key] = {
      status: scoresResult.call?.ok ? (scoresResult.call.rows > 0 ? 'AVAILABLE_WITH_ROWS' : 'AVAILABLE_NO_CURRENT_ROWS') : 'BLOCKED',
      rows: scoresResult.call?.rows ?? 0,
    }
  }

  const mlbKey = providerKeyBySportKey.get('baseball_mlb') ?? 'baseball_mlb'
  const mlbOdds = currentOddsBySport.baseball_mlb
  if (!state.stop && mlbOdds?.events) {
    const eventsResult = await fetchProviderJson(state, 'mlb_events_for_props', `/sports/${mlbKey}/events`, {})
    const events = Array.isArray(eventsResult.payload) ? eventsResult.payload as OddsApiEvent[] : []
    const firstEvent = events.find((event) => event.id && new Date(event.commence_time ?? 0) > new Date()) ?? events[0]
    if (firstEvent?.id && !state.stop) {
      const propResult = await fetchProviderJson(state, 'mlb_event_player_props_probe', `/sports/${mlbKey}/events/${firstEvent.id}/odds`, {
        regions: 'us',
        markets: PLAYER_PROP_PROBE_MARKETS.join(','),
        oddsFormat: 'american',
      })
      const propEvents = Array.isArray(propResult.payload)
        ? propResult.payload as OddsApiEvent[]
        : propResult.payload
          ? [propResult.payload as OddsApiEvent]
          : []
      const summary = summarizeEvents(propEvents)
      props.baseball_mlb = {
        status: propResult.call?.ok
          ? summary.markets.length > 0
            ? 'AVAILABLE_WITH_ROWS'
            : 'AVAILABLE_NO_CURRENT_ROWS'
          : 'BLOCKED',
        rows: propResult.call?.rows ?? 0,
        bookmakers: summary.bookmakers,
        markets: summary.markets,
      }
    } else {
      props.baseball_mlb = { status: 'NOT_TESTED_NO_EVENT', rows: 0, bookmakers: [], markets: [] }
    }
  }

  const matrix = buildCapabilityMatrix({
    mappedCatalog,
    currentOddsBySport,
    scoresBySport,
    props,
  })
  const bookmakerSet = new Set<string>()
  const marketSet = new Set<string>()
  Object.values(currentOddsBySport).forEach((item) => {
    item.bookmakers.forEach((bookmaker) => bookmakerSet.add(bookmaker))
    item.markets.forEach((market) => marketSet.add(market))
  })
  Object.values(props).forEach((item) => {
    item.bookmakers.forEach((bookmaker) => bookmakerSet.add(bookmaker))
    item.markets.forEach((market) => marketSet.add(market))
  })
  const firstCall = state.calls[0] ?? null
  const lastCall = state.calls.at(-1) ?? null
  const beforeUsed = firstCall?.requestsUsed ?? null
  const afterUsed = lastCall?.requestsUsed ?? null
  const requestsUsedObserved = beforeUsed !== null && afterUsed !== null ? Math.max(0, afterUsed - beforeUsed) : null
  const creditHeadersAvailable = state.calls.length > 0 && state.calls.every((call) => call.requestsRemaining !== null)
  const reserveMaintained = lastCall?.requestsRemaining === null ? false : (lastCall?.requestsRemaining ?? 0) > CREDIT_RESERVE

  return {
    success: creditHeadersAvailable && reserveMaintained && state.calls.some((call) => call.ok),
    mode: 'the_odds_api_maximum_utilization_v1',
    status: creditHeadersAvailable
      ? reserveMaintained
        ? 'LIVE_AUDIT_COMPLETE'
        : 'BLOCKED_CREDIT_RESERVE_REACHED'
      : 'BLOCKED_CREDIT_HEADERS_UNAVAILABLE',
    generatedAt: nowIso(),
    provider: PROVIDER,
    apiKeyPresent: true,
    live: true,
    providerCallsMade: state.calls.length,
    remoteMutationsMade: 0,
    productionMutationsMade: 0,
    rowsPersisted: 0,
    creditReserve: CREDIT_RESERVE,
    hardCallBudget: HARD_CALL_BUDGET,
    requestsRemainingBefore: firstCall?.requestsRemaining ?? null,
    requestsRemainingAfter: lastCall?.requestsRemaining ?? null,
    requestsUsedObserved,
    stopReason: state.stopReason,
    catalog: {
      providerSportsFound: providerSports.length,
      activeProviderSports: providerSports.filter((sport) => sport.active).length,
      mappedSports: mappedCatalog,
      unmappedActiveProviderSports: providerSports
        .filter((sport) => sport.active)
        .filter((sport) => !SPORTS.some((item) => String(item.metadata.providerSportKey ?? item.key) === sport.key))
        .map((sport) => ({ key: sport.key, group: sport.group ?? null, title: sport.title ?? sport.key }))
        .slice(0, 50),
    },
    capabilityMatrix: matrix,
    coverage: {
      sportsWithCurrentEvents: Object.values(currentOddsBySport).filter((item) => item.events > 0).length,
      sportsWithCurrentOdds: Object.values(currentOddsBySport).filter((item) => item.markets.length > 0).length,
      sportsWithScores: Object.values(scoresBySport).filter((item) => item.status === 'AVAILABLE_WITH_ROWS').length,
      sportsWithPlayerProps: Object.values(props).filter((item) => item.status === 'AVAILABLE_WITH_ROWS').length,
      bookmakersObserved: Array.from(bookmakerSet).sort(),
      marketsObserved: Array.from(marketSet).sort(),
    },
    planObserved: state.calls,
    blockers: [
      creditHeadersAvailable ? null : 'CREDIT_HEADERS_UNAVAILABLE',
      reserveMaintained ? null : 'CREDIT_RESERVE_NOT_MAINTAINED',
      state.stopReason,
    ].filter(Boolean) as string[],
    warnings: [
      'Historical odds range discovery is intentionally deferred to a later bounded checkpoint.',
      'No provider payload is persisted as production odds or predictions by this checkpoint.',
    ],
  }
}

export async function getTheOddsApiCatalog(options: RunOptions = {}) {
  const result = await runTheOddsApiMaximumUtilizationCheckpoint1(options)
  return {
    success: result.success,
    mode: 'the_odds_api_catalog_v1',
    generatedAt: result.generatedAt,
    provider: result.provider,
    live: result.live,
    providerCallsMade: result.providerCallsMade,
    remoteMutationsMade: result.remoteMutationsMade,
    productionMutationsMade: result.productionMutationsMade,
    creditReserve: result.creditReserve,
    requestsRemainingAfter: result.requestsRemainingAfter,
    catalog: result.catalog,
    warnings: result.warnings,
  }
}

export async function getTheOddsApiQuota(options: RunOptions = {}) {
  const result = await runTheOddsApiMaximumUtilizationCheckpoint1(options)
  return {
    success: result.success,
    mode: 'the_odds_api_quota_v1',
    generatedAt: result.generatedAt,
    provider: result.provider,
    live: result.live,
    providerCallsMade: result.providerCallsMade,
    remoteMutationsMade: result.remoteMutationsMade,
    productionMutationsMade: result.productionMutationsMade,
    creditReserve: result.creditReserve,
    requestsRemainingBefore: result.requestsRemainingBefore,
    requestsRemainingAfter: result.requestsRemainingAfter,
    requestsUsedObserved: result.requestsUsedObserved,
    reserveMaintained: result.requestsRemainingAfter === null ? !result.live : result.requestsRemainingAfter > result.creditReserve,
    planObserved: result.planObserved,
    blockers: result.blockers,
    warnings: result.warnings,
  }
}

export async function getTheOddsApiCapability(options: RunOptions = {}) {
  const result = await runTheOddsApiMaximumUtilizationCheckpoint1(options)
  return {
    success: result.success,
    mode: 'the_odds_api_capability_v1',
    generatedAt: result.generatedAt,
    provider: result.provider,
    live: result.live,
    providerCallsMade: result.providerCallsMade,
    remoteMutationsMade: result.remoteMutationsMade,
    productionMutationsMade: result.productionMutationsMade,
    capabilityMatrix: result.capabilityMatrix,
    blockers: result.blockers,
    warnings: result.warnings,
  }
}

export async function getTheOddsApiCoverage(options: RunOptions = {}) {
  const result = await runTheOddsApiMaximumUtilizationCheckpoint1(options)
  return {
    success: result.success,
    mode: 'the_odds_api_coverage_v1',
    generatedAt: result.generatedAt,
    provider: result.provider,
    live: result.live,
    providerCallsMade: result.providerCallsMade,
    remoteMutationsMade: result.remoteMutationsMade,
    productionMutationsMade: result.productionMutationsMade,
    coverage: result.coverage,
    catalogSummary: {
      providerSportsFound: result.catalog.providerSportsFound,
      mappedSports: result.catalog.mappedSports.length,
    },
    blockers: result.blockers,
    warnings: result.warnings,
  }
}

export function validateTheOddsApiMaximumUtilizationCheckpoint1Fixtures() {
  const dry = dryRunResponse()
  const rendered = JSON.stringify(dry)
  const matrixKeys = Object.keys(dry.capabilityMatrix[0] ?? {})
  const key = apiKey()
  const checks = [
    ['dry run makes zero provider calls', dry.providerCallsMade === 0],
    ['dry run makes zero mutations', dry.remoteMutationsMade === 0 && dry.productionMutationsMade === 0],
    ['secret material is not rendered', !rendered.includes('apiKey=') && (!key || !rendered.includes(key))],
    ['credit reserve is 2000', CREDIT_RESERVE === 2000],
    ['hard call budget is bounded', HARD_CALL_BUDGET <= 12],
    ['catalog includes all enabled sports', dry.catalog.mappedSports.length === getEnabledSports().length],
    ['capability matrix includes current events', matrixKeys.includes('CURRENT_EVENTS')],
    ['capability matrix includes current odds', matrixKeys.includes('CURRENT_ODDS')],
    ['capability matrix includes event markets', matrixKeys.includes('EVENT_MARKETS')],
    ['capability matrix includes player props', matrixKeys.includes('PLAYER_PROPS')],
    ['capability matrix includes scores', matrixKeys.includes('SCORES')],
    ['capability matrix includes historical odds', matrixKeys.includes('HISTORICAL_ODDS')],
    ['capability matrix includes bookmaker coverage', matrixKeys.includes('BOOKMAKER_COVERAGE')],
    ['capability matrix includes region coverage', matrixKeys.includes('REGION_COVERAGE')],
    ['capability matrix includes season state', matrixKeys.includes('SEASON_STATE')],
  ] as const
  const failedChecks = checks.filter(([, passed]) => !passed).map(([name]) => name)
  return {
    success: failedChecks.length === 0,
    mode: 'the_odds_api_maximum_utilization_v1_checkpoint1_validation',
    checks: checks.length,
    passed: checks.length - failedChecks.length,
    failed: failedChecks.length,
    failedChecks,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
    productionMutationsMade: 0,
  }
}
