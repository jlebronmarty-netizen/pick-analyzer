import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { getUfcFeatureStoreIntegrationStatus } from '@/services/ufc-feature-store-integration.service'

export async function GET(request: NextRequest) {
  const id = requestId(request)

  try {
    return apiOk(await getUfcFeatureStoreIntegrationStatus(), id)
  } catch (error) {
    console.error('UFC Feature Store integration error:', { requestId: id, error })

    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown UFC Feature Store integration error'),
    })
  }
}
