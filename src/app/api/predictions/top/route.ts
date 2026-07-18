import { NextResponse } from 'next/server'
import { getBestBetsToday } from '@/services/best-bets-today.service'
import { getTopPicks } from '@/services/top-picks.service'

export async function GET() {
  try {
    const [data, bestBetsToday] = await Promise.all([
      getTopPicks(),
      getBestBetsToday(),
    ])

    return NextResponse.json({ ...data, bestBetsToday })
  } catch (error) {
    console.error('Top picks failed:', error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown top picks error',
      },
      { status: 500 }
    )
  }
}
