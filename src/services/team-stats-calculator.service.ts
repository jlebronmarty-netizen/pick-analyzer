import { supabaseAdmin } from '@/lib/supabase-admin'

type GameResult = {
  sport_key: string
  home_team: string
  away_team: string
  home_score: number | null
  away_score: number | null
  winner: string | null
  commence_time: string
}

type TeamAccumulator = {
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
  recent_results: {
    result: 'W' | 'L' | 'T'
    date: string
  }[]
}

type TeamStatsRow = {
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

function getSeasonFromDate(date: string) {
  return new Date(date).getFullYear()
}

function getOrCreateTeam(
  teams: Map<string, TeamAccumulator>,
  teamName: string,
  sportKey: string,
  season: number
) {
  const key = `${sportKey}:${season}:${teamName}`

  if (!teams.has(key)) {
    teams.set(key, {
      team_name: teamName,
      sport_key: sportKey,
      season,
      wins: 0,
      losses: 0,
      ties: 0,
      home_wins: 0,
      home_losses: 0,
      away_wins: 0,
      away_losses: 0,
      recent_results: [],
    })
  }

  return teams.get(key)!
}

function addRecentResult(
  team: TeamAccumulator,
  result: 'W' | 'L' | 'T',
  date: string
) {
  team.recent_results.push({
    result,
    date,
  })
}

function calculateStreak(results: TeamAccumulator['recent_results']) {
  const sorted = [...results].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  )

  if (sorted.length === 0) return 0

  const first = sorted[0].result

  if (first === 'T') return 0

  let count = 0

  for (const item of sorted) {
    if (item.result !== first) break
    count++
  }

  return first === 'W' ? count : -count
}

function countWinsLosses(
  results: TeamAccumulator['recent_results'],
  amount: number
) {
  const recent = [...results]
    .sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    )
    .slice(0, amount)

  return {
    wins: recent.filter((item) => item.result === 'W').length,
    losses: recent.filter((item) => item.result === 'L').length,
  }
}

function toStatsRow(team: TeamAccumulator): TeamStatsRow {
  const totalGames = team.wins + team.losses + team.ties

  const last5 = countWinsLosses(team.recent_results, 5)
  const last10 = countWinsLosses(team.recent_results, 10)

  return {
    team_name: team.team_name,
    sport_key: team.sport_key,
    season: team.season,
    wins: team.wins,
    losses: team.losses,
    ties: team.ties,
    home_wins: team.home_wins,
    home_losses: team.home_losses,
    away_wins: team.away_wins,
    away_losses: team.away_losses,
    last_5_wins: last5.wins,
    last_5_losses: last5.losses,
    last_10_wins: last10.wins,
    last_10_losses: last10.losses,
    streak: calculateStreak(team.recent_results),
    win_percentage:
      totalGames > 0
        ? Number((team.wins / totalGames).toFixed(4))
        : 0,
  }
}

function applyGameToTeams(
  game: GameResult,
  teams: Map<string, TeamAccumulator>
) {
  const season = getSeasonFromDate(game.commence_time)

  const home = getOrCreateTeam(
    teams,
    game.home_team,
    game.sport_key,
    season
  )

  const away = getOrCreateTeam(
    teams,
    game.away_team,
    game.sport_key,
    season
  )

  if (
    game.home_score === null ||
    game.away_score === null ||
    !game.winner
  ) {
    home.ties++
    away.ties++

    addRecentResult(home, 'T', game.commence_time)
    addRecentResult(away, 'T', game.commence_time)

    return
  }

  if (game.winner === game.home_team) {
    home.wins++
    away.losses++

    home.home_wins++
    away.away_losses++

    addRecentResult(home, 'W', game.commence_time)
    addRecentResult(away, 'L', game.commence_time)

    return
  }

  if (game.winner === game.away_team) {
    away.wins++
    home.losses++

    away.away_wins++
    home.home_losses++

    addRecentResult(away, 'W', game.commence_time)
    addRecentResult(home, 'L', game.commence_time)
  }
}

export async function recalculateTeamStatsFromResults(
  sportKey = 'baseball_mlb'
) {
  const { data, error } = await supabaseAdmin
    .from('game_results')
    .select(
      'sport_key, home_team, away_team, home_score, away_score, winner, commence_time'
    )
    .eq('sport_key', sportKey)
    .order('commence_time', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  const results = (data ?? []) as GameResult[]

  const teams = new Map<string, TeamAccumulator>()

  for (const game of results) {
    applyGameToTeams(game, teams)
  }

  const rows = [...teams.values()].map(toStatsRow)

  if (rows.length === 0) {
    return {
      success: true,
      updated: 0,
      message: 'No game results available to calculate team stats.',
    }
  }

  const { error: upsertError } = await supabaseAdmin
    .from('team_stats')
    .upsert(rows, {
      onConflict: 'team_name,sport_key,season',
    })

  if (upsertError) {
    throw new Error(upsertError.message)
  }

  return {
    success: true,
    updated: rows.length,
    sportKey,
  }
}