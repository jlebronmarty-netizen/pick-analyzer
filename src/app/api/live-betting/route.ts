import { NextRequest, NextResponse } from 'next/server'
import { getLiveBettingEngine } from '@/services/live-betting-engine.service'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    const bankroll = Number(searchParams.get('bankroll') ?? 1000)

    const result = await getLiveBettingEngine({
      bankroll,
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('Live betting engine failed:', error)

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Live betting engine failed',
      },
      { status: 500 }
    )
  }
}