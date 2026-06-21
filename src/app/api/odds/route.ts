import { NextRequest, NextResponse } from 'next/server'

const ODDS_API_BASE_URL = 'https://api.the-odds-api.com/v4'

export async function GET(request: NextRequest) {
  try {
    const apiKey = process.env.ODDS_API_KEY

    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'Missing ODDS_API_KEY' },
        { status: 500 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const sport = searchParams.get('sport') || 'baseball_mlb'

    const url = `${ODDS_API_BASE_URL}/sports/${sport}/odds?apiKey=${apiKey}&regions=us&markets=h2h,spreads,totals&oddsFormat=american`

    const response = await fetch(url, {
      cache: 'no-store',
    })

    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          error: `The Odds API error: ${response.status} ${response.statusText}`,
        },
        { status: response.status }
      )
    }

    const data = await response.json()

    return NextResponse.json({
      success: true,
      sport,
      count: data.length,
      data,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'

    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}