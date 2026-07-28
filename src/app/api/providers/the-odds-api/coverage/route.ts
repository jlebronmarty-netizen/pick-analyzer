import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, parseBooleanParam, parseIntegerParam, requestId } from '@/lib/api-contract'
import { getTheOddsApiCoverage } from '@/services/the-odds-api-maximum-utilization.service'

export async function GET(request: NextRequest) {
  const id = requestId(request)
  try {
    return apiOk(
      await getTheOddsApiCoverage({
        dryRun: !parseBooleanParam(request.nextUrl.searchParams.get('live'), false),
        live: parseBooleanParam(request.nextUrl.searchParams.get('live'), false),
        confirm: request.nextUrl.searchParams.get('confirm'),
        maxCalls: parseIntegerParam({ value: request.nextUrl.searchParams.get('maxCalls'), fallback: 12, min: 1, max: 12 }),
        maxSports: parseIntegerParam({ value: request.nextUrl.searchParams.get('maxSports'), fallback: 6, min: 1, max: 8 }),
      }),
      id
    )
  } catch (error) {
    return apiError({ id, code: 'INTERNAL_ERROR', message: errorMessage(error, 'Unknown The Odds API coverage error') })
  }
}
