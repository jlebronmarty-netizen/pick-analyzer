import { getEnabledSports } from '@/config/sports.config'
import { generatePredictionsForGames } from '@/services/prediction.service'

const ODDS_API_BASE_URL = 'https://api.the-odds-api.com/v4'

async function fetchOddsForSport(sportKey: string) {
  const apiKey = process.env.ODDS_API_KEY

  if (!apiKey) {
    throw new Error('Missing ODDS_API_KEY')
  }

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
    throw new Error(`Odds API odds error for ${sportKey}: ${details}`)
  }

  return response.json()
}

export async function capturePredictionsForSport(sportKey: string) {
  const games = await fetchOddsForSport(sportKey)

  const gamesWithPredictions = await generatePredictionsForGames(
    games,
    sportKey,
    {
      saveHistory: true,
    }
  )

  const predictionsCount = gamesWithPredictions.reduce(
    (sum, game) => sum + (game.predictions?.length ?? 0),
    0
  )

  const recommendedCount = gamesWithPredictions.reduce(
    (sum, game) => sum + (game.recommendedPick ? 1 : 0),
    0
  )

  return {
    success: true,
    sportKey,
    games: gamesWithPredictions.length,
    predictions: predictionsCount,
    recommended: recommendedCount,
  }
}

export async function capturePredictionsForAllSports() {
  const sports = getEnabledSports()
  const results = []

  for (const sport of sports) {
    try {
      const result = await capturePredictionsForSport(sport.key)

      results.push(result)
    } catch (error) {
      results.push({
        success: false,
        sportKey: sport.key,
        error:
          error instanceof Error
            ? error.message
            : 'Unexpected capture error',
      })
    }
  }

  return {
    success: true,
    count: results.length,
    results,
  }
}