import { supabaseAdmin } from '@/lib/supabase-admin'
import { mapMlbStatsGameToSportEventStatus } from '@/services/mlb-event-status-mapper.service'
import { checkProviderBudget, claimProviderActionLock, releaseProviderActionLock } from '@/services/provider-budget.service'
import { zonedUtcRange, localDateInTimeZone } from '@/services/provider-time-normalization.service'

type OddsApiScore = {
  name: string
  score: string
}

type OddsApiResult = {
  id: string
  sport_key: string
  sport_title: string
  commence_time: string
  completed: boolean
  home_team: string
  away_team: string
  scores: OddsApiScore[] | null
}

type GameResultRow = {
  sport_key: string
  game_id: string
  home_team: string
  away_team: string
  home_score: number | null
  away_score: number | null
  winner: string | null
  commence_time: string
}

type SportEventRow = {
  id: string
  sport_key: string
  league_key: string | null
  start_time: string | null
  status: string | null
  home_team: string | null
  away_team: string | null
  provider_ids: Record<string, unknown> | null
  metadata: Record<string, unknown> | null
}

type MlbStatsGame = {
  gamePk?: number | string
  gameDate?: string
  officialDate?: string
  status?: {
    abstractGameState?: string
    detailedState?: string
    codedGameState?: string
    statusCode?: string
  }
  teams?: {
    away?: { team?: { name?: string; abbreviation?: string }; score?: number }
    home?: { team?: { name?: string; abbreviation?: string }; score?: number }
  }
}

export type ResultsSyncStatus =
  | 'synced'
  | 'already_synced'
  | 'quota_blocked'
  | 'provider_error'
  | 'no_results'
  | 'partial'

const ODDS_API_BASE_URL = 'https://api.the-odds-api.com/v4'
const MLB_STATS_BASE_URL = 'https://statsapi.mlb.com'
const MLB_SPORT_KEY = 'baseball_mlb'
const MLB_LEAGUE_KEY = 'mlb'
const TIMEZONE = 'America/Puerto_Rico'

const MLB_TEAM_ALIASES: Record<string, string[]> = {
  ari: ['arizona diamondbacks', 'diamondbacks', 'az'],
  atl: ['atlanta braves', 'braves'],
  bal: ['baltimore orioles', 'orioles'],
  bos: ['boston red sox', 'red sox'],
  chc: ['chicago cubs', 'cubs'],
  cws: ['chicago white sox', 'white sox', 'chw'],
  cin: ['cincinnati reds', 'reds'],
  cle: ['cleveland guardians', 'guardians'],
  col: ['colorado rockies', 'rockies'],
  det: ['detroit tigers', 'tigers'],
  hou: ['houston astros', 'astros'],
  kc: ['kansas city royals', 'royals', 'kcr'],
  laa: ['los angeles angels', 'angels', 'anaheim angels'],
  lad: ['los angeles dodgers', 'dodgers', 'la dodgers'],
  mia: ['miami marlins', 'marlins'],
  mil: ['milwaukee brewers', 'brewers'],
  min: ['minnesota twins', 'twins'],
  nym: ['new york mets', 'mets'],
  nyy: ['new york yankees', 'yankees'],
  oak: ['oakland athletics', 'athletics', 'athletics'],
  phi: ['philadelphia phillies', 'phillies'],
  pit: ['pittsburgh pirates', 'pirates'],
  sd: ['san diego padres', 'padres', 'sdp'],
  sf: ['san francisco giants', 'giants', 'sfg'],
  sea: ['seattle mariners', 'mariners'],
  stl: ['st. louis cardinals', 'st louis cardinals', 'cardinals'],
  tb: ['tampa bay rays', 'rays', 'tbr'],
  tex: ['texas rangers', 'rangers'],
  tor: ['toronto blue jays', 'blue jays'],
  wsh: ['washington nationals', 'nationals', 'was'],
}

function getScoreForTeam(scores: OddsApiScore[] | null, teamName: string) {
  const found = scores?.find((score) => score.name === teamName)
  const parsed = Number(found?.score)
  return Number.isFinite(parsed) ? parsed : null
}

function getWinner(homeTeam: string, awayTeam: string, homeScore: number | null, awayScore: number | null) {
  if (homeScore === null || awayScore === null || homeScore === awayScore) return null
  return homeScore > awayScore ? homeTeam : awayTeam
}

