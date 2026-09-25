import 'server-only'

import { supabaseAdmin } from '@/lib/supabase-admin'

const PROVIDER = 'balldontlie'
const SPORT_KEY = 'baseball_mlb'
const SAMPLE_DATES = [
  '2025-04-15',
  '2025-05-15',
  '2025-06-15',
  '2025-07-15',
  '2025-08-15',
  '2025-09-15',
] as const
const MAX_OPENING_PAGES_PER_DATE = 3
const MAX_PROVIDER_CALLS = SAMPLE_DATES.length * (1 + MAX_OPENING_PAGES_PER_DATE)

type JsonMap = Record<string, unknown>

type HistoricalGame = {
  canonical_game_id: string
  game_date: string
  canonical_home_team: string
  canonical_away_team: string
  game_number: string | null
}

type BdlGame = {
  id?: number
  date?: string
  home_team?: { abbreviation?: string }
  away_team?: { abbreviation?: string }
}

type BdlOpening = {
  id?: number
  game_id?: number
  vendor?: string
  spread_home_value?: string | number | null
  spread_home_odds?: number | null
  spread_away_value?: string | number | null
  spread_away_odds?: number | null
  moneyline_home_odds?: number | null
  moneyline_away_odds?: number | null
  total_value?: string | number | null
  total_over_odds?: number | null
  total_under_odds?: number | null
  opened_at?: string
}

function key() {
  return process.env.BALLDONTLIE_API_KEY?.trim() ?? ''
}

const TEAM_ALIAS: Record<string,string> = {
  ARI: 'AZ',
  CHW: 'CHW',
  CWS: 'CHW',
  WSN: 'WSH',
  WAS: 'WSH',
  TBR: 'TB',
  OAK: 'ATH',
}

function team(value: unknown) {
  const raw = String(value ?? '').trim().toUpperCase()
  return TEAM_ALIAS[raw] ?? raw
}

