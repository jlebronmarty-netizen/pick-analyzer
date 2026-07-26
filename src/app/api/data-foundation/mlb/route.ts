import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { getMlbHistoricalFoundationV2, validateMlbHistoricalFoundationV2 } from '@/services/mlb-historical-foundation-v2.service'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: NextRequest) {
  const id = requestId(request)
  try {
    if (request.nextUrl.searchParams.get('validate') === 'true') {
      return apiOk(await validateMlbHistoricalFoundationV2(), id)
    }
    return apiOk(await getMlbHistoricalFoundationV2(), id)
  } catch (error) {
    return apiError({ id, code: 'INTERNAL_ERROR', message: errorMessage(error, 'Unknown MLB historical foundation error') })
  }
}
