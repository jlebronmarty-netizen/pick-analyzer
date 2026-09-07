import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { runMlbNrfiBacktest } from '@/services/mlb-nrfi-backtest.service'

export const dynamic = 'force-dynamic'
export const revalidate = 3600
export const maxDuration = 60

export async function GET(request: NextRequest) {
  const id = requestId(request)
  try {
    const report = await runMlbNrfiBacktest()
    return apiOk(report, id, {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    })
  } catch (error) {
    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown MLB NRFI backtest error'),
    })
  }
}
