import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { previewSoccerFeatureStoreSnapshot } from '@/services/soccer-feature-store-integration.service'

export async function GET(request: NextRequest) {
  const id = requestId(request)

  try {
    return apiOk(previewSoccerFeatureStoreSnapshot(), id)
  } catch (error) {
    console.error('Soccer Feature Store preview error:', { requestId: id, error })

    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown Soccer Feature Store preview error'),
    })
  }
}
