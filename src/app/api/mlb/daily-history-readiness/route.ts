import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { getMlbDailyHistoryReadiness } from '@/services/mlb-daily-history-readiness.service'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const id = requestId(request)
  try {
    const readiness = await getMlbDailyHistoryReadiness()
    return apiOk(readiness, id, {
      status: readiness.ready ? 200 : 409,
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    return apiError({
      id,
      code: 'DAILY_HISTORY_READINESS_ERROR',
      message: errorMessage(error, 'Unable to evaluate MLB daily history readiness'),
    })
  }
}
