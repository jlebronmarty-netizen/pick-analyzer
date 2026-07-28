import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import {
  getMultiSportProviderEntitlementAuditV1,
  validateMultiSportProviderEntitlementAuditV1Fixtures,
} from '@/services/multi-sport-provider-entitlement-audit.service'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: NextRequest) {
  const id = requestId(request)
  try {
    if (request.nextUrl.searchParams.get('validate') === 'true') {
      return apiOk(validateMultiSportProviderEntitlementAuditV1Fixtures(), id)
    }
    return apiOk(await getMultiSportProviderEntitlementAuditV1(), id)
  } catch (error) {
    return apiError({ id, code: 'INTERNAL_ERROR', message: errorMessage(error, 'Unknown provider entitlement audit error') })
  }
}
