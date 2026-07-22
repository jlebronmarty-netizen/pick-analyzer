import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import {
  getLegacyPredictionProvenanceReport,
  validateLegacyPredictionProvenanceFixtures,
} from '@/services/legacy-prediction-provenance.service'

export async function GET(request: NextRequest) {
  const id = requestId(request)
  try {
    const { searchParams } = new URL(request.url)
    if (searchParams.get('validate') === 'true') {
      return apiOk(validateLegacyPredictionProvenanceFixtures(), id)
    }
    return apiOk(await getLegacyPredictionProvenanceReport(), id)
  } catch (error) {
    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown prediction provenance error'),
      status: 500,
    })
  }
}
