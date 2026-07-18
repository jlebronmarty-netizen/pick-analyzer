import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { getMlbPredictionComparison } from '@/services/mlb-model-platform.service'

export async function GET(request: NextRequest) {
  const id = requestId(request)
  try {
    const selectedDate = request.nextUrl.searchParams.get('selectedDate') ?? request.nextUrl.searchParams.get('date') ?? '2026-07-17'
    const modelVersion = request.nextUrl.searchParams.get('modelVersion') ?? undefined
    return apiOk(await getMlbPredictionComparison({ selectedDate, modelVersion }), id)
  } catch (error) {
    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown MLB prediction comparison error'),
      status: 500,
    })
  }
}
