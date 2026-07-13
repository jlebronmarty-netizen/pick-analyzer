import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { previewTennisFeatureStoreSnapshot } from '@/services/tennis-feature-store-integration.service'

export async function GET(request: NextRequest) {
  const id = requestId(request)

  try {
    return apiOk(previewTennisFeatureStoreSnapshot(), id)
  } catch (error) {
    console.error('Tennis Feature Store preview error:', { requestId: id, error })

    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown Tennis Feature Store preview error'),
    })
  }
}
