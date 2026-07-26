import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, parseIntegerParam, requestId } from '@/lib/api-contract'
import { getMlbPlayerPropComparisons } from '@/services/mlb-player-prop-comparison.service'

export async function GET(request: NextRequest) {
  const id = requestId(request)
  try {
    const date = request.nextUrl.searchParams.get('date')
    const limit = parseIntegerParam({ value: request.nextUrl.searchParams.get('limit'), fallback: 200, min: 1, max: 500 })
    return apiOk(await getMlbPlayerPropComparisons({ date, limit }), id)
  } catch (error) {
    return apiError({ id, code: 'INTERNAL_ERROR', message: errorMessage(error, 'Unknown MLB player prop comparison error') })
  }
}