function num(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

async function getJson(url: URL) {
  const response = await fetch(url.toString(), {
    cache: 'no-store',
    headers: { Authorization: key() },
    signal: AbortSignal.timeout(20_000),
  })
  if (!response.ok) throw new Error('BALLDONTLIE_HTTP_' + response.status)
  return response.json() as Promise<any>
}

async function historicalGames(date: string) {
  const result = await supabaseAdmin
    .from('historical_baseball_games')
    .select('canonical_game_id,game_date,canonical_home_team,canonical_away_team,game_number')
    .eq('sport_key', SPORT_KEY)
    .eq('season', '2025')
    .eq('game_date', date)
  if (result.error) throw new Error('HISTORICAL_GAME_READ_FAILED:' + result.error.message)
  return (result.data ?? []) as HistoricalGame[]
}

async function bdlGames(date: string) {
  const url = new URL('https://api.balldontlie.io/mlb/v1/games')
  url.searchParams.append('dates[]', date)
  url.searchParams.set('season_type', 'regular')
  url.searchParams.set('per_page', '100')
  const payload = await getJson(url)
  return Array.isArray(payload?.data) ? payload.data as BdlGame[] : []
}

async function bdlOpening(date: string) {
  const rows: BdlOpening[] = []
  let cursor: string | null = null
  let pages = 0
  do {
    pages += 1
    if (pages > MAX_OPENING_PAGES_PER_DATE) {
      throw new Error('BDL_OPENING_PAGINATION_BOUND_EXCEEDED:' + date)
    }
    const url = new URL('https://api.balldontlie.io/mlb/v1/odds/opening')
    url.searchParams.append('dates[]', date)
    url.searchParams.set('per_page', '100')
    if (cursor) url.searchParams.set('cursor', cursor)
    const payload = await getJson(url)
    if (Array.isArray(payload?.data)) rows.push(...payload.data as BdlOpening[])
    const next = payload?.meta?.next_cursor
    cursor = next === null || next === undefined || String(next) === '' ? null : String(next)
  } while (cursor)
  return { rows, pages }
}

function marketFlags(row: BdlOpening) {
  const ml = num(row.moneyline_home_odds) !== null && num(row.moneyline_away_odds) !== null
  const rl = num(row.spread_home_value) !== null && num(row.spread_away_value) !== null &&
    num(row.spread_home_odds) !== null && num(row.spread_away_odds) !== null
  const total = num(row.total_value) !== null &&
    num(row.total_over_odds) !== null && num(row.total_under_odds) !== null
  return { ml, rl, total }
}

function canonicalMap(rows: HistoricalGame[]) {
  const map = new Map<string, HistoricalGame[]>()
  for (const row of rows) {
    const k = [row.game_date, team(row.canonical_home_team), team(row.canonical_away_team)].join('|')
    const bucket = map.get(k) ?? []
    bucket.push(row)
    map.set(k, bucket)
  }
  return map
}

export async function probeMlbMainMarketBdlOpeningCoverage() {
  if (!key()) {
    return {
      success: false,
      status: 'BLOCKED_MISSING_BALLDONTLIE_API_KEY',
      providerCallsMade: 0,
      historicalOddsApiCalls: 0,
      officialPicksModified: false,
      apostarActivated: false,
      researchOnly: true,
    }
  }

  let providerCalls = 0
  const dates: Array<Record<string, unknown>> = []

  for (const date of SAMPLE_DATES) {
    const hist = await historicalGames(date)
    const [games, opening] = await Promise.all([
      bdlGames(date).then((rows) => { providerCalls += 1; return rows }),
      bdlOpening(date).then((result) => { providerCalls += result.pages; return result }),
    ])
    if (providerCalls > MAX_PROVIDER_CALLS) throw new Error('BDL_PROVIDER_CALL_BOUND_EXCEEDED')

    const hmap = canonicalMap(hist)
    const gameById = new Map<number,BdlGame>()
    let matchedGames = 0
    let ambiguousGames = 0
    let unmatchedGames = 0

    for (const g of games) {
      const id = num(g.id)
      if (id === null) continue
      gameById.set(id, g)
      const keyValue = [date, team(g.home_team?.abbreviation), team(g.away_team?.abbreviation)].join('|')
      const candidates = hmap.get(keyValue) ?? []
      if (candidates.length === 1) matchedGames += 1
      else if (candidates.length > 1) ambiguousGames += 1
      else unmatchedGames += 1
    }

    let mappedOpeningRows = 0
    let mlRows = 0
    let rlRows = 0
    let totalRows = 0
    const vendors = new Set<string>()
    const canonicalGamesWithAny = new Set<string>()
    const canonicalGamesWithMl = new Set<string>()
    const canonicalGamesWithRl = new Set<string>()
    const canonicalGamesWithTotal = new Set<string>()

    for (const row of opening.rows) {
      const gameId = num(row.game_id)
      const g = gameId === null ? null : gameById.get(gameId)
      if (!g) continue
      const keyValue = [date, team(g.home_team?.abbreviation), team(g.away_team?.abbreviation)].join('|')
      const candidates = hmap.get(keyValue) ?? []
      if (candidates.length !== 1) continue
      const canonical = candidates[0]
      mappedOpeningRows += 1
      if (row.vendor) vendors.add(String(row.vendor).toLowerCase())
      canonicalGamesWithAny.add(canonical.canonical_game_id)
      const flags = marketFlags(row)
      if (flags.ml) { mlRows += 1; canonicalGamesWithMl.add(canonical.canonical_game_id) }
      if (flags.rl) { rlRows += 1; canonicalGamesWithRl.add(canonical.canonical_game_id) }
      if (flags.total) { totalRows += 1; canonicalGamesWithTotal.add(canonical.canonical_game_id) }
    }

    dates.push({
      date,
      historicalGames: hist.length,
      bdlGames: games.length,
      openingRows: opening.rows.length,
      openingPages: opening.pages,
      matchedGames,
      ambiguousGames,
      unmatchedGames,
      mappedOpeningRows,
      vendors: [...vendors].sort(),
      canonicalGamesWithAny: canonicalGamesWithAny.size,
      canonicalGamesWithMoneyline: canonicalGamesWithMl.size,
      canonicalGamesWithRunLine: canonicalGamesWithRl.size,
      canonicalGamesWithTotal: canonicalGamesWithTotal.size,
      moneylineRows: mlRows,
      runLineRows: rlRows,
      totalRows,
    })
  }

  const sum = (key: string) => dates.reduce((acc,row) => acc + Number(row[key] ?? 0), 0)
  const totalHistorical = sum('historicalGames')
  const overall = {
    historicalGames: totalHistorical,
    bdlGames: sum('bdlGames'),
    openingRows: sum('openingRows'),
    mappedOpeningRows: sum('mappedOpeningRows'),
    matchedGames: sum('matchedGames'),
    ambiguousGames: sum('ambiguousGames'),
    unmatchedGames: sum('unmatchedGames'),
    canonicalGamesWithAny: sum('canonicalGamesWithAny'),
    canonicalGamesWithMoneyline: sum('canonicalGamesWithMoneyline'),
    canonicalGamesWithRunLine: sum('canonicalGamesWithRunLine'),
    canonicalGamesWithTotal: sum('canonicalGamesWithTotal'),
    moneylineCoveragePct: totalHistorical ? 100 * sum('canonicalGamesWithMoneyline') / totalHistorical : null,
    runLineCoveragePct: totalHistorical ? 100 * sum('canonicalGamesWithRunLine') / totalHistorical : null,
    totalCoveragePct: totalHistorical ? 100 * sum('canonicalGamesWithTotal') / totalHistorical : null,
  }

  return {
    success: true,
    status: 'BDL_2025_OPENING_COVERAGE_PROBE_COMPLETE',
    provider: PROVIDER,
    sampleDates: SAMPLE_DATES,
    providerCallsMade: providerCalls,
    historicalOddsApiCalls: 0,
    writes: 0,
    researchOnly: true,
    productionEligible: false,
    officialPicksModified: false,
    apostarActivated: false,
    exactIdentityPolicy: 'date + canonical home team + canonical away team; ambiguous doubleheaders fail closed',
    dates,
    overall,
  }
}
