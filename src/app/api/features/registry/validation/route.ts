import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { runMultiSportFeatureRegistryValidation } from '@/services/multi-sport-feature-registry.service'

export async function GET(request: NextRequest) {
  const id = requestId(request)

  try {
    return apiOk(runMultiSportFeatureRegistryValidation(), id)
  } catch (error) {
    console.error('Multi-Sport Feature Registry validation error:', {
      requestId: id,
      error,
    })

    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown feature registry validation error'),
    })
  }
}
