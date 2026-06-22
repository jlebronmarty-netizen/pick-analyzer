import { NextResponse } from 'next/server'
import { getPredictionPerformance } from '@/services/prediction-history.service'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const sport = searchParams.get('sport') ?? undefined

    const result = await getPredictionPerformance(sport)

    return NextResponse.json(result)
  } catch (error) {
    console.error('Prediction performance error:', error)

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Unexpected server error',
      },
      { status: 500 }
    )
  }
}