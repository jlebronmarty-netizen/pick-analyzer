import { NextResponse } from 'next/server'

const BASE_URL = 'https://api.the-odds-api.com/v4'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)

    const sport =
      searchParams.get('sport') ?? 'baseball_mlb'

    const apiKey = process.env.ODDS_API_KEY

    const response = await fetch(
      `${BASE_URL}/sports/${sport}/scores/?apiKey=${apiKey}&daysFrom=3`,
      {
        next: {
          revalidate: 300,
        },
      }
    )

    const data = await response.json()

    return NextResponse.json({
      success: true,
      results: data,
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Unknown error',
      },
      {
        status: 500,
      }
    )
  }
}