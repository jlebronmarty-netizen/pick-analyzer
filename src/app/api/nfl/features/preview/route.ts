import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { previewNflFeatureStoreSnapshot } from '@/services/nfl-feature-store-integration.service'

export async function GET(request: NextRequest) {
  const id = requestId(request)

  try {
    return apiOk(previewNflFeatureStoreSnapshot(), id)
  } catch (error) {
    console.error('NFL Feature Store preview error:', { requestId: id, error })

    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown NFL Feature Store preview error'),
    })
  }
}
