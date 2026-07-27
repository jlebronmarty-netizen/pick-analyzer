import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { getDataFoundationReconciliationV2, validateDataFoundationQualityV2 } from '@/services/data-foundation-quality-v2.service'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: NextRequest) {
  const id = requestId(request)
  try {
    if (request.nextUrl.searchParams.get('validate') === 'true') {
      return apiOk(await validateDataFoundationQualityV2(), id)
    }
    return apiOk(await getDataFoundationReconciliationV2(), id)
  } catch (error) {
    return apiError({ id, code: 'INTERNAL_ERROR', message: errorMessage(error, 'Unknown data foundation reconciliation error') })
  }
}
