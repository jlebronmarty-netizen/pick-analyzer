import 'server-only'

import { createHash } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { sportsDataIoCatalogForSport } from '@/config/sportsdataio-endpoint-catalog'
import {
  MLB_PLAYER_PROP_MARKETS,
  MLB_PLAYER_PROP_PROVIDER_MARKET_KEYS,
  playerPropMarketFromStorage,
  playerPropMarketFromProvider,
  playerPropSupportedLine,
  storageMarketForPlayerProp,
} from '@/config/mlb-player-prop-markets'
import { checkProviderBudget } from '@/services/provider-budget.service'
import { previewPitcherProjection } from '@/services/mlb-pitcher-projection-engine.service'
import { getCertifiedOddsApiEventMappings, ODDS_API_PROVIDER } from '@/services/the-odds-api-event-crosswalk.service'
import { normalizeOddsApiPitcherName, oddsApiProviderPlayerId } from '@/services/the-odds-api-pitcher-identity-bridge.service'
import type {
  MlbPlayerPropIngestionProvider,
  MlbPlayerPropIngestionMarket,
  MlbPlayerPropIngestionSelection,
  MlbPlayerPropIngestionStatus,
  MlbPlayerPropHealth,
  MlbPlayerPropSnapshot,
} from '@/types/mlb-player-prop-ingestion'

const SPORT_KEY = 'baseball_mlb'
const LEAGUE_KEY = 'mlb'
const MARKET = 'pitcher_outs_recorded'
const ODDS_API_MARKET = 'pitcher_outs'
const SOURCE_VERSION = 'mlb_player_prop_multi_market_v1'
const ODDS_API_BASE_URL = 'https://api.the-odds-api.com/v4'
const LIVE_CONFIRMATION = 'MLB_PLAYER_PROP_SYNC'

type SyncOptions = {
  date?: string | null
  dryRun?: boolean | null
  confirmed?: boolean | null
  confirm?: string | null
  provider?: MlbPlayerPropIngestionProvider | null
  maximumEvents?: number | null
  markets?: string[] | null
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
  home_team?: string
  away_team?: string
  bookmakers?: OddsApiBookmaker[]
}

type StoredPropRow = {
  id: string
  sportsbook: string
  market: string
  outcome: string
  price: number | string | null
  line: number | string | null
  snapshot_time: string | null
  provider_timestamp: string | null
  created_at: string | null
  updated_at: string | null
  metadata: Record<string, unknown> | null
}

type PitcherIdentityCandidate = {
  pitcherId: string
  providerPitcherId: string | null
  pitcherName: string
}

function nowIso() {
  return new Date().toISOString()
}

function text(value: unknown) {
  if (value === null || value === undefined) return null
  const normalized = String(value).trim()
  return normalized.length ? normalized : null
}

