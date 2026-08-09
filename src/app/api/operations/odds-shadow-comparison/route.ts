import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, parseBooleanParam, parseIntegerParam, requestId } from '@/lib/api-contract'
import {
  runOdds02ShadowComparison,
  validateOdds02ShadowCredentialIsolation,
} from '@/services/odds02-shadow-comparison.service'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return request.headers.get('authorization') === `Bearer ${secret}` || request.nextUrl.searchParams.get('secret') === secret
}

export async function GET(request: NextRequest) {
  const id = requestId(request)
  try {
    if (request.nextUrl.searchParams.get('validate') === 'true') {
      return apiOk(validateOdds02ShadowCredentialIsolation(), id)
    }
    return apiOk(await runOdds02ShadowComparison({ dryRun: true }), id)
  } catch (error) {
    return apiError({ id, code: 'INTERNAL_ERROR', message: errorMessage(error, 'Unknown ODDS-02 shadow comparison dry-run error') })
  }
}

export async function POST(request: NextRequest) {
  const id = requestId(request)
  try {
    if (!authorized(request)) {
      return apiError({ id, code: 'UNAUTHORIZED', message: 'Unauthorized ODDS-02 shadow comparison request.', status: 401 })
    }
    const body = await request.json().catch(() => ({}))
    const live = parseBooleanParam(request.nextUrl.searchParams.get('live'), false) || body?.live === true
    const result = await runOdds02ShadowComparison({
      dryRun: !live,
      live,
      confirm: request.nextUrl.searchParams.get('confirm') ?? (typeof body?.confirm === 'string' ? body.confirm : null),
      maxCalls: parseIntegerParam({
        value: request.nextUrl.searchParams.get('maxCalls') ?? (body?.maxCalls === undefined ? null : String(body.maxCalls)),
        fallback: 1,
        min: 1,
        max: 3,
      }),
    })
    const status = result.status?.startsWith('BLOCKED') ? 409 : 200
    return apiOk(result, id, { status })
  } catch (error) {
    return apiError({ id, code: 'INTERNAL_ERROR', message: errorMessage(error, 'Unknown ODDS-02 shadow comparison error') })
  }
}
