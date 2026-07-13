import { supabaseAdmin } from '@/lib/supabase-admin'
import { resolveNbaSeason } from '@/services/nba-data-sync.service'
import { NBA_LEAGUE_KEY, NBA_SPORT_KEY } from '@/services/nba-prediction-validation.service'

type OddsRow = {
  id: string
  event_id: string
  sportsbook: string
  market: string
  outcome: string
  price: number | null
  line: number | null
  snapshot_time: string
}

type EventRow = {
  id: string
  home_team: string
  away_team: string
  start_time: string
  status: string
}

type BookMove = {
  sportsbook: string
  openingOdds: number
  latestOdds: number
  moveCents: number
  direction: 'toward_outcome' | 'away_from_outcome' | 'flat'
  firstSnapshotTime: string
  latestSnapshotTime: string
  snapshotCount: number
  snapshotIds: string[]
}

type SteamSignal = {
  id: string
  eventId: string
  homeTeam: string | null
  awayTeam: string | null
  startTime: string | null
  market: string
  outcome: string
  line: number | null
  signal: 'STEAM_MOVE' | 'MARKET_DRIFT' | 'INSUFFICIENT_HISTORY'
  direction: 'toward_outcome' | 'away_from_outcome' | 'mixed'
  confidence: number
  maxMoveCents: number
  averageMoveCents: number
  alignedBooks: number
  totalBooks: number
  windowMinutes: number
  books: BookMove[]
  evidenceSnapshotIds: string[]
  warnings: string[]
}

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits))
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

function minutesBetween(start: string, end: string) {
  const startMs = new Date(start).getTime()
  const endMs = new Date(end).getTime()

  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return 0

  return Math.max(0, Math.round((endMs - startMs) / 60000))
}

function directionFromMove(moveCents: number): BookMove['direction'] {
  if (moveCents <= -5) return 'toward_outcome'
  if (moveCents >= 5) return 'away_from_outcome'
  return 'flat'
}

function getDominantDirection(books: BookMove[]) {
  const toward = books.filter((book) => book.direction === 'toward_outcome')
  const away = books.filter((book) => book.direction === 'away_from_outcome')

  if (toward.length === away.length) return 'mixed'
  return toward.length > away.length ? 'toward_outcome' : 'away_from_outcome'
}

function confidence({
  alignedBooks,
  totalBooks,
  maxMoveCents,
  windowMinutes,
}: {
  alignedBooks: number
  totalBooks: number
  maxMoveCents: number
  windowMinutes: number
}) {
  const bookScore = totalBooks > 0 ? (alignedBooks / totalBooks) * 55 : 0
  const moveScore = Math.min(Math.abs(maxMoveCents) * 1.5, 30)
  const speedScore =
    windowMinutes > 0 ? Math.min(15, Math.max(0, 15 - windowMinutes / 12)) : 0

  return round(Math.min(100, bookScore + moveScore + speedScore))
}

