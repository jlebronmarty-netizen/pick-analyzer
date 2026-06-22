import { supabase } from '@/lib/supabase'

type ApiSportsTeamStanding = {
  team?: {
    id?: number
    name?: string
  }
  league?: {
    id?: number
    name?: string
  }
  games?: {
    played?: {
      total?: number
    }
    win?: {
      total?: number
      percentage?: string
    }
    lose?: {
      total?: number
    }
  }
  form?: string
  streak?: string
}

type TeamStatsUpsert = {
  team_name: string
  sport_key: string
  season: number
  wins: number
  losses: number
  ties: number
  home_wins: number
  home_losses: number
  away_wins: number
  away_losses: number
  last_5_wins: number
  last_5_losses: number
  last_10_wins: number
  last_10_losses: number
  streak: number
  win_percentage: number
}

const API_SPORTS_BASE_URL = 'https://v1.baseball.api-sports.io'

function parseWinPercentage(value?: string): number {
  if (!value) return 0

  const parsed = Number(value)

  if (!Number.isFinite(parsed)) return 0

  return parsed > 1 ? parsed / 100 : parsed
}

function parseRecentForm(form?: string) {
  const cleanForm = form?.replaceAll('-', '').trim().toUpperCase() ?? ''

  const last5 = cleanForm.slice(-5)
  const last10 = cleanForm.slice(-10)

  return {
    last_5_wins: [...last5].filter((result) => result === 'W').length,
    last_5_losses: [...last5].filter((result) => result === 'L').length,
    last_10_wins: [...last10].filter((result) => result === 'W').length,
    last_10_losses: [...last10].filter((result) => result === 'L').length,
  }
}

function parseStreak(streak?: string): number {
  if (!streak) return 0

  const normalized = streak.trim().toUpperCase()
  const amount = Number(normalized.replace(/\D/g, ''))

  if (!Number.isFinite(amount)) return 0

  if (normalized.includes('L')) return -amount
  if (normalized.includes('W')) return amount

  return 0
}

function normalizeStanding(
  standing: ApiSportsTeamStanding,
  season: number
): TeamStatsUpsert | null {
  const teamName = standing.team?.name

  if (!teamName) return null

  const wins = standing.games?.win?.total ?? 0
  const losses = standing.games?.lose?.total ?? 0
  const recent = parseRecentForm(standing.form)

  return {
    team_name: teamName,
    sport_key: 'baseball_mlb',
    season,
    wins,
    losses,
    ties: 0,
    home_wins: 0,
    home_losses: 0,
    away_wins: 0,
    away_losses: 0,
    last_5_wins: recent.last_5_wins,
    last_5_losses: recent.last_5_losses,
    last_10_wins: recent.last_10_wins,
    last_10_losses: recent.last_10_losses,
    streak: parseStreak(standing.streak),
    win_percentage: parseWinPercentage(
      standing.games?.win?.percentage
    ),
  }
}

export async function syncMlbTeamStats(season: number) {
  const apiKey = process.env.API_SPORTS_KEY

  if (!apiKey) {
    throw new Error('Missing API_SPORTS_KEY')
  }

  const url = new URL(`${API_SPORTS_BASE_URL}/standings`)
  url.searchParams.set('league', '1')
  url.searchParams.set('season', String(season))

  const response = await fetch(url.toString(), {
    headers: {
      'x-apisports-key': apiKey,
    },
    cache: 'no-store',
  })

  if (!response.ok) {
    const details = await response.text()
    throw new Error(`API Sports error: ${details}`)
  }

  const payload = await response.json()

  const standingsRaw = payload.response ?? []

  const flattenedStandings: ApiSportsTeamStanding[] =
    standingsRaw.flat(Infinity)

  const rows = flattenedStandings
    .map((standing) => normalizeStanding(standing, season))
    .filter(Boolean) as TeamStatsUpsert[]

  if (rows.length === 0) {
    return {
      success: false,
      inserted: 0,
      message: 'No MLB standings returned from API Sports',
    }
  }

  const { error } = await supabase
    .from('team_stats')
    .upsert(rows, {
      onConflict: 'team_name,sport_key,season',
    })

  if (error) {
    throw new Error(error.message)
  }

  return {
    success: true,
    inserted: rows.length,
    season,
    teams: rows.map((row) => row.team_name),
  }
}