import 'server-only'

import { supabaseAdmin } from '@/lib/supabase-admin'

type OddsSnapshotRow = {
  id: string
  sport_key: string | null
  league_key: string | null
  event_id: string | null
  sportsbook: string | null
  market: string | null
  outcome: string | null
  price: number | null
  line: number | null
  snapshot_time: string | null
  created_at?: string | null
  updated_at?: string | null
  provider_timestamp?: string | null
  metadata?: Record<string, unknown> | null
}

type EventRow = {
  id: string
  home_team: string | null
  away_team: string | null
  start_time: string | null
  status: string | null
}

export type MarketMovementFilters = {
  sport?: string | null
  eventId?: string | null
  market?: string | null
  sportsbook?: string | null
  freshness?: 'all' | 'fresh' | 'stale' | null
  limit?: number | null
}

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits))
}

function ts(row: OddsSnapshotRow) {
  return row.snapshot_time ?? row.provider_timestamp ?? row.created_at ?? row.updated_at ?? null
}

function ageMinutes(timestamp: string | null) {
  if (!timestamp) return null
  const parsed = Date.parse(timestamp)
  if (!Number.isFinite(parsed)) return null
  return Math.max(0, Math.round((Date.now() - parsed) / 60000))
}

function freshness(timestamp: string | null) {
  const age = ageMinutes(timestamp)
  if (age === null) return 'UNKNOWN'
  if (age <= 180) return 'FRESH'
  if (age <= 1440) return 'AGING'
  return 'STALE'
}

function groupKey(row: OddsSnapshotRow) {
  return [row.sport_key, row.event_id, row.market, row.outcome].map((value) => String(value ?? 'unknown').toLowerCase()).join('|')
}

function bookKey(row: OddsSnapshotRow) {
  return String(row.sportsbook ?? 'unknown').toLowerCase()
}

function priceMovement(open: number | null, current: number | null) {
  if (open === null || current === null || open === 0 || current === 0) return null
  return current - open
}

function lineMovement(open: number | null, current: number | null) {
  if (open === null || current === null) return null
  return round(current - open)
}

function movementConfidence(snapshotCount: number, bookmakerCount: number, hasTwoTimestamps: boolean) {
  if (snapshotCount >= 6 && bookmakerCount >= 2 && hasTwoTimestamps) return 'HIGH'
  if (snapshotCount >= 2 && hasTwoTimestamps) return 'MEDIUM'
  return 'LOW'
}

function movementStatus(snapshotCount: number, latestTimestamp: string | null) {
  if (snapshotCount <= 0) return 'NO_BOOKS'
  if (snapshotCount === 1) return 'SINGLE_SNAPSHOT_MARKET'
  if (freshness(latestTimestamp) === 'STALE') return 'STALE_MOVEMENT'
  return 'MOVEMENT_AVAILABLE'
}

function classifySteam(bookMovements: Array<number | null>, bookmakerCount: number) {
  const valid = bookMovements.filter((value): value is number => value !== null && value !== 0)
  if (valid.length < 2 || bookmakerCount < 2) return 'INSUFFICIENT_HISTORY'
  const positive = valid.filter((value) => value > 0).length
  const negative = valid.filter((value) => value < 0).length
  if (positive >= 2 || negative >= 2) return 'SYNCHRONIZED_BOOKMAKER_MOVEMENT'
  if (valid.length === 1) return 'ISOLATED_BOOKMAKER_MOVEMENT'
  return 'NO_SYNCHRONIZED_MOVEMENT'
}

