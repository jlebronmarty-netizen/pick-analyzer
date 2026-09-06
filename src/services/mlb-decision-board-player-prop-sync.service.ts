import 'server-only'

import { createHash } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { puertoRicoUtcRange } from '@/services/active-event.service'
import { getMlbPlayerProjectionEngine } from '@/services/mlb-player-projection-engine.service'
import {
  MLB_ODDS_API_ACCOUNT_CREDITS_OUTSIDE_SCOPE,
  MLB_ODDS_API_BOOKMAKER_KEYS,
  authorizeMlbOddsApiProjectCredits,
  estimateMlbOddsApiCredits,
  finalizeMlbOddsApiProjectUsage,
  getMlbOddsApiProjectBudgetStatus,
  reserveMlbOddsApiProjectCredits,
} from '@/services/mlb-odds-api-project-budget.service'
import { getCertifiedOddsApiEventMappings, ODDS_API_PROVIDER } from '@/services/the-odds-api-event-crosswalk.service'
import { playerPropSupportedLine, storageMarketForPlayerProp } from '@/config/mlb-player-prop-markets'
import type { MlbPlayerPropIngestionMarket } from '@/types/mlb-player-prop-ingestion'

const SPORT_KEY = 'baseball_mlb'
const LEAGUE_KEY = 'mlb'
const ODDS_API_BASE_URL = 'https://api.the-odds-api.com/v4'
const LIVE_CONFIRMATION = 'MLB_PLAYER_PROP_SYNC'

const V1_MARKETS: Array<{
  canonical: MlbPlayerPropIngestionMarket
  provider: string
  family: 'pitcher' | 'batter'
}> = [
  { canonical: 'pitcher_outs_recorded', provider: 'pitcher_outs', family: 'pitcher' },
  { canonical: 'pitcher_strikeouts', provider: 'pitcher_strikeouts', family: 'pitcher' },
  { canonical: 'batter_hits', provider: 'batter_hits', family: 'batter' },
  { canonical: 'batter_total_bases', provider: 'batter_total_bases', family: 'batter' },
]

type SyncOptions = {
  date?: string | null
  dryRun?: boolean | null
  confirmed?: boolean | null
  confirm?: string | null
  provider?: string | null
  maximumEvents?: number | null
  markets?: string[] | null
}

type CertifiedMapping = {
  provider_id: string | null
  internal_id: string | null
  metadata: Record<string, unknown> | null
}

type OddsApiOutcome = {
  name?: string
  description?: string
  price?: number
  point?: number
}

type OddsApiMarket = {
  key?: string
  last_update?: string
  outcomes?: OddsApiOutcome[]
}

type OddsApiBookmaker = {
  key?: string
  title?: string
  last_update?: string
  markets?: OddsApiMarket[]
}

type OddsApiEvent = {
  id?: string
  commence_time?: string
  bookmakers?: OddsApiBookmaker[]
}

type ProviderCall = {
  eventId: string
  httpStatus: number | null
  ok: boolean
  requestsRemaining: number | null
  requestsUsed: number | null
  requestsLast: number | null
  error: string | null
}

type PlayerProjection = {
  eventId: string | null
  playerId: string | null
  canonicalPlayerId: string | null
  playerName: string
  projectionType: string
  lineupOrStarterStatus?: string | null
}

type NormalizedProp = {
  id: string
  eventId: string
  providerEventId: string
  playerName: string
  playerId: string | null
  canonicalMarket: MlbPlayerPropIngestionMarket
  providerMarket: string
  family: 'pitcher' | 'batter'
  selection: 'over' | 'under'
  line: number
  americanOdds: number
  sportsbook: 'FanDuel' | 'Caesars'
  bookmakerKey: typeof MLB_ODDS_API_BOOKMAKER_KEYS[number]
  providerTimestamp: string
}

function nowIso() {
  return new Date().toISOString()
}

function selectedPuertoRicoDate() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Puerto_Rico',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function text(value: unknown) {
  const rendered = String(value ?? '').trim()
  return rendered || null
}

