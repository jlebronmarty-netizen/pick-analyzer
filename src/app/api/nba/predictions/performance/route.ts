import { NextResponse } from 'next/server'
import { getNbaPredictionPerformance } from '@/services/nba-prediction-settlement.service'

export async function GET() {
  try {
    const result = await getNbaPredictionPerformance()
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'NBA prediction performance failed',
      },
      { status: 500 }
    )
  }
}
