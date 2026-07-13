import { supabaseAdmin } from '@/lib/supabase-admin'

const NBA_SPORT_KEY = 'basketball_nba'

type GenericRow = Record<string, unknown>

type NbaTeamProfile = {
  teamName: string
  season: number
  gamesPlayed: number
  wins: number
  losses: number
  winPercentage: number
  homeWinPercentage: number
  awayWinPercentage: number
  recentWinPercentage: number
  offensiveRating: number
  defensiveRating: number
  netRating: number
  pace: number
  pointsPerGame: number
  opponentPointsPerGame: number
  restDays: number
  rating: number
  dataCompleteness: number
}

function round(value: number) {
  return Number(value.toFixed(2))
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function numberValue(
  row: GenericRow,
  keys: string[],
  fallback = 0
) {
  for (const key of keys) {
    const value = Number(row[key])

    if (Number.isFinite(value)) {
      return value
    }
  }

  return fallback
}

function stringValue(
  row: GenericRow,
  keys: string[],
  fallback = ''
) {
  for (const key of keys) {
    const value = row[key]

    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }

  return fallback
}

function percentage(
  wins: number,
  losses: number,
  fallback = 0.5
) {
  const games = wins + losses

  if (games <= 0) return fallback

  return wins / games
}

function normalizePercentage(value: number) {
  if (!Number.isFinite(value)) return 0.5
  return value > 1 ? value / 100 : value
}

function calculateDataCompleteness(row: GenericRow) {
  const fields = [
    ['wins'],
    ['losses'],
    ['points_per_game', 'ppg'],
    ['opponent_points_per_game', 'opp_points_per_game', 'opp_ppg'],
    ['offensive_rating', 'off_rating', 'ortg'],
    ['defensive_rating', 'def_rating', 'drtg'],
    ['pace', 'pace_rating'],
    ['home_wins'],
    ['home_losses'],
    ['away_wins'],
    ['away_losses'],
    ['last_10_wins'],
    ['last_10_losses'],
  ]

  const completed = fields.filter((keys) =>
    keys.some((key) => {
      const value = row[key]
      return value !== null && value !== undefined && value !== ''
    })
  ).length

  return round((completed / fields.length) * 100)
}

function calculateNbaRating(profile: {
  winPercentage: number
  homeWinPercentage: number
  awayWinPercentage: number
  recentWinPercentage: number
  offensiveRating: number
  defensiveRating: number
  netRating: number
  pace: number
  pointsPerGame: number
  opponentPointsPerGame: number
}) {
  const normalizedOffense = clamp(
    50 + (profile.offensiveRating - 112) * 2.5,
    1,
    99
  )

  const normalizedDefense = clamp(
    50 + (112 - profile.defensiveRating) * 2.5,
    1,
    99
  )

  const normalizedNet = clamp(
    50 + profile.netRating * 3,
    1,
    99
  )

  const scoringMargin =
    profile.pointsPerGame -
    profile.opponentPointsPerGame

  const normalizedMargin = clamp(
    50 + scoringMargin * 3,
    1,
    99
  )

  const normalizedPace = clamp(
    50 + (profile.pace - 99) * 2,
    25,
    75
  )

  return round(
    clamp(
      profile.winPercentage * 100 * 0.25 +
        profile.recentWinPercentage * 100 * 0.18 +
        normalizedOffense * 0.16 +
        normalizedDefense * 0.16 +
        normalizedNet * 0.12 +
        normalizedMargin * 0.08 +
        normalizedPace * 0.02 +
        profile.homeWinPercentage * 100 * 0.015 +
        profile.awayWinPercentage * 100 * 0.015,
      1,
      99
    )
  )
}

function normalizeTeamProfile(row: GenericRow): NbaTeamProfile {
  const wins = numberValue(row, ['wins'])
  const losses = numberValue(row, ['losses'])

  const homeWins = numberValue(row, ['home_wins'])
  const homeLosses = numberValue(row, ['home_losses'])

  const awayWins = numberValue(row, ['away_wins'])
  const awayLosses = numberValue(row, ['away_losses'])

  const last10Wins = numberValue(row, [
    'last_10_wins',
    'last10_wins',
  ])

  const last10Losses = numberValue(row, [
    'last_10_losses',
    'last10_losses',
  ])

  const storedWinPercentage = numberValue(row, [
    'win_percentage',
    'win_pct',
  ])

  const winPercentage =
    wins + losses > 0
      ? percentage(wins, losses)
      : normalizePercentage(storedWinPercentage)

  const offensiveRating = numberValue(
    row,
    ['offensive_rating', 'off_rating', 'ortg'],
    112
  )

  const defensiveRating = numberValue(
    row,
    ['defensive_rating', 'def_rating', 'drtg'],
    112
  )

  const pointsPerGame = numberValue(
    row,
    ['points_per_game', 'ppg'],
    offensiveRating
  )

  const opponentPointsPerGame = numberValue(
    row,
    [
      'opponent_points_per_game',
      'opp_points_per_game',
      'opp_ppg',
    ],
    defensiveRating
  )

  const storedNetRating = numberValue(
    row,
    ['net_rating', 'net_rtg'],
    offensiveRating - defensiveRating
  )

  const baseProfile = {
    winPercentage,
    homeWinPercentage: percentage(
      homeWins,
      homeLosses,
      winPercentage
    ),
    awayWinPercentage: percentage(
      awayWins,
      awayLosses,
      winPercentage
    ),
    recentWinPercentage: percentage(
      last10Wins,
      last10Losses,
      winPercentage
    ),
    offensiveRating,
    defensiveRating,
    netRating: storedNetRating,
    pace: numberValue(
      row,
      ['pace', 'pace_rating'],
      99
    ),
    pointsPerGame,
    opponentPointsPerGame,
  }

  return {
    teamName: stringValue(
      row,
      ['team_name', 'team'],
      'Unknown Team'
    ),
    season: numberValue(
      row,
      ['season'],
      new Date().getFullYear()
    ),
    gamesPlayed: wins + losses,
    wins,
    losses,
    ...baseProfile,
    restDays: numberValue(
      row,
      ['rest_days', 'days_rest'],
      1
    ),
    rating: calculateNbaRating(baseProfile),
    dataCompleteness: calculateDataCompleteness(row),
  }
}

function getReadinessStatus({
  teams,
  pendingPredictions,
  settledPredictions,
  averageCompleteness,
}: {
  teams: number
  pendingPredictions: number
  settledPredictions: number
  averageCompleteness: number
}) {
  if (
    teams >= 28 &&
    averageCompleteness >= 75 &&
    pendingPredictions > 0 &&
    settledPredictions >= 100
  ) {
    return 'PRODUCTION_READY'
  }

  if (
    teams >= 20 &&
    averageCompleteness >= 55 &&
    pendingPredictions > 0
  ) {
    return 'PARTIALLY_READY'
  }

  if (teams > 0 || pendingPredictions > 0) {
    return 'DATA_INCOMPLETE'
  }

  return 'NO_DATA'
}

function buildRequirements({
  teams,
  pendingPredictions,
  settledPredictions,
  averageCompleteness,
}: {
  teams: number
  pendingPredictions: number
  settledPredictions: number
  averageCompleteness: number
}) {
  return [
    {
      key: 'team_coverage',
      label: 'NBA team coverage',
      completed: teams >= 28,
      current: teams,
      target: 28,
      message:
        teams >= 28
          ? 'NBA team coverage is sufficient.'
          : `${Math.max(28 - teams, 0)} additional team profiles are needed.`,
    },
    {
      key: 'stat_completeness',
      label: 'Advanced stat completeness',
      completed: averageCompleteness >= 75,
      current: round(averageCompleteness),
      target: 75,
      message:
        averageCompleteness >= 75
          ? 'Advanced NBA statistics are sufficiently complete.'
          : 'Add offensive rating, defensive rating, pace and split statistics.',
    },
    {
      key: 'upcoming_predictions',
      label: 'Upcoming NBA predictions',
      completed: pendingPredictions > 0,
      current: pendingPredictions,
      target: 1,
      message:
        pendingPredictions > 0
          ? 'Upcoming NBA predictions are available.'
          : 'NBA odds synchronization and prediction capture are still required.',
    },
    {
      key: 'learning_sample',
      label: 'Settled learning sample',
      completed: settledPredictions >= 100,
      current: settledPredictions,
      target: 100,
      message:
        settledPredictions >= 100
          ? 'Learning sample is large enough for initial adaptation.'
          : `${Math.max(
              100 - settledPredictions,
              0
            )} additional settled predictions are recommended.`,
    },
  ]
}

export async function getNbaAdapterStatus() {
  const currentSeason = new Date().getFullYear()

  const [
    { data: teamData, error: teamError },
    { data: predictionData, error: predictionError },
  ] = await Promise.all([
    supabaseAdmin
      .from('team_stats')
      .select('*')
      .eq('sport_key', NBA_SPORT_KEY)
      .eq('season', currentSeason)
      .limit(100),

    supabaseAdmin
      .from('prediction_history')
      .select(
        'id, sport_key, game_id, commence_time, team, opponent, odds, confidence, edge, ev, recommended_pick, status, result, created_at'
      )
      .eq('sport_key', NBA_SPORT_KEY)
      .order('created_at', { ascending: false })
      .limit(5000),
  ])

  if (teamError) {
    throw new Error(teamError.message)
  }

  if (predictionError) {
    throw new Error(predictionError.message)
  }

  const teams = ((teamData ?? []) as GenericRow[])
    .map(normalizeTeamProfile)
    .filter((team) => team.teamName !== 'Unknown Team')
    .sort((a, b) => b.rating - a.rating)

  const predictions = (predictionData ?? []) as GenericRow[]

  const pendingPredictions = predictions.filter((row) => {
    const status = stringValue(row, ['status']).toLowerCase()
    const result = stringValue(row, ['result']).toLowerCase()

    return (
      (!status || status === 'pending') &&
      !['win', 'loss', 'push'].includes(result)
    )
  })

  const settledPredictions = predictions.filter((row) => {
    const result = stringValue(row, ['result']).toLowerCase()

    return ['win', 'loss', 'push'].includes(result)
  })

  const recommendedPending = pendingPredictions.filter(
    (row) => row.recommended_pick === true
  )

  const averageCompleteness =
    teams.length > 0
      ? teams.reduce(
          (sum, team) => sum + team.dataCompleteness,
          0
        ) / teams.length
      : 0

  const readiness = getReadinessStatus({
    teams: teams.length,
    pendingPredictions: pendingPredictions.length,
    settledPredictions: settledPredictions.length,
    averageCompleteness,
  })

  const requirements = buildRequirements({
    teams: teams.length,
    pendingPredictions: pendingPredictions.length,
    settledPredictions: settledPredictions.length,
    averageCompleteness,
  })

  return {
    success: true,
    generatedAt: new Date().toISOString(),
    sportKey: NBA_SPORT_KEY,
    mode: 'nba_adapter_v1',

    readiness: {
      status: readiness,
      score: round(
        requirements.reduce(
          (sum, item) =>
            sum +
            clamp(
              (Number(item.current) /
                Math.max(Number(item.target), 1)) *
                25,
              0,
              25
            ),
          0
        )
      ),
      completedRequirements: requirements.filter(
        (item) => item.completed
      ).length,
      totalRequirements: requirements.length,
    },

    summary: {
      teamsLoaded: teams.length,
      averageDataCompleteness: round(
        averageCompleteness
      ),
      pendingPredictions: pendingPredictions.length,
      recommendedPending: recommendedPending.length,
      settledPredictions: settledPredictions.length,
      topRatedTeam: teams[0] ?? null,
      averageTeamRating: round(
        teams.reduce(
          (sum, team) => sum + team.rating,
          0
        ) / Math.max(teams.length, 1)
      ),
    },

    requirements,
    teamRankings: teams,
  }
}