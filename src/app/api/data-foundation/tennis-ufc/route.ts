import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { getTennisUfcDataReadinessV2, validateTennisUfcDataReadinessV2 } from '@/services/tennis-ufc-data-readiness-v2.service'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: NextRequest) {
  const id = requestId(request)
  try {
    if (request.nextUrl.searchParams.get('validate') === 'true') {
      return apiOk(await validateTennisUfcDataReadinessV2(), id)
    }
    return apiOk(await getTennisUfcDataReadinessV2(), id)
  } catch (error) {
    return apiError({ id, code: 'INTERNAL_ERROR', message: errorMessage(error, 'Unknown Tennis/UFC data readiness error') })
  }
}
