import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import {
  getMlbFeatureModelReadiness,
  validateMlbFeatureModelReadinessFixtures,
} from '@/services/mlb-feature-model-readiness.service'

export async function GET(request: NextRequest) {
  const id = requestId(request)
  try {
    const season = request.nextUrl.searchParams.get('season') ?? '2026'
    const includeValidation = request.nextUrl.searchParams.get('includeValidation') === 'true'
    const readiness = await getMlbFeatureModelReadiness({ season })
    return apiOk({
      ...readiness,
      validation: includeValidation ? validateMlbFeatureModelReadinessFixtures() : undefined,
    }, id)
  } catch (error) {
    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown MLB feature/model readiness error'),
    })
  }
}
