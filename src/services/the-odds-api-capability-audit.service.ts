import 'server-only'

import { createHash } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase-admin'

const PROVIDER = 'the-odds-api'
const SPORT_KEY = 'baseball_mlb'
const LEAGUE_KEY = 'mlb'
const BASE_URL = 'https://api.the-odds-api.com/v4'
const CONFIRMATION = 'ODDS_API_AUDIT'
const HARD_CALL_BUDGET = 15
const LOW_QUOTA_STOP = 25

const STANDARD_MARKETS = ['h2h', 'spreads', 'totals'] as const
const PLAYER_PROP_MARKETS = [
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
  'batter_strikeouts',
  'batter_stolen_bases',
] as const

type MarketStatus =
  | 'AVAILABLE_WITH_ROWS'
  | 'AVAILABLE_NO_CURRENT_ROWS'
  | 'UNSUPPORTED_MARKET'
  | 'PLAN_ENTITLEMENT_BLOCKED'
  | 'NO_ELIGIBLE_EVENT'
  | 'PROVIDER_ERROR'
  | 'NOT_TESTED_CREDIT_PROTECTION'

type ProviderEvent = {
  id: string
  sport_key?: string
  sport_title?: string
  commence_time: string
  home_team: string
  away_team: string
  bookmakers?: Bookmaker[]
}

type Bookmaker = {
  key: string
  title?: string
  last_update?: string
  markets?: ProviderMarket[]
}

type ProviderMarket = {
  key: string
  last_update?: string
  outcomes?: ProviderOutcome[]
}

type ProviderOutcome = {
  name: string
  description?: string
  price?: number
  point?: number
}

type InternalEvent = {
  id: string
  sport_key: string | null
  league_key: string | null
  start_time: string | null
  status: string | null
  home_team: string | null
  away_team: string | null
  provider_ids: Record<string, unknown> | null
  metadata: Record<string, unknown> | null
}

type ProviderMapping = {
  internal_id: string | null
  provider_id: string | null
  provider: string | null
  entity_type: string | null
  sport_key: string | null
}

type AuditOptions = {
  dryRun?: boolean
  live?: boolean
  confirm?: string | null
  maxCalls?: number | null
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

function nowIso() {
  return new Date().toISOString()
}

function bool(value: unknown) {
  return value === true || value === 'true'
}

function apiKey() {
  return process.env.ODDS_API_KEY?.trim() ?? process.env.THE_ODDS_API_KEY?.trim() ?? ''
}

function plannedRequests() {
  return [
    {
      label: 'events',
      endpoint: `/sports/${SPORT_KEY}/events`,
      markets: [],
      purpose: 'Validate key, observe current MLB event IDs and capture provider event identity fields.',
    },
    {
      label: 'standard_markets',
      endpoint: `/sports/${SPORT_KEY}/odds`,
      markets: [...STANDARD_MARKETS],
      purpose: 'Test grouped standard MLB h2h, spreads and totals in one bounded call.',
    },
    ...PLAYER_PROP_MARKETS.map((market) => ({
      label: `prop_${market}`,
      endpoint: `/sports/${SPORT_KEY}/events/{eventId}/odds`,
      markets: [market],
      purpose: `Test current event-level player-prop access for ${market}.`,
    })),
  ]
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

function countRows(payload: unknown) {
  return Array.isArray(payload) ? payload.length : payload ? 1 : 0
}

function endpointFor(path: string, query: Record<string, string>) {
  const url = new URL(`${BASE_URL}${path}`)
  url.searchParams.set('apiKey', apiKey())
  Object.entries(query).forEach(([key, value]) => url.searchParams.set(key, value))
  return url
}

async function fetchProviderJson(
  state: { calls: ProviderCall[]; maxCalls: number; stop: boolean },
  label: string,
  path: string,
  query: Record<string, string>
) {
  if (state.stop || state.calls.length >= state.maxCalls) {
    state.stop = true
    return { payload: null as unknown, call: null as ProviderCall | null }
  }
  const url = endpointFor(path, query)
  const endpoint = `${path}?${new URLSearchParams(query).toString()}`
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 12000)
  try {
    const response = await fetch(url.toString(), { cache: 'no-store', signal: controller.signal })
    const text = await response.text()
    const parsed = text ? JSON.parse(text) : null
    const call: ProviderCall = {
      label,
      endpoint,
      httpStatus: response.status,
      ok: response.ok,
      rows: response.ok ? countRows(parsed) : 0,
      requestsRemaining: headerNumber(response.headers, 'x-requests-remaining'),
      requestsUsed: headerNumber(response.headers, 'x-requests-used'),
      requestsLast: headerNumber(response.headers, 'x-requests-last'),
      error: response.ok ? null : sanitizeError(parsed),
    }
    state.calls.push(call)
    if (call.requestsRemaining !== null && call.requestsRemaining < LOW_QUOTA_STOP) state.stop = true
    return { payload: response.ok ? parsed : null, call }
  } catch (error) {
    const call: ProviderCall = {
      label,
      endpoint,
      httpStatus: null,
      ok: false,
      rows: 0,
      requestsRemaining: null,
      requestsUsed: null,
      requestsLast: null,
      error: sanitizeError(error instanceof Error ? error.message : error),
    }
    state.calls.push(call)
    return { payload: null, call }
  } finally {
    clearTimeout(timeout)
  }
}

function normalizeTeam(value: unknown) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .replace(/^the/, '')
}

