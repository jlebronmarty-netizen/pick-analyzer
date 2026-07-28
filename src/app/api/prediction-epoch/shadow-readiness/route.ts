import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, parseIntegerParam, requestId } from '@/lib/api-contract'
import { getPredictionEpochShadowReadiness } from '@/services/prediction-epoch-shadow-readiness.service'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const id = requestId(request)
  try {
    const limit = parseIntegerParam({ value: request.nextUrl.searchParams.get('limit'), fallback: 75, min: 1, max: 250 })
    const selectedDate = request.nextUrl.searchParams.get('date') ?? request.nextUrl.searchParams.get('selectedDate')
    return apiOk(await getPredictionEpochShadowReadiness({ limit, selectedDate }), id)
  } catch (error) {
    return apiError({ id, code: 'INTERNAL_ERROR', message: errorMessage(error, 'Unknown prediction epoch shadow readiness error') })
  }
}

