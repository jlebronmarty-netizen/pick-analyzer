import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { getTennisFeatureStoreIntegrationStatus } from '@/services/tennis-feature-store-integration.service'

export async function GET(request: NextRequest) {
  const id = requestId(request)

  try {
    return apiOk(await getTennisFeatureStoreIntegrationStatus(), id)
  } catch (error) {
    console.error('Tennis Feature Store integration error:', { requestId: id, error })

    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown Tennis Feature Store integration error'),
    })
  }
}