function minuteBucket(value: string | null | undefined) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return Math.floor(date.getTime() / 60000)
}

function withinMinutes(a: string | null | undefined, b: string | null | undefined, minutes: number) {
  const left = minuteBucket(a)
  const right = minuteBucket(b)
  return left !== null && right !== null && Math.abs(left - right) <= minutes
}

function hash(parts: unknown[]) {
  return createHash('sha256').update(parts.map((part) => String(part ?? 'null')).join('|')).digest('hex').slice(0, 24)
}

function marketStatusFromCall(market: string, call: ProviderCall | null, rows: number, noEvent: boolean): MarketStatus {
  if (noEvent) return 'NO_ELIGIBLE_EVENT'
  if (!call) return 'NOT_TESTED_CREDIT_PROTECTION'
  if (call.ok) return rows > 0 ? 'AVAILABLE_WITH_ROWS' : 'AVAILABLE_NO_CURRENT_ROWS'
  const error = String(call.error ?? '').toLowerCase()
  if (error.includes('not a valid market') || error.includes('invalid market') || error.includes(market.toLowerCase()) && error.includes('not supported')) return 'UNSUPPORTED_MARKET'
  if (error.includes('subscription') || error.includes('plan') || error.includes('not permitted') || error.includes('quota') || error.includes('usage')) return 'PLAN_ENTITLEMENT_BLOCKED'
  return 'PROVIDER_ERROR'
}

function summarizeMarkets(events: ProviderEvent[], markets: readonly string[]) {
  return markets.reduce<Record<string, {
    status: MarketStatus
    rows: number
    bookmakers: string[]
    sample: Record<string, unknown> | null
  }>>((acc, market) => {
    const rows: Array<{ event: ProviderEvent; bookmaker: Bookmaker; outcome: ProviderOutcome; market: ProviderMarket }> = []
    for (const event of events) {
      for (const bookmaker of event.bookmakers ?? []) {
        for (const item of bookmaker.markets ?? []) {
          if (item.key !== market) continue
          for (const outcome of item.outcomes ?? []) rows.push({ event, bookmaker, market: item, outcome })
        }
      }
    }
    const sample = rows[0]
    acc[market] = {
      status: rows.length ? 'AVAILABLE_WITH_ROWS' : 'AVAILABLE_NO_CURRENT_ROWS',
      rows: rows.length,
      bookmakers: Array.from(new Set(rows.map((row) => row.bookmaker.key))).sort(),
      sample: sample ? {
        eventIdPresent: Boolean(sample.event.id),
        commenceTimePresent: Boolean(sample.event.commence_time),
        bookmakerKeyPresent: Boolean(sample.bookmaker.key),
        marketKey: sample.market.key,
        lastUpdatePresent: Boolean(sample.bookmaker.last_update ?? sample.market.last_update),
        outcomeNamePresent: Boolean(sample.outcome.name),
        playerDescriptionPresent: Boolean(sample.outcome.description),
        linePresent: typeof sample.outcome.point === 'number',
        pricePresent: typeof sample.outcome.price === 'number',
      } : null,
    }
    return acc
  }, {})
}

