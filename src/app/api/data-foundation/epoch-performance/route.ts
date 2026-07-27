import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { getEpochPerformanceLearningV2, validateEpochPerformanceLearningV2 } from '@/services/epoch-performance-learning-v2.service'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: NextRequest) {
  const id = requestId(request)
  try {
    if (request.nextUrl.searchParams.get('validate') === 'true') {
      return apiOk(await validateEpochPerformanceLearningV2(), id)
    }
    return apiOk(await getEpochPerformanceLearningV2(), id)
  } catch (error) {
    return apiError({ id, code: 'INTERNAL_ERROR', message: errorMessage(error, 'Unknown epoch performance learning error') })
  }
}
