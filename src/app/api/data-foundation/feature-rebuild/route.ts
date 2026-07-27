import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { getFeatureRebuildPlanV2, validateFeatureRebuildPlanV2 } from '@/services/feature-rebuild-plan-v2.service'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: NextRequest) {
  const id = requestId(request)
  try {
    if (request.nextUrl.searchParams.get('validate') === 'true') {
      return apiOk(await validateFeatureRebuildPlanV2(), id)
    }
    return apiOk(await getFeatureRebuildPlanV2(), id)
  } catch (error) {
    return apiError({ id, code: 'INTERNAL_ERROR', message: errorMessage(error, 'Unknown feature rebuild plan error') })
  }
}