function propRows(events: ProviderEvent[], market: string) {
  return events.flatMap((event) => (event.bookmakers ?? []).flatMap((bookmaker) => (bookmaker.markets ?? [])
    .filter((item) => item.key === market)
    .flatMap((item) => (item.outcomes ?? []).map((outcome) => ({ event, bookmaker, market: item, outcome })))))
}

function validatePropRows(eventsByMarket: Record<string, ProviderEvent[]>) {
  const details: Record<string, unknown> = {}
  let pitcherOutsRows = 0
  const pitcherOutsBookmakers = new Set<string>()
  for (const market of PLAYER_PROP_MARKETS) {
    const rows = propRows(eventsByMarket[market] ?? [], market)
    if (market === 'pitcher_outs') {
      pitcherOutsRows = rows.length
      rows.forEach((row) => pitcherOutsBookmakers.add(row.bookmaker.key))
    }
    const keys = new Set<string>()
    let duplicateIdentity = 0
    for (const row of rows) {
      const stableKey = hash([PROVIDER, row.event.id, market, row.bookmaker.key, row.outcome.description, row.outcome.name, row.outcome.point])
      if (keys.has(stableKey)) duplicateIdentity += 1
      keys.add(stableKey)
    }
    details[market] = {
      rows: rows.length,
      eventIdPresent: rows.every((row) => Boolean(row.event.id)),
      marketKeyPresent: rows.every((row) => row.market.key === market),
      bookmakerPresent: rows.every((row) => Boolean(row.bookmaker.key)),
      lastUpdatePresent: rows.every((row) => Boolean(row.bookmaker.last_update ?? row.market.last_update)),
      playerNamePresent: rows.every((row) => Boolean(row.outcome.description)),
      linePresent: rows.every((row) => typeof row.outcome.point === 'number'),
      overRows: rows.filter((row) => row.outcome.name.toLowerCase() === 'over').length,
      underRows: rows.filter((row) => row.outcome.name.toLowerCase() === 'under').length,
      pricePresent: rows.every((row) => typeof row.outcome.price === 'number'),
      duplicateIdentity,
      stableDeterministicKeyCandidate: rows.length ? 'provider|event_id|market|bookmaker|player|outcome|line' : null,
    }
  }
  return {
    pitcherOutsRows,
    pitcherOutsBookmakers: Array.from(pitcherOutsBookmakers).sort(),
    details,
  }
}

async function readInternalEvents(providerEvents: ProviderEvent[]) {
  const starts = providerEvents
    .map((event) => new Date(event.commence_time))
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort((a, b) => a.getTime() - b.getTime())
  const start = starts[0] ? new Date(starts[0].getTime() - 36e5).toISOString() : new Date(Date.now() - 36e5).toISOString()
  const end = starts.at(-1) ? new Date(starts.at(-1)!.getTime() + 36e5).toISOString() : new Date(Date.now() + 14 * 864e5).toISOString()
  const [eventsResult, mappingsResult] = await Promise.all([
    supabaseAdmin
      .from('sport_events')
      .select('id, sport_key, league_key, start_time, status, home_team, away_team, provider_ids, metadata')
      .eq('sport_key', SPORT_KEY)
      .gte('start_time', start)
      .lte('start_time', end)
      .limit(500),
    supabaseAdmin
      .from('provider_entity_mappings')
      .select('internal_id, provider_id, provider, entity_type, sport_key')
      .eq('sport_key', SPORT_KEY)
      .eq('provider', PROVIDER)
      .limit(1000),
  ])
  return {
    events: (eventsResult.data ?? []) as InternalEvent[],
    mappings: (mappingsResult.data ?? []) as ProviderMapping[],
    warnings: [
      eventsResult.error ? `sport_events_read_failed:${eventsResult.error.message}` : null,
      mappingsResult.error ? `provider_entity_mappings_read_failed:${mappingsResult.error.message}` : null,
    ].filter(Boolean) as string[],
  }
}

