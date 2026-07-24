import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { getMlbPlayerPropsReadinessAudit } from '@/services/mlb-player-props-readiness-audit.service'

export async function GET(request: NextRequest) {
  const id = requestId(request)
  try {
    return apiOk(await getMlbPlayerPropsReadinessAudit(), id)
  } catch (error) {
    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown MLB player props readiness audit error'),
    })
  }
}
