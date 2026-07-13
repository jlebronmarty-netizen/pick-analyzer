import { NextRequest, NextResponse } from 'next/server'
import { getPredictionEngineV4 } from '@/services/prediction-engine-v4.service'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    const bankroll = Number(searchParams.get('bankroll') ?? 1000)

    const result = await getPredictionEngineV4({
      bankroll,
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('Prediction Engine V4 failed:', error)

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Prediction Engine V4 failed',
      },
      { status: 500 }
    )
  }
}