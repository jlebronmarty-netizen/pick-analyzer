import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { getLegacyPredictionMetricIsolationV2, validateLegacyPredictionMetricIsolationV2 } from '@/services/legacy-prediction-metric-isolation-v2.service'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: NextRequest) {
  const id = requestId(request)
  try {
    if (request.nextUrl.searchParams.get('validate') === 'true') {
      return apiOk(await validateLegacyPredictionMetricIsolationV2(), id)
    }
    return apiOk(await getLegacyPredictionMetricIsolationV2(), id)
  } catch (error) {
    return apiError({ id, code: 'INTERNAL_ERROR', message: errorMessage(error, 'Unknown legacy metric isolation error') })
  }
}
