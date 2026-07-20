import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { getAdaptiveRefreshStatus } from '@/services/adaptive-refresh-orchestrator.service'

export async function GET(request: NextRequest) {
  const id = requestId(request)
  try {
    return apiOk(await getAdaptiveRefreshStatus(), id)
  } catch (error) {
    return apiError({ id, code: 'INTERNAL_ERROR', message: errorMessage(error, 'Unknown adaptive refresh status error') })
  }
}
