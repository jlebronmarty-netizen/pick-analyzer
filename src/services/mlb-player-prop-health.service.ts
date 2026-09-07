import 'server-only'

import { supabaseAdmin } from '@/lib/supabase-admin'
import {
  MLB_PLAYER_PROP_MARKETS,
  playerPropMarketFromProvider,
  playerPropMarketFromStorage,
  playerPropSupportedLine,
} from '@/config/mlb-player-prop-markets'
import { getMlbPlayerPropIngestionProviderAudit } from '@/services/mlb-player-prop-sync.service'
import type { MlbPlayerPropIngestionMarket } from '@/types/mlb-player-prop-ingestion'

const SPORT_KEY = 'baseball_mlb'
const LEAGUE_KEY = 'mlb'
const RECENT_WINDOW_DAYS = 14
const ROW_LIMIT = 1000

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

export async function getMlbPlayerPropRecentIngestionHealth() {
  const generatedAt = new Date().toISOString()
  const lookbackStart = new Date(Date.now() - RECENT_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString()

  const [{ data, error }, providerAudit] = await Promise.all([
    supabaseAdmin
      .from('sports_odds_snapshots')
      .select('id,sportsbook,market,outcome,line,snapshot_time,provider_timestamp,created_at,updated_at,metadata')
      .eq('sport_key', SPORT_KEY)
      .eq('league_key', LEAGUE_KEY)
      .eq('odds_classification', 'player_prop_pregame')
      .gte('snapshot_time', lookbackStart)
      .order('snapshot_time', { ascending: false })
      .limit(ROW_LIMIT),
    getMlbPlayerPropIngestionProviderAudit(),
  ])

  if (error) throw new Error(`MLB recent player prop health read failed: ${error.message}`)

  const rows = (data ?? []) as StoredPropRow[]
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
  const storageBlockers = rows.length ? [] : ['NO_RECENT_STORED_PLAYER_PROP_MARKET_ROWS']

  return {
    success: validation.success,
    mode: 'mlb_player_prop_recent_ingestion_health_v1',
    generatedAt,
    status: rows.length ? 'SYNCED' : 'NO_RECENT_ROWS',
    readWindowDays: RECENT_WINDOW_DAYS,
    rowLimit: ROW_LIMIT,
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
