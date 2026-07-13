import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { getFeatureStoreStatus } from '@/services/feature-store-core.service'

export async function GET(request: NextRequest) {
  const id = requestId(request)

  try {
    return apiOk(getFeatureStoreStatus(), id)
  } catch (error) {
    console.error('Feature Store status error:', { requestId: id, error })

    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown Feature Store status error'),
    })
  }
}
