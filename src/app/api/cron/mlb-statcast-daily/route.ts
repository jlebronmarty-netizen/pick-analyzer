import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { refreshMlbStatcastDaily } from '@/services/mlb-statcast-daily-refresh.service'
import { refreshMlbStatcastDailyAnalytics } from '@/services/mlb-statcast-daily-analytics.service'
import { getMlbDailyHistoryReadiness } from '@/services/mlb-daily-history-readiness.service'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const runtime = 'nodejs'
export const maxDuration = 800

const MAX_CATCHUP_DAYS = 14

function cronSecret() {
  return process.env.CRON_SECRET?.trim() ?? ''
}

function authorized(request: NextRequest) {
  const secret = cronSecret()
  if (!secret) return false
  return request.headers.get('authorization') === `Bearer ${secret}`
}

function failureStatus(result: { status?: string }) {
  return result.status === 'BLOCKED_SCHEDULE_NOT_FINAL' ? 409 : result.status === 'BLOCK_CONFLICT' ? 423 : 500
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
    if (explicitDate) {
      const result = await refreshMlbStatcastDaily({ date: explicitDate })
      const readiness = await getMlbDailyHistoryReadiness({ date: explicitDate })
      const status = result.success ? (readiness.ready ? 200 : 409) : failureStatus(result)
      return apiOk({ ...result, dailyHistoryReadiness: readiness }, id, { status, headers: { 'Cache-Control': 'no-store' } })
    }

    const catchupRuns: Array<Record<string, unknown>> = []
    let reachedCurrent = false
    let wroteHistory = false

    for (let attempt = 0; attempt < MAX_CATCHUP_DAYS; attempt += 1) {
      const result = await refreshMlbStatcastDaily({ refreshAnalytics: false })
      catchupRuns.push(result as unknown as Record<string, unknown>)

      if (!result.success) {
        const readiness = await getMlbDailyHistoryReadiness()
        return apiOk({ success: false, status: result.status, catchupRuns, dailyHistoryReadiness: readiness }, id, {
          status: failureStatus(result),
          headers: { 'Cache-Control': 'no-store' },
        })
      }

      if ('inserted' in result && Number(result.inserted ?? 0) > 0) wroteHistory = true

      if (result.status === 'NO_OP' && 'reason' in result && result.reason === 'ALREADY_CURRENT') {
        reachedCurrent = true
        break
      }
    }

    if (!reachedCurrent) {
      const readiness = await getMlbDailyHistoryReadiness()
      return apiOk({ success: false, status: 'CATCHUP_LIMIT_REACHED', catchupRuns, dailyHistoryReadiness: readiness }, id, {
        status: 503,
        headers: { 'Cache-Control': 'no-store' },
      })
    }

    let readiness = await getMlbDailyHistoryReadiness()
    let analyticsRepair: Awaited<ReturnType<typeof refreshMlbStatcastDailyAnalytics>> | null = null
    if (wroteHistory || !readiness.analytics.ready) {
      analyticsRepair = await refreshMlbStatcastDailyAnalytics()
      readiness = await getMlbDailyHistoryReadiness()
    }

    return apiOk({
      success: readiness.ready,
      status: readiness.status,
      catchupRuns,
      analyticsRefreshed: Boolean(analyticsRepair),
      analyticsRepair,
      dailyHistoryReadiness: readiness,
    }, id, {
      status: readiness.ready ? 200 : 409,
      headers: { 'Cache-Control': 'no-store' },
    })
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
