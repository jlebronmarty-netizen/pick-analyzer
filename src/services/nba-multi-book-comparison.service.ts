import { supabaseAdmin } from '@/lib/supabase-admin'
import { resolveNbaSeason } from '@/services/nba-data-sync.service'
import { NBA_LEAGUE_KEY, NBA_SPORT_KEY } from '@/services/nba-prediction-validation.service'

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
  is_opening: boolean | null
  is_closing: boolean | null
}

type EventRow = {
  id: string
  home_team: string
  away_team: string
  start_time: string
  status: string
}

type BookPrice = {
  sportsbook: string
  provider: string
  odds: number
  line: number | null
  snapshotTime: string
  ageMinutes: number
  isOpening: boolean
  isClosing: boolean
  stale: boolean
}

type ComparisonGroup = {
  id: string
  eventId: string
  homeTeam: string | null
  awayTeam: string | null
  startTime: string | null
  market: string
  outcome: string
  line: number | null
  books: BookPrice[]
  bestBook: BookPrice | null
  worstBook: BookPrice | null
  consensusOdds: number | null
  bookCount: number
  priceSpreadCents: number
  staleBookCount: number
  status: 'empty' | 'single_book' | 'multi_book' | 'stale'
  recommendation: 'NO_MARKET' | 'MONITOR' | 'SHOP_BEST_PRICE' | 'STALE'
}

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits))
}

function americanToDecimal(odds: number) {
  if (odds === 0) return 1
  return odds > 0 ? 1 + odds / 100 : 1 + 100 / Math.abs(odds)
}

function decimalToAmerican(decimal: number) {
  if (!Number.isFinite(decimal) || decimal <= 1) return 0
  if (decimal >= 2) return Math.round((decimal - 1) * 100)
  return Math.round(-100 / (decimal - 1))
}

function ageMinutes(snapshotTime: string, now = Date.now()) {
  const parsed = new Date(snapshotTime).getTime()
  if (!Number.isFinite(parsed)) return Number.POSITIVE_INFINITY
  return Math.max(0, Math.round((now - parsed) / 60000))
}

function normalizeLine(value: number | null) {
  if (value === null || !Number.isFinite(Number(value))) return 'none'
  return Number(value).toFixed(2)
}

function groupKey(row: OddsRow) {
  return [
    row.event_id,
    row.market,
    row.outcome,
    normalizeLine(row.line),
  ].join('|')
}

function isBetterPrice(next: BookPrice, current: BookPrice | null) {
  if (!current) return true
  return americanToDecimal(next.odds) > americanToDecimal(current.odds)
}

function getConsensusOdds(books: BookPrice[]) {
  const decimals = books
    .map((book) => americanToDecimal(book.odds))
    .filter((value) => Number.isFinite(value) && value > 1)

  if (!decimals.length) return null

  const average =
    decimals.reduce((sum, value) => sum + value, 0) / decimals.length

  return decimalToAmerican(average)
}

function compareByBestPrice(a: ComparisonGroup, b: ComparisonGroup) {
  return (
    b.priceSpreadCents - a.priceSpreadCents ||
    b.bookCount - a.bookCount ||
    a.staleBookCount - b.staleBookCount
  )
}

async function loadRows(limit: number, market: string | null) {
  const season = resolveNbaSeason()
  let query = supabaseAdmin
    .from('sports_odds_snapshots')
    .select(
      'id, sport_key, league_key, season, event_id, provider, sportsbook, market, outcome, price, line, snapshot_time, is_opening, is_closing'
    )
    .eq('sport_key', NBA_SPORT_KEY)
    .eq('league_key', NBA_LEAGUE_KEY)
    .order('snapshot_time', { ascending: false })
    .limit(Math.max(1, Math.min(limit * 20, 1000)))

  if (market) {
    query = query.eq('market', market)
  }

  const [odds, events] = await Promise.all([
    query,
    supabaseAdmin
      .from('sport_events')
      .select('id, home_team, away_team, start_time, status')
      .eq('sport_key', NBA_SPORT_KEY)
      .eq('league_key', NBA_LEAGUE_KEY)
      .eq('season', season.key)
      .limit(1000),
  ])

  if (odds.error) throw odds.error
  if (events.error) throw events.error

  return {
    season: season.key,
    odds: (odds.data ?? []) as OddsRow[],
    events: (events.data ?? []) as EventRow[],
  }
}

