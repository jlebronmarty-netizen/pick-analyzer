import 'server-only'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { puertoRicoUtcRange } from '@/services/active-event.service'
import {
  MLB_PLAYER_PROP_MARKETS,
  playerPropMarketFromProvider,
  playerPropMarketFromStorage,
  playerPropSupportedLine,
} from '@/config/mlb-player-prop-markets'
import { getMlbPlayerPropIngestionProviderAudit } from '@/services/mlb-player-prop-sync.service'
import { MLB_ODDS_API_PLAYER_PROP_JOB_TYPE } from '@/services/mlb-odds-api-project-budget.service'
import { getCertifiedOddsApiEventMappings, ODDS_API_PROVIDER } from '@/services/the-odds-api-event-crosswalk.service'
import type { MlbPlayerPropIngestionMarket } from '@/types/mlb-player-prop-ingestion'

const SPORT_KEY = 'baseball_mlb'
const LEAGUE_KEY = 'mlb'
const ROW_LIMIT_PER_EVENT = 250

type StoredPropRow = {
  id: string
  sportsbook: string
  market: string
  outcome: string
  line: number | string | null
  snapshot_time: string | null
  provider_timestamp: string | null
  created_at: string | null
  updated_at: string | null
  metadata: Record<string, unknown> | null
}

type SyncJobRow = {
  id: string
  started_at: string | null
  completed_at: string | null
  status: string | null
  records_inserted: number | null
  metadata: Record<string, unknown> | null
}

