import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, parseBooleanParam, requestId } from '@/lib/api-contract'
import { getHistoricalProgressiveReplayStatus, runHistoricalProgressiveReplay } from '@/services/historical-progressive-replay.service'

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return request.headers.get('authorization') === `Bearer ${secret}` || request.nextUrl.searchParams.get('secret') === secret
}

export async function GET(request: NextRequest) {
  const id = requestId(request)
  try {
    const limit = Number(request.nextUrl.searchParams.get('limit') ?? 500)
    return apiOk(await getHistoricalProgressiveReplayStatus({ limit }), id)
  } catch (error) {
    return apiError({ id, code: 'INTERNAL_ERROR', message: errorMessage(error, 'Unknown historical replay status error') })
  }
}

export async function POST(request: NextRequest) {
  const id = requestId(request)
  try {
    const dryRun = parseBooleanParam(request.nextUrl.searchParams.get('dryRun'), true)
    if (dryRun === false && !authorized(request)) {
      return apiError({ id, code: 'UNAUTHORIZED', message: 'Protected historical replay execution requires CRON_SECRET authorization.', status: 401 })
    }
    const body = await request.json().catch(() => ({})) as Record<string, unknown>
    return apiOk(await runHistoricalProgressiveReplay({
      sportKey: String(body.sportKey ?? request.nextUrl.searchParams.get('sportKey') ?? 'baseball_mlb'),
      dateFrom: String(body.dateFrom ?? request.nextUrl.searchParams.get('dateFrom') ?? '') || null,
      dateTo: String(body.dateTo ?? request.nextUrl.searchParams.get('dateTo') ?? '') || null,
      eventLimit: Number(body.eventLimit ?? request.nextUrl.searchParams.get('eventLimit') ?? 1),
      dryRun,
      runMode: String(body.runMode ?? request.nextUrl.searchParams.get('runMode') ?? ''),
    }), id)
  } catch (error) {
    return apiError({ id, code: 'INTERNAL_ERROR', message: errorMessage(error, 'Unknown historical replay execution error') })
  }
}
