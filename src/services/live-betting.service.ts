import { calculateQuarterKellyStake } from '@/services/kelly.service'
import { analyzeMarketMovement } from '@/services/market-movement.service'
import { getRiskGrade } from '@/services/risk-grade.service'
import { getSharpMoneySignal } from '@/services/sharp-money.service'
import { generatePredictionsForGames } from '@/services/prediction.service'

const ODDS_API_BASE_URL = 'https://api.the-odds-api.com/v4'

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

type OddsGame = {
  id: string
  sport_key: string
  sport_title: string
  commence_time: string
  home_team: string
  away_team: string
  bookmakers?: OddsBookmaker[]
}

type LivePrediction = {
  team: string
  opponent: string
  odds: number
  impliedProbability: number
  modelProbability: number
  edge: number
  ev: number
  confidence: number
  recommendedPick: boolean
}

type FlatOpportunity = {
  gameId: string
  sportKey: string
  commenceTime: string
  liveStatus: string
  homeTeam: string
  awayTeam: string
  sportsbook: string
  team: string
  opponent: string
  odds: number
  formattedOdds: string
  impliedProbability: number
  modelProbability: number
  edge: number
  ev: number
  confidence: number
  recommendedPick: boolean
  alertType: string
  recommendation: string
  smartScore: number
  riskGrade: string
  riskLabel: string
  riskStars: number
  kellyPercent: number
  recommendedStake: number
}

function round(value: number) {
  return Number(value.toFixed(2))
}

function formatOdds(odds: number) {
  return odds > 0 ? `+${odds}` : `${odds}`
}

function getDecimalOdds(americanOdds: number) {
  return americanOdds > 0
    ? 1 + americanOdds / 100
    : 1 + 100 / Math.abs(americanOdds)
}

function getConsensusAmericanOdds(odds: number[]) {
  if (!odds.length) return 0

  const averageDecimal =
    odds.reduce((sum, value) => sum + getDecimalOdds(value), 0) / odds.length

  if (averageDecimal >= 2) {
    return Math.round((averageDecimal - 1) * 100)
  }

  return Math.round(-100 / (averageDecimal - 1))
}

function getBestOdds(odds: number[]) {
  if (!odds.length) return 0

  return odds.reduce((best, current) => {
    return getDecimalOdds(current) > getDecimalOdds(best) ? current : best
  }, odds[0])
}

function getWorstOdds(odds: number[]) {
  if (!odds.length) return 0

  return odds.reduce((worst, current) => {
    return getDecimalOdds(current) < getDecimalOdds(worst) ? current : worst
  }, odds[0])
}

function getLineValue(bestOdds: number, consensusOdds: number) {
  const bestDecimal = getDecimalOdds(bestOdds)
  const consensusDecimal = getDecimalOdds(consensusOdds)

  return round((bestDecimal - consensusDecimal) * 100)
}

function normalize(value: string) {
  return value.trim().toLowerCase()
}

function getLiveStatus(commenceTime: string) {
  const now = Date.now()
  const start = new Date(commenceTime).getTime()

  if (Number.isNaN(start)) return 'unknown'

  const diffMinutes = (now - start) / 60000

  if (diffMinutes >= 0 && diffMinutes <= 240) return 'likely_live'
  if (diffMinutes < 0 && Math.abs(diffMinutes) <= 180) return 'pre_live_watch'
  if (diffMinutes > 240) return 'late_or_finished'

  return 'upcoming'
}

function getAlertType(prediction: LivePrediction) {
  if (
    prediction.recommendedPick &&
    prediction.confidence >= 80 &&
    prediction.edge >= 8 &&
    prediction.ev >= 10
  ) {
    return 'LIVE_VALUE'
  }

  if (
    prediction.recommendedPick &&
    prediction.odds > 0 &&
    prediction.edge >= 7 &&
    prediction.ev >= 8
  ) {
    return 'BUY_LOW'
  }

  if (
    prediction.recommendedPick &&
    prediction.confidence >= 75 &&
    prediction.odds < 0 &&
    prediction.edge >= 5
  ) {
    return 'STRONG_FAVORITE'
  }

  if (prediction.edge >= 3 && prediction.ev >= 3) return 'WATCHLIST'

  return 'NO_PLAY'
}

