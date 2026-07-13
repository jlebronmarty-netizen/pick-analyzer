import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { getNhlFeatureStoreIntegrationStatus } from '@/services/nhl-feature-store-integration.service'

export async function GET(request: NextRequest) {
  const id = requestId(request)

  try {
    return apiOk(await getNhlFeatureStoreIntegrationStatus(), id)
  } catch (error) {
    console.error('NHL Feature Store integration error:', { requestId: id, error })

    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown NHL Feature Store integration error'),
    })
  }
}
