import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, parseBooleanParam, requestId } from '@/lib/api-contract'
import { loadAdaptiveRefreshOrchestrator } from '@/lib/server-lazy-diagnostics'

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return request.headers.get('authorization') === `Bearer ${secret}` || request.nextUrl.searchParams.get('secret') === secret
}

async function handle(request: NextRequest) {
  const id = requestId(request)
  try {
    const dryRun = parseBooleanParam(request.nextUrl.searchParams.get('dryRun'), true)
    const body = request.method === 'POST' ? await request.json().catch(() => ({})) : {}
    const expectedAction = String(
      (body as Record<string, unknown>)?.expectedAction ?? request.nextUrl.searchParams.get('expectedAction') ?? ''
    ).trim() || null
    if (dryRun === false && !authorized(request)) {
      return apiError({
        id,
        code: 'UNAUTHORIZED',
        message: 'Protected adaptive refresh execution requires CRON_SECRET authorization.',
        status: 401,
      })
    }
    const { runAdaptiveRefresh } = await loadAdaptiveRefreshOrchestrator()
    return apiOk(await runAdaptiveRefresh({
      dryRun,
      source: request.method === 'POST' ? 'MANUAL_PROTECTED' : 'SYSTEM',
      expectedAction,
    }), id)
  } catch (error) {
    return apiError({ id, code: 'INTERNAL_ERROR', message: errorMessage(error, 'Unknown adaptive refresh error') })
  }
}

export async function GET(request: NextRequest) {
  return handle(request)
}

export async function POST(request: NextRequest) {
  return handle(request)
}
