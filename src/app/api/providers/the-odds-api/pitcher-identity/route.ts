import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, parseBooleanParam, parseIntegerParam, requestId } from '@/lib/api-contract'
import { runTheOddsApiPitcherIdentityBridge, validateTheOddsApiPitcherIdentityBridgeFixtures } from '@/services/the-odds-api-pitcher-identity-bridge.service'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: NextRequest) {
  const id = requestId(request)
  try {
    if (request.nextUrl.searchParams.get('validate') === 'true') {
      return apiOk(validateTheOddsApiPitcherIdentityBridgeFixtures(), id)
    }
    return apiOk(await runTheOddsApiPitcherIdentityBridge({ dryRun: true }), id)
  } catch (error) {
    return apiError({ id, code: 'INTERNAL_ERROR', message: errorMessage(error, 'Unknown The Odds API pitcher identity dry-run error') })
  }
}

export async function POST(request: NextRequest) {
  const id = requestId(request)
  try {
    const body = await request.json().catch(() => ({}))
    const live = parseBooleanParam(request.nextUrl.searchParams.get('live'), false) || body?.live === true
    const persist = parseBooleanParam(request.nextUrl.searchParams.get('persist'), false) || body?.persist === true
    const confirm = request.nextUrl.searchParams.get('confirm') ?? (typeof body?.confirm === 'string' ? body.confirm : null)
    const maxCalls = parseIntegerParam({
      value: request.nextUrl.searchParams.get('maxCalls') ?? (body?.maxCalls === undefined ? null : String(body.maxCalls)),
      fallback: 1,
      min: 0,
      max: 3,
    })
    const result = await runTheOddsApiPitcherIdentityBridge({ dryRun: !live && !persist, live: live || persist, persist, confirm, maxCalls })
    const status = result.status?.startsWith('BLOCKED') ? 409 : 200
    return apiOk(result, id, { status })
  } catch (error) {
    return apiError({ id, code: 'INTERNAL_ERROR', message: errorMessage(error, 'Unknown The Odds API pitcher identity bridge error') })
  }
}