type CertifiedMappingRow = {
  internal_id: string | null
  provider_id: string | null
  metadata: Record<string, unknown> | null
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function text(value: unknown) {
  const rendered = String(value ?? '').trim()
  return rendered || null
}

function canonicalMarket(row: StoredPropRow): MlbPlayerPropIngestionMarket | null {
  return playerPropMarketFromStorage(row.market)?.key ??
    playerPropMarketFromStorage(row.metadata?.market)?.key ??
    playerPropMarketFromProvider(row.metadata?.providerMarketKey)?.key ??
    null
}

function duplicateCount(rows: StoredPropRow[]) {
  const seen = new Set<string>()
  let duplicates = 0
  for (const row of rows) {
    if (seen.has(row.id)) duplicates += 1
    seen.add(row.id)
  }
  return duplicates
}

async function latestCompletedPlayerPropSync() {
  const { data, error } = await supabaseAdmin
    .from('sports_sync_jobs')
    .select('id,started_at,completed_at,status,records_inserted,metadata')
    .eq('provider', ODDS_API_PROVIDER)
    .eq('sport_key', SPORT_KEY)
    .eq('job_type', MLB_ODDS_API_PLAYER_PROP_JOB_TYPE)
    .in('status', ['completed', 'partial'])
    .order('started_at', { ascending: false })
    .limit(1)

  if (error) throw new Error(`MLB player prop health ledger read failed: ${error.message}`)
  return ((data ?? [])[0] ?? null) as SyncJobRow | null
}

function mappedEventIdsForDate(rows: CertifiedMappingRow[], selectedDate: string) {
  const range = puertoRicoUtcRange(selectedDate)
  const start = Date.parse(range.utcStart)
  const end = Date.parse(range.utcEndExclusive)
  return Array.from(new Set(rows.flatMap((row) => {
    const metadata = asRecord(row.metadata)
    const internalStartTime = text(metadata.internalStartTime)
    const validationStatus = text(metadata.validationStatus)
    const internalEventId = text(row.internal_id)
    const timestamp = internalStartTime ? Date.parse(internalStartTime) : Number.NaN
    if (!internalEventId || validationStatus !== 'CERTIFIED' || !Number.isFinite(timestamp)) return []
    return timestamp >= start && timestamp < end ? [internalEventId] : []
  }))).sort()
}

async function readMappedEventRows(eventIds: string[]) {
  if (!eventIds.length) return { rows: [] as StoredPropRow[], errors: [] as string[] }

  const results = await Promise.all(eventIds.map(async (eventId) => {
    const { data, error } = await supabaseAdmin
      .from('sports_odds_snapshots')
      .select('id,sportsbook,market,outcome,line,snapshot_time,provider_timestamp,created_at,updated_at,metadata')
      .eq('sport_key', SPORT_KEY)
      .eq('league_key', LEAGUE_KEY)
      .eq('provider', ODDS_API_PROVIDER)
      .eq('event_id', eventId)
      .eq('odds_classification', 'player_prop_pregame')
      .like('market', 'player_props:%')
      .order('snapshot_time', { ascending: false })
      .limit(ROW_LIMIT_PER_EVENT)
    return {
      rows: (data ?? []) as StoredPropRow[],
      error: error ? `${eventId}: ${error.message}` : null,
    }
  }))

  return {
    rows: results.flatMap((result) => result.rows),
    errors: results.map((result) => result.error).filter((value): value is string => Boolean(value)),
  }
}

export async function getMlbPlayerPropRecentIngestionHealth() {
  const generatedAt = new Date().toISOString()
  const [latestSync, providerAudit, mappingsRaw] = await Promise.all([
    latestCompletedPlayerPropSync(),
    getMlbPlayerPropIngestionProviderAudit(),
    getCertifiedOddsApiEventMappings(),
  ])

  const syncMetadata = asRecord(latestSync?.metadata)
  const selectedDate = text(syncMetadata.selectedDate)
  const mappedEventIds = selectedDate
    ? mappedEventIdsForDate(mappingsRaw as CertifiedMappingRow[], selectedDate)
    : []
  const storage = await readMappedEventRows(mappedEventIds)

  if (storage.errors.length) {
    throw new Error(`MLB mapped-event player prop health read failed: ${storage.errors.join('; ')}`)
  }

  const rows = storage.rows
  const supportedRowsByMarket = MLB_PLAYER_PROP_MARKETS.reduce((acc, market) => {
    acc[market.key] = rows.filter((row) => (
      canonicalMarket(row) === market.key && playerPropSupportedLine(market.key, row.line) !== null
    )).length
    return acc
  }, {} as Record<MlbPlayerPropIngestionMarket, number>)

  const failedChecks = rows.flatMap((row) => {
    const market = canonicalMarket(row)
    return [
      market ? null : `${row.id} unsupported market`,
      market && playerPropSupportedLine(market, row.line) === null ? `${row.id} unsupported line` : null,
      !['over', 'under'].includes(String(row.outcome ?? '').toLowerCase()) ? `${row.id} unsupported outcome` : null,
    ].filter(Boolean) as string[]
  })

  const timestamps = rows
    .map((row) => row.provider_timestamp ?? row.snapshot_time)
    .filter((value): value is string => Boolean(value))
    .sort()
  const storedTimestamps = rows
    .map((row) => row.updated_at ?? row.created_at)
    .filter((value): value is string => Boolean(value))
    .sort()

  const validation = {
    success: failedChecks.length === 0,
    failedChecks,
  }
  const storageBlockers = [
    latestSync ? null : 'NO_COMPLETED_PLAYER_PROP_SYNC_JOB',
    selectedDate ? null : 'LATEST_PLAYER_PROP_SYNC_DATE_MISSING',
    mappedEventIds.length ? null : 'NO_CERTIFIED_MAPPED_EVENTS_FOR_LATEST_SYNC_DATE',
    rows.length ? null : 'NO_STORED_PLAYER_PROP_MARKET_ROWS_FOR_LATEST_SYNC_DATE',
  ].filter(Boolean) as string[]

  return {
    success: validation.success && storageBlockers.length === 0,
    mode: 'mlb_player_prop_recent_ingestion_health_v1',
    generatedAt,
    status: rows.length ? 'SYNCED' : 'NO_RECENT_ROWS',
    readScope: 'latest_completed_sync_certified_mapped_events',
    latestSync: latestSync ? {
      id: latestSync.id,
      startedAt: latestSync.started_at,
      completedAt: latestSync.completed_at,
      status: latestSync.status,
      recordsInserted: latestSync.records_inserted,
      selectedDate,
    } : null,
    mappedEventIds,
    rowLimitPerEvent: ROW_LIMIT_PER_EVENT,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
    rowsRead: rows.length,
    rowsNormalized: rows.length,
    rowsEligibleForStorage: rows.length,
    rowsPersisted: 0,
    duplicateSnapshots: duplicateCount(rows),
    supportedRecordedOutsRows: supportedRowsByMarket.pitcher_outs_recorded,
    supportedRowsByMarket,
    sportsbooks: Array.from(new Set(rows.map((row) => row.sportsbook).filter(Boolean))).sort(),
    markets: MLB_PLAYER_PROP_MARKETS.map((market) => market.key),
    freshness: {
      latestProviderTimestamp: timestamps.at(-1) ?? null,
      latestStoredTimestamp: storedTimestamps.at(-1) ?? null,
    },
    blockers: Array.from(new Set([...providerAudit.blockers, ...storageBlockers])),
    validation,
    providerAudit,
  }
}
