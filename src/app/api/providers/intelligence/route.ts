import { getProviderIntelligence } from '@/services/provider-intelligence.service'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'

export async function GET(request: Request) {
  const id = requestId(request)

  try {
    return apiOk(getProviderIntelligence(), id)
  } catch (error) {
    console.error('Provider intelligence error:', { requestId: id, error })

    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown provider intelligence error'),
    })
  }
}
