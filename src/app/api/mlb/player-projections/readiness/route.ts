import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { getMlbPlayerProjectionReadiness } from '@/services/mlb-player-projection-engine.service'

export async function GET(request: NextRequest) {
  const id = requestId(request)
  try {
    return apiOk(await getMlbPlayerProjectionReadiness(), id)
  } catch (error) {
    return apiError({ id, code: 'INTERNAL_ERROR', message: errorMessage(error, 'Unknown MLB player projection readiness error') })
  }
}
