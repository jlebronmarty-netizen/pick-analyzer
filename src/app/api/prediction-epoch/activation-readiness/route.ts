import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { getPredictionEpochActivationReadinessV1 } from '@/services/prediction-epoch-shadow-readiness.service'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const id = requestId(request)
  try {
    return apiOk(await getPredictionEpochActivationReadinessV1(), id)
  } catch (error) {
    return apiError({ id, code: 'INTERNAL_ERROR', message: errorMessage(error, 'Unknown prediction epoch activation readiness error') })
  }
}

