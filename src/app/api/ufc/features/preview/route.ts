import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { previewUfcFeatureStoreSnapshot } from '@/services/ufc-feature-store-integration.service'

export async function GET(request: NextRequest) {
  const id = requestId(request)

  try {
    return apiOk(previewUfcFeatureStoreSnapshot(), id)
  } catch (error) {
    console.error('UFC Feature Store preview error:', { requestId: id, error })

    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown UFC Feature Store preview error'),
    })
  }
}
