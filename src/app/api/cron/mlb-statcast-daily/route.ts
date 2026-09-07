import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { refreshMlbStatcastDaily } from '@/services/mlb-statcast-daily-refresh.service'
import { refreshMlbStatcastDailyAnalytics } from '@/services/mlb-statcast-daily-analytics.service'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const runtime = 'nodejs'
export const maxDuration = 300

function cronSecret() {
  return process.env.CRON_SECRET?.trim() ?? ''
}

function authorized(request: NextRequest) {
  const secret = cronSecret()
  if (!secret) return false
  return request.headers.get('authorization') === `Bearer ${secret}`
}

async function execute(request: NextRequest, explicitDate?: string | null) {
  const id = requestId(request)
  if (!cronSecret()) {
    return apiError({ id, code: 'AUTH_REQUIRED', message: 'CRON_SECRET must be configured before MLB Statcast daily refresh can run.', status: 503 })
  }
  if (!authorized(request)) {
    return apiError({ id, code: 'UNAUTHORIZED', message: 'Unauthorized MLB Statcast daily refresh request.', status: 401 })
  }
  try {
    const result = await refreshMlbStatcastDaily({ date: explicitDate ?? null })
    let responseResult: Record<string, unknown> = result as unknown as Record<string, unknown>

    const shouldRepairAnalytics = !explicitDate
      && result.success
      && result.status === 'NO_OP'
      && 'reason' in result
      && result.reason === 'ALREADY_CURRENT'

    if (shouldRepairAnalytics) {
      const analyticsRepair = await refreshMlbStatcastDailyAnalytics()
      responseResult = {
        ...responseResult,
        status: 'SUCCESS_ANALYTICS_REPAIR_NO_OP',
        analyticsRefreshed: true,
        analyticsRepair,
      }
    }

    const status = result.success ? 200 : result.status === 'BLOCKED_SCHEDULE_NOT_FINAL' ? 409 : result.status === 'BLOCK_CONFLICT' ? 423 : 500
    return apiOk(responseResult, id, { status, headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return apiError({ id, code: 'INTERNAL_ERROR', message: errorMessage(error, 'Unknown MLB Statcast daily refresh error') })
  }
}

export async function GET(request: NextRequest) {
  return execute(request)
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const date = typeof body?.date === 'string' ? body.date : null
  return execute(request, date)
}
