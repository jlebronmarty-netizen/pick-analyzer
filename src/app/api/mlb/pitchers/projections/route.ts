import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, parseIntegerParam, requestId } from '@/lib/api-contract'
import { previewPitcherProjection } from '@/services/mlb-pitcher-projection-engine.service'

export async function GET(request: NextRequest) {
  const id = requestId(request)
  try {
    const date = request.nextUrl.searchParams.get('date')
    const limit = parseIntegerParam({ value: request.nextUrl.searchParams.get('limit'), fallback: 80, min: 1, max: 200 })
    return apiOk(await previewPitcherProjection({ date, limit }), id)
  } catch (error) {
    return apiError({ id, code: 'INTERNAL_ERROR', message: errorMessage(error, 'Unknown MLB pitcher projections error') })
  }
}
