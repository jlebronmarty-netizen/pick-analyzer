import { NextRequest, NextResponse } from 'next/server'
import { createBsnGames, getBsnGames } from '@/services/bsn.service'

export async function GET() {
  try {
    const data = await getBsnGames()
    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const games = Array.isArray(body) ? body : body.games

    if (!Array.isArray(games)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Expected an array of games or { games: [...] }',
        },
        { status: 400 }
      )
    }

    const data = await createBsnGames(games)

    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}