function num(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function boolEnv(name: string) {
  const value = String(process.env[name] ?? '').trim().toLowerCase()
  return ['true', '1', 'yes'].includes(value)
}

function configured(name: string) {
  return Boolean(process.env[name]?.trim())
}

function oddsApiKey() {
  return process.env.ODDS_API_KEY?.trim() ?? process.env.THE_ODDS_API_KEY?.trim() ?? ''
}

function hash(parts: unknown[]) {
  return createHash('sha256').update(parts.map((part) => String(part ?? 'null')).join('|')).digest('hex').slice(0, 24)
}

function normalizeName(value: unknown) {
  return normalizeOddsApiPitcherName(value).toLowerCase()
}

function marketDefinitionsForOptions(markets?: string[] | null) {
  if (!markets?.length) return [MLB_PLAYER_PROP_MARKETS.find((market) => market.key === MARKET)!]
  const selected = markets
    .map((market) => MLB_PLAYER_PROP_MARKETS.find((item) => item.key === market || item.providerMarketKeys.includes(market)))
    .filter(Boolean) as typeof MLB_PLAYER_PROP_MARKETS
  return selected.length ? selected : [MLB_PLAYER_PROP_MARKETS.find((market) => market.key === MARKET)!]
}

export function americanToDecimal(american: number | null) {
  if (american === null || american === 0) return null
  return Number((american > 0 ? 1 + american / 100 : 1 + 100 / Math.abs(american)).toFixed(4))
}

export function americanToImpliedProbability(american: number | null) {
  if (american === null || american === 0) return null
  return Number((american > 0 ? 100 / (american + 100) : Math.abs(american) / (Math.abs(american) + 100)).toFixed(4))
}

function normalizeOutcome(value: unknown): MlbPlayerPropIngestionSelection | null {
  const raw = String(value ?? '').trim().toLowerCase()
  if (raw === 'over' || raw === 'o') return 'OVER'
  if (raw === 'under' || raw === 'u') return 'UNDER'
  return null
}

function normalizeBookmaker(value: unknown) {
  const raw = text(value) ?? 'Unknown Sportsbook'
  return raw.replace(/\s+/g, ' ').trim()
}

function normalizeProviderTimestamp(value: unknown, fallback: string) {
  const raw = text(value)
  if (!raw) return fallback
  const parsed = new Date(raw)
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : fallback
}

function supportedLine(market: MlbPlayerPropIngestionMarket, value: unknown) {
  return playerPropSupportedLine(market, value)
}

function snapshotId(input: {
  provider: MlbPlayerPropIngestionProvider
  eventId: string
  market: MlbPlayerPropIngestionMarket
  providerPlayerId: string | null
  playerName: string | null
  sportsbook: string
  bookmakerId: string | null
  selection: MlbPlayerPropIngestionSelection
  line: number
  providerTimestamp: string
  providerEventId?: string | null
}) {
  return `mlb_prop:${hash([
    input.provider,
    input.eventId,
    input.providerEventId,
    input.market,
    input.providerPlayerId ?? input.playerName,
    input.sportsbook,
    input.bookmakerId,
    input.selection,
    input.line,
  ])}`
}

function snapshotFromOddsApi(input: {
  event: OddsApiEvent
  internalEventId?: string | null
  bookmaker: OddsApiBookmaker
  market: OddsApiMarket
  outcome: OddsApiOutcome
  storedTimestamp: string
}): MlbPlayerPropSnapshot | null {
  const providerEventId = text(input.event.id)
  const eventId = text(input.internalEventId) ?? providerEventId
  const selection = normalizeOutcome(input.outcome.name)
  const marketDefinition = playerPropMarketFromProvider(input.market.key)
  if (!marketDefinition) return null
  const line = supportedLine(marketDefinition.key, input.outcome.point)
  if (!eventId || !providerEventId || !selection || line === null) return null
  const providerTimestamp = normalizeProviderTimestamp(input.market.last_update ?? input.bookmaker.last_update, input.storedTimestamp)
  const americanOdds = num(input.outcome.price)
  const sportsbook = normalizeBookmaker(input.bookmaker.title ?? input.bookmaker.key)
  const bookmakerId = text(input.bookmaker.key)
  const playerName = text(input.outcome.description)
  const id = snapshotId({
    provider: 'the-odds-api',
    eventId,
    providerEventId,
    market: marketDefinition.key,
    providerPlayerId: null,
    playerName,
    sportsbook,
    bookmakerId,
    selection,
    line,
    providerTimestamp,
  })
  return {
    id,
    eventId,
    providerEventId,
    playerId: null,
    providerPlayerId: null,
    playerName,
    market: marketDefinition.key,
    providerMarketKey: String(input.market.key),
    line,
    selection,
    sportsbook,
    bookmakerId,
    americanOdds,
    decimalOdds: americanToDecimal(americanOdds),
    impliedProbability: americanToImpliedProbability(americanOdds),
    providerTimestamp,
    storedTimestamp: input.storedTimestamp,
    snapshotId: id,
    provider: 'the-odds-api',
    sourceVersion: SOURCE_VERSION,
  }
}

function normalizeOddsApiPayload(payload: OddsApiEvent | OddsApiEvent[], storedTimestamp = nowIso(), eventMap = new Map<string, string>()) {
  const events = Array.isArray(payload) ? payload : [payload]
  const snapshots: MlbPlayerPropSnapshot[] = []
  let rowsRead = 0
  for (const event of events) {
    for (const bookmaker of event.bookmakers ?? []) {
      for (const market of bookmaker.markets ?? []) {
        for (const outcome of market.outcomes ?? []) {
          rowsRead += 1
          const snapshot = snapshotFromOddsApi({ event, internalEventId: eventMap.get(String(event.id ?? '')), bookmaker, market, outcome, storedTimestamp })
          if (snapshot) snapshots.push(snapshot)
        }
      }
    }
  }
  return { rowsRead, snapshots }
}

function toStorageRow(snapshot: MlbPlayerPropSnapshot) {
  return {
    id: snapshot.id,
    sport_key: SPORT_KEY,
    league_key: LEAGUE_KEY,
    season: snapshot.storedTimestamp.slice(0, 4),
    event_id: snapshot.eventId,
    provider: snapshot.provider,
    sportsbook: snapshot.sportsbook,
    market: storageMarketForPlayerProp(snapshot.market),
    outcome: snapshot.selection.toLowerCase(),
    price: snapshot.americanOdds,
    line: snapshot.line,
    snapshot_time: snapshot.providerTimestamp,
    provider_timestamp: snapshot.providerTimestamp,
    odds_classification: 'player_prop_pregame',
    metadata: {
      sourceVersion: SOURCE_VERSION,
      market: snapshot.market,
      providerMarketKey: snapshot.providerMarketKey,
      providerEventId: snapshot.providerEventId,
      playerId: snapshot.playerId,
      providerPlayerId: snapshot.providerPlayerId,
      playerName: snapshot.playerName ?? null,
      pitcherId: snapshot.market.startsWith('pitcher_') ? snapshot.playerId : null,
      providerPitcherId: snapshot.market.startsWith('pitcher_') ? snapshot.providerPlayerId : null,
      selection: snapshot.selection,
      decimalOdds: snapshot.decimalOdds,
      impliedProbability: snapshot.impliedProbability,
      storedTimestamp: snapshot.storedTimestamp,
      noRecommendation: true,
      evCalculated: false,
      officialPickEligible: false,
      portfolioEligible: false,
    },
  }
}

function duplicateCount(snapshots: Array<{ id: string }>) {
  const seen = new Set<string>()
  let duplicates = 0
  for (const snapshot of snapshots) {
    if (seen.has(snapshot.id)) duplicates += 1
    seen.add(snapshot.id)
  }
  return duplicates
}

function validateSnapshots(snapshots: MlbPlayerPropSnapshot[]) {
  const failedChecks: string[] = []
  const seen = new Set<string>()
  for (const snapshot of snapshots) {
    if (seen.has(snapshot.id)) failedChecks.push(`duplicate snapshot ${snapshot.id}`)
    seen.add(snapshot.id)
    if (!MLB_PLAYER_PROP_MARKETS.some((market) => market.key === snapshot.market)) failedChecks.push(`${snapshot.id} unsupported market`)
    if (supportedLine(snapshot.market, snapshot.line) === null) failedChecks.push(`${snapshot.id} unsupported line`)
    if (!['OVER', 'UNDER'].includes(snapshot.selection)) failedChecks.push(`${snapshot.id} unsupported selection`)
    if (!snapshot.sportsbook) failedChecks.push(`${snapshot.id} missing sportsbook`)
    if (!snapshot.eventId) failedChecks.push(`${snapshot.id} missing event`)
  }
  return { success: failedChecks.length === 0, failedChecks }
}

async function readStoredHealthRows() {
  const { data, error } = await supabaseAdmin
    .from('sports_odds_snapshots')
    .select('id,sportsbook,market,outcome,price,line,snapshot_time,provider_timestamp,created_at,updated_at,metadata')
    .eq('sport_key', SPORT_KEY)
    .eq('league_key', LEAGUE_KEY)
    .like('market', 'player_props:%')
    .order('snapshot_time', { ascending: false })
    .limit(5000)
  if (error) throw new Error(`MLB player prop storage health read failed: ${error.message}`)
  return (data ?? []) as StoredPropRow[]
}

function marketKeyForStoredRow(row: StoredPropRow) {
  return playerPropMarketFromStorage(row.market)?.key ??
    playerPropMarketFromStorage(row.metadata?.market)?.key ??
    playerPropMarketFromProvider(row.metadata?.providerMarketKey)?.key ??
    null
}

function healthFromRows(rows: StoredPropRow[], status: MlbPlayerPropIngestionStatus, extra: Partial<MlbPlayerPropHealth> = {}): MlbPlayerPropHealth {
  const timestamps = rows.map((row) => row.provider_timestamp ?? row.snapshot_time).filter(Boolean).sort() as string[]
  const stored = rows.map((row) => row.updated_at ?? row.created_at).filter(Boolean).sort() as string[]
  const supportedRowsByMarket = MLB_PLAYER_PROP_MARKETS.reduce((acc, market) => {
    acc[market.key] = rows.filter((row) => marketKeyForStoredRow(row) === market.key && supportedLine(market.key, row.line) !== null).length
    return acc
  }, {} as Record<MlbPlayerPropIngestionMarket, number>)
  const validation = {
    success: rows.every((row) => {
      const market = marketKeyForStoredRow(row)
      return market && supportedLine(market, row.line) !== null && ['over', 'under'].includes(String(row.outcome).toLowerCase())
    }),
    failedChecks: rows.flatMap((row) => [
      !marketKeyForStoredRow(row) ? `${row.id} unsupported market` : null,
      marketKeyForStoredRow(row) && supportedLine(marketKeyForStoredRow(row)!, row.line) === null ? `${row.id} unsupported line` : null,
      !['over', 'under'].includes(String(row.outcome).toLowerCase()) ? `${row.id} unsupported outcome` : null,
    ].filter(Boolean) as string[]),
  }
  return {
    success: validation.success && !['VALIDATION_FAILED'].includes(status),
    mode: 'mlb_player_prop_ingestion_health_v1',
    generatedAt: nowIso(),
    status,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
    rowsRead: rows.length,
    rowsNormalized: rows.length,
    rowsEligibleForStorage: rows.length,
    rowsPersisted: 0,
    duplicateSnapshots: duplicateCount(rows),
    supportedRecordedOutsRows: supportedRowsByMarket.pitcher_outs_recorded,
    supportedRowsByMarket,
    sportsbooks: Array.from(new Set(rows.map((row) => row.sportsbook))).sort(),
    markets: MLB_PLAYER_PROP_MARKETS.map((market) => market.key),
    freshness: {
      latestProviderTimestamp: timestamps.at(-1) ?? null,
      latestStoredTimestamp: stored.at(-1) ?? null,
    },
    blockers: rows.length ? [] : ['NO_STORED_PLAYER_PROP_MARKET_ROWS'],
    validation,
    ...extra,
  }
}

export async function getMlbPlayerPropIngestionProviderAudit() {
  const sportsDataIoCatalog = sportsDataIoCatalogForSport('mlb')
  const sportsDataIoProps = sportsDataIoCatalog.find((entry) => entry.pathTemplate.includes('BettingPlayerPropsByGameID')) ?? null
  const sportsDataIoDiscoveryLabConfigured = configured('SPORTSDATAIO_MLB_API_KEY')
  const oddsApiConfigured = configured('ODDS_API_KEY') || configured('THE_ODDS_API_KEY')
  const oddsApiBusinessTierConfirmed = boolEnv('ODDS_API_BUSINESS_TIER_CONFIRMED') || boolEnv('THE_ODDS_API_BUSINESS_TIER_CONFIRMED')
  const blockers = [
    sportsDataIoProps?.providerVariant !== 'sportsdataio_enterprise' ? 'SPORTSDATAIO_MLB_PLAYER_PROPS_ENDPOINT_NOT_CATALOGED' : null,
    sportsDataIoProps?.entitlementStatus !== 'confirmed_trial' ? 'SPORTSDATAIO_ENTERPRISE_PROP_ENTITLEMENT_NOT_CONFIRMED' : null,
    'SPORTSDATAIO_DISCOVERY_LAB_PROP_ENDPOINT_NOT_CONFIRMED',
    oddsApiConfigured ? null : 'ODDS_API_KEY_NOT_LOADED_IN_RUNTIME',
    oddsApiBusinessTierConfirmed ? null : 'ODDS_API_BUSINESS_TIER_NOT_CONFIRMED',
  ].filter(Boolean) as string[]
  return {
    success: true,
    mode: 'mlb_player_prop_ingestion_provider_audit_v1',
    generatedAt: nowIso(),
    providerCallsMade: 0,
    remoteMutationsMade: 0,
    supportedProviders: [
      {
        provider: 'sportsdataio',
        coverage: 'cataloged_enterprise_player_props_only',
        legalStatus: 'BLOCKED_PROVIDER_CONTRACT_UNAVAILABLE',
        endpoint: sportsDataIoProps?.pathTemplate ?? '/v3/mlb/odds/json/BettingPlayerPropsByGameID/{gameId}',
        documentedMarketSupport: MLB_PLAYER_PROP_MARKETS.map((market) => market.key),
        currentSubscription: 'sportsdataio_discovery_lab',
        credentialConfigured: sportsDataIoDiscoveryLabConfigured,
        sportsbooks: [],
        latency: 'not measured; no live prop call approved',
        updateCadence: 'not documented for current subscription',
        limitations: [
          'Current MLB Discovery Lab channel does not confirm BettingPlayerPropsByGameID.',
          'Enterprise /v3 MLB props are not inferred from the Discovery Lab key.',
        ],
      },
      {
        provider: 'the-odds-api',
        coverage: 'documented_event_level_mlb_player_props_business_tier',
        legalStatus: oddsApiConfigured && oddsApiBusinessTierConfirmed ? 'CONTRACT_READY' : 'BLOCKED_PROVIDER_CONTRACT_UNAVAILABLE',
        endpoint: '/v4/sports/baseball_mlb/events/{eventId}/odds?markets={marketKey}',
        documentedMarketSupport: MLB_PLAYER_PROP_MARKETS.map((market) => ({
          canonicalMarket: market.key,
          providerMarketKeys: market.providerMarketKeys,
        })),
        currentSubscription: oddsApiBusinessTierConfirmed ? 'business_confirmed_by_env' : 'not_confirmed',
        credentialConfigured: oddsApiConfigured,
        sportsbooks: oddsApiBusinessTierConfirmed ? ['provider_reported_us_books_and_pinnacle'] : [],
        latency: 'not measured; no live prop call executed by audit',
        updateCadence: 'provider documentation says every few minutes for events within 24h; not verified against this account',
        limitations: [
          'Business plan or higher is required for documented player props.',
          'Current event ID crosswalk from stored SportsDataIO events to The Odds API event IDs is not proven in this repository.',
        ],
      },
    ],
    blockers,
    status: blockers.length ? 'BLOCKED_PROVIDER_CONTRACT_UNAVAILABLE' : 'READY_FOR_PROTECTED_SYNC',
  }
}

export async function getMlbPlayerPropIngestionHealth() {
  const rows = await readStoredHealthRows()
  const providerAudit = await getMlbPlayerPropIngestionProviderAudit()
  return {
    ...healthFromRows(rows, rows.length ? 'SYNCED' : 'BLOCKED_PROVIDER_CONTRACT_UNAVAILABLE'),
    providerAudit,
    blockers: Array.from(new Set([...providerAudit.blockers, ...(rows.length ? [] : ['NO_STORED_RECORDED_OUTS_PROP_MARKET_ROWS'])])),
  }
}

export function validateMlbPlayerPropIngestionFixtures() {
  const fixture = normalizeOddsApiPayload({
    id: 'odds-api-event-1',
    commence_time: '2026-07-26T23:05:00Z',
    home_team: 'Home',
    away_team: 'Away',
    bookmakers: [{
      key: 'draftkings',
      title: 'DraftKings',
      last_update: '2026-07-26T18:00:00Z',
      markets: [{
        key: ODDS_API_MARKET,
        last_update: '2026-07-26T18:00:00Z',
        outcomes: [
          { name: 'Over', description: 'Fixture Pitcher', price: -115, point: 16.5 },
          { name: 'Under', description: 'Fixture Pitcher', price: -105, point: 16.5 },
          { name: 'Over', description: 'Fixture Pitcher', price: 110, point: 16 },
        ],
      }, {
        key: 'pitcher_strikeouts',
        last_update: '2026-07-26T18:00:00Z',
        outcomes: [
          { name: 'Over', description: 'Fixture Pitcher', price: 120, point: 5.5 },
          { name: 'Under', description: 'Fixture Pitcher', price: -140, point: 5.5 },
        ],
      }, {
        key: 'batter_hits',
        last_update: '2026-07-26T18:00:00Z',
        outcomes: [
          { name: 'Over', description: 'Fixture Batter', price: -130, point: 0.5 },
          { name: 'Under', description: 'Fixture Batter', price: 105, point: 0.5 },
        ],
      }, {
        key: 'batter_rbis',
        last_update: '2026-07-26T18:00:00Z',
        outcomes: [
          { name: 'Over', description: 'Fixture Batter', price: 150, point: 0.5 },
        ],
      }, {
        key: 'batter_runs_scored',
        last_update: '2026-07-26T18:00:00Z',
        outcomes: [
          { name: 'Under', description: 'Fixture Batter', price: -110, point: 0.5 },
        ],
      }],
    }],
  }, '2026-07-26T18:01:00.000Z')
  const validation = validateSnapshots(fixture.snapshots)
  const rows = fixture.snapshots.map(toStorageRow)
  const outsSnapshots = fixture.snapshots.filter((row) => row.market === MARKET)
  const checks = [
    ['only supported half-out lines are normalized', outsSnapshots.length === 2 && outsSnapshots.every((row) => row.line === 16.5)],
    ['all requested provider keys have a canonical contract', MLB_PLAYER_PROP_MARKETS.length === 12 && MLB_PLAYER_PROP_PROVIDER_MARKET_KEYS.includes('batter_rbis') && MLB_PLAYER_PROP_PROVIDER_MARKET_KEYS.includes('batter_runs_scored')],
    ['over and under normalize distinctly', new Set(fixture.snapshots.map((row) => row.selection)).size === 2],
    ['American odds implied probability converts', fixture.snapshots[0]?.impliedProbability === 0.5349],
    ['American odds decimal converts', fixture.snapshots[0]?.decimalOdds === 1.8696],
    ['storage markets are comparison-compatible', rows.every((row) => String(row.market).startsWith('player_props:'))],
    ['provider aliases map to canonical batter markets', rows.some((row) => row.market === 'player_props:batter_rbi') && rows.some((row) => row.market === 'player_props:batter_runs')],
    ['storage outcome is lowercase over under', rows.every((row) => ['over', 'under'].includes(row.outcome))],
    ['idempotent IDs are unique', duplicateCount(fixture.snapshots) === 0],
    ['no recommendation metadata is emitted', rows.every((row) => row.metadata.noRecommendation === true && row.metadata.evCalculated === false && row.metadata.officialPickEligible === false && row.metadata.portfolioEligible === false)],
    ['snapshot validation passes', validation.success],
  ] as const
  const failedChecks = checks.filter(([, passed]) => !passed).map(([name]) => name)
  return {
    success: failedChecks.length === 0,
    mode: 'mlb_player_prop_ingestion_validation_v1',
    checks: checks.length,
    passed: checks.length - failedChecks.length,
    failed: failedChecks.length,
    failedChecks,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
    normalizedFixture: {
      rowsRead: fixture.rowsRead,
      rowsNormalized: fixture.snapshots.length,
      rowsEligibleForStorage: rows.length,
    },
  }
}

type CertifiedMapping = {
  provider_id: string | null
  internal_id: string | null
  metadata: Record<string, unknown> | null
}

function mappingTime(row: CertifiedMapping) {
  const raw = text(row.metadata?.internalStartTime)
  return raw ? new Date(raw) : null
}

async function eligibleCertifiedMappings(maximumEvents: number) {
  const rows = await getCertifiedOddsApiEventMappings() as CertifiedMapping[]
  const now = new Date()
  return rows
    .filter((row) => row.provider_id && row.internal_id)
    .filter((row) => {
      const start = mappingTime(row)
      return start && Number.isFinite(start.getTime()) && start > now
    })
    .sort((a, b) => (mappingTime(a)?.getTime() ?? 0) - (mappingTime(b)?.getTime() ?? 0))
    .slice(0, Math.min(Math.max(maximumEvents, 1), 3))
}

async function fetchOddsApiPlayerProps(providerEventId: string, markets: string[]) {
  const key = oddsApiKey()
  if (!key) return { payload: null as OddsApiEvent | null, call: null, error: 'ODDS_API_KEY_NOT_PRESENT' }
  const url = new URL(`${ODDS_API_BASE_URL}/sports/${SPORT_KEY}/events/${providerEventId}/odds`)
  url.searchParams.set('apiKey', key)
  url.searchParams.set('regions', 'us')
  url.searchParams.set('markets', markets.join(','))
  url.searchParams.set('oddsFormat', 'american')
  const response = await fetch(url.toString(), { cache: 'no-store' })
  const payload = await response.json().catch(() => null)
  return {
    payload: response.ok ? payload as OddsApiEvent : null,
    call: {
      httpStatus: response.status,
      ok: response.ok,
      requestsRemaining: Number(response.headers.get('x-requests-remaining') ?? NaN),
      requestsUsed: Number(response.headers.get('x-requests-used') ?? NaN),
      requestsLast: Number(response.headers.get('x-requests-last') ?? NaN),
    },
    error: response.ok ? null : 'ODDS_API_PLAYER_PROPS_READ_FAILED',
  }
}

async function resolvePitchers(snapshots: MlbPlayerPropSnapshot[]) {
  const eventIds = Array.from(new Set(snapshots.map((row) => row.eventId)))
  const slate = await previewPitcherProjection({ limit: 200 })
  const byEventName = new Map<string, PitcherIdentityCandidate>()
  for (const projection of slate.projections.filter((row) => eventIds.includes(row.eventId))) {
    byEventName.set(`${projection.eventId}|${normalizeName(projection.pitcherName)}`, {
      pitcherId: projection.pitcherId,
      providerPitcherId: projection.providerPitcherId,
      pitcherName: projection.pitcherName,
    })
  }
  let exact = 0
  let normalized = 0
  let unresolved = 0
  const resolved = snapshots.flatMap((snapshot) => {
    const candidate = byEventName.get(`${snapshot.eventId}|${normalizeName(snapshot.playerName)}`)
    if (!candidate) {
      unresolved += 1
      return []
    }
    if (candidate.pitcherName === snapshot.playerName) exact += 1
    else normalized += 1
    return [{
      ...snapshot,
      playerId: candidate.pitcherId,
      providerPlayerId: candidate.providerPitcherId,
      playerName: candidate.pitcherName,
    }]
  })
  return { resolved, exact, normalized, unresolved }
}

async function resolvePitchersFromStoredProjections(snapshots: MlbPlayerPropSnapshot[]) {
  const eventIds = Array.from(new Set(snapshots.map((row) => row.eventId))).filter(Boolean)
  const byEventName = new Map<string, PitcherIdentityCandidate>()
  if (eventIds.length) {
    const { data, error } = await supabaseAdmin
      .from('mlb_pitcher_projections')
      .select('event_id,pitcher_id,provider_pitcher_id,feature_snapshot,generated_at')
      .in('event_id', eventIds)
      .order('generated_at', { ascending: false })
      .limit(200)
    if (error) throw new Error(`stored pitcher projection identity read failed: ${error.message}`)
    for (const row of data ?? []) {
      const eventId = text(row.event_id)
      const pitcherId = text(row.pitcher_id)
      const pitcherName = text((row.feature_snapshot as { identity?: { pitcherName?: unknown } } | null)?.identity?.pitcherName)
      if (!eventId || !pitcherId || !pitcherName) continue
      const key = `${eventId}|${normalizeName(pitcherName)}`
      if (!byEventName.has(key)) {
        byEventName.set(key, {
          pitcherId,
          providerPitcherId: text(row.provider_pitcher_id),
          pitcherName,
        })
      }
    }
  }
  let exact = 0
  let normalized = 0
  let unresolved = 0
  const resolved = snapshots.flatMap((snapshot) => {
    const candidate = byEventName.get(`${snapshot.eventId}|${normalizeName(snapshot.playerName)}`)
    if (!candidate) {
      unresolved += 1
      return []
    }
    if (candidate.pitcherName === snapshot.playerName) exact += 1
    else normalized += 1
    return [{
      ...snapshot,
      playerId: candidate.pitcherId,
      providerPlayerId: candidate.providerPitcherId,
      playerName: candidate.pitcherName,
    }]
  })
  return { resolved, exact, normalized, unresolved }
}

async function resolvePitchersFromProviderMappings(snapshots: MlbPlayerPropSnapshot[]) {
  const providerIds = Array.from(new Set(snapshots.map((row) => oddsApiProviderPlayerId(row.playerName)).filter(Boolean))) as string[]
  const eventIds = Array.from(new Set(snapshots.map((row) => row.eventId))).filter(Boolean)
  if (!providerIds.length) return { resolved: [] as MlbPlayerPropSnapshot[], exact: 0, normalized: 0, unresolved: snapshots.length }
  const [{ data: mappings, error: mappingsError }, { data: events, error: eventsError }] = await Promise.all([
    supabaseAdmin
      .from('provider_entity_mappings')
      .select('internal_id,provider_id,metadata')
      .eq('sport_key', SPORT_KEY)
      .eq('entity_type', 'player')
      .eq('provider', ODDS_API_PROVIDER)
      .in('provider_id', providerIds)
      .limit(1000),
    supabaseAdmin
      .from('sport_events')
      .select('id,home_team_id,away_team_id')
      .in('id', eventIds),
  ])
  if (mappingsError) throw new Error(`Odds API pitcher identity mapping read failed: ${mappingsError.message}`)
  if (eventsError) throw new Error(`event team identity read failed: ${eventsError.message}`)
  const playerIds = Array.from(new Set((mappings ?? []).map((row) => String(row.internal_id)).filter(Boolean)))
  const players = []
  for (const chunkStart of Array.from({ length: Math.ceil(playerIds.length / 100) }, (_, index) => index * 100)) {
    const chunk = playerIds.slice(chunkStart, chunkStart + 100)
    if (!chunk.length) continue
    const { data, error } = await supabaseAdmin
      .from('sport_players')
      .select('id,display_name,provider_ids,team_id,team_name')
      .eq('sport_key', SPORT_KEY)
      .in('id', chunk)
    if (error) throw new Error(`canonical pitcher identity read failed: ${error.message}`)
    players.push(...(data ?? []))
  }
  const mappingByProvider = new Map((mappings ?? []).map((row) => [String(row.provider_id), row]))
  const playerById = new Map((players ?? []).map((row) => [String(row.id), row]))
  const eventById = new Map((events ?? []).map((row) => [String(row.id), row]))
  let exact = 0
  let normalized = 0
  let unresolved = 0
  const resolved = snapshots.flatMap((snapshot) => {
    const providerPlayerId = oddsApiProviderPlayerId(snapshot.playerName)
    const mapping = providerPlayerId ? mappingByProvider.get(providerPlayerId) : null
    const player = mapping ? playerById.get(String(mapping.internal_id)) : null
    const event = eventById.get(snapshot.eventId)
    if (!mapping || !player || !event || (player.team_id !== event.home_team_id && player.team_id !== event.away_team_id)) {
      unresolved += 1
      return []
    }
    const sportsDataIoId = text(player.provider_ids?.sportsdataio) ?? text(player.provider_ids?.PlayerID)
    const canonicalName = text(player.display_name) ?? snapshot.playerName ?? null
    if (canonicalName === snapshot.playerName) exact += 1
    else normalized += 1
    return [{
      ...snapshot,
      playerId: String(player.id),
      providerPlayerId: sportsDataIoId,
      playerName: canonicalName,
    }]
  })
  return { resolved, exact, normalized, unresolved }
}

function errorText(error: unknown) {
  return error instanceof Error ? error.message : String(error ?? 'unknown error')
}

async function persistRows(snapshots: MlbPlayerPropSnapshot[], persist: boolean) {
  const rows = snapshots.map(toStorageRow)
  if (!persist || !rows.length) return { rowsPersisted: 0, rowsSkipped: rows.length, error: null as string | null }
  const { error } = await supabaseAdmin.from('sports_odds_snapshots').upsert(rows, { onConflict: 'id' })
  return { rowsPersisted: error ? 0 : rows.length, rowsSkipped: error ? rows.length : 0, error: error?.message ?? null }
}

export async function syncMlbPlayerProps(options: SyncOptions = {}) {
  const dryRun = options.dryRun !== false
  const provider = options.provider ?? 'the-odds-api'
  const selectedMarkets = marketDefinitionsForOptions(options.markets)
  const selectedProviderMarkets = Array.from(new Set(selectedMarkets.flatMap((market) => market.providerMarketKeys)))
  const providerAudit = await getMlbPlayerPropIngestionProviderAudit()
  const healthBefore = await getMlbPlayerPropIngestionHealth()
  const validation = validateMlbPlayerPropIngestionFixtures()
  const budget = await checkProviderBudget({
    provider,
    sportKey: SPORT_KEY,
    action: 'mlb_player_prop_ingestion',
    requestedCalls: dryRun ? 0 : Math.max(1, Number(options.maximumEvents ?? 1) || 1),
    dryRun,
  })
  const confirmed = options.confirmed === true || options.confirm === LIVE_CONFIRMATION
  const isOddsApi = provider === ODDS_API_PROVIDER
  const blocked = !isOddsApi && providerAudit.blockers.length > 0
  const status: MlbPlayerPropIngestionStatus = dryRun
    ? 'DRY_RUN'
    : blocked
      ? 'BLOCKED_PROVIDER_CONTRACT_UNAVAILABLE'
      : !budget.allowed
        ? 'BLOCKED_UNSAFE_WRITE'
        : !confirmed
          ? 'BLOCKED_UNSAFE_WRITE'
          : 'SYNCED'

  if (!dryRun && status === 'SYNCED' && isOddsApi) {
    const mappings = await eligibleCertifiedMappings(Number(options.maximumEvents ?? 1) || 1)
    if (!mappings.length) {
      return {
        success: false,
        mode: 'mlb_player_prop_ingestion_sync_v1',
        generatedAt: nowIso(),
        selectedDate: options.date ?? new Date().toISOString().slice(0, 10),
        provider,
        dryRun,
        confirmed,
        status: 'BLOCKED_NO_ELIGIBLE_EVENTS' as MlbPlayerPropIngestionStatus,
        providerCallsMade: 0,
        remoteMutationsMade: 0,
        rowsRead: 0,
        rowsNormalized: 0,
        rowsEligibleForStorage: 0,
        rowsPersisted: 0,
        rowsSkipped: 0,
        storageTable: 'sports_odds_snapshots',
        supportedMarket: MARKET,
        supportedMarkets: MLB_PLAYER_PROP_MARKETS.map((market) => market.key),
        selectedMarkets: selectedMarkets.map((market) => market.key),
        supportedLines: MLB_PLAYER_PROP_MARKETS.find((market) => market.key === MARKET)?.supportedLines ?? [],
        supportedLinesByMarket: Object.fromEntries(MLB_PLAYER_PROP_MARKETS.map((market) => [market.key, market.supportedLines])),
        providerAudit,
        providerBudget: budget.status,
        healthBefore,
        validation,
        blockers: ['NO_CERTIFIED_PREGAME_ODDS_API_EVENT_MAPPING'],
        warnings: ['Manual live sync blocked before provider calls because no certified pregame mapping is available.'],
      }
    }
    const eventMap = new Map(mappings.map((row) => [String(row.provider_id), String(row.internal_id)]))
    const providerPayloads: OddsApiEvent[] = []
    const calls = []
    const errors: string[] = []
    for (const mapping of mappings) {
      const result = await fetchOddsApiPlayerProps(String(mapping.provider_id), selectedProviderMarkets)
      if (result.call) calls.push(result.call)
      if (result.error) errors.push(result.error)
      if (result.payload) providerPayloads.push(result.payload)
    }
    const normalized = normalizeOddsApiPayload(providerPayloads, nowIso(), eventMap)
    const identity = await resolvePitchers(normalized.snapshots).catch(async (error) => {
      const fallback = await resolvePitchersFromStoredProjections(normalized.snapshots).then(async (stored) => {
        if (stored.resolved.length) return stored
        return resolvePitchersFromProviderMappings(normalized.snapshots)
      }).catch((fallbackError) => ({
        resolved: [] as MlbPlayerPropSnapshot[],
        exact: 0,
        normalized: 0,
        unresolved: normalized.snapshots.length,
        fallbackError: errorText(fallbackError),
      }))
      const recovered = fallback.resolved.length > 0
      return {
        ...fallback,
        error: recovered
          ? `PITCHER_IDENTITY_PREVIEW_FAILED_CERTIFIED_MAPPING_FALLBACK_USED: ${errorText(error)}`
          : `PITCHER_IDENTITY_RESOLUTION_FAILED: ${errorText(error)}${'fallbackError' in fallback ? `; fallback: ${fallback.fallbackError}` : ''}`,
      }
    })
    const rows = identity.resolved
    const rowValidation = validateSnapshots(rows)
    const persisted = await persistRows(rows, rowValidation.success)
    const identityBlocked = normalized.snapshots.length > 0 && rows.length === 0
    const identityError = 'error' in identity ? [identity.error] : []
    const identityWarnings = !identityBlocked ? identityError : []
    const identityBlockers = identityBlocked ? ['ALL_PITCHER_IDENTITIES_UNRESOLVED', ...identityError] : []
    const nextStatus: MlbPlayerPropIngestionStatus = persisted.error || !rowValidation.success || identityBlocked ? 'VALIDATION_FAILED' : 'SYNCED'
    return {
      success: nextStatus === 'SYNCED',
      mode: 'mlb_player_prop_ingestion_sync_v1',
      generatedAt: nowIso(),
      selectedDate: options.date ?? new Date().toISOString().slice(0, 10),
      provider,
      dryRun,
      confirmed,
      status: nextStatus,
      providerCallsMade: calls.length,
      remoteMutationsMade: persisted.rowsPersisted,
      rowsRead: normalized.rowsRead,
      rowsNormalized: normalized.snapshots.length,
      rowsEligibleForStorage: rows.length,
      rowsPersisted: persisted.rowsPersisted,
      rowsSkipped: normalized.snapshots.length - rows.length + persisted.rowsSkipped,
      storageTable: 'sports_odds_snapshots',
      supportedMarket: MARKET,
      supportedMarkets: MLB_PLAYER_PROP_MARKETS.map((market) => market.key),
      selectedMarkets: selectedMarkets.map((market) => market.key),
      supportedLines: MLB_PLAYER_PROP_MARKETS.find((market) => market.key === MARKET)?.supportedLines ?? [],
      supportedLinesByMarket: Object.fromEntries(MLB_PLAYER_PROP_MARKETS.map((market) => [market.key, market.supportedLines])),
      providerAudit,
      providerBudget: budget.status,
      healthBefore,
      validation: {
        success: rowValidation.success && !persisted.error && !identityBlocked,
        failedChecks: [...rowValidation.failedChecks, ...(persisted.error ? [persisted.error] : []), ...identityBlockers],
      },
      certifiedMappingsUsed: mappings.length,
      bookmakerCount: Array.from(new Set(rows.map((row) => row.sportsbook))).length,
      sportsbooks: Array.from(new Set(rows.map((row) => row.sportsbook))).sort(),
      pitcherIdentity: {
        exactMatches: identity.exact,
        normalizedMatches: identity.normalized,
        unresolved: identity.unresolved,
        ambiguous: 0,
      },
      quota: {
        requestsRemainingBefore: calls[0]?.requestsRemaining ?? null,
        requestsRemainingAfter: calls.at(-1)?.requestsRemaining ?? null,
        requestsUsedObserved: calls.reduce((sum, call) => sum + (Number.isFinite(call.requestsLast) ? Number(call.requestsLast) : 1), 0),
        requestsLast: calls.at(-1)?.requestsLast ?? null,
      },
      blockers: [...errors, ...identityBlockers],
      warnings: [
        ...identityWarnings,
        'Manual live sync only; no scheduled ingestion was enabled.',
        'No sportsbook lines were fabricated.',
        'No EV, Kelly, Official Pick or Portfolio Intelligence output is produced.',
      ],
    }
  }

  return {
    success: dryRun && validation.success,
    mode: 'mlb_player_prop_ingestion_sync_v1',
    generatedAt: nowIso(),
    selectedDate: options.date ?? new Date().toISOString().slice(0, 10),
    provider,
    dryRun,
    confirmed,
    status,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
    rowsRead: 0,
    rowsNormalized: 0,
    rowsEligibleForStorage: 0,
    rowsPersisted: 0,
    rowsSkipped: 0,
    storageTable: 'sports_odds_snapshots',
    supportedMarket: MARKET,
    supportedMarkets: MLB_PLAYER_PROP_MARKETS.map((market) => market.key),
    selectedMarkets: selectedMarkets.map((market) => market.key),
    supportedLines: MLB_PLAYER_PROP_MARKETS.find((market) => market.key === MARKET)?.supportedLines ?? [],
    supportedLinesByMarket: Object.fromEntries(MLB_PLAYER_PROP_MARKETS.map((market) => [market.key, market.supportedLines])),
    providerAudit,
    providerBudget: budget.status,
    healthBefore,
    validation,
    blockers: Array.from(new Set([
      ...providerAudit.blockers,
      budget.blockedReason,
      !dryRun && !confirmed ? 'confirm=MLB_PLAYER_PROP_SYNC required for protected live sync' : null,
      !dryRun && provider !== ODDS_API_PROVIDER ? 'LIVE_PLAYER_PROP_PROVIDER_CALL_DISABLED_UNTIL_CONTRACT_CONFIRMED' : null,
    ].filter(Boolean) as string[])),
    warnings: [
      'Dry-run first: no provider calls and no database mutations were made.',
      'No sportsbook lines are fabricated.',
      'No EV, Kelly, Official Pick or Portfolio Intelligence output is produced.',
    ],
  }
}
