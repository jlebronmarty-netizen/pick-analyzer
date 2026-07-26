import 'server-only'

import { createHash } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { sportsDataIoCatalogForSport } from '@/config/sportsdataio-endpoint-catalog'
import { checkProviderBudget } from '@/services/provider-budget.service'
import type {
  MlbPlayerPropIngestionProvider,
  MlbPlayerPropIngestionSelection,
  MlbPlayerPropIngestionStatus,
  PitcherPropHealth,
  PitcherPropSnapshot,
} from '@/types/mlb-player-prop-ingestion'

const SPORT_KEY = 'baseball_mlb'
const LEAGUE_KEY = 'mlb'
const MARKET = 'pitcher_outs_recorded'
const ODDS_API_MARKET = 'pitcher_outs'
const SPORTS_ODDS_MARKET = 'player_props:pitcher_outs_recorded'
const SOURCE_VERSION = 'mlb_player_prop_ingestion_v1'
const SUPPORTED_LINES = [14.5, 15.5, 16.5, 17.5, 18.5] as const

type SyncOptions = {
  date?: string | null
  dryRun?: boolean | null
  confirmed?: boolean | null
  provider?: MlbPlayerPropIngestionProvider | null
  maximumEvents?: number | null
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

function hash(parts: unknown[]) {
  return createHash('sha256').update(parts.map((part) => String(part ?? 'null')).join('|')).digest('hex').slice(0, 24)
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

function supportedLine(value: unknown) {
  const line = num(value)
  return line !== null && SUPPORTED_LINES.includes(line as typeof SUPPORTED_LINES[number]) ? line : null
}

function snapshotId(input: {
  provider: MlbPlayerPropIngestionProvider
  eventId: string
  providerPitcherId: string | null
  pitcherName: string | null
  sportsbook: string
  bookmakerId: string | null
  selection: MlbPlayerPropIngestionSelection
  line: number
  providerTimestamp: string
}) {
  return `mlb_prop:${hash([
    input.provider,
    input.eventId,
    input.providerPitcherId ?? input.pitcherName,
    MARKET,
    input.sportsbook,
    input.bookmakerId,
    input.selection,
    input.line,
    input.providerTimestamp,
  ])}`
}

function snapshotFromOddsApi(input: {
  event: OddsApiEvent
  bookmaker: OddsApiBookmaker
  market: OddsApiMarket
  outcome: OddsApiOutcome
  storedTimestamp: string
}): PitcherPropSnapshot | null {
  const eventId = text(input.event.id)
  const selection = normalizeOutcome(input.outcome.name)
  const line = supportedLine(input.outcome.point)
  if (!eventId || !selection || line === null || input.market.key !== ODDS_API_MARKET) return null
  const providerTimestamp = normalizeProviderTimestamp(input.market.last_update ?? input.bookmaker.last_update, input.storedTimestamp)
  const americanOdds = num(input.outcome.price)
  const sportsbook = normalizeBookmaker(input.bookmaker.title ?? input.bookmaker.key)
  const bookmakerId = text(input.bookmaker.key)
  const pitcherName = text(input.outcome.description)
  const id = snapshotId({
    provider: 'the-odds-api',
    eventId,
    providerPitcherId: null,
    pitcherName,
    sportsbook,
    bookmakerId,
    selection,
    line,
    providerTimestamp,
  })
  return {
    id,
    eventId,
    pitcherId: null,
    providerPitcherId: null,
    market: MARKET,
    providerMarketKey: ODDS_API_MARKET,
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

function normalizeOddsApiPayload(payload: OddsApiEvent | OddsApiEvent[], storedTimestamp = nowIso()) {
  const events = Array.isArray(payload) ? payload : [payload]
  const snapshots: PitcherPropSnapshot[] = []
  let rowsRead = 0
  for (const event of events) {
    for (const bookmaker of event.bookmakers ?? []) {
      for (const market of bookmaker.markets ?? []) {
        for (const outcome of market.outcomes ?? []) {
          rowsRead += 1
          const snapshot = snapshotFromOddsApi({ event, bookmaker, market, outcome, storedTimestamp })
          if (snapshot) snapshots.push(snapshot)
        }
      }
    }
  }
  return { rowsRead, snapshots }
}

function toStorageRow(snapshot: PitcherPropSnapshot) {
  return {
    id: snapshot.id,
    sport_key: SPORT_KEY,
    league_key: LEAGUE_KEY,
    season: snapshot.storedTimestamp.slice(0, 4),
    event_id: snapshot.eventId,
    provider: snapshot.provider,
    sportsbook: snapshot.sportsbook,
    market: SPORTS_ODDS_MARKET,
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
      playerId: snapshot.pitcherId,
      providerPlayerId: snapshot.providerPitcherId,
      playerName: null,
      pitcherId: snapshot.pitcherId,
      providerPitcherId: snapshot.providerPitcherId,
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

function duplicateCount(snapshots: PitcherPropSnapshot[]) {
  const seen = new Set<string>()
  let duplicates = 0
  for (const snapshot of snapshots) {
    if (seen.has(snapshot.id)) duplicates += 1
    seen.add(snapshot.id)
  }
  return duplicates
}

function validateSnapshots(snapshots: PitcherPropSnapshot[]) {
  const failedChecks: string[] = []
  const seen = new Set<string>()
  for (const snapshot of snapshots) {
    if (seen.has(snapshot.id)) failedChecks.push(`duplicate snapshot ${snapshot.id}`)
    seen.add(snapshot.id)
    if (snapshot.market !== MARKET) failedChecks.push(`${snapshot.id} unsupported market`)
    if (!SUPPORTED_LINES.includes(snapshot.line as typeof SUPPORTED_LINES[number])) failedChecks.push(`${snapshot.id} unsupported line`)
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
    .eq('market', SPORTS_ODDS_MARKET)
    .order('snapshot_time', { ascending: false })
    .limit(5000)
  if (error) throw new Error(`MLB player prop storage health read failed: ${error.message}`)
  return (data ?? []) as StoredPropRow[]
}

function healthFromRows(rows: StoredPropRow[], status: MlbPlayerPropIngestionStatus, extra: Partial<PitcherPropHealth> = {}): PitcherPropHealth {
  const timestamps = rows.map((row) => row.provider_timestamp ?? row.snapshot_time).filter(Boolean).sort() as string[]
  const stored = rows.map((row) => row.updated_at ?? row.created_at).filter(Boolean).sort() as string[]
  const validation = {
    success: rows.every((row) => supportedLine(row.line) !== null && ['over', 'under'].includes(String(row.outcome).toLowerCase())),
    failedChecks: rows.flatMap((row) => [
      supportedLine(row.line) === null ? `${row.id} unsupported line` : null,
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
    duplicateSnapshots: duplicateCount(rows.map((row) => ({
      id: row.id,
      eventId: '',
      pitcherId: null,
      providerPitcherId: null,
      market: MARKET,
      providerMarketKey: ODDS_API_MARKET,
      line: Number(row.line),
      selection: String(row.outcome).toUpperCase() as MlbPlayerPropIngestionSelection,
      sportsbook: row.sportsbook,
      bookmakerId: null,
      americanOdds: num(row.price),
      decimalOdds: null,
      impliedProbability: null,
      providerTimestamp: row.snapshot_time ?? nowIso(),
      storedTimestamp: row.updated_at ?? nowIso(),
      snapshotId: row.id,
      provider: 'the-odds-api',
      sourceVersion: SOURCE_VERSION,
    }))),
    supportedRecordedOutsRows: rows.filter((row) => supportedLine(row.line) !== null).length,
    sportsbooks: Array.from(new Set(rows.map((row) => row.sportsbook))).sort(),
    markets: [MARKET],
    freshness: {
      latestProviderTimestamp: timestamps.at(-1) ?? null,
      latestStoredTimestamp: stored.at(-1) ?? null,
    },
    blockers: rows.length ? [] : ['NO_STORED_RECORDED_OUTS_PROP_MARKET_ROWS'],
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
        coverage: 'cataloged_enterprise_only',
        legalStatus: 'BLOCKED_PROVIDER_CONTRACT_UNAVAILABLE',
        endpoint: sportsDataIoProps?.pathTemplate ?? '/v3/mlb/odds/json/BettingPlayerPropsByGameID/{gameId}',
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
        coverage: 'documented_pitcher_outs_business_tier',
        legalStatus: oddsApiConfigured && oddsApiBusinessTierConfirmed ? 'CONTRACT_READY' : 'BLOCKED_PROVIDER_CONTRACT_UNAVAILABLE',
        endpoint: '/v4/sports/baseball_mlb/events/{eventId}/odds?markets=pitcher_outs',
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
      }],
    }],
  }, '2026-07-26T18:01:00.000Z')
  const validation = validateSnapshots(fixture.snapshots)
  const rows = fixture.snapshots.map(toStorageRow)
  const checks = [
    ['only supported half-out lines are normalized', fixture.snapshots.length === 2 && fixture.snapshots.every((row) => row.line === 16.5)],
    ['over and under normalize distinctly', new Set(fixture.snapshots.map((row) => row.selection)).size === 2],
    ['American odds implied probability converts', fixture.snapshots[0]?.impliedProbability === 0.5349],
    ['American odds decimal converts', fixture.snapshots[0]?.decimalOdds === 1.8696],
    ['storage market is comparison-compatible', rows.every((row) => row.market === SPORTS_ODDS_MARKET)],
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

export async function syncMlbPlayerProps(options: SyncOptions = {}) {
  const dryRun = options.dryRun !== false
  const provider = options.provider ?? 'the-odds-api'
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
  const blocked = providerAudit.blockers.length > 0
  const status: MlbPlayerPropIngestionStatus = dryRun
    ? 'DRY_RUN'
    : blocked
      ? 'BLOCKED_PROVIDER_CONTRACT_UNAVAILABLE'
      : !budget.allowed
        ? 'BLOCKED_UNSAFE_WRITE'
        : !options.confirmed
          ? 'BLOCKED_UNSAFE_WRITE'
          : 'BLOCKED_PROVIDER_CONTRACT_UNAVAILABLE'

  return {
    success: dryRun && validation.success,
    mode: 'mlb_player_prop_ingestion_sync_v1',
    generatedAt: nowIso(),
    selectedDate: options.date ?? new Date().toISOString().slice(0, 10),
    provider,
    dryRun,
    confirmed: options.confirmed === true,
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
    supportedLines: [...SUPPORTED_LINES],
    providerAudit,
    providerBudget: budget.status,
    healthBefore,
    validation,
    blockers: Array.from(new Set([
      ...providerAudit.blockers,
      budget.blockedReason,
      !dryRun && !options.confirmed ? 'confirmed=true required for protected writes' : null,
      'LIVE_PLAYER_PROP_PROVIDER_CALL_DISABLED_UNTIL_CONTRACT_CONFIRMED',
    ].filter(Boolean) as string[])),
    warnings: [
      'Dry-run first: no provider calls and no database mutations were made.',
      'No sportsbook lines are fabricated.',
      'No EV, Kelly, Official Pick or Portfolio Intelligence output is produced.',
    ],
  }
}
