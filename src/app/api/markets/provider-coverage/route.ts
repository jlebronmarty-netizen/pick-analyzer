import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { getUniversalProviderCoverage } from '@/services/universal-market-intelligence.service'

export async function GET(request: NextRequest) {
  const id = requestId(request)
  try {
    return apiOk(await getUniversalProviderCoverage(), id)
  } catch (error) {
    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown universal market provider coverage error'),
    })
  }
}
