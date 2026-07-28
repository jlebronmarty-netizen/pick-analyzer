import 'server-only'

import { createHash } from 'crypto'
import { SPORTS, getEnabledSports } from '@/config/sports.config'
import { supabaseAdmin } from '@/lib/supabase-admin'

const PROVIDER = 'the-odds-api'
const BASE_URL = 'https://api.the-odds-api.com/v4'
const CONFIRMATION = 'ODDS_API_CURRENT_ODDS_V1'
const CREDIT_RESERVE = 2000
const HARD_CALL_BUDGET = 18
const CORE_MARKETS = ['h2h', 'spreads', 'totals'] as const

type ProviderSport = {
  key: string
  active?: boolean
}

type ProviderEvent = {
  id: string
  sport_key?: string
  sport_title?: string
  commence_time?: string
  home_team?: string
  away_team?: string
  bookmakers?: ProviderBookmaker[]
}

type ProviderBookmaker = {
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
  name?: string
  price?: number
  point?: number
}

type ProviderCall = {
  label: string
  sportKey: string | null
  endpoint: string
  markets: string[]
  regions: string[]
  httpStatus: number | null
  ok: boolean
  rows: number
  requestsRemaining: number | null
  requestsUsed: number | null
  requestsLast: number | null
  error: string | null
}

type AcquisitionOptions = {
  dryRun?: boolean
  live?: boolean
  persist?: boolean
  confirm?: string | null
  maxCalls?: number | null
  maxSports?: number | null
  certifyIdempotency?: boolean | null
}

type FetchState = {
  calls: ProviderCall[]
  maxCalls: number
  stop: boolean
  stopReason: string | null
  remaining: number | null
}

type OddsRow = {
  id: string
  sport_key: string
  league_key: string
  season: string | null
  event_id: string
  provider: string
  sportsbook: string
  market: string
  outcome: string
  price: number | null
  line: number | null
  snapshot_time: string
  is_opening: boolean
  is_closing: boolean
  metadata: Record<string, unknown>
  updated_at: string
}

type MappingRow = {
  sport_key: string
  entity_type: string
  internal_id: string
  provider: string
  provider_id: string
  season: string
  metadata: Record<string, unknown>
  updated_at: string
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

function hash(parts: unknown[]) {
  return createHash('sha256')
    .update(parts.map((part) => String(part ?? 'null')).join('|'))
    .digest('hex')
    .slice(0, 28)
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 80)
}

