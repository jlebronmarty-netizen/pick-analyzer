import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { executeOperatingDay } from '@/services/operating-day.service'

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  return (
    request.headers.get('authorization') === `Bearer ${secret}` ||
    request.nextUrl.searchParams.get('secret') === secret
  )
}

export async function POST(request: NextRequest) {
  const id = requestId(request)
  if (!authorized(request)) {
    return apiError({
      id,
      code: 'UNAUTHORIZED',
      message: 'Unauthorized operating-day execution request.',
      status: 401,
    })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const result = await executeOperatingDay({
      action: body?.action ?? 'status',
      sportKey: body?.sportKey ?? body?.sport ?? null,
      leagueKey: body?.leagueKey ?? body?.league ?? null,
      selectedDate: body?.selectedDate ?? body?.date ?? null,
      dryRun: body?.dryRun ?? true,
      confirmed: body?.confirmed ?? false,
      forceRefresh: body?.forceRefresh ?? false,
      maximumRequests: body?.maximumRequests ?? body?.maxRequests ?? null,
      timeoutMs: body?.timeoutMs ?? null,
      searchDays: body?.searchDays ?? null,
      stages: Array.isArray(body?.stages) ? body.stages : null,
      requestId: id,
    })
    return apiOk(result, id, result.success ? undefined : { status: 409 })
  } catch (error) {
    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown operating-day execution error'),
    })
  }
}