async function loadRows(limit: number, market: string | null) {
  const season = resolveNbaSeason()
  let query = supabaseAdmin
    .from('sports_odds_snapshots')
    .select('id, event_id, sportsbook, market, outcome, price, line, snapshot_time')
    .eq('sport_key', NBA_SPORT_KEY)
    .eq('league_key', NBA_LEAGUE_KEY)
    .order('snapshot_time', { ascending: true })
    .limit(Math.max(1, Math.min(limit * 80, 2000)))

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

function buildBookMoves(rows: OddsRow[]) {
  const byBook = new Map<string, OddsRow[]>()

  for (const row of rows) {
    if (row.price === null || !Number.isFinite(Number(row.price))) continue
    byBook.set(row.sportsbook, [...(byBook.get(row.sportsbook) ?? []), row])
  }

  const moves: BookMove[] = []

  for (const [sportsbook, snapshots] of byBook.entries()) {
    const sorted = [...snapshots].sort(
      (a, b) =>
        new Date(a.snapshot_time).getTime() -
        new Date(b.snapshot_time).getTime()
    )

    if (sorted.length < 2) continue

    const first = sorted[0]
    const latest = sorted[sorted.length - 1]
    const openingOdds = Number(first.price)
    const latestOdds = Number(latest.price)
    const moveCents = latestOdds - openingOdds

    moves.push({
      sportsbook,
      openingOdds,
      latestOdds,
      moveCents: round(moveCents),
      direction: directionFromMove(moveCents),
      firstSnapshotTime: first.snapshot_time,
      latestSnapshotTime: latest.snapshot_time,
      snapshotCount: sorted.length,
      snapshotIds: sorted.map((row) => row.id),
    })
  }

  return moves
}

function buildSignals({
  odds,
  events,
  limit,
}: {
  odds: OddsRow[]
  events: EventRow[]
  limit: number
}) {
  const eventsById = new Map(events.map((event) => [event.id, event]))
  const grouped = new Map<string, OddsRow[]>()

  for (const row of odds) {
    const key = groupKey(row)
    grouped.set(key, [...(grouped.get(key) ?? []), row])
  }

  const signals: SteamSignal[] = []

  for (const [key, rows] of grouped.entries()) {
    const [eventId, market, outcome, lineKey] = key.split('|')
    const event = eventsById.get(eventId)
    const books = buildBookMoves(rows)
    const totalBooks = new Set(rows.map((row) => row.sportsbook)).size
    const dominantDirection = getDominantDirection(books)
    const alignedBooks =
      dominantDirection === 'mixed'
        ? 0
        : books.filter((book) => book.direction === dominantDirection).length
    const movingBooks = books.filter((book) => book.direction !== 'flat')
    const maxMoveCents = movingBooks.length
      ? movingBooks.reduce(
          (max, book) => Math.max(max, Math.abs(book.moveCents)),
          0
        )
      : 0
    const averageMoveCents = movingBooks.length
      ? round(
          movingBooks.reduce(
            (sum, book) => sum + Math.abs(book.moveCents),
            0
          ) / movingBooks.length
        )
      : 0
    const allTimes = books.flatMap((book) => [
      book.firstSnapshotTime,
      book.latestSnapshotTime,
    ])
    const windowMinutes =
      allTimes.length > 1
        ? minutesBetween(
            [...allTimes].sort()[0],
            [...allTimes].sort()[allTimes.length - 1]
          )
        : 0
    const score = confidence({
      alignedBooks,
      totalBooks,
      maxMoveCents,
      windowMinutes,
    })
    const signal =
      books.length < 2
        ? 'INSUFFICIENT_HISTORY'
        : alignedBooks >= 3 && maxMoveCents >= 12 && score >= 65
          ? 'STEAM_MOVE'
          : 'MARKET_DRIFT'

    signals.push({
      id: key,
      eventId,
      homeTeam: event?.home_team ?? null,
      awayTeam: event?.away_team ?? null,
      startTime: event?.start_time ?? null,
      market,
      outcome,
      line: lineKey === 'none' ? null : Number(lineKey),
      signal,
      direction: dominantDirection,
      confidence: score,
      maxMoveCents: round(maxMoveCents),
      averageMoveCents,
      alignedBooks,
      totalBooks,
      windowMinutes,
      books,
      evidenceSnapshotIds: books.flatMap((book) => book.snapshotIds),
      warnings: [
        ...(books.length < 2
          ? ['At least two sportsbooks with repeated snapshots are required for a steam signal.']
          : []),
        ...(signal === 'MARKET_DRIFT'
          ? ['Movement exists but does not meet steam thresholds.']
          : []),
      ],
    })
  }

  return signals
    .sort(
      (a, b) =>
        b.confidence - a.confidence ||
        b.maxMoveCents - a.maxMoveCents ||
        b.alignedBooks - a.alignedBooks
    )
    .slice(0, limit)
}

export async function getNbaSteamMoveDetection({
  limit = 25,
  market = null,
}: {
  limit?: number
  market?: string | null
} = {}) {
  const safeLimit = Math.max(1, Math.min(limit, 100))
  const rows = await loadRows(safeLimit, market)
  const signals = buildSignals({
    odds: rows.odds,
    events: rows.events,
    limit: safeLimit,
  })
  const steamMoves = signals.filter((item) => item.signal === 'STEAM_MOVE')
  const drift = signals.filter((item) => item.signal === 'MARKET_DRIFT')
  const insufficient = signals.filter(
    (item) => item.signal === 'INSUFFICIENT_HISTORY'
  )
  const books = new Set(rows.odds.map((row) => row.sportsbook).filter(Boolean))

  return {
    success: true,
    mode: 'nba_steam_move_detection_v1',
    generatedAt: new Date().toISOString(),
    sportKey: NBA_SPORT_KEY,
    leagueKey: NBA_LEAGUE_KEY,
    season: rows.season,
    providerUsage: {
      externalProviderCallsMade: 0,
      source: 'stored_supabase_odds_snapshots',
    },
    filters: {
      limit: safeLimit,
      market,
    },
    status:
      rows.odds.length === 0
        ? 'empty'
        : steamMoves.length > 0
          ? 'signals'
          : 'insufficient_history',
    summary: {
      oddsSnapshotsLoaded: rows.odds.length,
      sportsbooksTracked: books.size,
      groupsAnalyzed: signals.length,
      steamMoves: steamMoves.length,
      marketDrift: drift.length,
      insufficientHistory: insufficient.length,
      strongestSignal: signals[0] ?? null,
    },
    warnings: [
      ...(rows.odds.length === 0
        ? ['No stored NBA odds snapshots are available for steam detection.']
        : []),
      ...(rows.odds.length > 0 && steamMoves.length === 0
        ? ['Stored NBA odds history is insufficient for confirmed steam moves.']
        : []),
    ],
    signals,
  }
}
