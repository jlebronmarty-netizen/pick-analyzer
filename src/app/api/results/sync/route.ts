import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, parseIntegerParam, requestId } from '@/lib/api-contract'
import { syncRecentResults } from '@/services/results-sync.service'

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  return (
    request.headers.get('authorization') === `Bearer ${secret}` ||
    request.nextUrl.searchParams.get('secret') === secret
  )
}

async function handleSync(request: NextRequest) {
  const id = requestId(request)
  if (!authorized(request)) {
    return apiError({
      id,
      code: 'UNAUTHORIZED',
      message: 'Unauthorized results sync request.',
      status: 401,
    })
  }

  try {
    const body = request.method === 'POST' ? await request.json().catch(() => ({})) : {}
    const sportKey = request.nextUrl.searchParams.get('sport') ?? body?.sportKey ?? body?.sport ?? 'baseball_mlb'
    const daysFrom = parseIntegerParam({
      value: request.nextUrl.searchParams.get('daysFrom') ?? String(body?.daysFrom ?? ''),
      fallback: 3,
      min: 1,
      max: 7,
    })
    const result = await syncRecentResults(sportKey, daysFrom)
    return apiOk(result, id, result.success ? undefined : { status: result.status === 'quota_blocked' ? 429 : 200 })
  } catch (error) {
    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown results sync error'),
    })
  }
}

export async function GET(request: NextRequest) {
  return handleSync(request)
}

export async function POST(request: NextRequest) {
  return handleSync(request)
}
