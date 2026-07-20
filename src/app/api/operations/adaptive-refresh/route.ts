import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, parseBooleanParam, requestId } from '@/lib/api-contract'
import { runAdaptiveRefresh } from '@/services/adaptive-refresh-orchestrator.service'

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return request.headers.get('authorization') === `Bearer ${secret}` || request.nextUrl.searchParams.get('secret') === secret
}

async function handle(request: NextRequest) {
  const id = requestId(request)
  try {
    const dryRun = parseBooleanParam(request.nextUrl.searchParams.get('dryRun'), true)
    if (dryRun === false && !authorized(request)) {
      return apiError({
        id,
        code: 'UNAUTHORIZED',
        message: 'Protected adaptive refresh execution requires CRON_SECRET authorization.',
        status: 401,
      })
    }
    return apiOk(await runAdaptiveRefresh({ dryRun, source: request.method === 'POST' ? 'MANUAL_PROTECTED' : 'SYSTEM' }), id)
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
