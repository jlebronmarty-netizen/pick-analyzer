import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { getNflFeatureStoreIntegrationStatus } from '@/services/nfl-feature-store-integration.service'

export async function GET(request: NextRequest) {
  const id = requestId(request)

  try {
    return apiOk(await getNflFeatureStoreIntegrationStatus(), id)
  } catch (error) {
    console.error('NFL Feature Store integration error:', { requestId: id, error })

    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown NFL Feature Store integration error'),
    })
  }
}
