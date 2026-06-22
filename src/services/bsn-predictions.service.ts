import { supabaseAdmin } from '@/lib/supabase-admin'
import { calculatePredictionV3 } from '@/utils/prediction-engine-v3'
import { savePredictionHistory } from '@/services/prediction-history.service'

type BsnGame = {
  game_id: string
  sport_key: string
  commence_time: string
  home_team: string
  away_team: string
  status: string
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

function getMockOdds(teamName: string) {
  const seed = teamName.length
  return seed % 2 === 0 ? -120 : 110
}

function getOpponentOdds(teamOdds: number) {
  return teamOdds < 0 ? 100 : -120
}

function getTeamRating(teamName: string) {
  const base = 50
  const boost = teamName.length % 15
  return base + boost
}

export async function generateBsnPredictions(options?: { saveHistory?: boolean }) {
  const { data: games, error } = await supabaseAdmin
    .from('bsn_games')
    .select('game_id, sport_key, commence_time, home_team, away_team, status')
    .eq('status', 'scheduled')
    .order('commence_time', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  const predictions: PredictionHistoryRow[] = []

  for (const game of (games ?? []) as BsnGame[]) {
    const homeOdds = getMockOdds(game.home_team)
    const awayOdds = getOpponentOdds(homeOdds)

    const homeRating = getTeamRating(game.home_team)
    const awayRating = getTeamRating(game.away_team)

    const homePrediction = calculatePredictionV3({
      teamName: game.home_team,
      opponentName: game.away_team,
      americanOdds: homeOdds,
      opponentAmericanOdds: awayOdds,
      teamRating: homeRating,
      opponentRating: awayRating,
      teamStats: null,
      opponentStats: null,
    })

    const awayPrediction = calculatePredictionV3({
      teamName: game.away_team,
      opponentName: game.home_team,
      americanOdds: awayOdds,
      opponentAmericanOdds: homeOdds,
      teamRating: awayRating,
      opponentRating: homeRating,
      teamStats: null,
      opponentStats: null,
    })

    for (const prediction of [homePrediction, awayPrediction]) {
      predictions.push({
        sport_key: 'basketball_bsn',
        game_id: game.game_id,
        commence_time: game.commence_time,
        home_team: game.home_team,
        away_team: game.away_team,
        team: prediction.team,
        opponent: prediction.opponent,
        market: 'moneyline',
        sportsbook: 'BSN Internal Model',
        odds: prediction.odds,
        implied_probability: prediction.impliedProbability,
        model_probability: prediction.modelProbability,
        edge: prediction.edge,
        ev: prediction.ev,
        confidence: prediction.confidence,
        recommended_pick: prediction.recommendedPick,
      })
    }
  }

  if (options?.saveHistory && predictions.length > 0) {
    await savePredictionHistory(predictions)
  }

  const recommended = predictions.filter((prediction) => prediction.recommended_pick)

  return {
    success: true,
    games: games?.length ?? 0,
    predictions: predictions.length,
    recommended: recommended.length,
    saved: Boolean(options?.saveHistory),
    picks: predictions,
  }
}