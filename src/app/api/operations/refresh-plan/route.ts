import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { getAdaptiveRefreshPlan } from '@/services/adaptive-refresh-orchestrator.service'

export async function GET(request: NextRequest) {
  const id = requestId(request)
  try {
    return apiOk(await getAdaptiveRefreshPlan(), id)
  } catch (error) {
    return apiError({ id, code: 'INTERNAL_ERROR', message: errorMessage(error, 'Unknown refresh plan error') })
  }
}
