import { supabaseAdmin } from '@/lib/supabase-admin'

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

export type ResultsSyncStatus =
  | 'synced'
  | 'already_synced'
  | 'quota_blocked'
  | 'provider_error'
  | 'no_results'
  | 'partial'

const ODDS_API_BASE_URL = 'https://api.the-odds-api.com/v4'

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
