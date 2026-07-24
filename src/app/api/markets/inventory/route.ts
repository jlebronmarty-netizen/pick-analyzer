import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { getUniversalMarketInventory } from '@/services/universal-market-intelligence.service'

export async function GET(request: NextRequest) {
  const id = requestId(request)
  try {
    return apiOk(await getUniversalMarketInventory(), id)
  } catch (error) {
    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown universal market inventory error'),
    })
  }
}
