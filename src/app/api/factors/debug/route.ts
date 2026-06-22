import { NextRequest, NextResponse } from 'next/server'
import { getAdvancedPredictionFactors } from '@/services/advanced-factors.service'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams

    const sportKey = searchParams.get('sportKey') ?? 'baseball_mlb'
    const gameId = searchParams.get('gameId') ?? 'debug_game'
    const teamName = searchParams.get('teamName') ?? 'New York Yankees'
    const opponentName = searchParams.get('opponentName') ?? 'Boston Red Sox'

    const factors = await getAdvancedPredictionFactors({
      sportKey,
      gameId,
      teamName,
      opponentName,
    })

    return NextResponse.json({
      success: true,
      input: {
        sportKey,
        gameId,
        teamName,
        opponentName,
      },
      factors,
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown factors debug error',
      },
      { status: 500 }
    )
  }
}