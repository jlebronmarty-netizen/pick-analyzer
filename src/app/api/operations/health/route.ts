import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { getOperationsHealth } from '@/services/operations-health.service'

export async function GET(request: NextRequest) {
  const id = requestId(request)
  try {
    return apiOk(await getOperationsHealth(), id)
  } catch (error) {
    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown operations health error'),
    })
  }
}
