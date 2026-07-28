import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import {
  getMultiSportDataExpansionFinalCertificationV1,
  validateMultiSportDataExpansionFinalCertificationV1Fixtures,
} from '@/services/multi-sport-data-expansion-final.service'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: NextRequest) {
  const id = requestId(request)
  try {
    if (request.nextUrl.searchParams.get('validate') === 'true') {
      return apiOk(validateMultiSportDataExpansionFinalCertificationV1Fixtures(), id)
    }
    return apiOk(await getMultiSportDataExpansionFinalCertificationV1(), id)
  } catch (error) {
    return apiError({ id, code: 'INTERNAL_ERROR', message: errorMessage(error, 'Unknown final multi-sport data expansion certification error') })
  }
}
