import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { getProductionReadinessAudit } from '@/services/production-readiness-audit.service'

export async function GET(request: NextRequest) {
  const id = requestId(request)
  try {
    return apiOk(await getProductionReadinessAudit(), id)
  } catch (error) {
    return apiError({ id, code: 'INTERNAL_ERROR', message: errorMessage(error, 'Unknown production readiness audit error') })
  }
}
