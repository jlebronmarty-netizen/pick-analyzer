import { NextResponse } from 'next/server'
import { normalizeBankroll } from '@/services/bankroll.service'
import { getLiveBettingOpportunities } from '@/services/live-betting.service'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)

    const sportKey = searchParams.get('sport') ?? 'baseball_mlb'
    const bankroll = normalizeBankroll(searchParams.get('bankroll'))

    const result = await getLiveBettingOpportunities({
      sportKey,
      bankroll,
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('Live betting engine error:', error)

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Unknown live betting error',
      },
      { status: 500 }
    )
  }
}