async function crosswalk(providerEvents: ProviderEvent[]) {
  const internal = await readInternalEvents(providerEvents)
  const mappingByProviderId = new Map(internal.mappings.map((row) => [String(row.provider_id), row]))
  const exactMatches: Array<Record<string, string>> = []
  const probableMatches: Array<Record<string, string | number>> = []
  const ambiguities: Array<Record<string, unknown>> = []
  const unmatchedProviderEvents: ProviderEvent[] = []
  const matchedInternal = new Set<string>()

  for (const providerEvent of providerEvents) {
    const mapped = mappingByProviderId.get(providerEvent.id)
    if (mapped?.internal_id) {
      exactMatches.push({ providerEventId: providerEvent.id, internalEventId: mapped.internal_id, method: 'provider_entity_mappings' })
      matchedInternal.add(mapped.internal_id)
      continue
    }
    const providerIdMatches = internal.events.filter((event) => {
      const ids = event.provider_ids ?? {}
      return Object.values(ids).map(String).includes(providerEvent.id)
    })
    if (providerIdMatches.length === 1) {
      exactMatches.push({ providerEventId: providerEvent.id, internalEventId: providerIdMatches[0].id, method: 'sport_events.provider_ids' })
      matchedInternal.add(providerIdMatches[0].id)
      continue
    }
    const candidates = internal.events.filter((event) => (
      event.sport_key === SPORT_KEY &&
      normalizeTeam(event.home_team) === normalizeTeam(providerEvent.home_team) &&
      normalizeTeam(event.away_team) === normalizeTeam(providerEvent.away_team) &&
      withinMinutes(event.start_time, providerEvent.commence_time, 30)
    ))
    if (candidates.length === 1) {
      probableMatches.push({ providerEventId: providerEvent.id, internalEventId: candidates[0].id, method: 'team_time_30m', minuteDelta: Math.abs((minuteBucket(candidates[0].start_time) ?? 0) - (minuteBucket(providerEvent.commence_time) ?? 0)) })
      matchedInternal.add(candidates[0].id)
    } else if (candidates.length > 1) {
      ambiguities.push({ providerEventId: providerEvent.id, candidateCount: candidates.length, candidateIds: candidates.map((event) => event.id) })
    } else {
      unmatchedProviderEvents.push(providerEvent)
    }
  }
  return {
    exactMatches,
    probableMatches,
    unmatchedProviderEvents: unmatchedProviderEvents.map((event) => ({ providerEventId: event.id, commenceTime: event.commence_time, homeTeam: event.home_team, awayTeam: event.away_team })),
    unmatchedInternalEvents: internal.events
      .filter((event) => !matchedInternal.has(event.id))
      .map((event) => ({ internalEventId: event.id, startTime: event.start_time, homeTeam: event.home_team, awayTeam: event.away_team }))
      .slice(0, 25),
    ambiguities,
    warnings: internal.warnings,
  }
}

function dryRunResponse() {
  const apiKeyPresent = Boolean(apiKey())
  return {
    success: true,
    status: 'DRY_RUN',
    provider: PROVIDER,
    generatedAt: nowIso(),
    planObserved: plannedRequests(),
    apiKeyPresent,
    apiKeyValid: null,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
    rowsPersisted: 0,
    requestsRemainingBefore: null,
    requestsRemainingAfter: null,
    requestsUsedObserved: null,
    requestsLast: null,
    sportsTested: [SPORT_KEY],
    eventsFound: 0,
    bookmakersFound: [],
    standardMarkets: Object.fromEntries(STANDARD_MARKETS.map((market) => [market, { status: 'NOT_TESTED_CREDIT_PROTECTION' as MarketStatus, rows: 0, bookmakers: [] }])),
    playerPropMarkets: Object.fromEntries(PLAYER_PROP_MARKETS.map((market) => [market, { status: 'NOT_TESTED_CREDIT_PROTECTION' as MarketStatus, rows: 0, bookmakers: [] }])),
    pitcherOutsStatus: 'NOT_TESTED_CREDIT_PROTECTION' as MarketStatus,
    pitcherOutsRows: 0,
    identityCrosswalk: { exactMatches: [], probableMatches: [], unmatchedProviderEvents: [], unmatchedInternalEvents: [], ambiguities: [] },
    normalizationReadiness: { ready: false, reason: 'dry_run_no_provider_payload' },
    historicalOddsAvailable: 'NOT_TESTED_HISTORICAL_ENDPOINTS_BLOCKED_BY_AUDIT_SCOPE',
    blockers: apiKeyPresent ? [] : ['ODDS_API_KEY_NOT_PRESENT'],
    warnings: ['Dry-run mode made zero provider calls.'],
    recommendation: 'Run POST with live=true and confirm=ODDS_API_AUDIT only when ready to spend a bounded maximum of 15 provider calls.',
  }
}

