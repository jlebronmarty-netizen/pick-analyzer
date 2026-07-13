import { NextRequest, NextResponse } from 'next/server'
import { getNbaBacktest } from '@/services/nba-backtesting-calibration.service'

function isAuthorized(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return true
  const authHeader = request.headers.get('authorization')
  const { searchParams } = new URL(request.url)
  return authHeader === `Bearer ${cronSecret}` || searchParams.get('secret') === cronSecret
}

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

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await getNbaBacktest(getFilters(request))
    return NextResponse.json({
      ...result,
      mode: 'nba_backtesting_run_v1',
      persisted: false,
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'NBA backtest run failed',
      },
      { status: 500 }
    )
  }
}