function buildGroups({
  odds,
  events,
  staleMinutes,
  limit,
}: {
  odds: OddsRow[]
  events: EventRow[]
  staleMinutes: number
  limit: number
}) {
  const now = Date.now()
  const eventsById = new Map(events.map((event) => [event.id, event]))
  const latestByBook = new Map<string, OddsRow>()

  for (const row of odds) {
    if (row.price === null || !Number.isFinite(Number(row.price))) continue

    const key = `${groupKey(row)}|${row.sportsbook}`
    const current = latestByBook.get(key)

    if (
      !current ||
      new Date(row.snapshot_time).getTime() >
        new Date(current.snapshot_time).getTime()
    ) {
      latestByBook.set(key, row)
    }
  }

  const grouped = new Map<string, OddsRow[]>()
  for (const row of latestByBook.values()) {
    const key = groupKey(row)
    grouped.set(key, [...(grouped.get(key) ?? []), row])
  }

  const groups: ComparisonGroup[] = []

  for (const [key, rows] of grouped.entries()) {
    const [eventId, market, outcome, lineKey] = key.split('|')
    const event = eventsById.get(eventId)
    const books = rows
      .map((row) => {
        const age = ageMinutes(row.snapshot_time, now)
        return {
          sportsbook: row.sportsbook,
          provider: row.provider,
          odds: Number(row.price),
          line: row.line,
          snapshotTime: row.snapshot_time,
          ageMinutes: age,
          isOpening: Boolean(row.is_opening),
          isClosing: Boolean(row.is_closing),
          stale: age > staleMinutes,
        }
      })
      .sort((a, b) => americanToDecimal(b.odds) - americanToDecimal(a.odds))

    const bestBook = books.reduce<BookPrice | null>(
      (best, book) => (isBetterPrice(book, best) ? book : best),
      null
    )
    const worstBook = [...books].sort(
      (a, b) => americanToDecimal(a.odds) - americanToDecimal(b.odds)
    )[0] ?? null
    const priceSpreadCents =
      bestBook && worstBook ? round(bestBook.odds - worstBook.odds) : 0
    const staleBookCount = books.filter((book) => book.stale).length
    const status =
      books.length === 0
        ? 'empty'
        : staleBookCount === books.length
          ? 'stale'
          : books.length === 1
            ? 'single_book'
            : 'multi_book'

    groups.push({
      id: key,
      eventId,
      homeTeam: event?.home_team ?? null,
      awayTeam: event?.away_team ?? null,
      startTime: event?.start_time ?? null,
      market,
      outcome,
      line: lineKey === 'none' ? null : Number(lineKey),
      books,
      bestBook,
      worstBook,
      consensusOdds: getConsensusOdds(books),
      bookCount: books.length,
      priceSpreadCents,
      staleBookCount,
      status,
      recommendation:
        status === 'empty'
          ? 'NO_MARKET'
          : status === 'stale'
            ? 'STALE'
            : books.length > 1 && priceSpreadCents !== 0
              ? 'SHOP_BEST_PRICE'
              : 'MONITOR',
    })
  }

  return groups.sort(compareByBestPrice).slice(0, limit)
}

export async function getNbaMultiBookComparison({
  limit = 25,
  market = null,
  staleMinutes = 120,
}: {
  limit?: number
  market?: string | null
  staleMinutes?: number
} = {}) {
  const safeLimit = Math.max(1, Math.min(limit, 100))
  const safeStaleMinutes = Math.max(15, Math.min(staleMinutes, 1440))
  const rows = await loadRows(safeLimit, market)
  const comparisons = buildGroups({
    odds: rows.odds,
    events: rows.events,
    staleMinutes: safeStaleMinutes,
    limit: safeLimit,
  })
  const books = new Set(rows.odds.map((row) => row.sportsbook).filter(Boolean))
  const multiBookMarkets = comparisons.filter(
    (item) => item.status === 'multi_book'
  )
  const staleMarkets = comparisons.filter((item) => item.status === 'stale')
  const bestOpportunities = comparisons.filter(
    (item) => item.recommendation === 'SHOP_BEST_PRICE'
  )

  return {
    success: true,
    mode: 'nba_multi_book_comparison_v1',
    generatedAt: new Date().toISOString(),
    sportKey: NBA_SPORT_KEY,
    leagueKey: NBA_LEAGUE_KEY,
    season: rows.season,
    providerUsage: {
      externalProviderCallsMade: 0,
      source: 'stored_supabase_odds_snapshots',
    },
    filters: {
      market,
      limit: safeLimit,
      staleMinutes: safeStaleMinutes,
    },
    status:
      rows.odds.length === 0
        ? 'empty'
        : multiBookMarkets.length > 0
          ? 'ready'
          : 'single_book',
    summary: {
      oddsSnapshotsLoaded: rows.odds.length,
      eventsLoaded: rows.events.length,
      sportsbooksTracked: books.size,
      comparisonGroups: comparisons.length,
      multiBookMarkets: multiBookMarkets.length,
      staleMarkets: staleMarkets.length,
      bestPriceOpportunities: bestOpportunities.length,
      averageBooksPerMarket: comparisons.length
        ? round(
            comparisons.reduce((sum, item) => sum + item.bookCount, 0) /
              comparisons.length
          )
        : 0,
      maxPriceSpreadCents: comparisons.length
        ? Math.max(...comparisons.map((item) => item.priceSpreadCents))
        : 0,
    },
    warnings: [
      ...(rows.odds.length === 0
        ? ['No stored NBA odds snapshots are available for comparison.']
        : []),
      ...(books.size <= 1 && rows.odds.length > 0
        ? ['Only one sportsbook is represented in stored NBA odds snapshots.']
        : []),
      ...(staleMarkets.length > 0
        ? ['Some comparison groups contain only stale stored odds.']
        : []),
    ],
    comparisons,
  }
}
