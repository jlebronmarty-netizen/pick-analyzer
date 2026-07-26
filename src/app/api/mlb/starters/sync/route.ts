import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { syncMlbStarterAssignments } from '@/services/mlb-starter-sync.service'

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  return request.headers.get('authorization') === `Bearer ${secret}` || request.nextUrl.searchParams.get('secret') === secret
}

export async function POST(request: NextRequest) {
  const id = requestId(request)
  try {
    const body = await request.json().catch(() => ({}))
    const dryRun = body?.dryRun !== false
    const refreshProvider = body?.refreshProvider === true
    if ((!dryRun || refreshProvider) && !authorized(request)) {
      return apiError({ id, code: 'UNAUTHORIZED', message: 'Unauthorized MLB starter sync request.', status: 401 })
    }
    return apiOk(await syncMlbStarterAssignments({
      date: typeof body?.date === 'string' ? body.date : request.nextUrl.searchParams.get('date'),
      dryRun,
      refreshProvider,
      confirmed: body?.confirmed === true,
      timeoutMs: body?.timeoutMs ?? null,
    }), id)
  } catch (error) {
    return apiError({ id, code: 'INTERNAL_ERROR', message: errorMessage(error, 'Unknown MLB starter sync error') })
  }
}
