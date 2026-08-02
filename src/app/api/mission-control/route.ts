import { NextRequest } from 'next/server'

import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { getMissionControl } from '@/services/mission-control.service'

export async function GET(request: NextRequest) {
  const id = requestId(request)
  try {
    return apiOk(await getMissionControl(), id)
  } catch (error) {
    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown mission-control status error'),
    })
  }
}
