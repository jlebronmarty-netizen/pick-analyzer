import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, parseBooleanParam, parseIntegerParam, requestId } from '@/lib/api-contract'
import {
  runTheOddsApiCapabilityAudit,
  validateTheOddsApiCapabilityAuditFixtures,
} from '@/services/the-odds-api-capability-audit.service'

export async function GET(request: NextRequest) {
  const id = requestId(request)
  try {
    if (request.nextUrl.searchParams.get('validate') === 'true') {
      return apiOk(validateTheOddsApiCapabilityAuditFixtures(), id)
    }
    return apiOk(await runTheOddsApiCapabilityAudit({ dryRun: true }), id)
  } catch (error) {
    return apiError({ id, code: 'INTERNAL_ERROR', message: errorMessage(error, 'Unknown The Odds API capability audit dry-run error') })
  }
}

export async function POST(request: NextRequest) {
  const id = requestId(request)
  try {
    const body = (await request.json().catch(() => ({}))) as {
      dryRun?: boolean
      live?: boolean
      confirm?: string
      maxCalls?: number
    }
    const dryRun = body.dryRun !== false && !parseBooleanParam(request.nextUrl.searchParams.get('live'), false)
    const live = parseBooleanParam(request.nextUrl.searchParams.get('live'), false) || body.live === true
    const confirm = request.nextUrl.searchParams.get('confirm') ?? body.confirm ?? null
    const maxCalls = parseIntegerParam({
      value: request.nextUrl.searchParams.get('maxCalls') ?? (body.maxCalls === undefined ? null : String(body.maxCalls)),
      fallback: 15,
      min: 1,
      max: 15,
    })
    return apiOk(await runTheOddsApiCapabilityAudit({ dryRun, live, confirm, maxCalls }), id)
  } catch (error) {
    return apiError({ id, code: 'INTERNAL_ERROR', message: errorMessage(error, 'Unknown The Odds API capability audit error') })
  }
}
