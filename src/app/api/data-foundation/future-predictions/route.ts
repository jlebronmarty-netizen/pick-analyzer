import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { getFutureOnlyPredictionContinuityV2, validateFutureOnlyPredictionContinuityV2 } from '@/services/future-only-prediction-continuity-v2.service'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: NextRequest) {
  const id = requestId(request)
  try {
    if (request.nextUrl.searchParams.get('validate') === 'true') {
      return apiOk(await validateFutureOnlyPredictionContinuityV2(), id)
    }
    return apiOk(await getFutureOnlyPredictionContinuityV2(), id)
  } catch (error) {
    return apiError({ id, code: 'INTERNAL_ERROR', message: errorMessage(error, 'Unknown future-only prediction continuity error') })
  }
}