function summarizeGroup(rows: OddsSnapshotRow[], event: EventRow | undefined) {
  const sorted = [...rows].sort((a, b) => String(ts(a) ?? '').localeCompare(String(ts(b) ?? '')))
  const earliest = sorted[0]
  const latest = sorted[sorted.length - 1]
  const latestTimestamp = ts(latest)
  const books = new Set(rows.map(bookKey))
  const latestByBook = new Map<string, OddsSnapshotRow>()
  const earliestByBook = new Map<string, OddsSnapshotRow>()
  for (const row of sorted) {
    const key = bookKey(row)
    if (!earliestByBook.has(key)) earliestByBook.set(key, row)
    latestByBook.set(key, row)
  }
  const currentPrices = Array.from(latestByBook.values()).map((row) => row.price).filter((value): value is number => value !== null && value !== 0)
  const bookMovements = Array.from(latestByBook.entries()).map(([book, current]) => {
    const open = earliestByBook.get(book)
    return priceMovement(open?.price ?? null, current.price)
  })
  const minPrice = currentPrices.length ? Math.min(...currentPrices) : null
  const maxPrice = currentPrices.length ? Math.max(...currentPrices) : null
  const movement = priceMovement(earliest.price, latest.price)
  const lineMove = lineMovement(earliest.line, latest.line)

  return {
    id: groupKey(latest),
    sport: latest.sport_key ?? 'unknown',
    eventId: latest.event_id,
    eventLabel: event ? `${event.away_team ?? 'Away'} @ ${event.home_team ?? 'Home'}` : 'Event unavailable',
    eventStartTime: event?.start_time ?? null,
    eventStatus: event?.status ?? null,
    market: latest.market ?? 'unknown',
    outcome: latest.outcome ?? 'unknown',
    earliestStoredPrice: earliest.price ?? null,
    currentStoredPrice: latest.price ?? null,
    earliestStoredLine: earliest.line ?? null,
    currentStoredLine: latest.line ?? null,
    earliestTimestamp: ts(earliest),
    latestTimestamp,
    priceMovement: movement,
    lineMovement: lineMove,
    bookmakerCount: books.size,
    bookmakers: Array.from(books).sort(),
    snapshotCount: rows.length,
    consensusRange: minPrice !== null && maxPrice !== null ? { min: minPrice, max: maxPrice } : null,
    bestCurrentlyStoredPrice: maxPrice,
    worstCurrentlyStoredPrice: minPrice,
    dispersion: minPrice !== null && maxPrice !== null ? round(maxPrice - minPrice) : null,
    freshness: freshness(latestTimestamp),
    movementConfidence: movementConfidence(rows.length, books.size, Boolean(ts(earliest) && latestTimestamp && ts(earliest) !== latestTimestamp)),
    status: movementStatus(rows.length, latestTimestamp),
    steamEvidence: {
      classification: classifySteam(bookMovements, books.size),
      label: 'No sharp-money claim is made. Classification reflects only synchronized stored bookmaker movement when evidence exists.',
      bookmakerMovements: bookMovements.filter((value): value is number => value !== null),
    },
    provenance: {
      openingLineCertified: false,
      openingLabel: 'Earliest stored price',
      sourceTable: 'sports_odds_snapshots',
      eventAligned: Boolean(latest.event_id),
      sideAligned: Boolean(latest.outcome),
      providerCallsMade: 0,
    },
    blockers: [
      rows.length < 2 ? 'Only one stored snapshot is available; movement history is insufficient.' : null,
      !latest.event_id ? 'Missing event alignment.' : null,
      !latest.outcome ? 'Missing side or outcome alignment.' : null,
      currentPrices.length === 0 ? 'No valid non-zero current stored price.' : null,
    ].filter(Boolean) as string[],
  }
}

async function loadSnapshots(filters: MarketMovementFilters) {
  const sport = filters.sport || 'baseball_mlb'
  let query = supabaseAdmin
    .from('sports_odds_snapshots')
    .select('id, sport_key, league_key, event_id, sportsbook, market, outcome, price, line, snapshot_time, created_at, updated_at, provider_timestamp, metadata')
    .eq('sport_key', sport)
    .order('snapshot_time', { ascending: false })
    .limit(5000)
  if (filters.eventId) query = query.eq('event_id', filters.eventId)
  if (filters.market) query = query.eq('market', filters.market)
  if (filters.sportsbook) query = query.eq('sportsbook', filters.sportsbook)
  const { data, error } = await query
  if (error) throw new Error(`Market movement snapshot read failed: ${error.message}`)
  return (data ?? []) as OddsSnapshotRow[]
}

