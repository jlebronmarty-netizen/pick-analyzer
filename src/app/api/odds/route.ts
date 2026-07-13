import { NextResponse } from 'next/server'
import { generatePredictionsForGames } from '@/services/prediction.service'

const ODDS_API_BASE_URL = 'https://api.the-odds-api.com/v4'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)

    const sport = searchParams.get('sport') ?? 'baseball_mlb'
    const regions = searchParams.get('regions') ?? 'us'
    const markets = searchParams.get('markets') ?? 'h2h'
    const oddsFormat = searchParams.get('oddsFormat') ?? 'american'
    const saveHistory = searchParams.get('saveHistory') === 'true'
    const includePredictions =
      searchParams.get('includePredictions') === 'true' || saveHistory

    const apiKey = process.env.ODDS_API_KEY

    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing ODDS_API_KEY',
        },
        { status: 500 }
      )
    }

    const url = new URL(`${ODDS_API_BASE_URL}/sports/${sport}/odds`)
    url.searchParams.set('apiKey', apiKey)
    url.searchParams.set('regions', regions)
    url.searchParams.set('markets', markets)
    url.searchParams.set('oddsFormat', oddsFormat)

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 8000)

    const response = await fetch(url.toString(), {
      signal: controller.signal,
      next: {
        revalidate: 60,
      },
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      const errorText = await response.text()

      return NextResponse.json(
        {
          success: false,
          error: 'Failed to fetch odds',
          details: errorText,
          quotaExceeded:
            errorText.includes('OUT_OF_USAGE_CREDITS') ||
            errorText.includes('Usage quota'),
        },
        { status: response.status }
      )
    }

    const games = await response.json()

    if (!includePredictions) {
      return NextResponse.json({
        success: true,
        sport,
        count: games.length,
        saveHistory,
        includePredictions: false,
        games,
      })
    }

    const gamesWithPredictions = await generatePredictionsForGames(
      games,
      sport,
      {
        saveHistory,
      }
    )

    return NextResponse.json({
      success: true,
      sport,
      count: gamesWithPredictions.length,
      saveHistory,
      includePredictions: true,
      games: gamesWithPredictions,
    })
  } catch (error) {
    console.error('Odds API error:', error)

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof DOMException && error.name === 'AbortError'
            ? 'Odds API request timed out'
            : 'Unexpected server error',
      },
      { status: 500 }
    )
  }
}