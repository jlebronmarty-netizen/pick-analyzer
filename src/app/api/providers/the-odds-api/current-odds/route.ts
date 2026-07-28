import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, parseBooleanParam, parseIntegerParam, requestId } from '@/lib/api-contract'
import {
  runTheOddsApiCurrentOddsAcquisition,
  validateTheOddsApiCurrentOddsAcquisitionFixtures,
} from '@/services/the-odds-api-current-odds-acquisition.service'

export async function GET(request: NextRequest) {
  const id = requestId(request)
  try {
    if (request.nextUrl.searchParams.get('validate') === 'true') {
      return apiOk(validateTheOddsApiCurrentOddsAcquisitionFixtures(), id)
    }
    return apiOk(await runTheOddsApiCurrentOddsAcquisition({ dryRun: true }), id)
  } catch (error) {
    return apiError({ id, code: 'INTERNAL_ERROR', message: errorMessage(error, 'Unknown The Odds API current odds dry-run error') })
  }
}

export async function POST(request: NextRequest) {
  const id = requestId(request)
  try {
    const body = (await request.json().catch(() => ({}))) as {
      live?: boolean
      persist?: boolean
      confirm?: string
      maxCalls?: number
      maxSports?: number
      certifyIdempotency?: boolean
    }
    const live = parseBooleanParam(request.nextUrl.searchParams.get('live'), false) || body.live === true
    return apiOk(
      await runTheOddsApiCurrentOddsAcquisition({
        dryRun: !live,
        live,
        persist: parseBooleanParam(request.nextUrl.searchParams.get('persist'), false) || body.persist === true,
        confirm: request.nextUrl.searchParams.get('confirm') ?? body.confirm ?? null,
        maxCalls: parseIntegerParam({ value: request.nextUrl.searchParams.get('maxCalls') ?? (body.maxCalls === undefined ? null : String(body.maxCalls)), fallback: 18, min: 1, max: 18 }),
        maxSports: parseIntegerParam({ value: request.nextUrl.searchParams.get('maxSports') ?? (body.maxSports === undefined ? null : String(body.maxSports)), fallback: 6, min: 1, max: 8 }),
        certifyIdempotency: parseBooleanParam(request.nextUrl.searchParams.get('certifyIdempotency'), false) || body.certifyIdempotency === true,
      }),
      id
    )
  } catch (error) {
    return apiError({ id, code: 'INTERNAL_ERROR', message: errorMessage(error, 'Unknown The Odds API current odds acquisition error') })
  }
}
