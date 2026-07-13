import { NextResponse } from 'next/server'
import { getNbaSteamMoveDetection } from '@/services/nba-steam-move-detection.service'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = Number(searchParams.get('limit') ?? 25)
    const market = searchParams.get('market')

    const result = await getNbaSteamMoveDetection({
      limit,
      market,
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('NBA steam move detection error:', error)

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Unknown NBA steam move detection error',
      },
      { status: 500 }
    )
  }
}