function getSmartScore(prediction: LivePrediction) {
  const score =
    prediction.confidence * 0.45 + prediction.ev * 0.25 + prediction.edge * 1.2

  return round(Math.min(Math.max(score, 0), 100))
}

function getRecommendation(alertType: string) {
  if (alertType === 'LIVE_VALUE') return 'Live value bet detected'
  if (alertType === 'BUY_LOW') return 'Buy-low opportunity'
  if (alertType === 'STRONG_FAVORITE') return 'Strong favorite opportunity'
  if (alertType === 'WATCHLIST') return 'Monitor line movement'

  return 'No live play'
}

async function fetchOddsForSport(sportKey: string) {
  const apiKey = process.env.ODDS_API_KEY

  if (!apiKey) throw new Error('Missing ODDS_API_KEY')

  const url = new URL(`${ODDS_API_BASE_URL}/sports/${sportKey}/odds`)
  url.searchParams.set('apiKey', apiKey)
  url.searchParams.set('regions', 'us')
  url.searchParams.set('markets', 'h2h')
  url.searchParams.set('oddsFormat', 'american')

  const response = await fetch(url.toString(), {
    cache: 'no-store',
  })

  if (!response.ok) {
    const details = await response.text()
    throw new Error(`Odds API live odds error for ${sportKey}: ${details}`)
  }

  return response.json() as Promise<OddsGame[]>
}

function expandGamesByBookmaker(games: OddsGame[]) {
  const expanded: OddsGame[] = []

  for (const game of games) {
    for (const bookmaker of game.bookmakers ?? []) {
      expanded.push({
        ...game,
        bookmakers: [bookmaker],
      })
    }
  }

  return expanded
}

function buildOpportunityFromPrediction({
  game,
  prediction,
  bankroll,
}: {
  game: OddsGame
  prediction: LivePrediction
  bankroll: number
}): FlatOpportunity {
  const alertType = getAlertType(prediction)
  const smartScore = getSmartScore(prediction)
  const sportsbook = game.bookmakers?.[0]?.title ?? 'Unknown'

  const risk = getRiskGrade(prediction.confidence, prediction.ev, prediction.edge)

  const kelly = calculateQuarterKellyStake(
    bankroll,
    prediction.modelProbability,
    prediction.odds
  )

  return {
    gameId: game.id,
    sportKey: game.sport_key,
    commenceTime: game.commence_time,
    liveStatus: getLiveStatus(game.commence_time),
    homeTeam: game.home_team,
    awayTeam: game.away_team,
    sportsbook,
    team: prediction.team,
    opponent: prediction.opponent,
    odds: prediction.odds,
    formattedOdds: formatOdds(prediction.odds),
    impliedProbability: prediction.impliedProbability,
    modelProbability: prediction.modelProbability,
    edge: prediction.edge,
    ev: prediction.ev,
    confidence: prediction.confidence,
    recommendedPick: prediction.recommendedPick,
    alertType,
    recommendation: getRecommendation(alertType),
    smartScore,
    riskGrade: risk.grade,
    riskLabel: risk.label,
    riskStars: risk.stars,
    kellyPercent: kelly.kellyPercent,
    recommendedStake: kelly.stake,
  }
}

