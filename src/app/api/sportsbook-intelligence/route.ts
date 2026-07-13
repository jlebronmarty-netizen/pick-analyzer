import { NextResponse } from 'next/server'
import { getSportsbookIntelligence } from '@/services/sportsbook-intelligence.service'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)

    const sportKey = searchParams.get('sport') ?? 'baseball_mlb'
    const bankroll = Number(searchParams.get('bankroll') ?? 1000)

    const result = await getSportsbookIntelligence({
      sportKey,
      bankroll,
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('Sportsbook intelligence error:', error)

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Unknown sportsbook intelligence error',
      },
      { status: 500 }
    )
  }
}