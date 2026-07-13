import { supabase } from '@/lib/supabase'
import { getAdvancedPredictionFactors } from '@/services/advanced-factors.service'
import { getModelWeights } from '@/services/model-learning.service'
import {
  BookMarketLine,
  getPredictionMarketIntelligence,
} from '@/services/prediction-market-intelligence.service'
import { savePredictionHistory } from '@/services/prediction-history.service'
import {
  calculatePredictionV4,
  PredictionResult,
  TeamMatchupInput,
  TeamStatsInput,
} from '@/utils/prediction-engine-v4'

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

type EnhancedPredictionResult = PredictionResult & {
  marketAverageOdds: number
  bestOdds: number
  worstOdds: number
  bestBook: string
  slowBook: string
  valueGap: number
  steamMove: boolean
  reverseLineMovement: boolean
  staleLine: boolean
  movementSignal:
    | 'STEAM_MOVE'
    | 'STALE_LINE'
    | 'REVERSE_LINE'
    | 'VALUE_GAP'
    | 'NORMAL'
  marketMovementScore: number
  sharpConfidence: number
  sharpSignal: boolean
  sharpLabel:
    | 'SHARP_VALUE'
    | 'POSSIBLE_STEAM'
    | 'STALE_BOOK'
    | 'MARKET_WATCH'
    | 'NO_SHARP_SIGNAL'
  bettingUrgency: 'BET_NOW' | 'PLAYABLE' | 'MONITOR' | 'AVOID'
  urgencyScore: number
}

type PredictionHistoryRow = {
  sport_key: string
  game_id: string
  commence_time: string
  home_team: string
  away_team: string
  team: string
  opponent: string
  market: string
  sportsbook: string
  odds: number
  implied_probability: number
  model_probability: number
  edge: number
  ev: number
  confidence: number
  recommended_pick: boolean
}

function normalizeTeamName(name: string): string {
  return name.trim().toLowerCase()
}

function normalizePairKey(sportKey: string, teamA: string, teamB: string) {
  const [first, second] = [
    normalizeTeamName(teamA),
    normalizeTeamName(teamB),
  ].sort()

  return `${sportKey}:${first}:${second}`
}

