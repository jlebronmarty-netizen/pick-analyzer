import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { getBsnDataCoverageDashboard } from '@/services/basketball/acquisition/bsn-acquisition-engine'

export async function GET(request: NextRequest) {
  const id = requestId(request)
  try {
    return apiOk(await getBsnDataCoverageDashboard(), id)
  } catch (error) {
    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown BSN data coverage error'),
      status: 500,
    })
  }
}