function validIso(value: unknown) {
  const date = new Date(String(value ?? ''))
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function seasonFromDate(value: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return String(date.getUTCFullYear())
}

function leagueKeyForSport(sportKey: string) {
  const sport = SPORTS.find((item) => item.key === sportKey)
  return sport?.leagueKeys[0] ?? sportKey
}

function canonicalMarket(providerMarket: string) {
  if (providerMarket === 'h2h') return 'moneyline'
  if (providerMarket === 'spreads') return 'spread'
  if (providerMarket === 'totals') return 'total'
  return providerMarket
}

async function fetchProviderJson(
  state: FetchState,
  label: string,
  sportKey: string | null,
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
      sportKey,
      endpoint: safeEndpoint(path, query),
      markets: query.markets ? query.markets.split(',').filter(Boolean) : [],
      regions: query.regions ? query.regions.split(',').filter(Boolean) : [],
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
      sportKey,
      endpoint: safeEndpoint(path, query),
      markets: query.markets ? query.markets.split(',').filter(Boolean) : [],
      regions: query.regions ? query.regions.split(',').filter(Boolean) : [],
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

function mappedProviderSports(catalog: ProviderSport[], maxSports: number) {
  const active = new Set(catalog.filter((sport) => sport.active).map((sport) => sport.key))
  return getEnabledSports()
    .filter((sport) => sport.key !== 'basketball_bsn')
    .map((sport) => ({
      sportKey: sport.key,
      label: sport.label,
      leagueKey: sport.leagueKeys[0] ?? sport.key,
      providerSportKey: String(sport.metadata.providerSportKey ?? sport.key),
      active: active.has(String(sport.metadata.providerSportKey ?? sport.key)) || (sport.key === 'soccer' && catalog.some((item) => item.active && item.key.startsWith('soccer_'))),
    }))
    .filter((item) => item.active)
    .slice(0, maxSports)
}

function normalizeMappings(sportKey: string, events: ProviderEvent[]): MappingRow[] {
  const season = events[0]?.commence_time ? seasonFromDate(validIso(events[0].commence_time)) : ''
  return events
    .filter((event) => event.id)
    .map((event) => ({
      sport_key: sportKey,
      entity_type: 'event',
      internal_id: event.id,
      provider: PROVIDER,
      provider_id: event.id,
      season,
      metadata: {
        checkpoint: 'the_odds_api_current_odds_v1',
        mappingStatus: 'PROVIDER_NATIVE_PENDING_CANONICAL_CROSSWALK',
        providerSportKey: event.sport_key ?? null,
        commenceTime: validIso(event.commence_time),
        homeTeam: event.home_team ?? null,
        awayTeam: event.away_team ?? null,
      },
      updated_at: nowIso(),
    }))
}

function normalizeOddsRows(sportKey: string, providerSportKey: string, events: ProviderEvent[]): { rows: OddsRow[]; rejected: number } {
  const leagueKey = leagueKeyForSport(sportKey)
  const rows: OddsRow[] = []
  let rejected = 0
  for (const event of events) {
    const eventId = event.id
    const commenceTime = validIso(event.commence_time)
    const season = seasonFromDate(commenceTime)
    for (const bookmaker of event.bookmakers ?? []) {
      const sportsbook = bookmaker.key || slug(bookmaker.title ?? 'unknown_bookmaker')
      for (const market of bookmaker.markets ?? []) {
        const providerMarket = market.key
        const snapshotTime = validIso(market.last_update ?? bookmaker.last_update)
        if (!eventId || !providerMarket || !snapshotTime) {
          rejected += market.outcomes?.length ?? 1
          continue
        }
        for (const outcome of market.outcomes ?? []) {
          const outcomeName = String(outcome.name ?? '').trim()
          const price = typeof outcome.price === 'number' && Number.isFinite(outcome.price) && outcome.price !== 0 ? outcome.price : null
          const line = typeof outcome.point === 'number' && Number.isFinite(outcome.point) ? outcome.point : null
          if (!outcomeName || price === null) {
            rejected += 1
            continue
          }
          const minute = snapshotTime.slice(0, 16)
          const canonical = canonicalMarket(providerMarket)
          const id = `oddsapi_${hash([sportKey, eventId, sportsbook, providerMarket, outcomeName, line, minute])}`
          rows.push({
            id,
            sport_key: sportKey,
            league_key: leagueKey,
            season,
            event_id: eventId,
            provider: PROVIDER,
            sportsbook,
            market: canonical,
            outcome: outcomeName,
            price,
            line,
            snapshot_time: snapshotTime,
            is_opening: false,
            is_closing: false,
            metadata: {
              checkpoint: 'the_odds_api_current_odds_v1',
              providerSportKey,
              providerMarketKey: providerMarket,
              bookmakerTitle: bookmaker.title ?? null,
              bookmakerKey: bookmaker.key ?? null,
              providerEventId: eventId,
              commenceTime,
              homeTeam: event.home_team ?? null,
              awayTeam: event.away_team ?? null,
              providerTimestamp: snapshotTime,
              timestampClass: commenceTime && snapshotTime < commenceTime ? 'PRE_START' : 'POST_START_OR_UNKNOWN',
              sourceEndpointFamily: 'current_odds',
            },
            updated_at: nowIso(),
          })
        }
      }
    }
  }
  return { rows, rejected }
}

function dryRunResponse() {
  return {
    success: true,
    mode: 'the_odds_api_current_odds_acquisition_v1',
    status: 'DRY_RUN',
    generatedAt: nowIso(),
    provider: PROVIDER,
    live: false,
    persist: false,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
    productionMutationsMade: 0,
    rowsFetched: 0,
    rowsAccepted: 0,
    rowsRejected: 0,
    rowsInserted: 0,
    rowsUpdated: 0,
    rowsSkipped: 0,
    mappingsUpserted: 0,
    eventsFetched: 0,
    sportsAttempted: [],
    creditReserve: CREDIT_RESERVE,
    requestsRemainingBefore: null,
    requestsRemainingAfter: null,
    requestsUsedObserved: null,
    planObserved: [],
    blockers: apiKey() ? [] : ['ODDS_API_KEY_NOT_PRESENT'],
    warnings: ['Dry-run mode makes zero provider calls and zero database mutations.'],
  }
}

async function existingIdCount(table: 'sports_odds_snapshots' | 'provider_entity_mappings', ids: string[]) {
  if (!ids.length) return 0
  let count = 0
  for (let index = 0; index < ids.length; index += 100) {
    const chunk = ids.slice(index, index + 100)
    const column = table === 'sports_odds_snapshots' ? 'id' : 'provider_id'
    const { data, error } = await supabaseAdmin.from(table).select(column).in(column, chunk)
    if (error) throw new Error(`${table} existing-id read failed: ${error.message}`)
    count += data?.length ?? 0
  }
  return count
}

async function persistRows({
  oddsRows,
  mappings,
  writeJob,
  idempotency,
  metadata,
}: {
  oddsRows: OddsRow[]
  mappings: MappingRow[]
  writeJob: boolean
  idempotency: boolean
  metadata: Record<string, unknown>
}) {
  const existingOdds = await existingIdCount('sports_odds_snapshots', oddsRows.map((row) => row.id))
  const existingMappings = await existingIdCount('provider_entity_mappings', mappings.map((row) => row.provider_id))
  if (mappings.length) {
    const { error } = await supabaseAdmin
      .from('provider_entity_mappings')
      .upsert(mappings, { onConflict: 'sport_key,entity_type,provider,provider_id,season' })
    if (error) throw new Error(`provider_entity_mappings upsert failed: ${error.message}`)
  }
  if (oddsRows.length) {
    const { error } = await supabaseAdmin
      .from('sports_odds_snapshots')
      .upsert(oddsRows, { onConflict: 'id' })
    if (error) throw new Error(`sports_odds_snapshots upsert failed: ${error.message}`)
  }
  let idempotentRowsUpdated = 0
  if (idempotency && oddsRows.length) {
    const { error } = await supabaseAdmin
      .from('sports_odds_snapshots')
      .upsert(oddsRows, { onConflict: 'id' })
    if (error) throw new Error(`sports_odds_snapshots idempotency upsert failed: ${error.message}`)
    idempotentRowsUpdated = oddsRows.length
  }
  if (writeJob) {
    const { error } = await supabaseAdmin.from('sports_sync_jobs').insert({
      job_type: 'the_odds_api_current_odds_v1',
      sport_key: 'all',
      league_key: 'multi',
      provider: PROVIDER,
      season: '',
      status: 'completed',
      records_fetched: oddsRows.length,
      records_inserted: Math.max(0, oddsRows.length - existingOdds),
      records_updated: Math.min(existingOdds, oddsRows.length) + idempotentRowsUpdated,
      records_skipped: 0,
      error_count: 0,
      completed_at: nowIso(),
      metadata,
      updated_at: nowIso(),
    })
    if (error) throw new Error(`sports_sync_jobs insert failed: ${error.message}`)
  }
  return {
    oddsExistingBefore: existingOdds,
    mappingsExistingBefore: existingMappings,
    rowsInserted: Math.max(0, oddsRows.length - existingOdds),
    rowsUpdated: Math.min(existingOdds, oddsRows.length) + idempotentRowsUpdated,
    mappingsUpserted: mappings.length,
    idempotentRowsUpdated,
    productionMutationsMade: oddsRows.length + mappings.length + (writeJob ? 1 : 0) + idempotentRowsUpdated,
  }
}

export async function runTheOddsApiCurrentOddsAcquisition(options: AcquisitionOptions = {}) {
  const live = bool(options.live) && options.dryRun !== true
  const persist = bool(options.persist) && live
  if (!live) return dryRunResponse()
  if (options.confirm !== CONFIRMATION) {
    return {
      ...dryRunResponse(),
      success: false,
      status: 'BLOCKED_CONFIRMATION_REQUIRED',
      warnings: [`Live current-odds acquisition requires confirm=${CONFIRMATION}.`],
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
  const state: FetchState = { calls: [], maxCalls, stop: false, stopReason: null, remaining: null }
  const catalogResult = await fetchProviderJson(state, 'catalog_credit_read', null, '/sports', { all: 'true' })
  const catalog = Array.isArray(catalogResult.payload) ? catalogResult.payload as ProviderSport[] : []
  const sports = mappedProviderSports(catalog, maxSports)
  const bySport: Array<Record<string, unknown>> = []
  const allRows: OddsRow[] = []
  const allMappings: MappingRow[] = []
  let rowsRejected = 0
  let eventsFetched = 0

  for (const sport of sports) {
    if (state.stop) break
    const eventsResult = await fetchProviderJson(state, `events_${sport.sportKey}`, sport.sportKey, `/sports/${sport.providerSportKey}/events`, {})
    const events = Array.isArray(eventsResult.payload) ? eventsResult.payload as ProviderEvent[] : []
    const futureEvents = events.filter((event) => {
      const start = validIso(event.commence_time)
      return start ? start > nowIso() : false
    })
    eventsFetched += events.length
    allMappings.push(...normalizeMappings(sport.sportKey, events))
    if (state.stop) break

    const oddsResult = await fetchProviderJson(state, `core_odds_${sport.sportKey}`, sport.sportKey, `/sports/${sport.providerSportKey}/odds`, {
      regions: 'us',
      markets: CORE_MARKETS.join(','),
      oddsFormat: 'american',
    })
    const oddsEvents = Array.isArray(oddsResult.payload) ? oddsResult.payload as ProviderEvent[] : []
    const normalized = normalizeOddsRows(sport.sportKey, sport.providerSportKey, oddsEvents)
    allRows.push(...normalized.rows)
    rowsRejected += normalized.rejected
    bySport.push({
      sportKey: sport.sportKey,
      label: sport.label,
      providerSportKey: sport.providerSportKey,
      eventsFetched: events.length,
      futureEvents: futureEvents.length,
      oddsEventsReturned: oddsEvents.length,
      rowsAccepted: normalized.rows.length,
      rowsRejected: normalized.rejected,
      bookmakerCount: new Set(normalized.rows.map((row) => row.sportsbook)).size,
      markets: Array.from(new Set(normalized.rows.map((row) => row.market))).sort(),
    })
  }

  const duplicateIds = allRows.length - new Set(allRows.map((row) => row.id)).size
  const firstCall = state.calls[0] ?? null
  const lastCall = state.calls.at(-1) ?? null
  const beforeUsed = firstCall?.requestsUsed ?? null
  const afterUsed = lastCall?.requestsUsed ?? null
  const requestsUsedObserved = beforeUsed !== null && afterUsed !== null ? Math.max(0, afterUsed - beforeUsed) : null
  const creditHeadersAvailable = state.calls.length > 0 && state.calls.every((call) => call.requestsRemaining !== null)
  const reserveMaintained = lastCall?.requestsRemaining === null ? false : (lastCall?.requestsRemaining ?? 0) > CREDIT_RESERVE
  const persistence = persist
    ? await persistRows({
        oddsRows: allRows,
        mappings: allMappings,
        writeJob: true,
        idempotency: options.certifyIdempotency === true,
        metadata: {
          checkpoint: 'the_odds_api_current_odds_v1',
          providerCallsMade: state.calls.length,
          creditsBefore: firstCall?.requestsRemaining ?? null,
          creditsAfter: lastCall?.requestsRemaining ?? null,
          creditsConsumed: requestsUsedObserved,
          marketsRequested: CORE_MARKETS,
          regionsRequested: ['us'],
          duplicateIds,
          bySport,
        },
      })
    : {
        oddsExistingBefore: 0,
        mappingsExistingBefore: 0,
        rowsInserted: 0,
        rowsUpdated: 0,
        mappingsUpserted: 0,
        idempotentRowsUpdated: 0,
        productionMutationsMade: 0,
      }

  return {
    success: creditHeadersAvailable && reserveMaintained && duplicateIds === 0 && (persist ? allRows.length > 0 : true),
    mode: 'the_odds_api_current_odds_acquisition_v1',
    status: creditHeadersAvailable
      ? reserveMaintained
        ? persist
          ? 'LIVE_ACQUISITION_PERSISTED'
          : 'LIVE_ACQUISITION_DRY_PERSIST_DISABLED'
        : 'BLOCKED_CREDIT_RESERVE_REACHED'
      : 'BLOCKED_CREDIT_HEADERS_UNAVAILABLE',
    generatedAt: nowIso(),
    provider: PROVIDER,
    live: true,
    persist,
    providerCallsMade: state.calls.length,
    remoteMutationsMade: 0,
    productionMutationsMade: persistence.productionMutationsMade,
    rowsFetched: allRows.length + rowsRejected,
    rowsAccepted: allRows.length,
    rowsRejected,
    rowsInserted: persistence.rowsInserted,
    rowsUpdated: persistence.rowsUpdated,
    rowsSkipped: rowsRejected,
    mappingsUpserted: persistence.mappingsUpserted,
    idempotentRowsUpdated: persistence.idempotentRowsUpdated,
    eventsFetched,
    sportsAttempted: bySport,
    duplicateIds,
    creditReserve: CREDIT_RESERVE,
    requestsRemainingBefore: firstCall?.requestsRemaining ?? null,
    requestsRemainingAfter: lastCall?.requestsRemaining ?? null,
    requestsUsedObserved,
    planObserved: state.calls,
    blockers: [
      creditHeadersAvailable ? null : 'CREDIT_HEADERS_UNAVAILABLE',
      reserveMaintained ? null : 'CREDIT_RESERVE_NOT_MAINTAINED',
      duplicateIds === 0 ? null : 'DUPLICATE_SNAPSHOT_IDS',
      state.stopReason,
    ].filter(Boolean) as string[],
    warnings: [
      'Provider event mappings use provider-native internal_id pending canonical crosswalk; canonical sport_events are not overwritten.',
      'Only h2h, spreads and totals are acquired in Checkpoint 2.',
    ],
  }
}

export function validateTheOddsApiCurrentOddsAcquisitionFixtures() {
  const dry = dryRunResponse()
  const rendered = JSON.stringify(dry)
  const checks = [
    ['dry run makes zero provider calls', dry.providerCallsMade === 0],
    ['dry run makes zero mutations', dry.productionMutationsMade === 0 && dry.remoteMutationsMade === 0],
    ['credit reserve is 2000', CREDIT_RESERVE === 2000],
    ['hard call budget is bounded', HARD_CALL_BUDGET <= 18],
    ['core markets are h2h spreads totals', CORE_MARKETS.join(',') === 'h2h,spreads,totals'],
    ['secret query is not rendered', !rendered.includes('apiKey=')],
    ['confirmation guard is explicit', CONFIRMATION === 'ODDS_API_CURRENT_ODDS_V1'],
  ] as const
  const failedChecks = checks.filter(([, passed]) => !passed).map(([name]) => name)
  return {
    success: failedChecks.length === 0,
    mode: 'the_odds_api_current_odds_acquisition_v1_validation',
    checks: checks.length,
    passed: checks.length - failedChecks.length,
    failed: failedChecks.length,
    failedChecks,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
    productionMutationsMade: 0,
  }
}
