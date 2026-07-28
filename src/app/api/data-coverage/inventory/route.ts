import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { getDataCoverageInventoryV1, validateDataCoverageInventoryV1Fixtures } from '@/services/data-coverage-inventory.service'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: NextRequest) {
  const id = requestId(request)
  try {
    if (request.nextUrl.searchParams.get('validate') === 'true') {
      return apiOk(validateDataCoverageInventoryV1Fixtures(), id)
    }
    return apiOk(await getDataCoverageInventoryV1(), id)
  } catch (error) {
    return apiError({ id, code: 'INTERNAL_ERROR', message: errorMessage(error, 'Unknown data coverage inventory error') })
  }
}
