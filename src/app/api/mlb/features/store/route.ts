import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { getMlbFeatureStoreIntegrationStatus } from '@/services/mlb-feature-store-integration.service'

export async function GET(request: NextRequest) {
  const id = requestId(request)

  try {
    return apiOk(await getMlbFeatureStoreIntegrationStatus(), id)
  } catch (error) {
    console.error('MLB Feature Store integration error:', { requestId: id, error })

    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown MLB Feature Store integration error'),
    })
  }
}