async function loadEvents(eventIds: string[]) {
  if (!eventIds.length) return new Map<string, EventRow>()
  const { data, error } = await supabaseAdmin
    .from('sport_events')
    .select('id, home_team, away_team, start_time, status')
    .in('id', eventIds.slice(0, 200))
  if (error) throw new Error(`Market movement event read failed: ${error.message}`)
  return new Map(((data ?? []) as EventRow[]).map((event) => [event.id, event]))
}

export async function getMarketMovementIntelligence(filters: MarketMovementFilters = {}) {
  const limit = Math.min(Math.max(Math.round(Number(filters.limit ?? 25) || 25), 1), 100)
  const snapshots = await loadSnapshots(filters)
  const events = await loadEvents(Array.from(new Set(snapshots.map((row) => row.event_id).filter(Boolean))) as string[])
  const groups = new Map<string, OddsSnapshotRow[]>()
  for (const row of snapshots) {
    const key = groupKey(row)
    groups.set(key, [...(groups.get(key) ?? []), row])
  }
  let movementSummaries = Array.from(groups.values()).map((rows) => summarizeGroup(rows, rows[0].event_id ? events.get(rows[0].event_id) : undefined))
  if (filters.freshness === 'fresh') movementSummaries = movementSummaries.filter((row) => row.freshness === 'FRESH' || row.freshness === 'AGING')
  if (filters.freshness === 'stale') movementSummaries = movementSummaries.filter((row) => row.freshness === 'STALE')
  movementSummaries.sort((a, b) => String(b.latestTimestamp ?? '').localeCompare(String(a.latestTimestamp ?? '')))
  const returned = movementSummaries.slice(0, limit)
  const snapshotCounts = movementSummaries.map((row) => row.snapshotCount)
  const timestamps = snapshots.map(ts).filter(Boolean).sort() as string[]

  return {
    success: true,
    mode: 'market_movement_intelligence_v1',
    generatedAt: new Date().toISOString(),
    providerCallsMade: 0,
    remoteMutationsMade: 0,
    filters: {
      sport: filters.sport ?? 'baseball_mlb',
      eventId: filters.eventId ?? null,
      market: filters.market ?? null,
      sportsbook: filters.sportsbook ?? null,
      freshness: filters.freshness ?? 'all',
      limit,
    },
    capabilityAudit: {
      snapshotCount: snapshots.length,
      marketCoverage: Array.from(new Set(snapshots.map((row) => row.market ?? 'unknown'))).sort(),
      bookmakerCoverage: Array.from(new Set(snapshots.map((row) => row.sportsbook ?? 'unknown'))).sort(),
      marketsWithOneSnapshot: movementSummaries.filter((row) => row.snapshotCount === 1).length,
      marketsWithMultipleSnapshots: movementSummaries.filter((row) => row.snapshotCount > 1).length,
      earliestAvailableSnapshot: timestamps[0] ?? null,
      latestAvailableSnapshot: timestamps.at(-1) ?? null,
      timestampQuality: timestamps.length ? 'STORED_TIMESTAMP_AVAILABLE' : 'NO_TIMESTAMP_EVIDENCE',
      eventAlignmentQuality: snapshots.every((row) => row.event_id) ? 'EVENT_ALIGNED' : 'PARTIAL_EVENT_ALIGNMENT',
      sideAlignmentQuality: snapshots.every((row) => row.outcome) ? 'SIDE_ALIGNED' : 'PARTIAL_SIDE_ALIGNMENT',
    },
    movementSummaries: returned,
    coverage: {
      returned: returned.length,
      totalGroups: movementSummaries.length,
      averageSnapshotsPerGroup: snapshotCounts.length ? round(snapshotCounts.reduce((sum, value) => sum + value, 0) / snapshotCounts.length) : 0,
      synchronizedMovementGroups: movementSummaries.filter((row) => row.steamEvidence.classification === 'SYNCHRONIZED_BOOKMAKER_MOVEMENT').length,
      singleSnapshotGroups: movementSummaries.filter((row) => row.status === 'SINGLE_SNAPSHOT_MARKET').length,
    },
    provenance: {
      openingLineClaimed: false,
      openingLineLabel: 'Earliest stored price',
      sharpMoneyClaimed: false,
      sourceTable: 'sports_odds_snapshots',
    },
    warnings: [
      'Earliest stored price is not claimed to be a true market open unless opening-line provenance exists.',
      'No sharp-money claim is made from stored movement alone.',
    ],
  }
}