function groupOpportunities(opportunities: FlatOpportunity[]) {
  const groups = new Map<string, FlatOpportunity[]>()

  for (const opportunity of opportunities) {
    const key = [
      opportunity.gameId,
      normalize(opportunity.team),
      normalize(opportunity.opponent),
    ].join(':')

    const current = groups.get(key) ?? []
    current.push(opportunity)
    groups.set(key, current)
  }

  return [...groups.values()].map((group) => {
    const odds = group.map((item) => item.odds)

    const bestOdds = getBestOdds(odds)
    const worstOdds = getWorstOdds(odds)
    const consensusOdds = getConsensusAmericanOdds(odds)

    const best = group.find((item) => item.odds === bestOdds) ?? group[0]
    const lineValue = getLineValue(bestOdds, consensusOdds)

    const books = group
      .map((item) => ({
        sportsbook: item.sportsbook,
        odds: item.odds,
        formattedOdds: item.formattedOdds,
      }))
      .sort((a, b) => getDecimalOdds(b.odds) - getDecimalOdds(a.odds))

    const marketMovement = analyzeMarketMovement({
      books,
      bestOdds,
      worstOdds,
      consensusOdds,
      lineValue,
      smartScore: best.smartScore,
      edge: best.edge,
      ev: best.ev,
      confidence: best.confidence,
    })

    const sharpMoney = getSharpMoneySignal({
      steamMove: marketMovement.steamMove,
      staleLine: marketMovement.staleLine,
      reverseLineMovement: marketMovement.reverseLineMovement,
      sharpConfidence: marketMovement.sharpConfidence,
      marketMovementScore: marketMovement.marketMovementScore,
      valueGap: marketMovement.valueGap,
    })

    return {
      ...best,
      bestOdds,
      formattedBestOdds: formatOdds(bestOdds),
      bestSportsbook: best.sportsbook,
      consensusOdds,
      formattedConsensusOdds: formatOdds(consensusOdds),
      worstOdds,
      formattedWorstOdds: formatOdds(worstOdds),
      lineValue,
      booksCompared: group.length,
      marketSpread: round((getDecimalOdds(bestOdds) - getDecimalOdds(worstOdds)) * 100),
      books,
      ...marketMovement,
      ...sharpMoney,
    }
  })
}

export async function getLiveBettingOpportunities({
  sportKey = 'baseball_mlb',
  bankroll = 1000,
}: {
  sportKey?: string
  bankroll?: number
}) {
  const rawGames = await fetchOddsForSport(sportKey)
  const expandedGames = expandGamesByBookmaker(rawGames)

  const gamesWithPredictions = await generatePredictionsForGames(
    expandedGames,
    sportKey,
    {
      saveHistory: false,
    }
  )

  const flatOpportunities = gamesWithPredictions.flatMap((game) => {
    return game.predictions.map((prediction) =>
      buildOpportunityFromPrediction({
        game,
        prediction: prediction as LivePrediction,
        bankroll,
      })
    )
  })

  const qualifiedFlat = flatOpportunities.filter(
    (item) => item.alertType !== 'NO_PLAY'
  )

  const opportunities = groupOpportunities(qualifiedFlat)
    .sort(
      (a, b) =>
        Number(b.sharpSignal) - Number(a.sharpSignal) ||
        b.sharpConfidence - a.sharpConfidence ||
        b.marketMovementScore - a.marketMovementScore ||
        b.smartScore - a.smartScore ||
        b.lineValue - a.lineValue ||
        b.confidence - a.confidence ||
        b.ev - a.ev
    )
    .slice(0, 25)

  return {
    success: true,
    sportKey,
    bankroll,
    generatedAt: new Date().toISOString(),
    summary: {
      gamesChecked: rawGames.length,
      sportsbookMarketsChecked: expandedGames.length,
      rawOpportunities: qualifiedFlat.length,
      opportunities: opportunities.length,
      liveValueCount: opportunities.filter((item) => item.alertType === 'LIVE_VALUE')
        .length,
      buyLowCount: opportunities.filter((item) => item.alertType === 'BUY_LOW')
        .length,
      watchlistCount: opportunities.filter((item) => item.alertType === 'WATCHLIST')
        .length,
      steamMoveCount: opportunities.filter((item) => item.steamMove).length,
      staleLineCount: opportunities.filter((item) => item.staleLine).length,
      sharpSignalCount: opportunities.filter((item) => item.sharpSignal).length,
    },
    opportunities,
  }
}