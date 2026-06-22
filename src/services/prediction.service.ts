import { supabase } from '@/lib/supabase'
import { calculateTeamRating } from '@/utils/team-rating'
import {
  calculatePredictionV2,
  PredictionResult,
  TeamStatsInput,
} from '@/utils/prediction-engine-v2'
import { savePredictionHistory } from '@/services/prediction-history.service'

type OddsOutcome = {
  name: string
  price: number
}

type OddsMarket = {
  key: string
  outcomes: OddsOutcome[]
}

type OddsBookmaker = {
  key: string
  title: string
  markets: OddsMarket[]
}

type GameWithOdds = {
  id: string
  sport_key: string
  sport_title: string
  commence_time: string
  home_team: string
  away_team: string
  bookmakers?: OddsBookmaker[]
}

function normalizeTeamName(name: string): string {
  return name.trim().toLowerCase()
}

async function getTeamStats(sportKey: string): Promise<TeamStatsInput[]> {
  const currentYear = new Date().getFullYear()

  const { data, error } = await supabase
    .from('team_stats')
    .select('*')
    .eq('sport_key', sportKey)
    .eq('season', currentYear)

  if (error) {
    console.error('Error loading team stats:', error.message)
    return []
  }

  return data ?? []
}

function buildStatsMap(stats: TeamStatsInput[]) {
  const map = new Map<string, TeamStatsInput>()

  for (const team of stats) {
    map.set(normalizeTeamName(team.team_name), team)
  }

  return map
}

function getMoneylineOutcomes(game: GameWithOdds): {
  sportsbook: string
  outcomes: OddsOutcome[]
} {
  const bookmaker = game.bookmakers?.[0]

  if (!bookmaker) {
    return {
      sportsbook: 'Unknown',
      outcomes: [],
    }
  }

  const moneyline = bookmaker.markets.find((market) => market.key === 'h2h')

  return {
    sportsbook: bookmaker.title,
    outcomes: moneyline?.outcomes ?? [],
  }
}

function getFallbackRating(stats?: TeamStatsInput | null): number {
  if (!stats) return 50

  return calculateTeamRating({
    wins: stats.wins ?? 0,
    losses: stats.losses ?? 0,
    ties: stats.ties ?? 0,
    home_wins: stats.home_wins ?? 0,
    home_losses: stats.home_losses ?? 0,
    away_wins: stats.away_wins ?? 0,
    away_losses: stats.away_losses ?? 0,
    last_5_wins: stats.last_5_wins ?? 0,
    last_5_losses: stats.last_5_losses ?? 0,
    last_10_wins: stats.last_10_wins ?? 0,
    last_10_losses: stats.last_10_losses ?? 0,
    streak: stats.streak ?? 0,
    win_percentage: stats.win_percentage ?? 0,
  })
}

function buildPredictionHistoryRows(game: GameWithOdds, sportsbook: string, predictions: PredictionResult[]) {
  return predictions.map((prediction) => ({
    sport_key: game.sport_key,
    game_id: game.id,
    commence_time: game.commence_time,
    home_team: game.home_team,
    away_team: game.away_team,
    team: prediction.team,
    opponent: prediction.opponent,
    market: 'moneyline',
    sportsbook,
    odds: prediction.odds,
    implied_probability: prediction.impliedProbability,
    model_probability: prediction.modelProbability,
    edge: prediction.edge,
    ev: prediction.ev,
    confidence: prediction.confidence,
    recommended_pick: prediction.recommendedPick,
  }))
}

export async function generatePredictionsForGames(
  games: GameWithOdds[],
  sportKey: string,
  options?: {
    saveHistory?: boolean
  }
): Promise<
  Array<
    GameWithOdds & {
      predictions: PredictionResult[]
      recommendedPick: PredictionResult | null
    }
  >
> {
  const stats = await getTeamStats(sportKey)
  const statsMap = buildStatsMap(stats)

  const allHistoryRows = []

  const gamesWithPredictions = games.map((game) => {
    const { sportsbook, outcomes } = getMoneylineOutcomes(game)

    if (outcomes.length < 2) {
      return {
        ...game,
        predictions: [],
        recommendedPick: null,
      }
    }

    const homeStats = statsMap.get(normalizeTeamName(game.home_team)) ?? null
    const awayStats = statsMap.get(normalizeTeamName(game.away_team)) ?? null

    const homeOutcome = outcomes.find(
      (outcome) =>
        normalizeTeamName(outcome.name) === normalizeTeamName(game.home_team)
    )

    const awayOutcome = outcomes.find(
      (outcome) =>
        normalizeTeamName(outcome.name) === normalizeTeamName(game.away_team)
    )

    if (!homeOutcome || !awayOutcome) {
      return {
        ...game,
        predictions: [],
        recommendedPick: null,
      }
    }

    const homeRating = getFallbackRating(homeStats)
    const awayRating = getFallbackRating(awayStats)

    const homePrediction = calculatePredictionV2({
      teamName: game.home_team,
      opponentName: game.away_team,
      americanOdds: homeOutcome.price,
      opponentAmericanOdds: awayOutcome.price,
      teamRating: homeRating,
      opponentRating: awayRating,
      teamStats: homeStats,
      opponentStats: awayStats,
      isHomeTeam: true,
    })

    const awayPrediction = calculatePredictionV2({
      teamName: game.away_team,
      opponentName: game.home_team,
      americanOdds: awayOutcome.price,
      opponentAmericanOdds: homeOutcome.price,
      teamRating: awayRating,
      opponentRating: homeRating,
      teamStats: awayStats,
      opponentStats: homeStats,
      isHomeTeam: false,
    })

    const predictions = [homePrediction, awayPrediction]

    const recommendedPick =
      predictions
        .filter((prediction) => prediction.recommendedPick)
        .sort((a, b) => b.ev - a.ev || b.confidence - a.confidence)[0] ?? null

    if (options?.saveHistory) {
      allHistoryRows.push(
        ...buildPredictionHistoryRows(game, sportsbook, predictions)
      )
    }

    return {
      ...game,
      predictions,
      recommendedPick,
    }
  })

  if (options?.saveHistory && allHistoryRows.length > 0) {
    try {
      await savePredictionHistory(allHistoryRows)
    } catch (error) {
      console.error('Failed to save prediction history:', error)
    }
  }

  return gamesWithPredictions
}