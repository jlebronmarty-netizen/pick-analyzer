import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { getPredictionEpochGovernanceV2, validatePredictionEpochGovernanceV2 } from '@/services/prediction-epoch-governance-v2.service'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: NextRequest) {
  const id = requestId(request)
  try {
    if (request.nextUrl.searchParams.get('validate') === 'true') {
      return apiOk(await validatePredictionEpochGovernanceV2(), id)
    }
    return apiOk(await getPredictionEpochGovernanceV2(), id)
  } catch (error) {
    return apiError({ id, code: 'INTERNAL_ERROR', message: errorMessage(error, 'Unknown prediction epoch governance error') })
  }
}
