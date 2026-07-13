import { NextRequest, NextResponse } from 'next/server'
import { getNbaBacktest } from '@/services/nba-backtesting-calibration.service'

function getFilters(request: NextRequest) {
  const { searchParams } = request.nextUrl

  return {
    dateFrom: searchParams.get('dateFrom'),
    dateTo: searchParams.get('dateTo'),
    market: searchParams.get('market'),
    modelVersion: searchParams.get('modelVersion'),
    recommendedOnly: searchParams.get('recommendedOnly') === 'true',
  }
}

export async function GET(request: NextRequest) {
  try {
    const result = await getNbaBacktest(getFilters(request))
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'NBA backtest failed',
      },
      { status: 500 }
    )
  }
}