function normalizeResult(result: OddsApiResult): GameResultRow | null {
  if (!result.completed) return null
  const homeScore = getScoreForTeam(result.scores, result.home_team)
  const awayScore = getScoreForTeam(result.scores, result.away_team)
  if (homeScore === null || awayScore === null) return null
  return {
    sport_key: result.sport_key,
    game_id: result.id,
    home_team: result.home_team,
    away_team: result.away_team,
    home_score: homeScore,
    away_score: awayScore,
    winner: getWinner(result.home_team, result.away_team, homeScore, awayScore),
    commence_time: result.commence_time,
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function nowIso() {
  return new Date().toISOString()
}

function compactTeam(value: unknown) {
  return String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

function teamKeys(value: unknown) {
  const raw = String(value ?? '').trim()
  const compact = compactTeam(raw)
  const alias = Object.entries(MLB_TEAM_ALIASES).find(([abbr, aliases]) => {
    const values = [abbr, ...aliases].map(compactTeam)
    return values.includes(compact)
  })
  return new Set([compact, alias?.[0] ? compactTeam(alias[0]) : null, ...(alias?.[1] ?? []).map(compactTeam)].filter(Boolean) as string[])
}

function sameTeam(a: unknown, b: unknown) {
  const aKeys = teamKeys(a)
  const bKeys = teamKeys(b)
  return [...aKeys].some((key) => bKeys.has(key))
}

function providerIdValues(event: SportEventRow) {
  return new Set(Object.values(asRecord(event.provider_ids)).map((value) => String(value ?? '')).filter(Boolean))
}

function localDateFromUtc(value: string | null | undefined) {
  if (!value) return null
  return localDateInTimeZone(value, TIMEZONE)
}

function dateRangeForResults(daysFrom: number) {
  const end = new Date()
  const start = new Date(end)
  start.setUTCDate(start.getUTCDate() - Math.max(1, daysFrom))
  return {
    startDate: localDateInTimeZone(start.toISOString(), TIMEZONE) ?? start.toISOString().slice(0, 10),
    endDate: localDateInTimeZone(end.toISOString(), TIMEZONE) ?? end.toISOString().slice(0, 10),
  }
}

function canonicalMlbStatsStatus(game: MlbStatsGame) {
  const mapped = mapMlbStatsGameToSportEventStatus(game)
  return mapped.lifecycle === 'FINAL' ? 'final' : mapped.status ?? 'scheduled'
}

function isMlbStatsFinal(game: MlbStatsGame) {
  return canonicalMlbStatsStatus(game) === 'final'
}

function scoreNumber(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function getMlbWinner(homeTeam: string, awayTeam: string, homeScore: number | null, awayScore: number | null) {
  if (homeScore === null || awayScore === null || homeScore === awayScore) return null
  return homeScore > awayScore ? homeTeam : awayTeam
}

function gameTeamNames(game: MlbStatsGame) {
  return {
    home: game.teams?.home?.team?.abbreviation ?? game.teams?.home?.team?.name ?? '',
    away: game.teams?.away?.team?.abbreviation ?? game.teams?.away?.team?.name ?? '',
  }
}

function matchMlbStatsGameToEvent(game: MlbStatsGame, events: SportEventRow[]) {
  const gamePk = String(game.gamePk ?? '')
  if (gamePk) {
    const byId = events.find((event) => providerIdValues(event).has(gamePk))
    if (byId) return byId
  }

  const gameDate = localDateFromUtc(game.gameDate) ?? game.officialDate ?? null
  const teams = gameTeamNames(game)
  return events.find((event) => {
    if (gameDate && localDateFromUtc(event.start_time) !== gameDate) return false
    return sameTeam(event.home_team, teams.home) && sameTeam(event.away_team, teams.away)
  }) ?? null
}

async function loadMlbEventsForRange(startDate: string, endDate: string) {
  const startRange = zonedUtcRange(startDate, TIMEZONE)
  const endRange = zonedUtcRange(endDate, TIMEZONE)
  const { data, error } = await supabaseAdmin
    .from('sport_events')
    .select('id, sport_key, league_key, start_time, status, home_team, away_team, provider_ids, metadata')
    .eq('sport_key', MLB_SPORT_KEY)
    .eq('league_key', MLB_LEAGUE_KEY)
    .gte('start_time', startRange.utcStart)
    .lt('start_time', endRange.utcEndExclusive)
    .order('start_time', { ascending: true })
  if (error) throw new Error(`MLB Stats API result event lookup failed: ${error.message}`)
  return (data ?? []) as SportEventRow[]
}

function providerMessage(payload: unknown) {
  const record = asRecord(payload)
  return String(record.message ?? record.error ?? record.detail ?? '')
}

function isQuotaPayload(response: Response, payload: unknown) {
  const message = providerMessage(payload).toLowerCase()
  return response.status === 429 || message.includes('quota') || message.includes('usage limit') || message.includes('usage quota')
}

async function readProviderPayload(response: Response) {
  const text = await response.text()
  if (!text) return null
  try {
    return JSON.parse(text) as unknown
  } catch {
    return { message: text }
  }
}

async function existingResultIds(rows: GameResultRow[]) {
  if (!rows.length) return new Set<string>()
  const { data, error } = await supabaseAdmin
    .from('game_results')
    .select('game_id')
    .in('game_id', rows.map((row) => row.game_id))
  if (error) throw new Error(`Existing result lookup failed: ${error.message}`)
  return new Set((data ?? []).map((row) => String(row.game_id)))
}

async function existingResultRows(rows: GameResultRow[]) {
  if (!rows.length) return new Map<string, GameResultRow>()
  const { data, error } = await supabaseAdmin
    .from('game_results')
    .select('game_id, sport_key, home_team, away_team, home_score, away_score, winner, commence_time')
    .in('game_id', rows.map((row) => row.game_id))
  if (error) throw new Error(`Existing result lookup failed: ${error.message}`)
  return new Map(((data ?? []) as GameResultRow[]).map((row) => [`${row.sport_key}:${row.game_id}`, row]))
}

function sameResultRow(a: GameResultRow, b: GameResultRow | undefined) {
  if (!b) return false
  return (
    a.home_team === b.home_team &&
    a.away_team === b.away_team &&
    a.home_score === b.home_score &&
    a.away_score === b.away_score &&
    a.winner === b.winner &&
    a.commence_time === b.commence_time
  )
}

async function fetchMlbStatsResults(daysFrom = 3, timeoutMs = 12000) {
  const { startDate, endDate } = dateRangeForResults(daysFrom)
  const endpoint = `/api/v1/schedule?sportId=1&startDate=${startDate}&endDate=${endDate}&hydrate=team,venue`
  const provider = 'mlb_stats_api'
  const started = nowIso()
  const budget = await checkProviderBudget({
    provider,
    sportKey: MLB_SPORT_KEY,
    action: 'sync_results',
    requestedCalls: 1,
    dryRun: false,
  })
  if (!budget.allowed) {
    return {
      success: false,
      status: 'quota_blocked' as const,
      retryable: true,
      provider,
      endpoint,
      providerCheckRequired: true,
      providerCheckAttempted: false,
      providerCheckCompleted: false,
      providerCallsMade: 0,
      rows: [] as GameResultRow[],
      rowsReceived: 0,
      gamesMatched: 0,
      finalGamesDetected: 0,
      scoreRowsInserted: 0,
      scoreRowsUpdated: 0,
      nonFinalRowsSkipped: 0,
      staleRowsSkipped: 0,
      unmatchedEvents: 0,
      message: budget.blockedReason ?? 'Provider budget blocked MLB Stats API result sync.',
    }
  }

  const lockKey = `${provider}:${MLB_SPORT_KEY}:${startDate}:${endDate}:sync_results`
  if (!claimProviderActionLock(lockKey)) {
    return {
      success: false,
      status: 'provider_error' as const,
      retryable: true,
      provider,
      endpoint,
      providerCheckRequired: true,
      providerCheckAttempted: false,
      providerCheckCompleted: false,
      providerCallsMade: 0,
      rows: [] as GameResultRow[],
      rowsReceived: 0,
      gamesMatched: 0,
      finalGamesDetected: 0,
      scoreRowsInserted: 0,
      scoreRowsUpdated: 0,
      nonFinalRowsSkipped: 0,
      staleRowsSkipped: 0,
      unmatchedEvents: 0,
      message: 'A matching MLB Stats API results sync is already running.',
    }
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), Math.max(2000, timeoutMs))
    const response = await fetch(`${MLB_STATS_BASE_URL}${endpoint}`, { cache: 'no-store', signal: controller.signal })
    clearTimeout(timeout)
    const payload = await readProviderPayload(response)

    if (!response.ok) {
      return {
        success: false,
        status: response.status === 429 ? ('quota_blocked' as const) : ('provider_error' as const),
        retryable: response.status === 429 || response.status >= 500,
        provider,
        endpoint,
        providerCheckRequired: true,
        providerCheckAttempted: true,
        providerCheckCompleted: false,
        providerCallsMade: 1,
        rows: [] as GameResultRow[],
        rowsReceived: 0,
        gamesMatched: 0,
        finalGamesDetected: 0,
        scoreRowsInserted: 0,
        scoreRowsUpdated: 0,
        nonFinalRowsSkipped: 0,
        staleRowsSkipped: 0,
        unmatchedEvents: 0,
        message: providerMessage(payload) || `MLB Stats API returned HTTP ${response.status}.`,
      }
    }

    const games = (Array.isArray(asRecord(payload).dates)
      ? (asRecord(payload).dates as Array<Record<string, unknown>>).flatMap((day) => Array.isArray(day.games) ? day.games : [])
      : []) as MlbStatsGame[]
    const events = await loadMlbEventsForRange(startDate, endDate)
    const rows: GameResultRow[] = []
    let gamesMatched = 0
    let nonFinalRowsSkipped = 0
    let staleRowsSkipped = 0
    let unmatchedEvents = 0
    const eventPatches: Array<{ id: string; patch: Record<string, unknown> }> = []

    for (const game of games) {
      const event = matchMlbStatsGameToEvent(game, events)
      if (!event) {
        unmatchedEvents += 1
        if (!isMlbStatsFinal(game)) nonFinalRowsSkipped += 1
        continue
      }
      gamesMatched += 1
      if (!isMlbStatsFinal(game)) {
        nonFinalRowsSkipped += 1
        continue
      }
      const metadata = asRecord(event.metadata)
      const previous = asRecord(metadata.mlbStatsResult)
      const previousFetchedAt = String(previous.fetchedAt ?? '')
      if (previousFetchedAt && previousFetchedAt > started) {
        staleRowsSkipped += 1
        continue
      }
      const teams = gameTeamNames(game)
      const homeScore = scoreNumber(game.teams?.home?.score)
      const awayScore = scoreNumber(game.teams?.away?.score)
      if (homeScore === null || awayScore === null) {
        nonFinalRowsSkipped += 1
        continue
      }
      const commenceTime = game.gameDate ?? event.start_time ?? started
      rows.push({
        sport_key: MLB_SPORT_KEY,
        game_id: event.id,
        home_team: event.home_team ?? teams.home,
        away_team: event.away_team ?? teams.away,
        home_score: homeScore,
        away_score: awayScore,
        winner: getMlbWinner(event.home_team ?? teams.home, event.away_team ?? teams.away, homeScore, awayScore),
        commence_time: commenceTime,
      })
      eventPatches.push({
        id: event.id,
        patch: {
          status: 'completed',
          home_score: homeScore,
          away_score: awayScore,
          updated_at: started,
          provider_ids: {
            ...asRecord(event.provider_ids),
            mlb_stats_api: game.gamePk ?? null,
            mlb_stats_game_pk: game.gamePk ?? null,
          },
          metadata: {
            ...metadata,
            mlbStatsResult: {
              provider,
              endpoint,
              gamePk: game.gamePk ?? null,
              mappedSportEventStatus: 'completed',
              detailedState: game.status?.detailedState ?? null,
              abstractGameState: game.status?.abstractGameState ?? null,
              latestSourceTimestamp: game.gameDate ?? null,
              fetchedAt: started,
            },
          },
        },
      })
    }

    const existing = await existingResultRows(rows)
    let scoreRowsInserted = 0
    let scoreRowsUpdated = 0
    for (const row of rows) {
      const existingRow = existing.get(`${row.sport_key}:${row.game_id}`)
      if (!existingRow) scoreRowsInserted += 1
      else if (!sameResultRow(row, existingRow)) scoreRowsUpdated += 1
    }

    return {
      success: true,
      status: rows.length ? ('synced' as const) : ('no_results' as const),
      retryable: false,
      provider,
      endpoint,
      providerCheckRequired: true,
      providerCheckAttempted: true,
      providerCheckCompleted: true,
      providerCallsMade: 1,
      rows,
      eventPatches,
      rowsReceived: games.length,
      gamesMatched,
      finalGamesDetected: rows.length,
      scoreRowsInserted,
      scoreRowsUpdated,
      nonFinalRowsSkipped,
      staleRowsSkipped,
      unmatchedEvents,
      message: rows.length ? 'MLB Stats API final results were returned.' : 'MLB Stats API returned no final games with scores for the requested window.',
    }
  } catch (error) {
    return {
      success: false,
      status: error instanceof Error && error.name === 'AbortError' ? ('provider_error' as const) : ('provider_error' as const),
      retryable: true,
      provider,
      endpoint,
      providerCheckRequired: true,
      providerCheckAttempted: true,
      providerCheckCompleted: false,
      providerCallsMade: 1,
      rows: [] as GameResultRow[],
      rowsReceived: 0,
      gamesMatched: 0,
      finalGamesDetected: 0,
      scoreRowsInserted: 0,
      scoreRowsUpdated: 0,
      nonFinalRowsSkipped: 0,
      staleRowsSkipped: 0,
      unmatchedEvents: 0,
      message: error instanceof Error ? error.message : String(error),
    }
  } finally {
    releaseProviderActionLock(lockKey)
  }
}

export async function fetchCompletedResults(sportKey: string, daysFrom = 3) {
  const apiKey = process.env.ODDS_API_KEY
  if (!apiKey) throw new Error('Missing ODDS_API_KEY')

  const url = new URL(`${ODDS_API_BASE_URL}/sports/${sportKey}/scores/`)
  url.searchParams.set('apiKey', apiKey)
  url.searchParams.set('daysFrom', String(daysFrom))

  const response = await fetch(url.toString(), { cache: 'no-store' })
  const payload = await readProviderPayload(response)
  const providerResult = {
    provider: 'the_odds_api',
    providerCallsMade: 1,
    retryAfter: response.headers.get('retry-after'),
    remainingRequests: response.headers.get('x-requests-remaining'),
  }

  if (isQuotaPayload(response, payload)) {
    return {
      ...providerResult,
      status: 'quota_blocked' as const,
      retryable: true,
      rows: [] as GameResultRow[],
      gamesRequested: 0,
      gamesResolved: 0,
      gamesUnresolved: 0,
      message: providerMessage(payload) || 'Provider quota blocked the results sync.',
    }
  }

  if (!response.ok) {
    return {
      ...providerResult,
      status: 'provider_error' as const,
      retryable: response.status >= 500,
      rows: [] as GameResultRow[],
      gamesRequested: 0,
      gamesResolved: 0,
      gamesUnresolved: 0,
      message: providerMessage(payload) || `Provider returned HTTP ${response.status}.`,
    }
  }

  if (!Array.isArray(payload)) {
    return {
      ...providerResult,
      status: 'provider_error' as const,
      retryable: false,
      rows: [] as GameResultRow[],
      gamesRequested: 0,
      gamesResolved: 0,
      gamesUnresolved: 0,
      message: 'Provider returned a non-array scores payload.',
    }
  }

  const rows = (payload as OddsApiResult[]).map(normalizeResult).filter(Boolean) as GameResultRow[]
  return {
    ...providerResult,
    status: rows.length ? ('synced' as const) : ('no_results' as const),
    retryable: false,
    rows,
    gamesRequested: payload.length,
    gamesResolved: rows.length,
    gamesUnresolved: Math.max(0, payload.length - rows.length),
    message: rows.length ? 'Completed scores were returned by the provider.' : 'No completed games with scores found.',
  }
}

export async function syncRecentResults(sportKey = 'baseball_mlb', daysFrom = 3) {
  if (sportKey === MLB_SPORT_KEY) {
    const fetched = await fetchMlbStatsResults(daysFrom)
    if (!fetched.success) {
      return {
        success: false,
        sportKey,
        daysFrom,
        status: fetched.status as ResultsSyncStatus,
        provider: fetched.provider,
        endpoint: fetched.endpoint,
        providerCheckRequired: fetched.providerCheckRequired,
        providerCheckAttempted: fetched.providerCheckAttempted,
        providerCheckCompleted: fetched.providerCheckCompleted,
        providerCallsMade: fetched.providerCallsMade,
        rowsReceived: fetched.rowsReceived,
        gamesRequested: fetched.rowsReceived,
        gamesResolved: fetched.finalGamesDetected,
        gamesUnresolved: Math.max(0, fetched.rowsReceived - fetched.finalGamesDetected),
        gamesMatched: fetched.gamesMatched,
        finalGamesDetected: fetched.finalGamesDetected,
        scoreRowsInserted: fetched.scoreRowsInserted,
        scoreRowsUpdated: fetched.scoreRowsUpdated,
        nonFinalRowsSkipped: fetched.nonFinalRowsSkipped,
        staleRowsSkipped: fetched.staleRowsSkipped,
        unmatchedEvents: fetched.unmatchedEvents,
        synced: 0,
        inserted: 0,
        reused: 0,
        retryable: fetched.retryable,
        retryAfter: null,
        failureReason: fetched.message,
        message: fetched.message,
      }
    }

    if (fetched.rows.length) {
      const { error } = await supabaseAdmin.from('game_results').upsert(fetched.rows, {
        onConflict: 'game_id,sport_key',
      })
      if (error) throw new Error(error.message)
    }
    for (const eventPatch of fetched.eventPatches ?? []) {
      const { error } = await supabaseAdmin.from('sport_events').update(eventPatch.patch).eq('id', eventPatch.id)
      if (error) throw new Error(`MLB Stats API final event update failed: ${error.message}`)
    }

    return {
      success: true,
      sportKey,
      daysFrom,
      status: fetched.status as ResultsSyncStatus,
      provider: fetched.provider,
      endpoint: fetched.endpoint,
      providerCheckRequired: fetched.providerCheckRequired,
      providerCheckAttempted: fetched.providerCheckAttempted,
      providerCheckCompleted: fetched.providerCheckCompleted,
      providerCallsMade: fetched.providerCallsMade,
      rowsReceived: fetched.rowsReceived,
      gamesRequested: fetched.rowsReceived,
      gamesResolved: fetched.finalGamesDetected,
      gamesUnresolved: Math.max(0, fetched.rowsReceived - fetched.finalGamesDetected),
      gamesMatched: fetched.gamesMatched,
      finalGamesDetected: fetched.finalGamesDetected,
      scoreRowsInserted: fetched.scoreRowsInserted,
      scoreRowsUpdated: fetched.scoreRowsUpdated,
      nonFinalRowsSkipped: fetched.nonFinalRowsSkipped,
      staleRowsSkipped: fetched.staleRowsSkipped,
      unmatchedEvents: fetched.unmatchedEvents,
      synced: fetched.rows.length,
      inserted: fetched.scoreRowsInserted,
      reused: Math.max(0, fetched.rows.length - fetched.scoreRowsInserted - fetched.scoreRowsUpdated),
      retryable: false,
      retryAfter: null,
      failureReason: null,
      message: fetched.message,
    }
  }

  const fetched = await fetchCompletedResults(sportKey, daysFrom)
  if (fetched.status !== 'synced') {
    return {
      success: false,
      sportKey,
      daysFrom,
      status: fetched.status as ResultsSyncStatus,
      provider: fetched.provider,
      providerCallsMade: fetched.providerCallsMade,
      gamesRequested: fetched.gamesRequested,
      gamesResolved: fetched.gamesResolved,
      gamesUnresolved: fetched.gamesUnresolved,
      synced: 0,
      inserted: 0,
      reused: 0,
      retryable: fetched.retryable,
      retryAfter: fetched.retryAfter,
      message: fetched.message,
    }
  }

  const existing = await existingResultIds(fetched.rows)
  const { error } = await supabaseAdmin.from('game_results').upsert(fetched.rows, {
    onConflict: 'game_id,sport_key',
  })
  if (error) throw new Error(error.message)

  const inserted = fetched.rows.filter((row) => !existing.has(row.game_id)).length
  return {
    success: true,
    sportKey,
    daysFrom,
    status: inserted === 0 ? ('already_synced' as const) : ('synced' as const),
    provider: fetched.provider,
    providerCallsMade: fetched.providerCallsMade,
    gamesRequested: fetched.gamesRequested,
    gamesResolved: fetched.gamesResolved,
    gamesUnresolved: fetched.gamesUnresolved,
    retryable: false,
    retryAfter: null,
    synced: fetched.rows.length,
    inserted,
    reused: fetched.rows.length - inserted,
    message: inserted === 0 ? 'Completed results were already synchronized.' : 'Completed results synchronized.',
  }
}