export async function runTheOddsApiCapabilityAudit(options: AuditOptions = {}) {
  const live = bool(options.live) && options.dryRun !== true
  if (!live) return dryRunResponse()
  if (options.confirm !== CONFIRMATION) {
    return {
      ...dryRunResponse(),
      success: false,
      status: 'BLOCKED_CONFIRMATION_REQUIRED',
      warnings: ['Live provider audit requires confirm=ODDS_API_AUDIT.'],
    }
  }

  const keyPresent = Boolean(apiKey())
  if (!keyPresent) {
    return {
      ...dryRunResponse(),
      success: false,
      status: 'BLOCKED_MISSING_API_KEY',
      warnings: ['The Odds API key is not present in runtime.'],
    }
  }

  const maxCalls = Math.min(Math.max(Number(options.maxCalls ?? HARD_CALL_BUDGET), 1), HARD_CALL_BUDGET)
  const state = { calls: [] as ProviderCall[], maxCalls, stop: false }
  const eventsResult = await fetchProviderJson(state, 'events', `/sports/${SPORT_KEY}/events`, {})
  const events = Array.isArray(eventsResult.payload) ? eventsResult.payload as ProviderEvent[] : []
  const eligibleEvent = events.find((event) => new Date(event.commence_time) > new Date()) ?? events[0] ?? null
  const requestsRemainingBefore = eventsResult.call?.requestsRemaining ?? null

  const standardResult = await fetchProviderJson(state, 'standard_markets', `/sports/${SPORT_KEY}/odds`, {
    regions: 'us',
    markets: STANDARD_MARKETS.join(','),
    oddsFormat: 'american',
  })
  const standardEvents = Array.isArray(standardResult.payload) ? standardResult.payload as ProviderEvent[] : []

  const propEventsByMarket: Record<string, ProviderEvent[]> = {}
  const playerPropMarkets: Record<string, { status: MarketStatus; rows: number; bookmakers: string[]; sample: Record<string, unknown> | null }> = {}
  for (const market of PLAYER_PROP_MARKETS) {
    if (!eligibleEvent) {
      playerPropMarkets[market] = { status: 'NO_ELIGIBLE_EVENT', rows: 0, bookmakers: [], sample: null }
      continue
    }
    if (state.stop || state.calls.length >= state.maxCalls) {
      playerPropMarkets[market] = { status: 'NOT_TESTED_CREDIT_PROTECTION', rows: 0, bookmakers: [], sample: null }
      continue
    }
    const result = await fetchProviderJson(state, `prop_${market}`, `/sports/${SPORT_KEY}/events/${eligibleEvent.id}/odds`, {
      regions: 'us',
      markets: market,
      oddsFormat: 'american',
    })
    const marketEvents = Array.isArray(result.payload) ? result.payload as ProviderEvent[] : result.payload ? [result.payload as ProviderEvent] : []
    propEventsByMarket[market] = marketEvents
    const summary = summarizeMarkets(marketEvents, [market])[market]
    playerPropMarkets[market] = {
      ...summary,
      status: marketStatusFromCall(market, result.call, summary.rows, false),
    }
  }

  const standardMarkets = summarizeMarkets(standardEvents, STANDARD_MARKETS)
  for (const market of STANDARD_MARKETS) {
    standardMarkets[market].status = marketStatusFromCall(market, standardResult.call, standardMarkets[market].rows, false)
  }

  const propValidation = validatePropRows(propEventsByMarket)
  const crosswalkResult = await crosswalk(events)
  const bookmakersFound = Array.from(new Set([
    ...standardEvents.flatMap((event) => (event.bookmakers ?? []).map((bookmaker) => bookmaker.key)),
    ...Object.values(propEventsByMarket).flatMap((items) => items.flatMap((event) => (event.bookmakers ?? []).map((bookmaker) => bookmaker.key))),
  ])).sort()
  const lastCall = state.calls.at(-1) ?? null
  const beforeUsed = eventsResult.call?.requestsUsed ?? null
  const afterUsed = lastCall?.requestsUsed ?? null
  const requestsUsedObserved = beforeUsed !== null && afterUsed !== null ? Math.max(0, afterUsed - beforeUsed) : state.calls.length
  const apiKeyValid = state.calls.some((call) => call.ok)
  const availableProps = Object.entries(playerPropMarkets).filter(([, value]) => value.status === 'AVAILABLE_WITH_ROWS')
  const blockers = [
    apiKeyValid ? null : 'ODDS_API_KEY_INVALID_OR_PROVIDER_UNREACHABLE',
    eligibleEvent ? null : 'NO_CURRENT_MLB_EVENTS_RETURNED',
    playerPropMarkets.pitcher_outs?.status === 'AVAILABLE_WITH_ROWS' ? null : `PITCHER_OUTS_${playerPropMarkets.pitcher_outs?.status ?? 'NOT_TESTED'}`,
    crosswalkResult.exactMatches.length + crosswalkResult.probableMatches.length > 0 ? null : 'ODDS_API_EVENT_CROSSWALK_NOT_PROVEN',
  ].filter(Boolean) as string[]

  return {
    success: apiKeyValid,
    status: blockers.length ? 'AUDIT_COMPLETE_WITH_BLOCKERS' : 'AUDIT_COMPLETE_READY_FOR_REVIEW',
    provider: PROVIDER,
    generatedAt: nowIso(),
    planObserved: state.calls,
    apiKeyPresent: keyPresent,
    apiKeyValid,
    providerCallsMade: state.calls.length,
    remoteMutationsMade: 0,
    rowsPersisted: 0,
    requestsRemainingBefore,
    requestsRemainingAfter: lastCall?.requestsRemaining ?? null,
    requestsUsedObserved,
    requestsLast: lastCall?.requestsLast ?? null,
    sportsTested: [SPORT_KEY],
    eventsFound: events.length,
    eventsSample: events.slice(0, 10).map((event) => ({ id: event.id, commenceTime: event.commence_time, homeTeam: event.home_team, awayTeam: event.away_team })),
    bookmakersFound,
    standardMarkets,
    playerPropMarkets,
    pitcherOutsStatus: playerPropMarkets.pitcher_outs?.status ?? 'NOT_TESTED_CREDIT_PROTECTION',
    pitcherOutsRows: propValidation.pitcherOutsRows,
    pitcherOutsBookmakers: propValidation.pitcherOutsBookmakers,
    identityCrosswalk: crosswalkResult,
    normalizationReadiness: {
      ready: availableProps.length > 0 && propValidation.pitcherOutsRows > 0,
      propValidation: propValidation.details,
      eventIdsPresent: events.every((event) => Boolean(event.id)),
      commenceTimesPresent: events.every((event) => Boolean(event.commence_time)),
      bookmakerKeysObserved: bookmakersFound,
    },
    historicalOddsAvailable: 'NOT_TESTED_HISTORICAL_ENDPOINTS_BLOCKED_BY_AUDIT_SCOPE',
    blockers,
    warnings: [
      state.calls.length >= HARD_CALL_BUDGET ? 'Hard provider-call budget reached.' : null,
      state.stop ? 'Audit stopped due to credit protection.' : null,
      ...crosswalkResult.warnings,
    ].filter(Boolean) as string[],
    recommendation: availableProps.length
      ? 'The free-tier key returned at least one player-prop market in this bounded audit. Review quota and crosswalk evidence before any ingestion design.'
      : 'Do not replace SportsDataIO or enable prop ingestion from this key without resolving player-prop availability and event crosswalk blockers.',
  }
}

export function validateTheOddsApiCapabilityAuditFixtures() {
  const dryRun = dryRunResponse()
  const rendered = JSON.stringify(dryRun)
  const checks = [
    ['dry-run uses zero provider calls', dryRun.providerCallsMade === 0],
    ['dry-run exposes no secret material', !/[a-f0-9]{24,}/i.test(rendered) && !rendered.includes('apiKey=')],
    ['hard call budget is 15 or lower', HARD_CALL_BUDGET <= 15],
    ['standard markets include h2h spreads totals', STANDARD_MARKETS.join(',') === 'h2h,spreads,totals'],
    ['pitcher_outs is tested', PLAYER_PROP_MARKETS.includes('pitcher_outs')],
  ] as const
  const failedChecks = checks.filter(([, passed]) => !passed).map(([name]) => name)
  return {
    success: failedChecks.length === 0,
    mode: 'the_odds_api_capability_audit_validation_v1',
    checks: checks.length,
    passed: checks.length - failedChecks.length,
    failed: failedChecks.length,
    failedChecks,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
  }
}
