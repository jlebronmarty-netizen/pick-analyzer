import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, parseBooleanParam, requestId } from '@/lib/api-contract'
import {
  getSportsDataIoSubscriptionMaximizationAudit,
  validateSportsDataIoSubscriptionMaximizationAuditFixtures,
} from '@/services/sportsdataio-subscription-maximization-audit.service'

export async function GET(request: NextRequest) {
  const id = requestId(request)
  try {
    const includeValidation = parseBooleanParam(request.nextUrl.searchParams.get('includeValidation'), false)
    return apiOk(
      {
        ...(await getSportsDataIoSubscriptionMaximizationAudit()),
        validation: includeValidation ? validateSportsDataIoSubscriptionMaximizationAuditFixtures() : undefined,
      },
      id
    )
  } catch (error) {
    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown SportsDataIO subscription maximization audit error'),
    })
  }
}

