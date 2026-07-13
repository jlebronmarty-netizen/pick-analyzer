import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { runProviderAdapterFixtureValidation } from '@/services/provider-adapter-sdk.service'

export async function GET(request: NextRequest) {
  const id = requestId(request)

  try {
    return apiOk(runProviderAdapterFixtureValidation(), id)
  } catch (error) {
    console.error('Provider Adapter SDK validation error:', {
      requestId: id,
      error,
    })

    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown Provider Adapter SDK validation error'),
    })
  }
}