export function validateMarketMovementFixtures() {
  const base = (overrides: Partial<OddsSnapshotRow>): OddsSnapshotRow => ({
    id: overrides.id ?? 's1',
    sport_key: 'baseball_mlb',
    league_key: 'mlb',
    event_id: 'event_id' in overrides ? overrides.event_id ?? null : 'e1',
    sportsbook: 'sportsbook' in overrides ? overrides.sportsbook ?? null : 'BookA',
    market: overrides.market ?? 'moneyline',
    outcome: 'outcome' in overrides ? overrides.outcome ?? null : 'A',
    price: overrides.price ?? -110,
    line: overrides.line ?? null,
    snapshot_time: overrides.snapshot_time ?? '2026-07-27T10:00:00.000Z',
    metadata: {},
  })
  const one = summarizeGroup([base({})], undefined)
  const two = summarizeGroup([base({ id: 'a', price: -110 }), base({ id: 'b', price: -125, snapshot_time: '2026-07-27T12:00:00.000Z' })], undefined)
  const line = summarizeGroup([base({ id: 'c', market: 'spread', line: -1.5 }), base({ id: 'd', market: 'spread', line: -2.5, snapshot_time: '2026-07-27T12:00:00.000Z' })], undefined)
  const sync = summarizeGroup([
    base({ id: 'e', sportsbook: 'BookA', price: -110 }),
    base({ id: 'f', sportsbook: 'BookA', price: -125, snapshot_time: '2026-07-27T12:00:00.000Z' }),
    base({ id: 'g', sportsbook: 'BookB', price: -108 }),
    base({ id: 'h', sportsbook: 'BookB', price: -122, snapshot_time: '2026-07-27T12:00:00.000Z' }),
  ], undefined)
  const mismatchedEvent = summarizeGroup([base({ id: 'i', event_id: null })], undefined)
  const mismatchedSide = summarizeGroup([base({ id: 'j', outcome: null })], undefined)
  const noBooks = summarizeGroup([base({ id: 'k', sportsbook: null })], undefined)
  const checks = [
    ['one snapshot classified', one.status === 'SINGLE_SNAPSHOT_MARKET'],
    ['price movement calculated', two.priceMovement === -15],
    ['line movement calculated', line.lineMovement === -1],
    ['no movement can be zero', summarizeGroup([base({ id: 'l' }), base({ id: 'm', snapshot_time: '2026-07-27T12:00:00.000Z' })], undefined).priceMovement === 0],
    ['synchronized movement detected', sync.steamEvidence.classification === 'SYNCHRONIZED_BOOKMAKER_MOVEMENT'],
    ['mismatched event blocked', mismatchedEvent.blockers.includes('Missing event alignment.')],
    ['mismatched side blocked', mismatchedSide.blockers.includes('Missing side or outcome alignment.')],
    ['multiple books counted', sync.bookmakerCount === 2],
    ['no books still represented truthfully', noBooks.bookmakers.includes('unknown')],
  ]
  return {
    success: checks.every(([, pass]) => pass),
    mode: 'market_movement_intelligence_v1_validation',
    checks: checks.map(([name, pass]) => ({ name, pass })),
    providerCallsMade: 0,
    remoteMutationsMade: 0,
  }
}