function number(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function headerNumber(headers: Headers, name: string) {
  const raw = headers.get(name)
  if (raw === null) return null
  const parsed = Number(raw)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

function oddsApiKey() {
  return process.env.ODDS_API_KEY?.trim() ?? process.env.THE_ODDS_API_KEY?.trim() ?? ''
}

function normalizeName(value: unknown) {
  return String(value ?? '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
}

function stableId(parts: unknown[]) {
  return `mlb_prop:${createHash('sha256').update(parts.map((part) => String(part ?? 'null')).join('|')).digest('hex').slice(0, 24)}`
}

function mappingStart(row: CertifiedMapping) {
  const raw = text(row.metadata?.internalStartTime)
  if (!raw) return null
  const parsed = new Date(raw)
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null
}

function selectedMarketDefinitions(markets?: string[] | null) {
  if (!markets?.length) return V1_MARKETS
  const requested = new Set(markets.map((market) => String(market).trim().toLowerCase()))
  const selected = V1_MARKETS.filter((market) => requested.has(market.canonical) || requested.has(market.provider))
  return selected.length ? selected : V1_MARKETS
}

function bookmakerName(key: unknown): 'FanDuel' | 'Caesars' | null {
  if (key === 'fanduel') return 'FanDuel'
  if (key === 'williamhill_us') return 'Caesars'
  return null
}

async function eligibleCertifiedMappings(selectedDate: string, maximumEvents: number) {
  const rows = await getCertifiedOddsApiEventMappings() as CertifiedMapping[]
  const range = puertoRicoUtcRange(selectedDate)
  const now = Date.now()
  return rows
    .map((row) => ({ row, start: mappingStart(row) }))
    .filter((item) => item.row.provider_id && item.row.internal_id && item.start)
    .filter((item) => Date.parse(item.start!) >= Date.parse(range.utcStart) && Date.parse(item.start!) < Date.parse(range.utcEndExclusive))
    .filter((item) => Date.parse(item.start!) > now)
    .sort((a, b) => String(a.start).localeCompare(String(b.start)))
    .slice(0, Math.min(Math.max(maximumEvents, 1), 3))
}

async function probeAccountCredits() {
  const key = oddsApiKey()
  if (!key) return { ok: false, remaining: null, used: null, last: null, error: 'ODDS_API_KEY_NOT_PRESENT' }
  const url = new URL(`${ODDS_API_BASE_URL}/sports/`)
  url.searchParams.set('apiKey', key)
  url.searchParams.set('all', 'true')
  try {
    const response = await fetch(url.toString(), { cache: 'no-store' })
    return {
      ok: response.ok,
      remaining: headerNumber(response.headers, 'x-requests-remaining'),
      used: headerNumber(response.headers, 'x-requests-used'),
      last: headerNumber(response.headers, 'x-requests-last'),
      error: response.ok ? null : `ODDS_API_QUOTA_PROBE_HTTP_${response.status}`,
    }
  } catch (error) {
    return {
      ok: false,
      remaining: null,
      used: null,
      last: null,
      error: error instanceof Error ? error.message : 'ODDS_API_QUOTA_PROBE_FAILED',
    }
  }
}

async function fetchEventProps(providerEventId: string, markets: string[]): Promise<{ payload: OddsApiEvent | null; call: ProviderCall }> {
  const key = oddsApiKey()
  const url = new URL(`${ODDS_API_BASE_URL}/sports/${SPORT_KEY}/events/${providerEventId}/odds`)
  url.searchParams.set('apiKey', key)
  url.searchParams.set('bookmakers', MLB_ODDS_API_BOOKMAKER_KEYS.join(','))
  url.searchParams.set('markets', markets.join(','))
  url.searchParams.set('oddsFormat', 'american')
  try {
    const response = await fetch(url.toString(), { cache: 'no-store' })
    const payload = await response.json().catch(() => null)
    return {
      payload: response.ok && payload && typeof payload === 'object' ? payload as OddsApiEvent : null,
      call: {
        eventId: providerEventId,
        httpStatus: response.status,
        ok: response.ok,
        requestsRemaining: headerNumber(response.headers, 'x-requests-remaining'),
        requestsUsed: headerNumber(response.headers, 'x-requests-used'),
        requestsLast: headerNumber(response.headers, 'x-requests-last'),
        error: response.ok ? null : `ODDS_API_PLAYER_PROPS_HTTP_${response.status}`,
      },
    }
  } catch (error) {
    return {
      payload: null,
      call: {
        eventId: providerEventId,
        httpStatus: null,
        ok: false,
        requestsRemaining: null,
        requestsUsed: null,
        requestsLast: null,
        error: error instanceof Error ? error.message : 'ODDS_API_PLAYER_PROPS_READ_FAILED',
      },
    }
  }
}

function projectionIdentityMap(projections: PlayerProjection[]) {
  const map = new Map<string, PlayerProjection>()
  for (const projection of projections) {
    if (!projection.eventId || !projection.playerName || !projection.projectionType) continue
    const key = [projection.eventId, projection.projectionType, normalizeName(projection.playerName)].join('|')
    if (!map.has(key)) map.set(key, projection)
  }
  return map
}

function normalizePayloads(input: {
  payloads: OddsApiEvent[]
  mappingByProviderEvent: Map<string, { internalEventId: string; startTime: string }>
  definitions: typeof V1_MARKETS
  projections: PlayerProjection[]
}) {
  const definitionByProvider = new Map(input.definitions.map((definition) => [definition.provider, definition]))
  const identities = projectionIdentityMap(input.projections)
  const rows = new Map<string, NormalizedProp>()
  let outcomesRead = 0
  let rejected = 0
  let unmatchedProjection = 0
  let postStartRejected = 0

  for (const event of input.payloads) {
    const providerEventId = text(event.id)
    const mapping = providerEventId ? input.mappingByProviderEvent.get(providerEventId) : null
    if (!providerEventId || !mapping) continue
    for (const bookmaker of event.bookmakers ?? []) {
      const bookmakerKey = text(bookmaker.key) as typeof MLB_ODDS_API_BOOKMAKER_KEYS[number] | null
      const sportsbook = bookmakerName(bookmakerKey)
      if (!bookmakerKey || !sportsbook || !MLB_ODDS_API_BOOKMAKER_KEYS.includes(bookmakerKey)) continue
      for (const market of bookmaker.markets ?? []) {
        const providerMarket = text(market.key)
        const definition = providerMarket ? definitionByProvider.get(providerMarket) : null
        if (!providerMarket || !definition) continue
        const rawTimestamp = text(market.last_update ?? bookmaker.last_update)
        const timestamp = rawTimestamp ? new Date(rawTimestamp) : null
        if (!timestamp || !Number.isFinite(timestamp.getTime())) {
          rejected += market.outcomes?.length ?? 1
          continue
        }
        if (timestamp.getTime() >= Date.parse(mapping.startTime)) {
          postStartRejected += market.outcomes?.length ?? 1
          continue
        }
        for (const outcome of market.outcomes ?? []) {
          outcomesRead += 1
          const rawSelection = String(outcome.name ?? '').trim().toLowerCase()
          const selection = rawSelection === 'over' ? 'over' : rawSelection === 'under' ? 'under' : null
          const playerName = text(outcome.description)
          const americanOdds = number(outcome.price)
          const line = playerPropSupportedLine(definition.canonical, outcome.point)
          if (!selection || !playerName || americanOdds === null || americanOdds === 0 || line === null) {
            rejected += 1
            continue
          }
          const identity = identities.get([mapping.internalEventId, definition.canonical, normalizeName(playerName)].join('|'))
          if (!identity) {
            unmatchedProjection += 1
            continue
          }
          const canonicalPlayerId = identity.canonicalPlayerId ?? identity.playerId ?? null
          if (definition.family === 'pitcher' && !canonicalPlayerId) {
            unmatchedProjection += 1
            continue
          }
          const canonicalName = identity.playerName || playerName
          const id = stableId([
            ODDS_API_PROVIDER,
            mapping.internalEventId,
            providerEventId,
            definition.canonical,
            canonicalPlayerId ?? canonicalName,
            sportsbook,
            bookmakerKey,
            selection.toUpperCase(),
            line,
          ])
          const normalized: NormalizedProp = {
            id,
            eventId: mapping.internalEventId,
            providerEventId,
            playerName: canonicalName,
            playerId: canonicalPlayerId,
            canonicalMarket: definition.canonical,
            providerMarket,
            family: definition.family,
            selection,
            line,
            americanOdds,
            sportsbook,
            bookmakerKey,
            providerTimestamp: timestamp.toISOString(),
          }
          const current = rows.get(id)
          if (!current || normalized.providerTimestamp > current.providerTimestamp) rows.set(id, normalized)
        }
      }
    }
  }

  return {
    rows: Array.from(rows.values()),
    outcomesRead,
    rejected,
    unmatchedProjection,
    postStartRejected,
  }
}

async function persistProps(rows: NormalizedProp[], selectedDate: string) {
  if (!rows.length) return { rowsPersisted: 0, error: null as string | null }
  const storedAt = nowIso()
  const payload = rows.map((row) => ({
    id: row.id,
    sport_key: SPORT_KEY,
    league_key: LEAGUE_KEY,
    season: selectedDate.slice(0, 4),
    event_id: row.eventId,
    provider: ODDS_API_PROVIDER,
    sportsbook: row.sportsbook,
    market: storageMarketForPlayerProp(row.canonicalMarket),
    outcome: row.selection,
    price: row.americanOdds,
    line: row.line,
    snapshot_time: row.providerTimestamp,
    provider_timestamp: row.providerTimestamp,
    odds_classification: 'player_prop_pregame',
    metadata: {
      sourceVersion: 'mlb_decision_board_player_prop_sync_v1',
      providerMarketKey: row.providerMarket,
      providerEventId: row.providerEventId,
      playerId: row.playerId,
      playerName: row.playerName,
      pitcherId: row.family === 'pitcher' ? row.playerId : null,
      selection: row.selection.toUpperCase(),
      bookmakerKey: row.bookmakerKey,
      identityStatus: row.playerId ? 'CANONICAL_PLAYER_ID' : 'PROJECTION_NAME_MATCH',
      storedTimestamp: storedAt,
      noRecommendation: true,
      evCalculated: false,
      officialPickEligible: false,
      portfolioEligible: false,
    },
  }))
  const { error } = await supabaseAdmin.from('sports_odds_snapshots').upsert(payload, { onConflict: 'id' })
  return { rowsPersisted: error ? 0 : payload.length, error: error?.message ?? null }
}

export async function syncMlbDecisionBoardPlayerProps(options: SyncOptions = {}) {
  const generatedAt = nowIso()
  const dryRun = options.dryRun !== false
  const provider = options.provider ?? ODDS_API_PROVIDER
  const selectedDate = options.date ?? selectedPuertoRicoDate()
  const maximumEvents = Math.min(Math.max(Number(options.maximumEvents ?? 1) || 1, 1), 3)
  const definitions = selectedMarketDefinitions(options.markets)
  const providerMarkets = definitions.map((definition) => definition.provider)
  const estimatedCredits = estimateMlbOddsApiCredits({
    eventCount: maximumEvents,
    marketCount: providerMarkets.length,
    bookmakerCount: MLB_ODDS_API_BOOKMAKER_KEYS.length,
  })
  const projectBudget = await authorizeMlbOddsApiProjectCredits(estimatedCredits)
  const confirmed = options.confirmed === true || options.confirm === LIVE_CONFIRMATION
  const keyConfigured = Boolean(oddsApiKey())

  if (dryRun) {
    const mappings = await eligibleCertifiedMappings(selectedDate, maximumEvents).catch(() => [])
    return {
      success: projectBudget.allowed,
      mode: 'mlb_decision_board_player_prop_sync_v1',
      generatedAt,
      selectedDate,
      provider,
      dryRun: true,
      confirmed,
      status: 'DRY_RUN',
      providerCallsMade: 0,
      providerCreditsConsumed: 0,
      remoteMutationsMade: 0,
      selectedMarkets: definitions.map((definition) => definition.canonical),
      providerMarkets,
      bookmakers: ['FanDuel', 'Caesars'],
      bookmakerKeys: [...MLB_ODDS_API_BOOKMAKER_KEYS],
      estimatedCredits,
      certifiedMappingsAvailable: mappings.length,
      projectBudget: projectBudget.status,
      blockers: [
        keyConfigured ? null : 'ODDS_API_KEY_NOT_LOADED_IN_RUNTIME',
        ...projectBudget.blockers,
        mappings.length ? null : 'NO_CERTIFIED_PREGAME_ODDS_API_EVENT_MAPPING',
      ].filter(Boolean),
      warnings: ['Dry run made zero provider calls and zero database mutations.'],
    }
  }

  const preflightBlockers = [
    provider === ODDS_API_PROVIDER ? null : 'LIVE_PLAYER_PROP_PROVIDER_MUST_BE_THE_ODDS_API',
    confirmed ? null : 'confirm=MLB_PLAYER_PROP_SYNC required for protected live sync',
    keyConfigured ? null : 'ODDS_API_KEY_NOT_LOADED_IN_RUNTIME',
    projectBudget.allowed ? null : 'PROJECT_CREDIT_BUDGET_BLOCKED',
    ...projectBudget.blockers,
  ].filter(Boolean) as string[]
  if (preflightBlockers.length) {
    return {
      success: false,
      mode: 'mlb_decision_board_player_prop_sync_v1',
      generatedAt,
      selectedDate,
      provider,
      dryRun: false,
      confirmed,
      status: 'BLOCKED_UNSAFE_WRITE',
      providerCallsMade: 0,
      providerCreditsConsumed: 0,
      remoteMutationsMade: 0,
      estimatedCredits,
      projectBudget: projectBudget.status,
      blockers: Array.from(new Set(preflightBlockers)),
    }
  }

  const mappings = await eligibleCertifiedMappings(selectedDate, maximumEvents)
  if (!mappings.length) {
    return {
      success: false,
      mode: 'mlb_decision_board_player_prop_sync_v1',
      generatedAt,
      selectedDate,
      provider,
      dryRun: false,
      confirmed,
      status: 'BLOCKED_NO_ELIGIBLE_EVENTS',
      providerCallsMade: 0,
      providerCreditsConsumed: 0,
      remoteMutationsMade: 0,
      estimatedCredits,
      projectBudget: projectBudget.status,
      blockers: ['NO_CERTIFIED_PREGAME_ODDS_API_EVENT_MAPPING'],
    }
  }

  const effectiveEstimatedCredits = estimateMlbOddsApiCredits({
    eventCount: mappings.length,
    marketCount: providerMarkets.length,
    bookmakerCount: MLB_ODDS_API_BOOKMAKER_KEYS.length,
  })
  const finalAuthorization = await authorizeMlbOddsApiProjectCredits(effectiveEstimatedCredits)
  if (!finalAuthorization.allowed) {
    return {
      success: false,
      mode: 'mlb_decision_board_player_prop_sync_v1',
      generatedAt,
      selectedDate,
      provider,
      dryRun: false,
      confirmed,
      status: 'BLOCKED_PROJECT_CREDIT_LIMIT',
      providerCallsMade: 0,
      providerCreditsConsumed: 0,
      remoteMutationsMade: 0,
      estimatedCredits: effectiveEstimatedCredits,
      projectBudget: finalAuthorization.status,
      blockers: finalAuthorization.blockers,
    }
  }

  const quotaProbe = await probeAccountCredits()
  const minimumAccountRemaining = MLB_ODDS_API_ACCOUNT_CREDITS_OUTSIDE_SCOPE + effectiveEstimatedCredits
  if (!quotaProbe.ok || quotaProbe.remaining === null || quotaProbe.remaining < minimumAccountRemaining) {
    return {
      success: false,
      mode: 'mlb_decision_board_player_prop_sync_v1',
      generatedAt,
      selectedDate,
      provider,
      dryRun: false,
      confirmed,
      status: 'BLOCKED_ACCOUNT_CREDIT_RESERVE',
      providerCallsMade: 1,
      providerCreditsConsumed: 0,
      remoteMutationsMade: 0,
      estimatedCredits: effectiveEstimatedCredits,
      accountQuota: quotaProbe,
      projectBudget: finalAuthorization.status,
      blockers: [quotaProbe.error ?? 'ACCOUNT_CREDIT_RESERVE_UNVERIFIED_OR_INSUFFICIENT'],
    }
  }

  const reservation = await reserveMlbOddsApiProjectCredits({
    selectedDate,
    markets: providerMarkets,
    providerCallsPlanned: mappings.length,
    estimatedCredits: effectiveEstimatedCredits,
  })
  if (!reservation.success || !reservation.reservationId) {
    return {
      success: false,
      mode: 'mlb_decision_board_player_prop_sync_v1',
      generatedAt,
      selectedDate,
      provider,
      dryRun: false,
      confirmed,
      status: 'BLOCKED_PROJECT_BUDGET_RESERVATION_FAILED',
      providerCallsMade: 1,
      providerCreditsConsumed: 0,
      remoteMutationsMade: 0,
      estimatedCredits: effectiveEstimatedCredits,
      accountQuota: quotaProbe,
      projectBudget: finalAuthorization.status,
      blockers: [reservation.error ?? 'PROJECT_CREDIT_RESERVATION_FAILED'],
    }
  }

  const calls: ProviderCall[] = []
  const payloads: OddsApiEvent[] = []
  for (const mapping of mappings) {
    const result = await fetchEventProps(String(mapping.row.provider_id), providerMarkets)
    calls.push(result.call)
    if (result.payload) payloads.push(result.payload)
  }

  const playerEngine = await getMlbPlayerProjectionEngine({ date: selectedDate, persist: false, limit: 200 })
    .catch(() => ({ projections: [] })) as { projections?: PlayerProjection[] }
  const mappingByProviderEvent = new Map(mappings.map((mapping) => [String(mapping.row.provider_id), {
    internalEventId: String(mapping.row.internal_id),
    startTime: String(mapping.start),
  }]))
  const normalized = normalizePayloads({
    payloads,
    mappingByProviderEvent,
    definitions,
    projections: playerEngine.projections ?? [],
  })
  const persisted = await persistProps(normalized.rows, selectedDate)
  const providerErrors = calls.map((call) => call.error).filter(Boolean) as string[]
  const completedAt = nowIso()
  const rowsSkipped = Math.max(0, normalized.outcomesRead - persisted.rowsPersisted) + normalized.rejected + normalized.unmatchedProjection + normalized.postStartRejected
  const errorCount = providerErrors.length + (persisted.error ? 1 : 0)
  const finalStatus = errorCount === 0 ? 'completed' as const : 'partial' as const
  const ledger = await finalizeMlbOddsApiProjectUsage({
    reservationId: reservation.reservationId,
    startedAt: reservation.startedAt,
    completedAt,
    selectedDate,
    markets: providerMarkets,
    providerCallsMade: calls.length,
    estimatedCredits: effectiveEstimatedCredits,
    requestsLast: calls.map((call) => call.requestsLast),
    requestsRemainingBefore: quotaProbe.remaining,
    requestsRemainingAfter: calls.at(-1)?.requestsRemaining ?? quotaProbe.remaining,
    recordsFetched: normalized.outcomesRead,
    recordsPersisted: persisted.rowsPersisted,
    recordsSkipped: rowsSkipped,
    errorCount,
    status: finalStatus,
  })
  const projectBudgetAfter = await getMlbOddsApiProjectBudgetStatus()
  const hardFailure = Boolean(persisted.error || !ledger.success || (calls.length > 0 && calls.every((call) => !call.ok)))

  return {
    success: !hardFailure,
    mode: 'mlb_decision_board_player_prop_sync_v1',
    generatedAt: completedAt,
    selectedDate,
    provider,
    dryRun: false,
    confirmed,
    status: hardFailure ? 'VALIDATION_FAILED' : 'SYNCED',
    providerCallsMade: calls.length + 1,
    paidProviderCallsMade: calls.length,
    freeQuotaProbeCallsMade: 1,
    providerCreditsConsumed: ledger.observedCredits,
    accountedProjectCredits: ledger.accountedCredits,
    creditAccountingStatus: ledger.creditAccountingStatus,
    remoteMutationsMade: persisted.rowsPersisted + (ledger.success ? 1 : 0),
    rowsRead: normalized.outcomesRead,
    rowsNormalized: normalized.rows.length,
    rowsPersisted: persisted.rowsPersisted,
    rowsSkipped,
    selectedMarkets: definitions.map((definition) => definition.canonical),
    providerMarkets,
    bookmakers: ['FanDuel', 'Caesars'],
    bookmakerKeys: [...MLB_ODDS_API_BOOKMAKER_KEYS],
    estimatedCredits: effectiveEstimatedCredits,
    accountQuotaBefore: quotaProbe,
    accountCreditsRemainingAfter: calls.at(-1)?.requestsRemaining ?? quotaProbe.remaining,
    projectBudgetBefore: finalAuthorization.status,
    projectBudgetAfter,
    diagnostics: {
      certifiedMappingsUsed: mappings.length,
      outcomesRead: normalized.outcomesRead,
      rejected: normalized.rejected,
      unmatchedProjection: normalized.unmatchedProjection,
      postStartRejected: normalized.postStartRejected,
      providerErrors,
      persistenceError: persisted.error,
      ledgerError: ledger.error,
    },
    blockers: [
      ...providerErrors,
      persisted.error,
      ledger.error,
      ledger.creditAccountingStatus === 'CONFIRMED' ? null : 'PROJECT_CREDIT_ACCOUNTING_FAIL_CLOSED',
    ].filter(Boolean),
    warnings: [
      'Only FanDuel and Caesars were requested from The Odds API.',
      'No sportsbook lines were fabricated.',
      'No EV, Kelly, Official Pick or Portfolio Intelligence writes were performed.',
    ],
  }
}
