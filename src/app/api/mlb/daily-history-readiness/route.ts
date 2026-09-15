import { apiError, apiOk, errorMessage } from '@/lib/api-contract'
import { getMlbDailyHistoryReadiness } from '@/services/mlb-daily-history-readiness.service'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const runtime = 'nodejs'

export async function GET() {
  try {
    const readiness = await getMlbDailyHistoryReadiness()
    return apiOk(readiness, undefined, {
      status: readiness.ready ? 200 : 409,
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    return apiError({
      code: 'DAILY_HISTORY_READINESS_ERROR',
      message: errorMessage(error, 'Unable to evaluate MLB daily history readiness'),
    })
  }
}
