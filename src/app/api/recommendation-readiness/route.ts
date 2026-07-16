import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, parseBooleanParam, requestId } from '@/lib/api-contract'
import {
  getDay1RecommendationReadiness,
  validateDay1RecommendationReadinessFixtures,
} from '@/services/day1-recommendation-readiness.service'

export async function GET(request: NextRequest) {
  const id = requestId(request)
  try {
    const { searchParams } = new URL(request.url)
    if (parseBooleanParam(searchParams.get('validate'), false)) {
      return apiOk(validateDay1RecommendationReadinessFixtures(), id)
    }
    const result = await getDay1RecommendationReadiness()
    return apiOk(result, id)
  } catch (error) {
    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown recommendation readiness error'),
      status: 500,
    })
  }
}
