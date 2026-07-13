import { NextResponse } from 'next/server'
import { getNbaModelHealthV2 } from '@/services/nba-prediction-settlement.service'

export async function GET() {
  try {
    const result = await getNbaModelHealthV2()
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'NBA model health V2 failed',
      },
      { status: 500 }
    )
  }
}
