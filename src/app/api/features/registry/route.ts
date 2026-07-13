import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { getMultiSportFeatureRegistry } from '@/services/multi-sport-feature-registry.service'

export async function GET(request: NextRequest) {
  const id = requestId(request)

  try {
    return apiOk(getMultiSportFeatureRegistry(), id)
  } catch (error) {
    console.error('Multi-Sport Feature Registry error:', { requestId: id, error })

    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown feature registry error'),
    })
  }
}