function safeNumber(value: unknown, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
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

async function getTeamMatchups(sportKey: string): Promise<TeamMatchupInput[]> {
  const { data, error } = await supabase
    .from('team_matchups')
    .select('*')
    .eq('sport_key', sportKey)

  if (error) {
    console.error('Error loading team matchups:', error.message)
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

function buildMatchupsMap(matchups: TeamMatchupInput[]) {
  const map = new Map<string, TeamMatchupInput>()

  for (const matchup of matchups) {
    map.set(
      normalizePairKey(matchup.sport_key, matchup.team_a, matchup.team_b),
      matchup
    )
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

function getAllMoneylineMarketLines(game: GameWithOdds): BookMarketLine[] {
  const lines: BookMarketLine[] = []

  for (const bookmaker of game.bookmakers ?? []) {
    const market = bookmaker.markets.find((item) => item.key === 'h2h')

    if (!market) continue

    for (const outcome of market.outcomes) {
      lines.push({
        sportsbook: bookmaker.title,
        team: outcome.name,
        odds: outcome.price,
      })
    }
  }

  return lines
}

function getFallbackRating(stats?: TeamStatsInput | null): number {
  if (!stats) return 50

  const wins = safeNumber(stats.wins, 0)
  const losses = safeNumber(stats.losses, 0)
  const ties = safeNumber(stats.ties, 0)

  const totalGames = wins + losses + ties
  const rawWinPercentage = safeNumber(stats.win_percentage, 0.5)

  const winPercentage =
    totalGames > 0
      ? wins / totalGames
      : rawWinPercentage > 1
        ? rawWinPercentage / 100
        : rawWinPercentage

  const last10Wins = safeNumber(stats.last_10_wins, 0)
  const last10Losses = safeNumber(stats.last_10_losses, 0)
  const last10Total = last10Wins + last10Losses

  const last10Percentage = last10Total > 0 ? last10Wins / last10Total : 0.5

  const homeWins = safeNumber(stats.home_wins, 0)
  const homeLosses = safeNumber(stats.home_losses, 0)
  const homeTotal = homeWins + homeLosses

  const homePercentage = homeTotal > 0 ? homeWins / homeTotal : 0.5

  const streak = clamp(safeNumber(stats.streak, 0), -5, 5)

  const rating =
    winPercentage * 45 +
    last10Percentage * 30 +
    homePercentage * 15 +
    (50 + streak * 5) * 0.1

  return Number(clamp(rating, 1, 99).toFixed(2))
}

function getSplitPercentage(
  stats: TeamStatsInput | null,
  type: 'home' | 'away'
): number {
  if (!stats) return 0.5

  const wins =
    type === 'home'
      ? safeNumber(stats.home_wins, 0)
      : safeNumber(stats.away_wins, 0)

  const losses =
    type === 'home'
      ? safeNumber(stats.home_losses, 0)
      : safeNumber(stats.away_losses, 0)

  const total = wins + losses

  if (total <= 0) return 0.5

  return wins / total
}

function calculateHomeAwayAdvantage(
  teamStats: TeamStatsInput | null,
  opponentStats: TeamStatsInput | null,
  isHomeTeam: boolean
): number {
  const teamSplit = getSplitPercentage(teamStats, isHomeTeam ? 'home' : 'away')
  const opponentSplit = getSplitPercentage(
    opponentStats,
    isHomeTeam ? 'away' : 'home'
  )

  const diff = teamSplit - opponentSplit

  return Number(clamp(diff * 8, -4, 4).toFixed(2))
}

function calculateHeadToHeadAdvantage(
  teamName: string,
  matchup: TeamMatchupInput | null
): number {
  if (!matchup || !matchup.games_played || matchup.games_played <= 0) {
    return 0
  }

  const normalizedTeam = normalizeTeamName(teamName)
  const normalizedTeamA = normalizeTeamName(matchup.team_a)
  const normalizedTeamB = normalizeTeamName(matchup.team_b)

  let teamWins = 0

  if (normalizedTeam === normalizedTeamA) {
    teamWins = safeNumber(matchup.team_a_wins, 0)
  } else if (normalizedTeam === normalizedTeamB) {
    teamWins = safeNumber(matchup.team_b_wins, 0)
  } else {
    return 0
  }

  const winRate = teamWins / matchup.games_played
  const diffFromNeutral = winRate - 0.5

  return Number(clamp(diffFromNeutral * 6, -3, 3).toFixed(2))
}

function enrichPredictionWithMarketIntelligence({
  prediction,
  marketLines,
}: {
  prediction: PredictionResult
  marketLines: BookMarketLine[]
}): EnhancedPredictionResult {
  const market = getPredictionMarketIntelligence({
    team: prediction.team,
    odds: prediction.odds,
    edge: prediction.edge,
    ev: prediction.ev,
    confidence: prediction.confidence,
    lines: marketLines,
  })

  return {
    ...prediction,
    ...market,
  }
}

function buildPredictionHistoryRows(
  game: GameWithOdds,
  sportsbook: string,
  predictions: PredictionResult[]
): PredictionHistoryRow[] {
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
  options?: { saveHistory?: boolean }
): Promise<
  Array<
    GameWithOdds & {
      predictions: EnhancedPredictionResult[]
      recommendedPick: EnhancedPredictionResult | null
    }
  >
> {
  const [stats, matchups] = await Promise.all([
    getTeamStats(sportKey),
    getTeamMatchups(sportKey),
  ])

  const learnedWeights = await getModelWeights(sportKey)

  const statsMap = buildStatsMap(stats)
  const matchupsMap = buildMatchupsMap(matchups)

  const allHistoryRows: PredictionHistoryRow[] = []

  const gamesWithPredictions = await Promise.all(
    games.map(async (game) => {
      const { sportsbook, outcomes } = getMoneylineOutcomes(game)
      const marketLines = getAllMoneylineMarketLines(game)

      if (outcomes.length < 2) {
        return {
          ...game,
          predictions: [],
          recommendedPick: null,
        }
      }

      const homeStats = statsMap.get(normalizeTeamName(game.home_team)) ?? null
      const awayStats = statsMap.get(normalizeTeamName(game.away_team)) ?? null

      const matchup =
        matchupsMap.get(
          normalizePairKey(game.sport_key, game.home_team, game.away_team)
        ) ?? null

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

      const homeAwayHome = calculateHomeAwayAdvantage(homeStats, awayStats, true)
      const homeAwayAway = calculateHomeAwayAdvantage(
        awayStats,
        homeStats,
        false
      )

      const h2hHome = calculateHeadToHeadAdvantage(game.home_team, matchup)
      const h2hAway = calculateHeadToHeadAdvantage(game.away_team, matchup)

      const [homeAdvancedFactors, awayAdvancedFactors] = await Promise.all([
        getAdvancedPredictionFactors({
          sportKey: game.sport_key,
          gameId: game.id,
          teamName: game.home_team,
          opponentName: game.away_team,
        }),
        getAdvancedPredictionFactors({
          sportKey: game.sport_key,
          gameId: game.id,
          teamName: game.away_team,
          opponentName: game.home_team,
        }),
      ])

      const homePrediction = calculatePredictionV4(
        {
          teamName: game.home_team,
          opponentName: game.away_team,
          americanOdds: homeOutcome.price,
          opponentAmericanOdds: awayOutcome.price,
          teamRating: homeRating,
          opponentRating: awayRating,
          teamStats: homeStats,
          opponentStats: awayStats,
          isHomeTeam: true,
        },
        {
          homeAwayAdvantage: homeAwayHome,
          headToHeadAdvantage: h2hHome,
          pitcherAdvantage: homeAdvancedFactors.pitcherAdvantage,
          injuryImpact: homeAdvancedFactors.injuryImpact,
          weatherImpact: homeAdvancedFactors.weatherImpact,
        },
        learnedWeights
      )

      const awayPrediction = calculatePredictionV4(
        {
          teamName: game.away_team,
          opponentName: game.home_team,
          americanOdds: awayOutcome.price,
          opponentAmericanOdds: homeOutcome.price,
          teamRating: awayRating,
          opponentRating: homeRating,
          teamStats: awayStats,
          opponentStats: homeStats,
          isHomeTeam: false,
        },
        {
          homeAwayAdvantage: homeAwayAway,
          headToHeadAdvantage: h2hAway,
          pitcherAdvantage: awayAdvancedFactors.pitcherAdvantage,
          injuryImpact: awayAdvancedFactors.injuryImpact,
          weatherImpact: awayAdvancedFactors.weatherImpact,
        },
        learnedWeights
      )

      const predictions = [homePrediction, awayPrediction].map((prediction) =>
        enrichPredictionWithMarketIntelligence({
          prediction,
          marketLines,
        })
      )

      const recommendedPick =
        predictions
          .filter((prediction) => prediction.recommendedPick)
          .sort(
            (a, b) =>
              b.marketMovementScore - a.marketMovementScore ||
              b.ev - a.ev ||
              b.confidence - a.confidence
          )[0] ?? null

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
  )

  if (options?.saveHistory && allHistoryRows.length > 0) {
    try {
      await savePredictionHistory(allHistoryRows)
    } catch (error) {
      console.error('Failed to save prediction history:', error)
    }
  }

  return gamesWithPredictions
}