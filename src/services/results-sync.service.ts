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

const ODDS_API_BASE_URL = 'https://api.the-odds-api.com/v4'

function getScoreForTeam(scores: OddsApiScore[] | null, teamName: string) {
  if (!scores) return null

  const found = scores.find((score) => score.name === teamName)

  if (!found) return null

  const parsed = Number(found.score)

  return Number.isFinite(parsed) ? parsed : null
}

function getWinner(
  homeTeam: string,
  awayTeam: string,
  homeScore: number | null,
  awayScore: number | null
) {
  if (homeScore === null || awayScore === null) return null
  if (homeScore === awayScore) return null

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
    winner: getWinner(
      result.home_team,
      result.away_team,
      homeScore,
      awayScore
    ),
    commence_time: result.commence_time,
  }
}

export async function fetchCompletedResults(
  sportKey: string,
  daysFrom = 3
) {
  const apiKey = process.env.ODDS_API_KEY

  if (!apiKey) {
    throw new Error('Missing ODDS_API_KEY')
  }

  const url = new URL(`${ODDS_API_BASE_URL}/sports/${sportKey}/scores/`)
  url.searchParams.set('apiKey', apiKey)
  url.searchParams.set('daysFrom', String(daysFrom))

  const response = await fetch(url.toString(), {
    cache: 'no-store',
  })

  if (!response.ok) {
    const details = await response.text()
    throw new Error(`Odds API scores error for ${sportKey}: ${details}`)
  }

  const payload = (await response.json()) as OddsApiResult[]

  return payload
    .map(normalizeResult)
    .filter(Boolean) as GameResultRow[]
}

export async function syncRecentResults(
  sportKey = 'baseball_mlb',
  daysFrom = 3
) {
  const rows = await fetchCompletedResults(sportKey, daysFrom)

  if (rows.length === 0) {
    return {
      success: true,
      synced: 0,
      sportKey,
      daysFrom,
      message: 'No completed games with scores found.',
    }
  }

  const { error } = await supabaseAdmin.from('game_results').upsert(rows, {
    onConflict: 'game_id,sport_key',
  })

  if (error) {
    throw new Error(error.message)
  }

  return {
    success: true,
    synced: rows.length,
    sportKey,
    daysFrom,
  }
}