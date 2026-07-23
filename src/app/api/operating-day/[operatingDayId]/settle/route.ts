import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, parseBooleanParam, requestId } from '@/lib/api-contract'
import { loadOperatingDayService } from '@/lib/server-lazy-diagnostics'

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  return (
    request.headers.get('authorization') === `Bearer ${secret}` ||
    request.nextUrl.searchParams.get('secret') === secret
  )
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ operatingDayId: string }> }
) {
  const id = requestId(request)
  if (!authorized(request)) {
    return apiError({
      id,
      code: 'UNAUTHORIZED',
      message: 'Unauthorized operating-day settlement request.',
      status: 401,
    })
  }

  try {
    const { operatingDayId } = await context.params
    const body = await request.json().catch(() => ({}))
    const { settleOperatingDay } = await loadOperatingDayService()
    const result = await settleOperatingDay({
      operatingDayId,
      sportKey: body?.sportKey ?? body?.sport ?? 'baseball_mlb',
      selectedDate: body?.selectedDate ?? body?.date ?? request.nextUrl.searchParams.get('date'),
      dryRun: body?.dryRun ?? parseBooleanParam(request.nextUrl.searchParams.get('dryRun'), false),
      officialOnly: body?.officialOnly ?? parseBooleanParam(request.nextUrl.searchParams.get('officialOnly'), false),
      prospectiveOnly: body?.prospectiveOnly ?? parseBooleanParam(request.nextUrl.searchParams.get('prospectiveOnly'), true),
    })
    return apiOk({ success: true, mode: 'operating_day_scoped_settlement_v1', operatingDayId, settlement: result }, id)
  } catch (error) {
    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown operating-day settlement error'),
    })
  }
}
