import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { runMlbPitcherEarnedRunsBacktest } from '@/services/mlb-pitcher-earned-runs-backtest.service'

export const dynamic = 'force-dynamic'
export const revalidate = 3600

export async function GET(request: NextRequest) {
  const id = requestId(request)
  try {
    const report = await runMlbPitcherEarnedRunsBacktest()
    return apiOk(report, id, {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    })
  } catch (error) {
    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown MLB pitcher earned runs backtest error'),
    })
  }
}
