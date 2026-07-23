import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { loadAdaptiveRefreshOrchestrator } from '@/lib/server-lazy-diagnostics'

export async function GET(request: NextRequest) {
  const id = requestId(request)
  try {
    const { getDataFreshnessStatus } = await loadAdaptiveRefreshOrchestrator()
    return apiOk(await getDataFreshnessStatus(), id)
  } catch (error) {
    return apiError({ id, code: 'INTERNAL_ERROR', message: errorMessage(error, 'Unknown data freshness error') })
  }
}
