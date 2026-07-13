import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { previewNbaFeatureStoreSnapshot } from '@/services/nba-feature-store-integration.service'

export async function GET(request: NextRequest) {
  const id = requestId(request)

  try {
    return apiOk(await previewNbaFeatureStoreSnapshot(), id)
  } catch (error) {
    console.error('NBA Feature Store preview error:', { requestId: id, error })

    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown NBA Feature Store preview error'),
    })
  }
}
