import { NextResponse } from 'next/server'
import { getNbaSettlementBacklog } from '@/services/nba-prediction-settlement.service'

export async function GET() {
  try {
    const result = await getNbaSettlementBacklog()
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'NBA settlement backlog failed',
      },
      { status: 500 }
    )
  }
}
